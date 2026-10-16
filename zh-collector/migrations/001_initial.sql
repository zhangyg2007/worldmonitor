-- wm schema: 中文商业情报 + 公司背调 数据底座
-- 应用对象: PG16 (非 Yuxi 共享库), 库名 wm
-- 红线: 只操作 wm schema, 不动 yuxi 库
-- 列名与 zh-collector/app/*.py 实际使用一致 (source_id 等)

CREATE SCHEMA IF NOT EXISTS wm;

-- 公司主档（境内外统一）
CREATE TABLE IF NOT EXISTS wm.companies (
    id             bigint generated always as identity primary key,
    name_cn        text not null,
    name_en        text unique,
    usci_code      text unique,
    ticker         text,
    country        text default 'CN',
    industry       text,
    founded_at     timestamptz,
    executives     jsonb default '{}',
    raw            jsonb not null default '{}',
    created_at     timestamptz default now(),
    updated_at     timestamptz default now()
);
-- ticker 唯一(可空): 支撑 companies upsert 幂等, 防止同名重复主档
-- (幂等: 先按 ticker 去重保留最小 id, 再建唯一索引; 本脚本可重复执行)
DELETE FROM wm.companies c
USING wm.companies o
WHERE c.ticker = o.ticker AND c.id > o.id;
CREATE UNIQUE INDEX IF NOT EXISTS companies_ticker_uniq ON wm.companies(ticker) WHERE ticker IS NOT NULL;

-- 公司事件（诉讼/变更/处罚/舆情）
CREATE TABLE IF NOT EXISTS wm.company_events (
    id           bigint generated always as identity primary key,
    company_id   bigint references wm.companies(id) on delete cascade,
    type         text not null,
    title        text not null,
    summary      text,
    url          text,
    source       text not null,
    occurred_at  timestamptz,
    fetched_at   timestamptz default now(),
    raw          jsonb
);
CREATE INDEX IF NOT EXISTS wm_events_company_time ON wm.company_events(company_id, occurred_at desc);

-- 新闻/舆情事件（三源: eastmoney/cls/weibo）
CREATE TABLE IF NOT EXISTS wm.zh_news_events (
    id           bigint generated always as identity primary key,
    source       text not null,
    source_id    text,
    headline     text not null,
    body         text,
    url          text,
    author       text,
    published_at timestamptz,
    fetched_at   timestamptz default now(),
    tickers      text[] default '{}',
    tags         text[] default '{}'
    -- embedding 列 Phase C.4 建独立 pg16+vector 容器后 ALTER ADD
);
-- (source, source_id) 部分唯一索引: 幂等 upsert 依赖, source_id 可空
CREATE UNIQUE INDEX IF NOT EXISTS zh_news_events_src_uniq
    ON wm.zh_news_events(source, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wm_news_source_time ON wm.zh_news_events(source, published_at desc);
CREATE INDEX IF NOT EXISTS wm_news_headline    ON wm.zh_news_events USING GIN (to_tsvector('simple', headline));

-- 背调报告
CREATE TABLE IF NOT EXISTS wm.bg_reports (
    id           bigint generated always as identity primary key,
    company_id   bigint references wm.companies(id),
    scope        text not null default 'full',
    status       text default 'done',
    markdown     text,
    json_doc     jsonb,
    prompt_hash  text,
    model        text,
    duration_ms  int,
    created_at   timestamptz default now()
);

CREATE TABLE IF NOT EXISTS wm.bg_report_sources (
    report_id bigint references wm.bg_reports(id) on delete cascade,
    seq       int,
    kind      text,
    title     text,
    url       text,
    fetched_at timestamptz default now(),
    primary key (report_id, seq)
);

-- 源健康
CREATE TABLE IF NOT EXISTS wm.source_health (
    source         text primary key,
    last_ok_at     timestamptz,
    last_err_at    timestamptz,
    last_err       text,
    success_ratio  real,
    avg_latency_ms int
);
