/**
 * AI 分析服务
 * 调用 DeepSeek / ModelScope API 进行黄金市场分析
 */

/**
 * 文本翻译（用于 signal labels 等简短文本，中文模式下返回对应中文）
 */
function translate(text, lang) {
  if (lang !== 'zh-CN' || text == null) return text;
  const map = {
    'Bullish': '看涨',
    'Bearish': '看跌',
    'Range-bound': '震荡',
    'Slightly bullish': '轻微看涨',
    'Slightly bearish': '轻微看跌',
    'Consider a light long position': '考虑轻仓做多',
    'Consider buying on dips': '考虑逢低买入',
    'Consider reducing positions or holding': '考虑减仓或持有',
    'Proceed with caution': '谨慎操作',
  };
  return map[text] || text;
}

/**
 * 使用 DeepSeek API 进行市场分析
 * @param {object} env - Cloudflare Worker 环境变量
 * @param {object} priceData - 金价数据
 * @param {Array} klineData - K线数据
 * @param {string} type - 分析类型
 * @param {string} lang - 语言 (en-US / zh-CN)
 * @returns {Promise<object>} 分析结果
 */
export async function analyzeWithDeepSeek(env, priceData, klineData, type = 'general', lang = 'en-US') {
  const apiKey = env.DEEPSEEK_API_KEY || env.MODELSCOPE_API_KEY;
  const apiUrl = env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

  if (!apiKey) {
    return {
      success: false,
      error: 'AI API key not configured',
      analysis: generateLocalAnalysis(priceData, klineData, type, lang),
    };
  }

  // 根据分析类型定制系统提示
  const typePrompts = {
    bullish: 'You are a professional gold market analyst. Please focus on analyzing the bullish factors in the current market, including central bank gold purchases, geopolitical risks, and rate cut expectations. Provide the bullish logic, key support levels, and trading recommendations.',
    bearish: 'You are a professional gold market analyst. Please focus on analyzing the bearish factors in the current market, including a stronger US dollar, recovering risk appetite, and the Fed\'s hawkish stance. Provide the bearish logic, key resistance levels, and risk warnings.',
    summary: 'You are a professional gold market analyst. Please provide a comprehensive analysis of the current market\'s bullish and bearish factors, including trend assessment, key price levels, trading recommendations, and risk warnings.',
    advice: 'You are a professional gold investment advisor. Based on current market data, please provide specific investment recommendations, including short-term/medium-term/long-term strategies, position management, and risk control plans.',
    general: `You are a professional gold market analyst with extensive experience in financial market analysis. Based on the provided market data, please conduct a professional analysis including:
1. Current market trend assessment (bullish/bearish/range-bound)
2. Key support and resistance levels
3. Technical indicator analysis
4. Short-term (1-3 days) and medium-term (1-2 weeks) outlook
5. Trading recommendations (buy/sell/hold)
6. Risk warnings

Please analyze in a professional yet accessible manner, with well-supported data and reasoning.`,
  };

  let systemPrompt = typePrompts[type] || typePrompts.general;

  // 中文模式下使用中文 system prompt
  if (lang === 'zh-CN') {
    const cnPrompts = {
      bullish: '你是一位专业的黄金市场分析师。请重点分析当前市场的看涨因素，包括央行购金、地缘政治风险和降息预期。提供看涨逻辑、关键支撑位和交易建议。',
      bearish: '你是一位专业的黄金市场分析师。请重点分析当前市场的看空因素，包括美元走强、风险偏好恢复和美联储鹰派立场。提供看空逻辑、关键阻力位和风险提示。',
      summary: '你是一位专业的黄金市场分析师。请对当前市场的多空因素进行全面分析，包括趋势评估、关键价位、交易建议和风险提示。',
      advice: '你是一位专业的黄金投资顾问。基于当前市场数据，请提供具体的投资建议，包括短期/中期/长期策略、仓位管理和风险控制方案。',
      general: '你是一位经验丰富的黄金市场分析师。请基于提供的市场数据进行专业分析，包括：1. 当前市场趋势评估(看涨/看空/震荡) 2. 关键支撑和阻力位 3. 技术指标分析 4. 短期(1-3天)和中期(1-2周)展望 5. 交易建议(买入/卖出/持有) 6. 风险提示。请用专业易懂的方式分析，并提供充分的数据和推理支持。',
    };
    systemPrompt = cnPrompts[type] || cnPrompts.general;
  }

  const userPrompt = buildAnalysisPrompt(priceData, klineData, lang);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API 错误:', response.status, errorText);
      return {
        success: false,
        error: `AI analysis request failed: ${response.status}`,
        analysis: generateLocalAnalysis(priceData, klineData, type, lang),
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      success: true,
      analysis: {
        content,
        model: data.model || 'deepseek-chat',
        usage: data.usage || {},
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('AI 分析异常:', error);
    return {
      success: false,
      error: error.message,
      analysis: generateLocalAnalysis(priceData, klineData, type, lang),
    };
  }
}

/**
 * 流式分析
 * @param {object} env - Cloudflare Worker 环境变量
 * @param {object} priceData - 金价数据
 * @param {string} lang - 语言 (en-US / zh-CN)
 * @returns {ReadableStream} SSE 流
 */
export function streamAnalysis(env, priceData, lang = 'en-US') {
  const apiKey = env.DEEPSEEK_API_KEY || env.MODELSCOPE_API_KEY;
  const apiUrl = env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      if (!apiKey) {
        // 无 API Key 时返回本地生成的分析
        const localAnalysis = generateLocalAnalysis(priceData, [], 'general', lang);
        const chunks = splitIntoChunks(localAnalysis.content, 20);

        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`)
          );
          await sleep(50);
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
        );
        controller.close();
        return;
      }

      try {
        const systemPrompt = lang === 'zh-CN'
          ? `你是一位专业的黄金市场分析师。请对当前黄金市场进行实时分析，包括趋势评估、关键价位、技术指标和交易建议。请使用清晰的章节结构组织回答。请用中文回复。`
          : `You are a professional gold market analyst. Please provide a real-time analysis of the current gold market, including trend assessment, key price levels, technical indicators, and trading recommendations. Structure your response with clear sections. Respond in English.`;

        const userPrompt = buildAnalysisPrompt(priceData, [], lang);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: env.DEEPSEEK_MODEL || 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 2000,
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: `API request failed: ${response.status}`, done: true })}\n\n`)
          );
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
            );
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
              );
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content, done: false })}\n\n`)
                );
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`)
        );
        controller.close();
      }
    },
  });
}

