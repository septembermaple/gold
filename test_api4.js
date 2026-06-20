async function test() {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

  // 测试 NASDAQ 经济日历 API 的各种参数
  const urls = [
    {name:'nasdaq_default', url:'https://api.nasdaq.com/api/calendar/economicevents'},
    {name:'nasdaq_earnings', url:'https://api.nasdaq.com/api/calendar/earnings'},
    {name:'nasdaq_dividends', url:'https://api.nasdaq.com/api/calendar/dividends'},
    {name:'nasdaq_split', url:'https://api.nasdaq.com/api/calendar/splits'},
    {name:'nasdaq_ipos', url:'https://api.nasdaq.com/api/calendar/ipos'},
  ];
  for (const t of urls) {
    try {
      const r = await fetch(t.url, {headers:{'User-Agent':ua,'Accept':'application/json'}});
      console.log(t.name,':',r.status);
      if (r.status===200){
        const json = await r.json();
        console.log('  keys:',Object.keys(json));
        if (json.data && json.data.rows){
          console.log('  rows count:',json.data.rows.length);
          if (json.data.rows.length){
            console.log('  first row:',JSON.stringify(json.data.rows[0]).substring(0,200));
          }
        }
      }
    } catch(e){console.log(t.name,'ERROR:',e.message)}
  }

  // 更完整地检查 nasdaq 数据结构
  try {
    const r = await fetch('https://api.nasdaq.com/api/calendar/economicevents', {headers:{'User-Agent':ua,'Accept':'application/json'}});
    const j = await r.json();
    console.log('\nasOf:',j.data.asOf);
    console.log('headers:',JSON.stringify(j.data.headers));
    console.log('row sample:',JSON.stringify(j.data.rows.slice(0,3),null,2));
  } catch(e){ console.log('nasdaq err:',e.message)}
}
test();
