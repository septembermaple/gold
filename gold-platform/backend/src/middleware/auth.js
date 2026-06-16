/**
 * 认证与授权中间件
 * 用于 Hono 框架
 */

import { verifyToken } from '../utils/auth.js';

/**
 * 会员等级权重映射，用于比较等级高低
 */
const MEMBERSHIP_LEVELS = {
  free: 0,
  basic: 1,
  premium: 2,
  vip: 3,
};

/**
 * JWT 认证中间件
 * 从 Authorization header 提取并验证 JWT token
 * 将用户信息附加到 c.set('user', user)
 */
export const authMiddleware = async (c, next) => {
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

    // 从数据库获取最新用户信息
    const user = await c.env.DB.prepare(
      'SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status FROM users WHERE id = ?'
    )
      .bind(payload.userId)
      .first();

    if (!user) {
      return c.json(
        { success: false, error: '用户不存在', message: '该用户已被删除' },
        401
      );
    }

    if (user.status === 'disabled') {
      return c.json(
        { success: false, error: '账号已被禁用', message: '请联系管理员' },
        403
      );
    }

    // 检查会员是否过期
    if (user.membership_expire_at && new Date(user.membership_expire_at) < new Date()) {
      await c.env.DB.prepare(
        "UPDATE users SET membership_level = 'free', updated_at = datetime('now') WHERE id = ?"
      )
        .bind(user.id)
        .run();
      user.membership_level = 'free';
    }

    c.set('user', user);
    await next();
  } catch (error) {
    return c.json(
      { success: false, error: '认证失败', message: error.message },
      401
    );
  }
};

/**
 * 可选认证中间件
 * 如果提供了 token 则验证，否则继续执行（user 为 null）
 */
export const optionalAuth = async (c, next) => {
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
          )
            .bind(payload.userId)
            .first();

          if (user && user.status === 'active') {
            if (user.membership_expire_at && new Date(user.membership_expire_at) < new Date()) {
              await c.env.DB.prepare(
                "UPDATE users SET membership_level = 'free', updated_at = datetime('now') WHERE id = ?"
              )
                .bind(user.id)
                .run();
              user.membership_level = 'free';
            }
            c.set('user', user);
          }
        }
      }
    }
  } catch (e) {
    // 可选认证失败不阻断请求
  }
  await next();
};

/**
 * 管理员权限中间件
 * 必须在 authMiddleware 之后使用
 */
export const requireAdmin = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      { success: false, error: '未认证', message: '请先登录' },
      401
    );
  }

  if (user.role !== 'admin') {
    return c.json(
      { success: false, error: '权限不足', message: '需要管理员权限' },
      403
    );
  }

  await next();
};

/**
 * 会员等级检查中间件工厂函数
 * @param {string} requiredLevel - 要求的最低会员等级 (free/basic/premium/vip)
 * @returns {Function} Hono 中间件
 */
export const requireMembership = (requiredLevel) => {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json(
        { success: false, error: '未认证', message: '请先登录' },
        401
      );
    }

    const userLevel = MEMBERSHIP_LEVELS[user.membership_level] ?? 0;
    const required = MEMBERSHIP_LEVELS[requiredLevel] ?? 0;

    if (userLevel < required) {
      return c.json(
        {
          success: false,
          error: '会员等级不足',
          message: `当前等级: ${user.membership_level}，需要: ${requiredLevel} 及以上`,
          data: {
            currentLevel: user.membership_level,
            requiredLevel,
          },
        },
        403
      );
    }

    await next();
  };
};

/**
 * 权限检查中间件工厂函数
 * @param {string} code - 权限代码
 * @returns {Function} Hono 中间件
 */
export const requirePermission = (code) => {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json(
        { success: false, error: '未认证', message: '请先登录' },
        401
      );
    }

    // 管理员拥有所有权限
    if (user.role === 'admin') {
      await next();
      return;
    }

    // 检查用户角色是否拥有该权限
    const permission = await c.env.DB.prepare(
      `SELECT p.id FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role = ? AND p.code = ?`
    )
      .bind(user.role, code)
      .first();

    if (!permission) {
      return c.json(
        { success: false, error: '权限不足', message: `缺少权限: ${code}` },
        403
      );
    }

    await next();
  };
};

/**
 * 用户级 API 速率限制中间件
 * 使用 D1 数据库记录每个用户每天的 API 调用次数
 * @param {number} maxCalls - 每天最大调用次数（默认从会员等级配置读取）
 * @returns {Function} Hono 中间件
 */
export const rateLimitByUser = (maxCalls = null) => {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      await next();
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // 获取用户会员等级对应的最大调用次数
    let limit = maxCalls;
    if (!limit) {
      const membership = await c.env.DB.prepare(
        'SELECT max_api_calls_per_day FROM membership_levels WHERE code = ?'
      )
        .bind(user.membership_level)
        .first();

      limit = membership ? membership.max_api_calls_per_day : 100;
    }

    // 统计今天的调用次数
    const usage = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM api_usage_logs
       WHERE user_id = ? AND date(created_at) = ?`
    )
      .bind(user.id, today)
      .first();

    const currentCount = usage ? usage.count : 0;

    if (currentCount >= limit) {
      return c.json(
        {
          success: false,
          error: 'API调用次数超限',
          message: `今日已调用 ${currentCount} 次，上限为 ${limit} 次`,
          data: {
            current: currentCount,
            limit,
            remaining: 0,
          },
        },
        429
      );
    }

    // 设置速率限制信息到响应头
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(limit - currentCount - 1));
    c.header('X-RateLimit-Used', String(currentCount));

    await next();

    // 记录 API 调用（异步，不阻塞响应）
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        "INSERT INTO api_usage_logs (user_id, endpoint, method, status_code, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
      )
        .bind(user.id, c.req.path, c.req.method, c.res?.status || 200)
        .run()
    );
  };
};
