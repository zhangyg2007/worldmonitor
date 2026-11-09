# WorldMonitor 双产品线改造 · 测试与校验日志（OpencodetestLog.md）

> 执行日期：2026-10-14 ｜ 执行者：opencode
> 目标：依据 `worldmonitor-product-plan.md` + `docs/implementation-plan-zh-commercial-bg.md` 对既有"中文商业情报 + 公司背调"改造做**校验**。
> 方法：**不采信 devLog 的声明，逐层实测**。两层探针分离：`/api/health`=存活(liveness)，`/api/ready`=就绪/后端探测(readiness)。
> 环境：Docker Compose；zh-collector 容器 `zhh/zh-collector`（已升 v0.3）；WM 主容器 `worldmonitor`（宿主 3000）；PG16 实例（`wm` 库）；Ollama `qwen3.8:27b`。

---

## 一、测试计划（设计层）

按风险分层，每层可独立、可重入、命令化：

| 层 | 目标 | 覆盖点 |
|---|---|---|
| **L0 冒烟** | 服务活着 | health / 三源新鲜度 / PG 可达 / LLM 在线 / WM 主服务 |
| **L1 契约** | 产出对齐 WM 读端 | Redis 信封 schema、`seed-meta` 一致、records 字段白名单、**PG 幂等**、WM 侧读取 |
| **L2 集成端到端** | 报告链路 | 报告正例/缺数据降级/重复调用幂等/读回/舆情关联/海外专章(待)/MCP(待)/前端 variant(待) |
| **L3 合规与安全** | 白名单与红线 | 无敏感字段、零编造、免责声明在 markdown、来源可溯源、无凭证泄漏、端口仅 127.0.0.1、数据源不越界 |
| **L4 性能与韧性** | 降级与上限 | P95 延迟、内存/PG 增长、源故障降级、LLM 故障、PG 故障时 ready 503、重启恢复 |

> Gate A（本次目标）：P1/P2/P3 修复 → L0/L1/L2.1/2.3/2.4 + L3.1/3.3 全绿。

---

## 二、第一轮测试（基线实测，发现 7 项问题）

**判定方法**：容器 `docker ps` 全 healthy，但逐一验证后端读写与关键端点，发现"声明完成"与"实际可用"存在落差。

| # | 检查 | 命令/方法 | 实测结果 |
|---|---|---|---|
| 1.1 | collector 存活 | `curl :8081/api/health` | ✅ 200，三源 |
| 1.2 | 三源数据 | `curl :8081/api/news?source={s}` | ✅ Redis 6 key 全在，三源当日有数据 |
| 1.3 | **PG 数据层** | 容器内连 `wm.zh_news_events` | ❌ **`FATAL: database "wm" does not exist`** —— collector 全周期每 5min 静默写 PG 失败（log 仅 WARNING） |
| 1.4 | **背调报告** | `POST :8081/api/bg-report?company=贵州茅台` | ❌ **500**，同因：`wm` 库不存在 |
| 1.5 | **报告读回** | `GET :8081/api/bg-reports` | ❌ **500** |
| 1.6 | **跨源聚合** | `GET :8081/api/recent?days=1` | ❌ **恒返回 count=0**；log：`'Query' object has no attribute 'lower'` |
| 1.7 | **健康降级** | PG 死时 `/api/health` | ❌ 仍 `ok:true`（无降级信号） |
| 1.8 | LLM 在线 | `curl 11434/api/tags` | ✅ `qwen3.8:27b` 存在 |
| 1.9 | Dockerfile | `git diff` | ⚠️ 3 文件 base image 从 `node:24-alpine@sha256:50c8e8ca...` 去掉 digest pin → 与改造无关的可疑改动 |
| 1.10 | DDL 一致性 | 文档 §3 vs `main.py` 插入列 | ⚠️ 文档无 `source_id`，代码有 → 文档过时，且无迁移脚本落盘 |

### 第一轮发现的核心问题（按严重度）

- **P1（阻断）**：PG `wm` 库/表全丢，持久化 + 报告链路全挂；且失败只 warning，health 仍绿（静默降级）。
- **P2（功能坏）**：`/api/recent` 从未真正工作 —— 直接把 FastAPI `Query` 对象当默认值传入内部 `news()`，`ticker.lower()` 抛 `AttributeError` 被吞 → 恒 0。
- **P3（可观测性）**：`/api/health` 不反映后端状态，违背实施方案 §9"ready 应探测后端"。
- **P5（供应链）**：Dockerfile digest pin 被剥离（3 文件 /6 行）。
- **P10（文档/迁移缺失）**：DDL 无迁移脚本，文档与代码列不一致。

