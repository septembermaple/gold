import requests
import re
import json
from bs4 import BeautifulSoup

url = "https://www.mql5.com/zh/quotes/metals/xauusd"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

print("=" * 60)
print("STEP 1: 请求主页面")
print("=" * 60)
r = requests.get(url, headers=headers, timeout=30)
print(f"Status: {r.status_code}")
print(f"Content-Type: {r.headers.get('Content-Type')}")
print(f"Size: {len(r.text)} bytes")

with open("page.html", "w", encoding="utf-8") as f:
    f.write(r.text)

# 提取所有script中的JSON数据
soup = BeautifulSoup(r.text, "html.parser")
print(f"\n页面标题: {soup.title.string if soup.title else 'N/A'}")

# 找到所有script标签
scripts = soup.find_all("script")
print(f"\n共找到 {len(scripts)} 个 script 标签")

for i, s in enumerate(scripts):
    if s.string and len(s.string) > 50:
        # 检查是否包含JSON数据
        for keyword in ["price", "bid", "ask", "high", "low", "change", "symbol", "chart", "calendar", "event"]:
            if keyword in s.string.lower() and len(s.string) < 5000:
                print(f"\n--- Script #{i} (contains '{keyword}') ---")
                print(s.string[:500] + "..." if len(s.string) > 500 else s.string)
                break

# 查找meta标签中的数据
metas = soup.find_all("meta")
print("\n\n" + "=" * 60)
print("STEP 2: Meta 标签 (可能包含价格数据)")
print("=" * 60)
for m in metas:
    name = m.get("name") or m.get("property")
    content = m.get("content")
    if name and content and any(k in str(name).lower() for k in ["price", "high", "low", "change", "description", "og:"]):
        print(f"  {name}: {content[:200]}")

# 查找包含价格信息的元素
print("\n\n" + "=" * 60)
print("STEP 3: 查找价格/数据区域")
print("=" * 60)

# 查找特定class/id的元素
keywords = ["price", "bid", "ask", "high", "low", "change", "calendar", "chart", "symbol", "quote", "rate"]
for tag in soup.find_all():
    class_val = " ".join(tag.get("class", [])) if tag.get("class") else ""
    id_val = tag.get("id", "")
    attrs_str = class_val + " " + id_val
    
    if any(k in attrs_str.lower() for k in keywords):
        text = tag.get_text(strip=True)[:150]
        if text:
            print(f"  [{tag.name}] class='{class_val[:80]}' id='{id_val}': {text}")

# 查找嵌入的JSON对象(window.* 变量)
print("\n\n" + "=" * 60)
print("STEP 4: 查找window.*变量中的JSON数据")
print("=" * 60)

for i, s in enumerate(scripts):
    if s.string:
        # 查找 window.xxx = {...} 模式
        matches = re.findall(r'window\.(\w+)\s*=\s*(\{[^;]{20,2000}\})', s.string)
        for var_name, json_str in matches:
            try:
                data = json.loads(json_str)
                print(f"\n  window.{var_name} = {json.dumps(data, ensure_ascii=False, indent=2)[:500]}")
            except:
                pass

# 查找 data-* 属性中可能包含的数据
print("\n\n" + "=" * 60)
print("STEP 5: 查找 data-* 属性 (常见的数据源)")
print("=" * 60)

data_elements = []
for tag in soup.find_all():
    data_attrs = {k: v for k, v in tag.attrs.items() if k.startswith("data-")}
    if data_attrs:
        summary = {k: (v[:100] + "..." if len(str(v)) > 100 else v) for k, v in data_attrs.items()}
        print(f"  [{tag.name}] {summary}")
        data_elements.append((tag, data_attrs))

print(f"\n共找到 {len(data_elements)} 个包含 data-* 属性的元素")

# 查找iframe (图表可能用iframe加载)
print("\n\n" + "=" * 60)
print("STEP 6: 查找 iframe / 图表容器")
print("=" * 60)

for iframe in soup.find_all("iframe"):
    src = iframe.get("src", "N/A")
    print(f"  iframe src={src[:200]}")

for tag in soup.find_all(["div", "canvas", "svg"]):
    class_val = " ".join(tag.get("class", [])) if tag.get("class") else ""
    id_val = tag.get("id", "")
    attrs_str = class_val + " " + id_val
    if any(k in attrs_str.lower() for k in ["chart", "graph", "candle", "kline", "plot", "calendar", "schedule", "event"]):
        text = tag.get_text(strip=True)[:100]
        print(f"  [{tag.name}] class='{class_val[:100]}' id='{id_val}': text={text}")
        # 打印data属性
        for k, v in tag.attrs.items():
            if k.startswith("data-"):
                print(f"    {k}={str(v)[:200]}")

# 检查页面是否是服务端渲染的还是客户端加载的
print("\n\n" + "=" * 60)
print("STEP 7: 检查页面渲染方式")
print("=" * 60)

# 查找noscript标签
for ns in soup.find_all("noscript"):
    text = ns.get_text(strip=True)[:200]
    if text:
        print(f"  noscript: {text}")

# 查找特定数据关键词
html_text_lower = r.text.lower()
data_keywords = ["window.__", "window.quotes", "window.price", "json_data", 
                 "init_chart", "load_calendar", "update_price", "symbol_data",
                 "data-source", "data-url", "api_url", "endpoint", 
                 "historical", "tick", "candle", "bar"]

for kw in data_keywords:
    if kw in html_text_lower:
        # 找到上下文
        idx = html_text_lower.find(kw)
        context = r.text[max(0, idx-100):idx+200]
        print(f"  Found '{kw}': ...{context.replace(chr(10), ' ')}...")

print("\n\nDONE")
