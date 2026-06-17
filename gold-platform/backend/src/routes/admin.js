/**
 * 管理后台路由
 * 用户管理、会员管理、权限管理、系统管理
 */

import { Hono } from 'hono';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { hashPassword } from '../utils/auth.js';

const admin = new Hono();

// 所有管理路由都需要管理员权限
admin.use('/*', authMiddleware, requireAdmin);

// ============================================
// 用户管理
// ============================================

/**
 * GET /api/admin/users - 获取用户列表
 * 查询参数: page, limit, search, role, membership_level, status
 */
admin.get('/users', async (c) => {
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
    const params = [];

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

    // 获取总数
    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`
    )
      .bind(...params)
      .first();

    const total = countResult ? countResult.total : 0;

    // 获取分页数据
    const result = await c.env.DB.prepare(
      `SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status, created_at, updated_at
       FROM users
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(...params, clampedLimit, offset)
      .all();

    return c.json({
      success: true,
      data: {
        list: result.results || [],
        pagination: {
          page,
          limit: clampedLimit,
          total,
          totalPages: Math.ceil(total / clampedLimit),
        },
      },
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return c.json(
      { success: false, error: 'Failed to get user list', message: error.message },
      500
    );
  }
});

/**
 * GET /api/admin/users/:id - 获取用户详情
 */
admin.get('/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);

    const user = await c.env.DB.prepare(
      `SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status, created_at, updated_at
       FROM users WHERE id = ?`
    )
      .bind(id)
      .first();

    if (!user) {
      return c.json(
        { success: false, error: 'User not found', message: 'User not found' },
        404
      );
    }

    // 获取用户今日 API 调用统计
    const apiUsage = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM api_usage_logs
       WHERE user_id = ? AND date(created_at) = date('now')`
    )
      .bind(id)
      .first();

    return c.json({
      success: true,
      data: {
        ...user,
        todayApiCalls: apiUsage?.count || 0,
      },
    });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    return c.json(
      { success: false, error: 'Failed to get user details', message: error.message },
      500
    );
  }
});

/**
 * PUT /api/admin/users/:id - 更新用户信息
 */
admin.put('/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();

    // 检查用户是否存在
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!existing) {
      return c.json(
        { success: false, error: 'User not found', message: 'User not found' },
        404
      );
    }

    const updates = [];
    const params = [];

    if (body.role !== undefined && ['admin', 'user'].includes(body.role)) {
      updates.push('role = ?');
      params.push(body.role);
    }

    if (body.status !== undefined && ['active', 'disabled'].includes(body.status)) {
      updates.push('status = ?');
      params.push(body.status);
    }

    if (body.membership_level !== undefined && ['free', 'basic', 'premium', 'vip'].includes(body.membership_level)) {
      updates.push('membership_level = ?');
      params.push(body.membership_level);
    }

    if (body.membership_expire_at !== undefined) {
      updates.push('membership_expire_at = ?');
      params.push(body.membership_expire_at);
    }

    if (body.avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(body.avatar);
    }

    if (body.username !== undefined) {
      // 检查用户名唯一性
      const duplicate = await c.env.DB.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ?'
      )
        .bind(body.username, id)
        .first();

      if (duplicate) {
        return c.json(
          { success: false, error: 'Username already exists', message: 'This username is already taken by another user' },
          409
        );
      }
      updates.push('username = ?');
      params.push(body.username);
    }

    if (updates.length === 0) {
      return c.json(
        { success: false, error: 'No updates provided', message: 'Please provide fields to update' },
        400
      );
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    await c.env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run();

    // 获取更新后的用户
    const updatedUser = await c.env.DB.prepare(
      `SELECT id, email, username, avatar, role, membership_level, membership_expire_at, status, created_at, updated_at
       FROM users WHERE id = ?`
    )
      .bind(id)
      .first();

    return c.json({
      success: true,
      data: updatedUser,
      message: 'User information updated',
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return c.json(
      { success: false, error: 'Failed to update user information', message: error.message },
      500
    );
  }
});

/**
 * DELETE /api/admin/users/:id - 删除用户
 */
admin.delete('/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);

    // 不能删除自己
    const currentUser = c.get('user');
    if (currentUser.id === id) {
      return c.json(
        { success: false, error: 'Cannot delete yourself', message: 'Cannot delete the currently logged in admin account' },
        400
      );
    }

    const existing = await c.env.DB.prepare(
      'SELECT id, username FROM users WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!existing) {
      return c.json(
        { success: false, error: 'User not found', message: 'User not found' },
        404
      );
    }

    // 删除用户的 API 使用日志
    await c.env.DB.prepare(
      'DELETE FROM api_usage_logs WHERE user_id = ?'
    )
      .bind(id)
      .run();

    // 删除用户
    await c.env.DB.prepare(
      'DELETE FROM users WHERE id = ?'
    )
      .bind(id)
      .run();

    return c.json({
      success: true,
      message: `User ${existing.username} deleted`,
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    return c.json(
      { success: false, error: 'Failed to delete user', message: error.message },
      500
    );
  }
});

// ============================================
// 会员等级管理
// ============================================

/**
 * GET /api/admin/memberships - 获取会员等级列表
 */
admin.get('/memberships', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM membership_levels ORDER BY id ASC'
    ).all();

    const memberships = (result.results || []).map((m) => ({
      ...m,
      features: typeof m.features === 'string' ? JSON.parse(m.features) : m.features,
    }));

    return c.json({
      success: true,
      data: memberships,
    });
  } catch (error) {
    console.error('获取会员等级失败:', error);
    return c.json(
      { success: false, error: 'Failed to get membership levels', message: error.message },
      500
    );
  }
});

/**
 * POST /api/admin/memberships - 创建会员等级
 */
admin.post('/memberships', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name, code, price_monthly, price_yearly, features,
      max_api_calls_per_day, max_ai_analysis_per_day,
      can_view_advanced_analysis, can_view_institution_views,
      can_view_investment_advice, can_use_push_notification,
      can_view_realtime_data,
    } = body;

    if (!name || !code) {
      return c.json(
        { success: false, error: 'Incomplete parameters', message: 'Please provide name and code' },
        400
      );
    }

    // 检查 code 是否已存在
    const existing = await c.env.DB.prepare(
      'SELECT id FROM membership_levels WHERE code = ?'
    )
      .bind(code)
      .first();

    if (existing) {
      return c.json(
        { success: false, error: 'Level code already exists', message: 'This code is already in use' },
        409
      );
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO membership_levels (name, code, price_monthly, price_yearly, features, max_api_calls_per_day, max_ai_analysis_per_day, can_view_advanced_analysis, can_view_institution_views, can_view_investment_advice, can_use_push_notification, can_view_realtime_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        name,
        code,
        price_monthly || 0,
        price_yearly || 0,
        JSON.stringify(features || []),
        max_api_calls_per_day || 100,
        max_ai_analysis_per_day || 3,
        can_view_advanced_analysis ? 1 : 0,
        can_view_institution_views ? 1 : 0,
        can_view_investment_advice ? 1 : 0,
        can_use_push_notification ? 1 : 0,
        can_view_realtime_data ? 1 : 0
      )
      .run();

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id, name, code },
      message: 'Membership level created successfully',
    }, 201);
  } catch (error) {
    console.error('创建会员等级失败:', error);
    return c.json(
      { success: false, error: 'Failed to create membership level', message: error.message },
      500
    );
  }
});

/**
 * PUT /api/admin/memberships/:id - 更新会员等级
 */
admin.put('/memberships/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();

    const existing = await c.env.DB.prepare(
      'SELECT id FROM membership_levels WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!existing) {
      return c.json(
        { success: false, error: 'Membership level not found', message: 'Membership level not found' },
        404
      );
    }

    const updates = [];
    const params = [];

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
        // 布尔值转整数
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
      return c.json(
        { success: false, error: 'No updates provided', message: 'Please provide fields to update' },
        400
      );
    }

    params.push(id);

    await c.env.DB.prepare(
      `UPDATE membership_levels SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run();

    const updated = await c.env.DB.prepare(
      'SELECT * FROM membership_levels WHERE id = ?'
    )
      .bind(id)
      .first();

    return c.json({
      success: true,
      data: {
        ...updated,
        features: typeof updated.features === 'string' ? JSON.parse(updated.features) : updated.features,
      },
      message: 'Membership level updated successfully',
    });
  } catch (error) {
    console.error('更新会员等级失败:', error);
    return c.json(
      { success: false, error: 'Failed to update membership level', message: error.message },
      500
    );
  }
});

