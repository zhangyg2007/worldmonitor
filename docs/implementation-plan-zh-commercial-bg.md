# WorldMonitor 本地定制 → 中文商业情报 + 公司背调助手 · 详细实施方案

> 日期：2026-09-24
> 目标机：Ubuntu 24.04 · 24 核 / 125 GB · Docker 29 · 已跑 `worldmonitor / worldmonitor-redis / ais-relay / redis-rest`，中间件 `postgres16 / redis7 / neo4j / milvus / minio / elasticsearch8.19` 齐备
> 仓库：`/root/projects/worldmonitor`（已 fork，已跑 8 天）
> 硬约束：**军事 / 冲突 / 网络威胁 / 气候 / 船舶 / 航空面板全部保留**（用户在澄清轮明确选择）
> 决策已锁定：RAG 用 **PG+pgvector 自建**；中文采集器用 **独立 Python(akshare) 容器**；MCP **复用 WM 自带 `api/mcp/*`** 只加工具；背调基于 **已有 `company-intel-tools.ts`** 扩展

---

## ✅ 实施状态（2026-09-24，已落地）

**Phase A + Phase B 已完成并通过端到端验证**（真实东财/财联社/微博数据，非模拟）：

| 件 | 状态 | 验证 |
|---|---|---|
| PG `wm` 库 + 7 张表 | ✅ 建好 | `wm.zh_news_events` 已写入真实数据；`(source, source_id)` 部分唯一索引幂等去重 |
| `zh-collector` 容器 v0.2 | ✅ healthy | `127.0.0.1:8081`，APScheduler 三源调度：eastmoney 300s / cls 300s / weibo 1800s |
| 东财快讯（直连 API）| ✅ 已上线 | 201 行，首 50 条写入 `zh:news:eastmoney:v1`（WM 契约 key）|
| 财联社电报（akshare）| ✅ 已上线 | akshare 1.18.97 `stock_info_global_cls()`，逐批 10 条实时电报，双列时间兼容 |
| 微博热搜（直连 API）| ✅ 已上线 | `weibo.com/ajax/side/hotSearch`，top 30 每 1800s 一次 |
| 双写（Redis+PG）| ✅ | 3 源 × (`zh:news:{src}:v1` + `seed-meta:zh:{src}`) 全存在 |
| `/api/news` 查询端点 | ✅ | `/health /pull /news /flush /sources` 全 200 |
| 过滤分支 | ✅ | `source / keyword / days / since / ticker / full` 实测通过 |
| 幂等验证 | ✅ | 重复 source_id 行 = 0；复采 pg_inserted 反映真实新增 |

**调用示例**：
`curl 'http://127.0.0.1:8081/api/news?source=cls&limit=5'`
`curl 'http://127.0.0.1:8081/api/news?keyword=黄金&days=1'`
`curl -X POST 'http://127.0.0.1:8081/api/pull' -d '{"source":"eastmoney"}'`

**Phase C.1 背景调查报告引擎已完成并通过端到端验证**（真实 LLM 调用 `qwen3.8:27b`，非模拟）：

| 件 | 状态 | 验证 |
|---|---|---|
| 报告引擎 `app/bg_report.py` | ✅ | 解析（东财 suggest API）→ 实时行情（push2：茅台 1237.00 元 / PE 17.37 / PB 6.15）→ PG 三源舆情检索 → LLM 六层报告 → 三表持久化；单次端到端 23.7s |
| `POST /api/bg-report?company=名称` | ✅ | 返回六层结构 markdown（主体画像/经营市场/财务信号/风险合规/舆情时间线/综合评估） |
| `GET /api/bg-reports` | ✅ | 读回 report_id=1、贵州茅台/600519/1304 字、model=qwen3.8:27b |
| 合规行为 | ✅ 规则生效 | 缺失维度全部「暂无数据（未接入源）」零编造；来源清单 [1]-[26] 编号引用；免责声明自动附 |
| 持久化 | ✅ | wm.companies + wm.bg_reports + wm.bg_report_sources 写读一致 |

