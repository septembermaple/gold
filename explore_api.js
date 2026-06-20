// 尝试探索MQL5的API端点模式
const https = require('https');
const fs = require('fs');

function fetchPage(url, headers) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const opts = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: headers || {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000,
      };
      const req = https.get(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
      });
      req.on('error', (e) => resolve({ status: 'ERROR', body: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', body: 'timeout' }); });
    } catch(e) { resolve({ status: 'ERROR', body: e.message }); }
  });
}

(async () => {
  const base = 'https://www.mql5.com';
  
  // 测试多个可能的端点
  const endpoints = [
    '/en/economic-calendar/widgets',
    '/zh/economic-calendar/widgets',
    '/en/quotes/widgets/chart',
    '/en/quotes/widgets/ticker',
    '/en/quotes/widgets/table',
    '/en/quotes/widgets/converter',
    '/en/quotes/widgets/matrix',
    '/ru/quotes/metals/xauusd',
  ];

  const results = [];
  for (const ep of endpoints) {
    const url = base + ep;
    console.log(`GET ${url} ...`);
    const r = await fetchPage(url);
    console.log(`  Status: ${r.status}, Size: ${r.body.length}`);
    results.push({ url, status: r.status, body: r.body });
    
    // 保存前几个
    const safeName = ep.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    if (r.status === 200 && r.body.length > 100) {
      fs.writeFileSync(safeName + '.html', r.body, 'utf-8');
    }
  }
  
  console.log('\n\n=== 分析每个页面的关键内容 ===\n');
  
  for (const r of results) {
    if (r.status !== 200) continue;
    console.log(`\n--- ${r.url} ---`);
    
    // 查找<script>标签中的有趣内容
    const scriptMatches = r.body.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      console.log(`  Script count: ${scriptMatches.length}`);
      for (const s of scriptMatches) {
        if (s.length > 500) {
          // 查找有趣的关键词
          const lower = s.toLowerCase();
          const keywords = ['json', 'api', 'chart', 'symbol', 'price', 'bid', 'ask', 'data', 'fetch', 'ajax', 'widget', 'history'];
          const found = keywords.filter(k => lower.includes(k));
          if (found.length > 3) {
            console.log(`  Found keywords: ${found.join(', ')} in ${s.length} bytes`);
            // 打印前500个字符
            console.log(`  Preview: ${s.substring(0, 300).replace(/\n/g, ' ')}`);
          }
        }
      }
    }
    
    // 查找iframe src
    const iframeMatches = r.body.match(/<iframe[^>]*src=["']([^"']+)["']/gi);
    if (iframeMatches) {
      console.log(`  Iframes: ${iframeMatches.length}`);
      iframeMatches.forEach(f => console.log(`    ${f}`));
    }
    
    // 查找data-属性
    const dataAttrs = r.body.match(/data-[a-z0-9-]+=["']([^"']+)["']/gi);
    if (dataAttrs && dataAttrs.length < 30) {
      console.log(`  Data attrs (${dataAttrs.length}): ${dataAttrs.slice(0, 10).join(', ')}`);
    }
    
    // 查找特定URL模式
    const urlPatterns = r.body.match(/https?:\/\/[^\s"'<>()]+/gi);
    if (urlPatterns) {
      const interesting = urlPatterns.filter(u => 
        /api|json|data|chart|history|quote|calendar|widget/i.test(u) || 
        /c\.mql5\.com/.test(u)
      );
      if (interesting.length > 0) {
        console.log(`  Interesting URLs (${interesting.length}):`);
        [...new Set(interesting)].slice(0, 10).forEach(u => console.log(`    ${u}`));
      }
    }
  }
  
  console.log('\nDONE');
})();
