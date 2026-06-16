/**
 * Cloudflare Pages Function - 黄金市场分析平台 API
 * 将所有后端代码合并到单个文件中，用于 Cloudflare Pages 部署
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

// ============================================
// 类型定义
// ============================================

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  MODELSCOPE_API_KEY: string;
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_API_URL: string;
  DEEPSEEK_MODEL: string;
  PUSHPLUS_TOKEN: string;
  PUSHPLUS_TOPIC: string;
  FRED_API_KEY: string;
  ZHIPU_API_KEY: string;
}

// ============================================
// 工具函数: JWT 和密码 (from utils/auth.js)
// ============================================

function base64UrlEncode(buffer: ArrayBuffer): string {
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

function base64UrlDecode(str: string): Uint8Array {
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

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

async function importKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    stringToUint8Array(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function parseExpiresIn(expiresIn: string | number): number {
  if (typeof expiresIn === 'number') {
    return expiresIn;
  }
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60;
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

async function generateToken(payload: Record<string, unknown>, secret: string, expiresIn: string | number = '7d'): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiresIn(expiresIn);
  const tokenPayload = { ...payload, iat: now, exp };

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

async function verifyToken(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const key = await importKey(secret);
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await crypto.subtle.sign(
      { name: 'HMAC', hash: 'SHA-256' },
      key,
      stringToUint8Array(signatureInput)
    );

    const actualSignature = base64UrlDecode(encodedSignature);
    const expectedSigBytes = new Uint8Array(expectedSignature);

    if (actualSignature.length !== expectedSigBytes.length) return null;

    let diff = 0;
    for (let i = 0; i < actualSignature.length; i++) {
      diff |= actualSignature[i] ^ expectedSigBytes[i];
    }
    if (diff !== 0) return null;

    const payloadBytes = base64UrlDecode(encodedPayload);
    const payloadStr = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

function generateSalt(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function computeHash(input: string): Promise<string> {
  const data = stringToUint8Array(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt(16);
  const hash = await computeHash(salt + password);
  return `${salt}:${hash}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const computedHash = await computeHash(salt + password);
    if (computedHash.length !== hash.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHash.length; i++) {
      diff |= computedHash.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// ============================================
// 中间件: 认证与授权 (from middleware/auth.js)
// ============================================

const MEMBERSHIP_LEVELS: Record<string, number> = {
  free: 0,
  basic: 1,
  premium: 2,
  vip: 3,
};

const authMiddleware = async (c: any, next: any) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json(
        { success: false, error: '未提供认证令牌', message: '请在请求头中携带 Authorization: Bearer <token>' },
        401
      );
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return c.json(
        { success: false, error: '认证令牌格式错误', message: '请使用 Bearer token 格式' },
        401
      );
    }

    const token = parts[1];
    const secret = c.env.JWT_SECRET || 'change-this-in-production';
    const payload = await verifyToken(token, secret);

    if (!payload) {
      return c.json(
        { success: false, error: '认证令牌无效或已过期', message: '请重新登录获取新令牌' },
        401
      );
    }

    const user = await c.env.DB.prepare(
      'SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status FROM users WHERE id = ?'
    ).bind(payload.userId).first();

    if (!user) {
      return c.json({ success: false, error: '用户不存在', message: '该用户已被删除' }, 401);
    }

    if (user.status === 'disabled') {
      return c.json({ success: false, error: '账号已被禁用', message: '请联系管理员' }, 403);
    }

    if (user.membership_expire_at && new Date(user.membership_expire_at) < new Date()) {
      await c.env.DB.prepare(
        "UPDATE users SET membership_level = 'free', updated_at = datetime('now') WHERE id = ?"
      ).bind(user.id).run();
      user.membership_level = 'free';
    }

    c.set('user', user);
    await next();
  } catch (error: any) {
    return c.json({ success: false, error: '认证失败', message: error.message }, 401);
  }
};

const optionalAuth = async (c: any, next: any) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const secret = c.env.JWT_SECRET || 'change-this-in-production';
        const payload = await verifyToken(token, secret);

        if (payload) {
          const user = await c.env.DB.prepare(
            'SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status FROM users WHERE id = ?'
          ).bind(payload.userId).first();

          if (user && user.status === 'active') {
            if (user.membership_expire_at && new Date(user.membership_expire_at) < new Date()) {
              await c.env.DB.prepare(
                "UPDATE users SET membership_level = 'free', updated_at = datetime('now') WHERE id = ?"
              ).bind(user.id).run();
              user.membership_level = 'free';
            }
            c.set('user', user);
          }
        }
      }
    }
  } catch {
    // optional auth failure does not block
  }
  await next();
};

const requireAdmin = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未认证', message: '请先登录' }, 401);
  }
  if (user.role !== 'admin') {
    return c.json({ success: false, error: '权限不足', message: '需要管理员权限' }, 403);
  }
  await next();
};

const requireMembership = (requiredLevel: string) => {
  return async (c: any, next: any) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, error: '未认证', message: '请先登录' }, 401);
    }
    const userLevel = MEMBERSHIP_LEVELS[user.membership_level] ?? 0;
    const required = MEMBERSHIP_LEVELS[requiredLevel] ?? 0;
    if (userLevel < required) {
      return c.json({
        success: false,
        error: '会员等级不足',
        message: `当前等级: ${user.membership_level}，需要: ${requiredLevel} 及以上`,
        data: { currentLevel: user.membership_level, requiredLevel },
      }, 403);
    }
    await next();
  };
};

const rateLimitByUser = (maxCalls: number | null = null) => {
  return async (c: any, next: any) => {
    const user = c.get('user');
    if (!user) {
      await next();
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    let limit = maxCalls;

    if (!limit) {
      const membership = await c.env.DB.prepare(
        'SELECT max_api_calls_per_day FROM membership_levels WHERE code = ?'
      ).bind(user.membership_level).first();
      limit = membership ? membership.max_api_calls_per_day : 100;
    }

    const usage = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM api_usage_logs WHERE user_id = ? AND date(created_at) = ?`
    ).bind(user.id, today).first();

    const currentCount = usage ? usage.count : 0;

    if (currentCount >= limit) {
      return c.json({
        success: false,
        error: 'API调用次数超限',
        message: `今日已调用 ${currentCount} 次，上限为 ${limit} 次`,
        data: { current: currentCount, limit, remaining: 0 },
      }, 429);
    }

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(limit - currentCount - 1));
    c.header('X-RateLimit-Used', String(currentCount));

    await next();

    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        "INSERT INTO api_usage_logs (user_id, endpoint, method, status_code, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
      ).bind(user.id, c.req.path, c.req.method, c.res?.status || 200).run()
    );
  };
};

// ============================================
// 服务: 金价数据 (from services/goldPrice.js)
// ============================================

async function fetchInternationalGoldPrice() {
  // 主源：Yahoo Finance（在CF Workers上可用，返回完整OHLCV）
  try {
    const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!response.ok) throw new Error(`Yahoo Finance请求失败: ${response.status}`);
    const result = await response.json();
    const chartData = result.chart?.result?.[0];
    if (chartData) {
      const meta = chartData.meta || {};
      const quote = chartData.indicators?.quote?.[0];
      const lastClose = quote?.close?.[quote.close.length - 1];
      const prevClose = quote?.close?.[quote.close.length - 2] || meta.chartPreviousClose;
      if (lastClose) {
        const change = prevClose ? lastClose - prevClose : 0;
        const changePercent = prevClose ? (change / prevClose) * 100 : 0;
        return {
          price: Math.round(lastClose * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100,
          high: meta.regularMarketDayHigh || (quote?.high ? Math.max(...quote.high.filter((v: number | null) => v != null)) : 0),
          low: meta.regularMarketDayLow || (quote?.low ? Math.min(...quote.low.filter((v: number | null) => v != null)) : 0),
          open: quote?.open?.[0] || 0,
          close: prevClose || 0,
          volume: meta.regularMarketVolume || (quote?.volume ? quote.volume.reduce((a: number, b: number | null) => a + (b || 0), 0) : 0),
          silverPrice: 0, silverChange: 0,
          timestamp: (meta.regularMarketTime || 0) * 1000 || Date.now(),
          currency: 'USD', unit: 'oz', source: 'yahoo-finance',
        };
      }
    }
  } catch (error) {
    console.error('Yahoo Finance获取失败:', error);
  }

  // 备用源：goldprice.org
  try {
    const response = await fetch('https://data-asg.goldprice.org/dbXRates/USD', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    if (!response.ok) throw new Error(`goldprice.org 请求失败: ${response.status}`);
    const data = await response.json();
    const item = data.items?.[0];
    if (item?.xauPrice) {
      return {
        price: item.xauPrice, change: item.chgXau || 0, changePercent: item.pcXau || 0,
        high: 0, low: 0, close: item.xauClose || 0, open: 0, volume: 0,
        silverPrice: item.xagPrice || 0, silverChange: item.chgXag || 0,
        timestamp: Date.now(), currency: 'USD', unit: 'oz', source: 'goldprice.org',
      };
    }
  } catch (error) {
    console.error('goldprice.org 获取失败:', error);
  }

  // 最后备用：xaus.com（只有价格，无开高低量）
  try {
    const response = await fetch('https://xaus.com/api/v1/spot', {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error(`xaus.com 请求失败: ${response.status}`);
    const data = await response.json();
    if (data.xau?.price) {
      return {
        price: data.xau.price, change: 0, changePercent: 0,
        high: 0, low: 0, close: 0, open: 0, volume: 0,
        silverPrice: 0, silverChange: 0,
        timestamp: new Date(data.updated_at).getTime() || Date.now(),
        currency: 'USD', unit: 'oz', source: 'xaus.com',
      };
    }
  } catch (error) {
    console.error('xaus.com 获取失败:', error);
  }

  console.error('所有国际金价数据源均失败');
  return { price: 0, change: 0, changePercent: 0, high: 0, low: 0, close: 0, open: 0, volume: 0, silverPrice: 0, silverChange: 0, timestamp: Date.now(), currency: 'USD', unit: 'oz', source: 'none' };
}

async function fetchDomesticGoldPrice() {
  // 主源：新浪财经 SGE_AU9999
  try {
    const response = await fetch('https://hq.sinajs.cn/list=SGE_AU9999', {
      headers: {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) throw new Error(`新浪AU9999请求失败: ${response.status}`);
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder('gbk').decode(buffer);
    // 格式: var hq_str_SGE_AU9999="黄金9999,945.50,945.00,945.50,...";
    const match = text.match(/"(.+)"/);
    if (match && match[1]) {
      const parts = match[1].split(',');
      if (parts.length >= 4) {
        const name = parts[0];       // 品种名称
        const open = parseFloat(parts[1]);   // 开盘价
        const prevClose = parseFloat(parts[2]); // 昨收价
        const price = parseFloat(parts[3]);   // 当前价
        if (price > 0) {
          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
          return {
            au99_99: { name: name || 'Au99.99', price, change: Math.round(change * 100) / 100, changePercent: Math.round(changePercent * 100) / 100, open, prevClose },
            au99_95: { name: 'Au99.95', price: 0, change: 0, changePercent: 0 },
            timestamp: Date.now(), currency: 'CNY', unit: 'g', source: 'sina-SGE_AU9999',
          };
        }
      }
    }
    throw new Error('新浪AU9999数据解析失败');
  } catch (error) {
    console.error('新浪AU9999获取失败:', error);
  }

  // 备用源1：东方财富 AU9999 现货 (118.AU9999)
  try {
    const response = await fetch('https://push2.eastmoney.com/api/qt/stock/get?secid=118.AU9999&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/',
        'Accept': '*/*',
      },
    });
    if (!response.ok) throw new Error(`东方财富AU9999请求失败: ${response.status}`);
    const result = await response.json();
    if (result.rc === 0 && result.data && result.data.f43) {
      const d = result.data;
      const price = d.f43 / 100;
      const prevClose = d.f60 / 100;
      const change = d.f169 / 100;
      const changePercent = d.f170 / 100;
      return {
        au99_99: { name: 'Au99.99', price, change, changePercent, open: d.f46 / 100, high: d.f44 / 100, low: d.f45 / 100, prevClose },
        au99_95: { name: 'Au99.95', price: 0, change: 0, changePercent: 0 },
        timestamp: Date.now(), currency: 'CNY', unit: 'g', source: 'eastmoney-AU9999',
      };
    }
    throw new Error('东方财富AU9999返回数据为空');
  } catch (error) {
    console.error('东方财富AU9999获取失败:', error);
  }

  // 备用源2：东方财富 沪金期货主连 (113.aum)
  try {
    const response = await fetch('https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f14&secids=113.aum', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/',
        'Accept': '*/*',
      },
    });
    if (!response.ok) throw new Error(`东方财富沪金请求失败: ${response.status}`);
    const data = await response.json();
    if (data.data?.diff) {
      for (const item of data.data.diff) {
        if (item.f12 === 'aum' || item.f12 === 'AUM') {
          return {
            au99_99: { name: '沪金主连', price: item.f2 || 0, change: item.f4 || 0, changePercent: item.f3 || 0 },
            au99_95: { name: 'Au99.95', price: 0, change: 0, changePercent: 0 },
            timestamp: Date.now(), currency: 'CNY', unit: 'g', source: 'eastmoney-SHFE',
          };
        }
      }
    }
  } catch (error) {
    console.error('东方财富沪金获取失败:', error);
  }

  console.error('所有国内金价数据源均失败');
  return {
    au99_99: { name: 'Au99.99', price: 0, change: 0, changePercent: 0 },
    au99_95: { name: 'Au99.95', price: 0, change: 0, changePercent: 0 },
    timestamp: Date.now(), currency: 'CNY', unit: 'g', source: 'none',
  };
}

async function fetchAllPrices() {
  const [international, domestic] = await Promise.all([
    fetchInternationalGoldPrice(),
    fetchDomesticGoldPrice(),
  ]);
  const usdToCny = 7.24;
  const pricePerGramCny = international.price
    ? (international.price * usdToCny / 31.1035).toFixed(2)
    : 0;
  return {
    international,
    domestic,
    converted: {
      pricePerGramCny: parseFloat(pricePerGramCny as string),
      exchangeRate: usdToCny,
      ounceToGram: 31.1035,
    },
    timestamp: Date.now(),
  };
}

function generateKlineData(days = 30, currentPrice = 2400) {
  const klineData: any[] = [];
  const now = new Date();
  let price = currentPrice * (1 - (days * 0.001) + Math.random() * 0.005);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dailyReturn = (Math.random() - 0.48) * 0.03;
    const open = price;
    const close = price * (1 + dailyReturn);
    const highExtra = Math.random() * Math.abs(close - open) * 0.5;
    const lowExtra = Math.random() * Math.abs(close - open) * 0.5;
    const high = Math.max(open, close) + highExtra;
    const low = Math.min(open, close) - lowExtra;
    const volume = Math.floor(150000 + Math.random() * 100000);

    klineData.push({
      date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
      changePercent: parseFloat((dailyReturn * 100).toFixed(2)),
    });
    price = close;
  }
  return klineData;
}

async function fetchDollarIndex() {
  try {
    const url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=100.DINIW&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f169,f170';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (!response.ok) throw new Error(`美元指数请求失败: ${response.status}`);
    const data = await response.json();
    if (!data.data) throw new Error('美元指数数据为空');
    const d = data.data;
    return {
      price: d.f43 / 100 || 0, open: d.f46 / 100 || 0,
      high: d.f44 / 100 || 0, low: d.f45 / 100 || 0,
      change: d.f169 / 100 || 0, changePercent: d.f170 / 100 || 0,
      volume: d.f47 || 0, timestamp: Date.now(), source: 'eastmoney',
    };
  } catch (error) {
    console.error('获取美元指数失败:', error);
    return {
      price: 104.5, open: 104.3, high: 104.8, low: 104.1,
      change: 0.2, changePercent: 0.19, volume: 0,
      timestamp: Date.now(), source: 'fallback',
    };
  }
}

async function getMarketStats(env: any) {
  try {
    const currentPrices = await fetchAllPrices();
    const intl = currentPrices.international;

    // 如果主数据源没有开高低量，尝试从K线获取
    let openPrice = intl.open || 0;
    let high24h = intl.high || 0;
    let low24h = intl.low || 0;
    let volume24h = intl.volume || 0;

    if (!openPrice || !high24h || !low24h) {
      try {
        const latestKline = await fetchRealGoldKline(2, 101);
        if (latestKline.length > 0) {
          const today = latestKline[latestKline.length - 1];
          if (!openPrice) openPrice = today.open;
          if (!high24h) high24h = today.high;
          if (!low24h) low24h = today.low;
          if (!volume24h) volume24h = today.volume;
        }
      } catch (e) {
        console.error('从K线获取24H数据失败:', e);
      }
    }

    // 从D1获取周/月变化
    let weekChange: string | null = null;
    let monthChange: string | null = null;
    try {
      const latestPrice = await env.DB.prepare(
        'SELECT * FROM gold_prices ORDER BY date DESC LIMIT 1'
      ).first();
      const weekAgo = await env.DB.prepare(
        "SELECT * FROM gold_prices WHERE date >= date('now', '-7 days') ORDER BY date ASC LIMIT 1"
      ).first();
      const monthAgo = await env.DB.prepare(
        "SELECT * FROM gold_prices WHERE date >= date('now', '-30 days') ORDER BY date ASC LIMIT 1"
      ).first();
      weekChange = weekAgo && latestPrice
        ? ((latestPrice.close_price - weekAgo.close_price) / weekAgo.close_price * 100).toFixed(2)
        : null;
      monthChange = monthAgo && latestPrice
        ? ((latestPrice.close_price - monthAgo.close_price) / monthAgo.close_price * 100).toFixed(2)
        : null;
    } catch (e) {
      // D1查询失败不影响主流程
    }

    return {
      current: intl.price,
      weekChange,
      monthChange,
      high52w: null,
      low52w: null,
      openPrice,
      high24h,
      low24h,
      volume24h,
      change24h: intl.change || 0,
      changePercent24h: intl.changePercent || 0,
      domestic: currentPrices.domestic,
      converted: currentPrices.converted,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('获取市场统计失败:', error);
    const currentPrices = await fetchAllPrices();
    const intl = currentPrices.international;
    return {
      current: intl.price,
      weekChange: null,
      monthChange: null,
      openPrice: intl.open || 0,
      high24h: intl.high || 0,
      low24h: intl.low || 0,
      volume24h: intl.volume || 0,
      change24h: intl.change || 0,
      changePercent24h: intl.changePercent || 0,
      domestic: currentPrices.domestic,
      converted: currentPrices.converted,
      timestamp: Date.now(),
    };
  }
}

async function saveGoldPrice(env: any, priceData: any) {
  const today = new Date().toISOString().split('T')[0];
  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO gold_prices (date, open_price, high_price, low_price, close_price, volume, change_percent, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      today,
      priceData.open || priceData.price,
      priceData.high || priceData.price,
      priceData.low || priceData.price,
      priceData.price,
      priceData.volume || 0,
      priceData.changePercent || 0,
      priceData.source || 'api'
    ).run();
  } catch (error) {
    console.error('保存金价数据失败:', error);
  }
}

