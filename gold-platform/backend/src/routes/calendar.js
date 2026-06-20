/**
 * 经济日历路由
 * 提供影响黄金市场的重大财经事件日历
 */

import { Hono } from 'hono';
import { getEconomicCalendar } from '../services/economicCalendar.js';

const calendar = new Hono();

// GET /api/calendar - 获取经济日历
// 调试模式: ?debug=1 返回 investing.com 原始 HTML 片段
calendar.get('/', async (c) => {
  try {
    const lang = c.req.query('lang') || c.req.query('language') || 'en-US';
    const debug = c.req.query('debug') === '1';

    const today = new Date();
    const defaultFrom = today.toISOString().split('T')[0];
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);
    const defaultTo = threeDaysLater.toISOString().split('T')[0];

    const dateFrom = c.req.query('from') || defaultFrom;
    const dateTo = c.req.query('to') || defaultTo;

    const result = await getEconomicCalendar(dateFrom, dateTo, lang, { debug });
    return c.json(result);
  } catch (error) {
    console.error('获取经济日历失败:', error);
    return c.json(
      { success: false, error: error.message || '获取经济日历失败', data: [], total: 0 },
      500
    );
  }
});

// POST /api/calendar/refresh - 强制刷新（绕过任何缓存层）
calendar.post('/refresh', async (c) => {
  try {
    const lang = c.req.query('lang') || c.req.query('language') || 'en-US';

    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);
    const to = threeDaysLater.toISOString().split('T')[0];

    const result = await getEconomicCalendar(from, to, lang);
    return c.json(result);
  } catch (error) {
    console.error('刷新经济日历失败:', error);
    return c.json(
      { success: false, error: error.message || '刷新经济日历失败', data: [], total: 0 },
      500
    );
  }
});

export default calendar;