/**
 * DELETE /api/admin/memberships/:id - 删除会员等级
 */
admin.delete('/memberships/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);

    const existing = await c.env.DB.prepare(
      'SELECT id, code FROM membership_levels WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!existing) {
      return c.json(
        { success: false, error: 'Membership level not found', message: 'Membership level not found' },
        404
      );
    }

    // 不允许删除 free 等级
    if (existing.code === 'free') {
      return c.json(
        { success: false, error: 'Cannot delete free level', message: 'Free level is the system default level' },
        400
      );
    }

    await c.env.DB.prepare(
      'DELETE FROM membership_levels WHERE id = ?'
    )
      .bind(id)
      .run();

    return c.json({
      success: true,
      message: 'Membership level deleted',
    });
  } catch (error) {
    console.error('删除会员等级失败:', error);
    return c.json(
      { success: false, error: 'Failed to delete membership level', message: error.message },
      500
    );
  }
});

// ============================================
// 权限管理
// ============================================

/**
 * GET /api/admin/permissions - 获取权限列表
 */
admin.get('/permissions', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM permissions ORDER BY module, id ASC'
    ).all();

    // 按 module 分组
    const grouped = {};
    for (const perm of result.results || []) {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    }

    return c.json({
      success: true,
      data: {
        list: result.results || [],
        grouped,
      },
    });
  } catch (error) {
    console.error('获取权限列表失败:', error);
    return c.json(
      { success: false, error: 'Failed to get permission list', message: error.message },
      500
    );
  }
});

