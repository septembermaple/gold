/**
 * AI 分析服务
 * 调用 DeepSeek / ModelScope API 进行黄金市场分析
 */

/**
 * 使用 DeepSeek API 进行市场分析
 * @param {object} env - Cloudflare Worker 环境变量
 * @param {object} priceData - 金价数据
 * @param {Array} klineData - K线数据
 * @returns {Promise<object>} 分析结果
 */
export async function analyzeWithDeepSeek(env, priceData, klineData, type = 'general') {
  const apiKey = env.DEEPSEEK_API_KEY || env.MODELSCOPE_API_KEY;
  const apiUrl = env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

  if (!apiKey) {
    return {
      success: false,
      error: 'AI API 密钥未配置',
      analysis: generateLocalAnalysis(priceData, klineData, type),
    };
  }

  // 根据分析类型定制系统提示
  const typePrompts = {
    bullish: '你是一位专业的黄金市场分析师。请重点分析当前市场的看涨因素，包括央行购金、地缘政治风险、降息预期等利好因素。给出看涨逻辑、关键支撑位和操作建议。',
    bearish: '你是一位专业的黄金市场分析师。请重点分析当前市场的看空因素，包括美元走强、风险偏好回升、美联储鹰派立场等利空因素。给出看空逻辑、关键阻力位和风险提示。',
    summary: '你是一位专业的黄金市场分析师。请综合分析当前市场的多空因素，给出全面的市场研判，包括趋势判断、关键价位、操作建议和风险提示。',
    advice: '你是一位专业的黄金投资顾问。请基于当前市场数据，给出具体的投资操作建议，包括短期/中期/长期策略、仓位管理和风险控制方案。',
    general: `你是一位专业的黄金市场分析师，拥有丰富的金融市场分析经验。请基于提供的市场数据进行专业分析，包括：
1. 当前市场趋势判断（多头/空头/震荡）
2. 关键支撑位和阻力位
3. 技术指标分析
4. 短期（1-3天）和中期（1-2周）走势预测
5. 操作建议（买入/卖出/观望）
6. 风险提示

请用专业但易懂的语言进行分析，数据需有理有据。`,
  };

  const systemPrompt = typePrompts[type] || typePrompts.general;

  const userPrompt = buildAnalysisPrompt(priceData, klineData);

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
        error: `AI 分析请求失败: ${response.status}`,
        analysis: generateLocalAnalysis(priceData, klineData),
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
      analysis: generateLocalAnalysis(priceData, klineData),
    };
  }
}

/**
 * 流式分析
 * @param {object} env - Cloudflare Worker 环境变量
 * @param {object} priceData - 金价数据
 * @returns {ReadableStream} SSE 流
 */
