/**
 * 推送通知路由
 * 测试推送、定时推送、强制推送、推送状态
 */

import { Hono } from 'hono';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { executePush, sendPushPlusNotification, checkAlertCondition } from '../services/pushNotification.js';
import { fetchAllPrices } from '../services/goldPrice.js';

const push = new Hono();

/**
 * POST /api/push/test - 测试推送
 */
push.post('/test', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    // 仅管理员可测试推送
    if (user.role !== 'admin') {
      return c.json(
        { success: false, error: '权限不足', message: '需要管理员权限' },
        403
      );
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
  } catch (error) {
    console.error('测试推送失败:', error);
    return c.json(
      { success: false, error: '测试推送失败', message: error.message },
      500
    );
  }
});

/**
 * POST /api/push/scheduled - 定时推送
 * 根据当前时间判断推送类型（早盘/收盘）
 */
push.post('/scheduled', authMiddleware, requireAdmin, async (c) => {
  try {
    const hour = new Date().getHours();
    let pushType = 'custom';

    if (hour >= 7 && hour < 10) {
      pushType = 'morning';
    } else if (hour >= 15 && hour < 18) {
      pushType = 'evening';
    }

    const result = await executePush(c.env, null, pushType, c.executionCtx);

    return c.json({
      success: result.success,
      data: result.data,
      error: result.error,
      message: result.success ? `${pushType} 推送已发送` : '推送失败',
    });
  } catch (error) {
    console.error('定时推送失败:', error);
    return c.json(
      { success: false, error: '定时推送失败', message: error.message },
      500
    );
  }
});

/**
 * POST /api/push/force - 强制推送
 * 立即推送当前行情
 */
push.post('/force', authMiddleware, requireAdmin, async (c) => {
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
  } catch (error) {
    console.error('强制推送失败:', error);
    return c.json(
      { success: false, error: '强制推送失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/push/status - 获取推送状态
 */
push.get('/status', authMiddleware, async (c) => {
  try {
    // 获取最近的推送日志
    const recentLogs = await c.env.DB.prepare(
      "SELECT * FROM update_logs WHERE data_type LIKE 'push_%' ORDER BY created_at DESC LIMIT 10"
    ).all();

    // 获取今天的推送统计
    const todayStats = await c.env.DB.prepare(
      `SELECT data_type, COUNT(*) as count,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
       FROM update_logs
       WHERE data_type LIKE 'push_%' AND date(created_at) = date('now')
       GROUP BY data_type`
    ).all();

    // 检查 PushPlus 配置状态
    const pushConfigured = !!c.env.PUSHPLUS_TOKEN;

    // 检查是否需要预警推送
    let alertStatus = { shouldPush: false, reason: '' };
    try {
      const priceData = await fetchAllPrices();
      alertStatus = checkAlertCondition(priceData);
    } catch (e) {
      // 忽略获取价格失败
    }

    return c.json({
      success: true,
      data: {
        pushConfigured,
        alertStatus,
        todayStats: todayStats.results || [],
        recentLogs: recentLogs.results || [],
      },
    });
  } catch (error) {
    console.error('获取推送状态失败:', error);
    return c.json(
      { success: false, error: '获取推送状态失败', message: error.message },
      500
    );
  }
});

export default push;
