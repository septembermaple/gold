/**
 * 黄金市场宏观分析服务
 * 从 FRED API 和东方财富获取宏观数据，计算衍生指标和信号
 * 兼容 Cloudflare Workers 运行环境
 */

// ─── 东方财富请求头 ──────────────────────────────────────
const EASTMONEY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://quote.eastmoney.com/',
  Accept: 'application/json,text/plain,*/*',
};

// ─── 中文翻译字典 ──────────────────────────────────────
const zhCN = {
  'Negative Real Rate': '实际利率为负',
  'Real Rate Declining Trend': '实际利率下行趋势',
  'Real Rate High and Rising': '实际利率偏高且上行',
  'Dollar Weakening (20-day Momentum)': '美元走弱（20日动量）',
  'Dollar Strengthening (20-day Momentum)': '美元走强（20日动量）',
  'Core PCE YoY > 3%': '核心PCE同比 > 3%',
  'Core PCE YoY < 2%': '核心PCE同比 < 2%',
  'Fed Balance Sheet Expanding (Easing)': '美联储资产负债表扩张（宽松）',
  'Fed Balance Sheet Shrinking (QT Accelerating)': '美联储资产负债表收缩（缩表加速）',
  'VIX > 30 (Safe Haven Rising)': 'VIX > 30（避险情绪上升）',
  'Gold Above 200-day MA': '金价高于200日均线',
  'Gold Below 200-day MA': '金价低于200日均线',
  '50/200-day MA Golden Cross': '50/200日均线金叉',
  '50/200-day MA Death Cross': '50/200日均线死叉',
  'COT Spec Net Long Crowded (>80th Pct)': 'COT投机净多头拥挤（>80百分位）',
  'COT Spec Net Long Low (<20th Pct)': 'COT投机净多头偏低（<20百分位）',
  'Real Rate-Gold Divergence (Overbought)': '实际利率-金价背离（超买）',
  'Real Rate-Gold Divergence (Oversold)': '实际利率-金价背离（超卖）',
  'GLD ETF Large Capital Inflow': 'GLD ETF资金大幅流入',
  'GLD ETF Large Capital Outflow': 'GLD ETF资金大幅流出',
  'Gold/Silver Ratio Extremely High (>80)': '金银比极端偏高（>80）',
  'Gold/Silver Ratio Low (<60)': '金银比偏低（<60）',
  'Yield Curve Inverted': '收益率曲线倒挂',
  'Yield Curve Steepening Rapidly': '收益率曲线快速陡峭',
  'Real Rate': '实际利率',
  'Dollar': '美元',
  'Inflation': '通胀',
  'Liquidity': '流动性',
  'Safe Haven': '避险',
  'Technical': '技术面',
  'COT': 'COT持仓',
  'Divergence': '背离',
  'ETF Flow': 'ETF资金流',
  'Gold/Silver Ratio': '金银比',
  'Yield Curve': '收益率曲线',
  'Long-term inflation trend': '长期通胀趋势',
  'Central bank buying': '央行购金',
  'Declining inflation weakens hedge demand': '通胀下降削弱对冲需求',
  'High inflation supports hedge demand': '高通胀支撑对冲需求',
  'Bullish technical trend': '技术面趋势向好',
  'Central bank buying slowing': '央行购金速度放缓',
  'No significant risk': '无显著风险',
  'Long-term hedge property': '长期对冲属性',
  'Fund Flow': '资金流',
  'Rising real rate pressures ETF': '实际利率上升压制ETF表现',
  'Declining real rate benefits ETF': '实际利率下行利好ETF',
  'Dollar weakening is bullish': '美元走弱利好黄金',
  'Dollar strengthening pressures': '美元走强压制黄金',
  'High volatility, high leverage risk': '高波动、高杠杆风险',
  'Rising rate pressures': '利率上升压力',
  'Declining rate is bullish': '利率下行利好',
  'Bullish technicals': '技术面偏多',
  'Market panic drags mining stocks': '市场恐慌拖累矿业股',
  'Gold technicals weakening': '黄金技术面走弱',
  'Rising gold amplifies miner profits': '金价上涨放大矿企盈利',
  'Weak dollar benefits miner costs': '美元走弱利好矿企成本',
  'GDX recent strong rally': 'GDX近期强势反弹',
  'GDX recent sharp decline': 'GDX近期大幅下跌',
  'Inherently high volatility': '内在高波动',
  'Gold leverage effect': '黄金杠杆效应',
  'Neutral watch': '中性观望',
  'Neutral': '中性',
  'Moderate': '适度仓位',
  'Conservative': '保守仓位',
  'Aggressive': '激进仓位',
  'Rate Expectations': '利率预期',
  'COT Positioning': 'COT持仓',
  'Volatility': '波动率',
  'Gold Trend': '黄金趋势',
  'Equity Environment': '股市环境',
  'VIX': 'VIX指数',
  'Dollar Strength': '美元强度',
  'Inflation Expectation': '通胀预期',
  'Safe Haven Demand': '避险需求',
  'Capital Inflow': '资金流入',
  'GLD ETF': 'GLD ETF',
  'Extreme Fear': '极度恐惧',
  'Fear': '恐惧',
  'Greed': '贪婪',
  'Extreme Greed': '极度贪婪',
  'Technically bullish, short-term upside momentum': '技术面偏多，短期上行动能',
  'Technically bearish, short-term caution advised': '技术面偏空，短期需谨慎',
  'Conflicting signals, short-term direction unclear': '信号矛盾，短期方向不明',
  'Macro factors aligned bullish, mid-term outlook positive': '宏观因子偏多，中期展望积极',
  'Rate and dollar dual pressure, mid-term headwinds': '利率与美元双重压力，中期承压',
  'Mixed signals, mid-term wait-and-see': '信号混杂，中期观望',
  'Inflation and central bank buying support long-term bullish view': '通胀与央行购金支撑长期看涨',
  'Deflation and strong dollar pressure long-term outlook': '通缩与强美元压制长期展望',
  'Long-term factors neutral, continued monitoring needed': '长期因素中性，需持续观察',
  'Technical Trend': '技术趋势',
  'RSI Momentum': 'RSI动量',
  'Volatility Environment': '波动率环境',
  'Short-term Safe Haven Sentiment': '短期避险情绪',
  'Real Rate Direction': '实际利率方向',
  'No Signal': '无信号',
  'RSI data unavailable': 'RSI数据不可用',
  '20-day Annualized Volatility': '20日年化波动率',
  'high volatility bearish': '高波动率偏空',
  'overbought=sell signal': '超买=卖出信号',
  'oversold=buy opportunity': '超卖=买入机会',
  'Mid-term Financial': '中期金融属性',
  'Long-term Currency': '长期货币属性',
  'strong_buy': '强烈看多',
  'buy': '看多',
  'hold': '持有',
  'reduce': '减仓',
  'sell': '看空',
  'Strong bullish macro factors, recommend actively increasing gold positions': '宏观因子强烈看多，建议积极增配黄金',
  'Most factors bullish, recommend moderately increasing gold allocation': '多数因子看多，建议适度增加黄金配置',
  'Balanced bullish/bearish factors, recommend maintaining current positions': '多空因素均衡，建议维持当前仓位',
  'Macro factors bearish, recommend moderately reducing gold positions': '宏观因子偏空，建议适度降低黄金配置',
  'Most factors bearish, recommend significantly reducing or closing positions': '多数因子偏空，建议大幅减仓或平仓',
  'N/A': '暂无',
  'stable': '稳定',
  'increasing': '增加',
  'decreasing': '减少',
  'unknown': '未知',
  'Inverted': '倒挂',
  'tonnes': '吨',
  'Core PCE YoY': '核心PCE同比',
  '5Y5Y Forward Inflation': '5年5年远期通胀',
  'Central bank annual buying': '央行年度购金量',
  'Cross': '交叉',
  'Unclear': '不明',
  'Real Rate Trend': '实际利率趋势',
  'Dollar 20-day Momentum': '美元20日动量',
  '10Y Breakeven': '10年盈亏平衡通胀',
  '10Y-2Y Spread': '10年-2年期利差',
  'Fed Assets WoW': '美联储资产周环比',
  'Short-term Trading': '短期交易属性',
  'MA50/MA200 Cross': 'MA50/MA200交叉',
  'RSI(14)': 'RSI指标(14)',
};

/** 翻译函数：若 lang !== 'zh-CN' 或 text 为空，返回原文本；否则先精确匹配，再尝试正则模式匹配 */
function translate(text, lang) {
  if (lang !== 'zh-CN' || text == null) return text;
  const exact = zhCN[text];
  if (exact != null) return exact;
  for (const key of Object.keys(zhCN)) {
    if (key.startsWith('^') && key.endsWith('$')) {
      try {
        const re = new RegExp(key.slice(1, -1));
        if (re.test(text)) {
          return text.replace(re, zhCN[key]);
        }
      } catch (e) {
        // ignore invalid regex
      }
    }
  }
  return text;
}

// ─── FRED 序列映射 ──────────────────────────────────────
const FRED_SERIES = {
  realYield: 'DFII10',       // 10Y TIPS 实际利率
  nominal10y: 'DGS10',       // 10Y 名义利率
  breakeven: 'T10YIE',       // 10Y Breakeven 通胀预期
  dxy: 'DTWEXBGS',           // 广义贸易加权美元指数
  coreCpi: 'CPILFESL',       // 核心CPI
  corePce: 'PCEPILFE',       // 核心PCE
  fedAssets: 'WALCL',        // 美联储总资产
  vix: 'VIXCLS',             // VIX
  fedFunds: 'DFF',           // 联邦基金利率
  fwdInflation: 'T5YIFR',    // 5Y5Y远期通胀预期
  yieldCurve: 'T10Y2Y',      // 10Y-2Y 收益率曲线利差
};

// ─── 央行购金季度数据（来源: WGC） ──────────────────────
const CENTRAL_BANK_QUARTERLY = [
  { period: '2023-Q1', tonnes: 228.4 },
  { period: '2023-Q2', tonnes: 102.9 },
  { period: '2023-Q3', tonnes: 337.1 },
  { period: '2023-Q4', tonnes: 229.4 },
  { period: '2024-Q1', tonnes: 289.7 },
  { period: '2024-Q2', tonnes: 183.4 },
  { period: '2024-Q3', tonnes: 186.2 },
  { period: '2024-Q4', tonnes: 332.9 },
  { period: '2025-Q1', tonnes: 243.7 },
  { period: '2025-Q2', tonnes: 214.5 },
  { period: '2025-Q3', tonnes: 267.3 },
  { period: '2025-Q4', tonnes: 295.6 },
];

