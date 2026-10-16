# WorldMonitor 定制部署 · 开发日志（devLog.md）

> 最后更新：2026-09-24 15:20（关机前快照）
> 会话 ID：`20260924_032825_73bd15`（可用 `session_search` 恢复完整上下文）
> 项目根：`/root/projects/worldmonitor/`

---

## 一、总体进度

| Phase | 内容 | 状态 |
|---|---|---|
| A | 东财快讯采集器（PG+Redis 双写，容器化） | ✅ 完成并端到端验证 |
| B | 多源扩展：财联社(akshare) + 微博热搜，幂等去重 | ✅ 完成并三源全通验证 |
| C.1 | 企业背调报告引擎 bg_report.py + API 端点 | ✅ 完成（真实 LLM 跑通 23.7s） |
| C.2 | MCP 工具挂 WM 自带 `api/mcp/*` | ⬜ 未开工（重启后第 1 优先） |
| C.3 | 前端 `chinese-commercial` variant + 面板全保留 | ⬜ 未开工 |
| C.4 | RAG：pg16+vector 独立容器 + embedding 列 | ⬜ 未开工 |
| 可选 | 雪球热帖加源（akshare `stock_hot_rank_xq`） | ⬜ 未开工 |

架构决策（用户 2026-09-24 拍板）：
1. **军事/冲突/网络威胁/气候/船舶/航空面板全部保留**（硬约束）
2. RAG 走 PG+pgvector 自建（不用 Yuxi Milvus）
3. 中文采集器 = 独立 Python(akshare) 容器，不进 WM 的 TS seeder 体系
4. MCP 复用 WM 自带 `api/mcp/*`（WM 注册表带配额计费，子代理建议金融工具可用 FastMCP :8001 隔离，C.2 时定）

---

## 二、开机后重启步骤（照做即可）

```bash
# 1. 网络/中间件
docker network ls | grep -E "worldmonitor|baota"   # 两个网络都应在
docker ps | grep -E "postgres|redis"                # Yuxi PG(172.19.0.6) + worldmonitor-redis

# 2. 起 WM 主服务（若未跑）
cd /root/projects/worldmonitor
docker compose up -d                                # worldmonitor 容器（8080? 宿主 3000 端口）

# 3. 起中文采集器
docker compose -f docker-compose.yml -f docker-compose.zh.yml up -d zh-collector

# 4. 健康检查
docker exec zh-collector curl -fsS http://127.0.0.1:8081/api/health
# 期望: {"ok":true,"service":"zh-collector","version":"0.2","sources":["eastmoney","cls","weibo"]}

# 5.（可选）hermes gateway（WorldMonitor 每小时转储 cron 依赖）
hermes gateway run &
```

**停机时已关闭的**：zh-collector 容器、worldmonitor 容器（按用户关机流程）。
数据全部在 PG（Yuxi 实例 `wm` 库）+ WM-redis，容器删了也不丢。

### 快速冒烟测试
```bash
curl 'http://127.0.0.1:8081/api/news?limit=3'
curl 'http://127.0.0.1:8081/api/news?keyword=黄金&days=3'
curl 'http://127.0.0.1:8081/api/bg-reports?limit=5'
curl -X POST 'http://127.0.0.1:8081/api/bg-report?company=贵州茅台&days=30'   # ~25s
```

---

## 三、交付物清单

| 路径 | 说明 |
|---|---|
| `zh-collector/app/main.py` | v0.2 多源采集器（511 行）：eastmoney/cls/weibo 调度 + /api/health、/pull、/news、/flush、/sources、**/bg-report**、**/bg-reports** |
| `zh-collector/app/bg_report.py` | 背调报告引擎（208 行）：resolve→quote→news 检索→LLM 六层报告→三表持久化 |
| `zh-collector/app/__init__.py` | 包 re-export |
| `zh-collector/run.py` / `requirements.txt` | 启动 + 依赖 |
| `docker/Dockerfile.zh-collector` | python:3.12-slim + 清华源 + akshare |
| `docker-compose.zh.yml` | 增量叠加（zh-collector 服务，127.0.0.1:8081，worldmonitor_default 网络） |
| `docs/implementation-plan-zh-commercial-bg.md` | 实施方案（~385 行，A/B/C.1 已标完成+验证） |
| `docs/research/company-bg-check-feasibility.md` | 背调行业可行性报告（209 行，26 来源） |
| `api/zh/news.js` | WM 侧读取端点（162 行，写好但**未** docker cp 进 WM 容器——WM 跑着 8 天不动它，读取走 8081 即可） |
| 镜像 | `zhh/zh-collector:0.2`（含全部代码） |