/**
 * POST /api/admin/permissions - 创建权限
 */
admin.post('/permissions', async (c) => {
  try {
    const body = await c.req.json();
    const { name, code, description, module } = body;

    if (!name || !code || !module) {
      return c.json(
        { success: false, error: 'Incomplete parameters', message: 'Please provide name, code and module' },
        400
      );
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM permissions WHERE code = ?'
    )
      .bind(code)
      .first();

    if (existing) {
      return c.json(
        { success: false, error: 'Permission code already exists', message: 'This code is already in use' },
        409
      );
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO permissions (name, code, description, module, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
      .bind(name, code, description || '', module)
      .run();

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id, name, code, module },
      message: 'Permission created successfully',
    }, 201);
  } catch (error) {
    console.error('创建权限失败:', error);
    return c.json(
      { success: false, error: 'Failed to create permission', message: error.message },
      500
    );
  }
});

/**
 * PUT /api/admin/permissions/:id - 更新权限
 */
admin.put('/permissions/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();

    const existing = await c.env.DB.prepare(
      'SELECT id FROM permissions WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!existing) {
      return c.json(
        { success: false, error: 'Permission not found', message: 'Permission not found' },
        404
      );
    }

    const updates = [];
    const params = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      params.push(body.name);
    }

    if (body.description !== undefined) {
      updates.push('description = ?');
      params.push(body.description);
    }

    if (body.module !== undefined) {
      updates.push('module = ?');
      params.push(body.module);
    }

    if (updates.length === 0) {
      return c.json(
        { success: false, error: 'No updates provided', message: 'Please provide fields to update' },
        400
      );
    }

    params.push(id);

    await c.env.DB.prepare(
      `UPDATE permissions SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run();

    const updated = await c.env.DB.prepare(
      'SELECT * FROM permissions WHERE id = ?'
    )
      .bind(id)
      .first();

    return c.json({
      success: true,
      data: updated,
      message: 'Permission updated successfully',
    });
  } catch (error) {
    console.error('更新权限失败:', error);
    return c.json(
      { success: false, error: 'Failed to update permission', message: error.message },
      500
    );
  }
});

/**
 * PUT /api/admin/role-permissions - 更新角色权限
 * Body: { role: string, permission_ids: number[] }
 */
admin.put('/role-permissions', async (c) => {
  try {
    const body = await c.req.json();
    const { role, permission_ids } = body;

    if (!role || !Array.isArray(permission_ids)) {
      return c.json(
        { success: false, error: 'Incomplete parameters', message: 'Please provide role and permission_ids' },
        400
      );
    }

    // 删除该角色的所有权限
    await c.env.DB.prepare(
      'DELETE FROM role_permissions WHERE role = ?'
    )
      .bind(role)
      .run();

    // 批量插入新权限
    if (permission_ids.length > 0) {
      const stmts = permission_ids.map((pid) =>
        c.env.DB.prepare(
          `INSERT OR IGNORE INTO role_permissions (role, permission_id, created_at) VALUES (?, ?, datetime('now'))`
        ).bind(role, pid)
      );

      await c.env.DB.batch(stmts);
    }

    return c.json({
      success: true,
      data: { role, permission_ids },
      message: 'Role permissions updated successfully',
    });
  } catch (error) {
    console.error('更新角色权限失败:', error);
    return c.json(
      { success: false, error: 'Failed to update role permissions', message: error.message },
      500
    );
  }
});

/**
 * GET /api/admin/role-permissions/:role - 获取角色权限
 */
admin.get('/role-permissions/:role', async (c) => {
  try {
    const role = c.req.param('role');

    const result = await c.env.DB.prepare(
      `SELECT p.* FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role = ?
       ORDER BY p.module, p.id ASC`
    )
      .bind(role)
      .all();

    return c.json({
      success: true,
      data: result.results || [],
    });
  } catch (error) {
    console.error('获取角色权限失败:', error);
    return c.json(
      { success: false, error: 'Failed to get role permissions', message: error.message },
      500
    );
  }
});

// ============================================
// API 使用统计
// ============================================

/**
 * GET /api/admin/api-usage - 获取 API 使用统计
 * 查询参数: days (默认7天), user_id
 */
admin.get('/api-usage', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10);
    const userId = c.req.query('user_id');
    const clampedDays = Math.min(Math.max(days, 1), 90);

    let whereClause = "date(created_at) >= date('now', ? || ' days')";
    const params = [`-${clampedDays}`];

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(parseInt(userId, 10));
    }

    // 按天统计
    const dailyStats = await c.env.DB.prepare(
      `SELECT date(created_at) as date, COUNT(*) as total_calls,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_calls
       FROM api_usage_logs
       WHERE ${whereClause}
       GROUP BY date(created_at)
       ORDER BY date DESC`
    )
      .bind(...params)
      .all();

    // 按端点统计
    const endpointStats = await c.env.DB.prepare(
      `SELECT endpoint, COUNT(*) as total_calls,
        AVG(CASE WHEN status_code < 400 THEN 1 ELSE 0 END) as success_rate
       FROM api_usage_logs
       WHERE ${whereClause}
       GROUP BY endpoint
       ORDER BY total_calls DESC
       LIMIT 20`
    )
      .bind(...params)
      .all();

    // 总计
    const totalStats = await c.env.DB.prepare(
      `SELECT COUNT(*) as total_calls,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_calls
       FROM api_usage_logs
       WHERE ${whereClause}`
    )
      .bind(...params)
      .first();

    return c.json({
      success: true,
      data: {
        summary: totalStats,
        daily: dailyStats.results || [],
        endpoints: endpointStats.results || [],
      },
    });
  } catch (error) {
    console.error('获取API使用统计失败:', error);
    return c.json(
      { success: false, error: 'Failed to get API usage statistics', message: error.message },
      500
    );
  }
});

// ============================================
// 管理后台仪表盘
// ============================================

/**
 * GET /api/admin/dashboard - 管理后台仪表盘统计数据
 */
admin.get('/dashboard', async (c) => {
  try {
    // 用户统计
    const userStats = await c.env.DB.prepare(
      `SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today_new_users
       FROM users`
    ).first();

    // 会员统计
    const membershipStats = await c.env.DB.prepare(
      `SELECT membership_level, COUNT(*) as count
       FROM users
       GROUP BY membership_level`
    ).all();

    // 今日 API 调用统计
    const apiStats = await c.env.DB.prepare(
      `SELECT COUNT(*) as total_calls,
        COUNT(DISTINCT user_id) as active_users
       FROM api_usage_logs
       WHERE date(created_at) = date('now')`
    ).first();

    // 最近7天 API 调用趋势
    const apiTrend = await c.env.DB.prepare(
      `SELECT date(created_at) as date, COUNT(*) as calls
       FROM api_usage_logs
       WHERE date(created_at) >= date('now', '-7 days')
       GROUP BY date(created_at)
       ORDER BY date ASC`
    ).all();

    // 更新日志
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
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    return c.json(
      { success: false, error: 'Failed to get dashboard data', message: error.message },
      500
    );
  }
});

export default admin;