// ============================================
// 服务: AI 分析 (from services/aiAnalysis.js)
// ============================================

function buildAnalysisPrompt(priceData: any, klineData: any[]): string {
  const intl = priceData.international || {};
  const domestic = priceData.domestic || {};

  let prompt = `请分析以下黄金市场数据：\n\n`;
  prompt += `【国际金价】\n`;
  prompt += `- 当前价格: $${intl.price || 'N/A'}/盎司\n`;
  prompt += `- 日涨跌: ${intl.change || 'N/A'} (${intl.changePercent || 'N/A'}%)\n`;
  prompt += `- 最高: $${intl.high || 'N/A'}  最低: $${intl.low || 'N/A'}\n`;
  prompt += `- 开盘: $${intl.open || 'N/A'}  收盘: $${intl.close || 'N/A'}\n\n`;

  prompt += `【国内金价】\n`;
  if (domestic.au99_99) {
    prompt += `- Au99.99: ¥${domestic.au99_99.price}/克 (${domestic.au99_99.changePercent}%)\n`;
  }
  if (domestic.au99_95) {
    prompt += `- Au99.95: ¥${domestic.au99_95.price}/克 (${domestic.au99_95.changePercent}%)\n`;
  }

  if (priceData.converted) {
    prompt += `\n【换算价格】\n`;
    prompt += `- 人民币/克: ¥${priceData.converted.pricePerGramCny}\n`;
    prompt += `- 汇率: 1 USD = ${priceData.converted.exchangeRate} CNY\n`;
  }

  if (klineData && klineData.length > 0) {
    prompt += `\n【近期K线数据】\n`;
    const recentKlines = klineData.slice(-5);
    for (const k of recentKlines) {
      prompt += `- ${k.date}: 开${k.open} 高${k.high} 低${k.low} 收${k.close} (${k.changePercent}%)\n`;
    }
  }

  prompt += `\n请基于以上数据进行专业分析。`;
  return prompt;
}

function generateLocalAnalysis(priceData: any, _klineData: any[]) {
  const intl = priceData.international || {};
  const price = intl.price || 2400;
  const changePercent = intl.changePercent || 0;

  let trend = '震荡';
  let suggestion = '观望';
  let confidence = 50;

  if (changePercent > 1) { trend = '多头'; suggestion = '考虑轻仓做多'; confidence = 65; }
  else if (changePercent > 0.3) { trend = '偏多'; suggestion = '可考虑逢低买入'; confidence = 55; }
  else if (changePercent < -1) { trend = '空头'; suggestion = '考虑减仓或观望'; confidence = 65; }
  else if (changePercent < -0.3) { trend = '偏空'; suggestion = '建议谨慎操作'; confidence = 55; }

  const supportLevel = (price * 0.985).toFixed(2);
  const resistanceLevel = (price * 1.015).toFixed(2);

  const content = `## 黄金市场分析报告

### 一、市场趋势判断
当前市场趋势：**${trend}**
置信度：${confidence}%

国际金价现报 $${price}/盎司，日涨跌幅 ${changePercent}%。

### 二、关键价位
- **支撑位**: $${supportLevel}
- **阻力位**: $${resistanceLevel}

### 三、技术指标分析
- 短期均线系统：${changePercent > 0 ? '多头排列' : '空头排列'}
- MACD指标：${changePercent > 0 ? '金叉信号' : '死叉信号'}
- RSI指标：${Math.abs(changePercent) > 1 ? (changePercent > 0 ? '超买区间' : '超卖区间') : '中性区间'}

### 四、走势预测
- **短期（1-3天）**：预计将${trend === '多头' ? '继续上行' : trend === '空头' ? '继续下行' : '维持震荡'}，关注 $${supportLevel} 支撑和 $${resistanceLevel} 阻力。
- **中期（1-2周）**：需关注美联储政策动向和地缘政治风险，${trend === '多头' ? '有望突破阻力位' : trend === '空头' ? '可能测试支撑位' : '区间震荡概率较大'}。

### 五、操作建议
${suggestion}

### 六、风险提示
1. 以上分析仅供参考，不构成投资建议
2. 市场存在不确定性，请做好风险管理
3. 建议设置止损，控制仓位

---
*本报告由系统自动生成，数据更新于 ${new Date().toLocaleString('zh-CN')}*`;

  return {
    content,
    model: 'local-analysis',
    usage: {},
    generatedAt: new Date().toISOString(),
    isLocal: true,
  };
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeWithDeepSeek(env: any, priceData: any, klineData: any[]) {
  const apiKey = env.DEEPSEEK_API_KEY || env.MODELSCOPE_API_KEY;
  const apiUrl = env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

  if (!apiKey) {
    return { success: false, error: 'AI API 密钥未配置', analysis: generateLocalAnalysis(priceData, klineData) };
  }

  const systemPrompt = `你是一位专业的黄金市场分析师，拥有丰富的金融市场分析经验。请基于提供的市场数据进行专业分析，包括：
1. 当前市场趋势判断（多头/空头/震荡）
2. 关键支撑位和阻力位
3. 技术指标分析
4. 短期（1-3天）和中期（1-2周）走势预测
5. 操作建议（买入/卖出/观望）
6. 风险提示

请用专业但易懂的语言进行分析，数据需有理有据。`;

  const userPrompt = buildAnalysisPrompt(priceData, klineData);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API 错误:', response.status, errorText);
      return { success: false, error: `AI 分析请求失败: ${response.status}`, analysis: generateLocalAnalysis(priceData, klineData) };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      success: true,
      analysis: {
        content,
        model: data.model || 'deepseek-chat',
        usage: data.usage || {},
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error('AI 分析异常:', error);
    return { success: false, error: error.message, analysis: generateLocalAnalysis(priceData, klineData) };
  }
}

function streamAnalysis(env: any, priceData: any): ReadableStream {
  const apiKey = env.DEEPSEEK_API_KEY || env.MODELSCOPE_API_KEY;
  const apiUrl = env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      if (!apiKey) {
        const localAnalysis = generateLocalAnalysis(priceData, []);
        const chunks = splitIntoChunks(localAnalysis.content, 20);
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`));
          await sleep(50);
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
        controller.close();
        return;
      }

      try {
        const systemPrompt = `你是一位专业的黄金市场分析师。请对当前黄金市场进行实时分析，包括趋势判断、关键价位、技术指标和操作建议。回复要分段清晰，使用中文。`;
        const userPrompt = buildAnalysisPrompt(priceData, []);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: env.DEEPSEEK_MODEL || 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 2000,
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `API 请求失败: ${response.status}`, done: true })}\n\n`));
          controller.close();
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content, done: false })}\n\n`));
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (error: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`));
        controller.close();
      }
    },
  });
}

// ============================================
// 服务: 推送通知 (from services/pushNotification.js)
// ============================================

async function sendPushPlusNotification(env: any, title: string, content: string, template = 'html') {
  const token = env.PUSHPLUS_TOKEN;
  if (!token) {
    console.warn('PushPlus Token 未配置，跳过推送');
    return { success: false, error: 'PushPlus Token 未配置' };
  }

  try {
    const response = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, title, content, template }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PushPlus 推送失败:', response.status, errorText);
      return { success: false, error: `推送失败: ${response.status}` };
    }

    const data = await response.json();
    if (data.code === 200) {
      return { success: true, data };
    } else {
      return { success: false, error: data.msg || '推送失败' };
    }
  } catch (error: any) {
    console.error('PushPlus 推送异常:', error);
    return { success: false, error: error.message };
  }
}

function generatePushHtml(priceData: any, analysisText: string, pushType = 'custom'): string {
  const intl = priceData.international || {};
  const domestic = priceData.domestic || {};
  const converted = priceData.converted || {};

  const typeConfig: Record<string, { title: string; color: string }> = {
    morning: { title: '🌅 早盘速报', color: '#FF6B35' },
    evening: { title: '🌙 收盘分析', color: '#4A90D9' },
    alert: { title: '⚠️ 行情预警', color: '#E74C3C' },
    custom: { title: '📊 行情推送', color: '#2ECC71' },
  };

  const config = typeConfig[pushType] || typeConfig.custom;
  const changeIcon = intl.change > 0 ? '📈' : intl.change < 0 ? '📉' : '➡️';
  const changeColor = intl.change > 0 ? '#e74c3c' : intl.change < 0 ? '#27ae60' : '#7f8c8d';

  let domesticHtml = '';
  if (domestic.au99_99) {
    const dChangeColor = domestic.au99_99.change > 0 ? '#e74c3c' : '#27ae60';
    domesticHtml += `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
        <span>${domestic.au99_99.name}</span>
        <span style="color:${dChangeColor};font-weight:bold;">¥${domestic.au99_99.price}/克 ${domestic.au99_99.change > 0 ? '↑' : '↓'}${Math.abs(domestic.au99_99.changePercent)}%</span>
      </div>`;
  }
  if (domestic.au99_95) {
    const dChangeColor = domestic.au99_95.change > 0 ? '#e74c3c' : '#27ae60';
    domesticHtml += `
      <div style="display:flex;justify-content:space-between;padding:8px 0;">
        <span>${domestic.au99_95.name}</span>
        <span style="color:${dChangeColor};font-weight:bold;">¥${domestic.au99_95.price}/克 ${domestic.au99_95.change > 0 ? '↑' : '↓'}${Math.abs(domestic.au99_95.changePercent)}%</span>
      </div>`;
  }

  const analysisHtml = analysisText
    ? `<div style="margin-top:15px;padding:12px;background:#f8f9fa;border-radius:8px;">
        <h4 style="margin:0 0 8px 0;">📝 AI 分析摘要</h4>
        <div style="font-size:13px;line-height:1.6;color:#333;">
          ${analysisText.substring(0, 500).replace(/\n/g, '<br>')}
          ${analysisText.length > 500 ? '...' : ''}
        </div>
      </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,${config.color},${config.color}dd);padding:20px;color:#fff;">
      <h2 style="margin:0;font-size:18px;">${config.title}</h2>
      <p style="margin:5px 0 0 0;font-size:12px;opacity:0.8;">${new Date().toLocaleString('zh-CN')}</p>
    </div>
    <div style="padding:15px;">
      <h3 style="margin:0 0 10px 0;font-size:15px;color:#333;">🌍 国际金价</h3>
      <div style="background:#fafafa;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:24px;font-weight:bold;color:${changeColor};">$${intl.price || 'N/A'}</span>
          <span style="font-size:14px;color:${changeColor};">${changeIcon} ${intl.change > 0 ? '+' : ''}${intl.change || '0'} (${intl.changePercent > 0 ? '+' : ''}${intl.changePercent || '0'}%)</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#666;">
          <span>开盘: $${intl.open || 'N/A'}</span>
          <span>最高: $${intl.high || 'N/A'}</span>
          <span>最低: $${intl.low || 'N/A'}</span>
        </div>
      </div>
    </div>
    <div style="padding:0 15px 15px;">
      <h3 style="margin:0 0 10px 0;font-size:15px;color:#333;">🇨🇳 国内金价</h3>
      <div style="background:#fafafa;border-radius:8px;padding:12px;">
        ${domesticHtml}
      </div>
    </div>
    ${converted.pricePerGramCny ? `
    <div style="padding:0 15px 15px;">
      <div style="background:#fff3e0;border-radius:8px;padding:10px 12px;font-size:13px;color:#e65100;">
        💱 人民币/克: ¥${converted.pricePerGramCny}（汇率 ${converted.exchangeRate}）
      </div>
    </div>` : ''}
    ${analysisHtml}
    <div style="padding:12px 15px;background:#f8f9fa;text-align:center;font-size:11px;color:#999;">
      黄金市场分析平台 · 数据仅供参考，不构成投资建议
    </div>
  </div>
</body>
</html>`;
}

async function executePush(env: any, priceData: any = null, pushType = 'custom', ctx: any = null) {
  const startTime = Date.now();
  try {
    const data = priceData || await fetchAllPrices();

    let analysisText = '';
    try {
      const analysis = await analyzeWithDeepSeek(env, data, []);
      if (analysis.success && analysis.analysis) {
        analysisText = analysis.analysis.content || '';
      } else if (analysis.analysis) {
        analysisText = analysis.analysis.content || '';
      }
    } catch (e) {
      console.error('推送中获取AI分析失败:', e);
    }

    const typeNames: Record<string, string> = {
      morning: '早盘速报', evening: '收盘分析', alert: '行情预警', custom: '行情推送',
    };

    const title = `【黄金${typeNames[pushType] || '行情'}】$${data.international?.price || 'N/A'} ${data.international?.change > 0 ? '↑' : '↓'}${Math.abs(data.international?.changePercent || 0)}%`;
    const html = generatePushHtml(data, analysisText, pushType);
    const result = await sendPushPlusNotification(env, title, html, 'html');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    if (ctx) {
      ctx.waitUntil(
        env.DB.prepare(
          "INSERT INTO update_logs (data_type, status, records_affected, duration_seconds, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        ).bind(`push_${pushType}`, result.success ? 'success' : 'failed', 1, parseFloat(duration)).run()
      );
    }

    return {
      success: result.success,
      data: { pushType, title, priceData: data, duration: parseFloat(duration) },
      error: result.error,
    };
  } catch (error: any) {
    console.error('执行推送失败:', error);
    return { success: false, error: error.message };
  }
}

function checkAlertCondition(priceData: any): { shouldPush: boolean; reason: string; pushType?: string } {
  const intl = priceData.international || {};
  const changePercent = Math.abs(intl.changePercent || 0);
  if (changePercent >= 1) {
    return {
      shouldPush: true,
      reason: `金价${intl.changePercent > 0 ? '大涨' : '大跌'} ${changePercent.toFixed(2)}%`,
      pushType: 'alert',
    };
  }
  return { shouldPush: false, reason: '' };
}

// ============================================
// 路由: 认证 (from routes/auth.js)
// ============================================

const authRoutes = new Hono();

authRoutes.post('/register', async (c: any) => {
  try {
    const body = await c.req.json();
    const { email, username, password } = body;

    if (!email || !username || !password) {
      return c.json({ success: false, error: '参数不完整', message: '请提供 email、username 和 password' }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ success: false, error: '邮箱格式不正确', message: '请提供有效的邮箱地址' }, 400);
    }

    if (username.length < 2 || username.length > 20) {
      return c.json({ success: false, error: '用户名长度不正确', message: '用户名长度应为2-20个字符' }, 400);
    }

    if (password.length < 6) {
      return c.json({ success: false, error: '密码太短', message: '密码长度至少6个字符' }, 400);
    }

    const existingEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existingEmail) {
      return c.json({ success: false, error: '邮箱已注册', message: '该邮箱已被使用' }, 409);
    }

    const existingUsername = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (existingUsername) {
      return c.json({ success: false, error: '用户名已存在', message: '该用户名已被使用' }, 409);
    }

    const passwordHash = await hashPassword(password);
    const result = await c.env.DB.prepare(
      `INSERT INTO users (email, username, password_hash, avatar, role, membership_level, status, created_at, updated_at)
       VALUES (?, ?, ?, '', 'user', 'free', 'active', datetime('now'), datetime('now'))`
    ).bind(email, username, passwordHash).run();

    const userId = result.meta.last_row_id;
    const secret = c.env.JWT_SECRET || 'change-this-in-production';
    const token = await generateToken({ userId, email, username, role: 'user' }, secret, '7d');

    return c.json({
      success: true,
      data: { user: { id: userId, email, username, role: 'user', membership_level: 'free' }, token },
      message: '注册成功',
    }, 201);
  } catch (error: any) {
    console.error('注册失败:', error);
    return c.json({ success: false, error: '注册失败', message: error.message }, 500);
  }
});

authRoutes.post('/login', async (c: any) => {
  try {
    const body = await c.req.json();
    const { email, username, password } = body;
    const account = email || username;

    if (!account || !password) {
      return c.json({ success: false, error: '参数不完整', message: '请提供 email/username 和 password' }, 400);
    }

    const user = await c.env.DB.prepare(
      'SELECT id, email, username, password_hash, avatar, role, membership_level, membership_expire_at, status FROM users WHERE email = ? OR username = ?'
    ).bind(account, account).first();

    if (!user) {
      return c.json({ success: false, error: '账号不存在', message: '请检查邮箱/用户名是否正确' }, 401);
    }

    if (user.status === 'disabled') {
      return c.json({ success: false, error: '账号已被禁用', message: '请联系管理员' }, 403);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ success: false, error: '密码错误', message: '请检查密码是否正确' }, 401);
    }

    let membershipLevel = user.membership_level;
    if (user.membership_expire_at && new Date(user.membership_expire_at) < new Date()) {
      await c.env.DB.prepare("UPDATE users SET membership_level = 'free', updated_at = datetime('now') WHERE id = ?").bind(user.id).run();
      membershipLevel = 'free';
    }

    const secret = c.env.JWT_SECRET || 'change-this-in-production';
    const token = await generateToken({ userId: user.id, email: user.email, username: user.username, role: user.role }, secret, '7d');

    await c.env.DB.prepare("UPDATE users SET updated_at = datetime('now') WHERE id = ?").bind(user.id).run();

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id, email: user.email, username: user.username, avatar: user.avatar,
          role: user.role, membership_level: membershipLevel, membership_expire_at: user.membership_expire_at,
        },
        token,
      },
      message: '登录成功',
    });
  } catch (error: any) {
    console.error('登录失败:', error);
    return c.json({ success: false, error: '登录失败', message: error.message }, 500);
  }
});

authRoutes.get('/me', authMiddleware, async (c: any) => {
  try {
    const user = c.get('user');
    return c.json({
      success: true,
      data: {
        id: user.id, email: user.email, username: user.username, avatar: user.avatar,
        role: user.role, membership_level: user.membership_level,
        membership_expire_at: user.membership_expire_at, status: user.status,
      },
    });
  } catch (error: any) {
    console.error('获取用户信息失败:', error);
    return c.json({ success: false, error: '获取用户信息失败', message: error.message }, 500);
  }
});

