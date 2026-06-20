async function test() {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
  const urls = [
    {name:'newsapi', url:'https://newsapi.org/v2/top-headlines?country=us&category=business&apiKey=demo'},
    {name:'httpbin', url:'https://httpbin.org/get'},
    {name:'reuters_rss', url:'https://feeds.reuters.com/reuters/businessNews'},
    {name:'bloomberg_rss', url:'https://feeds.bloomberg.com/economics/news.rss'},
    {name:'nber_rss', url:'https://www.nber.org/rss/releases.xml'},
    {name:'ecb', url:'https://www.ecb.europa.eu/rss/press_releases_monthly_eu.html.en'},
    {name:'investing_rss', url:'https://www.investing.com/rss/news_26.rss'},
    {name:'tradingeconomics_rss', url:'https://tradingeconomics.com/rss/calendar.ashx'},
    {name:'econtimes', url:'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms'},
    {name:'nasdaq', url:'https://api.nasdaq.com/api/calendar/economicevents'},
    {name:'fxempire', url:'https://www.fxempire.com/api/v1/en/economic-calendar/events'},
    {name:'json_rates', url:'https://api.exchangerate.host/latest?base=USD'},
  ];
  for (const t of urls) {
    try {
      const r = await fetch(t.url, {headers:{'User-Agent':ua,'Accept':'application/json, application/xml, text/plain','Accept-Language':'en-US'}});
      const ct = r.headers.get('content-type')||'';
      console.log(t.name,':',r.status, ct.substring(0,60));
      if (r.status===200){
        const txt=await r.text();
        console.log('  len:',txt.length);
        // 尝试查找 "date" / "event" / "title" 字段
        if (txt.includes('event')||txt.includes('Event')||txt.includes('title')||txt.includes('calendar')){
          console.log('  looks promising, sample:',txt.substring(0,300).replace(/\s+/g,' '));
        }
      }
    } catch(e){console.log(t.name,'ERROR:',e.message)}
  }
}
test();
