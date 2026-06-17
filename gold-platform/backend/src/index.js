/**
 * 黄金市场分析平台 - 后端主入口
 * 基于 Cloudflare Workers + Hono 框架
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

// 路由
import authRoutes from './routes/auth.js';
import goldRoutes from './routes/gold.js';
import newsRoutes from './routes/news.js';
import analysisRoutes from './routes/analysis.js';
import pushRoutes from './routes/push.js';
import adminRoutes from './routes/admin.js';
import macroRoutes from './routes/macro.js';

// 服务
import { fetchAllPrices, saveGoldPrice } from './services/goldPrice.js';
import { executePush, checkAlertCondition } from './services/pushNotification.js';

const app = new Hono();

// ============================================
// 全局中间件
// ============================================

// CORS 跨域 - 仅允许前端域名访问
const ALLOWED_ORIGINS = [
  'https://aumind.cc',
  'https://www.aumind.cc',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use('*', cors({
  origin: (origin, c) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return origin || '';
    }
    return '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Used'],
  maxAge: 86400,
}));

// API 访问限制 - 仅允许前端域名访问
app.use('/api/*', async (c, next) => {
  const origin = c.req.header('Origin');
  const referer = c.req.header('Referer');

  // 允许无 Origin 的请求（服务端调用、定时任务等）
  if (!origin && !referer) {
    return next();
  }

  // 检查 Origin
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return c.json({ success: false, error: '访问被拒绝' }, 403);
  }

  // 检查 Referer（部分请求可能只有 Referer 没有 Origin）
  if (!origin && referer) {
    const refererUrl = new URL(referer);
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
    if (!ALLOWED_ORIGINS.includes(refererOrigin)) {
      return c.json({ success: false, error: '访问被拒绝' }, 403);
    }
  }

  return next();
});

// 请求日志（开发环境）
app.use('*', logger());

// Pretty JSON（开发环境）
app.use('*', prettyJSON());

// ============================================
// 健康检查
// ============================================

app.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      service: 'gold-platform-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      name: '黄金市场分析平台 API',
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth',
        gold: '/api/gold',
        news: '/api/news',
        analysis: '/api/analysis',
        push: '/api/push',
        admin: '/api/admin',
        macro: '/api/macro',
        health: '/health',
      },
    },
  });
});

// ============================================
// 注册路由
// ============================================

app.route('/api/auth', authRoutes);
app.route('/api/gold', goldRoutes);
app.route('/api/news', newsRoutes);
app.route('/api/analysis', analysisRoutes);
app.route('/api/push', pushRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/macro', macroRoutes);

// ============================================
// 404 处理
// ============================================

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: '接口不存在',
      message: `${c.req.method} ${c.req.path} 未找到`,
    },
    404
  );
});

// ============================================
// 全局错误处理
// ============================================

app.onError((err, c) => {
  console.error('服务器错误:', err);
  return c.json(
    {
      success: false,
      error: '服务器内部错误',
      message: err.message || '未知错误',
    },
    500
  );
});

// ============================================
// 导出 Cloudflare Workers 处理器
// ============================================

export default {
  // HTTP 请求处理
  fetch: app.fetch,

  // 定时任务处理 (每30分钟执行一次)
  async scheduled(event, env, ctx) {
    console.log(`[定时任务] 开始执行 - ${new Date().toISOString()}`);

    try {
      // 1. 获取最新金价数据
      const priceData = await fetchAllPrices();
      console.log('[定时任务] 金价数据获取成功');

      // 2. 保存金价到数据库
      if (priceData.international && priceData.international.price > 0) {
        ctx.waitUntil(saveGoldPrice(env, priceData.international));
        console.log('[定时任务] 金价数据保存中');
      }

      // 3. 检查是否需要预警推送
      const alertCheck = checkAlertCondition(priceData);
      if (alertCheck.shouldPush) {
        console.log(`[定时任务] 触发预警: ${alertCheck.reason}`);
        ctx.waitUntil(executePush(env, priceData, 'alert', ctx));
      }

      // 4. 根据时间段发送定时推送
      const hour = new Date().getHours();
      const minute = new Date().getMinutes();

      // 早盘推送 (8:00 - 8:30)
      if (hour === 8 && minute < 30) {
        console.log('[定时任务] 发送早盘推送');
        ctx.waitUntil(executePush(env, priceData, 'morning', ctx));
      }

      // 收盘推送 (16:00 - 16:30)
      if (hour === 16 && minute < 30) {
        console.log('[定时任务] 发送收盘推送');
        ctx.waitUntil(executePush(env, priceData, 'evening', ctx));
      }

      // 5. 记录更新日志
      ctx.waitUntil(
        env.DB.prepare(
          "INSERT INTO update_logs (data_type, status, records_affected, duration_seconds, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        )
          .bind('scheduled_task', 'success', 1, 0)
          .run()
      );

      console.log(`[定时任务] 执行完成 - ${new Date().toISOString()}`);
    } catch (error) {
      console.error('[定时任务] 执行失败:', error);

      // 记录错误日志
      ctx.waitUntil(
        env.DB.prepare(
          "INSERT INTO update_logs (data_type, status, error_message, created_at) VALUES (?, ?, ?, datetime('now'))"
        )
          .bind('scheduled_task', 'failed', error.message)
          .run()
      );
    }
  },
};