### 数据库（Yuxi PG 实例，wm 库，7 表）
- `wm.zh_news_events`（含 `source_id` 列 + `(source,source_id)` 部分唯一索引，三源真实数据）
- `wm.companies`（自增 id + name_en 唯一）
- `wm.bg_reports`（id=1 已存茅台报告，company_id FK + report_md + model/duration_ms）
- `wm.bg_report_sources`（编号引用清单）
- 另 3 表（DDL 见实施方案 §4，C.3/C.4 用）
- **红线：绝对不动 `yuxi` 库**

### Redis（worldmonitor-redis，需 REDIS_PASSWORD，.env 里取）
- `zh:news:eastmoney:v1` / `zh:news:cls:v1` / `zh:news:weibo:v1`
- `seed-meta:zh:{source}`（WM envelope 契约）

---

## 四、踩过的坑全记录（18 个，防重犯）

### 代码 bug（容器内实测暴露）
1. **psycopg2 `execute_values`**：`cur.execute("INSERT ... VALUES %s", (sql, args))` 非法 → 必须 `psycopg2.extras.execute_values(cur, sql, args)`
2. **时区字符串**：`showTime.replace(" "," +08:00")` 会替换所有空格 → 改 `pub_ts + " +08:00"` 末尾追加
3. **东财 stocks 字段混杂**（股票代码/浮点价格/板块码混合）→ 统一 `str(x)` 收进 `text[]`
4. **FastAPI `query: dict`** 被当 request body（422）→ 用 `Query(200, ge=1, le=1000)` 显式形参
5. **东财 `req_trace=1` 必需参数**，否则偶发非 200
6. **财联社老 API `telegraphList` 已失效**（需 JS 渲染）→ 改 akshare `ak.stock_info_global_cls()`
7. **akshare 1.18 cls 字段变化**：`日期时间` 单列 → `发布日期`+`发布时间` 两列，需兼容两版
8. **微博 `timezone("+08:00")`** 传字符串报错 → `timezone(timedelta(hours=8))`
9. **`psycopg2.connect(位置参数)` 被当 DSN 解析**报错 → 用 keyword-only（`host=`, `port=`, ...）
10. **`with cursor` 块外再用 cur** → "cursor already closed"，count 查询要放 with 块内

### 环境/工具坑
11. **write_file/patch/execute_code 传输层折叠**：看似重复的字符/长串会被折叠成 `…` 或 `[truncated]` 字面量（曾把 `"web_724"`→`"bi..._724"`、URL 折叠、`pg_conn.cursor(c...` 截断）。**规避：短变量名 + 字符串拼接写可疑长串 + 写完必 grep `truncated|\.\.\.` 复检 + py_compile**
12. **execute_code 内核写入沙箱视图不持久化**（曾写 bg_report.py 后宿主看不到）→ **改代码一律用 write_file/patch/terminal 直写**，execute_code 只做读/查/算
13. **heredoc SQL 被解析器吞**（`d;` 模式）→ 用 execute_code/Python 拼 SQL，psql 走 `-tAc` 短查询
14. **venv 缺 ensurepip** → `pip install --target /tmp/aktlib`（后改容器内 pip 清华源）
15. **`docker exec postgres psql`** -tAc `-tAc "d;e;"` 多语句时 `-t`/`-A` 被吞，只输出一条 → 拆成两条独立 psql 命令
16. **Tirith 安全扫描对复杂管道自动拦截但会 smart-approve**，注意看 `[approval]` 标记确认没被真拦
17. **终端 `| head/tail` 偶尔把结果吞成 1 行** → 输出重定向到文件再 `cat`
18. **bash -lc 不走 nvm**（系统 Node v22 vs nvm v24），CI 类脚本注意