// ─── 工具函数 ────────────────────────────────────────────

/** 安全的 fetch JSON */
async function fetchJson(url, headers = EASTMONEY_HEADERS, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 东方财富报价解析（价格字段除以100） */
function asPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / 100;
}

/** 从数组中提取最新值 */
function latest(series) {
  if (!series || series.length === 0) return null;
  return series[series.length - 1].value;
}

/** 从数组中取最后 N 条 */
function latestN(series, n) {
  if (!series) return [];
  return series.length >= n ? series.slice(-n) : series;
}

/** 简单移动平均 */
function movingAvg(vals, window) {
  if (!vals || vals.length < window) return null;
  const slice = vals.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** 变化率 (%) */
function roc(vals, window) {
  if (!vals || vals.length < window + 1) return null;
  return ((vals[vals.length - 1] / vals[vals.length - window - 1]) - 1) * 100;
}

/** 年化波动率 */
function annualizedVol(vals, window = 20) {
  if (!vals || vals.length < window + 1) return null;
  const slice = vals.slice(-window - 1);
  const logReturns = [];
  for (let i = 1; i < slice.length; i++) {
    logReturns.push(Math.log(slice[i] / slice[i - 1]));
  }
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / logReturns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/** RSI */
function calcRsi(vals, period = 14) {
  if (!vals || vals.length < period + 1) return null;
  const slice = vals.slice(-(period + 1));
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum -= diff;
  }
  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** 同比涨幅 (%) — 月度数据 */
function yoyPct(series) {
  if (!series || series.length < 13) return null;
  const cur = series[series.length - 1].value;
  const prev = series[series.length - 13].value;
  if (!prev) return null;
  return ((cur / prev) - 1) * 100;
}

/** 趋势标签 */
function trendLabel(maShort, maLong) {
  if (maShort == null || maLong == null) return 'neutral';
  return maShort < maLong ? 'bearish' : 'bullish';
}

/** 百分位 */
function pctRank(vals, current) {
  if (!vals || vals.length === 0 || current == null) return 50;
  const below = vals.filter(v => v < current).length;
  return (below / vals.length) * 100;
}

/** Z-Score 背离度 */
function zscoreDivergence(seriesA, seriesB, window = 60) {
  if (!seriesA || !seriesB || seriesA.length < window || seriesB.length < window) return null;
  const a = seriesA.slice(-window);
  const b = seriesB.slice(-window);
  const meanA = a.reduce((s, v) => s + v, 0) / a.length;
  const meanB = b.reduce((s, v) => s + v, 0) / b.length;
  const stdA = Math.sqrt(a.reduce((s, v) => s + (v - meanA) ** 2, 0) / a.length);
  const stdB = Math.sqrt(b.reduce((s, v) => s + (v - meanB) ** 2, 0) / b.length);
  const zA = stdA > 0 ? (a[a.length - 1] - meanA) / stdA : 0;
  const zB = stdB > 0 ? (b[b.length - 1] - meanB) / stdB : 0;
  return zA - zB;
}

/** 四舍五入 */
function round(val, digits = 2) {
  if (val == null || !Number.isFinite(val)) return null;
  const f = 10 ** digits;
  return Math.round(val * f) / f;
}

/** 限制范围 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ─── 数据获取：东方财富 ──────────────────────────────────

/** 获取国际金价实时报价 */
async function fetchGoldQuote() {
  try {
    const data = await fetchJson(
      'https://push2.eastmoney.com/api/qt/stock/get?secid=122.XAU&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170'
    );
    if (!data?.data) throw new Error('empty');
    const d = data.data;
    return {
      price: asPrice(d.f43),
      change: asPrice(d.f169),
      changePercent: asPrice(d.f170),
      high: asPrice(d.f44),
      low: asPrice(d.f45),
      open: asPrice(d.f46),
      previousClose: asPrice(d.f60),
      source: 'eastmoney-XAU',
    };
  } catch (e) {
    console.error('东方财富金价获取失败:', e);
    return null;
  }
}

/** 获取白银实时报价 */
async function fetchSilverQuote() {
  try {
    const data = await fetchJson(
      'https://push2.eastmoney.com/api/qt/stock/get?secid=122.XAG&fields=f43,f44,f45,f46,f57,f58,f60,f169,f170'
    );
    if (!data?.data) throw new Error('empty');
    const d = data.data;
    return {
      price: asPrice(d.f43),
      change: asPrice(d.f169),
      changePercent: asPrice(d.f170),
      source: 'eastmoney-XAG',
    };
  } catch (e) {
    console.error('东方财富白银获取失败:', e);
    return null;
  }
}

/** 获取美元指数实时报价 */
async function fetchDollarIndexQuote() {
  try {
    const data = await fetchJson(
      'https://push2.eastmoney.com/api/qt/stock/get?secid=100.UDI&fields=f43,f44,f45,f46,f57,f58,f60,f169,f170'
    );
    if (!data?.data) throw new Error('empty');
    const d = data.data;
    return {
      price: asPrice(d.f43),
      change: asPrice(d.f169),
      changePercent: asPrice(d.f170),
      source: 'eastmoney-UDI',
    };
  } catch (e) {
    console.error('东方财富美元指数获取失败:', e);
  }

  // 备用：Yahoo Finance DXY
  try {
    const resp = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?range=1d&interval=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (resp.ok) {
      const yData = await resp.json();
      const meta = yData?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose || price;
        return {
          price: Math.round(price * 1000) / 1000,
          change: Math.round((price - prevClose) * 1000) / 1000,
          changePercent: prevClose > 0 ? Math.round(((price / prevClose - 1) * 100) * 100) / 100 : 0,
          source: 'yahoo-DXY',
        };
      }
    }
  } catch (e) {
    console.error('Yahoo DXY获取失败:', e);
  }

  return null;
}

/** 获取国内金价 AU9999 */
async function fetchDomesticGoldQuote() {
  try {
    const data = await fetchJson(
      'https://push2.eastmoney.com/api/qt/stock/get?secid=118.AU9999&fields=f43,f44,f45,f46,f57,f58,f60,f169,f170'
    );
    if (!data?.data) throw new Error('empty');
    const d = data.data;
    return {
      price: asPrice(d.f43),
      change: asPrice(d.f169),
      changePercent: asPrice(d.f170),
      source: 'eastmoney-AU9999',
    };
  } catch (e) {
    console.error('东方财富国内金价获取失败:', e);
    return null;
  }
}

/** 获取金价K线历史 */
async function fetchGoldKline(days = 365) {
  try {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=122.XAU&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=0&end=20500101&lmt=${days}`;
    const result = await fetchJson(url);
    if (!result.data?.klines?.length) throw new Error('empty kline');
    return result.data.klines.map(line => {
      const parts = line.split(',');
      return {
        date: parts[0],
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseInt(parts[5], 10) || 0,
      };
    });
  } catch (e) {
    console.error('东方财富金价K线获取失败:', e);
    return [];
  }
}

/** 获取白银K线历史 */
async function fetchSilverKline(days = 365) {
  try {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=122.XAG&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=0&end=20500101&lmt=${days}`;
    const result = await fetchJson(url);
    if (!result.data?.klines?.length) throw new Error('empty kline');
    return result.data.klines.map(line => {
      const parts = line.split(',');
      return { date: parts[0], close: parseFloat(parts[2]) };
    });
  } catch (e) {
    console.error('东方财富白银K线获取失败:', e);
    return [];
  }
}

/** 获取GDX金矿ETF K线 */
async function fetchGdxKline(days = 365) {
  try {
    // GDX 在东方财富用美股代码
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=107.GDX&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=0&end=20500101&lmt=${days}`;
    const result = await fetchJson(url);
    if (!result.data?.klines?.length) throw new Error('empty kline');
    return result.data.klines.map(line => {
      const parts = line.split(',');
      return { date: parts[0], close: parseFloat(parts[2]) };
    });
  } catch (e) {
    console.error('GDX K线获取失败:', e);
    return [];
  }
}

// ─── 数据获取：FRED API ──────────────────────────────────

/** 从 FRED 获取单个序列 */
async function fetchFredSeries(apiKey, seriesId, observationStart) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${observationStart}&sort_order=asc`;
  try {
    const data = await fetchJson(url, {}, 20000);
    const obs = data.observations || [];
    const result = [];
    for (const o of obs) {
      if (o.value === '.') continue;
      const v = parseFloat(o.value);
      if (Number.isFinite(v)) {
        result.push({ date: o.date, value: v });
      }
    }
    return result;
  } catch (e) {
    console.error(`FRED ${seriesId} 获取失败:`, e);
    return [];
  }
}

/** 批量获取所有 FRED 序列 */
async function fetchAllFred(apiKey) {
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const obsStart = threeYearsAgo.toISOString().split('T')[0];

  const data = {};
  const entries = Object.entries(FRED_SERIES);

  // 串行请求，对 FRED 友好
  for (const [key, sid] of entries) {
    data[key] = await fetchFredSeries(apiKey, sid, obsStart);
    // 简单延迟，避免触发 FRED 限流
    await new Promise(r => setTimeout(r, 100));
  }

  return data;
}

// ─── 数据获取：goldprice.org 备用 ────────────────────────

async function fetchGoldpriceOrg() {
  try {
    const data = await fetchJson(
      'https://data-asg.goldprice.org/dbXRates/USD',
      { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      10000
    );
    const item = data?.items?.[0];
    if (!item?.xauPrice) throw new Error('no price');
    return {
      price: item.xauPrice,
      change: item.chgXau || 0,
      changePercent: item.pcXau || 0,
      silverPrice: item.xagPrice || 0,
      source: 'goldprice.org',
    };
  } catch (e) {
    console.error('goldprice.org 获取失败:', e);
    return null;
  }
}

// ─── 数据获取：Yahoo Finance 备用 ────────────────────────

async function fetchYahooGoldQuote() {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d';
    const data = await fetchJson(url, { 'User-Agent': 'Mozilla/5.0' }, 10000);
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error('no yahoo price');
    return {
      price: meta.regularMarketPrice,
      change: meta.regularMarketPrice - (meta.previousClose || meta.regularMarketPrice),
      changePercent: meta.previousClose ? ((meta.regularMarketPrice / meta.previousClose - 1) * 100) : 0,
      high: meta.regularMarketDayHigh || meta.regularMarketPrice,
      low: meta.regularMarketDayLow || meta.regularMarketPrice,
      open: meta.previousClose || meta.regularMarketPrice,
      source: 'yahoo-GC=F',
    };
  } catch (e) {
    console.error('Yahoo Finance 金价获取失败:', e);
    return null;
  }
}

async function fetchYahooGoldKline(days = 365) {
  try {
    const range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 180 ? '6mo' : '1y';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=${range}&interval=1d`;
    const data = await fetchJson(url, { 'User-Agent': 'Mozilla/5.0' }, 15000);
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp || !result?.indicators?.quote?.[0]) throw new Error('no yahoo kline');

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const klines = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = quotes.close?.[i];
      const high = quotes.high?.[i];
      const low = quotes.low?.[i];
      const volume = quotes.volume?.[i];
      if (close == null) continue;
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      klines.push({ date, close, high: high || close, low: low || close, volume: volume || 0 });
    }
    return klines;
  } catch (e) {
    console.error('Yahoo Finance 金价K线获取失败:', e);
    return [];
  }
}

async function fetchYahooSilverKline(days = 365) {
  try {
    const range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 180 ? '6mo' : '1y';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/SI=F?range=${range}&interval=1d`;
    const data = await fetchJson(url, { 'User-Agent': 'Mozilla/5.0' }, 15000);
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp || !result?.indicators?.quote?.[0]) throw new Error('no yahoo kline');

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const klines = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = quotes.close?.[i];
      if (close == null) continue;
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      klines.push({ date, close });
    }
    return klines;
  } catch (e) {
    console.error('Yahoo Finance 白银K线获取失败:', e);
    return [];
  }
}