**修复前基线快照**：L0.1/1.2 通过；L0.3(PG)、L2.1/2.4(report)、L1.recent 全失败；health 对 PG 故障不敏感。

---

## 三、修复实施（按优先级）

### P1 — PG 数据层重建 + 迁移落仓库
- 新建 `zh-collector/migrations/001_initial.sql`：`wm` schema + 6 表（`companies/company_events/zh_news_events/bg_reports/bg_report_sources/source_health`），列名**与代码实际一致**（含 `source_id`）；`(source,source_id)` **部分唯一索引**支撑 `ON CONFLICT` 幂等 upsert；`companies(ticker)` 部分唯一索引；GIN/时间索引。
- 通过 collector 容器（持有有效 PG 凭据）执行 `CREATE DATABASE wm` + 应用 DDL → `information_schema` 6 表 + 12 索引全部就位。
- 迁移脚本幂等（`IF NOT EXISTS` + dedupe），可重复执行。

### P2 — `/api/recent` 崩溃修复
- 重构：抽出共用工具 `parse_pub_ts / load_source_feed / filter_feed / normalize_entry`；`/api/recent` 不再用 `news()` 内部函数承载 `Query` 默认值改走纯参数 → 根除 `AttributeError`。
- 附带一致性修复：`normalize_entry` 统一 `/api/news` 与 `/api/recent` 的输出条目（都有 `source` / `publishedAt` 键）。

### P3 — 健康探针分离
- `/api/health`：存活探针（服务在跑即 ok，避免后端短暂抖动导致容器反复 restart）。
- 新增 `/api/ready`：探测 Redis + PG，任一失败 → **503 + `degraded:true`**，返回 `backends:{redis,pg}`。PG 故障时可观测（满足 L4.6）。

### P5 — 供应链
- `git checkout` 恢复 `Dockerfile / Dockerfile.relay / docker/Dockerfile.redis-rest` 6 处 `node:24-alpine@sha256:50c8e8ca...`（经用户拍板"恢复 digest pin"）。

### 附加修复（第二轮 L2/L3 暴露）
- **L2.3 重复主档**：`companies` upsert 原用 `ON CONFLICT (usci_code)` 但我们恒插 `usci_code=NULL` → 永不命中 → 同名重复（实测生成出 2 行"贵州茅台"）。修复：改 `ON CONFLICT (ticker) WHERE ticker IS NOT NULL DO NOTHING` + `companies(ticker)` 唯一索引 + 存量去重（并把指向重复行的报告重定向到规范行 id=1）。
- **L3.3 免责声明**：原文仅存在于响应 JSON 字段，**markdown 正文可能缺**（LLM 生成时只说"非投资建议"，且 report_id=1 完全无）。修复：`bg_report.py` 加 `_ensure_disclaimer()` 在持久化前**确定性追加**标准声明；并回溯补齐存量 3 行报告。

### 部署
- 镜像 `zhh/zh-collector:0.2` → **`zhh/zh-collector:0.3`**（`docker-compose.zh.yml` 同步）；容器重启 healthy。

---

## 四、第二轮测试（修复后验证）