**调用示例**：
`curl -X POST 'http://127.0.0.1:8081/api/bg-report?company=贵州茅台&days=30'`
`curl 'http://127.0.0.1:8081/api/bg-reports?limit=10'`

**待推进（Phase C 剩余）**：MCP 工具挂 `company-intel-tools.ts`（暴露 bg-report/zh_intel 工具）、`chinese-commercial` 前端 variant（**全保留面板**）、PG embedding（`pg16+vector` 独立容器）、雪球热帖（akshare `stock_hot_rank_xq`，可选加源）。

> 已知降级：`wm` 库无 pgvector 扩展（embedding 列 Phase C 建独立 `pg16+vector` 容器，复用 Yuxi 实例会冲突）；雪球热帖未上（可选，加源只改 `fetch_xueqiu()` + `SOURCES`）。

---

## 0. 现状盘点（已验证）


| 件 | 现状 | 影响 |
|---|---|---|
| WorldMonitor 容器 | `worldmonitor healthy 8d`，`worldmonitor-redis healthy`，`ais-relay`、`redis-rest` 起 | 不改启动方式，只**加** |
| `.env` | 仅 `POSTGRES_* / REDIS_* / OLLAMA_BASE_URL / OPENROUTER/GROQ/GEMINI keys / AUTH_SECRET / TURNSTILE_SECRET` | **无任何数据源 API key**，全部走公开源+优雅降级 |
| 已有 seeder | `scripts/*.mjs` 共 **195** 个，契约 `_seed/{fetchedAt,recordCount,state,...}` + `seed-meta:*` 状态行 + `extendExistingTtl` + 分布式锁 | 中文源必须**对齐此契约**写入 `worldmonitor-redis` |
| LLM | `PROVIDER_CHAIN = [ollama, openrouter, ...]`，本地 `ollama` 已加载 `qwen3.8:27b` | 摘要/翻译/背调报告走本地 27B |
| MCP | `api/mcp/registry/*.ts`：`cache / nlp / rpc / source / company-intel` 五组，`TOOL_REGISTRY` 合并 | 新增 `zhh-intel-*` 工具**挂在 `company-intel-tools.ts` + `source-tools.ts`** 两处即可 |
| 前端 i18n | `src/locales/zh.json` 已存在；`panel-enablement.ts` 用 `ALL_PANELS` 全量面板，`VARIANT_PANEL_CONFIGS[variant]` 可选子集 | 中文默认 variant 新建 `chinese-commercial`（不动 `full`，**保留全部面板**） |
| 背调相关 | `company-intel-tools.ts` 暴露 4 views（enrichment/signals/filings-search/material-events），上游 SEC EDGAR | 新增的**境内**公司（启信宝/企查查）作为第 5 view `china-enrichment` |
| 报告产物 | `docs/research/company-bg-check-feasibility.md`（26 来源） | 直接作为**产品 PRD** 与**字段白名单**基线 |

---

## 1. 架构总览

