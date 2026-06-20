async function test() {
  const now = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const from = fmt(now);
  const plus3 = new Date(now); plus3.setDate(now.getDate()+3);
  const to = fmt(plus3);
  console.log('date range:', from, to);

  const urls = [
    {name:'fx_api', url:'https://www.fxstreet.com/calendar/api/events?from='+from+'&to='+to},
    {name:'fx_data', url:'https://www.fxstreet.com/economic-calendar/api/data?from='+from+'&to='+to},
    {name:'fx_json', url:'https://www.fxstreet.com/api/events?from='+from+'&to='+to},
    {name:'fx_v1', url:'https://cdn.fxstreet.com/api/events?start='+from+'&end='+to},
    {name:'fx_hub', url:'https://www.fxstreet.com/hub/economic-calendar/api?from='+from+'&to='+to},
  ];
  for (const t of urls) {
    try {
      const r = await fetch(t.url, {headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36','Accept':'application/json, text/plain'}});
      console.log(t.name,':',r.status, r.headers.get('content-type'));
      if (r.status===200){
        const txt=await r.text();
        console.log('  len:',txt.length);
        const snippet = txt.substring(0,500).replace(/\s+/g,' ');
        console.log('  snippet:',snippet);
      }
    } catch(e){console.log(t.name,'ERROR:',e.message)}
  }

  // 同时尝试直接解析 fxstreet 页面中的 JSON 数据
  try {
    const r = await fetch('https://www.fxstreet.com/economic-calendar',{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36','Accept':'text/html'}});
    const html = await r.text();
    // 查找 __NEXT_DATA__ 或 window. 变量
    const nextMatch = html.match(/__NEXT_DATA__\s*=\s*(\{[\s\S]*?\})<\//);
    if (nextMatch) {
      console.log('NEXT_DATA found, len:',nextMatch[1].length);
      try { const json = JSON.parse(nextMatch[1]);
        if (json && json.props && json.props.pageProps) console.log('  pageProps keys:',Object.keys(json.props.pageProps));
      } catch(e){console.log('  parse err:',e.message)}
    } else {
      // 查找 window.xxx = JSON 类型
      const jsonMatch = html.match(/(events|calendar|eventList|eventsData|list)\s*[=:]\s*(\[[\s\S]{0,500}?\])/);
      if (jsonMatch) {
        console.log('json-like found');
        console.log(jsonMatch[2].substring(0,400));
      } else {
        console.log('NEXT_DATA not found, html snippet:',html.substring(html.indexOf('economic'),html.indexOf('economic')+400));
      }
    }
  } catch(e){ console.log('fx page err:',e.message)}
}
test();