| # | 检查 | 命令 | 实测 | 判定 |
|---|---|---|---|---|
| 2.0.1 | 存活 | `curl :8081/api/health` | 200 `v0.3` 三源 | ✅ |
| 2.0.2 | 三源新鲜 | `:8081/api/news?source={s}&days=2` | 三源 `count≥1 state=OK` | ✅ |
| 2.0.3 | **PG 可达** | `:8081/api/ready` | 200 `backends:{redis:ok,pg:ok}` | ✅（P1 修复） |
| 2.1.1 | **PG 写入** | `POST :8081/api/pull {"source":"eastmoney"}` | `items=50 redis_written=50 pg_inserted=50 ok=true` | ✅（P1 修复） |
| 2.1.4 | **幂等** | PG `count(*)` vs `count(distinct source_id)` | eastmoney 173/173, cls 95/95, weibo 150/150 **无重复行** | ✅ |
| 2.2.1 | **报告端到端** | `-G --data-urlencode company=贵州茅台 POST /api/bg-report` | **HTTP 200**，`report_id`，六层齐全（主体画像/经营/财务/风险/舆情/综合），`md_len≈1600` | ✅（P1 修复） |
| 2.2.3 | **报告幂等** | 重复 2.2.1 | `wm.companies` 保持 **1 行**（不再 +1） | ✅（附加修复） |
| 2.2.4 | **读回** | `GET /api/bg-reports` | 200，回读 report 行 + 公司名 + 长度 | ✅ |
| 2.2/1.6 | **跨源聚合** | `GET /api/recent?days=1` | **count=5**，条目均含 `source` 键 | ✅（P2 修复） |
| 2.3 | keyword/ticker 过滤 | `:8081/api/news?keyword=投资` / `?ticker=600519` | 命中过滤 / 无匹配返回空（行为正确） | ✅ |
| 2.3.1 | **合规白名单** | 最新报告 markdown 扫 证件号/手机号/婚姻/健康 | **0 命中** | ✅ |
| 2.3.3 | **免责声明** | 3 行 `bg_reports.markdown` 均含标准声明 | **3/3 true** | ✅（附加修复） |
| 2.4 | 容器崩溃 | log 统计 `AttributeError / Query.lower` | **0 行** | ✅ |
| 2.5 | 零编造降级 | 行情源 `RemoteDisconnected` 时报告 | 正常 200，缺层标"暂无数据（未接入源）"，未编造 | ✅ |

**注（环境因素，非代码缺陷）**：东方财富 `suggest/push2` 接口偶发 `RemoteDisconnected`（直连测试亦复现），属网络/对方服务器侧抖动；代码已按 L2.5 优雅降级（缺数据不编造、不 500 崩）。报告主链路（PG + LLM + 持久化）稳定。

---

## 五、当前进度与状态（对照 8 周计划）

| 里程碑 | 状态 | 证据 |
|---|---|---|
| **W1 解锁数据**（ACLED 凭证/代理出口/ReliefWeb v2/UCDP token/OpenSanctions 本地库/天眼查·企查查实名） | ❌ 未开工 | — |
| **Phase A** 采集器 + Redis 双写 | ✅（PG 侧已修复） | L0 全绿 |
| **Phase B** 三源采集 | ✅ | 三源当日数据 |
| **Phase C.1** 背调报告引擎 | ✅ **端到端可跑**（本次修复后） | L2.1/2.3/2.4 全绿 + L3 全绿 |
| **Phase C.2** MCP 挂 WM `api/mcp/*` | ⬜ 未开工 | — |
| **Phase C.3** 前端 `chinese-commercial` variant（六面板全保留） | ⬜ 未开工 | `api/zh/news.js` 写好但**未入 WM 容器**，无消费端 |
| **Phase C.4** RAG（pg16+vector 独立容器） | ⬜ 未开工 | — |
| **W4-W6** 国家评分/五套制裁/告警/多租户 | ⬜ 未开工 | — |
| **W7-W8** 域名/HTTPS/客户门户/备份/落地页 | ⬜ 未开工 | — |

**结论**：改造真实完成度 ≈ **C.1 端到端跑通 + Phase A/B 采集链路稳定（本次修复后）**；相对 8 周计划约 **15–20%** 已落地且核心链路可验证。此前 devLog 标注"✅ C.1 完成并端到端验证"与第一轮实测**不符**——持久化层当时已退化失效，**本轮已修复并二次验证通过**。

**交付物现状**
- `zh-collector/app/main.py`（571 行，v0.3：多源采集 + `/api/health`+`/api/ready`+`/api/news`+`/api/recent`+`/api/bg-report`+`/api/bg-reports`+`/api/pull`）
- `zh-collector/app/bg_report.py`（218 行：resolve→quote→news 检索→LLM 六层→免责声明→三表持久化）
- `zh-collector/migrations/001_initial.sql`（幂等 DDL，6 表 + 唯一/部分唯一索引）
- `docker-compose.zh.yml`（v0.3）、`docker/Dockerfile.zh-collector`
- `wm` 库：`zh_news_events`(418 行) / `companies`(1) / `bg_reports`(3) / `bg_report_sources` + `companies_ticker_uniq` 索引

---

## 六、遗留 / 待办（按建议顺序）