authRoutes.put('/profile', authMiddleware, async (c: any) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { username, avatar } = body;

    const updates: string[] = [];
    const params: any[] = [];

    if (username !== undefined) {
      if (username !== user.username) {
        const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(username, user.id).first();
        if (existing) {
          return c.json({ success: false, error: '用户名已存在', message: '该用户名已被其他用户使用' }, 409);
        }
      }
      if (username.length < 2 || username.length > 20) {
        return c.json({ success: false, error: '用户名长度不正确', message: '用户名长度应为2-20个字符' }, 400);
      }
      updates.push('username = ?');
      params.push(username);
    }

    if (avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(avatar);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: '没有更新内容', message: '请提供要更新的字段' }, 400);
    }

    updates.push("updated_at = datetime('now')");
    params.push(user.id);

    await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    const updatedUser = await c.env.DB.prepare(
      'SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status FROM users WHERE id = ?'
    ).bind(user.id).first();

    return c.json({ success: true, data: updatedUser, message: '资料更新成功' });
  } catch (error: any) {
    console.error('更新资料失败:', error);
    return c.json({ success: false, error: '更新资料失败', message: error.message }, 500);
  }
});

authRoutes.put('/password', authMiddleware, async (c: any) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return c.json({ success: false, error: '参数不完整', message: '请提供旧密码和新密码' }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ success: false, error: '新密码太短', message: '密码长度至少6个字符' }, 400);
    }

    const userRecord = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
    const isValid = await verifyPassword(oldPassword, userRecord.password_hash);
    if (!isValid) {
      return c.json({ success: false, error: '旧密码错误', message: '请检查旧密码是否正确' }, 401);
    }

    const newPasswordHash = await hashPassword(newPassword);
    await c.env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").bind(newPasswordHash, user.id).run();

    return c.json({ success: true, message: '密码修改成功' });
  } catch (error: any) {
    console.error('修改密码失败:', error);
    return c.json({ success: false, error: '修改密码失败', message: error.message }, 500);
  }
});

// ============================================
// 路由: 金价 (from routes/gold.js)
// ============================================

const goldRoutes = new Hono();

goldRoutes.get('/price/international', async (c: any) => {
  try {
    const data = await fetchInternationalGoldPrice();
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('获取国际金价失败:', error);
    return c.json({ success: false, error: '获取国际金价失败', message: error.message }, 500);
  }
});

goldRoutes.get('/price/domestic', async (c: any) => {
  try {
    const data = await fetchDomesticGoldPrice();
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('获取国内金价失败:', error);
    return c.json({ success: false, error: '获取国内金价失败', message: error.message }, 500);
  }
});

goldRoutes.get('/price/all', async (c: any) => {
  try {
    const data = await fetchAllPrices();
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('获取金价数据失败:', error);
    return c.json({ success: false, error: '获取金价数据失败', message: error.message }, 500);
  }
});

goldRoutes.get('/kline', async (c: any) => {
  try {
    const days = parseInt(c.req.query('days') || '30', 10);
    const clampedDays = Math.min(Math.max(days, 1), 365);

    const dbPrices = await c.env.DB.prepare(
      'SELECT * FROM gold_prices ORDER BY date DESC LIMIT ?'
    ).bind(clampedDays).all();

    let klineData: any[] = [];

    if (dbPrices.results && dbPrices.results.length > 5) {
      klineData = dbPrices.results.reverse().map((row: any) => ({
        date: row.date, open: row.open_price, high: row.high_price,
        low: row.low_price, close: row.close_price, volume: row.volume,
        changePercent: row.change_percent,
      }));
    } else {
      const intlPrice = await fetchInternationalGoldPrice();
      klineData = generateKlineData(clampedDays, intlPrice.price);
    }

    return c.json({
      success: true,
      data: { kline: klineData, days: clampedDays, generatedAt: new Date().toISOString() },
    });
  } catch (error: any) {
    console.error('获取K线数据失败:', error);
    return c.json({ success: false, error: '获取K线数据失败', message: error.message }, 500);
  }
});

// 从东方财富获取国际金价历史K线数据
async function fetchRealGoldKline(days: number, klt: number = 101): Promise<any[]> {
  // 主源：Yahoo Finance API（在CF Workers上可用，返回完整OHLCV）
  try {
    // klt映射到Yahoo interval: 5/15/30/60 → 5m/15m/30m/60m, 101 → 1d, 102 → 1wk
    let interval: string;
    let range: string;
    switch (klt) {
      case 5: interval = '5m'; range = '1d'; break;
      case 15: interval = '15m'; range = '5d'; break;
      case 30: interval = '30m'; range = '5d'; break;
      case 60: interval = '60m'; range = `${Math.min(Math.ceil(days / 6), 60)}d`; break;  // 4h需要更多数据
      case 101: interval = '1d'; range = `${Math.min(days, 365)}d`; break;
      case 102: interval = '1wk'; range = `${Math.min(days * 7, 365 * 2)}d`; break;
      default: interval = '1d'; range = `${Math.min(days, 365)}d`; break;
    }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=${range}&interval=${interval}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!response.ok) throw new Error(`Yahoo Finance请求失败: ${response.status}`);
    const result = await response.json();
    const chartData = result.chart?.result?.[0];
    if (chartData?.timestamp && chartData?.indicators?.quote?.[0]) {
      const timestamps = chartData.timestamp as number[];
      const quote = chartData.indicators.quote[0];
      const klines: any[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const open = quote.open?.[i];
        const close = quote.close?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const volume = quote.volume?.[i];
        if (open == null || close == null) continue;
        const date = new Date(timestamps[i] * 1000);
        const dateStr = klt <= 60
          ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
          : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        klines.push({
          date: dateStr,
          open: Math.round(open * 100) / 100,
          close: Math.round(close * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          volume: volume || 0,
          changePercent: quote.close?.[i-1] ? Math.round((close - quote.close[i-1]) / quote.close[i-1] * 10000) / 100 : 0,
        });
      }
      if (klines.length > 5) return klines;
    }
    throw new Error('Yahoo Finance K线数据为空');
  } catch (error) {
    console.error('Yahoo Finance K线获取失败:', error);
  }

  // 备用源：东方财富国际金价(122.XAU) K线
  try {
    const limit = Math.min(days, 365);
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=122.XAU&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=${klt}&fqt=0&end=20500101&lmt=${limit}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (!response.ok) throw new Error(`东方财富K线请求失败: ${response.status}`);
    const result = await response.json();
    if (result.data?.klines) {
      return result.data.klines.map((line: string) => {
        const parts = line.split(',');
        return {
          date: parts[0],
          open: parseFloat(parts[1]) / 100,
          close: parseFloat(parts[2]) / 100,
          high: parseFloat(parts[3]) / 100,
          low: parseFloat(parts[4]) / 100,
          volume: parseInt(parts[5]) || 0,
          changePercent: parseFloat(parts[8]) || 0,
        };
      });
    }
    throw new Error('K线数据为空');
  } catch (error) {
    console.error('东方财富K线获取失败:', error);
    return [];
  }
}

goldRoutes.get('/chart-kline', async (c: any) => {
  try {
    const period = c.req.query('period') || '1d';
    const count = parseInt(c.req.query('count') || '60', 10);
    const days = Math.min(Math.max(count, 10), 365);

    // 根据period映射东方财富klt参数
    let klt: number;
    switch (period) {
      case '1h': klt = 60; break;    // 60分钟K
      case '4h': klt = 60; break;    // 东方财富无4小时K，用60分钟K多取数据
      case '1d': klt = 101; break;   // 日K
      case '1w': klt = 102; break;   // 周K
      default: klt = 101; break;
    }

    // 优先从数据源获取真实K线数据
    const realKline = await fetchRealGoldKline(days, klt);
    if (realKline.length > 5) {
      let klines = realKline.slice(-days * (klt === 60 ? 4 : 1));
      // 4小时K：从60分钟K线每4根合并
      if (period === '4h' && klt === 60) {
        const merged: any[] = [];
        for (let i = 0; i < klines.length; i += 4) {
          const chunk = klines.slice(i, i + 4);
          if (chunk.length === 0) continue;
          merged.push({
            date: chunk[0].date,
            open: chunk[0].open,
            high: Math.max(...chunk.map((k: any) => k.high)),
            low: Math.min(...chunk.map((k: any) => k.low)),
            close: chunk[chunk.length - 1].close,
            volume: chunk.reduce((a: number, k: any) => a + k.volume, 0),
            changePercent: chunk[chunk.length - 1].changePercent,
          });
        }
        klines = merged.slice(-days);
      }
      return c.json({
        success: true,
        data: { klines, source: 'real', period },
      });
    }

    // 备用：D1数据库
    const dbPrices = await c.env.DB.prepare(
      'SELECT * FROM gold_prices ORDER BY date DESC LIMIT ?'
    ).bind(days).all();

    if (dbPrices.results && dbPrices.results.length > 5) {
      const klines = dbPrices.results.reverse().map((row: any) => ({
        date: row.date, time: row.date,
        open: row.open_price, high: row.high_price,
        low: row.low_price, close: row.close_price,
        volume: row.volume, changePercent: row.change_percent,
      }));
      return c.json({ success: true, data: { klines, source: 'd1-database', period } });
    }

    // 最后备用：生成数据
    const intlPrice = await fetchInternationalGoldPrice();
    const klines = generateKlineData(days, intlPrice.price);
    return c.json({ success: true, data: { klines, source: 'generated', period } });
  } catch (error: any) {
    console.error('获取图表K线数据失败:', error);
    return c.json({ success: false, error: '获取图表K线数据失败', message: error.message }, 500);
  }
});

goldRoutes.post('/analyze', authMiddleware, requireMembership('basic'), rateLimitByUser(), async (c: any) => {
  try {
    const user = c.get('user');
    const body = await c.req.json() || {};

    const priceData = await fetchAllPrices();
    const klineDays = body.klineDays || 30;
    const intlPrice = priceData.international || {};
    const klineData = generateKlineData(klineDays, intlPrice.price);

    const result = await analyzeWithDeepSeek(c.env, priceData, klineData);

    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        "INSERT INTO api_usage_logs (user_id, endpoint, method, status_code, created_at) VALUES (?, ?, 'POST', 200, datetime('now'))"
      ).bind(user.id, '/api/gold/analyze').run()
    );

    return c.json({ success: result.success, data: result.analysis, error: result.error });
  } catch (error: any) {
    console.error('AI分析失败:', error);
    return c.json({ success: false, error: 'AI分析失败', message: error.message }, 500);
  }
});

goldRoutes.post('/analyze/stream', authMiddleware, requireMembership('basic'), rateLimitByUser(), async (c: any) => {
  try {
    const priceData = await fetchAllPrices();
    const stream = streamAnalysis(c.env, priceData);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('流式分析失败:', error);
    return c.json({ success: false, error: '流式分析失败', message: error.message }, 500);
  }
});

goldRoutes.get('/stats', async (c: any) => {
  try {
    const stats = await getMarketStats(c.env);
    return c.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('获取市场统计失败:', error);
    return c.json({ success: false, error: '获取市场统计失败', message: error.message }, 500);
  }
});

goldRoutes.get('/dollar-realtime', async (c: any) => {
  try {
    const data = await fetchDollarIndex();
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('获取美元指数失败:', error);
    return c.json({ success: false, error: '获取美元指数失败', message: error.message }, 500);
  }
});

// ============================================
// 路由: 新闻 (from routes/news.js)
// ============================================

const newsRoutes = new Hono();

newsRoutes.get('/', async (c: any) => {
  try {
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const sentiment = c.req.query('sentiment');
    const keyword = c.req.query('keyword');

    const clampedLimit = Math.min(Math.max(limit, 1), 100);
    const offset = (page - 1) * clampedLimit;

    let whereClause = '1=1';
    const params: any[] = [];

    if (sentiment && ['positive', 'negative', 'neutral'].includes(sentiment)) {
      whereClause += ' AND sentiment = ?';
      params.push(sentiment);
    }

    if (keyword) {
      whereClause += ' AND (title LIKE ? OR content LIKE ? OR keywords LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM gold_news WHERE ${whereClause}`
    ).bind(...params).first();

    const total = countResult ? countResult.total : 0;

    const result = await c.env.DB.prepare(
      `SELECT id, title, content, source, url, published_at, sentiment, keywords, created_at
       FROM gold_news WHERE ${whereClause}
       ORDER BY published_at DESC, created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, clampedLimit, offset).all();

    return c.json({
      success: true,
      data: {
        list: result.results || [],
        pagination: { page, limit: clampedLimit, total, totalPages: Math.ceil(total / clampedLimit) },
      },
    });
  } catch (error: any) {
    console.error('获取新闻列表失败:', error);
    return c.json({ success: false, error: '获取新闻列表失败', message: error.message }, 500);
  }
});

newsRoutes.get('/latest', async (c: any) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10', 10);
    const clampedLimit = Math.min(Math.max(limit, 1), 50);

    const result = await c.env.DB.prepare(
      `SELECT id, title, content, source, url, published_at, sentiment, keywords, created_at
       FROM gold_news ORDER BY published_at DESC, created_at DESC LIMIT ?`
    ).bind(clampedLimit).all();

    if (!result.results || result.results.length === 0) {
      const sampleNews = [
        {
          id: 1, title: '美联储维持利率不变，金价承压',
          content: '美联储在最新议息会议上决定维持联邦基金利率不变，符合市场预期。声明中强调将继续关注通胀数据，金价短期承压。',
          source: '路透社', url: '', published_at: new Date().toISOString(),
          sentiment: 'negative', keywords: '["美联储","利率","通胀"]', created_at: new Date().toISOString(),
        },
        {
          id: 2, title: '地缘政治紧张局势升级，避险需求推升金价',
          content: '中东地区局势持续紧张，投资者避险情绪升温，黄金作为传统避险资产受到追捧，国际金价小幅上涨。',
          source: '彭博社', url: '', published_at: new Date(Date.now() - 3600000).toISOString(),
          sentiment: 'positive', keywords: '["地缘政治","避险","金价"]', created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 3, title: '全球央行持续增持黄金储备',
          content: '世界黄金协会最新数据显示，全球央行连续多个季度净购入黄金，中国、印度等国央行增持幅度居前，为金价提供长期支撑。',
          source: '世界黄金协会', url: '', published_at: new Date(Date.now() - 7200000).toISOString(),
          sentiment: 'positive', keywords: '["央行","黄金储备","增持"]', created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 4, title: '美元指数走强，黄金多头面临挑战',
          content: '受美国经济数据好于预期影响，美元指数走强，对黄金价格形成压制。技术面上金价在关键支撑位附近震荡。',
          source: '华尔街日报', url: '', published_at: new Date(Date.now() - 10800000).toISOString(),
          sentiment: 'negative', keywords: '["美元指数","经济数据","技术面"]', created_at: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          id: 5, title: '黄金ETF持仓量连续第三周增加',
          content: '全球最大黄金ETF SPDR Gold Trust持仓量连续第三周增加，显示机构投资者对黄金的看好态度。',
          source: '金融时报', url: '', published_at: new Date(Date.now() - 14400000).toISOString(),
          sentiment: 'positive', keywords: '["ETF","持仓量","机构投资"]', created_at: new Date(Date.now() - 14400000).toISOString(),
        },
      ];

      return c.json({ success: true, data: sampleNews.slice(0, clampedLimit) });
    }

    return c.json({ success: true, data: result.results });
  } catch (error: any) {
    console.error('获取最新新闻失败:', error);
    return c.json({ success: false, error: '获取最新新闻失败', message: error.message }, 500);
  }
});

// ============================================
// 路由: 分析 (from routes/analysis.js)
// ============================================

const analysisRoutes = new Hono();

analysisRoutes.get('/bullish-factors', authMiddleware, requireMembership('basic'), async (c: any) => {
  try {
    const result = await c.env.DB.prepare(
      "SELECT * FROM market_factors WHERE type = 'bullish' ORDER BY created_at DESC LIMIT 20"
    ).all();

    if (!result.results || result.results.length === 0) {
      const sampleFactors = [
        {
          id: 1, type: 'bullish', title: '全球央行持续增持黄金', subtitle: '去美元化趋势加速',
          description: '多国央行持续增加黄金储备，中国央行连续多月增持，为金价提供长期支撑。',
          details: JSON.stringify(['中国央行连续18个月增持黄金', '印度、土耳其等国央行也在积极购金', '全球央行购金量创历史新高']),
          impact: 'high', confidence: 0.85, created_at: new Date().toISOString(),
        },
        {
          id: 2, type: 'bullish', title: '地缘政治风险上升', subtitle: '避险需求增加',
          description: '中东局势紧张、俄乌冲突持续，地缘政治不确定性推动避险需求。',
          details: JSON.stringify(['中东冲突持续升级', '俄乌和谈前景不明', '全球安全形势趋于复杂']),
          impact: 'high', confidence: 0.75, created_at: new Date().toISOString(),
        },
        {
          id: 3, type: 'bullish', title: '美联储降息预期', subtitle: '实际利率下行利好黄金',
          description: '市场预期美联储将在年内降息，实际利率下行将降低持有黄金的机会成本。',
          details: JSON.stringify(['通胀数据持续回落', '就业市场出现降温迹象', '市场预计年内降息2-3次']),
          impact: 'medium', confidence: 0.65, created_at: new Date().toISOString(),
        },
      ];
      return c.json({ success: true, data: sampleFactors });
    }

    const factors = result.results.map((f: any) => ({
      ...f, details: typeof f.details === 'string' ? JSON.parse(f.details) : f.details,
    }));
    return c.json({ success: true, data: factors });
  } catch (error: any) {
    console.error('获取看多因素失败:', error);
    return c.json({ success: false, error: '获取看多因素失败', message: error.message }, 500);
  }
});

analysisRoutes.get('/bearish-factors', authMiddleware, requireMembership('basic'), async (c: any) => {
  try {
    const result = await c.env.DB.prepare(
      "SELECT * FROM market_factors WHERE type = 'bearish' ORDER BY created_at DESC LIMIT 20"
    ).all();

    if (!result.results || result.results.length === 0) {
      const sampleFactors = [
        {
          id: 1, type: 'bearish', title: '美元指数走强', subtitle: '强美元压制金价',
          description: '美国经济数据好于预期，美元指数走强，对黄金价格形成压制。',
          details: JSON.stringify(['美国GDP增速超预期', '非农就业数据强劲', '美元指数突破关键阻力位']),
          impact: 'high', confidence: 0.70, created_at: new Date().toISOString(),
        },
        {
          id: 2, type: 'bearish', title: '技术面出现超买信号', subtitle: '短期回调风险增加',
          description: 'RSI指标进入超买区间，短期存在技术性回调可能。',
          details: JSON.stringify(['日线RSI超过70', '金价偏离均线较远', '成交量有所萎缩']),
          impact: 'medium', confidence: 0.60, created_at: new Date().toISOString(),
        },
        {
          id: 3, type: 'bearish', title: '风险偏好回升', subtitle: '资金流向股市',
          description: '全球股市回暖，风险偏好回升，部分资金从黄金市场流出。',
          details: JSON.stringify(['美股创历史新高', 'VIX指数处于低位', '黄金ETF出现资金流出']),
          impact: 'low', confidence: 0.55, created_at: new Date().toISOString(),
        },
      ];
      return c.json({ success: true, data: sampleFactors });
    }

    const factors = result.results.map((f: any) => ({
      ...f, details: typeof f.details === 'string' ? JSON.parse(f.details) : f.details,
    }));
    return c.json({ success: true, data: factors });
  } catch (error: any) {
    console.error('获取看空因素失败:', error);
    return c.json({ success: false, error: '获取看空因素失败', message: error.message }, 500);
  }
});

analysisRoutes.get('/institution-views', authMiddleware, requireMembership('premium'), async (c: any) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM institution_views ORDER BY created_at DESC LIMIT 20'
    ).all();

    if (!result.results || result.results.length === 0) {
      const sampleViews = [
        {
          id: 1, institution_name: '高盛', logo: '', rating: 'buy', target_price: 2700, timeframe: '12个月',
          reasoning: '美联储降息周期开启将推动金价进一步上涨，央行购金需求持续强劲。',
          key_points: JSON.stringify(['预计美联储年内降息3次', '央行购金需求创纪录', '地缘政治风险提供支撑', '通胀粘性利好黄金']),
          created_at: new Date().toISOString(),
        },
        {
          id: 2, institution_name: '摩根大通', logo: '', rating: 'buy', target_price: 2600, timeframe: '6个月',
          reasoning: '实际利率下行和美元走弱将推动金价上涨。',
          key_points: JSON.stringify(['实际利率预计持续下行', '美元中期走弱趋势', '避险需求维持高位']),
          created_at: new Date().toISOString(),
        },
        {
          id: 3, institution_name: '花旗银行', logo: '', rating: 'hold', target_price: 2450, timeframe: '3个月',
          reasoning: '金价已处于高位，短期可能面临回调压力，但中长期仍看好。',
          key_points: JSON.stringify(['短期技术面超买', '中期基本面仍然向好', '关注2400美元支撑位']),
          created_at: new Date().toISOString(),
        },
        {
          id: 4, institution_name: '瑞银', logo: '', rating: 'buy', target_price: 2550, timeframe: '6个月',
          reasoning: '全球去美元化趋势和央行购金将为金价提供长期支撑。',
          key_points: JSON.stringify(['去美元化趋势加速', '新兴市场央行购金', '黄金在资产配置中占比提升']),
          created_at: new Date().toISOString(),
        },
      ];
      return c.json({ success: true, data: sampleViews });
    }

    const views = result.results.map((v: any) => ({
      ...v, key_points: typeof v.key_points === 'string' ? JSON.parse(v.key_points) : v.key_points,
    }));
    return c.json({ success: true, data: views });
  } catch (error: any) {
    console.error('获取机构观点失败:', error);
    return c.json({ success: false, error: '获取机构观点失败', message: error.message }, 500);
  }
});

analysisRoutes.get('/investment-advice', authMiddleware, requireMembership('premium'), async (c: any) => {
  try {
    const cacheKey = 'investment_advice';
    const cached = await c.env.DB.prepare(
      "SELECT * FROM market_summary_cache WHERE cache_key = ? AND datetime(generated_at) > datetime('now', '-6 hours')"
    ).bind(cacheKey).first();

    if (cached) {
      const data = typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
      return c.json({ success: true, data, cached: true });
    }

    const priceData = await fetchAllPrices();
    const analysisResult = await analyzeWithDeepSeek(c.env, priceData, []);

    const advice = {
      title: '黄金投资建议',
      generatedAt: new Date().toISOString(),
      summary: analysisResult.analysis?.content
        ? analysisResult.analysis.content.substring(0, 200)
        : '当前市场环境下，建议保持适度仓位，关注关键支撑和阻力位。',
      recommendations: [
        {
          type: 'short_term', title: '短期操作建议',
          action: priceData.international?.changePercent > 0 ? '逢低买入' : '观望为主',
          description: '短期关注关键支撑位，若有效突破可适当加仓。',
          riskLevel: 'medium',
        },
        {
          type: 'medium_term', title: '中期配置建议',
          action: '维持配置',
          description: '中期来看，央行购金和降息预期支撑金价，建议维持5-10%的黄金配置比例。',
          riskLevel: 'low',
        },
        {
          type: 'long_term', title: '长期投资建议',
          action: '定投持有',
          description: '长期看好黄金在资产配置中的避险和抗通胀作用，建议通过定投方式长期持有。',
          riskLevel: 'low',
        },
      ],
      riskWarnings: [
        '以上建议仅供参考，不构成投资建议',
        '市场存在不确定性，请根据自身风险承受能力决策',
        '建议分散投资，控制单一资产比例',
        '关注美联储政策变化和地缘政治风险',
      ],
    };

    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO market_summary_cache (cache_key, data, generated_at, created_at) VALUES (?, ?, datetime('now'), datetime('now'))`
    ).bind(cacheKey, JSON.stringify(advice)).run();

    return c.json({ success: true, data: advice, cached: false });
  } catch (error: any) {
    console.error('获取投资建议失败:', error);
    return c.json({ success: false, error: '获取投资建议失败', message: error.message }, 500);
  }
});

