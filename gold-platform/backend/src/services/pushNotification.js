/**
 * 推送通知服务
 * 使用 PushPlus 实现微信推送通知
 */

import { fetchAllPrices } from './goldPrice.js';
import { analyzeWithDeepSeek } from './aiAnalysis.js';

/**
 * 发送 PushPlus 推送通知
 * @param {object} env - Cloudflare Worker 环境变量
 * @param {string} title - 推送标题
 * @param {string} content - 推送内容（支持 HTML）
 * @param {string} template - 模板类型 (html/txt/json)
 * @returns {Promise<object>} 推送结果
 */
export async function sendPushPlusNotification(env, title, content, template = 'html') {
  const token = env.PUSHPLUS_TOKEN;

  if (!token) {
    console.warn('PushPlus Token 未配置，跳过推送');
    return { success: false, error: 'PushPlus Token 未配置' };
  }

  try {
    const response = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        title,
        content,
        template,
      }),
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
  } catch (error) {
    console.error('PushPlus 推送异常:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 生成推送 HTML 内容
 * @param {object} priceData - 金价数据
 * @param {string} analysisText - 分析文本
 * @param {string} pushType - 推送类型 (morning/evening/alert/custom)
 * @returns {string} HTML 内容
 */
export function generatePushHtml(priceData, analysisText, pushType = 'custom') {
  const intl = priceData.international || {};
  const domestic = priceData.domestic || {};
  const converted = priceData.converted || {};

  const typeConfig = {
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
    <!-- 头部 -->
    <div style="background:linear-gradient(135deg,${config.color},${config.color}dd);padding:20px;color:#fff;">
      <h2 style="margin:0;font-size:18px;">${config.title}</h2>
      <p style="margin:5px 0 0 0;font-size:12px;opacity:0.8;">${new Date().toLocaleString('zh-CN')}</p>
    </div>

    <!-- 国际金价 -->
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

    <!-- 国内金价 -->
    <div style="padding:0 15px 15px;">
      <h3 style="margin:0 0 10px 0;font-size:15px;color:#333;">🇨🇳 国内金价</h3>
      <div style="background:#fafafa;border-radius:8px;padding:12px;">
        ${domesticHtml}
      </div>
    </div>

    <!-- 换算价格 -->
    ${converted.pricePerGramCny ? `
    <div style="padding:0 15px 15px;">
      <div style="background:#fff3e0;border-radius:8px;padding:10px 12px;font-size:13px;color:#e65100;">
        💱 人民币/克: ¥${converted.pricePerGramCny}（汇率 ${converted.exchangeRate}）
      </div>
    </div>` : ''}

    <!-- AI 分析 -->
    ${analysisHtml}

    <!-- 底部 -->
    <div style="padding:12px 15px;background:#f8f9fa;text-align:center;font-size:11px;color:#999;">
      黄金市场分析平台 · 数据仅供参考，不构成投资建议
    </div>
  </div>
</body>
</html>`;
}

/**
 * 执行推送任务
 * @param {object} env - Cloudflare Worker 环境变量
 * @param {object} priceData - 金价数据（可选，不传则自动获取）
 * @param {string} pushType - 推送类型
 * @param {object} ctx - ExecutionContext（用于 waitUntil）
 * @returns {Promise<object>} 推送结果
 */
export async function executePush(env, priceData = null, pushType = 'custom', ctx = null) {
  const startTime = Date.now();

  try {
    // 获取价格数据
    const data = priceData || await fetchAllPrices();

    // 获取 AI 分析
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

    // 生成推送内容
    const typeNames = {
      morning: '早盘速报',
      evening: '收盘分析',
      alert: '行情预警',
      custom: '行情推送',
    };

    const title = `【黄金${typeNames[pushType] || '行情'}】$${data.international?.price || 'N/A'} ${data.international?.change > 0 ? '↑' : '↓'}${Math.abs(data.international?.changePercent || 0)}%`;
    const html = generatePushHtml(data, analysisText, pushType);

    // 发送推送
    const result = await sendPushPlusNotification(env, title, html, 'html');

    // 记录更新日志
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    if (ctx) {
      ctx.waitUntil(
        env.DB.prepare(
          "INSERT INTO update_logs (data_type, status, records_affected, duration_seconds, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        )
          .bind(`push_${pushType}`, result.success ? 'success' : 'failed', 1, parseFloat(duration))
          .run()
      );
    }

    return {
      success: result.success,
      data: {
        pushType,
        title,
        priceData: data,
        duration: parseFloat(duration),
      },
      error: result.error,
    };
  } catch (error) {
    console.error('执行推送失败:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 检查是否需要发送预警推送
 * @param {object} env - Cloudflare Worker 环境变量
 * @param {object} priceData - 金价数据
 * @returns {object} { shouldPush: boolean, reason: string }
 */
export function checkAlertCondition(priceData) {
  const intl = priceData.international || {};
  const changePercent = Math.abs(intl.changePercent || 0);

  // 日涨跌幅超过 1% 触发预警
  if (changePercent >= 1) {
    return {
      shouldPush: true,
      reason: `金价${intl.changePercent > 0 ? '大涨' : '大跌'} ${changePercent.toFixed(2)}%`,
      pushType: 'alert',
    };
  }

  return { shouldPush: false, reason: '' };
}
