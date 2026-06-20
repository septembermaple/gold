/**
 * 经济日历服务
 * 数据源: tradays.com (mql5.com) widget 页面
 * - https://www.tradays.com/en/economic-calendar/widget
 * - 页面内联 JS: Calendar.Data = [{...}]
 */

// 常见货币代码 -> 中文国家名称
const currencyToCountryZh = {
  USD: '美国',
  EUR: '欧元区',
  GBP: '英国',
  JPY: '日本',
  CNY: '中国',
  CHF: '瑞士',
  CAD: '加拿大',
  AUD: '澳大利亚',
  NZD: '新西兰',
  SEK: '瑞典',
  NOK: '挪威',
  INR: '印度',
  BRL: '巴西',
  RUB: '俄罗斯',
  KRW: '韩国',
  HKD: '香港',
  SGD: '新加坡',
  ZAR: '南非',
  TRY: '土耳其',
  MXN: '墨西哥',
  MYR: '马来西亚',
  IDR: '印尼',
  THB: '泰国',
  PHP: '菲律宾',
  VND: '越南',
  TWD: '台湾',
  ARS: '阿根廷',
  CLP: '智利',
  COP: '哥伦比亚',
  PEN: '秘鲁',
  PLN: '波兰',
  CZK: '捷克',
  HUF: '匈牙利',
  RON: '罗马尼亚',
  EGP: '埃及',
  ILS: '以色列',
  SAR: '沙特阿拉伯',
  AED: '阿联酋',
  QAR: '卡塔尔',
  KWD: '科威特',
  JOD: '约旦',
  UAH: '乌克兰',
  RSD: '塞尔维亚',
  BGN: '保加利亚',
  HRK: '克罗地亚',
  DKK: '丹麦',
  IEP: '爱尔兰',
  PTE: '葡萄牙',
  ESP: '西班牙',
  ITL: '意大利',
  GRD: '希腊',
  NLG: '荷兰',
  BEF: '比利时',
  ATS: '奥地利',
  FIM: '芬兰',
  LVL: '拉脱维亚',
  EEK: '爱沙尼亚',
  LTL: '立陶宛',
  SKK: '斯洛伐克',
  SIT: '斯洛文尼亚',
  CYP: '塞浦路斯',
  MTL: '马耳他',
  ISK: '冰岛',
};

const currencyToCountryEn = {
  USD: 'United States',
  EUR: 'Euro Area',
  GBP: 'United Kingdom',
  JPY: 'Japan',
  CNY: 'China',
  CHF: 'Switzerland',
  CAD: 'Canada',
  AUD: 'Australia',
  NZD: 'New Zealand',
  SEK: 'Sweden',
  NOK: 'Norway',
  INR: 'India',
  BRL: 'Brazil',
  RUB: 'Russia',
  KRW: 'South Korea',
  HKD: 'Hong Kong',
  SGD: 'Singapore',
  ZAR: 'South Africa',
  TRY: 'Turkey',
  MXN: 'Mexico',
  MYR: 'Malaysia',
  IDR: 'Indonesia',
  THB: 'Thailand',
  PHP: 'Philippines',
  VND: 'Vietnam',
  TWD: 'Taiwan',
};

/**
 * 清除多余空格和 HTML 实体
 */