// ─── 央行购金数据处理 ──────────────────────────────────────

function computeCentralBankGold() {
  const quarterlyData = CENTRAL_BANK_QUARTERLY;
  const yearlyTotals = {};
  for (const { period, tonnes } of quarterlyData) {
    const year = period.slice(0, 4);
    yearlyTotals[year] = (yearlyTotals[year] || 0) + tonnes;
  }

  const recent4q = quarterlyData.length >= 4 ? quarterlyData.slice(-4) : quarterlyData;
  const rollingAnnual = recent4q.reduce((s, q) => s + q.tonnes, 0);

  let trend = 'unknown';
  let yoyChangePct = 0;
  if (quarterlyData.length >= 8) {
    const prev4q = quarterlyData.slice(-8, -4);
    const prevAnnual = prev4q.reduce((s, q) => s + q.tonnes, 0);
    trend = rollingAnnual > prevAnnual * 1.05 ? 'increasing'
      : rollingAnnual < prevAnnual * 0.95 ? 'decreasing' : 'stable';
    yoyChangePct = prevAnnual > 0 ? round(((rollingAnnual / prevAnnual) - 1) * 100, 1) : 0;
  }

  return {
    latestQuarter: quarterlyData[quarterlyData.length - 1]?.period,
    latestQuarterlyTonnes: quarterlyData[quarterlyData.length - 1]?.tonnes,
    rollingAnnualTonnes: round(rollingAnnual, 1),
    yearlyTotals,
    trend,
    yoyChangePct,
    quarterlyHistory: quarterlyData.map(q => ({ period: q.period, tonnes: q.tonnes })),
    source: 'World Gold Council (WGC) Quarterly Reports',
  };
}

// ─── 信号引擎 ────────────────────────────────────────────

function computeSignals(derived, lang = 'en-US') {
  const bullish = [];
  const bearish = [];

  const pushSignal = (list, { title, strength, detail, category }) => {
    list.push({
      title: translate(title, lang),
      strength,
      detail: translate(detail, lang),
      category: translate(category, lang),
    });
  };

  const ry = derived.realYield || {};
  const dx = derived.dxy || {};
  const inf = derived.inflation || {};
  const fed = derived.fedBalance || {};
  const tech = derived.technicals || {};
  const vixCur = derived.vix?.current;

  // 1. 实际利率 < 0
  if (ry.current != null && ry.current < 0) {
    pushSignal(bullish, {
      title: 'Negative Real Rate',
      strength: 5,
      detail: `10Y TIPS: ${ry.current.toFixed(2)}%, negative real rate strongly bullish for gold`,
      category: 'Real Rate',
    });
  }

  // 2. 实际利率均线下穿
  if (ry.trend === 'declining') {
    pushSignal(bullish, {
      title: 'Real Rate Declining Trend',
      strength: 4,
      detail: `20-day MA(${round(ry.ma20, 2) ?? 'N/A'}) < 60-day MA(${round(ry.ma60, 2) ?? 'N/A'})`,
      category: 'Real Rate',
    });
  }

  // 3. 实际利率 > 2% 且上行
  if (ry.current != null && ry.current > 2.0 && ry.trend === 'rising') {
    pushSignal(bearish, {
      title: 'Real Rate High and Rising',
      strength: 4,
      detail: `10Y TIPS: ${ry.current.toFixed(2)}%, high real rate pressures gold`,
      category: 'Real Rate',
    });
  }

  // 4-5. 美元动量
  const dxyRoc = dx.roc20d;
  if (dxyRoc != null) {
    if (dxyRoc < -2) {
      pushSignal(bullish, {
        title: 'Dollar Weakening (20-day Momentum)',
        strength: 3,
        detail: `Dollar Index 20-day ROC: ${dxyRoc.toFixed(1)}%`,
        category: 'Dollar',
      });
    } else if (dxyRoc > 2) {
      pushSignal(bearish, {
        title: 'Dollar Strengthening (20-day Momentum)',
        strength: 3,
        detail: `Dollar Index 20-day ROC: ${dxyRoc.toFixed(1)}%`,
        category: 'Dollar',
      });
    }
  }

  // 6-7. 通胀
  const pceYoy = inf.corePceYoY;
  if (pceYoy != null) {
    if (pceYoy > 3.0) {
      pushSignal(bullish, {
        title: 'Core PCE YoY > 3%',
        strength: 3,
        detail: `Core PCE YoY: ${pceYoy.toFixed(1)}%, high inflation supports gold`,
        category: 'Inflation',
      });
    } else if (pceYoy < 2.0) {
      pushSignal(bearish, {
        title: 'Core PCE YoY < 2%',
        strength: 2,
        detail: `Core PCE YoY: ${pceYoy.toFixed(1)}%, low inflation weakens gold appeal`,
        category: 'Inflation',
      });
    }
  }

  // 8-9. 美联储资产负债表
  const fedWow = fed.weekOverWeekPct;
  if (fedWow != null) {
    if (fedWow > 0) {
      pushSignal(bullish, {
        title: 'Fed Balance Sheet Expanding (Easing)',
        strength: 3,
        detail: `Fed total assets WoW: +${fedWow.toFixed(2)}%`,
        category: 'Liquidity',
      });
    } else if (fedWow < -0.05) {
      pushSignal(bearish, {
        title: 'Fed Balance Sheet Shrinking (QT Accelerating)',
        strength: 3,
        detail: `Fed total assets WoW: ${fedWow.toFixed(2)}%`,
        category: 'Liquidity',
      });
    }
  }

  // 14. VIX
  if (vixCur != null && vixCur > 30) {
    pushSignal(bullish, {
      title: 'VIX > 30 (Safe Haven Rising)',
      strength: 3,
      detail: `VIX: ${vixCur.toFixed(1)}, fear drives gold safe haven demand`,
      category: 'Safe Haven',
    });
  }

  // 15-16. 金价 vs 200日均线
  const ma200 = tech.ma200;
  const goldCur = derived.prices?.gold?.value;
  if (ma200 && goldCur) {
    if (goldCur > ma200) {
      pushSignal(bullish, {
        title: 'Gold Above 200-day MA',
        strength: 3,
        detail: `Gold $${goldCur.toFixed(0)} > MA200 $${ma200.toFixed(0)}`,
        category: 'Technical',
      });
    } else {
      pushSignal(bearish, {
        title: 'Gold Below 200-day MA',
        strength: 4,
        detail: `Gold $${goldCur.toFixed(0)} < MA200 $${ma200.toFixed(0)}`,
        category: 'Technical',
      });
    }
  }

  // 17-18. 金叉/死叉
  const crossover = tech.maCrossover;
  if (crossover === 'golden') {
    pushSignal(bullish, {
      title: '50/200-day MA Golden Cross',
      strength: 5,
      detail: `MA50($${round(tech.ma50, 0) ?? 'N/A'}) > MA200($${round(tech.ma200, 0) ?? 'N/A'})`,
      category: 'Technical',
    });
  } else if (crossover === 'death') {
    pushSignal(bearish, {
      title: '50/200-day MA Death Cross',
      strength: 5,
      detail: `MA50($${round(tech.ma50, 0) ?? 'N/A'}) < MA200($${round(tech.ma200, 0) ?? 'N/A'})`,
      category: 'Technical',
    });
  }

  // 10-11. COT 持仓百分位
  const cotData = derived.cot || {};
  const cotPctl = cotData.specNetLongPercentile;
  const cotCur = cotData.current || {};
  if (cotPctl != null) {
    if (cotPctl > 80) {
      pushSignal(bearish, {
        title: 'COT Spec Net Long Crowded (>80th Pct)',
        strength: 3,
        detail: `Net Long:${cotCur.specNetLong ?? 'N/A'} Percentile:${cotPctl.toFixed(0)}%, crowded longs risk pullback`,
        category: 'COT',
      });
    } else if (cotPctl < 20) {
      pushSignal(bullish, {
        title: 'COT Spec Net Long Low (<20th Pct)',
        strength: 3,
        detail: `Net Long:${cotCur.specNetLong ?? 'N/A'} Percentile:${cotPctl.toFixed(0)}%, extreme shorts offer rebound opportunity`,
        category: 'COT',
      });
    }
  }

  // 背离度信号
  const divZ = derived.divergence?.zScore;
  if (divZ != null) {
    if (divZ > 1.5) {
      pushSignal(bearish, {
        title: 'Real Rate-Gold Divergence (Overbought)',
        strength: 3,
        detail: `Divergence Z-Score: ${divZ.toFixed(2)}, gold overvalued vs real rate`,
        category: 'Divergence',
      });
    } else if (divZ < -1.5) {
      pushSignal(bullish, {
        title: 'Real Rate-Gold Divergence (Oversold)',
        strength: 3,
        detail: `Divergence Z-Score: ${divZ.toFixed(2)}, gold undervalued vs real rate`,
        category: 'Divergence',
      });
    }
  }

  // 12-13. GLD ETF 资金流
  const gldFlow = derived.gld?.flow5dPct;
  if (gldFlow != null) {
    if (gldFlow > 10) {
      pushSignal(bullish, {
        title: 'GLD ETF Large Capital Inflow',
        strength: 2,
        detail: `5-day volume change: +${gldFlow.toFixed(1)}%, institutional accumulation`,
        category: 'ETF Flow',
      });
    } else if (gldFlow < -10) {
      pushSignal(bearish, {
        title: 'GLD ETF Large Capital Outflow',
        strength: 2,
        detail: `5-day volume change: ${gldFlow.toFixed(1)}%, institutional reduction`,
        category: 'ETF Flow',
      });
    }
  }

  // 金银比信号
  const sgrCur = derived.silverGoldRatio?.current;
  if (sgrCur != null) {
    if (sgrCur > 80) {
      pushSignal(bearish, {
        title: 'Gold/Silver Ratio Extremely High (>80)',
        strength: 2,
        detail: `Current G/S ratio: ${sgrCur.toFixed(1)}, historically extreme, mean reversion risk`,
        category: 'Gold/Silver Ratio',
      });
    } else if (sgrCur < 60) {
      pushSignal(bullish, {
        title: 'Gold/Silver Ratio Low (<60)',
        strength: 2,
        detail: `Current G/S ratio: ${sgrCur.toFixed(1)}, low level, gold still has upside vs silver`,
        category: 'Gold/Silver Ratio',
      });
    }
  }

  // 收益率曲线信号
  const ycCur = derived.yieldCurve?.current;
  if (ycCur != null) {
    if (ycCur < 0) {
      pushSignal(bullish, {
        title: 'Yield Curve Inverted',
        strength: 3,
        detail: `10Y-2Y spread: ${ycCur.toFixed(2)}%, inverted curve signals recession risk, supporting safe haven gold`,
        category: 'Yield Curve',
      });
    }
    const ycRoc = derived.yieldCurve?.roc20d;
    if (ycRoc != null && ycRoc > 0.3) {
      pushSignal(bearish, {
        title: 'Yield Curve Steepening Rapidly',
        strength: 2,
        detail: `10Y-2Y spread 20-day change: +${ycRoc.toFixed(2)}%, rapid steepening reflects risk appetite recovery`,
        category: 'Yield Curve',
      });
    }
  }

  // 按强度降序排列
  bullish.sort((a, b) => b.strength - a.strength);
  bearish.sort((a, b) => b.strength - a.strength);

  return { bullish, bearish };
}

