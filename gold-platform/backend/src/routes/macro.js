import { Hono } from 'hono';
import { getMacroDashboard } from '../services/macroAnalysis.js';

const macro = new Hono();

// GET /api/macro/dashboard - 获取宏观仪表盘数据
macro.get('/dashboard', async (c) => {
  try {
    const lang = c.req.query('lang') || c.req.query('language') || 'en-US';
    const needRefresh = c.req.query('refresh') === '1' || c.req.query('refresh') === 'true';

    // 如果请求刷新，先清除对应语言的缓存
    if (needRefresh) {
      await c.env.DB.prepare(
        "DELETE FROM market_summary_cache WHERE cache_key = ?"
      ).bind(`macro_dashboard_${lang}`).run();
    }

    // 检查缓存（1小时有效期）
    const cacheKey = `macro_dashboard_${lang}`;
    const cached = await c.env.DB.prepare(
      "SELECT * FROM market_summary_cache WHERE cache_key = ? AND datetime(generated_at) > datetime('now', '-1 hour')"
    ).bind(cacheKey).first();

    if (cached && !needRefresh) {
      const data = typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
      return c.json({ success: true, data, cached: true });
    }

    // 获取实时数据
    const data = await getMacroDashboard(c.env, lang);

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