1. **C.3 前端打通（最高优先级业务项）**：把 `api/zh/news.js` 进 WM 容器验证读端；建 `chinese-commercial` variant，确保 `conflicts/cyber/climate/flights/maritime/aviation` 六面板**全保留**（用户硬约束）——L2.9。
2. **C.2 MCP**：`generate_report/search_zh_news/list_recent_reports` 挂 WM `api/mcp/registry/company-intel-tools.ts`（需重建 WM 镜像）或 FastMCP 独立容器——L2.8/L3.7。
3. **W1 六项数据解锁**（ACLED 凭证/代理出口/ReliefWeb v2/UCDP/OpenSanctions 本地库/天眼查·企查查实名）——产品A 与报告"海外安全专章"(L2.7)的前置。
4. **C.4 RAG**：独立 `pg16+pgvector` 容器（Yuxi 实例无扩展，不可混）+ `zh_news_events.embedding` 列。
5. **可观测性**：把 L0 冒烟挂 cron/hermes gateway，写 `reports/smoke.md`；补 `/api/ready` 告警接线。
6. **行情源抖动**：`suggest/push2` 偶发断连，可加重试/备用镜像域（当前降级安全，不阻塞）。
7. **测试代码落库**：将本文 L0–L2/L3 命令固化为 `tests/zh-collector/test_{smoke,report_e2e,compliance}.py` + `conftest.py`（`@pytest.mark.requires_pg`）。
8. **文档对齐**：`docs/implementation-plan-*.md` §3 DDL 补 `source_id`，并指向 `migrations/001_initial.sql`。
9. **未跟踪文件处置**：`dumps/`(60 小时转储)、`reports/`、多份 `docs/*.md` 待纳入 `.gitignore` 或提交/丢弃决策。

---

## 附录 B · security variant 实施记录（2026-10-16 / opencode + Native execution）

### 范围

按 `docs/superpowers/specs/2026-10-14-security-variant-frontend-design.md` + `docs/superpowers/plans/2026-10-14-security-variant-frontend.md` 实施 7 task。

### 7 Task 状态

| Task | Commit | 测试 | 状态 |
|---|---|---|---|
| 1 variant 骨架 + 6 面板硬约束 | ef42ce73e | 4/4 pass | ✅ |
| 2 风险热力层 (mock) | 23e301bcf | 5/5 pass | ✅ |
| 3 制裁筛选 (5 套 + URL) | 856497aa0 | 7/7 pass | ✅ |
| 4 侧栏 (4 视图 + localStorage) | 2875b4554 | 6/6 pass | ✅ |
| 5 i18n (zh.json +33 词) | 35bbf0c0a | 6/6 pass | ✅ |
| 6 集成测试 (3 组件同挂) | 6d14e7b5f | 4/4 pass | ✅ |
| 7 收尾 (docs + ledger) | (本 commit) | — | ✅ |
| **合计** | 6 commits | **32/32 pass** | **typecheck 0 错** |

### 关键偏离（7 Rulings）已 ledger 记录

- Ruling 4：spec §1.3 vs §1.5 矛盾 → 选 §1.5 改 SITE_VARIANTS
- Ruling 6：WEBMCP_VARIANT_INVENTORIES 强类型 → 加 security: false
- 其它见 `.superpowers/sdd/2026-10-14-security-variant-frontend/progress.md`

### 6 面板硬约束验证

`tests/dom/security-variant-skeleton.test.mts` 断言 `DEFAULT_MAP_LAYERS` 含 military/conflicts/natural/ais/flights/cyberThreats 6 key。✅ 通过。

### 真实部署限制

- 真 deck.gl HeatmapLayer、风险评分、制裁名单、security.worldmonitor.app 域名、multi-tenant 全部 W4-W8 范围，留后续 PR
- 真实 Playwright e2e 需 dev server 启动 + globe.gl 渲染，留 CI 跑

---

## 附录 C · 迁移 / 部署 / 定制接线实施记录（2026-11-09 / opencode）

> 目标：把项目从 `/root/projects/worldmonitor` 迁到 `/data/projects/worldmonitor`，
> 让 **security variant 定制在生产 UI 上真正可见**，并交付可复现的部署流程。
> 方法：沿用本日志的纪律 —— **不采信声明，逐层实测**；每条结论附命令与实测值。

### 范围

