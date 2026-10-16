"""zh-collector: 中文财经数据源采集器
Phase A: 东财快讯（直连，已验证）
Phase B: 财联社电报（akshare.stock_info_global_cls）+ 微博热搜（直连 weibo.com/ajax/side/hotSearch）
  - 多源架构：SOURCES dict 注册每个 fetcher，APScheduler 按频率跑，统一写 redis + PG
  - PG 幂等：(source, source_id) 唯一索引
"""
from __future__ import annotations
import json, time, logging, os, re
from datetime import datetime, timedelta
from datetime import timezone
from typing import Optional
import requests
import redis
import psycopg2
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# ============ 全局配置 ============
REDIS_HOST     = os.getenv("REDIS_HOST", "worldmonitor-redis")
REDIS_PORT     = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "") or None
DATA_KEY_TPL   = "zh:news:{source}:v1"
META_KEY_TPL   = "seed-meta:zh:{source}"
DATA_TTL       = 7 * 86400
PG_HOST        = "172.2" + "0.0.1"
PG_PORT        = int(os.getenv("PG_PORT", "5432"))
PG_DB          = os.getenv("PG_DB", "wm")
PG_USER        = os.getenv("PG_USER", "postgres")
PG_PASSWORD    = os.getenv("PG_PASSWORD", "")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

# ============ 东财快讯 (Phase A) ============
def fetch_eastmoney(page_size=50, max_pages=1) -> list[dict]:
    """
    返回 [{id, title, body, url, author, published_at, tickers, tags}]
    - published_at: ISO8601 字符串（带 +08:00）
    - tickers:    str list
    """
    api = "https://np-listapi.eastmoney.com/comm/web/getFastNewsList"
    items: list[dict] = []
    sort_end = ""
    for pg in range(max_pages):
        params = {"client": "web", "biz": "web" + "_724",
                  "fastColumn": "102", "sortEnd": sort_end,
                  "pageSize": str(page_size), "req_trace": "1"}
        r = requests.get(api, params=params, headers={"User-Agent": UA}, timeout=10)
        r.raise_for_status()
        d = r.json()
        if str(d.get("code")) != "1":
            raise RuntimeError(f"eastmoney error code={d.get('code')} msg={d.get('message')}")
        lst = (d.get("data") or {}).get("fastNewsList") or []
        if not lst:
            break
        for it in lst:
            stocks = it.get("stockList") or []
            codes = []
            for s in stocks:
                if isinstance(s, str) and s:
                    codes.append(s)
                elif isinstance(s, dict):
                    c = s.get("stockCode") or s.get("code") or s.get("symbol")
                    if c: codes.append(str(c))
            st  = (it.get("showTime") or "").strip()
            pa  = f"{st} +08:00" if st and " " in st else (it.get("showTime") or None)
            items.append({
                "id": it.get("code") or "",
                "title": (it.get("title") or "").strip(),
                "body": (it.get("summary") or "").strip(),
                "url": None,
                "author": it.get("author") or "",
                "published_at": pa,
                "tickers": codes,
                "tags": [],
            })
        new_end = (d.get("data") or {}).get("sortEnd") or ""
        if not new_end or new_end == sort_end:
            break
        sort_end = new_end
        time.sleep(0.4)
    return items

# ============ 财联社电报 (Phase B, via akshare) ============
_CLS_CACHE = os.getenv("CLS_CACHE_DIR", "/data/cls_cache")
os.makedirs(_CLS_CACHE, exist_ok=True)

def fetch_cls(limit=40) -> list[dict]:
    """财联社电报 — akshare.stock_info_global_cls()
    返回列: 标题 / 内容 / 日期时间
    id 规则: sha1(标题+日期时间) 前 24 位，保证稳定幂等
    """
    try:
        import akshare as ak  # 延迟导入，未装也不影响其它源
    except ImportError as e:
        raise RuntimeError(f"akshare not installed: {e}")
    df = ak.stock_info_global_cls()
    if df is None or len(df) == 0:
        raise RuntimeError("akshare.stock_info_global_cls() returned empty")
    import hashlib
    out: list[dict] = []
    for i, row in df.head(limit).iterrows():
        title = str(row.get("标题") or "").strip()
        body  = str(row.get("内容") or "").strip()
        # 兼容两种时间列: 单列"日期时间"(旧版) 或 双列"发布日期"+"发布时间"(akshare>=1.18)
        ts = str(row.get("日期时间") or "").strip()
        if not ts:
            d  = str(row.get("发布日期") or "").strip()
            tm = str(row.get("发布时间") or "").strip()
            ts = f"{d} {tm}".strip() if (d or tm) else ""
        if not ts:
            ts = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")
        if not title:
            continue
        sid = hashlib.sha1(f"{title}|{ts}".encode("utf-8")).hexdigest()[:24]
        out.append({
            "id": f"cls-{sid}",
            "title": title,
            "body": body,
            "url": f"https://www.cls.cn/telegraph" if not body else None,
            "author": "财联社",
            "published_at": f"{ts} +08:00",
            "tickers": _extract_codes(title + " " + body),
            "tags": ["cls"],
        })
    return out

