/**
 * 新闻路由
 * 黄金市场新闻资讯 - 从Google News RSS获取真实新闻
 */

import { Hono } from 'hono';

const news = new Hono();

/**
 * 从Google News RSS解析新闻
 */
async function fetchGoldNewsFromRSS(limit = 20) {
  const rssUrl = 'https://news.google.com/rss/search?q=gold+price+OR+%E9%BB%84%E9%87%91+%E9%87%91%E4%BB%B7&hl=en-US&gl=US&ceid=US:en';

  try {
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/xml,text/xml,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Google News RSS request failed: ${response.status}`);
    }

    const text = await response.text();

    // 简单XML解析 - 提取 <item> 节点
    const items = [];
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(text)) !== null && items.length < limit) {
      const itemText = match[1];

      const titleMatch = itemText.match(/<title><!\[CDATA\[([^\]]*)\]\]><\/title>|<title>([^<]*)<\/title>/i);
      const linkMatch = itemText.match(/<link>([^<]*)<\/link>/i);
      const pubDateMatch = itemText.match(/<pubDate>([^<]*)<\/pubDate>/i);
      const descMatch = itemText.match(/<description><!\[CDATA\[([^\]]*)\]\]><\/description>|<description>([^<]*)<\/description>/i);
      const sourceMatch = itemText.match(/<source[^>]*>([^<]*)<\/source>/i);

      const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';
      const link = linkMatch ? linkMatch[1].trim() : '';
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
      const description = descMatch ? (descMatch[1] || descMatch[2] || '').trim() : '';
      const source = sourceMatch ? sourceMatch[1].trim() : 'Google News';

      if (!title) continue;

      // 简单情感分析 - 基于关键词
      let sentiment = 'neutral';
      const lowerTitle = title.toLowerCase();
      const lowerDesc = description.toLowerCase();
      const positiveWords = ['rise', 'rising', 'surge', 'rally', 'gain', 'bullish', 'high', 'jump', 'climb', '上涨', '飙升', '看涨', '新高', '突破'];
      const negativeWords = ['fall', 'falling', 'drop', 'decline', 'bearish', 'low', 'slump', 'crash', '下跌', '暴跌', '看跌', '新低', '承压'];

      const posCount = positiveWords.filter(w => lowerTitle.includes(w) || lowerDesc.includes(w)).length;
      const negCount = negativeWords.filter(w => lowerTitle.includes(w) || lowerDesc.includes(w)).length;
      if (posCount > negCount) sentiment = 'positive';
      else if (negCount > posCount) sentiment = 'negative';

      // 提取关键词
      const keywords = [];
      const keywordMap = {
        '美联储': 'Fed', 'Federal Reserve': 'Fed', 'interest rate': '利率', 'rate': '利率',
        'inflation': '通胀', 'CPI': 'CPI', 'dollar': '美元', 'USD': '美元',
        'gold': '黄金', 'XAU': 'XAU', 'ETF': 'ETF', 'VIX': 'VIX',
        'geopolitic': '地缘政治', 'war': '战争', 'conflict': '冲突',
        'central bank': '央行', '央行': '央行',
      };
      for (const [kw, label] of Object.entries(keywordMap)) {
        if (lowerTitle.includes(kw.toLowerCase()) || lowerDesc.includes(kw.toLowerCase())) {
          if (!keywords.includes(label)) keywords.push(label);
        }
      }

      items.push({
        id: items.length + 1,
        title,
        content: description || title,
        source,
        url: link,
        published_at: pubDate || new Date().toISOString(),
        sentiment,
        keywords: JSON.stringify(keywords.length > 0 ? keywords : ['黄金']),
        created_at: new Date().toISOString(),
      });
    }

    return items;
  } catch (error) {
    console.error('Google News RSS fetch failed:', error);
    return [];
  }
}

/**
 * 从财经新闻API获取中文黄金新闻（备用）
 */
async function fetchGoldNewsCN(limit = 20) {
  // 使用东方财富新闻接口
  try {
    const url = `https://search-api-web.eastmoney.com/search/jsonp?cb=cb&client=web&keyword=%E9%BB%84%E9%87%91&type=1&pageindex=1&pagesize=${limit}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://so.eastmoney.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`东方财富新闻请求失败: ${response.status}`);
    }

    const text = await response.text();
    // 去除JSONP回调
    const jsonStr = text.replace(/^cb\(/, '').replace(/\)$/, '');
    const data = JSON.parse(jsonStr);

    if (!data?.Data?.Items) return [];

    const items = data.Data.Items.slice(0, limit).map((item, i) => {
      const article = item.Articles?.[0] || item;
      let sentiment = 'neutral';
      const title = article.Title || '';
      const desc = article.Description || '';
      const lowerTitle = title.toLowerCase();
      const lowerDesc = desc.toLowerCase();

      const posWords = ['上涨', '飙升', '看涨', '新高', '突破', '利好', '增持', '反弹', '走强'];
      const negWords = ['下跌', '暴跌', '看跌', '新低', '承压', '利空', '减持', '回调', '走弱'];

      const posCount = posWords.filter(w => lowerTitle.includes(w) || lowerDesc.includes(w)).length;
      const negCount = negWords.filter(w => lowerTitle.includes(w) || lowerDesc.includes(w)).length;
      if (posCount > negCount) sentiment = 'positive';
      else if (negCount > posCount) sentiment = 'negative';

      return {
        id: i + 1,
        title,
        content: desc || title,
        source: article.Source || '东方财富',
        url: article.Url || '',
        published_at: article.ShowTime ? new Date(article.ShowTime).toISOString() : new Date().toISOString(),
        sentiment,
        keywords: JSON.stringify(['黄金']),
        created_at: new Date().toISOString(),
      };
    });

    return items;
  } catch (error) {
    console.error('东方财富新闻获取失败:', error);
    return [];
  }
}

