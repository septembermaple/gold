const https = require('https');
const http = require('http');
const fs = require('fs');

const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'X-Requested-With': 'XMLHttpRequest',
};

function fetchHttps(urlStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const opts = {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: commonHeaders,
        timeout: 8000,
      };
      const req = https.get(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, content: data.substring(0, 3000), headers: res.headers }));
      });
      req.on('error', (e) => resolve({ status: 'ERROR', content: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', content: 'timeout' }); });
    } catch(e) { resolve({ status: 'ERROR', content: e.message }); }
  });
}

const base = 'https://www.mql5.com';
const endpoints = [
  '/zh/quotes/metals/xauusd',
  '/en/quotes/metals/xauusd',
  '/en/economic_calendar/json',
  '/zh/economic_calendar/json',
  '/en/economic_calendar/',
  '/zh/economic_calendar/',
  '/ru/economic_calendar/json',
  '/en/quotes/metals/xauusd/json',
  '/api/v1/quotes/xauusd',
  '/en/quotes/json/xauusd',
  '/en/json/quotes/xauusd',
  '/quotes/symbol/xauusd',
  '/quotes/history/xauusd',
  '/en/chart_history/xauusd',
  '/c.mql5.com/quotes/xauusd.json',
  '/en/trading/json/symbol_info/XAUUSD',
  '/json/symbol/XAUUSD',
  '/api/symbol/XAUUSD',
  '/quotes/chart_data/xauusd',
  '/en/quotes/chart/xauusd',
  '/ru/quotes/metals/xauusd',
];

(async () => {
  console.log('Testing endpoints...\n');
  for (const ep of endpoints) {
    const url = base + ep;
    console.log(`GET ${url} ...`);
    const r = await fetchHttps(url);
    console.log(`  -> Status: ${r.status}`);
    if (r.status === 200 || r.status === 201) {
      console.log(`  -> Content-Type: ${r.headers && r.headers['content-type']}`);
      // 如果是JSON，尝试解析
      try {
        if (r.content.trim().startsWith('{') || r.content.trim().startsWith('[')) {
          const json = JSON.parse(r.content.substring(0, 2000).replace(/[\s\S]*?([\{\[])/, '$1'));
          console.log('  -> JSON keys:', Object.keys(json).slice(0, 20));
          // 保存完整内容
          const fname = ep.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
          fs.writeFileSync(fname, r.content, 'utf-8');
          console.log('  -> Saved to', fname);
        } else {
          console.log('  -> Preview:', r.content.substring(0, 300).replace(/\n/g, ' '));
          // 保存HTML
          const fname = ep.replace(/[^a-zA-Z0-9]/g, '_') + '.html';
          fs.writeFileSync(fname, r.content, 'utf-8');
          console.log('  -> Saved HTML to', fname);
        }
      } catch(e) {
        console.log('  -> Preview:', r.content.substring(0, 300).replace(/\n/g, ' '));
      }
    }
    console.log();
  }
  
  console.log('DONE');
})();
