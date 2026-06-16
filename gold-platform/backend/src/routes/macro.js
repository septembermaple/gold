import { Hono } from 'hono';
import { getMacroDashboard } from '../services/macroAnalysis.js';

const macro = new Hono();

// GET /api/macro/dashboard - 获取宏观仪表盘数据
macro.get('/dashboard', async (c) => {
  try {
    // 检查缓存（1小时有效期）
    const cacheKey = 'macro_dashboard';
    const cached = await c.env.DB.prepare(
      "SELECT * FROM market_summary_cache WHERE cache_key = ? AND datetime(generated_at) > datetime('now', '-1 hour')"
    ).bind(cacheKey).first();

    if (cached) {
      const data = typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
      return c.json({ success: true, data, cached: true });
    }

    // 获取实时数据
    const data = await getMacroDashboard(c.env);

    // 缓存结果
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO market_summary_cache (cache_key, data, generated_at, created_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`
    ).bind(cacheKey, JSON.stringify(data)).run();

    return c.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('获取宏观仪表盘数据失败:', error);
    return c.json(
      { success: false, error: '获取宏观仪表盘数据失败', message: error.message },
      500
    );
  }
});

export default macro;