/**
 * 构建分析提示词
 */
function buildAnalysisPrompt(priceData, klineData, lang = 'en-US') {
  const intl = priceData.international || {};
  const domestic = priceData.domestic || {};

  const isZh = lang === 'zh-CN';

  let prompt = isZh
    ? `请分析以下黄金市场数据：\n\n`
    : `Please analyze the following gold market data:\n\n`;

  prompt += isZh
    ? `[国际金价]\n`
    : `[International Gold Price]\n`;
  prompt += isZh
    ? `- 当前价格: $${intl.price || 'N/A'}/盎司\n`
    : `- Current Price: $${intl.price || 'N/A'}/oz\n`;
  prompt += isZh
    ? `- 日变动: ${intl.change || 'N/A'} (${intl.changePercent || 'N/A'}%)\n`
    : `- Daily Change: ${intl.change || 'N/A'} (${intl.changePercent || 'N/A'}%)\n`;
  prompt += isZh
    ? `- 最高价: $${intl.high || 'N/A'}  最低价: $${intl.low || 'N/A'}\n`
    : `- High: $${intl.high || 'N/A'}  Low: $${intl.low || 'N/A'}\n`;
  prompt += isZh
    ? `- 开盘价: $${intl.open || 'N/A'}  收盘价: $${intl.close || 'N/A'}\n\n`
    : `- Open: $${intl.open || 'N/A'}  Close: $${intl.close || 'N/A'}\n\n`;

  prompt += isZh
    ? `[国内金价]\n`
    : `[Domestic Gold Price]\n`;
  if (domestic.au99_99) {
    prompt += isZh
      ? `- Au99.99: ¥${domestic.au99_99.price}/克 (${domestic.au99_99.changePercent}%)\n`
      : `- Au99.99: ¥${domestic.au99_99.price}/g (${domestic.au99_99.changePercent}%)\n`;
  }
  if (domestic.au99_95) {
    prompt += isZh
      ? `- Au99.95: ¥${domestic.au99_95.price}/克 (${domestic.au99_95.changePercent}%)\n`
      : `- Au99.95: ¥${domestic.au99_95.price}/g (${domestic.au99_95.changePercent}%)\n`;
  }

  if (priceData.converted) {
    prompt += isZh ? `\n[换算价格]\n` : `\n[Converted Price]\n`;
    prompt += isZh
      ? `- 人民币/克: ¥${priceData.converted.pricePerGramCny}\n`
      : `- CNY/g: ¥${priceData.converted.pricePerGramCny}\n`;
    prompt += isZh
      ? `- 汇率: 1 USD = ${priceData.converted.exchangeRate} CNY\n`
      : `- Exchange Rate: 1 USD = ${priceData.converted.exchangeRate} CNY\n`;
  }

  if (klineData && klineData.length > 0) {
    prompt += isZh ? `\n[近期K线数据]\n` : `\n[Recent K-line Data]\n`;
    const recentKlines = klineData.slice(-5);
    for (const k of recentKlines) {
      prompt += isZh
        ? `- ${k.date}: 开盘 ${k.open} 最高 ${k.high} 最低 ${k.low} 收盘 ${k.close} (${k.changePercent}%)\n`
        : `- ${k.date}: Open ${k.open} High ${k.high} Low ${k.low} Close ${k.close} (${k.changePercent}%)\n`;
    }
  }

  prompt += isZh
    ? `\n请基于以上数据提供专业分析。`
    : `\nPlease provide a professional analysis based on the above data.`;

  return prompt;
}

