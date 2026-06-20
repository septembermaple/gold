/**
 * Gold price data service.
 * Primary source: mql5.com XAU/USD page - extracts symbolData and chartData from inline JS.
 * Fallback sources: xaus.com, Eastmoney, goldprice.org, Yahoo Finance.
 */

const MQL5_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  Referer: 'https://www.mql5.com/',
};

/**
 * Extract symbolData {last, ask, bid, growth, todaysOpen, todaysLow, todaysHigh, yearsLow, yearsHigh, ...}
 * and chartData {M1, M5, M15, M30, H1, H4, D1, W1, MN} from mql5.com XAU/USD page.
 * Data is injected via inline script: Navigator.Symbol.init({symbolData, chartData, ...})
 */
async function fetchFromMql5() {
  try {
    const resp = await fetch('https://www.mql5.com/zh/quotes/metals/xauusd', {
      headers: MQL5_HEADERS,
    });

    if (!resp.ok) {
      console.error('[MQL5] HTTP', resp.status);
      return null;
    }

    const html = await resp.text();

    // 提取 symbolData 对象 - 它形如 symbolData:{name:"XAUUSD", last:4152.52, ...}
    const symbolMatch = html.match(/symbolData\s*:\s*(\{[\s\S]*?\}\s*),\s*[\w]/);
    let symbolData = null;
    if (symbolMatch) {
      try {
        // 将 JS 对象字面量转为 JSON（键名加双引号）
        const jsonStr = symbolMatch[1]
          .replace(/([{,])\s*([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
          .replace(/'/g, '"');
        symbolData = JSON.parse(jsonStr);
      } catch (e) {
        console.error('[MQL5] symbolData parse error:', e.message);
      }
    }

    // 提取 chartData 对象
    const chartMatch = html.match(/chartData\s*:\s*(\{[\s\S]*?\}\s*),\s*[\w]/);
    let chartData = null;
    if (chartMatch) {
      try {
        const jsonStr = chartMatch[1]
          .replace(/([{,])\s*([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
          .replace(/'/g, '"');
        chartData = JSON.parse(jsonStr);
      } catch (e) {
        console.error('[MQL5] chartData parse error:', e.message);
      }
    }

    // 也尝试提取 tick 级别的价格 span
    let askPrice = symbolData?.ask || symbolData?.last || 0;
    let bidPrice = symbolData?.bid || askPrice;
    let lastPrice = symbolData?.last || askPrice;

    // 从 span#ticker_val_375 提取当前价格（实时更新）
    const priceMatch = html.match(/id="ticker_val_375"[^>]*>\s*([\d.]+)/);
    if (priceMatch) {
      lastPrice = parseFloat(priceMatch[1]);
      if (!askPrice) askPrice = lastPrice;
      if (!bidPrice) bidPrice = lastPrice;
    }

    // 今日高/低点
    const highMatch = html.match(/id="ticker_ext_daily_high_375"[^>]*>\s*([\d.]+)/);
    const lowMatch = html.match(/id="ticker_ext_daily_low_375"[^>]*>\s*([\d.]+)/);
    const high24h = highMatch ? parseFloat(highMatch[1]) : symbolData?.todaysHigh || 0;
    const low24h = lowMatch ? parseFloat(lowMatch[1]) : symbolData?.todaysLow || 0;

    // 涨跌幅
    const shiftMatch = html.match(/id="ticker_shift_rel_text_375"[^>]*>\s*(-?[\d.]+)%/);
    let changePercent = shiftMatch ? parseFloat(shiftMatch[1]) : 0;
    if (!changePercent && symbolData?.growth) {
      changePercent = Math.round(symbolData.growth * 10000) / 100;
    }

    // 昨日收盘
    const yestCloseMatch = html.match(/id="ticker_ext_yest_close_375"[^>]*>\s*([\d.]+)/);
    const previousClose = yestCloseMatch
      ? parseFloat(yestCloseMatch[1])
      : symbolData?.yesterdaysLast || symbolData?.yl || 0;

    // 开盘价
    const open = symbolData?.todaysOpen || 0;

    // 计算变化量
    const change = previousClose
      ? Math.round((lastPrice - previousClose) * 100) / 100
      : 0;

    // 解析 H1 chartData 判断市场状态
    // chartData.H1 = { date: ts, chart: 'ts,price,ts,price,...' }
    let h1LastTimestamp = 0;
    if (chartData?.H1?.chart) {
      const parts = String(chartData.H1.chart).split(',');
      if (parts.length >= 2) {
        // 最后两个元素: [.., ts, price]
        const lastTs = parseInt(parts[parts.length - 2], 10);
        if (lastTs > 0) h1LastTimestamp = lastTs * 1000;
      }
    }

    return {
      price: lastPrice > 0 ? lastPrice : askPrice,
      ask: askPrice,
      bid: bidPrice,
      change,
      changePercent,
      high: high24h,
      low: low24h,
      close: lastPrice,
      open,
      previousClose,
      volume: 0,
      h1LastTimestamp,
      chartData,
      symbolData,
      timestamp: Date.now(),
      currency: 'USD',
      unit: 'oz',
      source: 'mql5.com',
    };
  } catch (err) {
    console.error('[MQL5] error:', err.message);
    return null;
  }
}

const EASTMONEY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://quote.eastmoney.com/',
  Accept: 'application/json,text/plain,*/*',
};

async function fetchJson(url, headers = EASTMONEY_HEADERS) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`request failed: ${response.status}`);
  }
  return response.json();
}

function asPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / 100;
}

function quoteFromEastmoney(data, source, currency = 'USD', unit = 'oz') {
  if (!data?.data) {
    throw new Error(`${source} returned empty data`);
  }

  const d = data.data;
  const price = asPrice(d.f43);
  if (!price) {
    throw new Error(`${source} returned invalid price`);
  }

  return {
    price,
    change: asPrice(d.f169),
    changePercent: asPrice(d.f170),
    high: asPrice(d.f44),
    low: asPrice(d.f45),
    close: asPrice(d.f60),
    open: asPrice(d.f46),
    previousClose: asPrice(d.f60),
    volume: d.f47 || 0,
    amount: d.f48 || 0,
    code: d.f57 || '',
    name: d.f58 || '',
    timestamp: Date.now(),
    currency,
    unit,
    source,
  };
}

/**
 * Fetch international XAU/USD spot quote.
 * Priority: xaus.com (true spot) > Eastmoney (122.XAU) > goldprice.org > Yahoo Finance (GC=F futures) > fallback
 */
export async function fetchInternationalGoldPrice() {
  // Primary: mql5.com — true XAU/USD spot, with real-time H1 kline for market status
  const mql5 = await fetchFromMql5();
  if (mql5 && mql5.price > 0) {
    return mql5;
  }

  // Secondary: xaus.com — true XAU/USD spot price, free, no auth
  try {
    const resp = await fetch('https://xaus.com/api/v1/spot', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!resp.ok) throw new Error(`xaus.com failed: ${resp.status}`);
    const data = await resp.json();
    const price = data?.xau?.price || data?.spot_usd_oz;
    if (!price || price <= 0) throw new Error('xaus.com returned invalid price');

    // xaus.com doesn't provide volume/change/open, supplement from Yahoo Finance
    let volume = 0, change = 0, changePercent = 0, high = 0, low = 0, open = 0, previousClose = 0;
    try {
      const yResp = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=5d&interval=1d',
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (yResp.ok) {
        const yData = await yResp.json();
        const result = yData?.chart?.result?.[0];
        const meta = result?.meta;
        if (meta?.regularMarketPrice) {
          volume = meta.regularMarketVolume || 0;
          // Calculate futures-to-spot ratio from current prices
          const futuresPrice = meta.regularMarketPrice;
          const ratio = futuresPrice > 0 ? price / futuresPrice : 0.97;

          // Get today's open and previous close from daily quotes
          const timestamps = result.timestamp || [];
          const quotes = result.indicators?.quote?.[0];
          if (timestamps.length > 0 && quotes?.close) {
            // Previous close = last but one day's close (or chartPreviousClose)
            const lastIdx = timestamps.length - 1;
            const todayOpen = quotes.open?.[lastIdx];
            const yesterdayClose = lastIdx >= 1 ? quotes.close?.[lastIdx - 1] : null;

            if (todayOpen && todayOpen > 0) {
              open = Math.round(todayOpen * ratio * 100) / 100;
            }
            if (yesterdayClose && yesterdayClose > 0) {
              previousClose = Math.round(yesterdayClose * ratio * 100) / 100;
            } else {
              // Fallback: use chartPreviousClose
              const rawPrevClose = meta.chartPreviousClose || meta.previousClose || 0;
              if (rawPrevClose > 0) {
                previousClose = Math.round(rawPrevClose * ratio * 100) / 100;
              }
            }
            // If we still don't have open, use previousClose
            if (!open && previousClose > 0) open = previousClose;
          }

          // Calculate change from previous close
          if (previousClose > 0) {
            change = Math.round((price - previousClose) * 100) / 100;
            changePercent = Math.round((change / previousClose) * 10000) / 100;
          }

          // Get daily range
          high = meta.regularMarketDayHigh ? Math.round(meta.regularMarketDayHigh * ratio * 100) / 100 : 0;
          low = meta.regularMarketDayLow ? Math.round(meta.regularMarketDayLow * ratio * 100) / 100 : 0;
        }
      }
    } catch (e) {
      // ignore Yahoo supplement failure
    }

    return {
      price: Math.round(price * 100) / 100,
      change,
      changePercent,
      high,
      low,
      close: Math.round(price * 100) / 100,
      open,
      previousClose,
      volume,
      silverPrice: 0,
      silverChange: 0,
      timestamp: Date.now(),
      currency: 'USD',
      unit: 'oz',
      source: 'xaus.com',
    };
  } catch (error) {
    console.error('xaus.com failed:', error);
  }

  // Secondary: Eastmoney 122.XAU
  try {
    const data = await fetchJson(
      'https://push2.eastmoney.com/api/qt/stock/get?secid=122.XAU&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170'
    );
    const quote = quoteFromEastmoney(data, 'eastmoney-XAU', 'USD', 'oz');
    return {
      ...quote,
      silverPrice: 0,
      silverChange: 0,
    };
  } catch (error) {
    console.error('eastmoney XAU failed:', error);
  }

  // Tertiary: goldprice.org
  try {
    const response = await fetch('https://data-asg.goldprice.org/dbXRates/USD', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`goldprice.org request failed: ${response.status}`);
    }

    const data = await response.json();
    const item = data.items?.[0];
    if (!item?.xauPrice) {
      throw new Error('goldprice.org returned empty XAU price');
    }

    return {
      price: item.xauPrice || 0,
      change: item.chgXau || 0,
      changePercent: item.pcXau || 0,
      high: item.xauHigh || 0,
      low: item.xauLow || 0,
      close: item.xauClose || 0,
      open: item.xauOpen || 0,
      previousClose: item.xauClose || 0,
      silverPrice: item.xagPrice || 0,
      silverChange: item.chgXag || 0,
      timestamp: Date.now(),
      currency: 'USD',
      unit: 'oz',
      source: 'goldprice.org',
    };
  } catch (error) {
    console.error('goldprice.org failed:', error);
  }

  // Quaternary: Yahoo Finance (GC=F gold futures — note: futures premium ~3% over spot)
  try {
    const resp = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!resp.ok) throw new Error(`Yahoo Finance failed: ${resp.status}`);
    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error('no yahoo price');
    // GC=F is COMEX futures, typically ~3% above spot. Apply rough adjustment.
    const futuresPrice = meta.regularMarketPrice;
    const spotEstimate = Math.round(futuresPrice * 0.97 * 100) / 100;
    return {
      price: spotEstimate,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      close: spotEstimate,
      open: 0,
      previousClose: 0,
      silverPrice: 0,
      silverChange: 0,
      timestamp: Date.now(),
      currency: 'USD',
      unit: 'oz',
      source: 'yahoo-GC=F (spot est.)',
    };
  } catch (error) {
    console.error('Yahoo Finance failed:', error);
  }

  return getFallbackInternationalPrice();
}

/**
 * Fetch domestic AU9999 quote from Shanghai Gold Exchange proxy on Eastmoney.
 */
export async function fetchDomesticGoldPrice() {
  try {
    const data = await fetchJson(
      'https://push2.eastmoney.com/api/qt/stock/get?secid=118.AU9999&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170'
    );
    const quote = quoteFromEastmoney(data, 'eastmoney-AU9999', 'CNY', 'g');

    return {
      au99_99: {
        name: 'AU9999',
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        previousClose: quote.previousClose,
        volume: quote.volume,
      },
      au99_95: {
        name: 'AU9995',
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
      },
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      previousClose: quote.previousClose,
      volume: quote.volume,
      timestamp: Date.now(),
      currency: 'CNY',
      unit: 'g',
      source: quote.source,
    };
  } catch (error) {
    console.error('eastmoney AU9999 failed:', error);
    return getFallbackDomesticPrice();
  }
}

export async function fetchSilverPrice() {
  try {
    const data = await fetchJson(
      'https://push2.eastmoney.com/api/qt/stock/get?secid=122.XAG&fields=f43,f44,f45,f46,f57,f58,f60,f169,f170'
    );
    return quoteFromEastmoney(data, 'eastmoney-XAG', 'USD', 'oz');
  } catch (error) {
    console.error('eastmoney XAG failed:', error);
    return {
      price: 0,
      change: 0,
      changePercent: 0,
      timestamp: Date.now(),
      currency: 'USD',
      unit: 'oz',
      source: 'fallback',
    };
  }
}

export async function fetchAllPrices() {
  const [international, domestic, silver] = await Promise.all([
    fetchInternationalGoldPrice(),
    fetchDomesticGoldPrice(),
    fetchSilverPrice(),
  ]);

  const impliedUsdToCny =
    international.price && domestic.price
      ? (domestic.price * 31.1035) / international.price
      : 7.24;
  const usdToCny = Number.isFinite(impliedUsdToCny) ? impliedUsdToCny : 7.24;
  const pricePerGramCny = international.price
    ? (international.price * usdToCny) / 31.1035
    : 0;

  return {
    international: {
      ...international,
      silverPrice: silver.price || international.silverPrice || 0,
      silverChange: silver.change || international.silverChange || 0,
    },
    domestic,
    converted: {
      pricePerGramCny: parseFloat(pricePerGramCny.toFixed(2)),
      exchangeRate: parseFloat(usdToCny.toFixed(4)),
      ounceToGram: 31.1035,
    },
    timestamp: Date.now(),
  };
}

export function generateKlineData(days = 30, currentPrice = 2400) {
  const klineData = [];
  const now = new Date();
  let price = currentPrice * (1 - days * 0.001 + Math.random() * 0.005);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dailyReturn = (Math.random() - 0.48) * 0.03;
    const open = price;
    const close = price * (1 + dailyReturn);
    const highExtra = Math.random() * Math.abs(close - open) * 0.5;
    const lowExtra = Math.random() * Math.abs(close - open) * 0.5;
    const high = Math.max(open, close) + highExtra;
    const low = Math.min(open, close) - lowExtra;
    const volume = Math.floor(150000 + Math.random() * 100000);

    klineData.push({
      date: date.toISOString().split('T')[0],
      time: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
      changePercent: parseFloat((dailyReturn * 100).toFixed(2)),
    });

    price = close;
  }

  return klineData;
}

export async function fetchRealGoldKline(days = 60, period = '1d') {
  // 1. 优先从 mql5.com 获取 chartData —— 数据是实时更新的
  try {
    const mql5 = await fetchFromMql5();
    if (mql5 && mql5.chartData) {
      // 选择对应的周期
      const periodMap = {
        '1h': 'H1',
        '4h': 'H4',
        '1d': 'D1',
        '1w': 'W1',
      };
      const chartKey = periodMap[period] || 'H1';
      const chart = mql5.chartData[chartKey];

      if (chart?.chart) {
        // 解析 'ts,price,ts,price,...' 格式
        const parts = String(chart.chart).split(',');
        const klines = [];
        for (let i = 0; i < parts.length - 1; i += 2) {
          const ts = parseInt(parts[i], 10);
          const price = parseFloat(parts[i + 1]);
          if (!ts || !price) continue;

          const d = new Date(ts * 1000);
          const dateStr = d.toISOString().split('T')[0];
          const hours = d.getHours().toString().padStart(2, '0');
          const minutes = d.getMinutes().toString().padStart(2, '0');
          const timeStr = `${dateStr} ${hours}:${minutes}`;

          // mql5 的 chart 是收盘价线（close line）
          // 用价格作为 open/high/low/close 的近似
          klines.push({
            date: dateStr,
            time: timeStr,
            open: price,
            close: price,
            high: price,
            low: price,
            volume: 0,
            changePercent: 0,
          });
        }

        // 如果有 symbolData 的 last price，作为最新一条数据
        if (klines.length > 0 && mql5.price > 0) {
          const lastKline = klines[klines.length - 1];
          const lastTs = new Date(lastKline.time).getTime();
          const now = Date.now();

          // 如果最后一条K线距离当前超过周期时间，补上当前价格作为最新K线
          let periodMs;
          if (period === '1h') periodMs = 60 * 60 * 1000;
          else if (period === '4h') periodMs = 4 * 60 * 60 * 1000;
          else if (period === '1d') periodMs = 24 * 60 * 60 * 1000;
          else if (period === '1w') periodMs = 7 * 24 * 60 * 60 * 1000;
          else periodMs = 60 * 60 * 1000;

          if (now - lastTs > periodMs) {
            const nd = new Date(now);
            const nDate = nd.toISOString().split('T')[0];
            const nHours = nd.getHours().toString().padStart(2, '0');
            const nMins = nd.getMinutes().toString().padStart(2, '0');
            klines.push({
              date: nDate,
              time: `${nDate} ${nHours}:${nMins}`,
              open: mql5.price,
              close: mql5.price,
              high: mql5.price,
              low: mql5.price,
              volume: 0,
              changePercent: 0,
            });
          }
        }

        // 按天数限制返回
        const limited = klines.slice(-days);
        if (limited.length >= 5) {
          console.log(`[MQL5] ${chartKey} kline: ${limited.length} bars, last: ${limited[limited.length - 1].time}`);
          return limited;
        }
      }
    }
  } catch (error) {
    console.error('mql5 kline failed:', error);
  }

  // 2. 备选：东财
  const kltMap = {
    '1h': 60,
    '4h': 60,
    '1d': 101,
    '1w': 102,
  };
  const klt = kltMap[period] || 101;
  const limit = Math.min(Math.max(days * (period === '4h' ? 4 : 1), 5), 365);

  try {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=122.XAU&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=${klt}&fqt=0&end=20500101&lmt=${limit}`;
    const result = await fetchJson(url);

    if (!result.data?.klines?.length) {
      throw new Error('empty Eastmoney XAU kline');
    }

    let klines = result.data.klines.map((line) => {
      const parts = line.split(',');
      return {
        date: parts[0],
        time: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseInt(parts[5], 10) || 0,
        changePercent: parseFloat(parts[8]) || 0,
      };
    });

    if (period === '4h') {
      const merged = [];
      for (let i = 0; i < klines.length; i += 4) {
        const chunk = klines.slice(i, i + 4);
        if (!chunk.length) continue;
        merged.push({
          date: chunk[0].date,
          time: chunk[0].time,
          open: chunk[0].open,
          high: Math.max(...chunk.map((k) => k.high)),
          low: Math.min(...chunk.map((k) => k.low)),
          close: chunk[chunk.length - 1].close,
          volume: chunk.reduce((sum, k) => sum + k.volume, 0),
          changePercent: chunk[chunk.length - 1].changePercent,
        });
      }
      klines = merged;
    }

    return klines.slice(-days);
  } catch (error) {
    console.error('eastmoney XAU kline failed:', error);
  }

  // 3. Fallback: Yahoo Finance
  try {
    const yInterval = (period === '1h' || period === '4h') ? '60m' : (period === '1w' ? '1wk' : '1d');
    let yRange;
    if (period === '1h' || period === '4h') {
      yRange = days <= 5 ? '5d' : days <= 15 ? '15d' : days <= 30 ? '1mo' : days <= 60 ? '2mo' : days <= 365 ? '1y' : '2y';
    } else if (period === '1w') {
      yRange = days <= 30 ? '3mo' : days <= 90 ? '6mo' : days <= 180 ? '1y' : days <= 365 ? '2y' : days <= 730 ? '5y' : '10y';
    } else {
      yRange = days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 180 ? '6mo' : days <= 365 ? '1y' : days <= 730 ? '2y' : days <= 1825 ? '5y' : 'max';
    }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=${yRange}&interval=${yInterval}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`Yahoo kline failed: ${resp.status}`);
    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp || !result?.indicators?.quote?.[0]) throw new Error('no yahoo kline');

    let spotRatio = 0.97;
    try {
      const spotResp = await fetch('https://xaus.com/api/v1/spot', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (spotResp.ok) {
        const spotData = await spotResp.json();
        const spotPrice = spotData?.xau?.price || spotData?.spot_usd_oz;
        const meta = result.meta;
        if (spotPrice && meta?.regularMarketPrice) {
          spotRatio = spotPrice / meta.regularMarketPrice;
        }
      }
    } catch (e) {
      // ignore
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const klines = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = quotes.close?.[i];
      const open = quotes.open?.[i];
      const high = quotes.high?.[i];
      const low = quotes.low?.[i];
      const volume = quotes.volume?.[i];
      if (close == null) continue;
      const d = new Date(timestamps[i] * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const timeStr = `${dateStr} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      const adj = (v) => v ? Math.round(v * spotRatio * 100) / 100 : v;
      klines.push({
        date: dateStr,
        time: (period === '1h' || period === '4h') ? timeStr : dateStr,
        open: adj(open || close),
        close: adj(close),
        high: adj(high || close),
        low: adj(low || close),
        volume: volume || 0,
        changePercent: 0,
      });
    }

    if (period === '4h') {
      const merged = [];
      for (let i = 0; i < klines.length; i += 4) {
        const chunk = klines.slice(i, i + 4);
        if (!chunk.length) continue;
        merged.push({
          date: chunk[0].date,
          time: chunk[0].time,
          open: chunk[0].open,
          high: Math.max(...chunk.map((k) => k.high)),
          low: Math.min(...chunk.map((k) => k.low)),
          close: chunk[chunk.length - 1].close,
          volume: chunk.reduce((sum, k) => sum + k.volume, 0),
          changePercent: 0,
        });
      }
      return merged.slice(-days);
    }

    return klines.slice(-days);
  } catch (error) {
    console.error('Yahoo Finance kline failed:', error);
  }

  return [];
}

export async function fetchDollarIndex() {
  // 优先使用东方财富获取美元指数 (secid=100.UDI)
  try {
    const data = await fetchJson(
      'https://push2.eastmoney.com/api/qt/stock/get?secid=100.UDI&fields=f43,f44,f45,f46,f47,f57,f58,f60,f169,f170'
    );
    return quoteFromEastmoney(data, 'eastmoney-UDI', 'USD', '');
  } catch (error) {
    console.error('eastmoney UDI failed:', error);
  }

  // 备用1：Yahoo Finance DXY (DX-Y.NYB)
  try {
    const resp = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?range=5d&interval=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (resp.ok) {
      const yData = await resp.json();
      const result = yData?.chart?.result?.[0];
      const meta = result?.meta;
      if (meta?.regularMarketPrice) {
        const price = meta.regularMarketPrice;
        const timestamps = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0];
        let open = 0, previousClose = 0, high = 0, low = 0;
        if (timestamps.length > 0 && quotes?.close) {
          const lastIdx = timestamps.length - 1;
          open = quotes.open?.[lastIdx] || 0;
          const yesterdayClose = lastIdx >= 1 ? quotes.close?.[lastIdx - 1] : null;
          previousClose = yesterdayClose || meta.chartPreviousClose || 0;
        }
        high = meta.regularMarketDayHigh || price;
        low = meta.regularMarketDayLow || price;
        const change = previousClose > 0 ? Math.round((price - previousClose) * 10000) / 10000 : 0;
        const changePercent = previousClose > 0 ? Math.round((change / previousClose) * 10000) / 100 : 0;
        return {
          price: Math.round(price * 1000) / 1000,
          open: Math.round(open * 1000) / 1000,
          high: Math.round(high * 1000) / 1000,
          low: Math.round(low * 1000) / 1000,
          change: Math.round(change * 1000) / 1000,
          changePercent,
          volume: meta.regularMarketVolume || 0,
          timestamp: Date.now(),
          currency: 'USD',
          unit: '',
          source: 'yahoo-DXY',
        };
      }
    }
  } catch (error) {
    console.error('Yahoo DXY failed:', error);
  }

  // 备用2：FRED 广义贸易加权美元指数
  try {
    if (typeof FRED_API_KEY !== 'undefined' && FRED_API_KEY) {
      const resp = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=2`,
        { headers: { Accept: 'application/json' } }
      );
      if (resp.ok) {
        const fred = await resp.json();
        const obs = fred.observations || [];
        if (obs.length >= 2) {
          const cur = parseFloat(obs[0].value);
          const prev = parseFloat(obs[1].value);
          if (Number.isFinite(cur) && Number.isFinite(prev)) {
            return {
              price: cur,
              open: prev,
              high: cur,
              low: prev,
              change: parseFloat((cur - prev).toFixed(2)),
              changePercent: parseFloat(((cur / prev - 1) * 100).toFixed(2)),
              volume: 0,
              timestamp: Date.now(),
              currency: 'USD',
              unit: '',
              source: 'FRED-DTWEXBGS',
            };
          }
        }
      }
    }
  } catch (error) {
    console.error('FRED DXY failed:', error);
  }

  return {
    price: 0,
    open: 0,
    high: 0,
    low: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    timestamp: Date.now(),
    source: 'unavailable',
    message: 'DXY live source is unavailable.',
  };
}

/**
 * 判断黄金市场是否开放
 * 基于 Yahoo Finance 的数据更新时间来判断
 */
async function isGoldMarketOpen() {
  // 从 mql5.com 获取实时数据，通过 H1 K线判断市场状态
  const mql5 = await fetchFromMql5();
  if (mql5 && mql5.h1LastTimestamp > 0) {
    const now = Date.now();
    const diff = now - mql5.h1LastTimestamp;
    // 如果 H1 最后一根K线在1小时内更新过 → 认为市场在交易
    if (diff <= 60 * 60 * 1000) {
      return true;
    }
    // 否则 → 休市
    return false;
  }

  // 如果 mql5.com 不可用，回退到 Yahoo Finance
  try {
    const resp = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1m',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!resp.ok) return false;

    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    if (!result) return false;

    const timestamps = result?.timestamp || [];
    if (timestamps.length === 0) return false;

    const latestTimestamp = timestamps[timestamps.length - 1] * 1000;
    const now = Date.now();
    const timeDiff = now - latestTimestamp;

    // 如果最新数据在5分钟内，认为市场在交易
    if (timeDiff < 5 * 60 * 1000) {
      return true;
    }

    // 检查是否是周末（UTC时间）
    const utcDay = new Date().getUTCDay();
    if (utcDay === 0 || utcDay === 6) {
      return false;
    }

    // 检查是否是美国主要节假日
    return !isUSHoliday();
  } catch {
    return isMarketTimeBySchedule();
  }
}

/**
 * 检查是否是美国主要节假日（黄金市场休市日）
 */
function isUSHoliday() {
  const now = new Date();
  const month = now.getMonth();
  const date = now.getDate();
  const day = now.getDay();
  
  // 固定日期的节假日
  const fixedHolidays = [
    { month: 0, date: 1 },   // 元旦
    { month: 6, date: 4 },   // 独立日
    { month: 10, date: 11 },  // 退伍军人节
    { month: 11, date: 25 },  // 圣诞节
  ];
  
  for (const holiday of fixedHolidays) {
    if (month === holiday.month && date === holiday.date) {
      return true;
    }
  }
  
  // 浮动日期的节假日（计算当年日期）
  const year = now.getFullYear();
  
  // 马丁路德金日（1月第三个周一）
  const mlkDay = getNthMonday(year, 0, 3);
  if (month === 0 && date === mlkDay) return true;
  
  // 总统日（2月第三个周一）
  const presidentsDay = getNthMonday(year, 1, 3);
  if (month === 1 && date === presidentsDay) return true;
  
  // 阵亡将士纪念日（5月最后一个周一）
  const memorialDay = getLastMonday(year, 4);
  if (month === 4 && date === memorialDay) return true;
  
  // 劳动节（9月第一个周一）
  const laborDay = getNthMonday(year, 8, 1);
  if (month === 8 && date === laborDay) return true;
  
  // 哥伦布日（10月第二个周一）
  const columbusDay = getNthMonday(year, 9, 2);
  if (month === 9 && date === columbusDay) return true;
  
  // 感恩节（11月第四个周四）
  const thanksgiving = getNthThursday(year, 10, 4);
  if (month === 10 && date === thanksgiving) return true;
  
  return false;
}

function getNthMonday(year, month, n) {
  const firstDay = new Date(year, month, 1);
  const firstMonday = firstDay.getDay() === 1 ? 1 : (8 - firstDay.getDay());
  const date = firstMonday + (n - 1) * 7;
  return Math.min(date, new Date(year, month + 1, 0).getDate());
}

function getLastMonday(year, month) {
  const lastDay = new Date(year, month + 1, 0);
  const lastDayOfWeek = lastDay.getDay();
  const daysToSubtract = lastDayOfWeek === 0 ? 6 : lastDayOfWeek - 1;
  return lastDay.getDate() - daysToSubtract;
}

function getNthThursday(year, month, n) {
  const firstDay = new Date(year, month, 1);
  const firstThursday = firstDay.getDay() === 4 ? 1 : (11 - firstDay.getDay());
  const date = firstThursday + (n - 1) * 7;
  return Math.min(date, new Date(year, month + 1, 0).getDate());
}

/**
 * 基于时间表判断市场是否在交易时间内
 * COMEX 黄金期货交易时间（纽约时间）：
 * - 周日至周五：18:00 - 17:00 ET（次日）
 * - 夏令时（EDT）：UTC-4
 * - 冬令时（EST）：UTC-5
 */
function isMarketTimeBySchedule() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  
  // 检查是否是周末（UTC时间）
  const utcDay = now.getUTCDay();
  if (utcDay === 0 || utcDay === 6) {
    return false;
  }
  
  // 检查是否是美国节假日
  if (isUSHoliday()) {
    return false;
  }
  
  // COMEX 黄金期货电子盘几乎24小时交易
  // 周日 18:00 ET - 周五 17:00 ET
  // ET = UTC-4 (夏令时) 或 UTC-5 (冬令时)
  
  // 判断是否是夏令时（3月第二个周日至11月第一个周日）
  const isDST = isDaylightSavingTime(now);
  const etOffset = isDST ? 4 : 5;
  
  // 转换为纽约时间
  let nyHour = utcHour - etOffset;
  if (nyHour < 0) nyHour += 24;
  
  // 周日 18:00 - 周五 17:00 NY时间
  // UTC时间：周日 22:00/23:00 - 周五 21:00/22:00
  
  // 简化判断：黄金市场几乎24小时交易，仅周末和节假日休市
  // 由于已经检查了周末和节假日，这里默认返回true
  return true;
}

function isDaylightSavingTime(date) {
  const year = date.getFullYear();
  const march = new Date(year, 2, 14);
  const november = new Date(year, 10, 7);
  
  // 3月第二个周日 2:00 AM 开始
  const dstStart = new Date(year, 2, 14 - march.getDay() + (march.getDay() === 0 ? -7 : 0) + 7, 2);
  // 11月第一个周日 2:00 AM 结束
  const dstEnd = new Date(year, 10, 7 - november.getDay() + (november.getDay() === 0 ? -7 : 0) + 7, 2);
  
  return date >= dstStart && date < dstEnd;
}

export async function getMarketStats(env) {
  try {
    const currentPrices = await fetchAllPrices();
    const latestPrice = await env.DB.prepare(
      'SELECT * FROM gold_prices ORDER BY date DESC LIMIT 1'
    ).first();
    const weekAgo = await env.DB.prepare(
      "SELECT * FROM gold_prices WHERE date >= date('now', '-7 days') ORDER BY date ASC LIMIT 1"
    ).first();
    const monthAgo = await env.DB.prepare(
      "SELECT * FROM gold_prices WHERE date >= date('now', '-30 days') ORDER BY date ASC LIMIT 1"
    ).first();

    const intl = currentPrices.international;
    const marketOpen = await isGoldMarketOpen();
    
    return {
      current: intl.price,
      changePercent24h: intl.changePercent,
      high24h: intl.high,
      low24h: intl.low,
      openPrice: intl.open,
      volume24h: intl.volume || 0,
      weekChange:
        weekAgo && latestPrice
          ? ((latestPrice.close_price - weekAgo.close_price) / weekAgo.close_price * 100).toFixed(2)
          : null,
      monthChange:
        monthAgo && latestPrice
          ? ((latestPrice.close_price - monthAgo.close_price) / monthAgo.close_price * 100).toFixed(2)
          : null,
      high52w: null,
      low52w: null,
      domestic: currentPrices.domestic,
      converted: currentPrices.converted,
      timestamp: Date.now(),
      marketOpen,
    };
  } catch (error) {
    console.error('get market stats failed:', error);
    const currentPrices = await fetchAllPrices();
    const marketOpen = await isGoldMarketOpen();
    
    return {
      current: currentPrices.international.price,
      changePercent24h: currentPrices.international.changePercent,
      high24h: currentPrices.international.high,
      low24h: currentPrices.international.low,
      openPrice: currentPrices.international.open,
      volume24h: currentPrices.international.volume || 0,
      weekChange: null,
      monthChange: null,
      domestic: currentPrices.domestic,
      converted: currentPrices.converted,
      timestamp: Date.now(),
      marketOpen,
    };
  }
}

export async function saveGoldPrice(env, priceData) {
  const today = new Date().toISOString().split('T')[0];

  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO gold_prices (date, open_price, high_price, low_price, close_price, volume, change_percent, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        today,
        priceData.open || priceData.price,
        priceData.high || priceData.price,
        priceData.low || priceData.price,
        priceData.price,
        priceData.volume || 0,
        priceData.changePercent || 0,
        priceData.source || 'api'
      )
      .run();
  } catch (error) {
    console.error('save gold price failed:', error);
  }
}

export async function saveKlineToDb(env, klineData, period, source = 'yahoo') {
  if (!klineData || klineData.length === 0) return 0;

  // D1 单次最多100个参数，每条记录8个参数，每批最多12条
  const BATCH_SIZE = 12;
  let totalInserted = 0;

  for (let i = 0; i < klineData.length; i += BATCH_SIZE) {
    const batch = klineData.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = [];

    for (const k of batch) {
      values.push(
        period,
        k.time || k.date,
        k.open || k.open_price,
        k.high || k.high_price,
        k.low || k.low_price,
        k.close || k.close_price,
        k.volume || 0,
        source
      );
    }

    try {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO gold_kline (period, time, open_price, high_price, low_price, close_price, volume, source) VALUES ${placeholders}`
      )
        .bind(...values)
        .run();
      totalInserted += batch.length;
    } catch (error) {
      console.error(`saveKlineToDb batch ${i / BATCH_SIZE + 1} failed:`, error);
    }
  }

  return totalInserted;
}

function getFallbackInternationalPrice() {
  return {
    price: 4340,
    change: 32,
    changePercent: 0.75,
    high: 4360,
    low: 4306,
    close: 4340,
    open: 4312,
    previousClose: 4308,
    silverPrice: 70,
    silverChange: 0.37,
    timestamp: Date.now(),
    currency: 'USD',
    unit: 'oz',
    source: 'fallback',
  };
}

function getFallbackDomesticPrice() {
  return {
    au99_99: { name: 'AU9999', price: 940.48, change: 2.97, changePercent: 0.32 },
    au99_95: { name: 'AU9995', price: 940.48, change: 2.97, changePercent: 0.32 },
    price: 940.48,
    change: 2.97,
    changePercent: 0.32,
    open: 945,
    high: 948.6,
    low: 936.7,
    previousClose: 937.51,
    volume: 0,
    timestamp: Date.now(),
    currency: 'CNY',
    unit: 'g',
    source: 'fallback',
  };
}
