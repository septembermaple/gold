/**
 * JWT 和密码工具函数
 * 使用 Web Crypto API (SubtleCrypto) 实现，兼容 Cloudflare Workers 环境
 */

/**
 * Base64URL 编码
 */
function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL 解码
 */
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 字符串转 Uint8Array
 */
function stringToUint8Array(str) {
  return new TextEncoder().encode(str);
}

/**
 * 生成 JWT Token
 * @param {object} payload - 载荷数据
 * @param {string} secret - 密钥
 * @param {string|number} expiresIn - 过期时间，如 '7d', '24h', '30m' 或秒数
 * @returns {Promise<string>} JWT token
 */
export async function generateToken(payload, secret, expiresIn = '7d') {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiresIn(expiresIn);

  const tokenPayload = {
    ...payload,
    iat: now,
    exp,
  };

  const encodedHeader = base64UrlEncode(stringToUint8Array(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(stringToUint8Array(JSON.stringify(tokenPayload)));

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    key,
    stringToUint8Array(signatureInput)
  );

  const encodedSignature = base64UrlEncode(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * 验证 JWT Token
 * @param {string} token - JWT token
 * @param {string} secret - 密钥
 * @returns {Promise<object|null>} 解码后的载荷，验证失败返回 null
 */
export async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // 验证签名
    const key = await importKey(secret);
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await crypto.subtle.sign(
      { name: 'HMAC', hash: 'SHA-256' },
      key,
      stringToUint8Array(signatureInput)
    );

    const actualSignature = base64UrlDecode(encodedSignature);
    const expectedSigBytes = new Uint8Array(expectedSignature);

    if (actualSignature.length !== expectedSigBytes.length) {
      return null;
    }

    // 常量时间比较，防止时序攻击
    let diff = 0;
    for (let i = 0; i < actualSignature.length; i++) {
      diff |= actualSignature[i] ^ expectedSigBytes[i];
    }
    if (diff !== 0) {
      return null;
    }

    // 解码载荷
    const payloadBytes = base64UrlDecode(encodedPayload);
    const payloadStr = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadStr);

    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * 导入 HMAC 密钥
 */
async function importKey(secret) {
  return await crypto.subtle.importKey(
    'raw',
    stringToUint8Array(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * 解析过期时间字符串
 * @param {string|number} expiresIn - 如 '7d', '24h', '30m', '60s' 或秒数
 * @returns {number} 秒数
 */
function parseExpiresIn(expiresIn) {
  if (typeof expiresIn === 'number') {
    return expiresIn;
  }

  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60; // 默认7天
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 7 * 24 * 60 * 60;
  }
}

/**
 * 生成随机盐值
 * @param {number} length - 盐值字节长度
 * @returns {string} 十六进制盐值
 */
function generateSalt(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 使用 SHA-256 + salt 哈希密码
 * Cloudflare Workers 不支持 bcrypt，使用 SHA-256 + salt 替代
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 格式: salt:hash
 */
export async function hashPassword(password) {
  const salt = generateSalt(16);
  const hash = await computeHash(salt + password);
  return `${salt}:${hash}`;
}

/**
 * 验证密码
 * @param {string} password - 明文密码
 * @param {string} storedHash - 存储的哈希值 (格式: salt:hash)
 * @returns {Promise<boolean>} 是否匹配
 */
export async function verifyPassword(password, storedHash) {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) {
      return false;
    }
    const computedHash = await computeHash(salt + password);
    // 常量时间比较
    if (computedHash.length !== hash.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < computedHash.length; i++) {
      diff |= computedHash.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    return diff === 0;
  } catch (e) {
    return false;
  }
}

/**
 * 计算 SHA-256 哈希
 * @param {string} input - 输入字符串
 * @returns {Promise<string>} 十六进制哈希值
 */
async function computeHash(input) {
  const data = stringToUint8Array(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