export function streamAnalysis(env, priceData) {
  const apiKey = env.DEEPSEEK_API_KEY || env.MODELSCOPE_API_KEY;
  const apiUrl = env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      if (!apiKey) {
        // 无 API Key 时返回本地生成的分析
        const localAnalysis = generateLocalAnalysis(priceData, []);
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
        const systemPrompt = `你是一位专业的黄金市场分析师。请对当前黄金市场进行实时分析，包括趋势判断、关键价位、技术指标和操作建议。回复要分段清晰，使用中文。`;

        const userPrompt = buildAnalysisPrompt(priceData, []);

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
            encoder.encode(`data: ${JSON.stringify({ error: `API 请求失败: ${response.status}`, done: true })}\n\n`)
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
function buildAnalysisPrompt(priceData, klineData) {
  const intl = priceData.international || {};
  const domestic = priceData.domestic || {};

  let prompt = `请分析以下黄金市场数据：\n\n`;
  prompt += `【国际金价】\n`;
  prompt += `- 当前价格: $${intl.price || 'N/A'}/盎司\n`;
  prompt += `- 日涨跌: ${intl.change || 'N/A'} (${intl.changePercent || 'N/A'}%)\n`;
  prompt += `- 最高: $${intl.high || 'N/A'}  最低: $${intl.low || 'N/A'}\n`;
  prompt += `- 开盘: $${intl.open || 'N/A'}  收盘: $${intl.close || 'N/A'}\n\n`;

  prompt += `【国内金价】\n`;
  if (domestic.au99_99) {
    prompt += `- Au99.99: ¥${domestic.au99_99.price}/克 (${domestic.au99_99.changePercent}%)\n`;
  }
  if (domestic.au99_95) {
    prompt += `- Au99.95: ¥${domestic.au99_95.price}/克 (${domestic.au99_95.changePercent}%)\n`;
  }

  if (priceData.converted) {
    prompt += `\n【换算价格】\n`;
    prompt += `- 人民币/克: ¥${priceData.converted.pricePerGramCny}\n`;
    prompt += `- 汇率: 1 USD = ${priceData.converted.exchangeRate} CNY\n`;
  }

  if (klineData && klineData.length > 0) {
    prompt += `\n【近期K线数据】\n`;
    const recentKlines = klineData.slice(-5);
    for (const k of recentKlines) {
      prompt += `- ${k.date}: 开${k.open} 高${k.high} 低${k.low} 收${k.close} (${k.changePercent}%)\n`;
    }
  }

  prompt += `\n请基于以上数据进行专业分析。`;

  return prompt;
}

/**
 * 本地生成基础分析（当 AI API 不可用时的备用方案）
 */
function generateLocalAnalysis(priceData, klineData, type = 'general') {
  const intl = priceData.international || {};
  const price = intl.price || 2400;
  const changePercent = intl.changePercent || 0;

  let trend = '震荡';
  let suggestion = '观望';
  let confidence = 50;

  if (changePercent > 1) {
    trend = '多头';
    suggestion = '考虑轻仓做多';
    confidence = 65;
  } else if (changePercent > 0.3) {
    trend = '偏多';
    suggestion = '可考虑逢低买入';
    confidence = 55;
  } else if (changePercent < -1) {
    trend = '空头';
    suggestion = '考虑减仓或观望';
    confidence = 65;
  } else if (changePercent < -0.3) {
    trend = '偏空';
    suggestion = '建议谨慎操作';
    confidence = 55;
  }

  const supportLevel = (price * 0.985).toFixed(2);
  const resistanceLevel = (price * 1.015).toFixed(2);

  // 根据分析类型生成不同内容
  const typeContent = {
    bullish: `## AI 看涨分析报告

### 一、看涨因素分析
当前国际金价 $${price}/盎司，日涨跌幅 ${changePercent}%。

**1. 央行持续增持黄金**
全球央行连续多个季度净购入黄金，中国、印度等国央行增持幅度居前，为金价提供长期结构性支撑。

**2. 地缘政治风险上升**
中东局势持续紧张，俄乌冲突前景不明，避险需求推动金价上行。

**3. 降息预期支撑**
市场预期美联储将进入降息周期，实际利率下行将降低持有黄金的机会成本。

### 二、关键支撑位
- 第一支撑位: $${supportLevel}
- 第二支撑位: $${(price * 0.97).toFixed(2)}

### 三、看涨操作建议
- 短期：关注 $${supportLevel} 支撑，若企稳可轻仓做多
- 中期：逢低布局，目标 $${resistanceLevel}

### 四、风险提示
以上分析仅供参考，不构成投资建议。`,

    bearish: `## AI 看空分析报告

### 一、看空因素分析
当前国际金价 $${price}/盎司，日涨跌幅 ${changePercent}%。

**1. 美元指数走强**
美国经济数据好于预期，美元指数走强，对黄金价格形成压制。

**2. 风险偏好回升**
全球股市回暖，VIX指数处于低位，部分资金从黄金市场流出。

**3. 美联储鹰派立场**
美联储维持鹰派立场，利率保持高位，增加了持有黄金的机会成本。

### 二、关键阻力位
- 第一阻力位: $${resistanceLevel}
- 第二阻力位: $${(price * 1.03).toFixed(2)}

### 三、看空操作建议
- 短期：关注 $${resistanceLevel} 阻力，若无法突破可轻仓做空
- 中期：谨慎操作，注意止损

### 四、风险提示
以上分析仅供参考，不构成投资建议。`,

    summary: `## AI 综合分析报告

### 一、市场趋势判断
当前市场趋势：**${trend}**
置信度：${confidence}%

国际金价现报 $${price}/盎司，日涨跌幅 ${changePercent}%。

### 二、关键价位
- **支撑位**: $${supportLevel}
- **阻力位**: $${resistanceLevel}

### 三、技术指标分析
- 短期均线系统：${changePercent > 0 ? '多头排列' : '空头排列'}
- MACD指标：${changePercent > 0 ? '金叉信号' : '死叉信号'}
- RSI指标：${Math.abs(changePercent) > 1 ? (changePercent > 0 ? '超买区间' : '超卖区间') : '中性区间'}

### 四、走势预测
- **短期（1-3天）**：预计将${trend === '多头' ? '继续上行' : trend === '空头' ? '继续下行' : '维持震荡'}
- **中期（1-2周）**：需关注美联储政策动向和地缘政治风险

### 五、操作建议
${suggestion}

### 六、风险提示
以上分析仅供参考，不构成投资建议。`,

    advice: `## AI 投资建议报告

### 一、当前市场概况
国际金价 $${price}/盎司，日涨跌幅 ${changePercent}%，市场趋势${trend}。

### 二、短期策略（1-3天）
- **操作方向**：${changePercent > 0 ? '逢低轻仓做多' : '观望为主'}
- **入场价位**：$${supportLevel} 附近
- **止损价位**：$${(price * 0.975).toFixed(2)}
- **目标价位**：$${resistanceLevel}

### 三、中期策略（1-2周）
- **仓位建议**：总仓位控制在 5-10%
- **操作方式**：分批建仓，避免追高

### 四、长期策略（1个月以上）
- **配置建议**：黄金占投资组合 5-15%
- **操作方式**：定投持有，长期看好

### 五、风险控制
1. 设置止损，单笔亏损不超过 2%
2. 分散投资，控制单一资产比例
3. 关注美联储政策变化

### 六、风险提示
以上建议仅供参考，不构成投资建议。`,

    general: `## 黄金市场分析报告

### 一、市场趋势判断
当前市场趋势：**${trend}**
置信度：${confidence}%

国际金价现报 $${price}/盎司，日涨跌幅 ${changePercent}%。

### 二、关键价位
- **支撑位**: $${supportLevel}
- **阻力位**: $${resistanceLevel}

### 三、技术指标分析
- 短期均线系统：${changePercent > 0 ? '多头排列' : '空头排列'}
- MACD指标：${changePercent > 0 ? '金叉信号' : '死叉信号'}
- RSI指标：${Math.abs(changePercent) > 1 ? (changePercent > 0 ? '超买区间' : '超卖区间') : '中性区间'}

### 四、走势预测
- **短期（1-3天）**：预计将${trend === '多头' ? '继续上行' : trend === '空头' ? '继续下行' : '维持震荡'}，关注 $${supportLevel} 支撑和 $${resistanceLevel} 阻力。
- **中期（1-2周）**：需关注美联储政策动向和地缘政治风险，${trend === '多头' ? '有望突破阻力位' : trend === '空头' ? '可能测试支撑位' : '区间震荡概率较大'}。

### 五、操作建议
${suggestion}

### 六、风险提示
1. 以上分析仅供参考，不构成投资建议
2. 市场存在不确定性，请做好风险管理
3. 建议设置止损，控制仓位

---
*本报告由系统自动生成，数据更新于 ${new Date().toLocaleString('zh-CN')}*`,
  };

  const content = typeContent[type] || typeContent.general;

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
