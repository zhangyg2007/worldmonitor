#!/usr/bin/env /usr/bin/python3
"""Phase A 三链路自测（纯标准库 fetch + 宿主 redis-cli/psql 写入）
不依赖 pip 安装的 redis/psycopg2 包。"""
import json, time, subprocess, urllib.request, os, sys

API  = "https://np-listapi.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_724&fastColumn=102&sortEnd=&pageSize=5&req_trace=1"
UA   = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
RP   = os.popen("grep -oE '^REDIS_PASSWORD=.*' /root/projects/worldmonitor/.env | cut -d= -f2-").read().strip()
PW   = os.popen("grep -oE '^POSTGRES_PASSWORD=.*' /root/projects/worldmonitor/.env | cut -d= -f2-" ).read().strip() or "postgres"

def sh(*cmd):
    r = subprocess.run(list(cmd), capture_output=True, text=True, timeout=15)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

ok = lambda ok, tag: (print(f"  [{tag}]", file=sys.stdout), ok)[1]

# [1/3] fetch 东方财富
t0=time.time()
with urllib.request.urlopen(urllib.request.Request(API, headers={"User-Agent":UA}), timeout=12) as resp:
    d = json.loads(resp.read())
assert str(d.get("code"))=="1", d
items = [{"code":it["code"],"title":it["title"],"summary":it.get("summary",""),
          "showTime":it.get("showTime",""),"stocks":it.get("stockList",[])} for it in d["data"]["fastNewsList"]]
print(f"[1/3] eastmoney: {len(items)} items in {int((time.time()-t0)*1000)}ms")
print(f"    first: {items[0]['title'][:60]!r}  ts={items[0]['showTime']}  stocks={items[0]['stocks']}")
assert len(items)>=1 and items[0]["title"]

# [2/3] 写 WM-redis（经宿主 redis-cli，密码 auth；与 WM 契约对齐 domain:name:vN）
now_ms = int(time.time()*1000)
meta = {"fetchedAt":now_ms,"recordCount":len(items),"sourceVersion":"1.0","schemaVersion":1,"state":"OK","newestItemAt":now_ms,"oldestItemAt":now_ms}
DATA, META = "eastmoney:news:v1", "seed-meta:eastmoney:news-v1"
def rcmd(*args):  # redis-cli 带密码
    out = subprocess.run(["docker","exec","worldmonitor-redis","redis-cli","-a",RP,"--no-auth-warning",*args],
                         capture_output=True, text=True, timeout=10)
    return out
r = rcmd("SET", DATA, json.dumps(items, ensure_ascii=False));  ok(r.stdout.strip() in ("OK","ok") or r.stdout.strip()=="OK", "SET data")
r = rcmd("EXPIRE", DATA, "604800")
r = rcmd("SET", META, json.dumps(meta, ensure_ascii=False));  ok(r.stdout.strip() in ("OK","ok") or r.stdout.strip()=="OK", "SET meta")
r = rcmd("EXPIRE", META, "604800")
# 回读
r = rcmd("STRLEN", DATA);  data_len = int(r.stdout.strip() or 0)
r = rcmd("TTL", DATA);     ttl = r.stdout.strip()
r = rcmd("GET", META);     got_meta = json.loads(r.stdout)
print(f"[2/3] redis: data_bytes={data_len} ttl={ttl} meta_state={got_meta['state']} record_count={got_meta['recordCount']}")
assert data_len>0 and got_meta["state"]=="OK"

# [3/3] 写 PG wm.zh_news_events（经宿主 psql -f，SQL 数组用 ARRAY[] 语法）
def sql_escape(s):
    return (s or "").replace("\\","\\\\").replace("'","''").replace("\n"," ")
def arr(l):
    """Python list[str] -> Postgres ARRAY 字面量。空 list -> ARRAY[]::text[]。"""
    if not l:
        return "ARRAY[]::text[]"
    return "ARRAY[" + ",".join(f"'{sql_escape(x)}'" for x in l) + "]"
now_tz = time.strftime("%Y-%m-%d %H:%M:%S +08:00")
vals = []
for it in items:
    ts = it.get("showTime")
    ts_sql = f"'{ts} +08:00'" if ts else f"'{now_tz}'"
    vals.append(f"('eastmoney', '{sql_escape(it['title'])}', '{sql_escape(it.get('summary',''))}', NULL, NULL, {ts_sql}, {arr(it['stocks'])}, ARRAY[]::text[])")
sql = ("INSERT INTO wm.zh_news_events (source, headline, body, url, author, published_at, tickers, tags) VALUES " + ", ".join(vals))
# 写临时 SQL 文件避免 shell 引号问题（含中文）
VERIFY_SQL="/tmp/verify_insert.sql"
with open(VERIFY_SQL,"w") as f:
    f.write(sql + ";\n")
    f.write("SELECT 'INSERTED=' || count(*) FROM wm.zh_news_events WHERE source='eastmoney';\n")
    f.write("SELECT 'ROW id='||id||' | '||left(headline,50)||' @ '||published_at FROM wm.zh_news_events WHERE source='eastmoney' ORDER BY id DESC LIMIT 3;\n")
r = subprocess.run(["docker","exec","-i","postgres","psql","-U","postgres","-d","wm","-v","ON_ERROR_STOP=1"],
                   stdin=open(VERIFY_SQL), capture_output=True, text=True, timeout=20,
                   env={**os.environ, "PGPASSWORD": PW})
print(f"[3/3] psql insert rc={r.returncode}")
print(" " + r.stdout.replace("\n","\n ").strip()[:400])
if r.returncode!=0: print("    STDERR:", r.stderr[:400])
assert r.returncode==0 and "INSERTED=5" in r.stdout, "pg insert failed"
# [4/4] 清理测试数据
c = subprocess.run(["docker","exec","postgres","psql","-U","postgres","-d","wm","-c","DELETE FROM wm.zh_news_events WHERE source='eastmoney';"],
                   capture_output=True, text=True, timeout=15)
print(f"[4/4] cleanup: {c.stdout.strip()!r}")
c2 = subprocess.run(["docker","exec","worldmonitor-redis","redis-cli","-a",RP,"--no-auth-warning","DEL",DATA,META],
                    capture_output=True, text=True, timeout=10)
print(f"     redis DEL: {c2.stdout.strip()!r}")
print("\nALL PASS  ✅  三链路（东财→WM-redis→PG wm）全绿")