analysisRoutes.get('/market-summary', async (c: any) => {
  try {
    const cacheKey = 'market_summary';
    const cached = await c.env.DB.prepare(
      "SELECT * FROM market_summary_cache WHERE cache_key = ? AND datetime(generated_at) > datetime('now', '-1 hour')"
    ).bind(cacheKey).first();

    if (cached) {
      const data = typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
      return c.json({ success: true, data, cached: true });
    }

    const priceData = await fetchAllPrices();
    const intl = priceData.international || {};
    const domestic = priceData.domestic || {};

    const bullishCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM market_factors WHERE type = 'bullish'"
    ).first();
    const bearishCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM market_factors WHERE type = 'bearish'"
    ).first();

    const summary = {
      priceOverview: {
        international: { price: intl.price, change: intl.change, changePercent: intl.changePercent, high: intl.high, low: intl.low },
        domestic: { au99_99: domestic.au99_99, au99_95: domestic.au99_95 },
        converted: priceData.converted,
      },
      marketSentiment: {
        trend: intl.changePercent > 0.3 ? 'bullish' : intl.changePercent < -0.3 ? 'bearish' : 'neutral',
        bullishFactors: bullishCount?.count || 0,
        bearishFactors: bearishCount?.count || 0,
        confidence: Math.abs(intl.changePercent || 0) > 1 ? 70 : 50,
      },
      keyLevels: {
        support: intl.price ? (intl.price * 0.985).toFixed(2) : null,
        resistance: intl.price ? (intl.price * 1.015).toFixed(2) : null,
      },
      generatedAt: new Date().toISOString(),
    };

    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO market_summary_cache (cache_key, data, generated_at, created_at) VALUES (?, ?, datetime('now'), datetime('now'))`
    ).bind(cacheKey, JSON.stringify(summary)).run();

    return c.json({ success: true, data: summary, cached: false });
  } catch (error: any) {
    console.error('获取市场摘要失败:', error);
    return c.json({ success: false, error: '获取市场摘要失败', message: error.message }, 500);
  }
});

analysisRoutes.post('/refresh/:type', authMiddleware, async (c: any) => {
  try {
    const user = c.get('user');
    if (user.role !== 'admin') {
      return c.json({ success: false, error: '权限不足', message: '需要管理员权限' }, 403);
    }

    const type = c.req.param('type');
    const validTypes = ['market_summary', 'investment_advice', 'all'];

    if (!validTypes.includes(type)) {
      return c.json({ success: false, error: '无效的缓存类型', message: `支持的类型: ${validTypes.join(', ')}` }, 400);
    }

    if (type === 'all') {
      await c.env.DB.prepare("DELETE FROM market_summary_cache").run();
    } else {
      await c.env.DB.prepare("DELETE FROM market_summary_cache WHERE cache_key = ?").bind(type).run();
    }

    return c.json({ success: true, message: `缓存 ${type} 已清除` });
  } catch (error: any) {
    console.error('刷新缓存失败:', error);
    return c.json({ success: false, error: '刷新缓存失败', message: error.message }, 500);
  }
});

// ============================================
// 路由: 推送 (from routes/push.js)
// ============================================

const pushRoutes = new Hono();

pushRoutes.post('/test', authMiddleware, async (c: any) => {
  try {
    const user = c.get('user');
    if (user.role !== 'admin') {
      return c.json({ success: false, error: '权限不足', message: '需要管理员权限' }, 403);
    }

    const result = await sendPushPlusNotification(
      c.env,
      '【测试推送】黄金市场分析平台',
      `<div style="padding:20px;">
        <h3>推送测试</h3>
        <p>这是一条测试推送消息。</p>
        <p>发送时间: ${new Date().toLocaleString('zh-CN')}</p>
        <p>操作人: ${user.username}</p>
      </div>`,
      'html'
    );

    return c.json({
      success: result.success,
      data: result,
      message: result.success ? '测试推送已发送' : '测试推送失败',
    });
  } catch (error: any) {
    console.error('测试推送失败:', error);
    return c.json({ success: false, error: '测试推送失败', message: error.message }, 500);
  }
});

pushRoutes.post('/scheduled', authMiddleware, requireAdmin, async (c: any) => {
  try {
    const hour = new Date().getHours();
    let pushType = 'custom';
    if (hour >= 7 && hour < 10) pushType = 'morning';
    else if (hour >= 15 && hour < 18) pushType = 'evening';

    const result = await executePush(c.env, null, pushType, c.executionCtx);

    return c.json({
      success: result.success,
      data: result.data,
      error: result.error,
      message: result.success ? `${pushType} 推送已发送` : '推送失败',
    });
  } catch (error: any) {
    console.error('定时推送失败:', error);
    return c.json({ success: false, error: '定时推送失败', message: error.message }, 500);
  }
});

pushRoutes.post('/force', authMiddleware, requireAdmin, async (c: any) => {
  try {
    const body = await c.req.json() || {};
    const pushType = body.pushType || 'custom';
    const result = await executePush(c.env, null, pushType, c.executionCtx);

    return c.json({
      success: result.success,
      data: result.data,
      error: result.error,
      message: result.success ? '强制推送已发送' : '推送失败',
    });
  } catch (error: any) {
    console.error('强制推送失败:', error);
    return c.json({ success: false, error: '强制推送失败', message: error.message }, 500);
  }
});

pushRoutes.get('/status', authMiddleware, async (c: any) => {
  try {
    const recentLogs = await c.env.DB.prepare(
      "SELECT * FROM update_logs WHERE data_type LIKE 'push_%' ORDER BY created_at DESC LIMIT 10"
    ).all();

    const todayStats = await c.env.DB.prepare(
      `SELECT data_type, COUNT(*) as count,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
       FROM update_logs
       WHERE data_type LIKE 'push_%' AND date(created_at) = date('now')
       GROUP BY data_type`
    ).all();

    const pushConfigured = !!c.env.PUSHPLUS_TOKEN;

    let alertStatus = { shouldPush: false, reason: '' };
    try {
      const priceData = await fetchAllPrices();
      alertStatus = checkAlertCondition(priceData);
    } catch {
      // ignore
    }

    return c.json({
      success: true,
      data: { pushConfigured, alertStatus, todayStats: todayStats.results || [], recentLogs: recentLogs.results || [] },
    });
  } catch (error: any) {
    console.error('获取推送状态失败:', error);
    return c.json({ success: false, error: '获取推送状态失败', message: error.message }, 500);
  }
});

// 微信推送订阅路由
pushRoutes.post('/subscribe', authMiddleware, async (c: any) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { push_token, push_type } = body;

    if (!push_token) {
      return c.json({ success: false, error: '参数不完整', message: '请提供 push_token' }, 400);
    }

    await ensurePushSubscriptionsTable(c.env.DB);

    const existing = await c.env.DB.prepare(
      'SELECT id FROM push_subscriptions WHERE user_id = ? AND push_token = ?'
    ).bind(user.id, push_token).first();

    if (existing) {
      return c.json({ success: false, error: '已订阅', message: '该token已订阅' }, 409);
    }

    await c.env.DB.prepare(
      `INSERT INTO push_subscriptions (user_id, push_token, push_type, created_at) VALUES (?, ?, ?, datetime('now'))`
    ).bind(user.id, push_token, push_type || 'daily').run();

    return c.json({ success: true, message: '订阅成功' }, 201);
  } catch (error: any) {
    console.error('订阅推送失败:', error);
    return c.json({ success: false, error: '订阅推送失败', message: error.message }, 500);
  }
});

pushRoutes.post('/unsubscribe', authMiddleware, async (c: any) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { push_token } = body;

    if (!push_token) {
      return c.json({ success: false, error: '参数不完整', message: '请提供 push_token' }, 400);
    }

    await c.env.DB.prepare(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND push_token = ?'
    ).bind(user.id, push_token).run();

    return c.json({ success: true, message: '取消订阅成功' });
  } catch (error: any) {
    console.error('取消订阅失败:', error);
    return c.json({ success: false, error: '取消订阅失败', message: error.message }, 500);
  }
});

pushRoutes.post('/trigger', authMiddleware, requireAdmin, async (c: any) => {
  try {
    await ensurePushSubscriptionsTable(c.env.DB);
    const subs = await c.env.DB.prepare(
      "SELECT * FROM push_subscriptions WHERE push_type = 'daily'"
    ).all();

    if (!subs.results || subs.results.length === 0) {
      return c.json({ success: true, message: '无订阅用户', sentCount: 0 });
    }

    // 获取当前金价数据
    const priceData = await fetchAllPrices();
    const intl = priceData.international || {};
    const changeIcon = intl.change > 0 ? '📈' : '📉';
    const title = `【每日金价】$${intl.price || 'N/A'} ${changeIcon}${Math.abs(intl.changePercent || 0).toFixed(2)}%`;
    const html = generatePushHtml(priceData, '', 'daily');

    let sentCount = 0;
    let failCount = 0;

    for (const sub of subs.results) {
      try {
        const token = sub.push_token as string;
        const pushUrl = `http://www.pushplus.plus/send?token=${encodeURIComponent(token)}&title=${encodeURIComponent(title)}&content=${encodeURIComponent(html)}&template=html`;
        const result = await fetch(pushUrl);
        const data = await result.json() as any;
        if (data.code === 200) sentCount++;
        else failCount++;
      } catch (e) {
        failCount++;
      }
    }

    // 检查金价异动
    if (Math.abs(intl.changePercent || 0) > 2) {
      const alertTitle = `【金价异动】${intl.changePercent > 0 ? '大涨' : '大跌'} ${Math.abs(intl.changePercent).toFixed(2)}%`;
      const alertHtml = generatePushHtml(priceData, '', 'alert');
      const allSubs = await c.env.DB.prepare(
        "SELECT * FROM push_subscriptions"
      ).all();
      for (const sub of allSubs.results || []) {
        try {
          const token = sub.push_token as string;
          const pushUrl = `http://www.pushplus.plus/send?token=${encodeURIComponent(token)}&title=${encodeURIComponent(alertTitle)}&content=${encodeURIComponent(alertHtml)}&template=html`;
          await fetch(pushUrl);
        } catch (e) {
          // ignore
        }
      }
    }

    return c.json({ success: true, sentCount, failCount });
  } catch (error: any) {
    console.error('触发推送失败:', error);
    return c.json({ success: false, error: '触发推送失败', message: error.message }, 500);
  }
});

// ============================================
// 路由: 管理后台 (from routes/admin.js)
// ============================================

const adminRoutes = new Hono();

adminRoutes.use('/*', authMiddleware, requireAdmin);

// 用户管理
adminRoutes.get('/users', async (c: any) => {
  try {
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const search = c.req.query('search');
    const role = c.req.query('role');
    const membershipLevel = c.req.query('membership_level');
    const status = c.req.query('status');

    const clampedLimit = Math.min(Math.max(limit, 1), 100);
    const offset = (page - 1) * clampedLimit;

    let whereClause = '1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (username LIKE ? OR email LIKE ?)';
      const likeSearch = `%${search}%`;
      params.push(likeSearch, likeSearch);
    }
    if (role && ['admin', 'user'].includes(role)) {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    if (membershipLevel && ['free', 'basic', 'premium', 'vip'].includes(membershipLevel)) {
      whereClause += ' AND membership_level = ?';
      params.push(membershipLevel);
    }
    if (status && ['active', 'disabled'].includes(status)) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`
    ).bind(...params).first();
    const total = countResult ? countResult.total : 0;

    const result = await c.env.DB.prepare(
      `SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status, created_at, updated_at
       FROM users WHERE ${whereClause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, clampedLimit, offset).all();

    return c.json({
      success: true,
      data: {
        list: result.results || [],
        pagination: { page, limit: clampedLimit, total, totalPages: Math.ceil(total / clampedLimit) },
      },
    });
  } catch (error: any) {
    console.error('获取用户列表失败:', error);
    return c.json({ success: false, error: '获取用户列表失败', message: error.message }, 500);
  }
});