_CODE_RE = re.compile(r"\b(?:(?:SH|SZ|BJ)?\d{6})\b")
def _extract_codes(text: str) -> list[str]:
    return sorted({m for m in _CODE_RE.findall(text or "") if len(m) == 6 and m.isdigit()})

# ============ 微博热搜 (Phase B, 直连) ============
def fetch_weibo(limit=30) -> list[dict]:
    """微博热搜榜 — https://weibo.com/ajax/side/hotSearch
    返回 [{word, num, desc, icon_desc...}, ...]（realtime 段，已带排名 num）
    注: 微博热搜是"趋势"而非事件，body 用 desc 填充，tickers 留空
    """
    url = "https://weibo.com/ajax/side/hotSearch"
    r = requests.get(url, headers={
        "User-Agent": UA,
        "Referer": "https://weibo.com/hot/search",
        "Accept": "application/json",
    }, timeout=10)
    r.raise_for_status()
    d = r.json()
    if not d.get("ok"):
        raise RuntimeError(f"weibo hotSearch not ok: {d.get('msg','')}")
    real = (d.get("data") or {}).get("realtime") or []
    out: list[dict] = []
    for it in real[:limit]:
        word  = (it.get("word") or "").strip()
        if not word:
            continue
        note  = (it.get("desc") or it.get("note") or "").strip()
        pos   = it.get("num") or it.get("realpos") or ""
        # 微博热搜无统一 ts，回落到当前时间（+08:00）
        now = datetime.now(timezone(timedelta(hours=8)))
        out.append({
            "id": f"weibo-hot-{pos}-{re.sub(r'[^0-9a-zA-Z]', '', word)[:20]}",
            "title": word,
            "body": note,
            "url": f"https://s.weibo.com/weibo?q=%23{word}%23",
            "author": "微博热搜",
            "published_at": now.strftime("%Y-%m-%d %H:%M:%S +08:00"),
            "tickers": _extract_codes(word + " " + note),
            "tags": ["weibo", "hot"],
        })
    return out

# ============ 数据源注册表 ============
SOURCES: dict[str, dict] = {
    "eastmoney": {
        "fetch": lambda **kw: fetch_eastmoney(page_size=kw.get("page_size", 50),
                                              max_pages=kw.get("pages", 1)),
        "poll_sec": int(os.getenv("EA_POLL_SEC", "300")),
        "kwargs": {"page_size": 50, "pages": 1},
    },
    "cls": {
        "fetch": fetch_cls,
        "poll_sec": int(os.getenv("CLS_POLL_SEC", "300")),
        "kwargs": {"limit": 40},
    },
    "weibo": {
        "fetch": fetch_weibo,
        "poll_sec": int(os.getenv("WB_POLL_SEC", "1800")),   # 30min
        "kwargs": {"limit": 30},
    },
}

# ============ Redis 写入（多源信封） ============
def redis_client() -> redis.Redis:
    return redis.Redis(host=REDIS_HOST, port=REDIS_PORT,
                       password=REDIS_PASSWORD, decode_responses=False,
                       socket_timeout=5, socket_connect_timeout=5)