/**
 * 本地生成基础分析（当 AI API 不可用时的备用方案）
 */
function generateLocalAnalysis(priceData, klineData, type = 'general', lang = 'en-US') {
  const intl = priceData.international || {};
  const price = intl.price || 2400;
  const changePercent = intl.changePercent || 0;

  let trend = 'Range-bound';
  let suggestion = 'Hold and observe';
  let confidence = 50;

  if (changePercent > 1) {
    trend = 'Bullish';
    suggestion = 'Consider a light long position';
    confidence = 65;
  } else if (changePercent > 0.3) {
    trend = 'Slightly bullish';
    suggestion = 'Consider buying on dips';
    confidence = 55;
  } else if (changePercent < -1) {
    trend = 'Bearish';
    suggestion = 'Consider reducing positions or holding';
    confidence = 65;
  } else if (changePercent < -0.3) {
    trend = 'Slightly bearish';
    suggestion = 'Proceed with caution';
    confidence = 55;
  }

  // 中文模式下翻译 trend 和 suggestion
  trend = translate(trend, lang);
  suggestion = translate(suggestion, lang);

  const supportLevel = (price * 0.985).toFixed(2);
  const resistanceLevel = (price * 1.015).toFixed(2);

  // 中文版本内容
  const cnTypeContent = {
    bullish: `## 黄金看涨分析报告\n\n### 1. 看涨因素分析\n当前国际金价: $${price}/盎司，日变动: ${changePercent}%。\n\n**1. 全球央行持续增持黄金储备**\n\n**2. 地缘政治风险上升**\n\n**3. 降息预期升温**\n\n### 2. 关键支撑位\n- 第一支撑: $${supportLevel}\n- 第二支撑: $${(price * 0.97).toFixed(2)}\n\n### 3. 看涨交易建议\n- 短期: 关注$${supportLevel}支撑位，若守稳可考虑轻仓做多\n- 中期: 逢低买入，目标位 $${resistanceLevel}\n\n### 4. 风险提示\n以上分析仅供参考，不构成投资建议。`,

    bearish: `## 黄金看空分析报告\n\n### 1. 看空因素分析\n当前国际金价: $${price}/盎司，日变动: ${changePercent}%。\n\n**1. 美元指数走强**\n\n**2. 风险偏好恢复**\n\n**3. 美联储鹰派立场**\n\n### 2. 关键阻力位\n- 第一阻力: $${resistanceLevel}\n- 第二阻力: $${(price * 1.03).toFixed(2)}\n\n### 3. 看空交易建议\n- 短期: 关注$${resistanceLevel}阻力位，若突破失败可考虑轻仓做空\n- 中期: 谨慎操作，设置止损\n\n### 4. 风险提示\n以上分析仅供参考，不构成投资建议。`,

    summary: `## 黄金市场综合分析报告\n\n### 1. 市场趋势评估\n当前趋势: **${trend}**\n置信度: ${confidence}%\n\n国际金价: $${price}/盎司，日变动: ${changePercent}%。\n\n### 2. 关键价位\n- **支撑**: $${supportLevel}\n- **阻力**: $${resistanceLevel}\n\n### 3. 技术指标分析\n- 短期均线系统: ${changePercent > 0 ? '多头排列' : '空头排列'}\n- MACD指标: ${changePercent > 0 ? '金叉信号' : '死叉信号'}\n- RSI指标: ${Math.abs(changePercent) > 1 ? (changePercent > 0 ? '超买区域' : '超卖区域') : '中性区域'}\n\n### 4. 展望\n- **短期 (1-3天)**: 预计${trend === '看涨' ? '延续上涨' : trend === '看跌' ? '延续下跌' : '维持震荡'}\n- **中期 (1-2周)**: 关注美联储政策变化和地缘政治风险\n\n### 5. 交易建议\n${suggestion}\n\n### 6. 风险提示\n以上分析仅供参考，不构成投资建议。`,

    general: `## 黄金市场分析报告\n\n### 1. 市场趋势评估\n当前趋势: **${trend}**\n置信度: ${confidence}%\n\n国际金价: $${price}/盎司，日变动: ${changePercent}%。\n\n### 2. 关键价位\n- **支撑**: $${supportLevel}\n- **阻力**: $${resistanceLevel}\n\n### 3. 技术指标分析\n- 短期均线系统: ${changePercent > 0 ? '多头排列' : '空头排列'}\n- MACD指标: ${changePercent > 0 ? '金叉信号' : '死叉信号'}\n- RSI指标: ${Math.abs(changePercent) > 1 ? (changePercent > 0 ? '超买区域' : '超卖区域') : '中性区域'}\n\n### 4. 展望\n- **短期 (1-3天)**: 预计${trend === '看涨' ? '延续上涨' : trend === '看跌' ? '延续下跌' : '维持震荡'}，关注$${supportLevel}支撑和$${resistanceLevel}阻力。\n- **中期 (1-2周)**: 关注美联储政策变化和地缘政治风险，${trend === '看涨' ? '可能突破阻力' : trend === '看跌' ? '或考验支撑位' : '大概率维持区间震荡'}。\n\n### 5. 交易建议\n${suggestion}\n\n### 6. 风险提示\n1. 以上分析仅供参考，不构成投资建议\n2. 市场存在不确定性，请合理管理风险\n3. 建议设置止损订单，控制仓位规模\n\n---\n*本报告由系统自动生成，数据更新于 ${new Date().toLocaleString('zh-CN')}*`,

    advice: `## 黄金投资建议报告\n\n### 1. 当前市场概况\n国际金价: $${price}/盎司，日变动: ${changePercent}%，市场趋势: ${trend}。\n\n### 2. 短期策略 (1-3天)\n- **方向**: ${changePercent > 0 ? '逢低轻仓做多' : '以观望为主'}\n- **入场价格**: 约 $${supportLevel}\n- **止损价格**: $${(price * 0.975).toFixed(2)}\n- **目标价格**: $${resistanceLevel}\n\n### 3. 中期策略 (1-2周)\n- **仓位管理**: 总仓位维持 5-10%\n- **操作方式**: 分批建仓，避免追高\n\n### 4. 长期策略 (1个月以上)\n- **配置比例**: 黄金应占投资组合的 5-15%\n- **操作方式**: 定投持有，长期展望积极\n\n### 5. 风险控制\n1. 设置止损订单，单笔亏损限制在 2%\n2. 分散投资，控制单一资产配置比例\n3. 关注美联储政策变化\n\n### 6. 风险提示\n以上建议仅供参考，不构成投资建议。`,
  };

  // 根据分析类型生成不同内容
  const typeContent = {
    bullish: `## AI Bullish Analysis Report

### 1. Bullish Factor Analysis
Current international gold price: $${price}/oz, daily change: ${changePercent}%.

**1. Continued Central Bank Gold Purchases**
Global central banks have been net buyers of gold for multiple consecutive quarters, with China and India among the leading purchasers, providing long-term structural support for gold prices.

**2. Rising Geopolitical Risks**
Ongoing tensions in the Middle East and uncertainty surrounding the Russia-Ukraine conflict are driving safe-haven demand and pushing gold prices higher.

**3. Rate Cut Expectations**
Markets expect the Federal Reserve to enter a rate-cutting cycle, and declining real interest rates will reduce the opportunity cost of holding gold.

### 2. Key Support Levels
- First Support: $${supportLevel}
- Second Support: $${(price * 0.97).toFixed(2)}

### 3. Bullish Trading Recommendations
- Short-term: Watch the $${supportLevel} support level; if it holds, consider a light long position
- Medium-term: Buy on dips, target $${resistanceLevel}

### 4. Risk Warning
The above analysis is for reference only and does not constitute investment advice.`,

    bearish: `## AI Bearish Analysis Report

### 1. Bearish Factor Analysis
Current international gold price: $${price}/oz, daily change: ${changePercent}%.

**1. Stronger US Dollar**
Better-than-expected US economic data has strengthened the dollar index, putting downward pressure on gold prices.

**2. Recovering Risk Appetite**
Global stock markets are rebounding and the VIX index remains low, with some capital flowing out of the gold market.

**3. Fed's Hawkish Stance**
The Federal Reserve maintains a hawkish stance with interest rates staying elevated, increasing the opportunity cost of holding gold.

### 2. Key Resistance Levels
- First Resistance: $${resistanceLevel}
- Second Resistance: $${(price * 1.03).toFixed(2)}

### 3. Bearish Trading Recommendations
- Short-term: Watch the $${resistanceLevel} resistance level; if it fails to break through, consider a light short position
- Medium-term: Proceed with caution and use stop-loss orders

### 4. Risk Warning
The above analysis is for reference only and does not constitute investment advice.`,

    summary: `## AI Comprehensive Analysis Report

### 1. Market Trend Assessment
Current market trend: **${trend}**
Confidence: ${confidence}%

International gold price: $${price}/oz, daily change: ${changePercent}%.

### 2. Key Price Levels
- **Support**: $${supportLevel}
- **Resistance**: $${resistanceLevel}

### 3. Technical Indicator Analysis
- Short-term Moving Average System: ${changePercent > 0 ? 'Bullish alignment' : 'Bearish alignment'}
- MACD Indicator: ${changePercent > 0 ? 'Golden cross signal' : 'Death cross signal'}
- RSI Indicator: ${Math.abs(changePercent) > 1 ? (changePercent > 0 ? 'Overbought zone' : 'Oversold zone') : 'Neutral zone'}

### 4. Outlook
- **Short-term (1-3 days)**: Expected to ${trend === 'Bullish' ? 'continue rising' : trend === 'Bearish' ? 'continue declining' : 'remain range-bound'}
- **Medium-term (1-2 weeks)**: Monitor Fed policy developments and geopolitical risks

### 5. Trading Recommendations
${suggestion}

### 6. Risk Warning
The above analysis is for reference only and does not constitute investment advice.`,

    advice: `## AI Investment Advisory Report

### 1. Current Market Overview
International gold price: $${price}/oz, daily change: ${changePercent}%, market trend: ${trend}.

### 2. Short-term Strategy (1-3 days)
- **Direction**: ${changePercent > 0 ? 'Buy on dips with a light long position' : 'Primarily hold and observe'}
- **Entry Price**: Around $${supportLevel}
- **Stop-loss Price**: $${(price * 0.975).toFixed(2)}
- **Target Price**: $${resistanceLevel}

### 3. Medium-term Strategy (1-2 weeks)
- **Position Sizing**: Keep total position at 5-10%
- **Approach**: Build positions in batches, avoid chasing highs

### 4. Long-term Strategy (1+ months)
- **Allocation**: Gold should comprise 5-15% of your portfolio
- **Approach**: Dollar-cost average and hold; long-term outlook remains positive

### 5. Risk Control
1. Set stop-loss orders; limit single-trade losses to 2%
2. Diversify investments; control single-asset allocation
3. Monitor Federal Reserve policy changes

### 6. Risk Warning
The above recommendations are for reference only and do not constitute investment advice.`,

    general: `## Gold Market Analysis Report

### 1. Market Trend Assessment
Current market trend: **${trend}**
Confidence: ${confidence}%

International gold price: $${price}/oz, daily change: ${changePercent}%.

### 2. Key Price Levels
- **Support**: $${supportLevel}
- **Resistance**: $${resistanceLevel}

### 3. Technical Indicator Analysis
- Short-term Moving Average System: ${changePercent > 0 ? 'Bullish alignment' : 'Bearish alignment'}
- MACD Indicator: ${changePercent > 0 ? 'Golden cross signal' : 'Death cross signal'}
- RSI Indicator: ${Math.abs(changePercent) > 1 ? (changePercent > 0 ? 'Overbought zone' : 'Oversold zone') : 'Neutral zone'}

### 4. Outlook
- **Short-term (1-3 days)**: Expected to ${trend === 'Bullish' ? 'continue rising' : trend === 'Bearish' ? 'continue declining' : 'remain range-bound'}, watch $${supportLevel} support and $${resistanceLevel} resistance.
- **Medium-term (1-2 weeks)**: Monitor Fed policy developments and geopolitical risks; ${trend === 'Bullish' ? 'potential breakout above resistance' : trend === 'Bearish' ? 'may test support levels' : 'range-bound trading is more likely'}.

### 5. Trading Recommendations
${suggestion}

### 6. Risk Warning
1. The above analysis is for reference only and does not constitute investment advice
2. Markets carry uncertainty; please manage risk appropriately
3. It is recommended to set stop-loss orders and control position sizes

---
*This report was automatically generated by the system, data updated at ${new Date().toLocaleString('en-US')}*`,
  };

  const content = lang === 'zh-CN'
    ? (cnTypeContent[type] || cnTypeContent.general)
    : (typeContent[type] || typeContent.general);

  return {
    content,
    model: 'local-analysis',
    usage: {},
    generatedAt: new Date().toISOString(),
    isLocal: true,
  };
}

/**
 * 将文本分割为指定大小的块
 */
function splitIntoChunks(text, chunkSize) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
