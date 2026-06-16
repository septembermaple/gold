/**
 * Gold price data service.
 * Primary live sources are Eastmoney public quote endpoints that work in
 * Cloudflare Workers without API keys. Paid/keyed sources can still be added
 * later behind the same normalized shape.
 */

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
  // Primary: xaus.com — true XAU/USD spot price, free, no auth
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

  // Fallback: Yahoo Finance
  try {
    const yInterval = (period === '1h' || period === '4h') ? '60m' : (period === '1w' ? '1wk' : '1d');
    let yRange;
    if (period === '1h' || period === '4h') {
      // Yahoo Finance 60m interval max range is 730 days
      yRange = days <= 5 ? '5d' : days <= 15 ? '15d' : days <= 30 ? '1mo' : days <= 60 ? '2mo' : days <= 365 ? '1y' : '2y';
    } else if (period === '1w') {
      yRange = days <= 30 ? '3mo' : days <= 90 ? '6mo' : days <= 180 ? '1y' : days <= 365 ? '2y' : days <= 730 ? '5y' : '10y';
    } else {
      // daily
      yRange = days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 180 ? '6mo' : days <= 365 ? '1y' : days <= 730 ? '2y' : days <= 1825 ? '5y' : 'max';
    }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=${yRange}&interval=${yInterval}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`Yahoo kline failed: ${resp.status}`);
    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp || !result?.indicators?.quote?.[0]) throw new Error('no yahoo kline');

    // 计算期货→现货比例（GC=F期货比XAU/USD现货高约3%）
    let spotRatio = 0.97; // 默认比例
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
      // ignore spot ratio fetch failure
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
      // 应用期货→现货比例
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

    // 1wk interval already returns weekly data, no need to merge
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
    };
  } catch (error) {
    console.error('get market stats failed:', error);
    const currentPrices = await fetchAllPrices();
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