/**
 * GET /api/news - 获取新闻列表（分页）
 * 查询参数: page, limit, sentiment
 */
news.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const sentiment = c.req.query('sentiment');
    const keyword = c.req.query('keyword');

    const clampedLimit = Math.min(Math.max(limit, 1), 100);
    const offset = (page - 1) * clampedLimit;

    let whereClause = '1=1';
    const params = [];

    if (sentiment && ['positive', 'negative', 'neutral'].includes(sentiment)) {
      whereClause += ' AND sentiment = ?';
      params.push(sentiment);
    }

    if (keyword) {
      whereClause += ' AND (title LIKE ? OR content LIKE ? OR keywords LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    // 获取总数
    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM gold_news WHERE ${whereClause}`
    )
      .bind(...params)
      .first();

    const total = countResult ? countResult.total : 0;

    // 获取分页数据
    const result = await c.env.DB.prepare(
      `SELECT id, title, content, source, url, published_at, sentiment, keywords, created_at
       FROM gold_news
       WHERE ${whereClause}
       ORDER BY published_at DESC, created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(...params, clampedLimit, offset)
      .all();

    // 如果数据库没有数据，从实时源获取
    if (!result.results || result.results.length === 0) {
      let rssNews = await fetchGoldNewsFromRSS(clampedLimit);
      if (rssNews.length === 0) {
        rssNews = await fetchGoldNewsCN(clampedLimit);
      }

      let filtered = rssNews;
      if (sentiment && ['positive', 'negative', 'neutral'].includes(sentiment)) {
        filtered = rssNews.filter(n => n.sentiment === sentiment);
      }
      if (keyword) {
        filtered = filtered.filter(n => n.title.includes(keyword) || n.content.includes(keyword));
      }

      return c.json({
        success: true,
        data: {
          list: filtered.slice(offset, offset + clampedLimit),
          pagination: {
            page,
            limit: clampedLimit,
            total: filtered.length,
            totalPages: Math.ceil(filtered.length / clampedLimit),
          },
        },
      });
    }

    return c.json({
      success: true,
      data: {
        list: result.results || [],
        pagination: {
          page,
          limit: clampedLimit,
          total,
          totalPages: Math.ceil(total / clampedLimit),
        },
      },
    });
  } catch (error) {
    console.error('获取新闻列表失败:', error);
    return c.json(
      { success: false, error: '获取新闻列表失败', message: error.message },
      500
    );
  }
});

/**
 * GET /api/news/latest - 获取最新新闻
 * 查询参数: limit (默认10)
 */
news.get('/latest', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10', 10);
    const clampedLimit = Math.min(Math.max(limit, 1), 50);

    const result = await c.env.DB.prepare(
      `SELECT id, title, content, source, url, published_at, sentiment, keywords, created_at
       FROM gold_news
       ORDER BY published_at DESC, created_at DESC
       LIMIT ?`
    )
      .bind(clampedLimit)
      .all();

    // 如果数据库中没有新闻，从实时源获取
    if (!result.results || result.results.length === 0) {
      // 优先从Google News RSS获取
      let rssNews = await fetchGoldNewsFromRSS(clampedLimit);

      // 如果RSS获取失败，尝试东方财富
      if (rssNews.length === 0) {
        rssNews = await fetchGoldNewsCN(clampedLimit);
      }

      return c.json({
        success: true,
        data: rssNews.length > 0 ? rssNews.slice(0, clampedLimit) : [],
      });
    }

    return c.json({
      success: true,
      data: result.results,
    });
  } catch (error) {
    console.error('获取最新新闻失败:', error);
    return c.json(
      { success: false, error: '获取最新新闻失败', message: error.message },
      500
    );
  }
});

export default news;
