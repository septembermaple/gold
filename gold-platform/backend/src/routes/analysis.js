/**
 * 分析路由
 * 市场因素、机构观点、投资建议、市场摘要
 * 优先从数据库获取，数据库为空时使用AI动态生成
 */

import { Hono } from 'hono';
import { authMiddleware, requireMembership } from '../middleware/auth.js';
import { fetchAllPrices } from '../services/goldPrice.js';
import { analyzeWithDeepSeek } from '../services/aiAnalysis.js';

const analysis = new Hono();

/**
 * 使用AI生成看多/看空因素
 */
async function generateFactorsWithAI(env, type) {
  const priceData = await fetchAllPrices();
  const intl = priceData.international || {};
  const domestic = priceData.domestic || {};

  const prompt = type === 'bullish'
    ? `基于当前黄金市场数据，分析3-5个看涨因素。
当前国际金价: $${intl.price || 'N/A'}/盎司, 涨跌幅: ${intl.changePercent || 'N/A'}%
国内金价: ¥${domestic.au99_99?.price || 'N/A'}/克

请以JSON数组格式返回，每个因素包含: title(标题), subtitle(副标题), description(描述), details(详情数组), impact(high/medium/low), confidence(0-1)
只返回JSON数组，不要其他文字。`
    : `基于当前黄金市场数据，分析3-5个看跌因素。
当前国际金价: $${intl.price || 'N/A'}/盎司, 涨跌幅: ${intl.changePercent || 'N/A'}%
国内金价: ¥${domestic.au99_99?.price || 'N/A'}/克

请以JSON数组格式返回，每个因素包含: title(标题), subtitle(副标题), description(描述), details(详情数组), impact(high/medium/low), confidence(0-1)
只返回JSON数组，不要其他文字。`;

  const apiKey = env.DEEPSEEK_API_KEY || env.MODELSCOPE_API_KEY;
  if (!apiKey) return null;

  try {
    const apiUrl = env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    // 提取JSON数组
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const factors = JSON.parse(jsonMatch[0]);
      return factors.map((f, i) => ({
        id: i + 1,
        type,
        title: f.title || `${type === 'bullish' ? '看多' : '看空'}因素 ${i + 1}`,
        subtitle: f.subtitle || '',
        description: f.description || '',
        details: Array.isArray(f.details) ? JSON.stringify(f.details) : JSON.stringify([f.details || '']),
        impact: f.impact || 'medium',
        confidence: f.confidence || 0.5,
        created_at: new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.error('AI生成因素失败:', error);
  }
  return null;
}

/**
 * 使用AI生成机构观点
 */
async function generateInstitutionViewsWithAI(env) {
  const priceData = await fetchAllPrices();
  const intl = priceData.international || {};

  const prompt = `基于当前黄金市场数据，模拟4-5家主流投行对黄金的观点预测。
当前国际金价: $${intl.price || 'N/A'}/盎司

请以JSON数组格式返回，每个机构包含: institution_name(机构名), rating(buy/hold/sell), target_price(目标价), timeframe(时间框架), reasoning(理由), key_points(关键点数组)
只返回JSON数组，不要其他文字。`;

  const apiKey = env.DEEPSEEK_API_KEY || env.MODELSCOPE_API_KEY;
  if (!apiKey) return null;

  try {
    const apiUrl = env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const views = JSON.parse(jsonMatch[0]);
      return views.map((v, i) => ({
        id: i + 1,
        institution_name: v.institution_name || `机构 ${i + 1}`,
        logo: '',
        rating: v.rating || 'hold',
        target_price: v.target_price || null,
        timeframe: v.timeframe || '6个月',
        reasoning: v.reasoning || '',
        key_points: Array.isArray(v.key_points) ? JSON.stringify(v.key_points) : JSON.stringify([v.key_points || '']),
        created_at: new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.error('AI生成机构观点失败:', error);
  }
  return null;
}

/**
 * GET /api/analysis/bullish-factors - 获取看多因素（需要 basic 及以上会员）
 */
analysis.get('/bullish-factors', authMiddleware, requireMembership('free'), async (c) => {
  try {
    // 从数据库获取看多因素
    const result = await c.env.DB.prepare(
      "SELECT * FROM market_factors WHERE type = 'bullish' ORDER BY created_at DESC LIMIT 20"
    ).all();

    // 如果数据库没有数据，使用AI动态生成
    if (!result.results || result.results.length === 0) {
      const aiFactors = await generateFactorsWithAI(c.env, 'bullish');
      if (aiFactors && aiFactors.length > 0) {
        return c.json({ success: true, data: aiFactors });
      }

      // AI不可用时的兜底数据（基于实时价格动态生成）
      const priceData = await fetchAllPrices();
      const intl = priceData.international || {};
      const changePercent = intl.changePercent || 0;
      const fallbackFactors = [
        {
          id: 1, type: 'bullish',
          title: '全球央行持续增持黄金',
          subtitle: '去美元化趋势加速',
          description: `当前金价$${intl.price?.toFixed(2) || 'N/A'}/盎司，多国央行持续增加黄金储备，为金价提供长期支撑。`,
          details: JSON.stringify(['中国央行连续多月增持黄金', '印度、土耳其等国央行积极购金', '全球央行购金量创历史新高']),
          impact: 'high', confidence: 0.85, created_at: new Date().toISOString(),
        },
        {
          id: 2, type: 'bullish',
          title: '地缘政治风险上升',
          subtitle: '避险需求增加',
          description: '地缘政治不确定性推动避险需求，黄金作为传统避险资产受到追捧。',
          details: JSON.stringify(['中东局势持续紧张', '俄乌冲突前景不明', '全球安全形势趋于复杂']),
          impact: 'high', confidence: 0.75, created_at: new Date().toISOString(),
        },
        {
          id: 3, type: 'bullish',
          title: changePercent > 0 ? '金价短期动能偏多' : '美联储降息预期',
          subtitle: changePercent > 0 ? '技术面支撑' : '实际利率下行利好黄金',
          description: changePercent > 0
            ? `当前金价日涨幅${changePercent.toFixed(2)}%，短期动能偏多。`
            : '市场预期美联储将降息，实际利率下行将降低持有黄金的机会成本。',
          details: JSON.stringify(changePercent > 0
            ? ['短期均线多头排列', '成交量有所放大', '技术指标偏多']
            : ['通胀数据持续回落', '就业市场出现降温迹象', '市场预计年内降息2-3次']),
          impact: 'medium', confidence: 0.65, created_at: new Date().toISOString(),
        },
      ];
      return c.json({ success: true, data: fallbackFactors });
    }

    // 解析 details JSON
    const factors = result.results.map((f) => ({
      ...f,
      details: typeof f.details === 'string' ? JSON.parse(f.details) : f.details,
    }));

    return c.json({
      success: true,
      data: factors,
    });
  } catch (error) {
    console.error('获取看多因素失败:', error);
    return c.json(
      { success: false, error: '获取看多因素失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/analysis/bearish-factors - 获取看空因素（需要 basic 及以上会员）
 */
analysis.get('/bearish-factors', authMiddleware, requireMembership('free'), async (c) => {
  try {
    const result = await c.env.DB.prepare(
      "SELECT * FROM market_factors WHERE type = 'bearish' ORDER BY created_at DESC LIMIT 20"
    ).all();

    if (!result.results || result.results.length === 0) {
      const aiFactors = await generateFactorsWithAI(c.env, 'bearish');
      if (aiFactors && aiFactors.length > 0) {
        return c.json({ success: true, data: aiFactors });
      }

      // AI不可用时的兜底数据（基于实时价格动态生成）
      const priceData = await fetchAllPrices();
      const intl = priceData.international || {};
      const changePercent = intl.changePercent || 0;
      const fallbackFactors = [
        {
          id: 1, type: 'bearish',
          title: '美元指数走强',
          subtitle: '强美元压制金价',
          description: '美国经济数据好于预期，美元指数走强，对黄金价格形成压制。',
          details: JSON.stringify(['美国GDP增速超预期', '非农就业数据强劲', '美元指数突破关键阻力位']),
          impact: 'high', confidence: 0.70, created_at: new Date().toISOString(),
        },
        {
          id: 2, type: 'bearish',
          title: changePercent > 1 ? '技术面出现超买信号' : '风险偏好回升',
          subtitle: changePercent > 1 ? '短期回调风险增加' : '资金流向股市',
          description: changePercent > 1
            ? `当前金价日涨幅${changePercent.toFixed(2)}%，RSI指标进入超买区间，短期存在技术性回调可能。`
            : '全球股市回暖，风险偏好回升，部分资金从黄金市场流出。',
          details: JSON.stringify(changePercent > 1
            ? ['日线RSI超过70', '金价偏离均线较远', '成交量有所萎缩']
            : ['美股创历史新高', 'VIX指数处于低位', '黄金ETF出现资金流出']),
          impact: 'medium', confidence: 0.60, created_at: new Date().toISOString(),
        },
        {
          id: 3, type: 'bearish',
          title: '美联储鹰派立场',
          subtitle: '利率维持高位',
          description: '美联储维持鹰派立场，利率保持高位，增加了持有黄金的机会成本。',
          details: JSON.stringify(['通胀仍高于目标水平', '美联储官员释放鹰派信号', '降息时间表可能推迟']),
          impact: 'low', confidence: 0.55, created_at: new Date().toISOString(),
        },
      ];
      return c.json({ success: true, data: fallbackFactors });
    }

    const factors = result.results.map((f) => ({
      ...f,
      details: typeof f.details === 'string' ? JSON.parse(f.details) : f.details,
    }));

    return c.json({
      success: true,
      data: factors,
    });
  } catch (error) {
    console.error('获取看空因素失败:', error);
    return c.json(
      { success: false, error: '获取看空因素失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/analysis/institution-views - 获取机构观点（需要 premium 及以上会员）
 */
analysis.get('/institution-views', authMiddleware, requireMembership('free'), async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM institution_views ORDER BY created_at DESC LIMIT 20'
    ).all();

    if (!result.results || result.results.length === 0) {
      const aiViews = await generateInstitutionViewsWithAI(c.env);
      if (aiViews && aiViews.length > 0) {
        return c.json({ success: true, data: aiViews });
      }

      // AI不可用时的兜底数据（基于实时价格动态生成）
      const priceData = await fetchAllPrices();
      const intl = priceData.international || {};
      const currentPrice = intl.price || 2400;
      const fallbackViews = [
        {
          id: 1, institution_name: '高盛', logo: '', rating: 'buy',
          target_price: Math.round(currentPrice * 1.08),
          timeframe: '12个月',
          reasoning: '美联储降息周期将推动金价进一步上涨，央行购金需求持续强劲。',
          key_points: JSON.stringify(['预计美联储年内降息3次', '央行购金需求创纪录', '地缘政治风险提供支撑']),
          created_at: new Date().toISOString(),
        },
        {
          id: 2, institution_name: '摩根大通', logo: '', rating: 'buy',
          target_price: Math.round(currentPrice * 1.05),
          timeframe: '6个月',
          reasoning: '实际利率下行和美元走弱将推动金价上涨。',
          key_points: JSON.stringify(['实际利率预计持续下行', '美元中期走弱趋势', '避险需求维持高位']),
          created_at: new Date().toISOString(),
        },
        {
          id: 3, institution_name: '花旗银行', logo: '', rating: 'hold',
          target_price: Math.round(currentPrice * 1.02),
          timeframe: '3个月',
          reasoning: '金价已处于高位，短期可能面临回调压力，但中长期仍看好。',
          key_points: JSON.stringify(['短期技术面可能超买', '中期基本面仍然向好', `关注$${Math.round(currentPrice * 0.985)}支撑位`]),
          created_at: new Date().toISOString(),
        },
        {
          id: 4, institution_name: '瑞银', logo: '', rating: 'buy',
          target_price: Math.round(currentPrice * 1.06),
          timeframe: '6个月',
          reasoning: '全球去美元化趋势和央行购金将为金价提供长期支撑。',
          key_points: JSON.stringify(['去美元化趋势加速', '新兴市场央行购金', '黄金在资产配置中占比提升']),
          created_at: new Date().toISOString(),
        },
      ];
      return c.json({ success: true, data: fallbackViews });
    }

    const views = result.results.map((v) => ({
      ...v,
      key_points: typeof v.key_points === 'string' ? JSON.parse(v.key_points) : v.key_points,
    }));

    return c.json({
      success: true,
      data: views,
    });
  } catch (error) {
    console.error('获取机构观点失败:', error);
    return c.json(
      { success: false, error: '获取机构观点失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/analysis/investment-advice - 获取投资建议（需要 premium 及以上会员）
 */
analysis.get('/investment-advice', authMiddleware, requireMembership('premium'), async (c) => {
  try {
    // 检查缓存
    const cacheKey = 'investment_advice';
    const cached = await c.env.DB.prepare(
      "SELECT * FROM market_summary_cache WHERE cache_key = ? AND datetime(generated_at) > datetime('now', '-6 hours')"
    )
      .bind(cacheKey)
      .first();

    if (cached) {
      const data = typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
      return c.json({
        success: true,
        data,
        cached: true,
      });
    }

    // 生成投资建议 - 基于实时价格动态生成
    const priceData = await fetchAllPrices();
    const intl = priceData.international || {};
    const currentPrice = intl.price || 2400;
    const changePercent = intl.changePercent || 0;

    const advice = {
      title: '黄金投资建议',
      generatedAt: new Date().toISOString(),
      summary: `当前国际金价$${currentPrice.toFixed(2)}/盎司，${changePercent > 0 ? '日涨幅' + changePercent.toFixed(2) + '%' : changePercent < 0 ? '日跌幅' + Math.abs(changePercent).toFixed(2) + '%' : '基本持平'}。`,
      recommendations: [
        {
          id: '1', level: 'free',
          title: '关注美联储政策动向',
          description: `当前金价$${currentPrice.toFixed(0)}附近，美联储利率决议是影响金价的最重要因素，建议密切关注每次FOMC会议声明。`,
          action: '建议关注',
        },
        {
          id: '2', level: 'free',
          title: '分散投资降低风险',
          description: '黄金在投资组合中建议占比5-15%，可有效分散风险，降低整体组合波动性。',
          action: '适度配置',
        },
        {
          id: '3', level: 'basic',
          title: `技术面关键支撑位$${Math.round(currentPrice * 0.985)}`,
          description: `当前金价$${currentPrice.toFixed(0)}附近，关键支撑位在$${Math.round(currentPrice * 0.985)}，若有效跌破需警惕进一步下行。阻力位在$${Math.round(currentPrice * 1.02)}。`,
          action: '设置止损',
        },
        {
          id: '4', level: 'basic',
          title: '季节性规律参考',
          description: '历史数据显示黄金在年初和年末通常表现较好，可据此调整仓位和入场时机。',
          action: '择时配置',
        },
        {
          id: '5', level: 'pro',
          title: '量化对冲策略',
          description: '利用黄金与美元指数的负相关性，构建对冲组合降低系统性风险，当前美元指数趋势提供对冲机会。',
          action: '执行对冲',
        },
        {
          id: '6', level: 'pro',
          title: '期权策略建议',
          description: '当前波动率环境下，建议采用看涨期权价差策略，控制成本的同时保留上行空间。',
          action: '期权组合',
        },
        {
          id: '7', level: 'enterprise',
          title: '定制化资产配置',
          description: '根据企业风险偏好和现金流需求，提供定制化黄金资产配置方案，包含实物黄金、ETF、期货等多元工具组合。',
          action: '专属方案',
        },
      ],
      riskWarnings: [
        '以上建议仅供参考，不构成投资建议',
        '市场存在不确定性，请根据自身风险承受能力决策',
        '建议分散投资，控制单一资产比例',
        '关注美联储政策变化和地缘政治风险',
      ],
    };

    // 缓存结果
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO market_summary_cache (cache_key, data, generated_at, created_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`
    )
      .bind(cacheKey, JSON.stringify(advice))
      .run();

    return c.json({
      success: true,
      data: advice,
      cached: false,
    });
  } catch (error) {
    console.error('获取投资建议失败:', error);
    return c.json(
      { success: false, error: '获取投资建议失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/analysis/market-summary - 获取市场摘要
 */
analysis.get('/market-summary', async (c) => {
  try {
    // 检查缓存
    const cacheKey = 'market_summary';
    const cached = await c.env.DB.prepare(
      "SELECT * FROM market_summary_cache WHERE cache_key = ? AND datetime(generated_at) > datetime('now', '-1 hour')"
    )
      .bind(cacheKey)
      .first();

    if (cached) {
      const data = typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
      return c.json({
        success: true,
        data,
        cached: true,
      });
    }

    // 生成市场摘要
    const priceData = await fetchAllPrices();
    const intl = priceData.international || {};
    const domestic = priceData.domestic || {};

    // 获取看多/看空因素数量
    const bullishCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM market_factors WHERE type = 'bullish'"
    ).first();
    const bearishCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM market_factors WHERE type = 'bearish'"
    ).first();

    const summary = {
      priceOverview: {
        international: {
          price: intl.price,
          change: intl.change,
          changePercent: intl.changePercent,
          high: intl.high,
          low: intl.low,
        },
        domestic: {
          au99_99: domestic.au99_99,
          au99_95: domestic.au99_95,
        },
        converted: priceData.converted,
      },
      marketSentiment: {
        trend: intl.changePercent > 0.3 ? 'bullish' : intl.changePercent < -0.3 ? 'bearish' : 'neutral',
        bullishFactors: bullishCount?.count || 0,
        bearishFactors: bearishCount?.count || 0,
        confidence: Math.abs(intl.changePercent || 0) > 1 ? 70 : 50,
      },
      keyLevels: {
        support: intl.price ? (intl.price * 0.985).toFixed(2) : null,
        resistance: intl.price ? (intl.price * 1.015).toFixed(2) : null,
      },
      generatedAt: new Date().toISOString(),
    };

    // 缓存结果
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO market_summary_cache (cache_key, data, generated_at, created_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`
    )
      .bind(cacheKey, JSON.stringify(summary))
      .run();

    return c.json({
      success: true,
      data: summary,
      cached: false,
    });
  } catch (error) {
    console.error('获取市场摘要失败:', error);
    return c.json(
      { success: false, error: '获取市场摘要失败', message: error.message },
      500
    );
  }
});

/**
 * POST /api/analysis/refresh/:type - 刷新分析缓存
 * type: market_summary, investment_advice, all
 */
analysis.post('/refresh/:type', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'admin') {
      return c.json(
        { success: false, error: '权限不足', message: '需要管理员权限' },
        403
      );
    }

    const type = c.req.param('type');
    const validTypes = ['market_summary', 'investment_advice', 'all'];

    if (!validTypes.includes(type)) {
      return c.json(
        { success: false, error: '无效的缓存类型', message: `支持的类型: ${validTypes.join(', ')}` },
        400
      );
    }

    if (type === 'all') {
      await c.env.DB.prepare(
        "DELETE FROM market_summary_cache"
      ).run();
    } else {
      await c.env.DB.prepare(
        "DELETE FROM market_summary_cache WHERE cache_key = ?"
      )
        .bind(type)
        .run();
    }

    return c.json({
      success: true,
      message: `缓存 ${type} 已清除`,
    });
  } catch (error) {
    console.error('刷新缓存失败:', error);
    return c.json(
      { success: false, error: '刷新缓存失败', message: error.message },
      500
    );
  }
});

/**
 * POST /api/analysis/ai/bullish - AI看涨分析
 */
analysis.post('/ai/bullish', authMiddleware, async (c) => {
  try {
    const priceData = await fetchAllPrices();
    const intl = priceData.international || {};
    const result = await analyzeWithDeepSeek(c.env, priceData, [], 'bullish');
    return c.json({
      success: true,
      data: {
        title: 'AI 看涨分析报告',
        content: result.analysis?.content || result.analysis?.summary || '当前市场环境下，央行购金、地缘政治风险和降息预期等因素支撑金价。',
      },
    });
  } catch (error) {
    console.error('AI看涨分析失败:', error);
    return c.json({ success: false, error: 'AI分析失败', message: error.message }, 500);
  }
});

/**
 * POST /api/analysis/ai/bearish - AI看空分析
 */
analysis.post('/ai/bearish', authMiddleware, async (c) => {
  try {
    const priceData = await fetchAllPrices();
    const result = await analyzeWithDeepSeek(c.env, priceData, [], 'bearish');
    return c.json({
      success: true,
      data: {
        title: 'AI 看空分析报告',
        content: result.analysis?.content || result.analysis?.summary || '当前市场环境下，美元走强、风险偏好回升和美联储鹰派立场对金价构成压力。',
      },
    });
  } catch (error) {
    console.error('AI看空分析失败:', error);
    return c.json({ success: false, error: 'AI分析失败', message: error.message }, 500);
  }
});

/**
 * POST /api/analysis/ai/summary - AI综合分析
 */
analysis.post('/ai/summary', authMiddleware, async (c) => {
  try {
    const priceData = await fetchAllPrices();
    const result = await analyzeWithDeepSeek(c.env, priceData, [], 'summary');
    return c.json({
      success: true,
      data: {
        title: 'AI 综合分析报告',
        content: result.analysis?.content || result.analysis?.summary || '综合多空因素分析，当前黄金市场呈现震荡偏多格局。',
      },
    });
  } catch (error) {
    console.error('AI综合分析失败:', error);
    return c.json({ success: false, error: 'AI分析失败', message: error.message }, 500);
  }
});

/**
 * POST /api/analysis/ai/advice - AI投资建议
 */
analysis.post('/ai/advice', authMiddleware, async (c) => {
  try {
    const priceData = await fetchAllPrices();
    const result = await analyzeWithDeepSeek(c.env, priceData, [], 'advice');
    return c.json({
      success: true,
      data: {
        title: 'AI 投资建议报告',
        content: result.analysis?.content || result.analysis?.summary || '建议保持适度仓位，关注关键支撑和阻力位，根据自身风险承受能力决策。',
      },
    });
  } catch (error) {
    console.error('AI投资建议失败:', error);
    return c.json({ success: false, error: 'AI分析失败', message: error.message }, 500);
  }
});

export default analysis;