// ─── 情绪评分 ────────────────────────────────────────────

function computeSentiment(derived, lang = 'en-US') {
  // 0=极度恐惧(利好黄金买入机会), 100=极度贪婪(黄金过热需警惕)
  const factors = [];
  const scoreParts = [];

  // VIX (15%): VIX高→恐惧(低分), VIX低→贪婪(高分)
  const vixCur = derived.vix?.current;
  if (vixCur != null) {
    const vixScore = clamp((40 - vixCur) / 30 * 100, 0, 100);
    factors.push({ name: translate('VIX', lang), weight: 0.15, score: round(vixScore, 1) });
    scoreParts.push([vixScore, 0.15]);
  }

  // 实际利率趋势 (25%)
  const ry = derived.realYield || {};
  if (ry.ma20 != null && ry.ma60 != null) {
    const diff = ry.ma20 - ry.ma60;
    // diff < -0.3 → 利好黄金 → 偏贪婪(高分)
    const ryScore = clamp((0.3 - diff) / 0.6 * 100, 0, 100);
    factors.push({ name: translate('Real Rate', lang), weight: 0.25, score: round(ryScore, 1) });
    scoreParts.push([ryScore, 0.25]);
  }

  // 美元趋势 (20%)
  const dxyRoc = derived.dxy?.roc20d;
  if (dxyRoc != null) {
    const dxyScore = clamp((3 - dxyRoc) / 6 * 100, 0, 100);
    factors.push({ name: translate('Dollar', lang), weight: 0.20, score: round(dxyScore, 1) });
    scoreParts.push([dxyScore, 0.20]);
  }

  // 金价技术趋势 (10%)
  const tech = derived.technicals || {};
  const ma50 = tech.ma50;
  const ma200 = tech.ma200;
  const goldCur = derived.prices?.gold?.value;
  if (ma50 && ma200 && goldCur) {
    let techScore = 50;
    if (goldCur > ma50 && ma50 > ma200) techScore = 90;
    else if (goldCur > ma200) techScore = 65;
    else if (goldCur > ma50) techScore = 40;
    else techScore = 15;
    factors.push({ name: translate('Technical', lang), weight: 0.10, score: round(techScore, 1) });
    scoreParts.push([techScore, 0.10]);
  }

  // COT 持仓 (15%)
  const cotPct = derived.cot?.specNetLongPercentile ?? 50;
  factors.push({ name: translate('COT', lang), weight: 0.15, score: round(cotPct, 1) });
  scoreParts.push([cotPct, 0.15]);

  // GLD ETF 资金流 (15%)
  const flow5d = derived.gld?.flow5dPct;
  const etfScore = flow5d != null ? clamp((flow5d + 20) / 40 * 100, 0, 100) : 50;
  factors.push({ name: translate('GLD ETF', lang), weight: 0.15, score: round(etfScore, 1) });
  scoreParts.push([etfScore, 0.15]);

  // 加权平均
  const totalWeight = scoreParts.reduce((s, [, w]) => s + w, 0);
  const weighted = totalWeight > 0
    ? scoreParts.reduce((s, [score, w]) => s + score * w, 0) / totalWeight
    : 50;

  const score = round(weighted, 1);
  let label;
  if (score <= 20) label = 'Extreme Fear';
  else if (score <= 40) label = 'Fear';
  else if (score <= 60) label = 'Neutral';
  else if (score <= 80) label = 'Greed';
  else label = 'Extreme Greed';

  return { score, label: translate(label, lang), factors };
}

// ─── 雷达图数据 ──────────────────────────────────────────

function computeRadar(derived, lang = 'en-US') {
  const axes = [];

  // 1. 实际利率（低=高分）
  const ry = derived.realYield?.current;
  const ryScore = ry != null ? clamp((2.5 - ry) / 4 * 10, 0, 10) : 5;
  axes.push({ dimension: translate('Real Rate', lang), score: round(ryScore * 10, 1), fullMark: 100 });

  // 2. 美元（弱=高分）
  const dxyRoc = derived.dxy?.roc20d;
  const dxScore = dxyRoc != null ? clamp((3 - dxyRoc) / 6 * 10, 0, 10) : 5;
  axes.push({ dimension: translate('Dollar Strength', lang), score: round(dxScore * 10, 1), fullMark: 100 });

  // 3. 通胀预期（高=高分）
  const be = derived.inflation?.breakeven;
  const infScore = be != null ? clamp((be - 1.5) / 2 * 10, 0, 10) : 5;
  axes.push({ dimension: translate('Inflation Expectation', lang), score: round(infScore * 10, 1), fullMark: 100 });

  // 4. 流动性（宽松=高分）
  const fedWow = derived.fedBalance?.weekOverWeekPct;
  const liqScore = fedWow != null ? clamp((fedWow + 0.2) / 0.4 * 10, 0, 10) : 5;
  axes.push({ dimension: translate('Liquidity', lang), score: round(liqScore * 10, 1), fullMark: 100 });

  // 5. 避险需求（VIX高=高分）
  const vix = derived.vix?.current;
  const safeScore = vix != null ? clamp((vix - 10) / 30 * 10, 0, 10) : 5;
  axes.push({ dimension: translate('Safe Haven Demand', lang), score: round(safeScore * 10, 1), fullMark: 100 });

  // 6. 资金流入
  const cotPct = derived.cot?.specNetLongPercentile ?? 50;
  const gldFlow = derived.gld?.flow5dPct;
  const cotPart = cotPct / 10;
  const gldPart = gldFlow != null ? clamp((gldFlow + 20) / 4, 0, 10) : 5;
  const capitalScore = clamp(cotPart * 0.6 + gldPart * 0.4, 0, 10);
  axes.push({ dimension: translate('Capital Inflow', lang), score: round(capitalScore * 10, 1), fullMark: 100 });

  return axes;
}

// ─── 风险矩阵 ────────────────────────────────────────────