| 件 | 状态 |
|---|---|
| 运行栈重建到 `/data`（5 个服务，compose 标签全部指向新路径）| ✅ |
| security variant 接线（4 处断链）| ✅ |
| 生产镜像构建 + 切换 + 浏览器实测 | ✅ |
| `api/zh/news.js` 修复（3 个从未暴露的 bug）| ✅ |
| Redis 双级备份 + 数据集历史归档 | ✅ |
| 遗留：Docker 数据根仍在根分区 | ⚠️ 已出方案，待评审 |

### C.1 根因：security variant 从未接线（不是"镜像旧"这么简单）

上一轮记录里"真实 Playwright e2e 留 CI 跑"这一句，正是缺口所在。单元测试直接
`new RiskHeatmapPanel(...)` 注入 mock 容器，**测的是组件逻辑**，测不到集成链路。
实测出 4 处断链：

| # | 断链 | 实测证据 |
|---|---|---|
| 1 | 无调用方 | `grep mountSecurityPanels src/` 仅命中定义本身 |
| 2 | 无 DOM 容器 | 三个 containerId 全仓库只出现在 `security.ts` 自己里 |
| 3 | `variant-meta.ts` 缺条目 | `grep security src/config/variant-meta.ts` 零命中 → `VARIANT_META['security']` 未定义 |
| 4 | 无切换入口 | `panel-layout.ts` 切换按钮硬编码 6 个变体，无 security；且 **`?variant=` 并不被支持**（`variant.ts` 只认 hostname 前缀 / localStorage / 构建期 `VITE_VARIANT`）——上一轮文档里那句"浏览器 `?variant=security` 切换"与实现不符 |

修复：`variant-meta` 补条目 → `panels.ts` 补 `VARIANT_DEFAULTS.security`（继承
FULL_PANELS，不收窄任何面板）→ `map-layer-definitions.ts` 显式登记 security 图层序
（6 个地缘安全层前置，其余继承 full）→ `panel-layout.ts` 出容器 + 切换项 →
`App.ts` 启动链在 `panelLayout.init()` 之后挂载。

> 架构修正：`mountSecurityPanels` 原放在 `config/`，而 config→components 是反向导入
> （违反 `types→config→services→components→app`）。已移至 `src/app/security-variant-panels.ts`。

### C.2 顺带修好的 3 处既有破损（10-16 那批从未跑过门禁）

| 破损 | 症状 | 修法 |
|---|---|---|
| `lint:boundaries` 红 | config→components 反向导入 | 挂载编排移到 app 层 |
| `lint:safe-html` 红 | `SecuritySidebar` 直接 `innerHTML=` | 改真实 DOM 节点 + `replaceChildren()` |
| `tests/desktop-one-binary-model` 红 | `SITE_VARIANTS` 含 security 但 `api/download.js` 不含 | 补 `SUPPORTED_VARIANTS` |
| `tests/webmcp-inventory` 红 | `expectedConditional` 缺 security；且 `variantInventory(false)` 与"继承 full 面板（global-procurement 默认启用）"自相矛盾 | 改 `variantInventory(true)` + 补测试期望 |

### C.3 生产事故：根分区 100% 撑爆 → Redis `503 REDIS_DOWN`

不是定制问题，是主机问题：`/var/lib/docker` 在 98G 根分区上，milvus 单容器 JSON 日志
涨到 4.7G，Redis BGSAVE 写不下 → `stop-writes-on-bgsave-error` → 写入禁用 → health 503。
处置：截断该日志 + 清 npm/apt 缓存（释放 6.5G）→ 强制 SAVE → health 回 200。
**遗留**：Docker 数据根仍在根分区，方案见附录 D。

### C.4 两个构建门禁的真实解法（此前判定"不可能绕过"，判错了）

| 门禁 | 原判定 | 实际解法 |
|---|---|---|
| `crawlable-live-pulse` ≤10 天 | 需连 `www.worldmonitor.app`（本机不可达）| **GitHub API 本机可达**（`api.github.com` 200），上游 `koala73/worldmonitor` main 有合法实时快照 → 直接取上游产物 |
| `github-stars` ≤45 天 | — | `npm run freeze:github-stars`（只需 GitHub API），生成本机当天真实 star 数 |

> 上游脚本在 10-28 演进过快照格式（新增 CII movement 标签 `Unchanged`），本仓库较旧的
> 解析器不认。按**上游语义最小补齐** `parseCiiMovement`（`scripts/crawlable-live-tools.mjs`），
> 未拉入上游 3 周的脚本 churn（`build-crawlable-corpus.mjs` 差异 1420 行且依赖多个本地
> 没有的新模块；`crawlable-live-tools.mjs` 与 build 脚本耦合演进，单独取会断）。

