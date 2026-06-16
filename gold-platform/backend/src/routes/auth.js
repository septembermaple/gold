/**
 * 认证路由
 * 用户注册、登录、个人信息管理
 */

import { Hono } from 'hono';
import { generateToken, hashPassword, verifyPassword } from '../utils/auth.js';
import { authMiddleware } from '../middleware/auth.js';

const auth = new Hono();

/**
 * POST /api/auth/register - 用户注册
 */
auth.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { email, username, password } = body;

    // 参数验证
    if (!email || !username || !password) {
      return c.json(
        { success: false, error: '参数不完整', message: '请提供 email、username 和 password' },
        400
      );
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json(
        { success: false, error: '邮箱格式不正确', message: '请提供有效的邮箱地址' },
        400
      );
    }

    // 用户名验证
    if (username.length < 2 || username.length > 20) {
      return c.json(
        { success: false, error: '用户名长度不正确', message: '用户名长度应为2-20个字符' },
        400
      );
    }

    // 密码强度验证
    if (password.length < 6) {
      return c.json(
        { success: false, error: '密码太短', message: '密码长度至少6个字符' },
        400
      );
    }

    // 检查邮箱是否已注册
    const existingEmail = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingEmail) {
      return c.json(
        { success: false, error: '邮箱已注册', message: '该邮箱已被使用' },
        409
      );
    }

    // 检查用户名是否已存在
    const existingUsername = await c.env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first();

    if (existingUsername) {
      return c.json(
        { success: false, error: '用户名已存在', message: '该用户名已被使用' },
        409
      );
    }

    // 哈希密码
    const passwordHash = await hashPassword(password);

    // 创建用户
    const result = await c.env.DB.prepare(
      `INSERT INTO users (email, username, password_hash, avatar, role, membership_level, status, created_at, updated_at)
       VALUES (?, ?, ?, '', 'user', 'free', 'active', datetime('now'), datetime('now'))`
    )
      .bind(email, username, passwordHash)
      .run();

    const userId = result.meta.last_row_id;

    // 生成 JWT
    const secret = c.env.JWT_SECRET || 'change-this-in-production';
    const token = await generateToken(
      { userId, email, username, role: 'user' },
      secret,
      '7d'
    );

    return c.json({
      success: true,
      data: {
        user: {
          id: userId,
          email,
          username,
          role: 'user',
          membership_level: 'free',
        },
        token,
      },
      message: '注册成功',
    }, 201);
  } catch (error) {
    console.error('注册失败:', error);
    return c.json(
      { success: false, error: '注册失败', message: error.message },
      500
    );
  }
});

/**
 * POST /api/auth/login - 用户登录
 */
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, username, password } = body;

    const account = email || username;

    if (!account || !password) {
      return c.json(
        { success: false, error: '参数不完整', message: '请提供 email/username 和 password' },
        400
      );
    }

    // 查找用户（支持邮箱或用户名登录）
    const user = await c.env.DB.prepare(
      'SELECT id, email, username, password_hash, avatar, role, membership_level, membership_expire_at, status FROM users WHERE email = ? OR username = ?'
    )
      .bind(account, account)
      .first();

    if (!user) {
      return c.json(
        { success: false, error: '账号不存在', message: '请检查邮箱/用户名是否正确' },
        401
      );
    }

    // 检查账号状态
    if (user.status === 'disabled') {
      return c.json(
        { success: false, error: '账号已被禁用', message: '请联系管理员' },
        403
      );
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json(
        { success: false, error: '密码错误', message: '请检查密码是否正确' },
        401
      );
    }

    // 检查会员是否过期
    let membershipLevel = user.membership_level;
    if (user.membership_expire_at && new Date(user.membership_expire_at) < new Date()) {
      await c.env.DB.prepare(
        "UPDATE users SET membership_level = 'free', updated_at = datetime('now') WHERE id = ?"
      )
        .bind(user.id)
        .run();
      membershipLevel = 'free';
    }

    // 生成 JWT
    const secret = c.env.JWT_SECRET || 'change-this-in-production';
    const token = await generateToken(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      secret,
      '7d'
    );

    // 更新最后登录时间
    await c.env.DB.prepare(
      "UPDATE users SET updated_at = datetime('now') WHERE id = ?"
    )
      .bind(user.id)
      .run();

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatar: user.avatar,
          role: user.role,
          membership_level: membershipLevel,
          membership_expire_at: user.membership_expire_at,
        },
        token,
      },
      message: '登录成功',
    });
  } catch (error) {
    console.error('登录失败:', error);
    return c.json(
      { success: false, error: '登录失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/auth/me - 获取当前用户信息
 */
auth.get('/me', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    return c.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        membership_level: user.membership_level,
        membership_expire_at: user.membership_expire_at,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return c.json(
      { success: false, error: '获取用户信息失败', message: error.message },
      500
    );
  }
});

/**
 * PUT /api/auth/profile - 更新用户资料
 */
auth.put('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { username, avatar } = body;

    const updates = [];
    const params = [];

    if (username !== undefined) {
      // 检查用户名是否已被占用
      if (username !== user.username) {
        const existing = await c.env.DB.prepare(
          'SELECT id FROM users WHERE username = ? AND id != ?'
        )
          .bind(username, user.id)
          .first();

        if (existing) {
          return c.json(
            { success: false, error: '用户名已存在', message: '该用户名已被其他用户使用' },
            409
          );
        }
      }

      if (username.length < 2 || username.length > 20) {
        return c.json(
          { success: false, error: '用户名长度不正确', message: '用户名长度应为2-20个字符' },
          400
        );
      }

      updates.push('username = ?');
      params.push(username);
    }

    if (avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(avatar);
    }

    if (updates.length === 0) {
      return c.json(
        { success: false, error: '没有更新内容', message: '请提供要更新的字段' },
        400
      );
    }

    updates.push("updated_at = datetime('now')");
    params.push(user.id);

    await c.env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run();

    // 获取更新后的用户信息
    const updatedUser = await c.env.DB.prepare(
      'SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status FROM users WHERE id = ?'
    )
      .bind(user.id)
      .first();

    return c.json({
      success: true,
      data: updatedUser,
      message: '资料更新成功',
    });
  } catch (error) {
    console.error('更新资料失败:', error);
    return c.json(
      { success: false, error: '更新资料失败', message: error.message },
      500
    );
  }
});

/**
 * PUT /api/auth/password - 修改密码
 */
auth.put('/password', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return c.json(
        { success: false, error: '参数不完整', message: '请提供旧密码和新密码' },
        400
      );
    }

    if (newPassword.length < 6) {
      return c.json(
        { success: false, error: '新密码太短', message: '密码长度至少6个字符' },
        400
      );
    }

    // 获取当前密码哈希
    const userRecord = await c.env.DB.prepare(
      'SELECT password_hash FROM users WHERE id = ?'
    )
      .bind(user.id)
      .first();

    // 验证旧密码
    const isValid = await verifyPassword(oldPassword, userRecord.password_hash);
    if (!isValid) {
      return c.json(
        { success: false, error: '旧密码错误', message: '请检查旧密码是否正确' },
        401
      );
    }

    // 哈希新密码
    const newPasswordHash = await hashPassword(newPassword);

    // 更新密码
    await c.env.DB.prepare(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    )
      .bind(newPasswordHash, user.id)
      .run();

    return c.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    return c.json(
      { success: false, error: '修改密码失败', message: error.message },
      500
    );
  }
});

export default auth;