function cleanText(s) {
  if (!s) return '';
  return String(s)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 影响级别提升规则：根据事件标题和货币智能判断
function boostImpact(title, currency, originalImpact) {
  if (!title) return originalImpact;
  const t = String(title).toLowerCase();
  const c = (currency || '').toUpperCase();

  // 高影响事件（主要经济体的关键指标）
  const highImpactKeywords = [
    'interest rate', 'rate decision', 'monetary policy',
    'cpi', 'consumer price', 'inflation',
    'nonfarm', 'nfp', 'payroll', 'unemployment',
    'gdp', 'gross domestic product',
    'fed chair', 'fomc', 'press conference', 'statement',
    'ecb president', 'boe governor', 'boj governor', 'rba governor',
    'central bank', 'central bank governor',
    'retail sales', 'core retail',
    'pce price', 'personal consumption',
  ];

  // 主要货币（USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF）
  const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];
  const isMajorCurrency = majorCurrencies.includes(c);

  // 检查标题是否包含高影响关键词
  let isHighImpact = highImpactKeywords.some((kw) => t.includes(kw));
  // 央行行长/主席讲话 对于主要货币一定是高影响
  if (isMajorCurrency && (t.includes('speech') || t.includes('讲话') || t.includes('statement') || t.includes('testimony'))) {
    if (t.includes('president') || t.includes('governor') || t.includes('chair') || t.includes('member') || t.includes('行长') || t.includes('主席') || t.includes('理事')) {
      isHighImpact = true;
    }
  }
  // FOMC 会议纪要一定是高影响
  if (c === 'USD' && (t.includes('fomc') || t.includes('minutes') || t.includes('beige book'))) {
    isHighImpact = true;
  }
  // 央行利率决议一定是高影响
  if (isMajorCurrency && t.includes('rate')) {
    isHighImpact = true;
  }
  // 主要货币的CPI一定是高影响
  if (isMajorCurrency && t.includes('cpi')) {
    isHighImpact = true;
  }
  // 主要货币的GDP一定是高影响
  if (isMajorCurrency && t.includes('gdp')) {
    isHighImpact = true;
  }

  // 中等影响关键词
  const mediumImpactKeywords = [
    'producer price', 'ppi',
    'industrial production', 'factory orders',
    'consumer confidence', 'consumer sentiment',
    'building permits', 'housing starts', 'home sales',
    'trade balance', 'current account',
    'crude oil inventories',
    'initial jobless claims',
    'import price', 'export price',
    'focus market report', 'focus report',
    'mpc', 'rcv', 'rbnz',
  ];
  let isMediumImpact = mediumImpactKeywords.some((kw) => t.includes(kw));

  // 次要货币的央行讲话也是中等影响
  if (!isMajorCurrency && (t.includes('speech') || t.includes('讲话'))) {
    isMediumImpact = true;
  }

  if (isHighImpact) return 'high';
  if (isMediumImpact && originalImpact !== 'high') return 'medium';
  return originalImpact || 'low';
}