```
┌────────────────────────────────────────────────────────────────────────┐
│  前端（Vite+React，已有） · variant=chinese-commercial · zh.json 补全 │
│  全部面板保留（军事/冲突/网络/气候/船舶/航空）+ 新增：               │
│    ① 境内财经流（财联社/同花顺/东财/雪球/微博）                     │
│    ② 公司背调工作台（启信宝/企查查 + 地缘风险层 + 生成报告）        │
└──────────────┬─────────────────────────────────────────────────────────┘
               │
┌──────────────▼─────────────────┬──────────────────────────────────────┐
│  WM 现有 api/mcp/* + api/[route]│  新增 api/company-bg/[route]         │
│  · TOOL_REGISTRY 追加 zh-intel │  · POST /report {company,scope}      │
│  · company-intel + china view  │  · GET  /report/:id / /reports       │
└──────────────┬─────────────────┴────────────────┬─────────────────────┘
               │                                  │
┌──────────────▼──────────────────────────────────▼─────────────────────┐
│  Postgres 16 （复用）                                                 │
│  · yuxi（Yuxi）· wm（新增 db）                                        │
│      – companies / company_events / company_embeddings (vector512)   │
│      – zh_news_events / source_health                                │
│      – reports / report_sources                                       │
├───────────────────────────────────────────────────────────────────────┤
│  Redis 7 （复用现有 worldmonitor-redis，同密码）                       │
│  · zhh:news:caixin / eastmoney / xueqiu / weibo / 10jq               │
│  · zhh:meta:*  （对齐 seed-envelope）                                │
│  · company-bg:cache:* （报告缓存 24h）                                │
└──────────────┬────────────────────────────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────────────────────────────┐
│  新增容器 zh-collector （Python 3.12 + akshare，独立 image）          │
│  · FastAPI /api/health /api/pull /api/flush                           │
│  · APScheduler 定时 → akshare 财联社/东财/雪球/10jq/微博               │
│  · 写 worldmonitor-redis（envelope 对齐 seed-envelope.ts）+ PG        │
│  · 失败重试、限速（每源 2–5 req/min 保守）、断点续抓                   │
└──────────────┬────────────────────────────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────────────────────────────┐
│  LLM 摘要/翻译/报告生成（复用 WM 的 server/_shared/llm.ts 模式）      │
│  · 摘要：ollama/qwen3.8:27b（本地）                                    │
│  · 报告：同上；可选走 openrouter deepseek-v4-flash                     │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 2. 阶段切分（3 阶段，每阶段可独立验收）

### 阶段 A · 容器与数据层（D0–D2，2 天）
目标：跑通 **Python collector 写 Redis/PG**，WM 面板看到 **财联社一条新闻**。

- A0 · 新建 `docker-compose.zh.yml`（叠加在 `docker-compose.yml` 上），只加 `zh-collector + zh-pg`；`--profile zh` 默认关闭
- A1 · `docker/Dockerfile.zh-collector`：python:3.12-slim + akshare 2.1.x + fastapi + uvicorn + apscheduler + redis
- A2 · Postgres 建 `wm` 库 + 5 张表（schema 见 §3），Alembic 迁移脚本
- A3 · `zh-collector` 首版只接**财联社**（`ak.stock_telegraph`），每 5 min 拉一次，写 `zhh:news:caixin` + PG `zh_news_events`
- A4 · WM 前端：临时加一个最小面板 `zhNewsCaixin`（只读 `zhh:news:caixin`，10 条，带时间戳）
- **验收**：`docker compose config` 通过；`curl :8081/api/health` 200；面板上能看到财联社标题与时间

### 阶段 B · 全源采集 + 背调数据底座（D2–D5，4 天）
目标：**东财/同花顺/雪球/10jq 上线** + **启信宝/企查查 2 家 API** 落地。

- B1 · akshare 采集器扩到 5 源（见 §4 表），每源独立限速与 fallback
- B2 · 新增 `api/company-bg/providers/qixinbao.ts / qichacha.ts`（走公司主体 + 高管任职 + 诉讼 + 变更；**不含**婚姻/征信/健康/未公开诉讼，遵循 `company-bg-check-feasibility.md` 白名单）
- B3 · `company-intel-tools.ts` 追加 `views = [... existing, 'china-enrichment']`；`company_signals` 合并境外+境内
- B4 · WM 内置 LLM 摘要任务：collector 拉完写 `zhh:llm:pending` 队列，WM 定时消费走 `llm.ts` 出摘要/翻译
- B5 · `zh_news_events` 全量入库，`source_health` 记录成功率/延迟；失败源降级到 `seed-meta.state=ERROR`
- **验收**：5 源全绿时面板聚合页出 5 条以上最新；启信宝 API 返回公司主体页 200（有 key 时）

### 阶段 C · 报告生成 + 前端 + MCP 暴露（D5–D8，4 天）
目标：**一键生成《境内公司背调报告》** + MCP 工具 `company_bg_report(company, scope)` 可被 Hermes/其他 Agent 调用。

- C1 · `api/company-bg/report.ts`：六层结构（主体/经营/合规/风险/地缘/舆情）+ 引用源（26 来源基线）
- C2 · `report.ts` 内调用 3 段 prompt 模板（主体识别 → 风险打分 → 地缘叠加），本地 27B 或 openrouter
- C3 · 报告持久化到 PG `reports` + `report_sources`，返回 JSON + Markdown 两种形态
- C4 · MCP 工具注册（`company-bg-tools.ts` 新文件，挂进 `TOOL_REGISTRY`），免费层可用
- C5 · 前端新增「公司背调工作台」页：输入公司名 → 生成 → 查看六层报告 + 引用 + 复制/导出
- C6 · 一键切换 `variant=chinese-commercial`，`VARIANT_PANEL_CONFIGS.chinese-commercial = FULL_PANELS`（保留全部面板） + 默认中文 locale + 高德瓦片
- **验收**：对 2 家境内上市公司跑通报告生成，引用完整、字段白名单合规；MCP `company_bg_report` 通过 Hermes 会话调用 OK

---

## 3. Postgres 表结构（阶段 A 起）

```sql
CREATE SCHEMA IF NOT EXISTS wm;