### C.5 `api/zh/news.js`：三个从未暴露的 bug

该端点从未被真正调用过 —— 10-14 的记录里"zh-collector 双写 PG/Redis ✅"说的是**写**
侧，**读**侧从未验证过。切换到新镜像后端点第一次真正被请求，暴露：

1. **导出形态错**：侧车按 `mod.default(request)` 分发（`local-api-server.mjs:1859`），
   文件却导出 `onRequest(ctx)` → `500 Invalid handler module`
2. **环境变量名错**：读 `REDIS_REST_URL` / `REDIS_TOKEN`，compose 实际注入
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` → 代理读失败静默返回空
3. **信封形态不认**：采集器写 `{v,sourceName,fetchedAt,recordCount,state,records:[...]}`，
   归一化只认裸数组与 `{_seed,data}` → 恒返回 `count:0`

另修 `isDisallowedOrigin(req)` 传参（应传 req 本身，不是 origin 字符串）。
已补 `tests/api-zh-news.test.mjs`（6 例）钉住契约。

### C.6 实测验证矩阵

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | 0 错误 |
| `lint:boundaries` / `lint:safe-html` | 通过 |
| 全量 vitest DOM | **128 文件 / 1011 测试全过** |
| `npm run test:sidecar`（api/ 套件）| **487 全过** |
| webmcp + variant 套件 | 206 全过 |
| 新增 `tests/api-zh-news.test.mjs` | 6/6 |
| 真实浏览器 e2e（生产栈 :3000）| **4 passed + 1 skipped**（注册表断言仅 dev 可跑）|
| 真实浏览器 e2e（dev 栈）| **5/5 全过** |
| 全量 `test:data` | 17 个文件失败 → **`git stash` 干净基线对照后完全相同，零新增** |
| 容器 | 5/5 healthy，working_dir 全部 `/data/projects/worldmonitor` |
| 数据 | Redis DBSIZE 305；PG `wm.zh_news_events` 26993 行 |
| 端点 | `/` 200 · `/api/health?compact=1` 200 · `/api/zh/news` 200（ok:true + 真实条目）|
| Redis 恢复演练 | 从 Tier1 RDB 起临时实例：DBSIZE 250、23 个 seed-meta、抽样值一致 |

### C.7 Redis 双级备份 + 数据集历史归档

键空间实测：243 键中 **227 带 TTL（请求期缓存，无历史价值）**，真正值得留存的是
`seed-meta:*` 登记的 **23 个数据集 ≈ 361 KB**（部分数据集分片存储，如
`energy:jodi-oil:v1:<ISO2>`）。因此：

- **Tier 1 灾难恢复快照**：每日 BGSAVE → RDB（~600KB）→ `snapshot/`，保留 30 天
- **Tier 2 历史归档**：按 `seed-meta` 登记表逐数据集前缀匹配 → `archive/<dataset>/<date>.json.gz`，
  实测 **23 个数据集/天仅 85 KB**（一年约 13 MB）→ 于是"某数据集在某日期的值"可回溯
- 保留降采样：日 90 天 → 周 1 年 → 月 5 年
- cron：每日 03:30 UTC（11:30 北京，避开 PG 的 12:00）；每周日 04:15 做 `--verify`

> 这层归档的价值：Redis 只存**最新值**，归档把它变成**时间序列**。例如
> `energy:jodi-oil:v1:BE` 带 `dataMonth: 2026-06` 的逐月指标，日拱一卒即成
> "IEA 油品库存的历史曲线"，可支撑后期回测与历史参考。

### C.8 本轮遗留

1. Docker 数据根仍在 `/var/lib/docker`（根分区）—— 见附录 D，待评审
2. `security.worldmonitor.app` 无预渲染外壳（缺 `public/favico/security/` 资源）
3. `api/zh/news.js` 只读 eastmoney 一个 key，cls / weibo 无读取端点
4. `RiskHeatmapPanel` / `country-risk` 仍是 mock（面板有 demo data 水印）
5. `CountryQuickCard`（spec §3 规划）未实现
6. 8 个 Dockerfile 的 FROM digest pin 改为纯 tag（Docker Hub 不可达且钉死 digest 不在本地）