// 常见事件标题的中英文翻译表
const zhTitleMap = {
  'ECB President Lagarde Speech': '欧洲央行行长拉加德讲话',
  'ECB President Christine Lagarde Speech': '欧洲央行行长克里斯蒂娜·拉加德讲话',
  'Fed Governor Waller Speech': '美联储理事沃勒讲话',
  'Fed Governor Christopher Waller Speech': '美联储理事克里斯托弗·沃勒讲话',
  'Fed Chair Powell Speech': '美联储主席鲍威尔讲话',
  'Fed Chair Jerome Powell Speech': '美联储主席杰罗姆·鲍威尔讲话',
  'FOMC Minutes': 'FOMC会议纪要',
  'FOMC Member Speech': 'FOMC委员讲话',
  'ECB Executive Board Member Lane Speech': '欧洲央行执委会成员莱恩讲话',
  'ECB Executive Board Member Speech': '欧洲央行执委会成员讲话',
  'BOE Governor Speech': '英国央行行长讲话',
  'BoE Governor Andrew Bailey Speech': '英国央行行长安德鲁·贝利讲话',
  'BOJ Governor Speech': '日本央行行长讲话',
  'RBA Governor Speech': '澳洲联储主席讲话',
  'RBNZ Governor Speech': '新西兰联储主席讲话',
  'BOC Governor Speech': '加拿大央行行长讲话',
  'BCB Focus Market Report': '巴西央行焦点市场报告',
  'Focus Market Report': '焦点市场报告',
  'CPI m/m': 'CPI月率',
  'CPI y/y': 'CPI年率',
  'CPI MoM': 'CPI月率',
  'CPI YoY': 'CPI年率',
  'Core CPI m/m': '核心CPI月率',
  'Core CPI y/y': '核心CPI年率',
  'Core CPI MoM': '核心CPI月率',
  'Core CPI YoY': '核心CPI年率',
  'Common CPI y/y': '普通CPI年率',
  'Median CPI y/y': '中位数CPI年率',
  'Trimmed CPI y/y': '截尾均值CPI年率',
  'Retail Sales m/m': '零售销售月率',
  'Core Retail Sales m/m': '核心零售销售月率',
  'PPI m/m': 'PPI月率',
  'PPI y/y': 'PPI年率',
  'GDP q/q': 'GDP季率',
  'GDP y/y': 'GDP年率',
  'GDP Annualized': 'GDP年化率',
  'Unemployment Rate': '失业率',
  'Nonfarm Payrolls': '非农就业人数',
  'Initial Jobless Claims': '首次申请失业救济金人数',
  'Continuing Jobless Claims': '持续申请失业救济金人数',
  'Consumer Confidence Index': '消费者信心指数',
  'Consumer Sentiment': '消费者情绪',
  'Michigan Consumer Sentiment': '密歇根大学消费者信心',
  'ISM Manufacturing PMI': 'ISM制造业PMI',
  'ISM Non-Manufacturing PMI': 'ISM非制造业PMI',
  'Manufacturing PMI': '制造业PMI',
  'Services PMI': '服务业PMI',
  'Composite PMI': '综合PMI',
  'Trade Balance': '贸易收支',
  'Current Account': '经常帐',
  'Industrial Production m/m': '工业生产月率',
  'Factory Orders m/m': '工厂订单月率',
  'Building Permits': '营建许可',
  'Housing Starts': '新屋开工',
  'Existing Home Sales': '成屋销售',
  'New Home Sales': '新屋销售',
  'Crude Oil Inventories': '原油库存',
  'PCE Price Index y/y': 'PCE物价指数年率',
  'Core PCE Price Index y/y': '核心PCE物价指数年率',
  '3-Month BTF Auction': '3个月BTF拍卖',
  '6-Month BTF Auction': '6个月BTF拍卖',
  '12-Month BTF Auction': '12个月BTF拍卖',
  'RBNZ Credit Card Spending y/y': '新西兰联储信用卡支出年率',
  'Credit Card Spending y/y': '信用卡支出年率',
  'Foreign Direct Investment YTD y/y': '外商直接投资年迄今',
  'General Public Domestic Loan Debt y/y': '一般公众国内贷款债务年率',
  'Interest Rate Decision': '利率决议',
  'Fed Interest Rate Decision': '美联储利率决议',
  'ECB Interest Rate Decision': '欧洲央行利率决议',
  'BOE Interest Rate Decision': '英国央行利率决议',
  'Monetary Policy Statement': '货币政策声明',
  'Press Conference': '新闻发布会',

  // CFTC 持仓报告
  'CFTC AUD Non-Commercial Net Positions': 'CFTC澳元非商业净持仓',
  'CFTC BRL Non-Commercial Net Positions': 'CFTC巴西雷亚尔非商业净持仓',
  'CFTC JPY Non-Commercial Net Positions': 'CFTC日元非商业净持仓',
  'CFTC GBP Non-Commercial Net Positions': 'CFTC英镑非商业净持仓',
  'CFTC Gold Non-Commercial Net Positions': 'CFTC黄金非商业净持仓',
  'CFTC Crude Oil Non-Commercial Net Positions': 'CFTC原油非商业净持仓',
  'CFTC S&P 500 Non-Commercial Net Positions': 'CFTC标普500非商业净持仓',
  'CFTC Natural Gas Non-Commercial Net Positions': 'CFTC天然气非商业净持仓',
  'CFTC EUR Non-Commercial Net Positions': 'CFTC欧元非商业净持仓',
  'CFTC CAD Non-Commercial Net Positions': 'CFTC加元非商业净持仓',
  'CFTC CHF Non-Commercial Net Positions': 'CFTC瑞郎非商业净持仓',
  'CFTC NZD Non-Commercial Net Positions': 'CFTC纽元非商业净持仓',
  'CFTC Silver Non-Commercial Net Positions': 'CFTC白银非商业净持仓',
  'CFTC Copper Non-Commercial Net Positions': 'CFTC铜非商业净持仓',
  'Non-Commercial Net Positions': '非商业净持仓',

  // 其他
  'Consumer Confidence Index': '消费者信心指数',
};