-- 公司主档（境内外统一）
CREATE TABLE wm.companies (
  id             bigint generated always as identity primary key,
  name_cn        text not null,
  name_en        text,
  usci_code      text unique,          -- 统一社会信用代码
  ticker         text,                 -- 境内外代码
  country        text default 'CN',
  industry       text,
  founded_at     timestamptz,
  executives     jsonb default '{}',   -- 高管任职（白名单）
  raw            jsonb not null,       -- 启信宝/企查查/SEC 原始
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- 公司事件（诉讼/变更/处罚/舆情）
CREATE TABLE wm.company_events (
  id           bigint generated always as identity primary key,
  company_id   bigint references wm.companies(id) on delete cascade,
  type         text not null,          -- litigation / admin_punish / change / public_opinion / signal
  title        text not null,
  summary      text,
  url          text,
  source       text not null,          -- qixinbao / qichacha / sec / weibo / xueqiu
  occurred_at  timestamptz,
  fetched_at   timestamptz default now(),
  raw          jsonb
);
CREATE INDEX wm_events_company_time ON wm.company_events(company_id, occurred_at desc);

-- 新闻/舆情事件
CREATE TABLE wm.zh_news_events (
  id          bigint generated always as identity primary key,
  source      text not null,           -- caixin / eastmoney / xueqiu / weibo / 10jq
  headline    text not null,
  body        text,
  url         text,
  author      text,
  published_at timestamptz not null,
  fetched_at  timestamptz default now(),
  tickers     text[] default '{}',     -- 关联股票代码
  tags        text[] default '{}',
  embedding   vector(512)              -- 待接 embedding 模型后填
);
CREATE INDEX wm_news_source_time  ON wm.zh_news_events(source, published_at desc);
CREATE INDEX wm_news_ticker       ON wm.zh_news_events USING GIN (tickers);

-- 报告
CREATE TABLE wm.bg_reports (
  id           bigint generated always as identity primary key,
  company_id   bigint references wm.companies(id),
  scope        text not null default 'full',   -- full / compliance / geo
  status       text default 'done',            -- running / done / failed
  markdown     text,
  json_doc     jsonb,
  prompt_hash  text,
  model        text,
  created_at   timestamptz default now()
);

CREATE TABLE wm.bg_report_sources (
  report_id bigint references wm.bg_reports(id) on delete cascade,
  seq       int,
  kind      text,           -- registry / filing / litigation / signal / geo / source_article
  title     text,
  url       text,
  fetched_at timestamptz default now(),
  primary key (report_id, seq)
);

-- 源健康
CREATE TABLE wm.source_health (
  source        text primary key,
  last_ok_at    timestamptz,
  last_err_at   timestamptz,
  last_err      text,
  success_ratio real,
  avg_latency_ms int
);
```

**pgvector 扩展**：`CREATE EXTENSION IF NOT EXISTS vector;`（阶段 C 才启用 embedding）

---

## 4. akshare 采集映射（阶段 B）

| 源 | akshare 函数 | 频率 | 字段 | 限速/重试 |
|---|---|---|---|---|
| 财联社 · 电报 | `ak.stock_telegraph(symbol="全部")` | 5 min | id/title/摘要/url/时间 | 1 req/5min，2 次重试，500ms 间 |
| 东方财富 · 快讯 | `ak.east_money_global_news()` 或 `ak.stock_zh_news` | 5 min | 标题/正文/代码/时间 | 同上 |
| 同花顺 · 财经 | `ak.news`/`ak.stock_news`（或 web 抓 `http://news.10jqka.com.cn`） | 10 min | 标题/正文/来源/时间 | 1 req/10min，失败降级到 `seed-meta.state=ERROR` |
| 雪球 | `ak.xueqiu` 接口 / 官方 `https://xueqiu.com/query/v1/search/web/json?keyword=` | 10 min | 标题/作者/时间/正文 | 需 UA+Cookie，200 req/h |
| 微博财经 | `ak.stock_weibo` 或 `https://api.weibo.com/2/feeds/search.json` | 15 min | 标题/正文/作者/时间/转发 | 需 access_token，失败静默 |

**写入 WM Redis 契约**（与 `seed-envelope.ts` 对齐）：
```
key    : zhh:news:<source>
type   : JSON list（新→旧，最多 500 条），TTL 7d
meta   : zhh:meta:<source>  =  { fetchedAt, recordCount, state:'OK'/'ERROR', errorReason? }
```

**PG 同时落库**：`wm.zh_news_events`，供报告生成与向量检索。

---

## 5. docker-compose 增量

```yaml
# docker-compose.zh.yml（与主 docker-compose.yml 叠加：docker compose -f docker-compose.yml -f docker-compose.zh.yml up -d --profile zh）
services:
  zh-collector:
    build:
      context: .
      dockerfile: docker/Dockerfile.zh-collector
      target: zh-collector
    image: zhh/zh-collector:0.1
    profiles: ["zh"]
    env_file:
      - .env
    environment:
      REDIS_HOST: worldmonitor-redis
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      PG_HOST: db                 # 复用现有 postgres16
      PG_DATABASE: wm
      PG_USER: postgres
      PG_PASSWORD: ${POSTGRES_PASSWORD}
      QINIXIAO_API_KEY: ${QINIXIAO_API_KEY:-}
      QICHACHA_API_KEY: ${QICHACHA_API_KEY:-}
    depends_on:
      db:      { condition: service_healthy }
      worldmonitor-redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8081/api/health"]
      interval: 30s
      timeout: 5s
      retries: 5
    networks: [wm]
    restart: unless-stopped
```

主 `docker-compose.yml` 已有 `db: postgres:16` 与健康检查 → 直接 `depends_on`。

---

## 6. 背调报告字段白名单（遵循 `company-bg-check-feasibility.md`）

| 层 | 允许的字段 | **禁止**字段 |
|---|---|---|
| 主体 | name_cn / usci_code / 登记机关 / 注册资本 / 成立日期 / 注册地址 | 实控人婚姻、家庭成员 |
| 经营 | 经营范围 / 主要业务 / 年报关键指标（营收/净利/资产） | 未披露的内部经营 |
| 合规 | 已判诉讼 / 行政处罚 / 变更 / 股权 | 未立案侦查、征信、健康 |
| 风险 | 公开失信记录 / 被执行金额（已披露部分） | 银行内部授信、未公开流水 |
| 地缘 | OFAC SDN / CMIC / EAR / 制裁时间线（WorldMonitor 现成数据） | — |
| 舆情 | 近 30 天微博/雪球/财联社标题与 URL | 评论区正文（隐私） |

**红线**（来自 2025 丰台判例 + 央视 2026-09 调查）：
1. 未核实信息**不得**进入报告（"黄灯"不得写）；
2. 任何"全库爬取"路径禁用（2025 静安/得物判例）；
3. 数据仅来自**公开登记/已披露**，不得接入银行/税务/公安库。

---

## 7. 复用与不改清单

**不改**：
- `docker-compose.yml` 现有 `worldmonitor / worldmonitor-redis / ais-relay / redis-rest` 启动方式、端口、healthcheck
- 全部 195 个现有 seeder；其 envelope 契约被复用
- `api/mcp/registry/*.ts` 现有 5 组工具；`company-intel-tools.ts` 现有 4 views
- `src/locales/zh.json` 已存在（仅**补**商业情报术语）
- `provider chain` 顺序与 Ollama 27B 模型选择

**新增**：
- `docker/Dockerfile.zh-collector`
- `zh-collector/`（Python 服务包）
- `api/company-bg/`（route + providers + report.ts + prompts/）
- `wm` Postgres schema
- `api/mcp/registry/company-bg-tools.ts`（新 MCP 工具文件）
- `src/config/panels.zh-commercial.ts`（新 variant 配置，引用 `FULL_PANELS` 全部保留）

**待填 keys**（可选，阶段 B 前）：
```
QINIXIAO_API_KEY=
QICHACHA_API_KEY=
WEIBO_ACCESS_TOKEN=
XUEQIU_COOKIE=
```
无 key 时对应源优雅降级（`seed-meta.state=ERROR`），不影响其他源与已有面板。

---

## 8. 验收总表

| # | 阶段 | 验收命令 / 路径 | 期望 |
|---|---|---|---|
| 1 | A | `docker compose -f ... -f ... config --quiet` | 0 |
| 2 | A | `curl http://127.0.0.1:8081/api/health` | 200 JSON ok |
| 3 | A | `redis-cli -h worldmonitor-redis -a $REDIS_PASSWORD llen zhh:news:caixin` | ≥ 1 |
| 4 | A | `psql wm -c "select count(*) from zh_news_events"` | ≥ 1 |
| 5 | B | 5 源全绿，`SELECT source,count(*) FROM zh_news_events GROUP BY source` | 5 行 |
| 6 | B | `curl :8080/api/company-bg/enrichment?company=宁德时代` | 200 JSON（有 qixinbao key 时） |
| 7 | C | `:8080/api/company-bg/report?company=宁德时代&scope=full` | Markdown 六层 + 26 来源引用 |
| 8 | C | MCP `tools/list` | 含 `company_bg_report` |
| 9 | C | Hermes 会话调用 `company_bg_report({company:"宁德时代", scope:"compliance"})` | 返回合规层 |
| 10 | 全程 | `docker logs zh-collector` | 无未捕获异常 |

---

## 9. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| 启信宝/企查查限流或停售 | 中 | 双源互为 fallback；无 key 时降级到 gsxt 公开页（仅主体页，批量禁） |
| 雪球/微博 cookie 失效 | 中 | collector 检测 401/403 自动降级，`source_health.success_ratio < 0.8` 告警 |
| 27B 摘要质量波动 | 低 | prompt 含 few-shot；失败走 openrouter deepseek-v4-flash |
| 合规边界（判例风险） | 高 | 白名单硬编码在 `providers/_whitelist.ts`，代码层过滤；报告页显式声明"仅公开来源" |
| PG 复用 `yuxi` 库冲突 | 低 | 独立 `wm` schema；Alembic 只在 `wm` schema 下操作 |
| collector 内存峰值 | 低 | 单进程 APScheduler；akshare 拉完即 flush；内存上限 1 GB |

---

## 10. 下一步（即刻开工顺序）

1. `git checkout -b feature/zh-commercial-bg`
2. 写 `docker/Dockerfile.zh-collector` + `zh-collector/`（A3 最小可用：财联社）
3. 建 `migrations/` + `wm` 5 表 DDL（§3）
4. 写 `docker-compose.zh.yml`（§5）
5. 前端最小面板 `ZhNewsCaixin`（A4）
6. 跑验收 #1–#5；通过后进阶段 B
