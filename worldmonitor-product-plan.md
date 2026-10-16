# WorldMonitor 双产品线改造总方案 v1.0
日期：2026-09-23 ｜ 基线：/root/projects/worldmonitor（fork koala73，Docker Compose 运行中）
产品A：海外业务安全咨询（基于 WM 地缘安全数据，保留军事冲突数据 = 硬约束✅）
产品B：本地公司背景调查（工商/司法/关联 + 海外安全专章融合）

调研底稿：
- /root/overseas-security-consulting-research.md（海外安全：数据源实测+竞品+合规）
- /root/local-due-diligence-research.md（背调：API 价格+判例红线+产品对标）
- /opt/worldmonitor-upgrade-plan/（原始 12 章改造文档，11 个 md，审核结论见会话记录）

═══════════════════════════════════════
一、现状盘点（已逐项核实）
═══════════════════════════════════════
✅ WM 可复用资产（代码级确认）
- 17 个安全数据族 API：military/conflict/unrest/sanctions/security/cyber/climate/
  resilience/supply-chain/aviation/maritime/displacement/seismology/wildfire/
  infrastructure/thermal
- ACLED 链路：server/_shared/acled.ts + acled-auth.ts（OAuth 自动续签）、
  conflict/v1/list-acled-events.ts（15min 缓存、优雅降级）
- 制裁筛查：server/worldmonitor/sanctions/v1/lookup-entity.ts（OpenSanctions 主+兜底链）
- 评分框架：scorecard/v1 五因子 + resilience/v1 维度评分器（国别风险模型骨架）
- UCDP：conflict/v1/list-ucdp-events.ts
- Agent 层：api/ask.ts、api/a2a.ts、api/chat-analyst.ts、api/mcp/（含冲突事件面板）
- LLM 已接宿主机 Ollama qwen3.8:27b（docker-compose.override.yml）
- 基础设施：postgres16(:5432,db=yuxi)、neo4j(:7474,空,可建股权图谱)、
  milvus(:19530)、ES8.19(:9200)、redis7(:6379,无密码)、WM 独立 redis（密码,256MB LRU）

❌ 现有缺口/风险
1. **ACLED 凭证为空**（.env 三项已核实为空）——军事数据当前是"代码就绪、无数据"
2. **网络分段出境**：GDELT/HumData/FRED/treasury.gov 全超时；acleddata.com 403；
   OpenSanctions/UCDP/WorldBank/UNHCR/OpenCorporates/Finnhub 可达
3. **ReliefWeb v1 已 410 Gone**，2026 Q1 全关 → climate/security 面板依赖它，不修会停摆
4. 背调：WM 无企业数据能力（全新增），但中文源可达、neo4j 现成
5. 单租户：WM 无 tenant 隔离 → 产品化必须加
6. 无对外 HTTPS/域名：当前仅 localhost:3000

═══════════════════════════════════════
二、合规红线（不可逾越，决定产品形态）
═══════════════════════════════════════
【海外安全产品】
- ACLED EULA：禁止转售原始数据 → 只卖"分析结论+告警服务"；商用需 Commercial License
- OpenSanctions：CC BY-NC / 商用 0.10€/query 或数据许可买断
- 五套制裁名单同筛（OFAC/EU/UN/UK/中国）= 差异化卖点，MOFCOM 61 号文建中国 50% 规则
- 海外员工行程 = 敏感个人信息（PIPL），需 PIA + 单独同意；建议存境外节点，境内留脱敏结论
【背调产品】
- **严禁爬** 天眼查/企查查/裁判文书网：2025 新反法 13 条 3 款"数据专条"（避开技术
  管理措施=不正当）、最高院 262-267 号指导性案例、全国爬取案件 260+/刑事 70+
- **走官方 API 购买**：天眼查开放平台（239 接口，组合包 1.0-1.5/次）、
  企查查开放平台（167 API，需企业实名+应用场景审核）→ 数据源合法
- 自然人信息最小化：只展示姓名+职务+涉诉角色，不展证件号/手机号
- 数据时效义务：错误/失实风险标签 = 高危（企查查诉蚂蚁、天眼查失信人未更新判例）
  → 报告必须可溯源（案号/URL）+ 定期刷新

═══════════════════════════════════════
三、统一技术架构
═══════════════════════════════════════
                        ┌─────────────────────────────────────┐
 [海外源]               │        数据接入层（WM seed 链路）       │
 ACLED(OAuth)──┐        │  现有 seed-*.mjs + 新增 collector      │
 UCDP(token)───┤        │  ─────────────────────────────────     │
 OpenSanctions─┤  ┌────▶│  A线: 冲突/制裁/气候/流离失所/舆情      │
 ReliefWeb v2──┤  │     │  B线: 天眼查/企查查 API（Python, 独立容器）│
 WorldBank/UNHCR─┘ │    └────┬───────────────────────────┘
                    │         ▼
 代理出口(新加坡/日本)│   ┌────────────────┐     ┌──────────────┐
 GDELT/HDX/FRED  ◀──┘   │ 统一事件/实体模型 │ ──▶ │ 评分引擎       │
 (HTTPS_PROXY 注入)      │ postgres16 新库  │     │ 复用 scorecard/ │
                         │   + neo4j 股权图 │     │ resilience 框架 │
                         └────────────────┘     └──────┬───────┘
                                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │ 报告/Agent 引擎：WM api/ask.ts + MCP + 本地    │
                    │ Ollama(长报告) / DeepSeek(快) 双客户端          │
                    │ 产品A 报告：国别安全评估 + 制裁筛查 + 告警订阅   │
                    │ 产品B 报告：工商/司法/关联 + §4 海外安全专章     │
                    └─────────────────────────────────────────────┘