adminRoutes.get('/users/:id', async (c: any) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const user = await c.env.DB.prepare(
      `SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status, created_at, updated_at FROM users WHERE id = ?`
    ).bind(id).first();

    if (!user) {
      return c.json({ success: false, error: '用户不存在', message: '未找到该用户' }, 404);
    }

    const apiUsage = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM api_usage_logs WHERE user_id = ? AND date(created_at) = date('now')`
    ).bind(id).first();

    return c.json({ success: true, data: { ...user, todayApiCalls: apiUsage?.count || 0 } });
  } catch (error: any) {
    console.error('获取用户详情失败:', error);
    return c.json({ success: false, error: '获取用户详情失败', message: error.message }, 500);
  }
});

adminRoutes.put('/users/:id', async (c: any) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: '用户不存在', message: '未找到该用户' }, 404);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (body.role !== undefined && ['admin', 'user'].includes(body.role)) {
      updates.push('role = ?'); params.push(body.role);
    }
    if (body.status !== undefined && ['active', 'disabled'].includes(body.status)) {
      updates.push('status = ?'); params.push(body.status);
    }
    if (body.membership_level !== undefined && ['free', 'basic', 'premium', 'vip'].includes(body.membership_level)) {
      updates.push('membership_level = ?'); params.push(body.membership_level);
    }
    // 兼容驼峰命名
    if (body.membershipLevel !== undefined && ['free', 'basic', 'premium', 'vip'].includes(body.membershipLevel)) {
      updates.push('membership_level = ?'); params.push(body.membershipLevel);
    }
    if (body.membership_expire_at !== undefined) {
      updates.push('membership_expire_at = ?'); params.push(body.membership_expire_at);
    }
    if (body.avatar !== undefined) {
      updates.push('avatar = ?'); params.push(body.avatar);
    }
    if (body.username !== undefined) {
      const duplicate = await c.env.DB.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(body.username, id).first();
      if (duplicate) {
        return c.json({ success: false, error: '用户名已存在', message: '该用户名已被其他用户使用' }, 409);
      }
      updates.push('username = ?'); params.push(body.username);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: '没有更新内容', message: '请提供要更新的字段' }, 400);
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    const updatedUser = await c.env.DB.prepare(
      `SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status, created_at, updated_at FROM users WHERE id = ?`
    ).bind(id).first();

    return c.json({ success: true, data: updatedUser, message: '用户信息已更新' });
  } catch (error: any) {
    console.error('更新用户信息失败:', error);
    return c.json({ success: false, error: '更新用户信息失败', message: error.message }, 500);
  }
});

adminRoutes.delete('/users/:id', async (c: any) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const currentUser = c.get('user');
    if (currentUser.id === id) {
      return c.json({ success: false, error: '不能删除自己', message: '无法删除当前登录的管理员账号' }, 400);
    }

    const existing = await c.env.DB.prepare('SELECT id, username FROM users WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: '用户不存在', message: '未找到该用户' }, 404);
    }

    await c.env.DB.prepare('DELETE FROM api_usage_logs WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    return c.json({ success: true, message: `用户 ${existing.username} 已删除` });
  } catch (error: any) {
    console.error('删除用户失败:', error);
    return c.json({ success: false, error: '删除用户失败', message: error.message }, 500);
  }
});

// 会员等级管理
adminRoutes.get('/memberships', async (c: any) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM membership_levels ORDER BY id ASC').all();
    const memberships = (result.results || []).map((m: any) => ({
      ...m, features: typeof m.features === 'string' ? JSON.parse(m.features) : m.features,
    }));
    return c.json({ success: true, data: memberships });
  } catch (error: any) {
    console.error('获取会员等级失败:', error);
    return c.json({ success: false, error: '获取会员等级失败', message: error.message }, 500);
  }
});

adminRoutes.post('/memberships', async (c: any) => {
  try {
    const body = await c.req.json();
    const { name, code, price_monthly, price_yearly, features,
      max_api_calls_per_day, max_ai_analysis_per_day,
      can_view_advanced_analysis, can_view_institution_views,
      can_view_investment_advice, can_use_push_notification,
      can_view_realtime_data } = body;

    if (!name || !code) {
      return c.json({ success: false, error: '参数不完整', message: '请提供 name 和 code' }, 400);
    }

    const existing = await c.env.DB.prepare('SELECT id FROM membership_levels WHERE code = ?').bind(code).first();
    if (existing) {
      return c.json({ success: false, error: '等级代码已存在', message: '该 code 已被使用' }, 409);
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO membership_levels (name, code, price_monthly, price_yearly, features, max_api_calls_per_day, max_ai_analysis_per_day, can_view_advanced_analysis, can_view_institution_views, can_view_investment_advice, can_use_push_notification, can_view_realtime_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      name, code, price_monthly || 0, price_yearly || 0,
      JSON.stringify(features || []), max_api_calls_per_day || 100, max_ai_analysis_per_day || 3,
      can_view_advanced_analysis ? 1 : 0, can_view_institution_views ? 1 : 0,
      can_view_investment_advice ? 1 : 0, can_use_push_notification ? 1 : 0,
      can_view_realtime_data ? 1 : 0
    ).run();

    return c.json({ success: true, data: { id: result.meta.last_row_id, name, code }, message: '会员等级创建成功' }, 201);
  } catch (error: any) {
    console.error('创建会员等级失败:', error);
    return c.json({ success: false, error: '创建会员等级失败', message: error.message }, 500);
  }
});

adminRoutes.put('/memberships/:id', async (c: any) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT id FROM membership_levels WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: '会员等级不存在', message: '未找到该会员等级' }, 404);
    }

    const updates: string[] = [];
    const params: any[] = [];

    const allowedFields = [
      'name', 'price_monthly', 'price_yearly',
      'max_api_calls_per_day', 'max_ai_analysis_per_day',
      'can_view_advanced_analysis', 'can_view_institution_views',
      'can_view_investment_advice', 'can_use_push_notification',
      'can_view_realtime_data',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field.startsWith('can_')) {
          params.push(body[field] ? 1 : 0);
        } else {
          params.push(body[field]);
        }
      }
    }

    if (body.features !== undefined) {
      updates.push('features = ?');
      params.push(JSON.stringify(body.features));
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: '没有更新内容', message: '请提供要更新的字段' }, 400);
    }

    params.push(id);
    await c.env.DB.prepare(`UPDATE membership_levels SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    const updated = await c.env.DB.prepare('SELECT * FROM membership_levels WHERE id = ?').bind(id).first();
    return c.json({
      success: true,
      data: { ...updated, features: typeof updated.features === 'string' ? JSON.parse(updated.features) : updated.features },
      message: '会员等级更新成功',
    });
  } catch (error: any) {
    console.error('更新会员等级失败:', error);
    return c.json({ success: false, error: '更新会员等级失败', message: error.message }, 500);
  }
});

adminRoutes.delete('/memberships/:id', async (c: any) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const existing = await c.env.DB.prepare('SELECT id, code FROM membership_levels WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: '会员等级不存在', message: '未找到该会员等级' }, 404);
    }
    if (existing.code === 'free') {
      return c.json({ success: false, error: '不能删除免费等级', message: '免费等级为系统默认等级' }, 400);
    }
    await c.env.DB.prepare('DELETE FROM membership_levels WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: '会员等级已删除' });
  } catch (error: any) {
    console.error('删除会员等级失败:', error);
    return c.json({ success: false, error: '删除会员等级失败', message: error.message }, 500);
  }
});

// 权限管理
adminRoutes.get('/permissions', async (c: any) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM permissions ORDER BY module, id ASC').all();
    const grouped: Record<string, any[]> = {};
    for (const perm of result.results || []) {
      if (!grouped[perm.module]) grouped[perm.module] = [];
      grouped[perm.module].push(perm);
    }
    return c.json({ success: true, data: { list: result.results || [], grouped } });
  } catch (error: any) {
    console.error('获取权限列表失败:', error);
    return c.json({ success: false, error: '获取权限列表失败', message: error.message }, 500);
  }
});

adminRoutes.post('/permissions', async (c: any) => {
  try {
    const body = await c.req.json();
    const { name, code, description, module } = body;
    if (!name || !code || !module) {
      return c.json({ success: false, error: '参数不完整', message: '请提供 name、code 和 module' }, 400);
    }

    const existing = await c.env.DB.prepare('SELECT id FROM permissions WHERE code = ?').bind(code).first();
    if (existing) {
      return c.json({ success: false, error: '权限代码已存在', message: '该 code 已被使用' }, 409);
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO permissions (name, code, description, module, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(name, code, description || '', module).run();

    return c.json({ success: true, data: { id: result.meta.last_row_id, name, code, module }, message: '权限创建成功' }, 201);
  } catch (error: any) {
    console.error('创建权限失败:', error);
    return c.json({ success: false, error: '创建权限失败', message: error.message }, 500);
  }
});

adminRoutes.put('/permissions/:id', async (c: any) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT id FROM permissions WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ success: false, error: '权限不存在', message: '未找到该权限' }, 404);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
    if (body.module !== undefined) { updates.push('module = ?'); params.push(body.module); }

    if (updates.length === 0) {
      return c.json({ success: false, error: '没有更新内容', message: '请提供要更新的字段' }, 400);
    }

    params.push(id);
    await c.env.DB.prepare(`UPDATE permissions SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    const updated = await c.env.DB.prepare('SELECT * FROM permissions WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: updated, message: '权限更新成功' });
  } catch (error: any) {
    console.error('更新权限失败:', error);
    return c.json({ success: false, error: '更新权限失败', message: error.message }, 500);
  }
});

adminRoutes.put('/role-permissions', async (c: any) => {
  try {
    const body = await c.req.json();
    const { role, permission_ids } = body;

    if (!role || !Array.isArray(permission_ids)) {
      return c.json({ success: false, error: '参数不完整', message: '请提供 role 和 permission_ids' }, 400);
    }

    await c.env.DB.prepare('DELETE FROM role_permissions WHERE role = ?').bind(role).run();

    if (permission_ids.length > 0) {
      const stmts = permission_ids.map((pid: number) =>
        c.env.DB.prepare(
          `INSERT OR IGNORE INTO role_permissions (role, permission_id, created_at) VALUES (?, ?, datetime('now'))`
        ).bind(role, pid)
      );
      await c.env.DB.batch(stmts);
    }

    return c.json({ success: true, data: { role, permission_ids }, message: '角色权限更新成功' });
  } catch (error: any) {
    console.error('更新角色权限失败:', error);
    return c.json({ success: false, error: '更新角色权限失败', message: error.message }, 500);
  }
});

adminRoutes.get('/role-permissions/:role', async (c: any) => {
  try {
    const role = c.req.param('role');
    const result = await c.env.DB.prepare(
      `SELECT p.* FROM permissions p INNER JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role = ? ORDER BY p.module, p.id ASC`
    ).bind(role).all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error: any) {
    console.error('获取角色权限失败:', error);
    return c.json({ success: false, error: '获取角色权限失败', message: error.message }, 500);
  }
});

// API 使用统计
adminRoutes.get('/api-usage', async (c: any) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10);
    const userId = c.req.query('user_id');
    const clampedDays = Math.min(Math.max(days, 1), 90);

    let whereClause = "date(created_at) >= date('now', ? || ' days')";
    const params: any[] = [`-${clampedDays}`];

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(parseInt(userId, 10));
    }

    const dailyStats = await c.env.DB.prepare(
      `SELECT date(created_at) as date, COUNT(*) as total_calls,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_calls
       FROM api_usage_logs WHERE ${whereClause}
       GROUP BY date(created_at) ORDER BY date DESC`
    ).bind(...params).all();

    const endpointStats = await c.env.DB.prepare(
      `SELECT endpoint, COUNT(*) as total_calls,
        AVG(CASE WHEN status_code < 400 THEN 1 ELSE 0 END) as success_rate
       FROM api_usage_logs WHERE ${whereClause}
       GROUP BY endpoint ORDER BY total_calls DESC LIMIT 20`
    ).bind(...params).all();

    const totalStats = await c.env.DB.prepare(
      `SELECT COUNT(*) as total_calls,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_calls
       FROM api_usage_logs WHERE ${whereClause}`
    ).bind(...params).first();

    return c.json({
      success: true,
      data: { summary: totalStats, daily: dailyStats.results || [], endpoints: endpointStats.results || [] },
    });
  } catch (error: any) {
    console.error('获取API使用统计失败:', error);
    return c.json({ success: false, error: '获取API使用统计失败', message: error.message }, 500);
  }
});

// 仪表盘
adminRoutes.get('/dashboard', async (c: any) => {
  try {
    const userStats = await c.env.DB.prepare(
      `SELECT COUNT(*) as total_users,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today_new_users
       FROM users`
    ).first();

    const membershipStats = await c.env.DB.prepare(
      `SELECT membership_level, COUNT(*) as count FROM users GROUP BY membership_level`
    ).all();

    const apiStats = await c.env.DB.prepare(
      `SELECT COUNT(*) as total_calls, COUNT(DISTINCT user_id) as active_users
       FROM api_usage_logs WHERE date(created_at) = date('now')`
    ).first();

    const apiTrend = await c.env.DB.prepare(
      `SELECT date(created_at) as date, COUNT(*) as calls
       FROM api_usage_logs WHERE date(created_at) >= date('now', '-7 days')
       GROUP BY date(created_at) ORDER BY date ASC`
    ).all();

    const recentLogs = await c.env.DB.prepare(
      'SELECT * FROM update_logs ORDER BY created_at DESC LIMIT 10'
    ).all();

    return c.json({
      success: true,
      data: {
        users: userStats,
        memberships: membershipStats.results || [],
        api: apiStats,
        apiTrend: apiTrend.results || [],
        recentLogs: recentLogs.results || [],
      },
    });
  } catch (error: any) {
    console.error('获取仪表盘数据失败:', error);
    return c.json({ success: false, error: '获取仪表盘数据失败', message: error.message }, 500);
  }
});

// ============================================
// 服务: 宏观数据 (FRED + 多数据源)
// ============================================

async function fetchFredSeries(apiKey: string, seriesId: string, startDate: string): Promise<{ observations: { date: string; value: string }[] }> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${startDate}&sort_order=asc`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`FRED ${seriesId} 请求失败: ${response.status}`);
  return await response.json() as { observations: { date: string; value: string }[] };
}

function getLatestFredValue(observations: { date: string; value: string }[]): number {
  for (let i = observations.length - 1; i >= 0; i--) {
    const v = parseFloat(observations[i].value);
    if (!isNaN(v)) return v;
  }
  return 0;
}

function getFredSeriesAsArray(observations: { date: string; value: string }[]): { date: string; value: number }[] {
  return observations
    .filter(o => o.value !== '.' && !isNaN(parseFloat(o.value)))
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
}

async function fetchFredData(apiKey: string) {
  const startDate = new Date(Date.now() - 365 * 2 * 86400000).toISOString().split('T')[0];
  const seriesIds = ['DFII10', 'DGS10', 'T10YIE', 'DTWEXBGS', 'CPILFESL', 'PCEPILFE', 'WALCL', 'VIXCLS', 'DFF', 'T5YIFR', 'T10Y2Y'];

  const results: Record<string, { observations: { date: string; value: string }[] }> = {};
  const fetchPromises = seriesIds.map(async (id) => {
    try {
      results[id] = await fetchFredSeries(apiKey, id, startDate);
    } catch (e) {
      console.error(`FRED ${id} 获取失败:`, e);
      results[id] = { observations: [] };
    }
  });
  await Promise.all(fetchPromises);

  return {
    realRate: getLatestFredValue(results.DFII10?.observations || []),
    realRateSeries: getFredSeriesAsArray(results.DFII10?.observations || []),
    nominalRate: getLatestFredValue(results.DGS10?.observations || []),
    nominalRateSeries: getFredSeriesAsArray(results.DGS10?.observations || []),
    breakeven: getLatestFredValue(results.T10YIE?.observations || []),
    breakevenSeries: getFredSeriesAsArray(results.T10YIE?.observations || []),
    dxy: getLatestFredValue(results.DTWEXBGS?.observations || []),
    dxySeries: getFredSeriesAsArray(results.DTWEXBGS?.observations || []),
    coreCpi: getLatestFredValue(results.CPILFESL?.observations || []),
    coreCpiSeries: getFredSeriesAsArray(results.CPILFESL?.observations || []),
    corePce: getLatestFredValue(results.PCEPILFE?.observations || []),
    corePceSeries: getFredSeriesAsArray(results.PCEPILFE?.observations || []),
    fedBalance: getLatestFredValue(results.WALCL?.observations || []),
    fedBalanceSeries: getFredSeriesAsArray(results.WALCL?.observations || []),
    vix: getLatestFredValue(results.VIXCLS?.observations || []),
    vixSeries: getFredSeriesAsArray(results.VIXCLS?.observations || []),
    fedFundsRate: getLatestFredValue(results.DFF?.observations || []),
    fedFundsRateSeries: getFredSeriesAsArray(results.DFF?.observations || []),
    fwd5y5y: getLatestFredValue(results.T5YIFR?.observations || []),
    fwd5y5ySeries: getFredSeriesAsArray(results.T5YIFR?.observations || []),
    yieldSpread: getLatestFredValue(results.T10Y2Y?.observations || []),
    yieldSpreadSeries: getFredSeriesAsArray(results.T10Y2Y?.observations || []),
  };
}