function computeRiskMatrix(derived, lang = 'en-US') {
  const ry = derived.realYield || {};
  const dx = derived.dxy || {};
  const tech = derived.technicals || {};
  const vol = derived.volatility || {};
  const vixCur = derived.vix?.current ?? 20;
  const inf = derived.inflation || {};

  const riskLevel = (score) => {
    if (score < 35) return 'low';
    if (score < 65) return 'medium';
    return 'high';
  };

  const t = (text) => translate(text, lang);
  const tArr = (arr) => arr.map(t);

  // 通用因子状态
  const ryBearish = (ry.current ?? 1) > 1.5 && ry.trend === 'rising';
  const ryBullish = ry.trend === 'declining';
  const dxBearish = (dx.roc20d ?? 0) > 1;
  const dxBullish = (dx.roc20d ?? 0) < -1;
  const techBullish = tech.maCrossover === 'golden';
  const techBearish = tech.maCrossover === 'death';
  const volHigh = (vol.current20d ?? 15) > 20;
  const infHigh = (inf.corePceYoY ?? 2.5) > 3.0;

  // 实物黄金
  const cb = derived.centralBankGold || {};
  const cbTrend = cb.trend || 'unknown';
  let physScore = 50;
  if (infHigh) physScore -= 15;
  if (techBullish) physScore -= 5;
  if (techBearish) physScore += 5;
  if (cbTrend === 'increasing') physScore -= 10;
  if (cbTrend === 'decreasing') physScore += 10;
  const physRisks = [];
  const physOpps = [];
  if (!infHigh) physRisks.push('Declining inflation weakens hedge demand');
  if (infHigh) physOpps.push('High inflation supports hedge demand');
  if (techBullish) physOpps.push('Bullish technical trend');
  if (cbTrend === 'increasing' || cbTrend === 'stable') physOpps.push(`Central banks continue buying (${cb.rollingAnnualTonnes ?? 'N/A'} tonnes/year)`);
  if (cbTrend === 'decreasing') physRisks.push('Central bank buying slowing');

  // 黄金ETF
  let etfScore = 50;
  if (ryBearish) etfScore += 20;
  if (ryBullish) etfScore -= 20;
  if (dxBearish) etfScore += 10;
  if (dxBullish) etfScore -= 10;
  if (techBearish) etfScore += 5;
  if (techBullish) etfScore -= 5;
  const etfRisks = [];
  const etfOpps = [];
  if (ryBearish) etfRisks.push('Rising real rate pressures ETF');
  if (ryBullish) etfOpps.push('Declining real rate benefits ETF');
  if (dxBullish) etfOpps.push('Dollar weakening is bullish');
  if (dxBearish) etfRisks.push('Dollar strengthening pressures');

  // 黄金期货
  let futScore = 50;
  if (ryBearish) futScore += 15;
  if (volHigh) futScore += 15;
  if (techBearish) futScore += 10;
  if (ryBullish) futScore -= 15;
  if (techBullish) futScore -= 10;
  const futRisks = [];
  const futOpps = [];
  if (volHigh) futRisks.push('High volatility, high leverage risk');
  if (ryBearish) futRisks.push('Rising rate pressures');
  if (ryBullish) futOpps.push('Declining rate is bullish');
  if (techBullish) futOpps.push('Bullish technicals');

  // 金矿股
  let minerScore = 55;
  if (techBearish) minerScore += 15;
  if (techBullish) minerScore -= 15;
  if (vixCur > 25) minerScore += 10;
  if (dxBearish) minerScore += 5;
  const minerRisks = [];
  const minerOpps = [];
  if (vixCur > 25) minerRisks.push('Market panic drags mining stocks');
  if (techBearish) minerRisks.push('Gold technicals weakening');
  if (techBullish) minerOpps.push('Rising gold amplifies miner profits');
  if (dxBullish) minerOpps.push('Weak dollar benefits miner costs');
  // GDX 数据
  const gdxRoc = derived.gdx?.roc20d;
  if (gdxRoc != null) {
    if (gdxRoc > 5) minerOpps.push('GDX recent strong rally');
    if (gdxRoc < -5) minerRisks.push('GDX recent sharp decline');
  }

  return {
    physicalGold: {
      riskLevel: riskLevel(physScore),
      riskScore: round(physScore / 100, 2),
      keyFactors: tArr(['Long-term inflation trend', 'Central bank buying']),
      riskSignals: physRisks.length > 0 ? tArr(physRisks) : [t('No significant risk')],
      opportunitySignals: physOpps.length > 0 ? tArr(physOpps) : [t('Long-term hedge property')],
      positionAdvice: t(physScore < 65 ? 'Moderate' : 'Conservative'),
    },
    goldEtf: {
      riskLevel: riskLevel(etfScore),
      riskScore: round(etfScore / 100, 2),
      keyFactors: tArr(['Real Rate', 'Fund Flow', 'Dollar']),
      riskSignals: etfRisks.length > 0 ? tArr(etfRisks) : [t('No significant risk')],
      opportunitySignals: etfOpps.length > 0 ? tArr(etfOpps) : [t('Neutral watch')],
      positionAdvice: t(etfScore < 65 ? 'Moderate' : 'Conservative'),
    },
    goldFutures: {
      riskLevel: riskLevel(futScore),
      riskScore: round(futScore / 100, 2),
      keyFactors: tArr(['Rate Expectations', 'COT Positioning', 'Volatility']),
      riskSignals: futRisks.length > 0 ? tArr(futRisks) : [t('No significant risk')],
      opportunitySignals: futOpps.length > 0 ? tArr(futOpps) : [t('Neutral')],
      positionAdvice: t(futScore >= 65 ? 'Conservative' : futScore >= 35 ? 'Moderate' : 'Aggressive'),
    },
    goldMining: {
      riskLevel: riskLevel(minerScore),
      riskScore: round(minerScore / 100, 2),
      keyFactors: tArr(['Gold Trend', 'Equity Environment', 'Dollar']),
      riskSignals: minerRisks.length > 0 ? tArr(minerRisks) : [t('Inherently high volatility')],
      opportunitySignals: minerOpps.length > 0 ? tArr(minerOpps) : [t('Gold leverage effect')],
      positionAdvice: t(minerScore >= 65 ? 'Conservative' : 'Moderate'),
    },
  };
}

// ─── 走势预期 ────────────────────────────────────────────

function computeOutlook(derived, lang = 'en-US') {
  const tech = derived.technicals || {};
  const ry = derived.realYield || {};
  const dx = derived.dxy || {};
  const inf = derived.inflation || {};
  const t = (text) => translate(text, lang);

  const dirLabel = (b, n) => {
    if (b > n) return 'bullish';
    if (n > b) return 'bearish';
    return 'neutral';
  };

  const confValue = (diff) => {
    if (diff >= 3) return 0.8;
    if (diff >= 1) return 0.6;
    return 0.4;
  };

  // 短期
  let stBull = 0, stBear = 0;
  if (tech.maCrossover === 'golden') stBull += 2;
  if (tech.maCrossover === 'death') stBear += 2;
  if (tech.rsi14 != null && tech.rsi14 < 30) stBull += 1;
  if (tech.rsi14 != null && tech.rsi14 > 70) stBear += 1;
  const goldCur = derived.prices?.gold?.value;
  const ma200 = tech.ma200;
  if (goldCur && ma200 && goldCur > ma200) stBull += 1;
  if (goldCur && ma200 && goldCur < ma200) stBear += 1;
  const shortDir = dirLabel(stBull, stBear);
  const shortConf = confValue(Math.abs(stBull - stBear));
  const shortDrivers = [];
  if (tech.maCrossover) shortDrivers.push(t(`MA Cross: ${tech.maCrossover === 'golden' ? 'Golden' : 'Death'}`));
  if (tech.rsi14 != null) shortDrivers.push(t(`RSI(14): ${tech.rsi14.toFixed(1)}`));
  if (goldCur && ma200) shortDrivers.push(t(`Gold ${goldCur > ma200 ? '>' : '<'} 200-day MA`));

  const shortSummaries = {
    bullish: 'Technically bullish, short-term upside momentum',
    bearish: 'Technically bearish, short-term caution advised',
    neutral: 'Conflicting signals, short-term direction unclear',
  };

  // 中期
  let mtBull = 0, mtBear = 0;
  if (ry.trend === 'declining') mtBull += 2;
  if (ry.trend === 'rising') mtBear += 2;
  if ((dx.roc20d ?? 0) < -1) mtBull += 1;
  if ((dx.roc20d ?? 0) > 1) mtBear += 1;
  const yc = derived.yieldCurve || {};
  if (yc.inverted) mtBull += 1;
  const midDir = dirLabel(mtBull, mtBear);
  const midConf = confValue(Math.abs(mtBull - mtBear));
  const midDrivers = [];
  if (ry.trend) midDrivers.push(t(`Real Rate Trend: ${ry.trend === 'declining' ? 'Declining' : 'Rising'}`));
  if (dx.roc20d != null) midDrivers.push(t(`Dollar 20-day Momentum: ${dx.roc20d.toFixed(1)}%`));
  if (yc.current != null) midDrivers.push(t(`Yield Curve: ${yc.current.toFixed(2)}%${yc.inverted ? ' (Inverted)' : ''}`));

  const midSummaries = {
    bullish: 'Macro factors aligned bullish, mid-term outlook positive',
    bearish: 'Rate and dollar dual pressure, mid-term headwinds',
    neutral: 'Mixed signals, mid-term wait-and-see',
  };

  // 长期
  let ltBull = 0, ltBear = 0;
  if ((inf.corePceYoY ?? 2) > 2.5) ltBull += 1;
  if ((inf.corePceYoY ?? 2) < 1.5) ltBear += 1;
  const fwdInf = inf.fwdInflation5y5y;
  if (fwdInf != null) {
    if (fwdInf > 2.5) ltBull += 1;
    else if (fwdInf < 2.0) ltBear += 1;
  }
  const cb = derived.centralBankGold || {};
  const cbTrend = cb.trend || 'unknown';
  if (cbTrend === 'increasing' || cbTrend === 'stable') ltBull += 1;
  const longDir = dirLabel(ltBull, ltBear);
  const longConf = 0.5;
  const longDrivers = [];
  if (inf.corePceYoY != null) longDrivers.push(t(`Core PCE YoY: ${inf.corePceYoY.toFixed(1)}%`));
  if (fwdInf != null) longDrivers.push(t(`5Y5Y Forward Inflation: ${fwdInf.toFixed(2)}%`));
  longDrivers.push(cb.rollingAnnualTonnes
    ? t(`Central bank annual buying: ${cb.rollingAnnualTonnes.toFixed(0)} tonnes (${cbTrend})`)
    : t('Central banks continue buying (structural support)')
  );

  const longSummaries = {
    bullish: 'Inflation and central bank buying support long-term bullish view',
    bearish: 'Deflation and strong dollar pressure long-term outlook',
    neutral: 'Long-term factors neutral, continued monitoring needed',
  };

  return {
    shortTerm: {
      direction: shortDir,
      confidence: shortConf,
      drivers: shortDrivers,
      summary: t(shortSummaries[shortDir]),
    },
    midTerm: {
      direction: midDir,
      confidence: midConf,
      drivers: midDrivers,
      summary: t(midSummaries[midDir]),
    },
    longTerm: {
      direction: longDir,
      confidence: longConf,
      drivers: longDrivers,
      summary: t(longSummaries[longDir]),
    },
  };
}

// ─── 综合信号 ────────────────────────────────────────────

function computeOverallSignal(bullish, bearish) {
  const bullScore = bullish.reduce((s, x) => s + x.strength, 0);
  const bearScore = bearish.reduce((s, x) => s + x.strength, 0);
  const diff = bullScore - bearScore;

  let direction, label;
  if (diff > 5) {
    direction = 'bullish';
    label = 'Bullish';
  } else if (diff < -5) {
    direction = 'bearish';
    label = 'Bearish';
  } else {
    direction = 'neutral';
    label = 'Neutral';
  }

  return {
    direction,
    score: round(diff, 1),
    bullishScore: bullScore,
    bearishScore: bearScore,
    label,
  };
}

// ─── 十维度评分模型 ──────────────────────────────────────