function translateTitle(title) {
  if (!title) return title;
  // 先查精确匹配
  if (zhTitleMap[title]) return zhTitleMap[title];
  // 检查是否有包含匹配
  for (const [en, zh] of Object.entries(zhTitleMap)) {
    if (title.includes(en)) {
      return title.replace(en, zh);
    }
  }
  // 关键词翻译
  let result = title;
  const keywords = [
    ['Speech', '讲话'],
    ['Statement', '声明'],
    ['Testimony', '证词'],
    ['ECB President', '欧洲央行行长'],
    ['Fed Governor', '美联储理事'],
    ['Fed Chair', '美联储主席'],
    ['FOMC Member', 'FOMC委员'],
    ['ECB Executive Board Member', '欧洲央行执委会成员'],
    ['BOE Governor', '英国央行行长'],
    ['BoE Governor', '英国央行行长'],
    ['BOJ Governor', '日本央行行长'],
    ['RBA Governor', '澳洲联储主席'],
    ['RBNZ Governor', '新西兰联储主席'],
    ['BOC Governor', '加拿大央行行长'],
    ['BCB', '巴西央行'],
    ['Focus Market Report', '焦点市场报告'],
    ['CPI', 'CPI'],
    ['Core CPI', '核心CPI'],
    ['PPI', 'PPI'],
    ['GDP', 'GDP'],
    ['m/m', '月率'],
    ['y/y', '年率'],
    ['MoM', '月率'],
    ['YoY', '年率'],
    ['q/q', '季率'],
    ['Retail Sales', '零售销售'],
    ['Unemployment Rate', '失业率'],
    ['Nonfarm Payrolls', '非农就业'],
    ['Consumer Confidence', '消费者信心'],
    ['Industrial Production', '工业生产'],
    ['Trade Balance', '贸易收支'],
    ['Housing Starts', '新屋开工'],
    ['Building Permits', '营建许可'],
  ];

  for (const [en, zh] of keywords) {
    result = result.split(en).join(zh);
  }

  return result;
}

/**
 * 从 tradays.com widget 页面提取 Calendar.Data JSON 数组
 * 页面包含: Calendar.Data = [{...}, {...}, ...];
 */