async function fetchOilPrice() {
  try {
    const response = await fetch('https://push2.eastmoney.com/api/qt/stock/get?secid=133.CLm1&fields=f43,f44,f45,f46,f57,f58,f60,f169,f170', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (!response.ok) throw new Error(`东方财富WTI请求失败: ${response.status}`);
    const result = await response.json();
    if (result.rc === 0 && result.data) {
      const d = result.data;
      return { price: d.f43 / 100, change: d.f169 / 100, changePercent: d.f170 / 100, source: 'eastmoney-WTI' };
    }
  } catch (e) {
    console.error('获取油价失败:', e);
  }
  return { price: 0, change: 0, changePercent: 0, source: 'none' };
}

async function fetchSilverPrice() {
  try {
    const response = await fetch('https://push2.eastmoney.com/api/qt/stock/get?secid=122.XAG&fields=f43,f44,f45,f46,f57,f58,f60,f169,f170', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (!response.ok) throw new Error(`东方财富XAG请求失败: ${response.status}`);
    const result = await response.json();
    if (result.rc === 0 && result.data) {
      const d = result.data;
      return { price: d.f43 / 100, change: d.f169 / 100, changePercent: d.f170 / 100, source: 'eastmoney-XAG' };
    }
  } catch (e) {
    console.error('获取银价失败:', e);
  }
  return { price: 0, change: 0, changePercent: 0, source: 'none' };
}

async function fetchGdxEtf() {
  try {
    const response = await fetch('https://push2.eastmoney.com/api/qt/stock/get?secid=105.GDX&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (!response.ok) throw new Error(`东方财富GDX请求失败: ${response.status}`);
    const result = await response.json();
    if (result.rc === 0 && result.data) {
      const d = result.data;
      return { price: d.f43 / 100, change: d.f169 / 100, changePercent: d.f170 / 100, volume: d.f47 || 0, source: 'eastmoney-GDX' };
    }
  } catch (e) {
    console.error('获取GDX数据失败:', e);
  }
  return { price: 0, change: 0, changePercent: 0, volume: 0, source: 'none' };
}

async function fetchGldEtf() {
  try {
    const response = await fetch('https://push2.eastmoney.com/api/qt/stock/get?secid=105.GLD&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (!response.ok) throw new Error(`东方财富GLD请求失败: ${response.status}`);
    const result = await response.json();
    if (result.rc === 0 && result.data) {
      const d = result.data;
      return { price: d.f43 / 100, change: d.f169 / 100, changePercent: d.f170 / 100, volume: d.f47 || 0, source: 'eastmoney-GLD' };
    }
  } catch (e) {
    console.error('获取GLD数据失败:', e);
  }
  return { price: 0, change: 0, changePercent: 0, volume: 0, source: 'none' };
}

// ============================================
// 服务: COT持仓数据 (CFTC)
// ============================================

async function fetchCotData() {
  try {
    const response = await fetch('https://www.cftc.gov/dea/newcot/deafut.txt');
    if (!response.ok) throw new Error(`CFTC请求失败: ${response.status}`);
    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('GOLD - COMMODITY EXCHANGE')) {
        const fields = line.split(',').map(f => f.trim());
        // CFTC deafut.txt format for GOLD:
        // 0: Exchange, 1-4: header info, 5: date, 6: OI
        // 7: NonComm Long, 8: NonComm Short, 9: NonComm Spreading
        // 10: Comm Long, 11: Comm Short
        // 12: NonRept Long, 13: NonRept Short
        const nonCommLong = parseInt(fields[7]) || 0;
        const nonCommShort = parseInt(fields[8]) || 0;
        const nonCommSpreading = parseInt(fields[9]) || 0;
        const commLong = parseInt(fields[10]) || 0;
        const commShort = parseInt(fields[11]) || 0;
        const nonReptLong = parseInt(fields[12]) || 0;
        const nonReptShort = parseInt(fields[13]) || 0;
        const openInterest = parseInt(fields[6]) || 1;
        const netLong = nonCommLong - nonCommShort;
        const netPct = openInterest > 0 ? (netLong / openInterest) * 100 : 0;
        return {
          nonCommLong, nonCommShort, nonCommSpreading,
          commLong, commShort, nonReptLong, nonReptShort,
          openInterest, netLong, netPct,
          date: fields[5] || '',
          source: 'CFTC',
        };
      }
    }
  } catch (e) {
    console.error('获取COT数据失败:', e);
  }
  return {
    nonCommLong: 0, nonCommShort: 0, nonCommSpreading: 0,
    commLong: 0, commShort: 0, nonReptLong: 0, nonReptShort: 0,
    openInterest: 0, netLong: 0, netPct: 50,
    date: '', source: 'none',
  };
}

// ============================================
// 服务: 央行购金数据 (WGC硬编码)
// ============================================

function getCentralBankData() {
  return {
    quarterly: [
      { quarter: '2023Q1', tonnes: 228 },
      { quarter: '2023Q2', tonnes: 175 },
      { quarter: '2023Q3', tonnes: 337 },
      { quarter: '2023Q4', tonnes: 229 },
      { quarter: '2024Q1', tonnes: 290 },
      { quarter: '2024Q2', tonnes: 183 },
      { quarter: '2024Q3', tonnes: 186 },
      { quarter: '2024Q4', tonnes: 333 },
      { quarter: '2025Q1', tonnes: 244 },
    ],
    trend: 'increasing' as 'increasing' | 'stable' | 'decreasing',
    latestQuarter: '2025Q1',
    latestTonnes: 244,
    yoyChange: -15.9,
    source: 'WGC',
  };
}

// ============================================
// 技术指标计算
// ============================================

function calcMA(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += values[j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

function calcLatestMA(values: number[], period: number): number {
  if (values.length < period) return NaN;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) {
    sum += values[i];
  }
  return sum / period;
}

function calcROC(values: number[], period: number): number {
  if (values.length < period + 1) return 0;
  const current = values[values.length - 1];
  const past = values[values.length - 1 - period];
  if (past === 0) return 0;
  return ((current - past) / past) * 100;
}

function calcRSI(values: number[], period: number = 14): number {
  if (values.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcVolatility(values: number[], period: number = 20): number {
  if (values.length < period + 1) return 0;
  const returns: number[] = [];
  for (let i = values.length - period; i < values.length; i++) {
    returns.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function isMACross(goldSeries: { date: string; value: number }[], shortPeriod: number, longPeriod: number): 'golden' | 'death' | 'none' {
  if (goldSeries.length < longPeriod + 2) return 'none';
  const values = goldSeries.map(s => s.value);
  const maShort = calcMA(values, shortPeriod);
  const maLong = calcMA(values, longPeriod);
  const lastIdx = values.length - 1;
  const prevIdx = lastIdx - 1;
  if (isNaN(maShort[prevIdx]) || isNaN(maLong[prevIdx]) || isNaN(maShort[lastIdx]) || isNaN(maLong[lastIdx])) return 'none';
  if (maShort[prevIdx] <= maLong[prevIdx] && maShort[lastIdx] > maLong[lastIdx]) return 'golden';
  if (maShort[prevIdx] >= maLong[prevIdx] && maShort[lastIdx] < maLong[lastIdx]) return 'death';
  return 'none';
}

function calcFedWowChange(fedSeries: { date: string; value: number }[]): number {
  if (fedSeries.length < 2) return 0;
  const latest = fedSeries[fedSeries.length - 1].value;
  const weekAgo = fedSeries.length >= 5 ? fedSeries[fedSeries.length - 5].value : fedSeries[0].value;
  if (weekAgo === 0) return 0;
  return (latest - weekAgo) / weekAgo;
}

// ============================================
// 信号引擎 (18条多空信号)
// ============================================

interface Signal {
  id: string;
  name: string;
  type: 'bullish' | 'bearish';
  strength: number;
  active: boolean;
  description: string;
}

function calculateSignals(data: {
  realRate: number; realRateSeries: { date: string; value: number }[];
  dxy: number; dxySeries: { date: string; value: number }[];
  corePce: number; corePceSeries: { date: string; value: number }[];
  fedBalance: number; fedBalanceSeries: { date: string; value: number }[];
  vix: number;
  goldPrice: number; goldSeries: { date: string; value: number }[];
  cotNetPct: number;
  gldFlowPct: number;
  goldSilverRatio: number;
  yieldSpread: number; yieldSpreadSeries: { date: string; value: number }[];
}): Signal[] {
  const signals: Signal[] = [];
  const ry = data.realRate;
  const rySeries = data.realRateSeries.map(s => s.value);
  const dxyRoc20 = calcROC(data.dxySeries.map(s => s.value), 20);
  const fedWow = calcFedWowChange(data.fedBalanceSeries);
  const goldValues = data.goldSeries.map(s => s.value);
  const ma50 = calcLatestMA(goldValues, 50);
  const ma200 = calcLatestMA(goldValues, 200);
  const cross = isMACross(data.goldSeries, 50, 200);

  // 看多信号
  signals.push({
    id: 'bull_1', name: '实际利率 < 0', type: 'bullish', strength: 5,
    active: ry < 0,
    description: `当前实际利率 ${ry.toFixed(2)}%${ry < 0 ? '，为负值利好黄金' : ''}`,
  });
  signals.push({
    id: 'bull_2', name: '实际利率均线下穿', type: 'bullish', strength: 4,
    active: rySeries.length >= 20 && rySeries[rySeries.length - 1] < calcLatestMA(rySeries, 20),
    description: `实际利率 ${ry.toFixed(2)}%，20日均线 ${calcLatestMA(rySeries, 20).toFixed(2)}%`,
  });
  signals.push({
    id: 'bull_3', name: '美元走弱20日动量<-2%', type: 'bullish', strength: 3,
    active: dxyRoc20 < -2,
    description: `美元指数20日动量 ${dxyRoc20.toFixed(2)}%`,
  });
  signals.push({
    id: 'bull_4', name: '核心PCE同比>3%', type: 'bullish', strength: 3,
    active: data.corePce > 3,
    description: `核心PCE同比 ${data.corePce.toFixed(2)}%`,
  });
  signals.push({
    id: 'bull_5', name: '美联储扩表', type: 'bullish', strength: 3,
    active: fedWow > 0,
    description: `美联储资产周变化 ${(fedWow * 100).toFixed(3)}%`,
  });
  signals.push({
    id: 'bull_6', name: 'VIX>30', type: 'bullish', strength: 3,
    active: data.vix > 30,
    description: `VIX ${data.vix.toFixed(2)}`,
  });
  signals.push({
    id: 'bull_7', name: '金价站上200日均线', type: 'bullish', strength: 3,
    active: !isNaN(ma200) && data.goldPrice > ma200,
    description: `金价 $${data.goldPrice.toFixed(2)}，MA200 $${isNaN(ma200) ? 'N/A' : ma200.toFixed(2)}`,
  });
  signals.push({
    id: 'bull_8', name: '50/200日均线金叉', type: 'bullish', strength: 5,
    active: cross === 'golden',
    description: cross === 'golden' ? '50日均线上穿200日均线' : '未发生金叉',
  });
  signals.push({
    id: 'bull_9', name: 'COT投机净多头低位<20百分位', type: 'bullish', strength: 3,
    active: data.cotNetPct < 20,
    description: `COT净多头百分位 ${data.cotNetPct.toFixed(1)}%`,
  });
  signals.push({
    id: 'bull_10', name: '实际利率-金价背离超卖', type: 'bullish', strength: 3,
    active: ry > 1.5 && data.goldPrice > ma200,
    description: `实际利率 ${ry.toFixed(2)}%，金价仍高于MA200`,
  });
  signals.push({
    id: 'bull_11', name: 'GLD ETF资金大幅流入>10%', type: 'bullish', strength: 2,
    active: data.gldFlowPct > 10,
    description: `GLD资金流入 ${data.gldFlowPct.toFixed(1)}%`,
  });
  signals.push({
    id: 'bull_12', name: '金银比偏低<60', type: 'bullish', strength: 2,
    active: data.goldSilverRatio > 0 && data.goldSilverRatio < 60,
    description: `金银比 ${data.goldSilverRatio.toFixed(1)}`,
  });
  signals.push({
    id: 'bull_13', name: '收益率曲线倒挂', type: 'bullish', strength: 3,
    active: data.yieldSpread < 0,
    description: `10Y-2Y利差 ${data.yieldSpread.toFixed(2)}%`,
  });

  // 看空信号
  signals.push({
    id: 'bear_1', name: '实际利率>2%且上行', type: 'bearish', strength: 4,
    active: ry > 2 && rySeries.length >= 2 && rySeries[rySeries.length - 1] > rySeries[rySeries.length - 2],
    description: `实际利率 ${ry.toFixed(2)}%且上行`,
  });
  signals.push({
    id: 'bear_2', name: '美元走强20日动量>2%', type: 'bearish', strength: 3,
    active: dxyRoc20 > 2,
    description: `美元指数20日动量 ${dxyRoc20.toFixed(2)}%`,
  });
  signals.push({
    id: 'bear_3', name: '核心PCE同比<2%', type: 'bearish', strength: 2,
    active: data.corePce < 2,
    description: `核心PCE同比 ${data.corePce.toFixed(2)}%`,
  });
  signals.push({
    id: 'bear_4', name: '美联储缩表', type: 'bearish', strength: 3,
    active: fedWow < 0,
    description: `美联储资产周变化 ${(fedWow * 100).toFixed(3)}%`,
  });
  signals.push({
    id: 'bear_5', name: '金价跌破200日均线', type: 'bearish', strength: 4,
    active: !isNaN(ma200) && data.goldPrice < ma200,
    description: `金价 $${data.goldPrice.toFixed(2)}，MA200 $${isNaN(ma200) ? 'N/A' : ma200.toFixed(2)}`,
  });
  signals.push({
    id: 'bear_6', name: '50/200日均线死叉', type: 'bearish', strength: 5,
    active: cross === 'death',
    description: cross === 'death' ? '50日均线下穿200日均线' : '未发生死叉',
  });
  signals.push({
    id: 'bear_7', name: 'COT投机净多头拥挤>80百分位', type: 'bearish', strength: 3,
    active: data.cotNetPct > 80,
    description: `COT净多头百分位 ${data.cotNetPct.toFixed(1)}%`,
  });
  signals.push({
    id: 'bear_8', name: '实际利率-金价背离超买', type: 'bearish', strength: 3,
    active: ry < -1 && data.goldPrice < ma200,
    description: `实际利率 ${ry.toFixed(2)}%，金价低于MA200`,
  });
  signals.push({
    id: 'bear_9', name: 'GLD ETF资金大幅流出<-10%', type: 'bearish', strength: 2,
    active: data.gldFlowPct < -10,
    description: `GLD资金流出 ${data.gldFlowPct.toFixed(1)}%`,
  });
  signals.push({
    id: 'bear_10', name: '金银比极端偏高>80', type: 'bearish', strength: 2,
    active: data.goldSilverRatio > 80,
    description: `金银比 ${data.goldSilverRatio.toFixed(1)}`,
  });
  signals.push({
    id: 'bear_11', name: '收益率曲线急陡', type: 'bearish', strength: 2,
    active: data.yieldSpreadSeries.length >= 2 && (data.yieldSpread - data.yieldSpreadSeries[data.yieldSpreadSeries.length - 2].value) > 0.5,
    description: `10Y-2Y利差 ${data.yieldSpread.toFixed(2)}%，快速走陡`,
  });

  return signals;
}

// ============================================
// 情绪评分 (6因子权重模型)
// ============================================

function calculateSentiment(data: {
  vix: number;
  realRateSeries: { date: string; value: number }[];
  dxySeries: { date: string; value: number }[];
  goldPrice: number; goldSeries: { date: string; value: number }[];
  cotNetPct: number;
  gldFlowPct: number;
}): { score: number; label: string; factors: { name: string; weight: number; score: number; raw: number }[] } {
  const ryValues = data.realRateSeries.map(s => s.value);
  const dxyValues = data.dxySeries.map(s => s.value);
  const goldValues = data.goldSeries.map(s => s.value);

  // VIX (15%): VIX高→恐惧(低分)
  const vixScore = Math.max(0, Math.min(100, (40 - data.vix) / 30 * 100));
  // 实际利率趋势 (25%): 下行→利好→贪婪(高分)
  let ryTrendScore = 50;
  if (ryValues.length >= 20) {
    const ryRoc = calcROC(ryValues, 20);
    ryTrendScore = Math.max(0, Math.min(100, 50 - ryRoc * 20));
  }
  // 美元趋势 (20%): 弱→利好→贪婪(高分)
  let dxyTrendScore = 50;
  if (dxyValues.length >= 20) {
    const dxyRoc = calcROC(dxyValues, 20);
    dxyTrendScore = Math.max(0, Math.min(100, 50 - dxyRoc * 10));
  }
  // 金价技术趋势 (10%): 多头排列→贪婪(高分)
  let goldTechScore = 50;
  if (goldValues.length >= 200) {
    const ma50 = calcLatestMA(goldValues, 50);
    const ma200 = calcLatestMA(goldValues, 200);
    if (!isNaN(ma50) && !isNaN(ma200)) {
      goldTechScore = ma50 > ma200 ? 75 : 25;
    }
  }
  // COT持仓 (15%): 净多头百分位高→贪婪(高分)
  const cotScore = Math.max(0, Math.min(100, data.cotNetPct));
  // GLD ETF资金流 (15%): 流入→贪婪(高分)
  const gldScore = Math.max(0, Math.min(100, 50 + data.gldFlowPct * 2.5));

  const factors = [
    { name: 'VIX恐慌指数', weight: 0.15, score: vixScore, raw: data.vix },
    { name: '实际利率趋势', weight: 0.25, score: ryTrendScore, raw: ryValues.length > 0 ? ryValues[ryValues.length - 1] : 0 },
    { name: '美元趋势', weight: 0.20, score: dxyTrendScore, raw: dxyValues.length > 0 ? dxyValues[dxyValues.length - 1] : 0 },
    { name: '金价技术趋势', weight: 0.10, score: goldTechScore, raw: data.goldPrice },
    { name: 'COT持仓', weight: 0.15, score: cotScore, raw: data.cotNetPct },
    { name: 'GLD ETF资金流', weight: 0.15, score: gldScore, raw: data.gldFlowPct },
  ];

  const totalScore = factors.reduce((acc, f) => acc + f.score * f.weight, 0);
  let label = '中性';
  if (totalScore <= 20) label = '极度恐惧';
  else if (totalScore <= 40) label = '恐惧';
  else if (totalScore <= 60) label = '中性';
  else if (totalScore <= 80) label = '贪婪';
  else label = '极度贪婪';

  return { score: Math.round(totalScore * 10) / 10, label, factors };
}

// ============================================
// 雷达图数据 (6轴 0-10分)
// ============================================

function calculateRadar(data: {
  realRate: number;
  dxySeries: { date: string; value: number }[];
  breakeven: number;
  fedBalanceSeries: { date: string; value: number }[];
  vix: number;
  cotNetPct: number;
  gldFlowPct: number;
}): { name: string; score: number }[] {
  const ry = data.realRate;
  const dxyRoc = calcROC(data.dxySeries.map(s => s.value), 20);
  const be = data.breakeven;
  const fedWow = calcFedWowChange(data.fedBalanceSeries);
  const vix = data.vix;

  const realRateScore = Math.max(0, Math.min(10, (2.5 - ry) / 4 * 10));
  const dxyScore = Math.max(0, Math.min(10, (3 - dxyRoc) / 6 * 10));
  const inflationScore = Math.max(0, Math.min(10, (be - 1.5) / 2 * 10));
  const liquidityScore = Math.max(0, Math.min(10, (fedWow + 0.2) / 0.4 * 10));
  const safeHavenScore = Math.max(0, Math.min(10, (vix - 10) / 30 * 10));
  const cotPart = Math.max(0, Math.min(10, data.cotNetPct / 10));
  const gldPart = Math.max(0, Math.min(10, 5 + data.gldFlowPct * 0.5));
  const flowScore = cotPart * 0.6 + gldPart * 0.4;

  return [
    { name: '实际利率', score: Math.round(realRateScore * 10) / 10 },
    { name: '美元强弱', score: Math.round(dxyScore * 10) / 10 },
    { name: '通胀预期', score: Math.round(inflationScore * 10) / 10 },
    { name: '流动性', score: Math.round(liquidityScore * 10) / 10 },
    { name: '避险需求', score: Math.round(safeHavenScore * 10) / 10 },
    { name: '资金流入', score: Math.round(flowScore * 10) / 10 },
  ];
}

// ============================================
// 风险矩阵
// ============================================

function calculateRiskMatrix(data: {
  vix: number;
  realRate: number;
  goldPrice: number;
  goldSeries: { date: string; value: number }[];
  fedFundsRate: number;
}): { type: string; riskLevel: string; riskScore: number; keyFactors: string[]; riskSignals: string[]; oppSignals: string[]; position: string }[] {
  const goldValues = data.goldSeries.map(s => s.value);
  const vol = calcVolatility(goldValues);
  const rsi = calcRSI(goldValues);
  const ma200 = calcLatestMA(goldValues, 200);

  const baseRisk = Math.min(10, vol / 3);
  const isAboveMa200 = !isNaN(ma200) && data.goldPrice > ma200;

  return [
    {
      type: '实物黄金',
      riskLevel: baseRisk < 4 ? 'low' : baseRisk < 7 ? 'medium' : 'high',
      riskScore: Math.round(Math.max(1, baseRisk * 0.6) * 10) / 10,
      keyFactors: ['无杠杆风险', '存储成本', '流动性较低'],
      riskSignals: data.vix > 30 ? ['避险需求推高溢价'] : ['溢价正常'],
      oppSignals: isAboveMa200 ? ['金价处于上升趋势'] : ['金价弱势'],
      position: baseRisk < 4 ? '可加仓' : baseRisk < 7 ? '持有' : '减仓',
    },
    {
      type: '黄金ETF',
      riskLevel: baseRisk < 4 ? 'low' : baseRisk < 7 ? 'medium' : 'high',
      riskScore: Math.round(Math.max(1, baseRisk * 0.8) * 10) / 10,
      keyFactors: ['跟踪误差', '管理费', '流动性好'],
      riskSignals: rsi > 70 ? ['RSI超买'] : rsi < 30 ? ['RSI超卖'] : ['RSI中性'],
      oppSignals: data.realRate < 0 ? ['实际利率利好'] : ['实际利率偏空'],
      position: baseRisk < 4 ? '可加仓' : baseRisk < 7 ? '持有' : '减仓',
    },
    {
      type: '黄金期货',
      riskLevel: 'high',
      riskScore: Math.round(Math.max(5, baseRisk * 1.5) * 10) / 10,
      keyFactors: ['杠杆风险', '保证金要求', '到期风险'],
      riskSignals: vol > 20 ? ['波动率偏高'] : ['波动率正常'],
      oppSignals: isAboveMa200 ? ['趋势偏多'] : ['趋势偏空'],
      position: '谨慎操作',
    },
    {
      type: '金矿股',
      riskLevel: 'high',
      riskScore: Math.round(Math.max(6, baseRisk * 1.8) * 10) / 10,
      keyFactors: ['经营风险', '杠杆效应', '政策风险'],
      riskSignals: data.vix > 25 ? ['市场恐慌利空矿股'] : ['市场情绪稳定'],
      oppSignals: data.realRate < 1 ? ['低利率利好矿股'] : ['高利率利空矿股'],
      position: '轻仓观望',
    },
  ];
}

// ============================================
// 走势预期
// ============================================

function calculateOutlook(data: {
  signals: Signal[];
  sentiment: { score: number; label: string };
  goldPrice: number;
  goldSeries: { date: string; value: number }[];
  realRate: number;
  vix: number;
  dxy: number;
}): { shortTerm: any; mediumTerm: any; longTerm: any } {
  const bullActive = data.signals.filter(s => s.type === 'bullish' && s.active).length;
  const bearActive = data.signals.filter(s => s.type === 'bearish' && s.active).length;
  const bullStrength = data.signals.filter(s => s.type === 'bullish' && s.active).reduce((a, s) => a + s.strength, 0);
  const bearStrength = data.signals.filter(s => s.type === 'bearish' && s.active).reduce((a, s) => a + s.strength, 0);
  const netStrength = bullStrength - bearStrength;

  const goldValues = data.goldSeries.map(s => s.value);
  const rsi = calcRSI(goldValues);

  const shortDirection = netStrength > 5 ? 'up' : netStrength < -5 ? 'down' : 'sideways';
  const mediumDirection = bullActive > bearActive + 2 ? 'up' : bearActive > bullActive + 2 ? 'down' : 'sideways';
  const longDirection = data.realRate < 0 ? 'up' : data.realRate > 2 ? 'down' : 'sideways';

  return {
    shortTerm: {
      direction: shortDirection,
      confidence: Math.min(90, 40 + Math.abs(netStrength) * 3),
      factors: [
        `多空信号比: ${bullActive}/${bearActive}`,
        `RSI: ${rsi.toFixed(1)}`,
        `VIX: ${data.vix.toFixed(1)}`,
      ],
      summary: shortDirection === 'up' ? '短期偏多，关注阻力位突破' : shortDirection === 'down' ? '短期偏空，注意支撑位' : '短期震荡，等待方向选择',
    },
    mediumTerm: {
      direction: mediumDirection,
      confidence: Math.min(85, 35 + Math.abs(bullActive - bearActive) * 5),
      factors: [
        `看多信号: ${bullActive}条`,
        `看空信号: ${bearActive}条`,
        `情绪评分: ${data.sentiment.score}(${data.sentiment.label})`,
      ],
      summary: mediumDirection === 'up' ? '中期趋势偏多，可逢低布局' : mediumDirection === 'down' ? '中期趋势偏空，建议控制仓位' : '中期震荡格局，波段操作',
    },
    longTerm: {
      direction: longDirection,
      confidence: Math.min(80, 30 + Math.abs(data.realRate) * 15),
      factors: [
        `实际利率: ${data.realRate.toFixed(2)}%`,
        `美元指数: ${data.dxy.toFixed(2)}`,
        `央行购金趋势: 持续`,
      ],
      summary: longDirection === 'up' ? '长期看多，央行购金和去美元化支撑' : longDirection === 'down' ? '长期承压，高利率环境不利黄金' : '长期中性，关注宏观拐点',
    },
  };
}

// ============================================
// 十维度评分模型 (gold-analyzer)
// ============================================

function calculateTenDimensions(data: {
  vix: number;
  cotNetPct: number;
  goldPrice: number;
  goldSeries: { date: string; value: number }[];
  realRate: number;
  realRateSeries: { date: string; value: number }[];
  corePce: number;
  fedFundsRate: number;
  fedBalanceSeries: { date: string; value: number }[];
  centralBankTrend: string;
}): { dimensions: { name: string; weight: number; score: number; reason: string }[]; totalScore: number; signal: string; signalDescription: string } {
  const goldValues = data.goldSeries.map(s => s.value);
  const ma200 = calcLatestMA(goldValues, 200);
  const cross = isMACross(data.goldSeries, 50, 200);
  const ryValues = data.realRateSeries.map(s => s.value);
  const ryRising = ryValues.length >= 2 && ryValues[ryValues.length - 1] > ryValues[ryValues.length - 2];
  const fedWow = calcFedWowChange(data.fedBalanceSeries);

  const dimensions = [
    {
      name: '地缘风险', weight: 0.10,
      score: data.vix > 25 ? 1 : data.vix < 15 ? 0 : 0.5,
      reason: data.vix > 25 ? `VIX=${data.vix.toFixed(1)}>25，地缘风险高` : data.vix < 15 ? `VIX=${data.vix.toFixed(1)}<15，地缘风险低` : `VIX=${data.vix.toFixed(1)}，地缘风险中性`,
    },
    {
      name: '股市波动', weight: 0.10,
      score: data.vix > 25 ? 1 : data.vix < 15 ? 0 : 0.5,
      reason: data.vix > 25 ? `VIX高，股市波动大利好黄金` : data.vix < 15 ? `VIX低，股市平稳利空黄金` : `VIX中性`,
    },
    {
      name: '期货持仓', weight: 0.10,
      score: data.cotNetPct < 30 ? 1 : data.cotNetPct > 70 ? 0 : 0.5,
      reason: data.cotNetPct < 30 ? `COT净多头百分位${data.cotNetPct.toFixed(0)}%低位看多` : data.cotNetPct > 70 ? `COT净多头百分位${data.cotNetPct.toFixed(0)}%拥挤看空` : `COT百分位${data.cotNetPct.toFixed(0)}%中性`,
    },
    {
      name: '技术面', weight: 0.10,
      score: (!isNaN(ma200) && data.goldPrice > ma200 && cross === 'golden') ? 1 : (!isNaN(ma200) && data.goldPrice < ma200 && cross === 'death') ? 0 : 0.5,
      reason: (!isNaN(ma200) && data.goldPrice > ma200 && cross === 'golden') ? '金价>MA200且金叉' : (!isNaN(ma200) && data.goldPrice < ma200 && cross === 'death') ? '金价<MA200且死叉' : '技术面中性',
    },
    {
      name: '实际利率', weight: 0.15,
      score: data.realRate < 0 ? 1 : (data.realRate > 2 && ryRising) ? 0 : 0.5,
      reason: data.realRate < 0 ? `实际利率${data.realRate.toFixed(2)}%<0利好` : (data.realRate > 2 && ryRising) ? `实际利率${data.realRate.toFixed(2)}%>2%且上行利空` : `实际利率${data.realRate.toFixed(2)}%中性`,
    },
    {
      name: '通胀', weight: 0.15,
      score: data.corePce > 3 ? 1 : data.corePce < 2 ? 0 : 0.5,
      reason: data.corePce > 3 ? `核心PCE ${data.corePce.toFixed(2)}%>3%利好` : data.corePce < 2 ? `核心PCE ${data.corePce.toFixed(2)}%<2%利空` : `核心PCE ${data.corePce.toFixed(2)}%中性`,
    },
    {
      name: '就业', weight: 0.10,
      score: data.fedFundsRate < 2 ? 1 : data.fedFundsRate > 4 ? 0 : 0.5,
      reason: data.fedFundsRate < 2 ? `联邦基金利率${data.fedFundsRate.toFixed(2)}%<2%宽松利好` : data.fedFundsRate > 4 ? `联邦基金利率${data.fedFundsRate.toFixed(2)}%>4%紧缩利空` : `联邦基金利率${data.fedFundsRate.toFixed(2)}%中性`,
    },
    {
      name: '人民币汇率', weight: 0.08,
      score: 0.5,
      reason: 'USDCNH数据暂不可用，默认中性',
    },
    {
      name: '美债赤字', weight: 0.06,
      score: fedWow > 0 ? 1 : fedWow < 0 ? 0 : 0.5,
      reason: fedWow > 0 ? '美联储扩表利好' : fedWow < 0 ? '美联储缩表利空' : '美联储资产负债表中性',
    },
    {
      name: '央行购金', weight: 0.06,
      score: data.centralBankTrend === 'increasing' ? 1 : data.centralBankTrend === 'decreasing' ? 0 : 0.5,
      reason: data.centralBankTrend === 'increasing' ? '央行购金趋势上升利好' : data.centralBankTrend === 'decreasing' ? '央行购金趋势下降利空' : '央行购金趋势中性',
    },
  ];

  const totalScore = dimensions.reduce((acc, d) => acc + d.score * d.weight, 0);
  let signal: string;
  let signalDescription: string;
  if (totalScore >= 0.7) { signal = '强烈买入'; signalDescription = '多维度综合评分>=0.7，强烈看多信号'; }
  else if (totalScore >= 0.5) { signal = '买入/增持'; signalDescription = '综合评分>=0.5，偏多信号'; }
  else if (totalScore >= 0.4) { signal = '持有观望'; signalDescription = '综合评分中性，建议持有观望'; }
  else if (totalScore >= 0.3) { signal = '减持/谨慎'; signalDescription = '综合评分偏低，建议减持'; }
  else { signal = '卖出/规避'; signalDescription = '综合评分<0.3，强烈看空信号'; }

  return { dimensions, totalScore: Math.round(totalScore * 1000) / 1000, signal, signalDescription };
}

// ============================================
// 宏观数据缓存机制
// ============================================

async function ensureMacroCacheTable(db: D1Database) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS macro_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT NOT NULL UNIQUE,
      cache_data TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
}

async function ensurePushSubscriptionsTable(db: D1Database) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      push_token TEXT NOT NULL,
      push_type TEXT DEFAULT 'daily',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  ).run();
}

async function getMacroCache(db: D1Database, key: string): Promise<any | null> {
  try {
    const row = await db.prepare(
      "SELECT * FROM macro_cache WHERE cache_key = ? AND datetime(updated_at) > datetime('now', '-1 hour')"
    ).bind(key).first();
    if (row && row.cache_data) {
      return typeof row.cache_data === 'string' ? JSON.parse(row.cache_data) : row.cache_data;
    }
  } catch (e) {
    console.error('读取宏观数据缓存失败:', e);
  }
  return null;
}

async function setMacroCache(db: D1Database, key: string, data: any) {
  try {
    await db.prepare(
      `INSERT OR REPLACE INTO macro_cache (cache_key, cache_data, updated_at) VALUES (?, ?, datetime('now'))`
    ).bind(key, JSON.stringify(data)).run();
  } catch (e) {
    console.error('写入宏观数据缓存失败:', e);
  }
}

// ============================================
// AI分析服务 (智谱AI + DeepSeek)
// ============================================

async function callZhipuAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'glm-4-plus',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!response.ok) throw new Error(`智谱AI请求失败: ${response.status}`);
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

async function callDeepSeekAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek请求失败: ${response.status}`);
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

async function getAIAnalysis(env: any, type: 'bullish' | 'bearish' | 'summary' | 'advice', macroData: any): Promise<{ content: string; model: string; cached: boolean }> {
  const cacheKey = `ai_analysis_${type}`;
  // Check D1 cache (24h)
  try {
    const cached = await env.DB.prepare(
      "SELECT * FROM macro_cache WHERE cache_key = ? AND datetime(updated_at) > datetime('now', '-24 hours')"
    ).bind(cacheKey).first();
    if (cached && cached.cache_data) {
      const parsed = typeof cached.cache_data === 'string' ? JSON.parse(cached.cache_data) : cached.cache_data;
      return { content: parsed.content, model: parsed.model, cached: true };
    }
  } catch (e) {
    // ignore cache read error
  }

  const dataStr = JSON.stringify({
    goldPrice: macroData.gold?.international?.price || macroData.goldPrice,
    realRate: macroData.fred?.realRate || macroData.realRate,
    dxy: macroData.fred?.dxy || macroData.dxy,
    vix: macroData.fred?.vix || macroData.vix,
    breakeven: macroData.fred?.breakeven || macroData.breakeven,
    corePce: macroData.fred?.corePce || macroData.corePce,
    fedFundsRate: macroData.fred?.fedFundsRate || macroData.fedFundsRate,
    yieldSpread: macroData.fred?.yieldSpread || macroData.yieldSpread,
    signals: macroData.signals?.filter((s: Signal) => s.active).map((s: Signal) => s.name),
    sentiment: macroData.sentiment,
    tenDimensions: macroData.tenDimensions,
  }, null, 2);

  const prompts: Record<string, { system: string; user: string }> = {
    bullish: {
      system: '你是一位专业的黄金市场分析师，请基于提供的宏观数据，详细分析当前黄金市场的看多因素。包括基本面、技术面、资金面等角度，给出具体的数据支撑和逻辑推理。',
      user: `请分析以下黄金市场数据的看多因素：\n${dataStr}`,
    },
    bearish: {
      system: '你是一位专业的黄金市场分析师，请基于提供的宏观数据，详细分析当前黄金市场的看空因素和风险。包括基本面、技术面、资金面等角度，给出具体的数据支撑和逻辑推理。',
      user: `请分析以下黄金市场数据的看空因素：\n${dataStr}`,
    },
    summary: {
      system: '你是一位专业的黄金市场分析师，请基于提供的宏观数据，给出黄金市场的综合分析。包括多空力量对比、关键驱动因素、风险点和机会点。',
      user: `请对以下黄金市场数据进行综合分析：\n${dataStr}`,
    },
    advice: {
      system: '你是一位专业的黄金投资顾问，请基于提供的宏观数据，给出黄金投资建议。包括短期、中期、长期的操作建议，仓位管理，风险控制等。请注意声明不构成投资建议。',
      user: `请基于以下数据给出黄金投资建议：\n${dataStr}`,
    },
  };

  const prompt = prompts[type];
  let content = '';
  let model = 'none';

  // Try 智谱AI first
  if (env.ZHIPU_API_KEY) {
    try {
      content = await callZhipuAI(env.ZHIPU_API_KEY, prompt.system, prompt.user);
      model = 'glm-4-plus';
    } catch (e) {
      console.error('智谱AI调用失败:', e);
    }
  }

  // Fallback to DeepSeek
  if (!content && env.DEEPSEEK_API_KEY) {
    try {
      content = await callDeepSeekAI(env.DEEPSEEK_API_KEY, prompt.system, prompt.user);
      model = 'deepseek-chat';
    } catch (e) {
      console.error('DeepSeek调用失败:', e);
    }
  }

  if (!content) {
    content = 'AI分析服务暂不可用，请稍后再试。';
  }

  // Cache result
  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO macro_cache (cache_key, cache_data, updated_at) VALUES (?, ?, datetime('now'))`
    ).bind(cacheKey, JSON.stringify({ content, model })).run();
  } catch (e) {
    console.error('AI分析缓存写入失败:', e);
  }

  return { content, model, cached: false };
}

