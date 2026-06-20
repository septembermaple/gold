async function test() {
  const now = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const from = fmt(now);
  const plus3 = new Date(now); plus3.setDate(now.getDate()+3);
  const to = fmt(plus3);
  console.log('date range:', from, to);

  const urls = [
    {name:'inv_api_v1', url:'https://api.investing.com/api/economic-calendar/?country=5,37,7,22,9,17,39,14,32,10,2,4,11,35,42,25,12,43,6,38,36,3,15,18,21,19,28,20,31,34,33,27,24,41,40,29,26,16,13,23,30,8,37&importance=1,2,3&fromDate='+from+'T23:59:59&toDate='+to+'T23:59:59&timeZone=8&timeFilter=time&lang_ID=1'},
    {name:'inv_api_v2', url:'https://api.investing.com/api/financial/data/economic-calendar'},
    {name:'inv_api_cal', url:'https://api.investing.com/api/calendar?from='+from+'&to='+to},
    {name:'inv_v3', url:'https://www.investing.com/calendar/Service/getCalendarFilteredData'},
    {name:'rss_calendar', url:'https://www.investing.com/rss/news_25.rss'},
    {name:'mql5', url:'https://www.mql5.com/en/economic-calendar/json?from='+from+'&to='+to},
    {name:'yahoo_events', url:'https://query1.finance.yahoo.com/v1/finance/calendar'},
    {name:'exchangerate', url:'https://v6.exchangerate-api.com/v6/demo/latest/USD'},
    {name:'marketwatch', url:'https://www.marketwatch.com/economy-politics/calendar'},
    {name:'calendarific', url:'https://calendarific.com/api/v2/holidays?api_key=demo&country=US&year=2026'},
  ];
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
  for (const t of urls) {
    try {
      const r = await fetch(t.url, {headers:{'User-Agent':ua,'Accept':'application/json, text/plain','Accept-Language':'en-US'}});
      console.log(t.name,':',r.status, r.headers.get('content-type'));
      if (r.status===200){
        const txt=await r.text();
        console.log('  len:',txt.length);
        if (txt.length<8000 && (txt.startsWith('[') || txt.startsWith('{'))) console.log('  content:',txt.substring(0,800));
        else console.log('  starts with:',txt.substring(0,200));
      }
    } catch(e){console.log(t.name,'ERROR:',e.message)}
  }
}
test();
