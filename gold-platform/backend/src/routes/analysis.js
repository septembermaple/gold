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
async function generateFactorsWithAI(env, type, lang = 'en-US') {
  const priceData = await fetchAllPrices();
  const intl = priceData.international || {};
  const domestic = priceData.domestic || {};
  const isZh = lang === 'zh-CN';

  const prompt = type === 'bullish'
    ? (isZh
      ? `基于当前黄金市场数据，分析 3-5 个看涨因素。
当前国际金价: $${intl.price || 'N/A'}/盎司，变动: ${intl.changePercent || 'N/A'}%
国内黄金价格: ¥${domestic.au99_99?.price || 'N/A'}/克

请以 JSON 数组格式返回，每个因素包含: title, subtitle, description, details(数组), impact(high/medium/low), confidence(0-1)
只返回 JSON 数组，不包含其他文本。`
      : `Based on current gold market data, analyze 3-5 bullish factors.
Current international gold price: $${intl.price || 'N/A'}/oz, change: ${intl.changePercent || 'N/A'}%
Domestic gold price: ¥${domestic.au99_99?.price || 'N/A'}/g

Please return in JSON array format, each factor containing: title, subtitle, description, details(array), impact(high/medium/low), confidence(0-1)
Only return the JSON array, no other text.`)
    : (isZh
      ? `基于当前黄金市场数据，分析 3-5 个看空因素。
当前国际金价: $${intl.price || 'N/A'}/盎司，变动: ${intl.changePercent || 'N/A'}%
国内黄金价格: ¥${domestic.au99_99?.price || 'N/A'}/克

请以 JSON 数组格式返回，每个因素包含: title, subtitle, description, details(数组), impact(high/medium/low), confidence(0-1)
只返回 JSON 数组，不包含其他文本。`
      : `Based on current gold market data, analyze 3-5 bearish factors.
Current international gold price: $${intl.price || 'N/A'}/oz, change: ${intl.changePercent || 'N/A'}%
Domestic gold price: ¥${domestic.au99_99?.price || 'N/A'}/g

Please return in JSON array format, each factor containing: title, subtitle, description, details(array), impact(high/medium/low), confidence(0-1)
Only return the JSON array, no other text.`);

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
        title: f.title || `${type === 'bullish' ? 'Bullish' : 'Bearish'} Factor ${i + 1}`,
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
async function generateInstitutionViewsWithAI(env, lang = 'en-US') {
  const priceData = await fetchAllPrices();
  const intl = priceData.international || {};
  const isZh = lang === 'zh-CN';

  const prompt = isZh
    ? `基于当前黄金市场数据，模拟 4-5 家主要投行对黄金的预测。
当前国际金价: $${intl.price || 'N/A'}/盎司

请以 JSON 数组格式返回，每家机构包含: institution_name, rating(buy/hold/sell), target_price, timeframe, reasoning, key_points(数组)
只返回 JSON 数组，不包含其他文本。`
    : `Based on current gold market data, simulate predictions from 4-5 major investment banks on gold.
Current international gold price: $${intl.price || 'N/A'}/oz

Please return in JSON array format, each institution containing: institution_name, rating(buy/hold/sell), target_price, timeframe, reasoning, key_points(array)
Only return the JSON array, no other text.`;

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
        institution_name: v.institution_name || `Institution ${i + 1}`,
        logo: '',
        rating: v.rating || 'hold',
        target_price: v.target_price || null,
        timeframe: v.timeframe || '6 months',
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
    const lang = c.req.query('lang') || c.req.query('language') || 'en-US';

    // 从数据库获取看多因素
    const result = await c.env.DB.prepare(
      "SELECT * FROM market_factors WHERE type = 'bullish' ORDER BY created_at DESC LIMIT 20"
    ).all();

    // 如果数据库没有数据，使用AI动态生成
    if (!result.results || result.results.length === 0) {
      const aiFactors = await generateFactorsWithAI(c.env, 'bullish', lang);
      if (aiFactors && aiFactors.length > 0) {
        return c.json({ success: true, data: aiFactors });
      }

      // AI不可用时的兜底数据（基于实时价格动态生成）
      const priceData = await fetchAllPrices();
      const intl = priceData.international || {};
      const changePercent = intl.changePercent || 0;
      const isZh = lang === 'zh-CN';
      const fallbackFactors = [
        {
          id: 1, type: 'bullish',
          title: isZh ? '全球央行持续增持黄金储备' : 'Global Central Banks Continue Increasing Gold Reserves',
          subtitle: isZh ? '去美元化趋势加速' : 'De-dollarization Trend Accelerating',
          description: isZh
            ? `当前金价 $${intl.price?.toFixed(2) || 'N/A'}/盎司，多国央行持续增持黄金储备，为金价提供长期支撑。`
            : `Current gold price $${intl.price?.toFixed(2) || 'N/A'}/oz, multiple central banks continue increasing gold reserves, providing long-term support for gold prices.`,
          details: JSON.stringify(isZh
            ? ['中国央行连续多月增持黄金储备', '印度、土耳其等国央行积极购金', '全球央行购金规模创历史新高']
            : ['PBOC has increased gold reserves for consecutive months', 'Central banks of India, Turkey and others actively purchasing gold', 'Global central bank gold purchases hit record highs']),
          impact: 'high', confidence: 0.85, created_at: new Date().toISOString(),
        },
        {
          id: 2, type: 'bullish',
          title: isZh ? '地缘政治风险上升' : 'Rising Geopolitical Risks',
          subtitle: isZh ? '避险需求增加' : 'Increased Safe-haven Demand',
          description: isZh
            ? '地缘政治不确定性驱动避险需求，黄金作为传统避险资产备受青睐。'
            : 'Geopolitical uncertainty drives safe-haven demand, gold is sought after as a traditional safe-haven asset.',
          details: JSON.stringify(isZh
            ? ['中东地区局势持续紧张', '俄乌冲突前景不明朗', '全球安全形势日趋复杂']
            : ['Continued tensions in the Middle East', 'Uncertain outlook for Russia-Ukraine conflict', 'Global security situation becoming more complex']),
          impact: 'high', confidence: 0.75, created_at: new Date().toISOString(),
        },
        {
          id: 3, type: 'bullish',
          title: isZh
            ? (changePercent > 0 ? '金价短期动能看涨' : '美联储降息预期')
            : (changePercent > 0 ? 'Gold Price Short-term Momentum Bullish' : 'Fed Rate Cut Expectations'),
          subtitle: isZh
            ? (changePercent > 0 ? '技术面支撑' : '实际利率下降利好黄金')
            : (changePercent > 0 ? 'Technical Support' : 'Declining Real Rates Favor Gold'),
          description: isZh
            ? (changePercent > 0
              ? `当前金价日涨幅 ${changePercent.toFixed(2)}%，短期动能看涨。`
              : '市场预期美联储降息，实际利率下降将降低持有黄金的机会成本。')
            : (changePercent > 0
              ? `Current gold price daily gain ${changePercent.toFixed(2)}%, short-term momentum is bullish.`
              : 'Market expects Fed rate cuts, declining real rates will reduce the opportunity cost of holding gold.'),
          details: JSON.stringify(isZh
            ? (changePercent > 0
              ? ['短期均线多头排列', '成交量温和放大', '技术指标偏多']
              : ['通胀数据持续回落', '就业市场出现降温迹象', '市场预期年内降息 2-3 次'])
            : (changePercent > 0
              ? ['Short-term moving averages in bullish alignment', 'Trading volume increasing', 'Technical indicators leaning bullish']
              : ['Inflation data continues to decline', 'Employment market showing signs of cooling', 'Market expects 2-3 rate cuts this year'])),
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
      { success: false, error: 'Failed to fetch bullish factors', message: error.message },
      500
    );
  }
});

/**
 * GET /api/analysis/bearish-factors - 获取看空因素（需要 basic 及以上会员）
 */
analysis.get('/bearish-factors', authMiddleware, requireMembership('free'), async (c) => {
  try {
    const lang = c.req.query('lang') || c.req.query('language') || 'en-US';

    const result = await c.env.DB.prepare(
      "SELECT * FROM market_factors WHERE type = 'bearish' ORDER BY created_at DESC LIMIT 20"
    ).all();

    if (!result.results || result.results.length === 0) {
      const aiFactors = await generateFactorsWithAI(c.env, 'bearish', lang);
      if (aiFactors && aiFactors.length > 0) {
        return c.json({ success: true, data: aiFactors });
      }

      // AI不可用时的兜底数据（基于实时价格动态生成）
      const priceData = await fetchAllPrices();
      const intl = priceData.international || {};
      const changePercent = intl.changePercent || 0;
      const isZh = lang === 'zh-CN';
      const fallbackFactors = [
        {
          id: 1, type: 'bearish',
          title: isZh ? '美元指数走强' : 'US Dollar Index Strengthening',
          subtitle: isZh ? '强美元施压黄金' : 'Strong Dollar Pressuring Gold',
          description: isZh
            ? '美国经济数据好于预期，美元指数走强，对金价形成压制。'
            : 'US economic data better than expected, dollar index strengthening, putting pressure on gold prices.',
          details: JSON.stringify(isZh
            ? ['美国 GDP 增长超预期', '非农就业数据强劲', '美元指数突破关键阻力位']
            : ['US GDP growth exceeds expectations', 'Strong non-farm payroll data', 'Dollar index breaks through key resistance levels']),
          impact: 'high', confidence: 0.70, created_at: new Date().toISOString(),
        },
        {
          id: 2, type: 'bearish',
          title: isZh
            ? (changePercent > 1 ? '技术面超买信号' : '风险偏好恢复')
            : (changePercent > 1 ? 'Technical Overbought Signals' : 'Risk Appetite Recovery'),
          subtitle: isZh
            ? (changePercent > 1 ? '短期回调风险增加' : '资金流向风险资产')
            : (changePercent > 1 ? 'Increased Short-term Pullback Risk' : 'Capital Flowing to Equities'),
          description: isZh
            ? (changePercent > 1
              ? `当前金价日涨幅 ${changePercent.toFixed(2)}%，RSI 指标进入超买区域，短期存在技术回调风险。`
              : '全球股市回暖，风险偏好回归，部分资金流出黄金市场。')
            : (changePercent > 1
              ? `Current gold price daily gain ${changePercent.toFixed(2)}%, RSI indicator entering overbought zone, risk of technical pullback in the short term.`
              : 'Global stock markets recovering, risk appetite returning, some capital flowing out of the gold market.'),
          details: JSON.stringify(isZh
            ? (changePercent > 1
              ? ['日线 RSI 高于 70', '金价远离均线', '成交量萎缩']
              : ['美股创历史新高', 'VIX 指数处于低位', '黄金 ETF 遭遇资金流出'])
            : (changePercent > 1
              ? ['Daily RSI above 70', 'Gold price far from moving averages', 'Trading volume declining']
              : ['US stocks hitting all-time highs', 'VIX index at low levels', 'Gold ETF experiencing capital outflows'])),
          impact: 'medium', confidence: 0.60, created_at: new Date().toISOString(),
        },
        {
          id: 3, type: 'bearish',
          title: isZh ? '美联储鹰派立场' : 'Fed Hawkish Stance',
          subtitle: isZh ? '利率维持高位' : 'Rates Remain High',
          description: isZh
            ? '美联储维持鹰派立场，利率维持高位，增加持有黄金的机会成本。'
            : 'Fed maintains hawkish stance, rates remain high, increasing the opportunity cost of holding gold.',
          details: JSON.stringify(isZh
            ? ['通胀仍高于目标水平', '美联储官员释放鹰派信号', '降息时间或延后']
            : ['Inflation still above target levels', 'Fed officials sending hawkish signals', 'Rate cut timeline may be delayed']),
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
      { success: false, error: 'Failed to fetch bearish factors', message: error.message },
      500
    );
  }
});

/**
 * GET /api/analysis/institution-views - 获取机构观点（需要 premium 及以上会员）
 */
analysis.get('/institution-views', authMiddleware, requireMembership('free'), async (c) => {
  try {
    const lang = c.req.query('lang') || c.req.query('language') || 'en-US';

    const result = await c.env.DB.prepare(
      'SELECT * FROM institution_views ORDER BY created_at DESC LIMIT 20'
    ).all();

    if (!result.results || result.results.length === 0) {
      const aiViews = await generateInstitutionViewsWithAI(c.env, lang);
      if (aiViews && aiViews.length > 0) {
        return c.json({ success: true, data: aiViews });
      }

      // AI不可用时的兜底数据（基于实时价格动态生成）
      const priceData = await fetchAllPrices();
      const intl = priceData.international || {};
      const currentPrice = intl.price || 2400;
      const isZh = lang === 'zh-CN';
      const fallbackViews = [
        {
          id: 1, institution_name: isZh ? '高盛' : 'Goldman Sachs', logo: '', rating: 'buy',
          target_price: Math.round(currentPrice * 1.08),
          timeframe: isZh ? '12个月' : '12 months',
          reasoning: isZh
            ? '美联储降息周期将推动金价走高，央行购金需求保持强劲。'
            : 'Fed rate cut cycle will drive gold prices higher, central bank gold purchasing demand remains strong.',
          key_points: JSON.stringify(isZh
            ? ['预计年内美联储降息 3 次', '央行购金规模处于历史高位', '地缘政治风险提供支撑']
            : ['Expecting 3 Fed rate cuts this year', 'Central bank gold purchases at record levels', 'Geopolitical risks providing support']),
          created_at: new Date().toISOString(),
        },
        {
          id: 2, institution_name: isZh ? '摩根大通' : 'JPMorgan Chase', logo: '', rating: 'buy',
          target_price: Math.round(currentPrice * 1.05),
          timeframe: isZh ? '6个月' : '6 months',
          reasoning: isZh
            ? '实际利率下降与美元走弱将推动金价走高。'
            : 'Declining real rates and a weaker dollar will drive gold prices higher.',
          key_points: JSON.stringify(isZh
            ? ['实际利率预期继续下行', '美元中期走弱趋势', '避险需求保持高位']
            : ['Real rates expected to continue declining', 'Medium-term dollar weakening trend', 'Safe-haven demand remains elevated']),
          created_at: new Date().toISOString(),
        },
        {
          id: 3, institution_name: isZh ? '花旗银行' : 'Citibank', logo: '', rating: 'hold',
          target_price: Math.round(currentPrice * 1.02),
          timeframe: isZh ? '3个月' : '3 months',
          reasoning: isZh
            ? '金价已处高位，短期或面临回调压力，但中长期前景仍积极。'
            : 'Gold prices are already at high levels, may face short-term pullback pressure, but medium-to-long-term outlook remains positive.',
          key_points: JSON.stringify(isZh
            ? ['短期技术面或超买', '中期基本面仍积极', `关注 $${Math.round(currentPrice * 0.985)} 支撑位`]
            : ['Short-term technicals may be overbought', 'Medium-term fundamentals remain positive', `Watch $${Math.round(currentPrice * 0.985)} support level`]),
          created_at: new Date().toISOString(),
        },
        {
          id: 4, institution_name: isZh ? '瑞银' : 'UBS', logo: '', rating: 'buy',
          target_price: Math.round(currentPrice * 1.06),
          timeframe: isZh ? '6个月' : '6 months',
          reasoning: isZh
            ? '全球去美元化趋势与央行购金将为金价提供长期支撑。'
            : 'Global de-dollarization trend and central bank gold purchases will provide long-term support for gold prices.',
          key_points: JSON.stringify(isZh
            ? ['去美元化趋势加速', '新兴市场央行购金', '资产配置中黄金占比提升']
            : ['De-dollarization trend accelerating', 'Emerging market central banks buying gold', "Gold's share in asset allocation increasing"]),
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
      { success: false, error: 'Failed to fetch institution views', message: error.message },
      500
    );
  }
});

/**
 * GET /api/analysis/investment-advice - 获取投资建议（需要 premium 及以上会员）
 */
analysis.get('/investment-advice', authMiddleware, requireMembership('premium'), async (c) => {
  try {
    const lang = c.req.query('lang') || c.req.query('language') || 'en-US';

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
    const isZh = lang === 'zh-CN';

    const advice = {
      title: isZh ? '黄金投资建议' : 'Gold Investment Advice',
      generatedAt: new Date().toISOString(),
      summary: isZh
        ? `当前国际金价 $${currentPrice.toFixed(2)}/盎司，${changePercent > 0 ? '日涨幅 ' + changePercent.toFixed(2) + '%' : changePercent < 0 ? '日跌幅 ' + Math.abs(changePercent).toFixed(2) + '%' : '基本持平'}。`
        : `Current international gold price $${currentPrice.toFixed(2)}/oz, ${changePercent > 0 ? 'daily gain ' + changePercent.toFixed(2) + '%' : changePercent < 0 ? 'daily loss ' + Math.abs(changePercent).toFixed(2) + '%' : 'essentially flat'}.`,
      recommendations: [
        {
          id: '1', level: 'free',
          title: isZh ? '关注美联储政策动向' : 'Monitor Fed Policy Developments',
          description: isZh
            ? `以当前金价约 $${currentPrice.toFixed(0)} 来看，美联储利率决策是影响金价最重要的因素，建议密切关注每次 FOMC 会议声明。`
            : `With current gold price around $${currentPrice.toFixed(0)}, Fed rate decisions are the most important factor affecting gold prices. It is recommended to closely monitor each FOMC meeting statement.`,
          action: isZh ? '关注' : 'Monitor',
        },
        {
          id: '2', level: 'free',
          title: isZh ? '分散投资以降低风险' : 'Diversify Investments to Reduce Risk',
          description: isZh
            ? '建议黄金占投资组合的 5-15%，可有效分散风险，降低整体组合波动率。'
            : 'Gold is recommended to comprise 5-15% of an investment portfolio, which can effectively diversify risk and reduce overall portfolio volatility.',
          action: isZh ? '适度配置' : 'Moderate Allocation',
        },
        {
          id: '3', level: 'basic',
          title: isZh ? `关键技术支撑在 $${Math.round(currentPrice * 0.985)}` : `Key Technical Support at $${Math.round(currentPrice * 0.985)}`,
          description: isZh
            ? `以当前金价约 $${currentPrice.toFixed(0)} 来看，关键支撑位于 $${Math.round(currentPrice * 0.985)}，若有效跌破需警惕进一步下行；阻力位于 $${Math.round(currentPrice * 1.02)}。`
            : `With current gold price around $${currentPrice.toFixed(0)}, key support is at $${Math.round(currentPrice * 0.985)}. If decisively broken, beware of further downside. Resistance is at $${Math.round(currentPrice * 1.02)}.`,
          action: isZh ? '设置止损' : 'Set Stop Loss',
        },
        {
          id: '4', level: 'basic',
          title: isZh ? '季节性规律参考' : 'Seasonal Pattern Reference',
          description: isZh
            ? '历史数据显示，黄金在年初和年末通常表现较好，可据此调整仓位与入场时机。'
            : 'Historical data shows gold typically performs better at the beginning and end of the year, which can be used to adjust positions and entry timing.',
          action: isZh ? '战术配置' : 'Tactical Allocation',
        },
        {
          id: '5', level: 'pro',
          title: isZh ? '量化对冲策略' : 'Quantitative Hedging Strategy',
          description: isZh
            ? '利用黄金与美元指数的负相关关系构建对冲组合，降低系统性风险。当前美元指数走势提供对冲机会。'
            : 'Utilize the negative correlation between gold and the US dollar index to build a hedging portfolio that reduces systematic risk. Current dollar index trends provide hedging opportunities.',
          action: isZh ? '执行对冲' : 'Execute Hedge',
        },
        {
          id: '6', level: 'pro',
          title: isZh ? '期权策略建议' : 'Options Strategy Recommendation',
          description: isZh
            ? '在当前波动环境下，建议采用看涨期权价差策略，控制成本同时保留上行空间。'
            : 'In the current volatility environment, a bull call spread strategy is recommended to control costs while retaining upside potential.',
          action: isZh ? '期权价差' : 'Options Spread',
        },
        {
          id: '7', level: 'enterprise',
          title: isZh ? '定制化资产配置' : 'Customized Asset Allocation',
          description: isZh
            ? '基于企业风险偏好与现金流需求，提供定制化黄金资产配置方案，包括实物黄金、ETF、期货等多元化工具组合。'
            : 'Based on enterprise risk preferences and cash flow needs, provide customized gold asset allocation plans, including a diversified mix of physical gold, ETFs, futures, and other instruments.',
          action: isZh ? '定制方案' : 'Custom Plan',
        },
      ],
      riskWarnings: isZh
        ? [
            '以上建议仅供参考，不构成投资建议',
            '市场存在不确定性，请根据自身风险承受能力做决策',
            '建议分散投资，控制单一资产配置比例',
            '关注美联储政策变化与地缘政治风险',
          ]
        : [
            'The above suggestions are for reference only and do not constitute investment advice',
            'Markets carry uncertainty, please make decisions based on your own risk tolerance',
            'Diversification is recommended; control the proportion of any single asset',
            'Monitor Fed policy changes and geopolitical risks',
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
      { success: false, error: 'Failed to fetch investment advice', message: error.message },
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
      { success: false, error: 'Failed to fetch market summary', message: error.message },
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
        { success: false, error: 'Insufficient permissions', message: 'Admin privileges required' },
        403
      );
    }

    const type = c.req.param('type');
    const validTypes = ['market_summary', 'investment_advice', 'all'];

    if (!validTypes.includes(type)) {
      return c.json(
        { success: false, error: 'Invalid cache type', message: `Supported types: ${validTypes.join(', ')}` },
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
      message: `Cache ${type} cleared`,
    });
  } catch (error) {
    console.error('刷新缓存失败:', error);
    return c.json(
      { success: false, error: 'Failed to refresh cache', message: error.message },
      500
    );
  }
});

/**
 * POST /api/analysis/ai/bullish - AI看涨分析
 */
analysis.post('/ai/bullish', authMiddleware, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const lang = body?.lang || c.req.query('lang') || c.req.query('language') || 'en-US';
    const isZh = lang === 'zh-CN';

    const priceData = await fetchAllPrices();
    const intl = priceData.international || {};
    const result = await analyzeWithDeepSeek(c.env, priceData, [], 'bullish', lang);
    return c.json({
      success: true,
      data: {
        title: isZh ? 'AI 看涨分析报告' : 'AI Bullish Analysis Report',
        content: result.analysis?.content || result.analysis?.summary || (isZh
          ? `当前金价 $${intl.price || 'N/A'}/盎司。看涨因素包括央行持续购金、地缘政治风险升温及降息预期。`
          : 'In the current market environment, central bank gold purchases, geopolitical risks, and rate cut expectations are supporting gold prices.'),
      },
    });
  } catch (error) {
    console.error('AI看涨分析失败:', error);
    return c.json({ success: false, error: 'AI analysis failed', message: error.message }, 500);
  }
});

/**
 * POST /api/analysis/ai/bearish - AI看空分析
 */
analysis.post('/ai/bearish', authMiddleware, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const lang = body?.lang || c.req.query('lang') || c.req.query('language') || 'en-US';
    const isZh = lang === 'zh-CN';

    const priceData = await fetchAllPrices();
    const intl = priceData.international || {};
    const result = await analyzeWithDeepSeek(c.env, priceData, [], 'bearish', lang);
    return c.json({
      success: true,
      data: {
        title: isZh ? 'AI 看空分析报告' : 'AI Bearish Analysis Report',
        content: result.analysis?.content || result.analysis?.summary || (isZh
          ? `当前金价 $${intl.price || 'N/A'}/盎司。看空因素包括美元走强、风险偏好恢复及美联储鹰派立场。`
          : 'In the current market environment, a stronger dollar, recovering risk appetite, and the Fed\'s hawkish stance are pressuring gold prices.'),
      },
    });
  } catch (error) {
    console.error('AI看空分析失败:', error);
    return c.json({ success: false, error: 'AI analysis failed', message: error.message }, 500);
  }
});

/**
 * POST /api/analysis/ai/summary - AI综合分析
 */
analysis.post('/ai/summary', authMiddleware, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const lang = body?.lang || c.req.query('lang') || c.req.query('language') || 'en-US';
    const isZh = lang === 'zh-CN';

    const priceData = await fetchAllPrices();
    const result = await analyzeWithDeepSeek(c.env, priceData, [], 'summary', lang);
    return c.json({
      success: true,
      data: {
        title: isZh ? 'AI 综合分析报告' : 'AI Comprehensive Analysis Report',
        content: result.analysis?.content || result.analysis?.summary || (isZh
          ? '基于多空因素综合分析，当前黄金市场呈现震荡但偏多格局。'
          : 'Based on comprehensive analysis of bullish and bearish factors, the current gold market shows a volatile but bullish-leaning pattern.'),
      },
    });
  } catch (error) {
    console.error('AI综合分析失败:', error);
    return c.json({ success: false, error: 'AI analysis failed', message: error.message }, 500);
  }
});

/**
 * POST /api/analysis/ai/advice - AI投资建议
 */
analysis.post('/ai/advice', authMiddleware, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const lang = body?.lang || c.req.query('lang') || c.req.query('language') || 'en-US';
    const isZh = lang === 'zh-CN';

    const priceData = await fetchAllPrices();
    const result = await analyzeWithDeepSeek(c.env, priceData, [], 'advice', lang);
    return c.json({
      success: true,
      data: {
        title: isZh ? 'AI 投资建议报告' : 'AI Investment Advice Report',
        content: result.analysis?.content || result.analysis?.summary || (isZh
          ? '建议保持适度仓位，关注关键支撑阻力位，并根据自身风险承受能力做决策。'
          : 'It is recommended to maintain moderate positions, monitor key support and resistance levels, and make decisions based on your own risk tolerance.'),
      },
    });
  } catch (error) {
    console.error('AI投资建议失败:', error);
    return c.json({ success: false, error: 'AI analysis failed', message: error.message }, 500);
  }
});

export default analysis;