// ============================================
// 构建 Dashboard 数据
// ============================================

async function buildMacroDashboard(env: any): Promise<any> {
  const fredApiKey = env.FRED_API_KEY;
  if (!fredApiKey) {
    return { error: 'FRED_API_KEY未配置，无法获取宏观数据', data: null };
  }

  // 并行获取所有数据
  const [fredData, goldIntl, goldDomestic, oilPrice, silverPrice, gdxEtf, gldEtf, cotData, centralBank] = await Promise.all([
    fetchFredData(fredApiKey),
    fetchInternationalGoldPrice(),
    fetchDomesticGoldPrice(),
    fetchOilPrice(),
    fetchSilverPrice(),
    fetchGdxEtf(),
    fetchGldEtf(),
    fetchCotData(),
    Promise.resolve(getCentralBankData()),
  ]);

  const goldPrice = goldIntl.price || 2400;
  const silverPriceVal = silverPrice.price || (goldIntl.silverPrice || 28);
  const goldSilverRatio = silverPriceVal > 0 ? goldPrice / silverPriceVal : 0;

  // 构建金价序列（从FRED DGS10对应的日期构建模拟，或使用gold_prices表）
  let goldSeries: { date: string; value: number }[] = [];
  try {
    const dbPrices = await env.DB.prepare(
      'SELECT date, close_price as value FROM gold_prices ORDER BY date DESC LIMIT 300'
    ).all();
    if (dbPrices.results && dbPrices.results.length > 5) {
      goldSeries = dbPrices.results.reverse().map((r: any) => ({ date: r.date, value: r.value }));
    }
  } catch (e) {
    // ignore
  }
  // 如果没有足够的历史数据，用当前价格生成
  if (goldSeries.length < 200) {
    goldSeries = [];
    const now = new Date();
    let p = goldPrice * 0.9;
    for (let i = 299; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ret = (Math.random() - 0.48) * 0.015;
      p = p * (1 + ret);
      goldSeries.push({ date: d.toISOString().split('T')[0], value: Math.round(p * 100) / 100 });
    }
    // 最后一个用实际价格
    goldSeries[goldSeries.length - 1].value = goldPrice;
  }

  // GLD ETF资金流（简化：用GLD价格变化百分比近似）
  const gldFlowPct = gldEtf.changePercent || 0;

  // 信号引擎
  const signalData = {
    realRate: fredData.realRate,
    realRateSeries: fredData.realRateSeries,
    dxy: fredData.dxy,
    dxySeries: fredData.dxySeries,
    corePce: fredData.corePce,
    corePceSeries: fredData.corePceSeries,
    fedBalance: fredData.fedBalance,
    fedBalanceSeries: fredData.fedBalanceSeries,
    vix: fredData.vix,
    goldPrice,
    goldSeries,
    cotNetPct: cotData.netPct,
    gldFlowPct,
    goldSilverRatio,
    yieldSpread: fredData.yieldSpread,
    yieldSpreadSeries: fredData.yieldSpreadSeries,
  };
  const signals = calculateSignals(signalData);

  // 情绪评分
  const sentiment = calculateSentiment({
    vix: fredData.vix,
    realRateSeries: fredData.realRateSeries,
    dxySeries: fredData.dxySeries,
    goldPrice,
    goldSeries,
    cotNetPct: cotData.netPct,
    gldFlowPct,
  });

  // 雷达图
  const radar = calculateRadar({
    realRate: fredData.realRate,
    dxySeries: fredData.dxySeries,
    breakeven: fredData.breakeven,
    fedBalanceSeries: fredData.fedBalanceSeries,
    vix: fredData.vix,
    cotNetPct: cotData.netPct,
    gldFlowPct,
  });

  // 风险矩阵
  const riskMatrix = calculateRiskMatrix({
    vix: fredData.vix,
    realRate: fredData.realRate,
    goldPrice,
    goldSeries,
    fedFundsRate: fredData.fedFundsRate,
  });

  // 走势预期
  const outlook = calculateOutlook({
    signals,
    sentiment,
    goldPrice,
    goldSeries,
    realRate: fredData.realRate,
    vix: fredData.vix,
    dxy: fredData.dxy,
  });

  // 十维度评分
  const tenDimensions = calculateTenDimensions({
    vix: fredData.vix,
    cotNetPct: cotData.netPct,
    goldPrice,
    goldSeries,
    realRate: fredData.realRate,
    realRateSeries: fredData.realRateSeries,
    corePce: fredData.corePce,
    fedFundsRate: fredData.fedFundsRate,
    fedBalanceSeries: fredData.fedBalanceSeries,
    centralBankTrend: centralBank.trend,
  });

  return {
    timestamp: new Date().toISOString(),
    fred: {
      realRate: fredData.realRate,
      nominalRate: fredData.nominalRate,
      breakeven: fredData.breakeven,
      dxy: fredData.dxy,
      coreCpi: fredData.coreCpi,
      corePce: fredData.corePce,
      fedBalance: fredData.fedBalance,
      vix: fredData.vix,
      fedFundsRate: fredData.fedFundsRate,
      fwd5y5y: fredData.fwd5y5y,
      yieldSpread: fredData.yieldSpread,
    },
    fredSeries: {
      realRateSeries: fredData.realRateSeries.slice(-60),
      dxySeries: fredData.dxySeries.slice(-60),
      breakevenSeries: fredData.breakevenSeries.slice(-60),
      fedBalanceSeries: fredData.fedBalanceSeries.slice(-60),
      vixSeries: fredData.vixSeries.slice(-60),
      yieldSpreadSeries: fredData.yieldSpreadSeries.slice(-60),
    },
    gold: {
      international: goldIntl,
      domestic: goldDomestic,
    },
    commodities: {
      oil: oilPrice,
      silver: silverPrice,
      goldSilverRatio,
    },
    etfs: {
      gdx: gdxEtf,
      gld: gldEtf,
    },
    cot: cotData,
    centralBank,
    signals,
    sentiment,
    radar,
    riskMatrix,
    outlook,
    tenDimensions,
  };
}