def push_to_redis(items: list[dict], source: str) -> int:
    now_ms = int(time.time() * 1000)
    rc = redis_client()
    if not items:
        meta = {"fetchedAt": now_ms, "recordCount": 0, "state": "OK_ZERO",
                "schemaVersion": 1, "sourceName": source}
        rc.setex(META_KEY_TPL.format(source=source), DATA_TTL,
                 json.dumps(meta, ensure_ascii=False))
        rc.delete(DATA_KEY_TPL.format(source=source))
        return 0
    # 信封对齐 WM 的 seed-meta 约定
    meta = {
        "fetchedAt": now_ms,
        "recordCount": len(items),
        "schemaVersion": 1,
        "state": "OK",
        "sourceName": source,
        # 事件流 key 用 records 字段（与 WM 现有 domain feed 一致）
    }
    env = {
        "v": 1,
        "sourceName": source,
        "fetchedAt": now_ms,
        "recordCount": len(items),
        "state": "OK",
        "records": items,   # 直接读 records 即得事件
    }
    pipe = rc.pipeline(transaction=True)
    pipe.set(DATA_KEY_TPL.format(source=source), json.dumps(env, ensure_ascii=False))
    pipe.expire(DATA_KEY_TPL.format(source=source), DATA_TTL)
    pipe.set(META_KEY_TPL.format(source=source), json.dumps(meta, ensure_ascii=False))
    pipe.expire(META_KEY_TPL.format(source=source), DATA_TTL)
    pipe.execute()
    return len(items)

def push_error(source: str, err: str):
    meta = {"fetchedAt": int(time.time()*1000), "recordCount": 0, "state": "ERROR",
            "errorReason": (err or "")[:500], "schemaVersion": 1, "sourceName": source}
    logger.warning("%s ERROR meta: %s", source, (err or "")[:300])
    try:
        rc = redis_client()
        rc.setex(META_KEY_TPL.format(source=source), DATA_TTL,
                 json.dumps(meta, ensure_ascii=False))
    except Exception as e2:
        logger.error("failed to write error meta: %s", e2)

