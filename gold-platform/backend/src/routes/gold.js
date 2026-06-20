/**
 * 金价路由
 * 金价查询、K线数据、AI分析等
 */

import { Hono } from 'hono';
import { authMiddleware, requireMembership, rateLimitByUser } from '../middleware/auth.js';
import {
  fetchInternationalGoldPrice,
  fetchDomesticGoldPrice,
  fetchAllPrices,
  generateKlineData,
  fetchRealGoldKline,
  fetchDollarIndex,
  getMarketStats,
  saveGoldPrice,
  saveKlineToDb,
} from '../services/goldPrice.js';
import { analyzeWithDeepSeek, streamAnalysis } from '../services/aiAnalysis.js';

const gold = new Hono();

/**
 * GET /api/gold/price/international - 获取国际金价
 */
gold.get('/price/international', async (c) => {
  try {
    const data = await fetchInternationalGoldPrice();
    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('获取国际金价失败:', error);
    return c.json(
      { success: false, error: '获取国际金价失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/gold/price/domestic - 获取国内金价
 */
gold.get('/price/domestic', async (c) => {
  try {
    const data = await fetchDomesticGoldPrice();
    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('获取国内金价失败:', error);
    return c.json(
      { success: false, error: '获取国内金价失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/gold/price/all - 获取所有金价数据
 */
gold.get('/price/all', async (c) => {
  try {
    const data = await fetchAllPrices();
    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('获取金价数据失败:', error);
    return c.json(
      { success: false, error: '获取金价数据失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/gold/kline?days=30 - 获取K线数据
 * 优先从API获取实时数据，API失败时回退到数据库
 */
gold.get('/kline', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30', 10);
    const period = c.req.query('period') || '1d';
    const clampedDays = Math.min(Math.max(days, 1), 365);

    let klineData = [];
    let source = 'api';

    // 1. 优先从API获取实时数据（mql5.com chartData，实时更新）
    try {
      const realKline = await fetchRealGoldKline(clampedDays, period);
      if (realKline && realKline.length >= 5) {
        klineData = realKline;
        source = 'api-mql5';
      }
    } catch (err) {
      console.error('获取实时K线失败，回退到数据库:', err);
    }

    // 2. API失败，从 gold_kline 表查询
    if (klineData.length <= 5) {
      try {
        const recordsPerDay = { '1h': 24, '4h': 6, '1d': 1, '1w': 1 };
        const limit = clampedDays * (recordsPerDay[period] || 1);

        const dbKline = await c.env.DB.prepare(
          'SELECT * FROM gold_kline WHERE period = ? ORDER BY time DESC LIMIT ?'
        )
          .bind(period, limit)
          .all();

        if (dbKline.results && dbKline.results.length > 5) {
          klineData = dbKline.results.reverse().map((row) => ({
            date: row.time,
            time: row.time,
            open: row.open_price,
            high: row.high_price,
            low: row.low_price,
            close: row.close_price,
            volume: row.volume,
          }));
          source = 'gold_kline';
        }
      } catch (err) {
        console.error('查询 gold_kline 表失败:', err);
      }
    }

    // 3. gold_kline 也没有，回退到 gold_prices 表
    if (klineData.length <= 5) {
      const dbPrices = await c.env.DB.prepare(
        'SELECT * FROM gold_prices ORDER BY date DESC LIMIT ?'
      )
        .bind(clampedDays)
        .all();

      if (dbPrices.results && dbPrices.results.length > 5) {
        klineData = dbPrices.results
          .reverse()
          .map((row) => ({
            date: row.date,
            open: row.open_price,
            high: row.high_price,
            low: row.low_price,
            close: row.close_price,
            volume: row.volume,
            changePercent: row.change_percent,
          }));
        source = 'gold_prices';
      }
    }

    // 4. 都没有，生成兜底数据
    if (klineData.length <= 5) {
      const intlPrice = await fetchInternationalGoldPrice();
      klineData = generateKlineData(clampedDays, intlPrice.price, period);
      source = 'generated';
    }

    return c.json({
      success: true,
      data: {
        kline: klineData,
        days: clampedDays,
        source,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('获取K线数据失败:', error);
    return c.json(
      { success: false, error: '获取K线数据失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/gold/chart/kline?days=30 - 获取图表用K线数据
 * 返回格式更适合前端图表库使用
 */
gold.get('/chart/kline', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30', 10);
    const period = c.req.query('period') || '1d';
    const clampedDays = Math.min(Math.max(days, 1), 365);

    let klineData = [];

    // 1. 优先从API获取实时数据（mql5.com chartData，实时更新）
    try {
      const realKline = await fetchRealGoldKline(clampedDays, period);
      if (realKline && realKline.length >= 5) {
        klineData = realKline.map((k) => [
          k.time || k.date,
          k.open,
          k.close,
          k.low,
          k.high,
          k.volume,
        ]);
      }
    } catch (err) {
      console.error('获取图表K线失败，回退到数据库:', err);
    }

    // 2. API失败，从 gold_prices 表获取
    if (klineData.length === 0) {
      const dbPrices = await c.env.DB.prepare(
        'SELECT * FROM gold_prices ORDER BY date DESC LIMIT ?'
      )
        .bind(clampedDays)
        .all();

      if (dbPrices.results && dbPrices.results.length > 5) {
        klineData = dbPrices.results.reverse().map((row) => [
          row.date,
          row.open_price,
          row.close_price,
          row.low_price,
          row.high_price,
          row.volume,
        ]);
      }
    }

    // 3. 都没有，生成兜底数据
    if (klineData.length === 0) {
      const intlPrice = await fetchInternationalGoldPrice();
      const generated = generateKlineData(clampedDays, intlPrice.price, period);
      klineData = generated.map((k) => [
        k.date,
        k.open,
        k.close,
        k.low,
        k.high,
        k.volume,
      ]);
    }

    return c.json({
      success: true,
      data: klineData,
    });
  } catch (error) {
    console.error('获取图表K线数据失败:', error);
    return c.json(
      { success: false, error: '获取图表K线数据失败', message: error.message },
      500
    );
  }
});

/**
 * POST /api/gold/analyze - AI 分析（需要会员）
 */
gold.post('/analyze', authMiddleware, requireMembership('basic'), rateLimitByUser(), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json() || {};

    // 获取价格数据
    const priceData = await fetchAllPrices();

    // 获取K线数据
    const klineDays = body.klineDays || 30;
    let klineData;
    try {
      const { fetchRealGoldKline } = await import('../services/goldPrice.js');
      klineData = await fetchRealGoldKline(klineDays, '1d');
    } catch (err) {
      console.error('获取K线数据失败:', err);
      klineData = [];
    }
    if (!klineData || klineData.length === 0) {
      const intlPrice = priceData.international || {};
      klineData = generateKlineData(klineDays, intlPrice.price);
    }

    // 调用 AI 分析
    const result = await analyzeWithDeepSeek(c.env, priceData, klineData);

    // 记录 AI 分析使用次数
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        "INSERT INTO api_usage_logs (user_id, endpoint, method, status_code, created_at) VALUES (?, ?, 'POST', 200, datetime('now'))"
      )
        .bind(user.id, '/api/gold/analyze')
        .run()
    );

    return c.json({
      success: result.success,
      data: result.analysis,
      error: result.error,
    });
  } catch (error) {
    console.error('AI分析失败:', error);
    return c.json(
      { success: false, error: 'AI分析失败', message: error.message },
      500
    );
  }
});

/**
 * POST /api/gold/analyze/stream - 流式 AI 分析
 */
gold.post('/analyze/stream', authMiddleware, requireMembership('basic'), rateLimitByUser(), async (c) => {
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
  } catch (error) {
    console.error('流式分析失败:', error);
    return c.json(
      { success: false, error: '流式分析失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/gold/stats - 市场统计数据
 */
gold.get('/stats', async (c) => {
  try {
    const stats = await getMarketStats(c.env);
    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('获取市场统计失败:', error);
    return c.json(
      { success: false, error: '获取市场统计失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/gold/dollar-realtime - 美元指数实时数据
 */
gold.get('/dollar-realtime', async (c) => {
  try {
    const data = await fetchDollarIndex();
    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('获取美元指数失败:', error);
    return c.json(
      { success: false, error: '获取美元指数失败', message: error.message },
      500
    );
  }
});

/**
 * POST /api/gold/admin/kline/load - 从指定日期加载历史K线数据
 * 需要企业版会员权限
 */
gold.post('/admin/kline/load', authMiddleware, requireMembership('vip'), async (c) => {
  try {
    const body = await c.req.json();
    const { startDate, period = '1d' } = body;

    if (!startDate) {
      return c.json({ success: false, error: '缺少 startDate 参数' }, 400);
    }

    const validPeriods = ['1h', '4h', '1d', '1w'];
    if (!validPeriods.includes(period)) {
      return c.json({ success: false, error: 'period 必须是 1h, 4h, 1d, 1w 之一' }, 400);
    }

    // 检查数据库中是否已有该日期之后的数据
    const existing = await c.env.DB.prepare(
      'SELECT MIN(time) as earliest, MAX(time) as latest, COUNT(*) as count FROM gold_kline WHERE period = ? AND time >= ?'
    )
      .bind(period, startDate)
      .first();

    if (existing && existing.count > 0) {
      return c.json({
        success: false,
        conflict: true,
        existingFrom: existing.earliest,
        existingTo: existing.latest,
        message: '该日期后已有数据',
      });
    }

    // 从Yahoo Finance获取startDate到今天的K线数据
    const today = new Date().toISOString().split('T')[0];
    const start = new Date(startDate);
    const end = new Date(today);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const days = Math.max(diffDays, 5);

    const klineData = await fetchRealGoldKline(days, period);

    if (!klineData || klineData.length === 0) {
      return c.json({ success: false, error: '未能获取到K线数据' }, 500);
    }

    // 过滤出startDate之后的数据
    const filtered = klineData.filter((k) => {
      const kTime = (k.time || k.date).substring(0, 10);
      return kTime >= startDate;
    });

    const loaded = await saveKlineToDb(c.env, filtered, period, 'yahoo');

    return c.json({
      success: true,
      loaded,
      from: filtered.length > 0 ? filtered[0].time || filtered[0].date : null,
      to: filtered.length > 0 ? filtered[filtered.length - 1].time || filtered[filtered.length - 1].date : null,
    });
  } catch (error) {
    console.error('加载K线数据失败:', error);
    return c.json(
      { success: false, error: '加载K线数据失败', message: error.message },
      500
    );
  }
});

/**
 * POST /api/gold/admin/kline/load-force - 强制加载K线数据（覆盖已有数据）
 * 需要企业版会员权限
 */
gold.post('/admin/kline/load-force', authMiddleware, requireMembership('vip'), async (c) => {
  try {
    const body = await c.req.json();
    const { startDate, endDate, period = '1d' } = body;

    if (!startDate) {
      return c.json({ success: false, error: '缺少 startDate 参数' }, 400);
    }

    const validPeriods = ['1h', '4h', '1d', '1w'];
    if (!validPeriods.includes(period)) {
      return c.json({ success: false, error: 'period 必须是 1h, 4h, 1d, 1w 之一' }, 400);
    }

    const end = endDate ? new Date(endDate) : new Date();
    const start = new Date(startDate);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const days = Math.max(diffDays, 5);

    const klineData = await fetchRealGoldKline(days, period);

    if (!klineData || klineData.length === 0) {
      return c.json({ success: false, error: '未能获取到K线数据' }, 500);
    }

    // 过滤出日期范围内的数据
    const endDateStr = endDate || new Date().toISOString().split('T')[0];
    const filtered = klineData.filter((k) => {
      const kTime = (k.time || k.date).substring(0, 10);
      return kTime >= startDate && kTime <= endDateStr;
    });

    // saveKlineToDb 使用 INSERT OR REPLACE，会覆盖已有数据
    const loaded = await saveKlineToDb(c.env, filtered, period, 'yahoo');

    return c.json({
      success: true,
      loaded,
      from: filtered.length > 0 ? filtered[0].time || filtered[0].date : null,
      to: filtered.length > 0 ? filtered[filtered.length - 1].time || filtered[filtered.length - 1].date : null,
    });
  } catch (error) {
    console.error('强制加载K线数据失败:', error);
    return c.json(
      { success: false, error: '强制加载K线数据失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/gold/admin/kline/status - 查看已加载的K线数据状态
 * 需要企业版会员权限
 */
gold.get('/admin/kline/status', authMiddleware, requireMembership('vip'), async (c) => {
  try {
    const periods = ['1h', '4h', '1d', '1w'];
    const status = [];

    for (const period of periods) {
      const info = await c.env.DB.prepare(
        'SELECT MIN(time) as earliest, MAX(time) as latest, COUNT(*) as count FROM gold_kline WHERE period = ?'
      )
        .bind(period)
        .first();

      status.push({
        period,
        count: info?.count || 0,
        from: info?.earliest || null,
        to: info?.latest || null,
      });
    }

    return c.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('获取K线数据状态失败:', error);
    return c.json(
      { success: false, error: '获取K线数据状态失败', message: error.message },
      500
    );
  }
});

export default gold;