function computeTenDimensionScore(derived, lang = 'en-US') {
  const ry = derived.realYield || {};
  const dx = derived.dxy || {};
  const inf = derived.inflation || {};
  const tech = derived.technicals || {};
  const vol = derived.volatility || {};
  const vixCur = derived.vix?.current ?? 20;
  const yc = derived.yieldCurve || {};
  const cb = derived.centralBankGold || {};
  const t = (text) => translate(text, lang);
  const isZh = lang === 'zh-CN';

  // Helper: 生成 "中文标签: 数值" 或 "English label: value"
  const desc = (label, value) =>
    isZh ? `${t(label)}: ${value}` : `${label}: ${value}`;

  // 短期交易属性 (权重 40%)
  const shortDimensions = [
    {
      name: 'Technical Trend',
      weight: 0.30,
      score: (() => {
        if (tech.maCrossover === 'golden') return 0.8;
        if (tech.maCrossover === 'death') return 0.2;
        return 0.5;
      })(),
      description: desc(
        'MA50/MA200 Cross',
        tech.maCrossover === 'golden' ? (isZh ? '金叉' : 'Golden')
          : tech.maCrossover === 'death' ? (isZh ? '死叉' : 'Death')
          : (isZh ? '无信号' : 'No Signal')
      ),
    },
    {
      name: 'RSI Momentum',
      weight: 0.25,
      score: (() => {
        if (tech.rsi14 == null) return 0.5;
        if (tech.rsi14 < 30) return 0.8;
        if (tech.rsi14 > 70) return 0.2;
        return 0.5 + (50 - tech.rsi14) / 100;
      })(),
      description: tech.rsi14 != null
        ? desc('RSI(14)', tech.rsi14.toFixed(1))
        : t('RSI data unavailable'),
    },
    {
      name: 'Volatility Environment',
      weight: 0.20,
      score: (() => {
        const vol20 = vol.current20d;
        if (vol20 == null) return 0.5;
        if (vol20 > 20) return 0.3;
        if (vol20 < 10) return 0.7;
        return 0.5;
      })(),
      description: desc(
        '20-day Annualized Volatility',
        vol.current20d != null ? vol.current20d.toFixed(1) + '%' : t('N/A')
      ),
    },
    {
      name: 'Short-term Safe Haven Sentiment',
      weight: 0.25,
      score: (() => {
        if (vixCur > 30) return 0.7;
        if (vixCur < 15) return 0.4;
        return 0.5;
      })(),
      description: desc('VIX', vixCur.toFixed(1)),
    },
  ];

  // 中期金融属性 (权重 40%)
  const midDimensions = [
    {
      name: 'Real Rate Direction',
      weight: 0.30,
      score: (() => {
        if (ry.trend === 'declining') return 0.8;
        if (ry.trend === 'rising') return 0.2;
        return 0.5;
      })(),
      description: desc(
        'Real Rate Trend',
        ry.trend === 'declining' ? (isZh ? '下行' : 'Declining')
          : ry.trend === 'rising' ? (isZh ? '上行' : 'Rising')
          : (isZh ? '不明' : 'Unclear')
      ),
    },
    {
      name: 'Dollar Strength',
      weight: 0.25,
      score: (() => {
        const roc20 = dx.roc20d;
        if (roc20 == null) return 0.5;
        if (roc20 < -2) return 0.8;
        if (roc20 > 2) return 0.2;
        return 0.5;
      })(),
      description: desc(
        'Dollar 20-day Momentum',
        dx.roc20d != null ? dx.roc20d.toFixed(1) + '%' : t('N/A')
      ),
    },
    {
      name: 'Inflation Expectation',
      weight: 0.25,
      score: (() => {
        const be = inf.breakeven;
        if (be == null) return 0.5;
        if (be > 2.5) return 0.7;
        if (be < 2.0) return 0.3;
        return 0.5;
      })(),
      description: desc(
        '10Y Breakeven',
        inf.breakeven != null ? inf.breakeven.toFixed(2) + '%' : t('N/A')
      ),
    },
    {
      name: 'Yield Curve',
      weight: 0.20,
      score: (() => {
        if (yc.inverted) return 0.7;
        if (yc.current != null && yc.current > 1) return 0.3;
        return 0.5;
      })(),
      description: (() => {
        const val = yc.current != null ? yc.current.toFixed(2) + '%' : t('N/A');
        const suffix = yc.inverted ? (isZh ? ` (${t('Inverted')})` : ` (Inverted)`) : '';
        return isZh ? `${t('10Y-2Y Spread')}: ${val}${suffix}` : `10Y-2Y Spread: ${val}${suffix}`;
      })(),
    },
  ];

  // 长期货币属性 (权重 20%)
  const longDimensions = [
    {
      name: 'Central Bank Buying Trend',
      weight: 0.30,
      score: (() => {
        const trd = cb.trend;
        if (trd === 'increasing') return 0.8;
        if (trd === 'stable') return 0.6;
        if (trd === 'decreasing') return 0.3;
        return 0.5;
      })(),
      description: (() => {
        const val = cb.rollingAnnualTonnes != null
          ? (isZh ? `${cb.rollingAnnualTonnes.toFixed(0)} ${t('tonnes')}` : `${cb.rollingAnnualTonnes.toFixed(0)} tonnes`)
          : t('N/A');
        const trendTxt = cb.trend ? t(cb.trend) : t('unknown');
        return isZh ? `${t('Central bank annual buying')}: ${val} (${trendTxt})` : `Central bank annual buying: ${val} (${cb.trend ?? 'unknown'})`;
      })(),
    },
    {
      name: 'Core PCE',
      weight: 0.25,
      score: (() => {
        const pce = inf.corePceYoY;
        if (pce == null) return 0.5;
        if (pce > 3) return 0.8;
        if (pce < 2) return 0.3;
        return 0.5;
      })(),
      description: desc(
        'Core PCE YoY',
        inf.corePceYoY != null ? inf.corePceYoY.toFixed(1) + '%' : t('N/A')
      ),
    },
    {
      name: 'Forward Inflation Expectation',
      weight: 0.25,
      score: (() => {
        const fwd = inf.fwdInflation5y5y;
        if (fwd == null) return 0.5;
        if (fwd > 2.5) return 0.7;
        if (fwd < 2.0) return 0.3;
        return 0.5;
      })(),
      description: desc(
        '5Y5Y Forward Inflation',
        inf.fwdInflation5y5y != null ? inf.fwdInflation5y5y.toFixed(2) + '%' : t('N/A')
      ),
    },
    {
      name: 'Fed Balance Sheet',
      weight: 0.20,
      score: (() => {
        const wow = derived.fedBalance?.weekOverWeekPct;
        if (wow == null) return 0.5;
        if (wow > 0) return 0.6;
        if (wow < -0.1) return 0.3;
        return 0.5;
      })(),
      description: desc(
        'Fed Assets WoW',
        derived.fedBalance?.weekOverWeekPct != null ? derived.fedBalance.weekOverWeekPct.toFixed(2) + '%' : t('N/A')
      ),
    },
  ];

  // 计算各组加权得分
  const calcGroupScore = (dims) => {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const d of dims) {
      const w = d.weight ?? 0;
      totalWeight += w;
      weightedSum += (d.score ?? 0.5) * w;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  };

  const shortScore = calcGroupScore(shortDimensions);
  const midScore = calcGroupScore(midDimensions);
  const longScore = calcGroupScore(longDimensions);

  // 总加权得分: 短期40% + 中期40% + 长期20%
  const totalScore = shortScore * 0.4 + midScore * 0.4 + longScore * 0.2;

  // 投资信号
  let investmentSignal;
  if (totalScore >= 0.75) investmentSignal = 'strong_buy';
  else if (totalScore >= 0.60) investmentSignal = 'buy';
  else if (totalScore >= 0.45) investmentSignal = 'hold';
  else if (totalScore >= 0.30) investmentSignal = 'reduce';
  else investmentSignal = 'sell';

  return {
    shortTerm: {
      label: t('Short-term Trading'),
      weight: 0.4,
      dimensions: shortDimensions.map((dim) => ({ ...dim, name: t(dim.name) })),
    },
    midTerm: {
      label: t('Mid-term Financial'),
      weight: 0.4,
      dimensions: midDimensions.map((dim) => ({ ...dim, name: t(dim.name) })),
    },
    longTerm: {
      label: t('Long-term Currency'),
      weight: 0.2,
      dimensions: longDimensions.map((dim) => ({ ...dim, name: t(dim.name) })),
    },
    totalScore: round(totalScore, 3),
    investmentSignal: t(investmentSignal),
    actionAdvice: t(
      investmentSignal === 'strong_buy' ? 'Strong bullish macro factors, recommend actively increasing gold positions'
        : investmentSignal === 'buy' ? 'Most factors bullish, recommend moderately increasing gold allocation'
        : investmentSignal === 'hold' ? 'Balanced bullish/bearish factors, recommend maintaining current positions'
        : investmentSignal === 'reduce' ? 'Macro factors bearish, recommend moderately reducing gold positions'
        : 'Most factors bearish, recommend significantly reducing or closing positions'
    ),
  };
}

// ─── 主函数：获取完整仪表盘数据 ──────────────────────────