存储分配：
- postgres16：新建 db（产品名待定）：conflict_events / sanctions / due_diligence
  （背调）三族表；向量若需要走 milvus（避免动共享 PG 扩展）
- neo4j：股权/实控人/关联图谱（zzp1012/neo4j-enterprise-KG 算法）
- WM 自有 redis：不动（seed-meta 契约），新服务用独立 redis 实例带密码

═══════════════════════════════════════
四、里程碑（按周）
═══════════════════════════════════════
【W1 — 解锁数据】
 1. 补 ACLED 凭证（用户提供）→ 实测 acleddata.com API 拉通
 2. 定代理出口（新加坡节点/现有 VPS），seed worker 层注入 HTTPS_PROXY
 3. ReliefWeb v2 appname 申请（P0，否则气候面板停摆）+ v1→v2 迁移
 4. UCDP token 申请（邮件，3-5 工作日）
 5. OpenSanctions 批量文件下载 → 本地制裁库（MVP 免费起步）
 6. 背调：天眼查+企查查开放平台注册企业实名、申报场景、开通工商包/司法包

【W2-W3 — 产品B 单份报告跑通（最快出 Demo）】
 1. 背调 collector（天眼查主+企查查交叉核验）→ postgres
 2. neo4j 股权图谱 + 实控人穿透
 3. 尽调报告引擎（qcc 专业版 5 级目录对标 + §4 海外安全专章接 WM 冲突流）
 4. 单份报告端到端 Demo（目标：输入公司名 → 10 分钟内出 PDF）
 数据成本 ~3 元/份；定价对标 500-2000 元/份毛利

【W4-W6 — 产品A 单国别报告 + 告警】
 1. 国别风险评分引擎（复用 scorecard 权重改造：安全=ACLED/UCDP 事件密度、
    制裁=OpenSanctions 命中、经济=WorldBank、流离失所=UNHCR、舆情=GDELT）
 2. 五套制裁筛选器 UI + 50% 规则穿透（OpenSanctions+OpenCorporates）
 3. 告警引擎：冲突新事件/制裁新增名单 → 微信/邮件（复用现有 relay:3004）
 4. 多租户 tenant_id 中间件

【W7-W8 — 产品化】
 1. 域名 + HTTPS（挂到 WM 现有镜像内 nginx）
 2. 客户门户：中文化（WM zh.json 706 条已有，补金融/安全术语）
 3. 监控告警 + 备份（postgres/redis/图谱三件套）
 4. 两份产品 Demo 视频 + 官网落地页

═══════════════════════════════════════
五、待用户拍板的决策
═══════════════════════════════════════
D1. ACLED 商业许可：免费档 3 次下载/年够演示；正式商用需谈 License
    （EULA 禁转售，价格面议）→ 你走采购还是我来起草联系函？
D2. 代理出口：现有可用 VPS/代理？还是新开腾讯云新加坡节点（~¥200-400/月）？
D3. 背调数据商：主推天眼查（司法厚度最强、银行偏好）+ 企查查交叉核验？
    还是双主用（成本翻倍但抗一家断供）？
D4. 产品 B 主体：用哪个公司营业执照注册开放平台企业实名？
D5. 报告引擎：全走 WM 原生 TS（api/ask.ts + MCP 扩工具）还是独立 Python
    报告服务？——建议 B 线 collector 用 Python 容器（生态现成），
    报告编排走 WM MCP 工具（复用鉴权/限流/缓存）

═══════════════════════════════════════
六、原 12 章文档处置（已审核）
═══════════════════════════════════════
- 第1章：处置表中 ACLED/UCDP"GDELT/FRED/Finnhub 删掉" → 全部改"保留"（硬约束）
- 第2章：跳过 2.1-2.5 开机器；备份脚本改造后可用
- 第3章：PostHog 不存在（跳过）；React 组件代码需重写为 Vanilla TS；
  Google Fonts 引用清理可用
- 第4章：LLM 双客户端设计可用，修 async-redis bug + 模型名（qwen3.8:27b）
- 第5章：SQL/HNSW 设计可用；改现有 postgres16 建库（或向量走 milvus）
- 第6章：财联社/微博/AKShare 可用；同花顺接口不可行、雪球 CDP 弃
- 第7章：文档缺失（断链）→ 本方案"报告引擎"一节替代
- 第8章：FastMCP 独立服务弃（WM 已有完整 MCP），改在 api/mcp/registry 加金融工具
- 第9章：i18n 已有 zh（706 条零缺失）只校对不重写；高德瓦片弃（保 PMTiles）
- 第10章：SSE/WS 反代片段抄进 WM nginx；不套第二层 nginx
- 第11章：飞书签名 bug 修（hmac.new 参数反了）；用 Hermes cron 替代 APScheduler
- 第12章：最后做 Demo+README