async function fetchFromTradays(lang = 'en') {
  const url = lang === 'zh'
    ? 'https://www.tradays.com/zh/economic-calendar/widget'
    : 'https://www.tradays.com/en/economic-calendar/widget';

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': lang === 'zh' ? 'zh-CN,zh;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
        'Referer': 'https://www.mql5.com/',
      },
    });

    if (!resp.ok) {
      console.error('[EconomicCalendar] tradays HTTP', resp.status);
      return null;
    }

    const html = await resp.text();

    // 提取 Calendar.Data = [...]
    const dataMatch = html.match(/Calendar\.Data\s*=\s*(\[[\s\S]*?\]);/);
    if (!dataMatch) {
      console.error('[EconomicCalendar] Calendar.Data not found');
      return null;
    }

    let rawEvents;
    try {
      rawEvents = JSON.parse(dataMatch[1]);
    } catch (e) {
      console.error('[EconomicCalendar] Calendar.Data parse error:', e.message);
      return null;
    }

    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      console.error('[EconomicCalendar] Calendar.Data empty');
      return null;
    }

    // 转换为我们的格式
    const events = rawEvents.map((ev) => {
      const currency = cleanText(ev.CurrencyCode || '');
      const eventName = cleanText(ev.EventName || '');
      const originalImportance = cleanText(ev.Importance || 'low');
      // 应用影响级别提升规则
      const importance = boostImpact(eventName, currency, originalImportance);

      // 国家名称
      const countryZh = currencyToCountryZh[currency] || currency;
      const countryEn = currencyToCountryEn[currency] || currency;

      // 时间格式化：从 ReleaseDate（毫秒时间戳）转换为 ISO 8601
      const ts = ev.ReleaseDate || 0;
      const timeISO = ts > 0 ? new Date(ts).toISOString() : '';

      // 应用中文翻译到标题（如果是中文请求）
      const titleZh = translateTitle(eventName);

      return {
        title: eventName,
        titleZh: titleZh,
        country: countryEn,
        countryZh: countryZh,
        countryCode: currency,
        time: timeISO,
        timestamp: ts,
        impact: importance,
        previous: cleanText(ev.PreviousValue || ''),
        expected: cleanText(ev.ForecastValue || ''),
        actual: cleanText(ev.ActualValue || ''),
        description: eventName,
        descriptionZh: titleZh,
        id: ev.Id || '',
        url: ev.Url || '',
      };
    });

    return { events, source: 'tradays', count: events.length };
  } catch (err) {
    console.error('[EconomicCalendar] tradays error:', err.message);
    return null;
  }
}

/**
 * 使用 Google Translate API 翻译文本
 * POST https://translate-pa.googleapis.com/v1/translateHtml
 */
async function translateWithGoogle(text, fromLang = 'en', toLang = 'zh-CN') {
  if (!text || text.trim() === '') return text;

  try {
    const body = {
      q: text,
      source: fromLang,
      target: toLang,
      format: 'text',
    };

    const resp = await fetch(
      'https://translate-pa.googleapis.com/v1/translateHtml',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify(body),
      }
    );

    if (!resp.ok) return text;

    const data = await resp.json();
    if (data && data.data && data.data.translations && data.data.translations.length > 0) {
      return cleanText(data.data.translations[0].translatedText);
    }
    return text;
  } catch (e) {
    console.error('[Translate] error:', e.message);
    return text;
  }
}

/**
 * 主入口: 获取经济日历
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} dateTo - YYYY-MM-DD
 * @param {string} lang - 'zh-CN' | 'en-US'
 */
export async function getEconomicCalendar(dateFrom, dateTo, lang = 'en-US') {
  const isZh = lang === 'zh-CN' || lang === 'zh';

  // 1. 从 tradays.com 获取数据（fetchFromTradays 内部已经处理了中文翻译）
  let result = await fetchFromTradays('en');
  if (!result) {
    return {
      success: false,
      error: '无法获取经济日历数据',
      data: [],
      total: 0,
    };
  }

  // 2. 按日期范围过滤
  let events = result.events;
  if (dateFrom && dateTo) {
    const fromTs = new Date(dateFrom + 'T00:00:00Z').getTime();
    const toTs = new Date(dateTo + 'T23:59:59Z').getTime();
    events = events.filter((e) => {
      if (!e.timestamp) return false;
      return e.timestamp >= fromTs && e.timestamp <= toTs;
    });
  }

  // 3. 根据语言选择显示的标题和国家
  events = events.map((e) => ({
    ...e,
    title: isZh ? e.titleZh || e.title : e.title,
    country: isZh ? e.countryZh || e.country : e.country,
    description: isZh ? e.titleZh || e.description : e.description,
  }));

  // 4. 按时间排序
  events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  return {
    success: true,
    data: events,
    total: events.length,
    source: result.source,
    asOf: new Date().toISOString(),
  };
}

// 保留旧接口兼容
export default { getEconomicCalendar };