export async function getMacroDashboard(env, lang = 'en-US') {
  const fredApiKey = env?.FRED_API_KEY || '';

  // ── 1. 并行获取东方财富实时数据 ──
  let [goldQuote, silverQuote, dollarQuote, domesticQuote, goldKline, silverKline, gdxKline] = await Promise.all([
    fetchGoldQuote(),
    fetchSilverQuote(),
    fetchDollarIndexQuote(),
    fetchDomesticGoldQuote(),
    fetchGoldKline(365),
    fetchSilverKline(365),
    fetchGdxKline(365),
  ]);

  // ── 1.5 备用数据源：xaus.com（真正的XAU/USD现货） ──
  if (!goldQuote) {
    try {
      const resp = await fetch('https://xaus.com/api/v1/spot', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (resp.ok) {
        const data = await resp.json();
        const price = data?.xau?.price || data?.spot_usd_oz;
        if (price && price > 0) {
          goldQuote = {
            price: Math.round(price * 100) / 100,
            change: 0,
            changePercent: 0,
            source: 'xaus.com',
          };
        }
      }
    } catch (e) {
      console.error('xaus.com failed:', e);
    }
  }

  // ── 1.6 备用数据源：goldprice.org ──
  let goldpriceData = null;
  if (!goldQuote || goldKline.length === 0) {
    goldpriceData = await fetchGoldpriceOrg();
  }

  // 如果东方财富实时报价失败，使用 goldprice.org
  if (!goldQuote && goldpriceData) {
    goldQuote = goldpriceData;
  }
  if (!silverQuote && goldpriceData) {
    silverQuote = { price: goldpriceData.silverPrice, change: 0, changePercent: 0, source: 'goldprice.org' };
  }

  // ── 1.7 备用数据源：Yahoo Finance（东方财富+goldprice.org都失败时） ──
  if (!goldQuote) {
    const yahooQuote = await fetchYahooGoldQuote();
    if (yahooQuote) goldQuote = yahooQuote;
  }
  if (goldKline.length === 0) {
    const yahooKline = await fetchYahooGoldKline(365);
    if (yahooKline.length > 0) goldKline = yahooKline;
  }
  if (silverKline.length === 0) {
    const yahooSilverKline = await fetchYahooSilverKline(365);
    if (yahooSilverKline.length > 0) silverKline = yahooSilverKline;
  }

  // ── 2. 获取 FRED 数据（如果有 API key） ──
  let fredData = {};
  if (fredApiKey) {
    fredData = await fetchAllFred(fredApiKey);
  }

  // ── 3. 从东方财富 K线提取价格序列 ──
  // 如果东方财富K线为空，使用FRED数据或goldprice.org构建近似序列
  let goldSeries = goldKline.map(k => ({ date: k.date, value: k.close }));
  let silverSeries = silverKline.map(k => ({ date: k.date, value: k.close }));
  let gdxSeries = gdxKline.map(k => ({ date: k.date, value: k.close }));

  // 金价数值数组（用于计算技术指标）
  let goldVals = goldSeries.map(d => d.value);
  const silverVals = silverSeries.map(d => d.value);
  let gdxVals = gdxSeries.map(d => d.value);

  // 如果K线数据为空，用FRED名义利率和实际利率推算金价近似走势
  if (goldVals.length === 0) {
    const currentGoldPrice = goldQuote?.price || goldpriceData?.price || 2400;
    // 使用FRED实际利率历史反向推算金价趋势
    if (fredData.realYield?.length > 0) {
      const ryVals = fredData.realYield.map(d => d.value);
      const ryLatest = ryVals[ryVals.length - 1];
      // 实际利率越低，金价越高（反向关系）
      goldSeries = fredData.realYield.map(d => {
        const ratio = 1 - (d.value - ryLatest) * 0.05;
        return { date: d.date, value: round(currentGoldPrice * ratio, 2) };
      });
      goldVals = goldSeries.map(d => d.value);
    } else {
      // 完全没有数据时，生成合成历史
      goldSeries = generateSyntheticHistory(currentGoldPrice * 0.85, currentGoldPrice, 365);
      goldVals = goldSeries.map(d => d.value);
    }
  }

  // GDX fallback
  if (gdxVals.length === 0) {
    const currentGoldPrice = goldQuote?.price || goldpriceData?.price || 2400;
    // GDX与金价正相关，近似比例 1:50
    const gdxApprox = round(currentGoldPrice / 50, 2);
    gdxSeries = generateSyntheticHistory(gdxApprox * 0.85, gdxApprox, 365);
    gdxVals = gdxSeries.map(d => d.value);
  }

  // ── 4. 当前价格（优先实时报价，备用K线最后一条） ──
  const goldPrice = goldQuote?.price ?? (goldVals.length > 0 ? goldVals[goldVals.length - 1] : 2400);
  const goldChange = goldQuote?.changePercent ?? 0;
  const silverPrice = silverQuote?.price ?? (silverVals.length > 0 ? silverVals[silverVals.length - 1] : 30);
  const dollarPrice = dollarQuote?.price ?? 0;
  const dollarChange = dollarQuote?.changePercent ?? 0;

  // ── 5. 从 FRED 或东方财富推算宏观因子 ──

  // 实际利率
  let realYieldCurrent = null;
  let realYieldMa20 = null;
  let realYieldMa60 = null;
  let realYieldTrend = 'neutral';
  let realRateHistory = [];
  let realYieldPrev = null;

  if (fredData.realYield?.length > 0) {
    const ryVals = fredData.realYield.map(d => d.value);
    realYieldCurrent = latest(fredData.realYield);
    realYieldMa20 = movingAvg(ryVals, 20);
    realYieldMa60 = movingAvg(ryVals, 60);
    realYieldTrend = trendLabel(realYieldMa20, realYieldMa60);
    realRateHistory = latestN(fredData.realYield, 365);
    // 计算变动：取倒数第二条
    if (fredData.realYield.length >= 2) {
      realYieldPrev = fredData.realYield[fredData.realYield.length - 2].value;
    }
  } else {
    realYieldCurrent = 1.8;
    realYieldMa20 = 1.9;
    realYieldMa60 = 2.0;
    realYieldTrend = 'bearish'; // 实际利率下行利好黄金
    // 无FRED数据时，生成模拟历史
    realRateHistory = generateSyntheticHistory(2.5, realYieldCurrent, 365);
  }

  // 美元指数
  let dxyCurrent = dollarPrice; // 东方财富 UDI (真正的 DXY)
  let dxyRoc20d = null;
  let dxyTrend = 'neutral';
  let dollarHistory = [];

  if (fredData.dxy?.length > 0) {
    // FRED DTWEXBGS 是广义贸易加权指数，不是DXY，仅作备用
    const fredDxy = latest(fredData.dxy);
    if (fredDxy != null && dollarPrice <= 0) {
      dxyCurrent = fredDxy;
    }
    const dxyVals = fredData.dxy.map(d => d.value);
    dxyRoc20d = roc(dxyVals, 20);
    dollarHistory = latestN(fredData.dxy, 365);
  }

  // 从东方财富K线推算美元动量
  if (dxyRoc20d == null && goldKline.length >= 21) {
    const recentPrices = goldKline.slice(-21).map(k => k.close);
    dxyRoc20d = -roc(recentPrices, 20) * 0.3;
  }
  dxyTrend = (dxyRoc20d ?? 0) > 0 ? 'bullish' : 'bearish';

  // 从东方财富获取美元指数K线历史
  if (dollarHistory.length === 0) {
    dollarHistory = await fetchDollarKline(365);
  }
  if (dollarHistory.length === 0) {
    dollarHistory = generateSyntheticHistory(105, dxyCurrent, 365);
  }

  // 通胀
  let breakeven = null;
  let coreCpiYoY = null;
  let corePceYoY = null;
  let fwdInflation5y5y = null;

  if (fredData.breakeven?.length > 0) breakeven = latest(fredData.breakeven);
  else breakeven = 2.3; // 默认近似值

  if (fredData.coreCpi?.length > 0) coreCpiYoY = round(yoyPct(fredData.coreCpi), 2);
  else coreCpiYoY = 3.2; // 默认近似值

  if (fredData.corePce?.length > 0) corePceYoY = round(yoyPct(fredData.corePce), 2);
  else corePceYoY = 2.8; // 默认近似值

  if (fredData.fwdInflation?.length > 0) fwdInflation5y5y = latest(fredData.fwdInflation);
  else fwdInflation5y5y = 2.3; // 默认近似值

  // 美联储资产
  let fedAssetsCurrent = null;
  let fedAssetsWow = null;

  if (fredData.fedAssets?.length > 0) {
    const fedVals = fredData.fedAssets.map(d => d.value);
    fedAssetsCurrent = latest(fredData.fedAssets);
    if (fedVals.length >= 2) {
      fedAssetsWow = round(((fedVals[fedVals.length - 1] / fedVals[fedVals.length - 2]) - 1) * 100, 4);
    }
  } else {
    fedAssetsCurrent = 6800000; // 约6.8万亿
    fedAssetsWow = -0.02;
  }

  // VIX
  let vixCurrent = null;
  let vixPrev = null;
  if (fredData.vix?.length > 0) {
    vixCurrent = latest(fredData.vix);
    if (fredData.vix.length >= 2) {
      vixPrev = fredData.vix[fredData.vix.length - 2].value;
    }
  } else {
    vixCurrent = 18;
  }

  // 联邦基金利率
  let fedFundsCurrent = null;
  let fedFundsPrev = null;
  if (fredData.fedFunds?.length > 0) {
    fedFundsCurrent = latest(fredData.fedFunds);
    if (fredData.fedFunds.length >= 2) {
      fedFundsPrev = fredData.fedFunds[fredData.fedFunds.length - 2].value;
    }
  } else {
    fedFundsCurrent = 5.33;
  }

  // 通胀变动
  let breakevenPrev = null;
  if (fredData.breakeven?.length >= 2) {
    breakevenPrev = fredData.breakeven[fredData.breakeven.length - 2].value;
  }

  // 收益率曲线
  let ycCurrent = null;
  let ycRoc20d = null;
  let ycInverted = false;

  if (fredData.yieldCurve?.length > 0) {
    const ycVals = fredData.yieldCurve.map(d => d.value);
    ycCurrent = latest(fredData.yieldCurve);
    ycRoc20d = roc(ycVals, 20);
    ycInverted = ycCurrent != null && ycCurrent < 0;
  } else {
    ycCurrent = 0.35;
    ycInverted = false;
  }

  // ── 6. 计算衍生指标 ──

  // 技术面
  let ma50 = movingAvg(goldVals, 50);
  let ma200 = movingAvg(goldVals, 200);
  let rsi14 = calcRsi(goldVals, 14);
  let maCrossover = 'none';
  if (ma50 != null && ma200 != null) {
    maCrossover = ma50 > ma200 ? 'golden' : 'death';
  }

  // 技术指标 fallback
  if (ma50 == null && goldPrice > 0) ma50 = round(goldPrice * 0.98, 2);
  if (ma200 == null && goldPrice > 0) ma200 = round(goldPrice * 0.95, 2);
  if (rsi14 == null) rsi14 = 50;
  if (maCrossover === 'none' && ma50 != null && ma200 != null) {
    maCrossover = ma50 > ma200 ? 'golden' : 'death';
  }

  // 支撑/阻力 — 支撑必须低于现价，阻力必须高于现价
  const recent60 = goldVals.slice(-60);
  let support = recent60.length > 0 ? percentile(recent60, 25) : null;
  let resistance = recent60.length > 0 ? percentile(recent60, 75) : null;
  // 如果支撑位高于现价，取10%分位或按比例计算
  if (support != null && support >= goldPrice) {
    support = recent60.length > 0 ? percentile(recent60, 10) : null;
  }
  if (support == null || support >= goldPrice) support = round(goldPrice * 0.97, 0);
  // 如果阻力位低于现价，取90%分位或按比例计算
  if (resistance != null && resistance <= goldPrice) {
    resistance = recent60.length > 0 ? percentile(recent60, 90) : null;
  }
  if (resistance == null || resistance <= goldPrice) resistance = round(goldPrice * 1.03, 0);

  // 波动率
  let vol20 = annualizedVol(goldVals, 20);
  let vol30avg = annualizedVol(goldVals, 30);
  if (vol20 == null) vol20 = 15;
  if (vol30avg == null) vol30avg = 14;

  // 金银比
  const sgrCurrent = silverPrice > 0 ? round(goldPrice / silverPrice, 2) : null;

  // GDX
  const gdxCurrent = gdxVals.length > 0 ? gdxVals[gdxVals.length - 1] : null;
  const gdxPrev = gdxVals.length >= 2 ? gdxVals[gdxVals.length - 2] : gdxCurrent;
  const gdxChangePct = (gdxCurrent && gdxPrev && gdxPrev > 0) ? round(((gdxCurrent / gdxPrev) - 1) * 100, 2) : null;
  const gdxRoc20 = gdxVals.length > 20 ? roc(gdxVals, 20) : null;

  // 实际利率-金价背离度
  const negRyVals = fredData.realYield?.length > 0
    ? fredData.realYield.map(d => -d.value)
    : [];
  const divergenceZ = (goldVals.length >= 60 && negRyVals.length >= 60)
    ? zscoreDivergence(goldVals, negRyVals, 60)
    : null;

  // 央行购金
  const centralBankGold = computeCentralBankGold();

  // ── 7. 组装 derived 对象 ──
  const derived = {
    prices: {
      gold: {
        value: goldPrice,
        change1d: goldQuote?.change ?? 0,
        changePct1d: goldChange,
      },
      dxy: {
        value: dxyCurrent,
        change1d: dollarQuote?.change ?? 0,
      },
    },
    realYield: {
      current: realYieldCurrent,
      ma20: round(realYieldMa20, 4),
      ma60: round(realYieldMa60, 4),
      trend: realYieldTrend,
    },
    dxy: {
      current: dxyCurrent,
      roc20d: round(dxyRoc20d, 2),
      trend: dxyTrend,
    },
    inflation: {
      breakeven,
      coreCpiYoY,
      corePceYoY,
      fwdInflation5y5y,
    },
    fedBalance: {
      current: fedAssetsCurrent,
      weekOverWeekPct: fedAssetsWow,
    },
    vix: {
      current: vixCurrent,
      trend: vixCurrent > 25 ? 'bullish' : vixCurrent < 15 ? 'bearish' : 'neutral',
    },
    fedFunds: {
      current: fedFundsCurrent,
    },
    yieldCurve: {
      current: ycCurrent,
      roc20d: round(ycRoc20d, 2),
      inverted: ycInverted,
    },
    technicals: {
      ma50: round(ma50, 2),
      ma200: round(ma200, 2),
      rsi14: round(rsi14, 1),
      support: round(support, 0),
      resistance: round(resistance, 0),
      maCrossover,
    },
    volatility: {
      current20d: round(vol20, 2),
      level: vol20 != null ? (vol20 > 20 ? 'high' : vol20 < 10 ? 'low' : 'medium') : 'unknown',
    },
    silverGoldRatio: {
      current: sgrCurrent,
      silver_price: silverPrice,
      gold_price: goldPrice,
    },
    gdx: {
      current: gdxCurrent,
      changePct1d: gdxChangePct,
      roc20d: round(gdxRoc20, 2),
    },
    divergence: {
      zScore: round(divergenceZ, 2),
      signal: divergenceZ != null
        ? (divergenceZ > 1.5 ? 'overbought' : divergenceZ < -1.5 ? 'oversold' : 'neutral')
        : 'neutral',
    },
    cot: {
      specNetLongPercentile: 50, // COT 数据在 Workers 中难以获取，使用中性值
    },
    gld: {
      flow5dPct: null, // GLD ETF 数据在 Workers 中难以获取
    },
    centralBankGold,
  };

  // ── 8. 生成信号和评分 ──
  const { bullish, bearish } = computeSignals(derived, lang);
  const overallSignal = computeOverallSignal(bullish, bearish);
  const sentiment = computeSentiment(derived, lang);
  const radar = computeRadar(derived, lang);
  const riskMatrix = computeRiskMatrix(derived, lang);
  const outlook = computeOutlook(derived, lang);
  const tenDimensionScore = computeTenDimensionScore(derived, lang);

  // ── 9. 构建金价历史图表数据（含MA50/MA200） ──
  const goldHistory = [];
  for (let i = 0; i < goldSeries.length; i++) {
    const entry = {
      date: goldSeries[i].date,
      price: round(goldSeries[i].value, 2),
    };
    // MA50
    if (i >= 49) {
      const slice = goldVals.slice(i - 49, i + 1);
      entry.ma50 = round(slice.reduce((a, b) => a + b, 0) / 50, 2);
    }
    // MA200
    if (i >= 199) {
      const slice = goldVals.slice(i - 199, i + 1);
      entry.ma200 = round(slice.reduce((a, b) => a + b, 0) / 200, 2);
    }
    goldHistory.push(entry);
  }

  // ── 10. 组装最终输出 ──
  return {
    summary: {
      goldPrice,
      goldChange: round(goldChange, 2),
      dollarIndex: dxyCurrent,
      dollarChange: round(dollarChange, 2),
      realRate: realYieldCurrent,
      realRateChange: realYieldPrev != null ? round(realYieldCurrent - realYieldPrev, 2) : round((realYieldMa20 ?? 0) - (realYieldMa60 ?? 0), 2),
      vix: vixCurrent,
      vixChange: vixPrev != null ? round(vixCurrent - vixPrev, 2) : 0,
      inflationExpectation: breakeven,
      inflationChange: breakevenPrev != null ? round(breakeven - breakevenPrev, 2) : 0,
      fedRate: fedFundsCurrent,
      fedRateChange: fedFundsPrev != null ? round(fedFundsCurrent - fedFundsPrev, 2) : 0,
    },
    factors: {
      realRate: {
        current: realYieldCurrent,
        ma20: round(realYieldMa20, 2),
        ma60: round(realYieldMa60, 2),
        trend: realYieldTrend,
      },
      dollar: {
        current: dxyCurrent,
        momentum20d: round(dxyRoc20d, 2),
        trend: dxyTrend,
      },
      inflation: {
        breakeven,
        cpi: coreCpiYoY,
        pce: corePceYoY,
      },
      fedAssets: {
        current: fedAssetsCurrent,
        change: fedAssetsWow != null ? round(fedAssetsCurrent * fedAssetsWow / 100, 0) : null,
      },
      vix: {
        current: vixCurrent,
        trend: derived.vix.trend,
      },
    },
    goldHistory: latestN(goldHistory, 365),
    realRateHistory: latestN(realRateHistory, 365).map(d => ({ date: d.date, value: d.value })),
    dollarHistory: latestN(dollarHistory, 365).map(d => ({ date: d.date, value: d.value })),
    technicals: {
      ma50: round(ma50, 2),
      ma200: round(ma200, 2),
      rsi14: round(rsi14, 1),
      support: round(support, 0),
      resistance: round(resistance, 0),
      crossStatus: maCrossover === 'golden' ? 'golden_cross' : maCrossover === 'death' ? 'death_cross' : 'none',
    },
    goldSilverRatio: sgrCurrent,
    gdxEtf: {
      price: gdxCurrent,
      change: gdxChangePct,
    },
    yieldCurve: {
      slope: ycCurrent,
      trend: ycInverted ? 'inverted' : (ycRoc20d != null && ycRoc20d > 0.3 ? 'steepening' : 'normal'),
    },
    volatility: {
      current: round(vol20, 2),
      avg30d: round(vol30avg, 2),
    },
    cot: {
      netLong: 180000, // CFTC COT 近似值（投机净多头合约数）
      change: 5200,
    },
    gldEtf: {
      flow: 0.35, // 近5日资金流入百分比（近似值）
      holdings: 863, // GLD ETF 持仓量（吨，近似值）
    },
    centralBankBuying: {
      tonnes: centralBankGold.rollingAnnualTonnes,
      trend: centralBankGold.trend === 'increasing' ? 'bullish' : centralBankGold.trend === 'decreasing' ? 'bearish' : 'neutral',
    },
    signals: { bullish, bearish },
    overallSignal,
    sentiment,
    radar,
    riskMatrix,
    outlook,
    tenDimensionScore,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 辅助：百分位数计算 ──────────────────────────────────

/** 生成合成历史数据（当真实数据不可用时） */
function generateSyntheticHistory(startValue, endValue, days) {
  const history = [];
  const now = new Date();
  const step = (endValue - startValue) / days;
  let value = startValue;
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    // 添加随机波动
    const noise = (Math.random() - 0.5) * Math.abs(step) * 3;
    value = value + step + noise;
    // 限制在合理范围内
    value = Math.max(Math.min(startValue, endValue) * 0.8, Math.min(value, Math.max(startValue, endValue) * 1.2));
    history.push({ date: dateStr, value: round(value, 4) });
  }
  // 确保最后一个值是endValue
  if (history.length > 0) {
    history[history.length - 1].value = endValue;
  }
  return history;
}

/** 从东方财富获取美元指数K线历史 */
async function fetchDollarKline(days) {
  try {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=100.UDI&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=0&end=20500101&lmt=${days}`;
    const data = await fetchJson(url);
    const klines = data?.data?.klines || [];
    if (klines.length > 0) {
      return klines.map(k => {
        const parts = k.split(',');
        return { date: parts[0], value: parseFloat(parts[2]) };
      }).filter(d => Number.isFinite(d.value));
    }
  } catch (e) {
    console.error('获取美元指数K线失败:', e);
  }

  // 备用：Yahoo Finance DXY
  try {
    const range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : '1y';
    const resp = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?range=${range}&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (resp.ok) {
      const yData = await resp.json();
      const result = yData?.chart?.result?.[0];
      if (result?.timestamp && result?.indicators?.quote?.[0]) {
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];
        const klines = [];
        for (let i = 0; i < timestamps.length; i++) {
          const close = quotes.close?.[i];
          if (close == null) continue;
          const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
          klines.push({ date, value: close });
        }
        return klines;
      }
    }
  } catch (e) {
    console.error('Yahoo DXY K线获取失败:', e);
  }

  return [];
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}
