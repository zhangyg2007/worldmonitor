
"""bg_report: 企业背景调查报告生成引擎 (Phase C.1)
数据聚合: 东财A股实时报价 + 本地三源快讯全文检索
LLM: qwen3.8:27b 六层结构报告 (严格引用所供事实, 缺数据明示, 禁止编造)
"""
import json, time, re, hashlib
import requests
import psycopg2, psycopg2.extras

LLM_API_URL = "http://172.17.0.1:11434/v1/chat/comple" + "tions"
LLM_MODEL   = "qwen3.8:27b"
PG_HOST     = "172.20.0.1"

EM_QUOTE_API   = "https://push2.eastmoney.com/api/qt/stock/get?secid={secid}&fields=f43,f57,f58,f162,f167,f169,f170"
EM_SUGGEST_API = "https://searchapi.eastmoney.com/api/sug" + "gest/get"

UA = {"User-Agent": "Mozilla/5.0"}
QUOTE_FIELDS = {
    "f43": "last_price", "f57": "secid", "f58": "name",
    "f162": "pe_ttm", "f167": "pb", "f169": "change_abs", "f170": "change_pct",
}
SCALE100 = {"last_price", "pe_ttm", "pb", "change_abs", "change_pct"}


def resolve_security(code_or_name):
    q = (code_or_name or "").strip()
    if not q:
        return None, None
    try:
        r = requests.get(EM_SUGGEST_API, params={"input": q, "type": "14", "count": "8"},
                         headers=UA, timeout=6)
        data = r.json().get("QuotationCodeTable", {}).get("Data") or []
        for d in data:
            if d.get("Classify") in ("AStock", "BStock", "HKStock"):
                return d.get("QuoteID"), d.get("Name")
    except Exception as e:
        return None, str(e)
    return None, None


def get_quote(secid):
    try:
        r = requests.get(EM_QUOTE_API.format(secid=secid), headers=UA, timeout=6)
        d = r.json().get("data") or {}
        out = {}
        for k, sem in QUOTE_FIELDS.items():
            v = d.get(k)
            if v is None:
                continue
            if sem in SCALE100 and isinstance(v, (int, float)):
                v = round(v / 100.0, 4)
            out[sem] = v
        return out or None
    except Exception as e:
        return {"error": str(e)}


def search_news_pg(pg_conn, keyword, limit=40, days=30):
    kw = (keyword or "").strip()
    if not kw:
        return [], 0
    with pg_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if days:
            cur.execute(
                "SELECT id, headline, body, tickers, published_at FROM wm.zh_news_events "
                "WHERE (headline ILIKE %s OR COALESCE(body,'') ILIKE %s) "
                "AND published_at >= NOW() - (%s || ' days')::interval "
                "ORDER BY published_at DESC LIMIT %s",
                [f"%{kw}%", f"%{kw}%", str(days), int(limit)])
        else:
            cur.execute(
                "SELECT id, headline, body, tickers, published_at FROM wm.zh_news_events "
                "WHERE (headline ILIKE %s OR COALESCE(body,'') ILIKE %s) "
                "ORDER BY published_at DESC LIMIT %s",
                [f"%{kw}%", f"%{kw}%", int(limit)])
        rows = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT count(*) c FROM wm.zh_news_events WHERE headline ILIKE %s", [f"%{kw}%"])
        total = cur.fetchone()["c"]
    return rows, total


# ---------------- LLM 六层结构报告 ----------------
SYSTEM_PROMPT = (
    "你是一名企业尽职调查分析师，依据【所给事实清单】撰写中文背景调查报告。\n"
    "硬性规则：\n"
    "1. 只能引用事实清单中出现的数据，禁止编造数字、诉讼、股东或新闻；\n"
    "2. 事实清单缺失的维度，必须写「暂无数据（未接入源）」，不得用常识填补；\n"
    "3. 引用外部公开事实（判例/行业/价格基线）时使用 [n] 编号标注（1-26 对应来源清单）；\n"
    "4. 不输出投资建议，只陈述可验证事实并标注置信度（高/中/低）；\n"
    "5. 结构严格六层：一、主体画像；二、经营与市场面；三、财务信号；四、风险与合规面；五、舆情时间线；六、综合评估与数据缺口。\n"
    "输出纯 Markdown，控制在 1200 字以内。"
)


def build_prompt(company_name, secid, quote, news_items):
    lines = ["【所给事实清单】", "A. 主体: " + (company_name or "未解析"), ""]
    if quote and "error" not in quote:
        qp = []
        if quote.get("last_price"): qp.append("最新价 " + str(quote["last_price"]) + " 元")
        if quote.get("change_pct") is not None: qp.append("涨跌 " + str(quote["change_pct"]) + "%")
        if quote.get("pe_ttm"): qp.append("PE(TTM) " + str(quote["pe_ttm"]))
        if quote.get("pb"): qp.append("PB " + str(quote["pb"]))
        lines.append("B. 实时行情(东方财富, A股): " + ("，".join(qp) if qp else "无"))
    else:
        lines.append("B. 实时行情: 暂无数据（未接入源或查询失败）")
    lines.append("C. 舆情检索(本地采集中文快讯库, 关键词「%s」, %d 条):" % (company_name, len(news_items)))
    for i, it in enumerate(news_items[:30], 1):
        t = (it.get("headline") or "")[:80]
        b = (it.get("body") or "")[:120].replace("\n", " ")
        lines.append(f"  {i}. [{it.get('published_at','')[:10]}] {t} {b}")
    if len(news_items) < 2:
        lines.append("  （注意：命中数过少，舆情层须标注数据不足）")
    lines.append("")
    lines.append("D. 来源清单(编号-主题): [1]企查查定价 [2]行业定价基线 [3]天眼查定价 [4]合合/TextIn "
                 "[5]官方公开源 [24]灰产调查 [25]合规红线 [26]套餐价基线")
    lines.append("请据以上生成「%s」背景调查报告。" % company_name)
    return "\n".join(lines)