# ============ PG 写入（多源，幂等） ============
def push_to_pg(items: list[dict], source: str) -> int:
    if not items:
        return 0
    rows = []
    for it in items:
        if not it.get("title"):
            continue
        tickers = it.get("tickers") or []
        if not isinstance(tickers, list):
            tickers = [tickers]
        rows.append((
            source,
            (it.get("id") or ""),            # source_id
            it.get("title")[:500],
            it.get("body") or "",
            it.get("url"),
            it.get("author"),
            it.get("published_at"),
            [str(t) for t in tickers][:32],
            it.get("tags") or [],
        ))
    if not rows:
        return 0
    try:
        conn = psycopg2.connect(host=PG_HOST, port=PG_PORT, dbname=PG_DB,
                                user=PG_USER, password=PG_PASSWORD, connect_timeout=5)
        with conn, conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO wm.zh_news_events
                  (source, source_id, headline, body, url, author,
                   published_at, tickers, tags)
                VALUES %s
                ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL
                DO UPDATE SET
                  headline   = EXCLUDED.headline,
                  body       = EXCLUDED.body,
                  url        = EXCLUDED.url,
                  author     = EXCLUDED.author,
                  published_at = EXCLUDED.published_at,
                  tickers    = EXCLUDED.tickers,
                  tags       = EXCLUDED.tags
            """, rows, page_size=200)
            inserted = cur.rowcount or 0
        conn.close()
        return int(inserted)
    except Exception as e:
        logger.warning("pg write failed for %s: %s", source, e)
        return 0

# ============ 调度 ============
def collect_tick(source: str) -> dict:
    t0 = time.time()
    spec = SOURCES.get(source)
    if not spec:
        return {"ok": False, "source": source, "error": f"unknown source {source}"}
    try:
        items = spec["fetch"](**spec["kwargs"])
        n_redis = push_to_redis(items, source)
        n_pg    = push_to_pg(items, source)
        return {"ok": True, "source": source, "items": len(items),
                "redis_written": n_redis, "pg_inserted": n_pg,
                "elapsed_ms": round((time.time()-t0)*1000)}
    except Exception as e:
        logger.exception("collect_tick failed for %s", source)
        push_error(source, str(e))
        return {"ok": False, "source": source, "items": 0,
                "redis_written": 0, "pg_inserted": 0, "error": str(e)}

# ============ 新闻流共用工具 ============
def parse_pub_ts(s) -> int | None:
    """published_at -> epoch ms, 无时区默认 +08:00"""
    if not s:
        return None
    s = str(s).strip()
    try:
        if "T" not in s and " " in s:
            s = s.replace(" ", "T")
        if "+" not in s and "Z" not in s:
            s = s + "+08:00"
        return int(datetime.fromisoformat(s).timestamp() * 1000)
    except Exception:
        try:
            return int(datetime.fromtimestamp(int(s) / 1000).timestamp() * 1000)
        except Exception:
            return None


def load_source_feed(source: str) -> tuple[list, dict]:
    """读 WM-redis 的 zh:news:{source}:v1 信封, 返回 (records, meta)
    兼容两种结构: 直接 list / 信封 {records|items: [...]}
    """
    rc = redis.Redis(host=REDIS_HOST, port=REDIS_PORT,
                     password=REDIS_PASSWORD, decode_responses=True, socket_timeout=5)
    try:
        payload_raw = rc.get(DATA_KEY_TPL.format(source=source))
        meta_raw = rc.get(META_KEY_TPL.format(source=source))
    except Exception as e:
        logger.warning("load_source_feed[%s] redis read failed: %s", source, e)
        return [], {}
    env = {}
    if payload_raw:
        try:
            env = json.loads(payload_raw)
        except Exception:
            env = {}
    items = []
    if isinstance(env, dict):
        items = env.get("records") or env.get("items") or []
    elif isinstance(env, list):
        items = env
    meta = {}
    if meta_raw:
        try:
            meta = json.loads(meta_raw)
        except Exception:
            pass
    return items, meta


def filter_feed(items: list, *, since_ms: int, ticker: str = "", keyword: str = "") -> list:
    out = []
    ticker_l = (ticker or "").lower()
    for it in items:
        if not isinstance(it, dict) or not it.get("title"):
            continue
        pm = parse_pub_ts(it.get("published_at") or it.get("publishedAt") or it.get("showTime"))
        if pm is None or pm < since_ms:
            continue
        codes = it.get("tickers") or []
        if ticker_l and not any(ticker_l in str(c).lower() for c in codes):
            continue
        if keyword and keyword not in (it.get("title") or "") and keyword not in (it.get("body") or it.get("summary") or ""):
            continue
        out.append(it)
    out.sort(key=lambda x: x.get("published_at") or x.get("publishedAt") or "", reverse=True)
    return out


def normalize_entry(it: dict, source: str | None = None, full: bool = False) -> dict:
    """把原始 feed record 规范化成对外 API 条目 (统一 source / publishedAt 键)"""
    entry = {
        "id": it.get("id"),
        "source": source or it.get("source") or "",
        "title": it.get("title") or "",
        "body": it.get("body") or it.get("summary") or "",
        "url": it.get("url"),
        "author": it.get("author"),
        "publishedAt": it.get("published_at") or it.get("publishedAt") or "",
        "tickers": it.get("tickers") or [],
    }
    if full:
        entry["raw"] = it
    return entry


# ============ FastAPI ============
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler

app = FastAPI(title="zh-collector", version="0.3")
scheduler: BackgroundScheduler | None = None

class PullReq(BaseModel):
    source: str = "eastmoney"
    kwargs: dict = {}

@app.on_event("startup")
def _startup():
    global scheduler
    scheduler = BackgroundScheduler(daemon=True)
    for name, spec in SOURCES.items():
        scheduler.add_job(collect_tick, "interval", seconds=spec["poll_sec"],
                          kwargs={"source": name})
        logger.info("scheduling %s every %ss", name, spec["poll_sec"])
    scheduler.start()
    # 启动时先跑一次东财（最快），其它源 2s 后跟
    for name in list(SOURCES.keys()):
        try:
            collect_tick(name)
        except Exception as e:
            logger.warning("initial %s failed: %s", name, e)
        time.sleep(1)
    logger.info("scheduler started, %d sources registered", len(SOURCES))

def _open_pg():
    import psycopg2
    return psycopg2.connect(
        host=PG_HOST, port=PG_PORT, dbname=PG_DB,
        user=PG_USER, password=PG_PASSWORD, connect_timeout=6)


def _probe_backends() -> dict:
    """探测 Redis + PG 可用性, 供 /api/health 报告降级状态"""
    st = {}
    try:
        rc = redis_client()
        rc.ping()
        st["redis"] = "ok"
    except Exception as e:
        st["redis"] = f"error: {type(e).__name__}: {str(e)[:120]}"
    try:
        c = _open_pg()
        c.close()
        st["pg"] = "ok"
    except Exception as e:
        st["pg"] = f"error: {type(e).__name__}: {str(e)[:120]}"
    return st


@app.get("/api/health")
def health():
    """存活探针: 服务本身在跑即 ok; 后端降级单独在 /api/ready 报告
    (避免 PG/Redis 短暂不可用时容器反复 restart)
    """
    return {"ok": True, "service": "zh-collector", "version": "0.3",
            "sources": list(SOURCES.keys())}


@app.get("/api/ready")
def ready():
    """就绪探针: 探测 Redis + PG 可用性; 任一失败 -> 503 + degraded:true"""
    st = _probe_backends()
    degraded = any(v != "ok" for v in st.values())
    body = {"ok": not degraded, "service": "zh-collector", "version": "0.3",
            "sources": list(SOURCES.keys()),
            "degraded": degraded,
            "backends": st}
    return JSONResponse(content=body, status_code=503 if degraded else 200)


# ---------------- Phase C.1 背景调查报告 ----------------
@app.post("/api/bg-report")
def gen_bg_report(company: str, days: int = 30, news_limit: int = 40):
    from app.bg_report import generate_bg_report
    conn = _open_pg()
    try:
        return generate_bg_report(company, conn, days=days, news_limit=news_limit)
    except Exception as e:
        from fastapi import HTTPException as H
        raise H(500, "bg-report failed: " + str(e))
    finally:
        conn.close()


@app.get("/api/bg-reports")
def list_bg_reports(limit: int = 20):
    import psycopg2.extras
    conn = _open_pg()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT br.id, br.created_at, br.model, c.name_cn, c.ticker, length(br.markdown) "
                "FROM wm.bg_reports br LEFT JOIN wm.companies c ON br.company_id=c.id "
                "ORDER BY br.id DESC LIMIT " + str(int(min(max(limit,1),100))),
            )
            rows = [dict(r) for r in cur.fetchall()]
        return {"reports": rows}
    finally:
        conn.close()


@app.get("/api/sources")
def sources_list():
    return {"ok": True, "sources": [
        {"name": k, "poll_sec": v["poll_sec"]} for k, v in SOURCES.items()]}

@app.post("/api/pull")
def pull(req: PullReq):
    return collect_tick(req.source, **req.kwargs)

@app.get("/api/flush")
def flush(source: str = "eastmoney"):
    return collect_tick(source)

@app.get("/api/news")
def news(
    limit:   int  = Query(200, ge=1, le=2000),
    days:    int  = Query(1,   ge=1, le=90),
    source:  str  = Query("eastmoney", max_length=30),
    keyword: str  = Query("", max_length=80),
    ticker:  str  = Query("", max_length=40),
    full:    bool = Query(False),
):
    """读 WM-redis 的 zh:news:{source}:v1 信封（records 字段）"""
    items, meta = load_source_feed(source)
    since_ms = int(time.time() - days * 86400) * 1000
    out = filter_feed(items, since_ms=since_ms, ticker=ticker, keyword=keyword)
    entries = [normalize_entry(it, source=source, full=full) for it in out]
    return {
        "ok": True,
        "source": source,
        "count": min(len(entries), limit),
        "totalCount": len(items),
        "fetchedAt": meta.get("fetchedAt"),
        "state": meta.get("state", "OK"),
        "items": entries[:limit],
    }

@app.get("/api/recent")
def recent(days: int = Query(7, ge=1, le=90), limit: int = Query(200, ge=1, le=2000)):
    """跨源聚合读（合并 eastmoney + cls + weibo，按时间倒序，dedup by id）"""
    since_ms = int(time.time() - days * 86400) * 1000
    all_items: list[tuple[str, dict]] = []  # (source, record)
    for src in SOURCES.keys():
        try:
            items, _ = load_source_feed(src)
            for it in filter_feed(items, since_ms=since_ms):
                all_items.append((src, it))
        except Exception as e:
            logger.warning("recent[%s] failed: %s", src, e)
    seen = set()
    dedup = []
    for src, it in all_items:
        key = (src, it.get("id") or "", (it.get("title") or "")[:32])
        if key in seen:
            continue
        seen.add(key)
        dedup.append((src, it))
    dedup.sort(key=lambda p: p[1].get("published_at") or p[1].get("publishedAt") or "", reverse=True)
    entries = [normalize_entry(it, source=src) for src, it in dedup[:limit]]
    return {"ok": True, "count": len(entries), "items": entries}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8081")))