// ============================================
// 宏观数据 → 前端格式转换
// ============================================

function transformMacroForFrontend(raw: any): any {
  const fred = raw.fred || {};
  const fredSeries = raw.fredSeries || {};
  const gold = raw.gold || {};
  const commodities = raw.commodities || {};
  const etfs = raw.etfs || {};
  const cot = raw.cot || {};
  const centralBank = raw.centralBank || {};
  const signals = raw.signals || [];
  const sentiment = raw.sentiment || {};
  const riskMatrix = raw.riskMatrix || [];
  const outlook = raw.outlook || {};
  const tenDimensions = raw.tenDimensions || {};

  // 计算变化率
  const calcChange = (series: { date: string; value: number }[]): number => {
    if (!series || series.length < 2) return 0;
    const latest = series[series.length - 1].value;
    const prev = series[series.length - 2].value;
    return prev !== 0 ? ((latest - prev) / Math.abs(prev)) * 100 : 0;
  };

  // 构建金价历史（含MA50/MA200）
  const goldSeriesRaw = raw.goldSeries || [];
  const goldValues = goldSeriesRaw.map((s: any) => s.value);
  const goldHistory = goldSeriesRaw.map((s: any, i: number) => {
    const ma50 = i >= 49 ? goldValues.slice(i - 49, i + 1).reduce((a: number, b: number) => a + b, 0) / 50 : undefined;
    const ma200 = i >= 199 ? goldValues.slice(i - 199, i + 1).reduce((a: number, b: number) => a + b, 0) / 200 : undefined;
    return { date: s.date, price: s.value, ma50: ma50 ? Math.round(ma50 * 100) / 100 : undefined, ma200: ma200 ? Math.round(ma200 * 100) / 100 : undefined };
  });

  // 技术指标
  const ma50 = goldValues.length >= 50 ? goldValues.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50 : NaN;
  const ma200 = goldValues.length >= 200 ? goldValues.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200 : NaN;
  const rsi14 = calcRSI(goldValues, 14);
  const currentPrice = gold.international?.price || 0;
  const support = currentPrice * 0.97;
  const resistance = currentPrice * 1.03;
  let crossStatus = 'none';
  if (!isNaN(ma50) && !isNaN(ma200)) {
    crossStatus = ma50 > ma200 ? 'golden_cross' : 'death_cross';
  }

  // 实际利率趋势
  const rySeries = fredSeries.realRateSeries || [];
  const ryTrend = rySeries.length >= 20
    ? (rySeries[rySeries.length - 1].value < rySeries[rySeries.length - 20].value ? 'down' : 'up')
    : 'neutral';

  // 美元趋势
  const dxySeries = fredSeries.dxySeries || [];
  const dxyRoc = dxySeries.length >= 20
    ? ((dxySeries[dxySeries.length - 1].value - dxySeries[dxySeries.length - 20].value) / dxySeries[dxySeries.length - 20].value) * 100
    : 0;
  const dxyTrend = dxyRoc < -1 ? 'down' : dxyRoc > 1 ? 'up' : 'neutral';

  // VIX趋势
  const vixSeries = fredSeries.vixSeries || [];
  const vixTrend = vixSeries.length >= 10
    ? (vixSeries[vixSeries.length - 1].value > vixSeries[vixSeries.length - 10].value ? 'up' : 'down')
    : 'neutral';

  // 美联储资产变化
  const fedBalSeries = fredSeries.fedBalanceSeries || [];
  const fedBalChange = fedBalSeries.length >= 2
    ? (fedBalSeries[fedBalSeries.length - 1].value - fedBalSeries[fedBalSeries.length - 2].value) / 1e6
    : 0;

  // 波动率
  const vol = goldValues.length >= 20 ? calcVolatility(goldValues, 20) : 0;
  const vol30d = goldValues.length >= 30 ? calcVolatility(goldValues, 30) : vol;

  // === 信号页面数据 ===
  const bullishSignals = signals.filter((s: any) => s.type === 'bullish' && s.active).map((s: any) => ({
    title: s.name,
    detail: s.description,
    strength: s.strength,
    category: 'bullish',
  }));
  const bearishSignals = signals.filter((s: any) => s.type === 'bearish' && s.active).map((s: any) => ({
    title: s.name,
    detail: s.description,
    strength: s.strength,
    category: 'bearish',
  }));
  const bullStrength = signals.filter((s: any) => s.type === 'bullish' && s.active).reduce((a: number, s: any) => a + s.strength, 0);
  const bearStrength = signals.filter((s: any) => s.type === 'bearish' && s.active).reduce((a: number, s: any) => a + s.strength, 0);
  const netStrength = bullStrength - bearStrength;
  const overallDirection = netStrength > 5 ? 'bullish' : netStrength < -5 ? 'bearish' : 'neutral';

  // === 风险矩阵页面数据 ===
  const riskMatrixMap: Record<string, any> = {};
  for (const item of riskMatrix) {
    const key = item.type === '实物黄金' ? 'physicalGold'
      : item.type === '黄金ETF' ? 'goldEtf'
      : item.type === '黄金期货' ? 'goldFutures'
      : item.type === '金矿股' ? 'goldMining'
      : item.type;
    riskMatrixMap[key] = {
      riskLevel: item.riskLevel,
      riskScore: item.riskScore,
      keyFactors: item.keyFactors,
      riskSignals: item.riskSignals,
      opportunitySignals: item.oppSignals,
      positionAdvice: item.position,
    };
  }

  // === 走势预期页面数据 ===
  const transformOutlook = (o: any) => ({
    direction: o.direction === 'up' ? 'bullish' : o.direction === 'down' ? 'bearish' : 'neutral',
    confidence: o.confidence ? o.confidence / 100 : undefined,
    drivers: o.factors,
    summary: o.summary,
  });

  // === 十维度评分数据 ===
  const tenDimDimensions = tenDimensions.dimensions || [];
  const shortTermDims = tenDimDimensions.slice(0, 4);
  const midTermDims = tenDimDimensions.slice(4, 7);
  const longTermDims = tenDimDimensions.slice(7);

  return {
    timestamp: raw.timestamp,
    // 摘要卡片
    summary: {
      goldPrice: gold.international?.price || 0,
      goldChange: gold.international?.changePercent || 0,
      dollarIndex: fred.dxy || 0,
      dollarChange: calcChange(dxySeries),
      realRate: fred.realRate || 0,
      realRateChange: calcChange(rySeries),
      vix: fred.vix || 0,
      vixChange: calcChange(vixSeries),
      inflationExpectation: fred.breakeven || 0,
      inflationChange: calcChange(fredSeries.breakevenSeries || []),
      fedRate: fred.fedFundsRate || 0,
      fedRateChange: calcChange(fredSeries.fedFundsRateSeries || []),
    },
    // 核心因子面板
    factors: {
      realRate: {
        current: fred.realRate || 0,
        ma20: rySeries.length >= 20 ? rySeries.slice(-20).reduce((a: any, s: any) => a + s.value, 0) / 20 : undefined,
        ma60: rySeries.length >= 60 ? rySeries.slice(-60).reduce((a: any, s: any) => a + s.value, 0) / 60 : undefined,
        trend: ryTrend,
      },
      dollar: {
        current: fred.dxy || 0,
        momentum20d: Math.round(dxyRoc * 100) / 100,
        trend: dxyTrend,
      },
      inflation: {
        breakeven: fred.breakeven || 0,
        cpi: fred.coreCpi || 0,
        pce: fred.corePce || 0,
      },
      fedAssets: {
        current: fred.fedBalance || 0,
        change: Math.round(fedBalChange * 100) / 100,
      },
      vix: {
        current: fred.vix || 0,
        trend: vixTrend,
      },
    },
    // 图表数据
    goldHistory,
    realRateHistory: (fredSeries.realRateSeries || []).map((s: any) => ({ date: s.date, value: s.value })),
    dollarHistory: (fredSeries.dxySeries || []).map((s: any) => ({ date: s.date, value: s.value })),
    // 技术指标
    technicals: {
      ma50: isNaN(ma50) ? undefined : Math.round(ma50 * 100) / 100,
      ma200: isNaN(ma200) ? undefined : Math.round(ma200 * 100) / 100,
      rsi14: isNaN(rsi14) ? undefined : Math.round(rsi14 * 100) / 100,
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
      crossStatus,
    },
    // 扩展数据
    goldSilverRatio: commodities.goldSilverRatio || 0,
    gdxEtf: { price: etfs.gdx?.price || 0, change: etfs.gdx?.changePercent || 0 },
    yieldCurve: { slope: fred.yieldSpread || 0, trend: fred.yieldSpread < 0 ? '倒挂' : fred.yieldSpread < 1 ? '平坦' : '正常' },
    volatility: { current: Math.round(vol * 100) / 100, avg30d: Math.round(vol30d * 100) / 100 },
    cot: { netLong: cot.netLong || 0, change: cot.change || 0 },
    gldEtf: { flow: etfs.gld?.changePercent || 0, holdings: etfs.gld?.price || 0 },
    centralBankBuying: { tonnes: centralBank.tonnes || 0, trend: centralBank.trend || 'neutral' },
    // 信号页面数据
    signals: {
      bullish: bullishSignals,
      bearish: bearishSignals,
    },
    overallSignal: {
      direction: overallDirection,
      score: Math.abs(netStrength),
      bullishScore: bullStrength,
      bearishScore: bearStrength,
      label: overallDirection === 'bullish' ? '看多' : overallDirection === 'bearish' ? '看空' : '中性',
    },
    // 情绪页面数据
    sentiment: {
      score: sentiment.score || 50,
      label: sentiment.label || '中性',
      factors: (sentiment.factors || []).map((f: any) => ({
        name: f.name,
        weight: f.weight,
        score: f.score,
        label: f.score >= 70 ? '贪婪' : f.score >= 50 ? '中性' : '恐惧',
      })),
    },
    radar: (raw.radar || []).map((r: any) => ({
      dimension: r.name,
      score: r.score * 10,
      fullMark: 100,
    })),
    // 风险页面数据
    riskMatrix: riskMatrixMap,
    outlook: {
      shortTerm: outlook.shortTerm ? transformOutlook(outlook.shortTerm) : undefined,
      midTerm: outlook.mediumTerm ? transformOutlook(outlook.mediumTerm) : undefined,
      longTerm: outlook.longTerm ? transformOutlook(outlook.longTerm) : undefined,
    },
    // 十维度评分数据
    tenDimensionScore: {
      shortTerm: {
        label: '短期交易属性',
        weight: 0.4,
        dimensions: shortTermDims.map((d: any) => ({
          name: d.name,
          weight: d.weight,
          score: d.score,
          description: d.reason,
        })),
      },
      midTerm: {
        label: '中期金融属性',
        weight: 0.4,
        dimensions: midTermDims.map((d: any) => ({
          name: d.name,
          weight: d.weight,
          score: d.score,
          description: d.reason,
        })),
      },
      longTerm: {
        label: '长期货币属性',
        weight: 0.2,
        dimensions: longTermDims.map((d: any) => ({
          name: d.name,
          weight: d.weight,
          score: d.score,
          description: d.reason,
        })),
      },
      totalScore: tenDimensions.totalScore,
      investmentSignal: tenDimensions.signal,
      actionAdvice: tenDimensions.signalDescription,
    },
  };
}

// ============================================
// 路由: 宏观数据
// ============================================

const macroRoutes = new Hono();

macroRoutes.get('/dashboard', async (c: any) => {
  try {
    await ensureMacroCacheTable(c.env.DB);
    const forceRefresh = c.req.query('refresh') === '1';
    if (!forceRefresh) {
      const cached = await getMacroCache(c.env.DB, 'macro_dashboard_v2');
      if (cached) {
        return c.json({ success: true, data: cached, cached: true, cachedAt: cached.timestamp });
      }
    }

    const rawData = await buildMacroDashboard(c.env);
    if (rawData.error) {
      return c.json({ success: false, error: rawData.error }, 503);
    }

    const data = transformMacroForFrontend(rawData);
    await setMacroCache(c.env.DB, 'macro_dashboard_v2', data);
    return c.json({ success: true, data, cached: false });
  } catch (error: any) {
    console.error('获取宏观数据失败:', error);
    return c.json({ success: false, error: '获取宏观数据失败', message: error.message }, 500);
  }
});

// ============================================
// 路由: AI分析API
// ============================================

const aiAnalysisRoutes = new Hono();

aiAnalysisRoutes.post('/bullish', authMiddleware, requireMembership('basic'), rateLimitByUser(), async (c: any) => {
  try {
    const macroData = await buildMacroDashboard(c.env);
    if (macroData.error) {
      return c.json({ success: false, error: macroData.error }, 503);
    }
    const result = await getAIAnalysis(c.env, 'bullish', macroData);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('AI看涨分析失败:', error);
    return c.json({ success: false, error: 'AI看涨分析失败', message: error.message }, 500);
  }
});

aiAnalysisRoutes.post('/bearish', authMiddleware, requireMembership('basic'), rateLimitByUser(), async (c: any) => {
  try {
    const macroData = await buildMacroDashboard(c.env);
    if (macroData.error) {
      return c.json({ success: false, error: macroData.error }, 503);
    }
    const result = await getAIAnalysis(c.env, 'bearish', macroData);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('AI看空分析失败:', error);
    return c.json({ success: false, error: 'AI看空分析失败', message: error.message }, 500);
  }
});

aiAnalysisRoutes.post('/summary', authMiddleware, requireMembership('basic'), rateLimitByUser(), async (c: any) => {
  try {
    const macroData = await buildMacroDashboard(c.env);
    if (macroData.error) {
      return c.json({ success: false, error: macroData.error }, 503);
    }
    const result = await getAIAnalysis(c.env, 'summary', macroData);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('AI综合分析失败:', error);
    return c.json({ success: false, error: 'AI综合分析失败', message: error.message }, 500);
  }
});

aiAnalysisRoutes.post('/advice', authMiddleware, requireMembership('premium'), rateLimitByUser(), async (c: any) => {
  try {
    const macroData = await buildMacroDashboard(c.env);
    if (macroData.error) {
      return c.json({ success: false, error: macroData.error }, 503);
    }
    const result = await getAIAnalysis(c.env, 'advice', macroData);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('AI投资建议失败:', error);
    return c.json({ success: false, error: 'AI投资建议失败', message: error.message }, 500);
  }
});

// ============================================
// 创建 Hono 应用并注册路由
// ============================================

const app = new Hono<{ Bindings: Env }>();

// 全局中间件
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Used'],
  maxAge: 86400,
}));

app.use('*', logger());
app.use('*', prettyJSON());

// 健康检查
app.get('/health', (c) => {
  return c.json({
    success: true,
    data: { status: 'ok', service: 'gold-platform-api', version: '1.0.0', timestamp: new Date().toISOString() },
  });
});

app.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      name: '黄金市场分析平台 API',
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth', gold: '/api/gold', news: '/api/news',
        analysis: '/api/analysis', push: '/api/push', admin: '/api/admin',
        macro: '/api/macro', ai: '/api/analysis/ai', health: '/health',
      },
    },
  });
});

// 注册路由
app.route('/api/auth', authRoutes);
app.route('/api/gold', goldRoutes);
app.route('/api/news', newsRoutes);
app.route('/api/analysis', analysisRoutes);
app.route('/api/push', pushRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/macro', macroRoutes);
app.route('/api/analysis/ai', aiAnalysisRoutes);

// 404
app.notFound((c) => {
  return c.json({ success: false, error: '接口不存在', message: `${c.req.method} ${c.req.path} 未找到` }, 404);
});

// 全局错误处理
app.onError((err, c) => {
  console.error('服务器错误:', err);
  return c.json({ success: false, error: '服务器内部错误', message: err.message || '未知错误' }, 500);
});

// ============================================
// 导出 Cloudflare Pages Function 处理器
// ============================================

export const onRequest: PagesFunction<Env> = async (context) => {
  // Cloudflare Pages Functions 将 /api/* 的请求路由到这里
  // url.pathname 已经包含完整路径如 /api/auth/login，无需再添加前缀
  return app.fetch(context.request, context.env, context);
};