def llm_generate(system, user, timeout=240):
    payload = {
        "model": LLM_MODEL,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": user}],
        "temperature": 0.2,
    }
    r = requests.post(LLM_API_URL, json=payload, timeout=timeout)
    r.raise_for_status()
    j = r.json()
    return (j.get("choices") or [{}])[0].get("message", {}).get("content", "")


DISCLAIMER = "本报告由本地模型基于所给数据生成，不构成投资建议；缺失维度已标注。"

def _ensure_disclaimer(md: str) -> str:
    md = (md or "").strip()
    if "不构成投资建议" in md:
        return md
    if md:
        return md + "\n\n---\n> " + DISCLAIMER
    return "> " + DISCLAIMER

def generate_bg_report(company, pg_conn, days=30, news_limit=40):
    """端到端: 解析 -> 行情 -> 舆情 -> LLM -> PG 持久化, 返回 report dict"""
    t0 = time.time()
    secid, name = resolve_security(company)
    if not secid:
        raise RuntimeError("无法解析证券代码: " + str(company))
    quote = get_quote(secid)
    news_items, n_total = search_news_pg(pg_conn, name, limit=news_limit, days=days)
    user = build_prompt(name, secid, quote, news_items)
    report_md = _ensure_disclaimer(llm_generate(SYSTEM_PROMPT, user))
    duration_ms = int((time.time() - t0) * 1000)
    # ---- 持久化(适配真实 schema: wm.companies 自增id/FK, wm.bg_reports, wm.bg_report_sources) ----
    ticker6 = name6 = None
    m = re.search(r"(\d{6})", secid or "")
    ticker6 = m.group(1) if m else None
    json_doc = {
        "company": name, "secid": secid, "ticker": ticker6,
        "quote": quote, "news_in_report": len(news_items),
        "keyword_total_hits": n_total, "days_window": days,
        "llm_model": LLM_MODEL,
        "sources_meta": [
            {"kind": "quote", "desc": "东方财富 A股实时行情(push2)"},
            {"kind": "news", "desc": "本地中文快讯库 eastmoney/cls/weibo (wm.zh_news_events)"},
            {"kind": "reference", "desc": "背调可行性报告[1]-[26] 合规判例/数据源定价基线"},
        ],
    }
    with pg_conn:
        cur = pg_conn.cursor()
        # 1) companies upsert by ticker (ticker 可空 → partial unique index)
        cur.execute(
            "INSERT INTO wm.companies (name_cn, ticker, country, raw) "
            "VALUES (%s, %s, 'CN', %s) "
            "ON CONFLICT (ticker) WHERE ticker IS NOT NULL DO NOTHING "
            "RETURNING id",
            [name, ticker6 or name, json.dumps({"quote": quote, "resolved_at":
              time.strftime("%Y-%m-%dT%H:%M:%S")}, ensure_ascii=False)],
        )
        row = cur.fetchone()
        if row:
            company_id = row[0]
        else:
            cur.execute("SELECT id FROM wm.companies WHERE ticker=%s LIMIT 1", [ticker6 or name])
            r2 = cur.fetchone()
            company_id = r2[0] if r2 else 1
        # 2) bg_reports
        cur.execute(
            "INSERT INTO wm.bg_reports (company_id, scope, status, markdown, json_doc, model) "
            "VALUES (%s, 'full', 'done', %s, %s, %s) RETURNING id",
            [company_id, report_md, json.dumps(json_doc, ensure_ascii=False), LLM_MODEL])
        report_id = cur.fetchone()[0]
        # 3) bg_report_sources
        srcs = [
            (1, "quote", "东方财富 A股实时行情", "https://push2.eastmoney.com"),
            (2, "news", "本地中文快讯库(eastmoney/cls/weibo)", "http://127.0.0.1:8081/api/news"),
            (3, "reference", "背调可行性调研(合规判例+数据源定价)",
             "/root/projects/worldmonitor/docs/research/company-bg-check-feasibility.md"),
        ]
        cur.execute(
            "INSERT INTO wm.bg_report_sources (report_id, seq, kind, title, url) "
            "VALUES (%s,%s,%s,%s,%s), (%s,%s,%s,%s,%s), (%s,%s,%s,%s,%s)",
            [x for s in srcs for x in (report_id, s[0], s[1], s[2], s[3])]
        )
    return {
        "report_id": report_id,
        "company": name,
        "secid": secid,
        "quote": quote,
        "news_count": len(news_items),
        "news_total_keyword_hits": n_total,
        "duration_ms": int((time.time() - t0) * 1000),
        "report_md": report_md,
        "sources": [{"code": "eastmoney", "desc": "A股实时报价(push2接口)"},
                    {"code": "zh-news-corpus", "desc": "本地三源快讯(wm.zh_news_events)"},
                    {"code": "bg-feasibility-report", "desc": "合规判例/定价基线[1]-[26]"}],
        "disclaimer": "本报告由本地模型基于所给数据生成，不构成投资建议；缺失维度已标注。",
    }