---

## 五、网络拓扑（关键，别搞混）

```
[宿主 127.0.0.1:8081] ◄── zh-collector ──┐
                                         ├── worldmonitor_default 网络
[宿主 3000]          ◄── worldmonitor ───┤
[未发布到宿主]        worldmonitor-redis ──┘   (redis:6379, 需 REDIS_PASSWORD)

[172.19.0.6:5432]    postgres16 (Yuxi 实例, baota_net) ── wm 库 ── 从容器内可达
[172.17.0.1:11434]   Ollama qwen3.8:27b（LLM_API_URL，OpenAI 兼容 /v1/chat/completions）
```

- WM 主容器**不碰 PG/Redis 之外**：WM 本身只有 `UPSTASH_REDIS`(=本地rest) + LLM
- `.env` 变量：`REDIS_PASSWORD`(WM-redis 同密码)、`LLM_API_URL`、`LLM_MODEL`、`LLM_API_KEY`；PG 密码用 `POSTGRES_PASSWORD`（.env 实际名需再核实，verify_stdlib.py 里是 `POSTGRES_PASSWORD` 读出来的）

## 六、API 契约速查
- 东财快讯：`https://np-listapi.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_724&fastColumn=102&sortEnd=&pageSize=N&req_trace=1`（零 key）
- 东财报价：`https://push2.eastmoney.com/api/qt/stock/get?secid={secid}&fields=f43,f44,f45,f46,f57,f58,f162,f167,f169,f170`（数值为 100 倍定点，/100 展示）
- 东财解析：suggest API（bg_report.py 的 `EM_SUGGEST_URL` 拼出来的）
- 微博热搜：`https://weibo.com/ajax/side/hotSearch`（top30）
- WM 自带 MCP：`api/mcp/registry/company-intel-tools.ts` 已有 4 个 SEC 公司情报 view，C.2 在此扩

## 七、重启后第 1 优先：Phase C.2 MCP 集成
- WM 注册表 60+ 工具带配额计费（`toolWeight`/`quota.ts`）；重叠可复用工具 5 个（薄封装即可）
- 确需新增：`generate_report`（调 8081 /api/bg-report）、`search_zh_news`（三源检索）、`list_recent_reports`
- 两条路：a) 扩展 `api/mcp/registry/company-intel-tools.ts`（需重建 WM 镜像，会中断 8 天运行）；b) FastMCP 独立容器 :8001（干净但要新加服务）
- 子代理建议 b；但用户已定"复用 WM 自带"，开工前可再确认一次

## 八、其他待办备忘
- finance 变体面板：`src/config/panel-enablement.ts` 的 `VARIANT_PANEL_CONFIGS` 中 finance 变体默认**关闭** conflicts/cyber/climate/flights 图层 → C.3 建 variant 时必须全保留（用户硬约束）
- `src/locales/zh.json` 已有 2850+ 键，336 键未翻译
- pgvector 需独立 `pg16+vector` 容器（Yuxi 实例无扩展，不能混）
- Superpower 技能 15 个已装 `/root/.hermes/skills/superpowers/`
- WorldMonitor 每小时转储：脚本 `/root/projects/worldmonitor/dumps/wm_dump.py`，cron `worldmonitor-hourly-dump`（f7d4d198f426），**依赖 hermes gateway 在跑**，重启后记得 `hermes gateway run &`

## 九、关键参考文件
- 升级计划 11 章：`/opt/worldmonitor-upgrade-plan/`
- WM 契约：`api/_seed-envelope.js`（unwrapEnvelope）
- 子代理总结（3 成 1 败）：`/root/.hermes/cache/delegation/subagent-summary-{0,1,2}-20260924_053603_70*.txt`
- 本会话：`session_search(query='bg_report 茅台', session_id='20260924_032825_73bd15')`
