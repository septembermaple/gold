const https = require('https');
const fs = require('fs');
const http = require('http');

const url = 'https://www.mql5.com/zh/quotes/metals/xauusd';

const fetchUrl = (u, headers) => new Promise((resolve, reject) => {
  const parsed = new URL(u);
  const opts = {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: headers || {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
  };
  const req = https.get(opts, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
  });
  req.on('error', reject);
});

(async () => {
  console.log('='.repeat(60));
  console.log('STEP 1: 请求主页面');
  console.log('='.repeat(60));
  const r = await fetchUrl(url);
  console.log('Status:', r.status);
  console.log('Content-Type:', r.headers['content-type']);
  console.log('Size:', r.body.length, 'bytes');

  fs.writeFileSync('page.html', r.body, 'utf-8');

  const html = r.body;
  
  // 分析 script 标签
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  const scripts = [];
  while ((m = scriptRegex.exec(html)) !== null) {
    if (m[1] && m[1].trim().length > 20) scripts.push(m[1]);
  }
  console.log('\n共找到', scripts.length, '个 script 标签');
  
  const priceKeywords = ['price', 'bid', 'ask', 'high', 'low', 'change', 'symbol', 'chart', 'calendar', 'event', 'quote', 'XAUUSD', 'symbol'];
  scripts.forEach((s, i) => {
    const lower = s.toLowerCase();
    for (const kw of priceKeywords) {
      if (lower.includes(kw) && s.length < 8000) {
        console.log(`\n--- Script #${i} (contains '${kw}') ---`);
        console.log(s.substring(0, 800));
        console.log('...');
        break;
      }
    }
  });

  // 查找 meta 标签
  console.log('\n' + '='.repeat(60));
  console.log('STEP 2: Meta 标签');
  console.log('='.repeat(60));
  const metaRegex = /<meta\s+([^>]+)>/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const attrs = metaMatch[1];
    const nameMatch = attrs.match(/(?:name|property)=["']([^"']+)["']/i);
    const contentMatch = attrs.match(/content=["']([^"']+)["']/i);
    if (nameMatch && contentMatch) {
      const name = nameMatch[1].toLowerCase();
      if (['price', 'high', 'low', 'change', 'description', 'og:', 'article:'].some(k => name.includes(k))) {
        console.log(`  ${nameMatch[1]}: ${contentMatch[1].substring(0,200)}`);
      }
    }
  }

  // 查找价格相关的HTML元素
  console.log('\n' + '='.repeat(60));
  console.log('STEP 3: 查找价格/数据区域 (class/id)');
  console.log('='.repeat(60));
  
  const searchKeywords = ['price', 'bid', 'ask', 'high', 'low', 'change', 'calendar', 'chart', 'symbol', 'quote', 'rate', 'economic'];
  
  // 用更简单的方式：搜索包含特定关键词的 class 和 id
  const classRegex = /class=["']([^"']+)["']/gi;
  const idRegex = /id=["']([^"']+)["']/gi;
  const classes = new Set();
  const ids = new Set();
  while ((m = classRegex.exec(html)) !== null) classes.add(m[1]);
  while ((m = idRegex.exec(html)) !== null) ids.add(m[1]);
  
  const interestingClasses = [...classes].filter(c => searchKeywords.some(k => c.toLowerCase().includes(k)));
  const interestingIds = [...ids].filter(c => searchKeywords.some(k => c.toLowerCase().includes(k)));
  
  console.log('\nInteresting classes:');
  interestingClasses.slice(0, 50).forEach(c => console.log('  -', c));
  
  console.log('\nInteresting IDs:');
  interestingIds.slice(0, 50).forEach(c => console.log('  -', c));

  // 查找包含具体数据数字的区域 - 搜索小数点数
  console.log('\n' + '='.repeat(60));
  console.log('STEP 4: 查找价格数字区域');
  console.log('='.repeat(60));
  
  // 搜索看起来像价格的文本
  const pricePatterns = [
    /(\d{4}\.\d{2})/g,  // 像 4123.45
    /([+-]?\d+\.\d+%?)/g,
  ];
  
  // 查找 iframe
  console.log('\n' + '='.repeat(60));
  console.log('STEP 5: 查找 iframe / 外部资源');
  console.log('='.repeat(60));
  
  const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let iframeMatch;
  while ((iframeMatch = iframeRegex.exec(html)) !== null) {
    console.log('  iframe:', iframeMatch[1]);
  }
  
  // 查找所有 src 和 href (API可能藏在里面)
  console.log('\n' + '='.repeat(60));
  console.log('STEP 6: 查找可能的API端点 (从 script src)');
  console.log('='.repeat(60));
  
  const scriptSrcRegex = /<script[^>]*src=["']([^"']+)["']/gi;
  while ((m = scriptSrcRegex.exec(html)) !== null) {
    console.log('  script src:', m[1]);
  }
  
  // 查找 JSON 数据/数据属性
  console.log('\n' + '='.repeat(60));
  console.log('STEP 7: 查找 data-* 属性');
  console.log('='.repeat(60));
  
  const dataAttrRegex = /data-([a-zA-Z0-9-]+)=["']([^"']+)["']/gi;
  const dataAttrs = new Map();
  while ((m = dataAttrRegex.exec(html)) !== null) {
    const key = 'data-' + m[1];
    const val = m[2];
    if (!dataAttrs.has(key)) dataAttrs.set(key, new Set());
    dataAttrs.get(key).add(val.substring(0, 150));
  }
  
  for (const [key, vals] of dataAttrs.entries()) {
    console.log(`  ${key}:`);
    [...vals].slice(0, 5).forEach(v => console.log('    -', v));
  }

  // 查找 window.* = {...} 赋值
  console.log('\n' + '='.repeat(60));
  console.log('STEP 8: 查找 window.* = {...} 赋值和JSON数据');
  console.log('='.repeat(60));
  
  const allScriptText = scripts.join('\n\n');
  
  // window.xxx = {...};
  const winVarRegex = /window\.([a-zA-Z_$][\w$]*)\s*=\s*(\{[\s\S]{20,2000}?\});/g;
  while ((m = winVarRegex.exec(allScriptText)) !== null) {
    try {
      const data = JSON.parse(m[2]);
      console.log(`\n  window.${m[1]} =`);
      console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    } catch(e) {}
  }
  
  // 查找 API URL 模式
  console.log('\n' + '='.repeat(60));
  console.log('STEP 9: 查找 API URL/端点模式');
  console.log('='.repeat(60));
  
  const apiPatterns = [
    /\/api\/[a-zA-Z0-9/_-]+/g,
    /\/json\/[a-zA-Z0-9/_-]+/g,
    /[a-zA-Z_$][\w$]*\.url\s*=\s*["']([^"']+)["']/g,
    /fetch\(["']([^"']+)["']/g,
    /\.get\(["']([^"']+)["']/g,
    /\.ajax\(([\s\S]{10,300}?)\)/g,
    /symbol=["']([^"']+)["']/g,
    /data-source=["']([^"']+)["']/g,
    /data-url=["']([^"']+)["']/g,
    /mql5\.com[^"']+/gi,
  ];
  
  apiPatterns.forEach(pat => {
    const matches = [...html.matchAll(pat)];
    if (matches.length > 0) {
      console.log(`\n  Pattern: ${pat.source}`);
      matches.slice(0, 10).forEach(m => console.log('    -', m[0].substring(0, 200)));
    }
  });

  // 查找特定区域的文本
  console.log('\n' + '='.repeat(60));
  console.log('STEP 10: 提取关键文本区域（价格、日历等）');
  console.log('='.repeat(60));
  
  // 查找包含经济日历的区域
  const calendarKeywords = ['calendar', '经济', '日历', 'event', 'events'];
  calendarKeywords.forEach(kw => {
    const idx = html.toLowerCase().indexOf(kw);
    if (idx > 0) {
      console.log(`\n  Found '${kw}' at position ${idx}:`);
      console.log('  ...', html.substring(Math.max(0, idx-100), idx+400).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), '...');
    }
  });
  
  console.log('\n\nDONE');
})().catch(console.error);
