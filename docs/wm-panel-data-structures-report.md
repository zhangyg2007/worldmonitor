# WorldMonitor 面板 → 业务数据结构完整报告

生成时间：2026-09-17 09:31 UTC

**范围**：worldmonitor 前端全部 164 个组件面板，逐面板映射到后端 API 端点、proto 业务域（sebuf RPC v1），再到该域承载的业务 message 字段级结构。

**数据来源**（全部来自仓库静态代码分析，非运行时抓取）：
- 面板注册与配置：`src/config/panels.ts` 及 `src/components/` 面板组件
- API 端点：`api/` 目录（Vercel Edge / 自包含 JS）与 `server/`
- 业务数据结构：`proto/worldmonitor/*/v1/*.proto`，39 个域、894 个 message、78 个 enum，经 `src/generated/` 客户端反序列化
- 环境/密钥依赖：见 `wm-env-variables.md`（本报告的姊妹文档）

---

## 1. 总览统计

| 指标 | 数量 |
|---|---|
| 组件面板（面板 ID） | 164 |
| proto 业务域 | 39 |
| proto message 总数 | 894 |
| proto enum 总数 | 78 |
| 涉及的独立 API 端点/代理（粗粒度） | 48 |

按 Premium 等级分布：— 145、locked 15、enhanced 4

---

## 2. 面板 → 端点 → 业务域 映射总表（164 面板）

「proto 域」= 该面板数据经 sebuf RPC 客户端反序列化的业务域；「非 proto 源」= 直通上游（RSS 代理、第三方 JSON API 等）未走 proto 契约的数据。

| 面板 ID | 名称 | Premium | API 端点 | proto 业务域 | 非 proto 数据源 | 内容描述 |
|---|---|---|---|---|---|---|
| `positioning-247` | 24/7 Positioning | — | api/market/v1/[rpc].ts | `market` | — | 24/7 global positioning (futures, CFTC, etc.) |
| `digest` | 5 Good Things | — | api/positive-events/v1/[rpc].ts + WORLDMONITOR_API_KEY | `positive_events` | — | 5 Good Things (AI digest) |
| `aaii-sentiment` | AAII Sentiment | — | api/market/v1/[rpc].ts | `market` | — | AAII investor sentiment survey |
| `strategic-posture` | AI Strategic Posture | — | api/intelligence/v1/[rpc].ts | `intelligence` | — | AI military/strategic posture from live news |
| `policy` | AI Policy & Regulation | — | api/news/ | `news` | — | AI policy & regulation news |
| `ai-regulation` | AI Regulation Dashboard | — | api/research/ | `research` | — | AI regulation dashboard |
| `stock-analysis` | Stock Analysis | locked | api/market/v1/[rpc].ts + WORLDMONITOR_API_KEY | `market` | — | AI stock analysis, fundamentals, sentiment |
| `ai-tokens` | AI Tokens | — | api/market/v1/[rpc].ts | `market` | — | AI token prices |
| `daily-market-brief` | Daily Market Brief | locked | api/market/v1/[rpc].ts + WORLDMONITOR_API_KEY | `market` | — | AI-curated daily market brief |
| `market-implications` | AI Market Implications | locked | api/chat-analyst.ts + WORLDMONITOR_API_KEY | — | `chat_analyst` | AI-derived market implications from news |
| `insights` | AI Insights | — | api/chat-analyst.ts, api/ask.ts, api/a2a.ts | — | `a2a`, `ask`, `chat_analyst` | AI-generated cross-panel narrative summaries |
| `latest-brief` | Latest Brief | locked | api/latest-brief.ts | — | `latest_brief` | AI-generated latest geopolitical brief |
| `ai` | AI/ML | — | api/news/ | `news` | — | AI/ML news headlines |
| `africa` | Africa | — | api/news/ | `news` | — | Africa news headlines |
| `asia` | Asia-Pacific | — | api/news/ | `news` | — | Asia-Pacific news headlines |
| `etf-flows` | BTC ETF Tracker | — | api/market/v1/[rpc].ts | `market` | — | BTC / ETH ETF daily flow data |
| `bigmac` | Big Mac Index | — | api/economic/v1/[rpc].ts | `economic` | — | Big Mac Index (PPP) by country/city |
| `cot-positioning` | COT Positioning | — | api/market/v1/[rpc].ts | `market` | — | CFTC COT positioning: managed money, commercials |
| `cii` | Country Instability | enhanced | api/intelligence/v1/[rpc].ts | `intelligence` | — | CI country scores 0-100, deltas, country briefs |
| `fear-greed` | Fear & Greed | — | api/market/v1/[rpc].ts | `market` | — | CNBC / AAII fear & greed index |
| `china-corridors` | China Logistics Corridors | — | api/market/v1/[rpc].ts | `market` | — | China logistics corridors status |
| `defi-tokens` | DeFi Tokens | — | api/market/v1/[rpc].ts | `market` | — | DeFi token prices |
| `oil-inventories` | Oil Inventories | — | api/market/v1/[rpc].ts | `market` | — | EIA / OPEC / API US crude & petroleum inventories |
| `europe` | Europe | — | api/news/ | `news` | — | Europe news headlines |
| `fao-food-price-index` | FAO Food Price Index | — | api/economic/v1/[rpc].ts | `economic` | — | FAO Food Price Index |
| `fx` | FX Rates | — | api/market/v1/[rpc].ts | `market` | — | FX rates by currency pair |
| `liquidity-shifts` | Liquidity Shifts | — | api/economic/v1/[rpc].ts, api/market/v1/[rpc].ts | `economic`, `market` | — | Fed balance sheet & liquidity shifts |
| `gccNews` | GCC Business News | — | api/news/ | `news` | — | GCC business news |
| `gcc-investments` | GCC Investments | — | api/economic/v1/[rpc].ts | `economic` | — | GCC cross-border investments |
| `github` | GitHub Trending | — | api/github/ or /api/research/v1 | `research` | `github` | GitHub trending repos |
| `giving` | Global Giving | — | api/giving/v1/[rpc].ts | `giving` | — | Global Giving / charitable giving data |
| `gulf-economies` | Gulf Economies | — | api/economic/v1/[rpc].ts, api/market/v1/[rpc].ts | `economic`, `market` | — | Gulf state & OPEC macro indicators (GDP, oil revenue, fiscal) |
| `fsi` | Financial Stress | — | api/economic/v1/[rpc].ts | `economic` | — | ICE BofA Global Financial Stress Index |
| `ipo` | IPO & SPAC | — | api/news/ | `news` | — | IPO & SPAC announcements |
| `oref-sirens` | Israel Sirens | locked | api/oref-alerts.js | — | `oref_alerts` | Israeli OEF sirens (live) |
| `latam` | Latin America | — | api/news/ | `news` | — | Latin America news headlines |
| `middleeast` | Middle East | — | api/news/ | `news` | — | Middle East news headlines |
| `nq-catalysts` | NQ Catalysts | — | api/market/v1/[rpc].ts | `market` | — | NQ catalysts / events |
| `nq-news` | NQ News | — | api/news/ | `news` | — | NQ futures news |
| `nq-pulse` | NQ Pulse | — | api/market/v1/[rpc].ts | `market` | — | NQ futures tape pulse |
| `polymarket` | Predictions | — | api/prediction/[rpc].ts | `prediction` | — | Polymarket open markets, shares prices, volumes |
| `producthunt` | Product Hunt | — | api/news/ | `news` | — | Product Hunt launches |
| `progress` | Human Progress | — | api/positive-events/v1/[rpc].ts | `positive_events` | — | SDG / human progress indices |
| `hormuz-tracker` | Hormuz Trade Tracker | — | api/supply-chain/hormuz-tracker.js | `supply_chain` | — | Strait of Hormuz tanker & cargo traffic |
| `telegram-intel` | Telegram Intel | locked | api/telegram-feed.js | — | `telegram_feed` | Telegram intel channel feed |
| `spotlight` | ? | — | api/positive-events/v1/[rpc].ts | `positive_events` | — | Today's Hero (one good story) |
| `toronto-safety` | Toronto Safety | — | api/safety/v1/[rpc].ts | `safety` | — | Toronto traffic/road safety (511 style) |
| `ucdp-events` | UCDP Conflict Events | — | api/conflict/v1/[rpc].ts | `conflict` | — | UCDP conflict event grid |
| `displacement` | UNHCR Displacement | — | api/displacement/v1/[rpc].ts | `displacement` | — | UNHCR refugee displacement flows |
| `national-debt` | Global Debt Clock | — | api/economic/v1/[rpc].ts | `economic` | — | US & other sovereign debt clocks |
| `security-advisories` | Security Advisories | — | api/security/report.js | — | `security` | US State Dept. travel advisories |
| `yield-curve` | Yield Curve | — | api/market/v1/[rpc].ts, api/economic/v1/[rpc].ts | `economic`, `market` | — | US Treasury yield curve across tenors |
| `us` | United States | — | api/news/ | `news` | — | US news headlines |
| `vcblogs` | VC Insights & Essays | — | api/news/ | `news` | — | VC blog & essay feed |
| `disease-outbreaks` | Disease Outbreaks | — | api/safety/v1/[rpc].ts, api/safety/ | `safety` | — | WHO / ProMED disease outbreaks |
| `energy-complex` | Energy Complex | — | api/market/v1/[rpc].ts, api/supply-chain/hormuz-tracker.js | `market`, `supply_chain` | — | WTI, Brent, gas, coal, fuel prices |
| `wsb-ticker-scanner` | WSB Ticker Scanner | locked | api/market/v1/[rpc].ts + WORLDMONITOR_API_KEY | `market` | — | Wall Street Bets ticker scanner |
| `x-intel` | X News Accounts | locked | api/intelligence/v1/[rpc].ts + WORLDMONITOR_API_KEY | `intelligence` | — | X/Twitter news accounts feed |
| `accelerators` | Accelerators & Demo Days | — | api/news/ | `news` | — | accelerators & demo days |
| `satellite-fires` | Fires | — | api/natural/v1/[rpc].ts | `natural` | — | active fires from NASA FIRMS / VIIRS |
| `market-breadth` | Market Breadth | — | api/market/v1/[rpc].ts | `market` | — | advancers/decliners, breadth indicators |
| `energy-risk-overview` | Global Energy Risk Overview | — | api/supply-chain/v1/[rpc].ts | `supply_chain` | — | aggregate energy risk metrics & trends |
| `airline-intel` | Airline Intelligence | — | api/aviation/v1/[rpc].ts | `aviation` | — | airline fleet / route intelligence |
| `other-tokens` | Alt Tokens | — | api/market/v1/[rpc].ts | `market` | — | alt token prices |
| `stock-backtest` | Backtesting | locked | api/market/v1/[rpc].ts + WORLDMONITOR_API_KEY | `market` | — | backtesting results for stock strategy |
| `base-metals` | Base Metals | — | api/market/v1/[rpc].ts | `market` | — | base metals prices (Cu, Zn, Al, etc.) |
| `bonds` | Fixed Income | — | api/market/v1/[rpc].ts | `market` | — | bond prices, yields, treasuries |
| `breakthroughs` | Breakthroughs | — | api/research/ | `research` | — | breakthroughs ticker |
| `centralbanks` | Central Bank Watch | — | api/market/v1/[rpc].ts, api/economic/v1/[rpc].ts | `economic`, `market` | — | central bank decisions & yields |
| `threat-timeline` | Threat Timeline | — | api/intelligence/v1/[rpc].ts | `intelligence` | — | chronological threat escalation events |
| `climate-news` | Climate News | — | api/news/ | `news` | — | climate & environment news |
| `climate` | Climate Anomalies | — | api/climate/v1/[rpc].ts | `climate` | — | climate anomalies (HDD/CDD, temp) |
| `cloud` | Cloud & Infrastructure | — | api/news/ | `news` | — | cloud & infrastructure news |
| `commodities-news` | Commodities News | — | api/news/ | `news` | — | commodities news |
| `commodity-news` | Commodity News | — | api/news/ | `news` | — | commodity news |
| `commodity-regulation` | Regulation & Policy | — | api/news/ | `news` | — | commodity regulation & policy |
| `chat-analyst` | WM Analyst | locked | api/chat-analyst.ts, api/ask.ts, api/a2a.ts | — | `a2a`, `ask`, `chat_analyst` | conversational AI market analyst |
| `news-market-correlation` | News ↔ Markets | — | api/intelligence/v1/[rpc].ts, api/market/v1/[rpc].ts | `intelligence`, `market` | — | correlation of news sentiment vs. price moves |
| `sanctions-pressure` | Sanctions Pressure | — | api/sanctions/v1/[rpc].ts | `sanctions` | — | country sanctions pressure index |
| `critical-minerals` | Critical Minerals | — | api/market/v1/[rpc].ts | `market` | — | critical minerals prices |
| `global-procurement` | Global Procurement | locked | api/market/v1/[rpc].ts + WORLDMONITOR_API_KEY | `market` | — | cross-border government procurement signals |
| `cross-source-signals` | Cross-Source Signals | — | api/intelligence/v1/[rpc].ts | `intelligence` | — | cross-source signal aggregation |
| `crypto-news` | Crypto News | — | api/news/ | `news` | — | crypto news |
| `crypto` | Crypto | — | api/market/v1/[rpc].ts | `market` | — | crypto prices: BTC, ETH, top altcoins |
| `crypto-heatmap` | Crypto Sectors | — | api/market/v1/[rpc].ts | `market` | — | crypto sector heatmap |
| `security` | Cybersecurity | — | api/cyber/v1/[rpc].ts, api/news/ | `cyber`, `news` | — | cybersecurity news |
| `deduction` | Deduct Situation | locked | api/ask.ts, api/intelligence/v1/[rpc].ts + WORLDMONITOR_API_KEY | `intelligence` | `ask` | deductive situation analysis from news |
| `defense-patents` | R&D Signal | — | api/military/v1/[rpc].ts | `military` | — | defense patent filing trends |
| `derivatives` | Derivatives & Options | — | api/market/v1/[rpc].ts | `market` | — | derivatives & options market data |
| `dev` | Developer Community | — | api/news/ | `news` | — | developer community news |
| `economic-correlation` | Economic Warfare | — | api/economic/v1/[rpc].ts | `economic` | — | economic cross-correlation |
| `economic-news` | Economic News | — | api/news/ | `news` | — | economic news |
| `energy` | Energy & Resources | — | api/news/ | `news` | — | energy & resources news |
| `energy-crisis` | Energy Crisis Tracker | — | api/supply-chain/hormuz-tracker.js, api/economic/v1/[rpc].ts | `economic`, `supply_chain` | — | energy-crisis policy tracker |
| `energy-disruptions` | Energy Disruptions Log | — | api/supply-chain/v1/[rpc].ts, api/conflict/v1/[rpc].ts | `conflict`, `supply_chain` | — | energy-disruption events: outages, attacks |
| `cascade` | Infrastructure Cascade | — | api/intelligence/v1/[rpc].ts | `intelligence` | — | energy/grid/water cascade events |
| `escalation-correlation` | Escalation Monitor | — | api/military/v1/[rpc].ts | `military` | — | escalation cross-correlation |
| `finance` | Financial | — | api/news/ | `news` | — | finance news headlines |
| `fin-regulation` | Financial Regulation | — | api/news/ | `news` | — | financial regulation news |
| `fintech` | Fintech & Trading Tech | — | api/news/ | `news` | — | fintech & trading tech news |
| `forex` | Forex & Currencies | — | api/news/ | `news` | — | forex & currency news |
| `funding` | Funding & VC | — | api/news/, api/research/v1 | `news`, `research` | — | funding round data |
| `forecast` | AI Forecasts | locked | api/forecast/[rpc].ts | `forecast` | — | geopolitical cascade forecasts |
| `geo-hubs` | Geopolitical Hubs | — | api/intelligence/v1/[rpc].ts | `intelligence` | — | geopolitical event hub activity |
| `fuel-shortages` | Global Fuel Shortage Registry | — | api/safety/v1/[rpc].ts | `safety` | — | global fuel-shortage alerts by region |
| `gold-silver` | Gold & Silver | — | api/market/v1/[rpc].ts | `market` | — | gold & silver prices, spreads |
| `gold-intelligence` | Gold Intelligence | — | api/market/v1/[rpc].ts | `market` | — | gold price, flows, ETFs, safe-haven signals |
| `positive-feed` | Good News Feed | — | api/positive-events/v1/[rpc].ts | `positive_events` | — | good news feed (filtered positive) |
| `gov` | Government | — | api/news/ | `news` | — | government news |
| `grocery-basket` | Grocery Index | — | api/economic/v1/[rpc].ts | `economic` | — | grocery index / basket prices |
| `institutional` | Hedge Funds & PE | — | api/news/ | `news` | — | hedge fund & PE news |
| `tech-hubs` | Hot Tech Hubs | — | api/intelligence/v1/[rpc].ts | `intelligence` | — | hot tech hub activity |
| `intel` | Intel Feed | — | api/intelligence/v1/[rpc].ts | `intelligence` | — | intel feed items from curated sources |
| `internet-disruptions` | Internet Disruptions | — | api/safety/v1/[rpc].ts, api/cyber/v1/[rpc].ts | `cyber`, `safety` | — | internet / ISP disruption status |
| `layoffs` | Layoffs Tracker | — | api/news/ | `news` | — | layoff announcements |
| `gdelt-intel` | Live Intelligence | enhanced | api/prediction/[rpc].ts, api/intelligence/v1/[rpc].ts | `intelligence`, `prediction` | — | live GDELT document events, tone, locations |
| `live-news` | Live News | — | api/rss-proxy.js, api/news/ | `news` | `rss_proxy` | live TV channels, breaking video headlines |
| `counters` | Live Counters | — | api/positive-events/v1/[rpc].ts | `positive_events` | — | live positive counters (species, trees, etc.) |
| `live-webcams` | Live Webcams | — | api/imagery/, api/maritime/v1/ | `imagery`, `maritime` | — | live webcam feeds by region |
| `economic` | Macro Stress | — | api/economic/v1/[rpc].ts, api/market/v1/[rpc].ts | `economic`, `market` | — | macro stress scores & indicators |
| `map` | Global Map | — | multiple api/ | — | — | map layers |
| `analysis` | Market Analysis | — | api/market/v1/[rpc].ts, api/ask.ts | `market` | `ask` | market analysis narratives |
| `macro-signals` | Market Regime | — | api/economic/v1/[rpc].ts, api/market/v1/[rpc].ts | `economic`, `market` | — | market regime & macro indicators |
| `markets-news` | Markets News | — | api/news/ | `news` | — | markets news headlines |
| `commodities` | Metals & Materials | — | api/market/v1/[rpc].ts | `market` | — | metal & material prices: copper, gold, silver, lithium, iron ore, etc. |
| `military-correlation` | Force Posture | — | api/correlation-runtime-mode.js, api/military/v1/[rpc].ts | `military` | `correlation_runtime_mode` | military events + news cross-correlation |
| `mining-companies` | Mining Companies | — | api/market/v1/[rpc].ts | `market` | — | mining company prices |
| `mining-news` | Mining News | — | api/news/ | `news` | — | mining industry news |
| `consumer-prices` | Consumer Prices | — | api/consumer-prices/[rpc].ts | `consumer_prices` | — | national CPI, basket prices |
| `disaster-correlation` | Disaster Cascade | — | api/natural/v1/[rpc].ts | `natural` | — | natural disaster cross-correlation |
| `pipeline-status` | Oil & Gas Pipeline Status | — | api/supply-chain/hormuz-tracker.js | `supply_chain` | — | oil & gas pipeline status, capacity, outages |
| `windy-webcams` | Windy Live Webcam | — | api/imagery/ | `imagery` | — | pinned windy webcams |
| `politics` | World News | — | api/news/, api/rss-proxy.js | `news` | `rss_proxy` | politics & world news headlines |
| `population-exposure` | Population Exposure | — | api/climate/v1/[rpc].ts, api/safety/v1/[rpc].ts | `climate`, `safety` | — | population exposure to climate hazards |
| `radiation-watch` | Radiation Watch | — | api/radiation/v1/[rpc].ts | `radiation` | — | radiation / nuclear threat watch |
| `china-activity-nowcast` | China Activity Nowcast | — | api/market/v1/[rpc].ts | `market` | — | real-time China activity nowcast |
| `regional-intelligence` | Regional Intelligence | locked | api/intelligence/v1/[rpc].ts + WORLDMONITOR_API_KEY | `intelligence` | — | regional intelligence board |
| `regionalStartups` | Global Startup News | — | api/news/ | `news` | — | regional startup news |
| `renewable` | Renewable Energy | — | api/positive-events/v1/[rpc].ts | `positive_events` | — | renewable energy installations & progress |
| `fuel-prices` | Fuel Prices | — | api/economic/v1/[rpc].ts | `economic` | — | retail fuel prices by country |
| `strategic-risk` | Strategic Risk Overview | enhanced | api/intelligence/v1/[rpc].ts | `intelligence` | — | risk score + top strategic risk locations |
| `economic-calendar` | Economic Calendar | — | api/economic/v1/[rpc].ts | `economic` | — | scheduled macro economic data releases |
| `heatmap` | Sector Heatmap | — | api/market/v1/[rpc].ts | `market` | — | sector performance heatmap |
| `hardware` | Semiconductors & Hardware | — | api/news/ | `news` | — | semiconductors & hardware news |
| `service-status` | Service Status | — | api/safety/v1/[rpc].ts | `safety` | — | service status pages monitoring |
| `social-velocity` | Social Velocity | — | api/unrest/v1/[rpc].ts | `unrest` | — | social media velocity (protest / unrest) |
| `species` | Conservation Wins | — | api/positive-events/v1/[rpc].ts | `positive_events` | — | species recovery wins |
| `stablecoins` | Stablecoins | — | api/market/v1/[rpc].ts | `market` | — | stablecoin supply (USDT, USDC, DAI) |
| `startups` | Startups & VC | — | api/news/ | `news` | — | startup & VC fundraising news |
| `chokepoint-strip` | Chokepoint Status | — | api/supply-chain/hormuz-tracker.js, api/maritime/v1/[rpc].ts | `maritime`, `supply_chain` | — | strategic chokepoint status (Hormuz, Suez, Bab el-Mandeb, Bosporus, etc.) |
| `storage-facility-map` | Strategic Storage Atlas | — | api/safety/v1/[rpc].ts, api/supply-chain/v1/[rpc].ts | `safety`, `supply_chain` | — | strategic storage facilities: SPR, UGS, crude, LNG |
| `supply-chain` | Supply Chain | enhanced | api/supply-chain/hormuz-tracker.js, api/supply-chain/v1/[rpc].ts | `supply_chain` | — | supply-chain chokepoints & routes |
| `trade-policy` | Trade Policy | locked | api/trade/[rpc].ts + WORLDMONITOR_API_KEY | `trade` | — | tariff / trade-policy actions |
| `events` | Tech Events | — | api/research/ | `research` | — | tech event listings |
| `tech` | Technology | — | api/news/ | `news` | — | tech news headlines |
| `tech-readiness` | Tech Readiness Index | — | api/economic/v1/[rpc].ts | `economic` | — | tech readiness index by country |
| `thermal-escalation` | Thermal Escalation | — | api/thermal/v1/[rpc].ts | `thermal` | — | thermal signature escalation |
| `thinktanks` | Think Tanks | — | api/news/ | `news` | — | think tank articles |
| `macro-tiles` | Macro Indicators | — | api/economic/v1/[rpc].ts | `economic` | — | tile grid of macro indicators (CPI, yields, etc.) |
| `unicorns` | Unicorn Tracker | — | api/news/, api/research/ | `news`, `research` | — | unicorn startup valuations |
| `earnings-calendar` | Earnings Calendar | — | api/market/v1/[rpc].ts | `market` | — | upcoming earnings by company |
| `monitors` | My Monitors | — | api/user-prefs.ts, local storage | — | `user_prefs` | user-defined keyword/location monitors |
| `world-clock` | World Clock | — | api/ (client-side, no API) | — | — | world clock by major cities |
| `markets` | Markets | — | api/market/v1/[rpc].ts | `market` | — | world indices, equities, FX, bond yields |

---

## 3. 业务域数据结构详解（39 域）

域按「消费面板数」降序排列。每个域列出自面板侧实际使用的业务 message（data 消息），并给出字段表；request/response 包装消息（wrappers）在域末尾列出。

### 3.1 `market` — 43 个面板消费

- proto 文件：27 个（`analyze_stock.proto`, `backtest_stock.proto`, `get_cot_positioning.proto`, `get_country_stock_index.proto`, `get_fear_greed_index.proto`, `get_gold_intelligence.proto`, `get_hyperliquid_flow.proto`, `get_insider_transactions.proto` …）
- message：94 个（业务数据 46，包装 48）；enum：5 个
- 消费面板：`aaii-sentiment`, `ai-tokens`, `analysis`, `base-metals`, `bonds`, `centralbanks`, `china-activity-nowcast`, `china-corridors`, `commodities`, `cot-positioning`, `critical-minerals`, `crypto` …

#### `worldmonitor.market.v1.AnalystConsensus` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `strong_buy` | int32 | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `buy` | int32 | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `hold` | int32 | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `sell` | int32 | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `strong_sell` | int32 | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `total` | int32 | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `period` | string | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |

#### `worldmonitor.market.v1.AnalyzeStockResponse` — 73 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `available` | bool | Whether to include recent news in the stock analysis. |
| `symbol` | string | Whether to include recent news in the stock analysis. |
| `name` | string | Whether to include recent news in the stock analysis. |
| `display` | string | Whether to include recent news in the stock analysis. |
| `currency` | string | Whether to include recent news in the stock analysis. |
| `current_price` | double | Whether to include recent news in the stock analysis. |
| `change_percent` | double | Whether to include recent news in the stock analysis. |
| `signal_score` | double | Technical-analysis score (0-100), retained as a stable pair with signal for clients that predate the fundamentals-blended rating. |
| `signal` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `trend_status` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `volume_status` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `macd_status` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `rsi_status` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `summary` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `action` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `confidence` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `technical_summary` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `news_summary` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `why_now` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `bullish_factors` | string[] | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `risk_factors` | string[] | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `support_levels` | double[] | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `resistance_levels` | double[] | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `headlines` | StockAnalysisHeadline[] | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `ma5` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `ma10` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `ma20` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `ma60` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `bias_ma5` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `bias_ma10` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `bias_ma20` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `volume_ratio_5d` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `rsi_12` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `macd_dif` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `macd_dea` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `macd_bar` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `provider` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `model` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `fallback` | bool | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `news_searched` | bool | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `generated_at` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `analysis_id` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `stop_loss` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `take_profit` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `engine_version` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `analyst_consensus` | AnalystConsensus | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `price_target` | PriceTarget | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `recent_upgrades` | UpgradeDowngrade[] | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `dividend_yield` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `trailing_annual_dividend_rate` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `payout_ratio` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `dividend_frequency` | string | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `dividend_cagr` | double | Technical-only signal paired with signal_score. New clients should use rating_signal with composite_score for the surfaced investment rating. |
| `market_session` | string | US-equity trading session at analysis time: "regular", "pre", "post" or "closed". Empty when session detection does not apply (non-US symbols). |
| `extended_price` | double | Latest pre/post-market price from Yahoo extended-hours candles. Only set when market_session is "pre" or "post" and extended data is available. |
| `extended_change_percent` | double | Extended-hours change % vs the last regular-session close. Only set when extended_price is set. |
| `fundamentals` | Fundamentals | Quality / growth / leverage fundamentals parsed from Yahoo's financialData module (already fetched for price targets). Any field may be unset. |
| `fundamental_score` | double | Fundamental health score (0-100) blended from the quality/growth/leverage fundamentals above. Unset when too few fundamentals are available to score, in which case composite_score falls back to signal_score. |
| `composite_score` | double | Blend of signal_score (technicals) and fundamental_score that drives rating_signal, so a Strong buy/sell no longer fires on price action alone. Equals signal_score when fundamental_score is unset. |
| `next_earnings_date` | string | Next scheduled earnings date (YYYY-MM-DD) plus consensus EPS / revenue for the symbol, joined from the market:earnings-calendar:v1 seed. Unset when the symbol has no upcoming (not-yet-reported) entry in the seed's ~2-week window. (61-62 are taken by a concurrent PR; using 63-65 to avoid a field collision.) |
| `consensus_eps` | double | Next scheduled earnings date (YYYY-MM-DD) plus consensus EPS / revenue for the symbol, joined from the market:earnings-calendar:v1 seed. Unset when the symbol has no upcoming (not-yet-reported) entry in the seed's ~2-week window. (61-62 are taken by a concurrent PR; using 63-65 to avoid a field collision.) |
| `consensus_revenue` | double | Next scheduled earnings date (YYYY-MM-DD) plus consensus EPS / revenue for the symbol, joined from the market:earnings-calendar:v1 seed. Unset when the symbol has no upcoming (not-yet-reported) entry in the seed's ~2-week window. (61-62 are taken by a concurrent PR; using 63-65 to avoid a field collision.) |
| `news_sentiment` | double | LLM-derived news sentiment for the analyzed symbol: a signed score in [-1, 1] (-1 very bearish, 0 neutral / no material news, +1 very bullish), emitted by the same overlay model that already reads the headlines — no extra call. Omitted when the analysis falls back to rules (no LLM overlay). (69 avoids a field collision with in-flight PRs: 61-62 blend fundamentals into the rating, 63-65 are the merged earnings join, 66-68 are the in-flight risk-analytics PR.) |
| `realized_volatility` | double | Risk analytics computed from the 6-month daily candles already fetched for the technical snapshot (no extra upstream call). (66-68 avoid a field collision: 61-62 are claimed by the in-flight PR that blends fundamentals into the rating, and 63-65 by the merged earnings join.)  Annualized realized volatility — sample stdev of daily log returns × √252 — as a fractional ratio where 0.25 means 25%. 0 when history is insufficient. |
| `atr` | double | Wilder's 14-period Average True Range, in the response currency's price units. 0 when history is insufficient. |
| `max_drawdown` | double | Maximum peak-to-trough drawdown over the window, as a non-positive fractional ratio where -0.25 means a 25% decline. 0 for a monotonically rising series. |
| `rating_signal` | string | Fundamentals-blended signal paired with composite_score. Kept separate from the legacy technical-only signal/signal_score pair so already-loaded web, desktop, and API clients never render a mixed-version rating. |
| `rating_summary` | string | Fundamentals-blended narrative paired with rating_signal/composite_score. Legacy summary remains paired with signal/signal_score during rollout. |
| `rating_action` | string | Fundamentals-blended action paired with rating_signal/composite_score. Legacy action remains paired with signal/signal_score during rollout. |
| `rating_confidence` | string | Fundamentals-blended confidence paired with rating_signal/composite_score. Legacy confidence remains paired with signal/signal_score during rollout. |
| `rating_why_now` | string | Fundamentals-blended explanation paired with rating_signal/composite_score. Legacy why_now remains paired with signal/signal_score during rollout. |
| `rating_bullish_factors` | string[] | Fundamentals-aware positive factors supporting the composite rating. Legacy bullish_factors remain technical-only during rollout. |
| `rating_risk_factors` | string[] | Fundamentals-aware risks supporting the composite rating. Legacy risk_factors remain technical-only during rollout. |

#### `worldmonitor.market.v1.BacktestStockEvaluation` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `signal` | string |  |
| `signal_score` | double |  |
| `entry_price` | double |  |
| `exit_price` | double |  |
| `simulated_return_pct` | double |  |
| `direction_correct` | bool |  |
| `outcome` | string |  |
| `stop_loss` | double |  |
| `take_profit` | double |  |
| `analysis_id` | string |  |

#### `worldmonitor.market.v1.BacktestStockResponse` — 19 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `available` | bool | Evaluation window in days for simulated backtest outcomes. |
| `symbol` | string | Evaluation window in days for simulated backtest outcomes. |
| `name` | string | Evaluation window in days for simulated backtest outcomes. |
| `display` | string | Evaluation window in days for simulated backtest outcomes. |
| `currency` | string | Evaluation window in days for simulated backtest outcomes. |
| `eval_window_days` | int32 | Evaluation window in days for simulated backtest outcomes. |
| `evaluations_run` | int32 | Evaluation window in days for simulated backtest outcomes. |
| `actionable_evaluations` | int32 | Evaluation window in days for simulated backtest outcomes. |
| `win_rate` | double | Evaluation window in days for simulated backtest outcomes. |
| `direction_accuracy` | double | Evaluation window in days for simulated backtest outcomes. |
| `avg_simulated_return_pct` | double | Evaluation window in days for simulated backtest outcomes. |
| `cumulative_simulated_return_pct` | double | Evaluation window in days for simulated backtest outcomes. |
| `latest_signal` | string | Evaluation window in days for simulated backtest outcomes. |
| `latest_signal_score` | double | Evaluation window in days for simulated backtest outcomes. |
| `summary` | string | Evaluation window in days for simulated backtest outcomes. |
| `generated_at` | string | Evaluation window in days for simulated backtest outcomes. |
| `evaluations` | BacktestStockEvaluation[] | Evaluation window in days for simulated backtest outcomes. |
| `engine_version` | string | Evaluation window in days for simulated backtest outcomes. |
| `rating_basis` | string | "technical_only": historical Yahoo bars do not include point-in-time fundamentals, so this result must not be presented as a replay of the fundamentals-blended live rating. |

#### `worldmonitor.market.v1.BenchmarkLeg` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `price` | double | BenchmarkLeg identifies one raw price and its observation clock. |
| `currency` | string | BenchmarkLeg identifies one raw price and its observation clock. |
| `unit` | string | BenchmarkLeg identifies one raw price and its observation clock. |
| `source` | string | BenchmarkLeg identifies one raw price and its observation clock. |
| `as_of` | string | BenchmarkLeg identifies one raw price and its observation clock. |

#### `worldmonitor.market.v1.BreadthSnapshot` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string |  |
| `pct_above_20d` | double | Optional so a missing/failed Barchart reading serializes as JSON null instead of collapsing to 0, which would render identically to a real 0% reading (severe market dislocation with no S&P stocks above SMA). |
| `pct_above_50d` | double | Optional so a missing/failed Barchart reading serializes as JSON null instead of collapsing to 0, which would render identically to a real 0% reading (severe market dislocation with no S&P stocks above SMA). |
| `pct_above_200d` | double | Optional so a missing/failed Barchart reading serializes as JSON null instead of collapsing to 0, which would render identically to a real 0% reading (severe market dislocation with no S&P stocks above SMA). |

#### `worldmonitor.market.v1.CommodityQuote` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Human-readable name. |
| `display` | string | Display label. |
| `price` | double | Current price. |
| `change` | double | Percentage change from previous close. |
| `sparkline` | double[] | Sparkline data points. |

#### `worldmonitor.market.v1.CotInstrument` — 13 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string |  |
| `code` | string |  |
| `report_date` | string |  |
| `asset_manager_long` | int64 |  |
| `asset_manager_short` | int64 |  |
| `leveraged_funds_long` | int64 |  |
| `leveraged_funds_short` | int64 |  |
| `dealer_long` | int64 |  |
| `dealer_short` | int64 |  |
| `net_pct` | double |  |
| `small_trader_long` | int64 | Non-reportable positions are the CFTC series closest to small traders. They are a residual category, not a direct measurement of all retail flow. |
| `small_trader_short` | int64 | Non-reportable positions are the CFTC series closest to small traders. They are a residual category, not a direct measurement of all retail flow. |
| `small_trader_available` | bool | False for cache rows written before the non-reportable fields were added. |

#### `worldmonitor.market.v1.CryptoQuote` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Cryptocurrency name (e.g., "Bitcoin"). |
| `price` | double | Current price in USD. |
| `change` | double | 24-hour percentage change. |
| `sparkline` | double[] | Sparkline data points (recent price history). |
| `change7d` | double | 7-day percentage change. |

#### `worldmonitor.market.v1.CryptoSector` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Sector identifier. |
| `name` | string | Sector display name. |
| `change` | double | Average 24h percentage change across sector tokens. |

#### `worldmonitor.market.v1.EarningsEntry` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `symbol` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `company` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `date` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `hour` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `eps_estimate` | double | Inclusive upper date bound in YYYY-MM-DD format. |
| `revenue_estimate` | double | Inclusive upper date bound in YYYY-MM-DD format. |
| `eps_actual` | double | Inclusive upper date bound in YYYY-MM-DD format. |
| `revenue_actual` | double | Inclusive upper date bound in YYYY-MM-DD format. |
| `has_actuals` | bool | Inclusive upper date bound in YYYY-MM-DD format. |
| `surprise_direction` | string | Inclusive upper date bound in YYYY-MM-DD format. |

#### `worldmonitor.market.v1.EtfFlow` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `issuer` | string | Fund issuer (e.g. "BlackRock"). |
| `price` | double | Latest closing price. |
| `price_change` | double | Day-over-day price change percentage. |
| `volume_ratio` | double | Volume ratio (latest / average). |
| `direction` | string | Flow direction: "inflow", "outflow", or "neutral". |

#### `worldmonitor.market.v1.EtfFlowsSummary` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `etf_count` | int32 | Number of ETFs with data. |
| `net_direction` | string | Net direction: "NET INFLOW", "NET OUTFLOW", or "NEUTRAL". |
| `inflow_count` | int32 | Number of ETFs with inflow. |
| `outflow_count` | int32 | Number of ETFs with outflow. |

#### `worldmonitor.market.v1.FearGreedCategory` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `score` | double |  |
| `weight` | double |  |
| `contribution` | double |  |
| `degraded` | bool |  |
| `inputs_json` | string |  |

#### `worldmonitor.market.v1.FearGreedSectorPerformance` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `symbol` | string |  |
| `name` | string |  |
| `change1d` | double |  |

#### `worldmonitor.market.v1.Fundamentals` — 13 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `profit_margin` | double | Fractional ratio where 0.25 means 25%. |
| `gross_margin` | double | Fractional ratio where 0.25 means 25%. |
| `operating_margin` | double | Fractional ratio where 0.25 means 25%. |
| `return_on_equity` | double | Fractional ratio where 0.25 means 25%. |
| `return_on_assets` | double | Fractional ratio where 0.25 means 25%. |
| `revenue_growth` | double | Fractional ratio where 0.25 means 25%. |
| `earnings_growth` | double | Fractional ratio where 0.25 means 25%. |
| `debt_to_equity` | double | Normalized debt/equity ratio where 1.5 means debt is 1.5x equity. |
| `total_cash` | double | Latest Yahoo financialData value denominated in financial_currency. |
| `total_debt` | double | Latest Yahoo financialData value denominated in financial_currency. |
| `free_cashflow` | double | Latest Yahoo financialData value denominated in financial_currency. |
| `ebitda` | double | Latest Yahoo financialData value denominated in financial_currency. |
| `financial_currency` | string | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |

#### `worldmonitor.market.v1.FxSnapshot` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `pair` | string | FxSnapshot records the conversion input shared by both metals. |
| `rate` | double | FxSnapshot records the conversion input shared by both metals. |
| `source` | string | FxSnapshot records the conversion input shared by both metals. |
| `as_of` | string | FxSnapshot records the conversion input shared by both metals. |

#### `worldmonitor.market.v1.GoldCbHolder` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iso3` | string |  |
| `name` | string |  |
| `tonnes` | double |  |
| `pct_of_reserves` | double |  |

#### `worldmonitor.market.v1.GoldCbMover` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iso3` | string |  |
| `name` | string |  |
| `delta_tonnes_12m` | double |  |

#### `worldmonitor.market.v1.GoldCbReserves` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `as_of_month` | string |  |
| `total_tonnes` | double |  |
| `top_holders` | GoldCbHolder[] |  |
| `top_buyers_12m` | GoldCbMover[] |  |
| `top_sellers_12m` | GoldCbMover[] |  |

#### `worldmonitor.market.v1.GoldCotCategory` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `long_positions` | int64 |  |
| `short_positions` | int64 |  |
| `net_pct` | double |  |
| `oi_share_pct` | double |  |
| `wow_net_delta` | int64 |  |

#### `worldmonitor.market.v1.GoldCotPositioning` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `report_date` | string |  |
| `next_release_date` | string |  |
| `open_interest` | int64 |  |
| `managed_money` | GoldCotCategory |  |
| `producer_swap` | GoldCotCategory |  |

#### `worldmonitor.market.v1.GoldCrossCurrencyPrice` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `currency` | string |  |
| `flag` | string |  |
| `price` | double |  |

#### `worldmonitor.market.v1.GoldDriver` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `symbol` | string |  |
| `label` | string |  |
| `value` | double |  |
| `change_pct` | double |  |
| `correlation_30d` | double |  |

#### `worldmonitor.market.v1.GoldEtfFlows` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `as_of_date` | string |  |
| `tonnes` | double |  |
| `aum_usd` | double |  |
| `nav` | double |  |
| `change_w1_tonnes` | double |  |
| `change_m1_tonnes` | double |  |
| `change_y1_tonnes` | double |  |
| `change_w1_pct` | double |  |
| `change_m1_pct` | double |  |
| `change_y1_pct` | double |  |
| `sparkline_90d` | double[] |  |

#### `worldmonitor.market.v1.GoldRange52w` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `hi` | double |  |
| `lo` | double |  |
| `position_pct` | double |  |

#### `worldmonitor.market.v1.GoldReturns` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `w1` | double |  |
| `m1` | double |  |
| `ytd` | double |  |
| `y1` | double |  |

#### `worldmonitor.market.v1.GoldSessionRange` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `day_high` | double |  |
| `day_low` | double |  |
| `prev_close` | double |  |

#### `worldmonitor.market.v1.GulfQuote` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `symbol` | string | GulfQuote represents a Gulf region market quote (index, currency, or oil). |
| `name` | string | GulfQuote represents a Gulf region market quote (index, currency, or oil). |
| `flag` | string | GulfQuote represents a Gulf region market quote (index, currency, or oil). |
| `country` | string | GulfQuote represents a Gulf region market quote (index, currency, or oil). |
| `type` | string | GulfQuote represents a Gulf region market quote (index, currency, or oil). |
| `price` | double | GulfQuote represents a Gulf region market quote (index, currency, or oil). |
| `change` | double | GulfQuote represents a Gulf region market quote (index, currency, or oil). |
| `sparkline` | double[] | GulfQuote represents a Gulf region market quote (index, currency, or oil). |

#### `worldmonitor.market.v1.HyperliquidAssetFlow` — 22 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `symbol` | string |  |
| `display` | string |  |
| `asset_class` | string |  |
| `group` | string |  |
| `funding` | string | Raw metrics (nullable as strings to preserve precision; "" = unavailable) |
| `open_interest` | string | Raw metrics (nullable as strings to preserve precision; "" = unavailable) |
| `mark_px` | string | Raw metrics (nullable as strings to preserve precision; "" = unavailable) |
| `oracle_px` | string | Raw metrics (nullable as strings to preserve precision; "" = unavailable) |
| `day_notional` | string | Raw metrics (nullable as strings to preserve precision; "" = unavailable) |
| `funding_score` | double | Component scores 0-100 |
| `volume_score` | double | Component scores 0-100 |
| `oi_score` | double | Component scores 0-100 |
| `basis_score` | double | Component scores 0-100 |
| `composite` | double | Component scores 0-100 |
| `spark_funding` | double[] | Sparkline arrays (most recent last); up to 60 samples (5h @ 5min) |
| `spark_oi` | double[] | Sparkline arrays (most recent last); up to 60 samples (5h @ 5min) |
| `spark_score` | double[] | Sparkline arrays (most recent last); up to 60 samples (5h @ 5min) |
| `warmup` | bool | State flags |
| `stale` | bool | State flags |
| `stale_since` | int64 | State flags |
| `missing_polls` | int32 | State flags |
| `alerts` | string[] | State flags |

#### `worldmonitor.market.v1.InsiderTransaction` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string |  |
| `value` | double |  |
| `transaction_code` | string |  |
| `transaction_date` | string |  |

#### `worldmonitor.market.v1.MarketQuote` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Human-readable name. |
| `display` | string | Display label. |
| `price` | double | Current price. |
| `change` | double | Percentage change from previous close. |
| `sparkline` | double[] | Sparkline data points (recent price history). |

#### `worldmonitor.market.v1.MarketQuoteUnavailable` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `reason` | MarketQuoteUnavailableReason | Why the symbol produced no quote. |

#### `worldmonitor.market.v1.PhysicalDivergenceProvenance` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `physical_source` | string | Human-readable physical benchmark provider. |
| `physical_symbol` | string | Physical benchmark contract symbol. |
| `physical_as_of` | string | Physical benchmark trading date in YYYY-MM-DD form, or empty when unavailable. |
| `paper_source` | string | Human-readable paper benchmark provider, or empty when unavailable. |
| `paper_symbol` | string | Paper benchmark contract symbol. |
| `fx_source` | string | Human-readable FX provider, or empty when unavailable. |
| `fx_pair` | string | FX conversion pair. |
| `history_key` | string | Redis history key used by the calculation. |
| `history_window_points` | int32 | Maximum number of observations retained in history. |
| `methodology_version` | string | Methodology identifier used by this provenance record. |

#### `worldmonitor.market.v1.PhysicalDivergenceReading` — 19 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `metal` | string | Supported metal name: gold or silver. |
| `state` | PhysicalDivergenceState | Explicit availability and freshness state. |
| `regime` | PhysicalPremiumRegime | Distribution regime for an OK reading. |
| `index` | double | Normalized divergence index from 0 to 100. |
| `premium_pct` | double | Current physical premium as a percentage. |
| `premium_usd_per_oz` | double | Current physical premium in USD per troy ounce. |
| `percentile` | double | Current premium's empirical percentile from 0 to 100. |
| `robust_z` | double | Median-absolute-deviation robust z-score. |
| `delta_5d` | double | Premium change versus five observations earlier. |
| `delta_20d` | double | Premium change versus twenty observations earlier. |
| `trend_5d` | PhysicalPremiumTrend | Five-observation trend direction. |
| `trend_20d` | PhysicalPremiumTrend | Twenty-observation trend direction. |
| `history_points` | int32 | Number of valid observations available to the classifier. |
| `history_window_start` | string | Oldest observation date in the evaluated window, or empty when unavailable. |
| `history_window_end` | string | Newest observation date in the evaluated window, or empty when unavailable. |
| `physical_as_of` | string | Physical benchmark trading date in YYYY-MM-DD form, or empty when unavailable. |
| `history_key` | string | Redis history key used by the calculation. |
| `methodology_version` | string | Methodology identifier used by this reading. |
| `provenance` | PhysicalDivergenceProvenance | Exact provider and clock inputs used by this reading. |

#### `worldmonitor.market.v1.PhysicalPremium` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `metal` | string | PhysicalPremium compares an SGE physical benchmark with a COMEX future. |
| `physical` | BenchmarkLeg | PhysicalPremium compares an SGE physical benchmark with a COMEX future. |
| `paper` | BenchmarkLeg | PhysicalPremium compares an SGE physical benchmark with a COMEX future. |
| `premium_usd_per_oz` | double | PhysicalPremium compares an SGE physical benchmark with a COMEX future. |
| `premium_pct` | double | PhysicalPremium compares an SGE physical benchmark with a COMEX future. |
| `computed_at` | string | PhysicalPremium compares an SGE physical benchmark with a COMEX future. |

#### `worldmonitor.market.v1.PhysicalStressComposite` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `state` | PhysicalDivergenceState | Fail-closed aggregate state. |
| `index` | double | Weighted aggregate index from 0 to 100 when state is OK. |
| `weights` | PhysicalStressWeight[] | Fixed metal weights used by the aggregate. |
| `methodology_version` | string | Methodology identifier used by the composite. |

#### `worldmonitor.market.v1.PhysicalStressWeight` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `metal` | string | Supported metal name: gold or silver. |
| `weight` | double | Composite weight from zero to one. |
| `methodology_version` | string | Methodology identifier used by this weight. |

#### `worldmonitor.market.v1.PriceTarget` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `high` | double | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `low` | double | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `mean` | double | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `median` | double | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `current` | double | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `number_of_analysts` | int32 | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |

#### `worldmonitor.market.v1.SectorPerformance` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Sector name. |
| `change` | double | Percentage change over the measured period. |

#### `worldmonitor.market.v1.Stablecoin` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Human-readable name. |
| `deviation` | double | Deviation from $1.00 peg, as a percentage. |
| `peg_status` | string | Peg status: "ON PEG", "SLIGHT DEPEG", or "DEPEGGED". |
| `market_cap` | double | Market capitalization in USD. |
| `volume_24h` | double | 24-hour trading volume in USD. |
| `change_24h` | double | 24-hour price change percentage. |
| `change_7d` | double | 7-day price change percentage. |
| `image` | string | Coin image URL. |

#### `worldmonitor.market.v1.StablecoinSummary` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `total_market_cap` | double | Total market cap across all queried stablecoins. |
| `total_volume_24h` | double | Total 24h volume across all queried stablecoins. |
| `coin_count` | int32 | Number of stablecoins returned. |
| `depegged_count` | int32 | Number of stablecoins in DEPEGGED state. |
| `health_status` | string | Overall health: "HEALTHY", "CAUTION", or "WARNING". |

#### `worldmonitor.market.v1.StockAnalysisHeadline` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | Published after midnight but before pre-market on a trading date; aligns to that same date, which opens hours later. |
| `source` | string | Published after midnight but before pre-market on a trading date; aligns to that same date, which opens hours later. |
| `link` | string | Published after midnight but before pre-market on a trading date; aligns to that same date, which opens hours later. |
| `market_session_at_publish` | string | US equity session at publish time: "regular", "pre", "post", or "closed". Empty when published_at is invalid or US hours do not apply. |
| `aligned_trading_date` | string | NYSE/Nasdaq trading date this headline aligns to (YYYY-MM-DD). Empty when unaligned. |
| `alignment_rule` | HeadlineAlignmentRule | Bookkeeping rule only. Never a causal claim. Carried as a closed enum so a consumer can switch exhaustively instead of matching undocumented strings. |

#### `worldmonitor.market.v1.StockAnalysisHistoryItem` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `symbol` | string | Whether history snapshots should include stored news summaries. |
| `snapshots` | AnalyzeStockResponse[] | Whether history snapshots should include stored news summaries. |

#### `worldmonitor.market.v1.UnresolvedStablecoin` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | The requested ID, after trimming and lowercasing. Malformed IDs are reported as sent (normalized and truncated) so the caller can spot the typo. |
| `reason` | string | Bounded vocabulary — anything outside this list is a contract violation: "INVALID_ID"     — not shaped like a CoinGecko ID. "OVER_CAP"       — beyond the per-request ID cap; never looked up. "NOT_FOUND"      — the provider answered, and has no such coin. "PROVIDER_ERROR" — the lookup failed, so the ID is unknown, not absent. |

#### `worldmonitor.market.v1.UpgradeDowngrade` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `firm` | string | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `to_grade` | string | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `from_grade` | string | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |
| `action` | string | ISO 4217 currency used by the company's financial statements. This can differ from AnalyzeStockResponse.currency for ADRs and cross-listings. |

##### `market` 域枚举

| enum | 取值 |
|---|---|
| `HeadlineAlignmentRule` | `HEADLINE_ALIGNMENT_RULE_UNSPECIFIED`, `HEADLINE_ALIGNMENT_RULE_REGULAR_SESSION_SAME_TRADING_DAY`, `HEADLINE_ALIGNMENT_RULE_PREMARKET_SAME_TRADING_DAY`, `HEADLINE_ALIGNMENT_RULE_AFTER_HOURS_NEXT_TRADING_DAY`, `HEADLINE_ALIGNMENT_RULE_NON_SESSION_NEXT_TRADING_DAY`, `HEADLINE_ALIGNMENT_RULE_OVERNIGHT_SAME_TRADING_DAY` |
| `MarketQuoteUnavailableReason` | `MARKET_QUOTE_UNAVAILABLE_REASON_UNSPECIFIED`, `MARKET_QUOTE_UNAVAILABLE_REASON_NOT_FOUND`, `MARKET_QUOTE_UNAVAILABLE_REASON_PROVIDER_ERROR`, `MARKET_QUOTE_UNAVAILABLE_REASON_PROVIDER_RATE_LIMITED`, `MARKET_QUOTE_UNAVAILABLE_REASON_PROVIDER_NOT_CONFIGURED`, `MARKET_QUOTE_UNAVAILABLE_REASON_REQUEST_LIMIT_EXCEEDED`, `MARKET_QUOTE_UNAVAILABLE_REASON_UPSTREAM_BUDGET_EXHAUSTED`, `MARKET_QUOTE_UNAVAILABLE_REASON_SEED_UNAVAILABLE` |
| `PhysicalDivergenceState` | `PHYSICAL_DIVERGENCE_STATE_UNSPECIFIED`, `PHYSICAL_DIVERGENCE_STATE_OK`, `PHYSICAL_DIVERGENCE_STATE_INSUFFICIENT_HISTORY`, `PHYSICAL_DIVERGENCE_STATE_STALE_INPUT`, `PHYSICAL_DIVERGENCE_STATE_MISSING_INPUT` |
| `PhysicalPremiumRegime` | `PHYSICAL_PREMIUM_REGIME_UNSPECIFIED`, `PHYSICAL_PREMIUM_REGIME_NORMAL`, `PHYSICAL_PREMIUM_REGIME_ELEVATED`, `PHYSICAL_PREMIUM_REGIME_STRESSED`, `PHYSICAL_PREMIUM_REGIME_EXTREME` |
| `PhysicalPremiumTrend` | `PHYSICAL_PREMIUM_TREND_UNSPECIFIED`, `PHYSICAL_PREMIUM_TREND_WIDENING`, `PHYSICAL_PREMIUM_TREND_STABLE`, `PHYSICAL_PREMIUM_TREND_NARROWING` |

---

### 3.2 `news` — 42 个面板消费

- proto 文件：5 个（`get_summarize_article_cache.proto`, `list_feed_digest.proto`, `news_item.proto`, `service.proto`, `summarize_article.proto`）
- message：11 个（业务数据 4，包装 7）；enum：3 个
- 消费面板：`accelerators`, `africa`, `ai`, `asia`, `climate-news`, `cloud`, `commodities-news`, `commodity-news`, `commodity-regulation`, `crypto-news`, `dev`, `economic-news` …

#### `worldmonitor.news.v1.DigestCoverage` — 15 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `state` | string | complete / partial / stale / unavailable. complete: every configured category had at least one completed eligible feed and the build did not hit the global deadline. partial: content exists, but a category had no completed feed or the build hit the global deadline. stale: accepted older content is served after a failed latest attempt (durable last-good serving, #7084). unavailable: no eligible content could be served. |
| `attempted_at` | string | ISO 8601 time of the latest build attempt (attempt identity). |
| `items_served` | int32 | Items served in this response, after every gate. |
| `publisher_count` | int32 | Distinct publishers among the served items (normalized source labels, current cycle only — not feed-label counts, not historical sets). |
| `feed_total` | int32 | Eligible feeds configured for this variant+language, and how many completed (with or without items). |
| `feed_completed` | int32 | Eligible feeds configured for this variant+language, and how many completed (with or without items). |
| `category_total` | int32 | Configured categories, and how many had at least one completed feed. |
| `category_completed` | int32 | Configured categories, and how many had at least one completed feed. |
| `dropped_feed_cap` | int32 | Per-gate drop counts, named by gate position in the pipeline: feed cap, undated-item, freshness floor, category cap. |
| `dropped_undated` | int32 | Per-gate drop counts, named by gate position in the pipeline: feed cap, undated-item, freshness floor, category cap. |
| `dropped_freshness` | int32 | Per-gate drop counts, named by gate position in the pipeline: feed cap, undated-item, freshness floor, category cap. |
| `dropped_category_cap` | int32 | Per-gate drop counts, named by gate position in the pipeline: feed cap, undated-item, freshness floor, category cap. |
| `served_stale` | bool | Durable last-good serving (#7084): true exactly when accepted older content is replayed after a failed latest attempt. The content counts above still describe the served body; attempted_at names the FAILED attempt, so it and generated_at diverge on a replay. |
| `stale_age_seconds` | int32 | Age of the served content since acceptance, in seconds (0 when fresh). Bounded at 21600 (six hours): past that window the service reports state=unavailable rather than serving older content. |
| `stale_reason` | string | Closed stale reason: empty-rebuild / build-error (empty when fresh). |

#### `worldmonitor.news.v1.NewsItem` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `link` | string | Article URL. |
| `is_alert` | bool | Whether this article triggered an alert condition. |
| `threat` | ThreatClassification | Threat classification, if assessed. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Geolocation extracted from the article. |
| `location_name` | string | Human-readable location name. |
| `importance_score` | int32 | Composite importance score. The base 0-100 score uses severity × 55% + source tier × 20% + corroboration × 15% + recency × 10%, then may add an 18-point diplomacy/flashpoint boost and 4 points per entity-level corroborating source, capped at five sources. The final score can exceed 100; with current boosts it is approximately capped at 138. |
| `corroboration_count` | int32 | Number of distinct sources that reported the same story in this digest cycle. "Same story" is determined by edit-tolerant story-identity clustering (headlines describing one event with different wording, ordering, source suffixes, truncation, or morphology corroborate each other) — not exact-title matching. See shared/story-identity.js. |
| `story_meta` | StoryMeta | Story lifecycle metadata derived from cross-cycle persistence data. |
| `snippet` | string | Cleaned article description from the RSS/Atom <description> / <content:encoded> / <summary> / <content> tag: HTML-stripped, entity-decoded, whitespace-normalised, clipped to 400 chars. Empty string when unavailable or indistinguishable from the headline — consumers must fall back to the headline for display/LLM grounding in that case. |
| `credibility_score` | int32 | Credibility score (0-100), distinct from importance_score. Measures source reliability / truthfulness, not newsworthiness. The base score uses source tier × 30% + propaganda risk × 50% + independent corroboration × 20%. High propaganda-risk sources (state-controlled media) are capped at 40 so a highly newsworthy RT/TASS story still scores low. Third-party bias/factuality ratings are reserved and not currently applied. See docs/methodology/news-credibility.mdx. |

#### `worldmonitor.news.v1.StoryMeta` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `mention_count` | int32 | Total number of digest cycles in which this story appeared. |
| `source_count` | int32 | Number of unique sources reporting this story in the CURRENT digest cycle (batch corroboration from fuzzy story clustering, #4919; defaults to 1 for unclustered items). The cross-cycle Redis source set (story:sources:v1) feeds importance scoring, not this field. |
| `phase` | StoryPhase | Story lifecycle phase derived from persistence data. |

#### `worldmonitor.news.v1.ThreatClassification` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `level` | ThreatLevel | Overall threat level. |
| `category` | string | Event category. |
| `source` | string | Classification source — "keyword", "keyword-historical-downgrade", or "llm". |

##### `news` 域枚举

| enum | 取值 |
|---|---|
| `StoryPhase` | `STORY_PHASE_UNSPECIFIED`, `STORY_PHASE_BREAKING`, `STORY_PHASE_DEVELOPING`, `STORY_PHASE_SUSTAINED`, `STORY_PHASE_FADING` |
| `SummarizeStatus` | `SUMMARIZE_STATUS_UNSPECIFIED`, `SUMMARIZE_STATUS_SUCCESS`, `SUMMARIZE_STATUS_CACHED`, `SUMMARIZE_STATUS_SKIPPED`, `SUMMARIZE_STATUS_ERROR` |
| `ThreatLevel` | `THREAT_LEVEL_UNSPECIFIED`, `THREAT_LEVEL_LOW`, `THREAT_LEVEL_MEDIUM`, `THREAT_LEVEL_HIGH`, `THREAT_LEVEL_CRITICAL` |

---

### 3.3 `economic` — 18 个面板消费

- proto 文件：33 个（`bis_data.proto`, `economic_data.proto`, `get_bis_credit.proto`, `get_bis_exchange_rates.proto`, `get_bis_policy_rates.proto`, `get_bls_series.proto`, `get_china_activity_nowcast.proto`, `get_china_macro_snapshot.proto` …）
- message：123 个（业务数据 62，包装 61）；enum：0 个
- 消费面板：`bigmac`, `centralbanks`, `economic`, `economic-calendar`, `economic-correlation`, `energy-crisis`, `fao-food-price-index`, `fsi`, `fuel-prices`, `gcc-investments`, `grocery-basket`, `gulf-economies` …

#### `worldmonitor.economic.v1.AutomationFit` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `level` | string |  |
| `score` | int32 |  |
| `classification_version` | string |  |
| `match_reasons` | string[] |  |
| `evidence` | string[] |  |

#### `worldmonitor.economic.v1.BigMacCountryPrice` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | string |  |
| `name` | string |  |
| `currency` | string |  |
| `flag` | string |  |
| `local_price` | double |  |
| `usd_price` | double |  |
| `fx_rate` | double |  |
| `source_site` | string |  |
| `available` | bool |  |
| `wow_pct` | double |  |

#### `worldmonitor.economic.v1.BisCreditToGdp` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_code` | string | ISO 2-letter country code. |
| `country_name` | string | Country or region name. |
| `credit_gdp_ratio` | double | Total credit as percentage of GDP. |
| `previous_ratio` | double | Previous quarter ratio. |
| `date` | string | Date as YYYY-QN. |

#### `worldmonitor.economic.v1.BisExchangeRate` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_code` | string | ISO 2-letter country code. |
| `country_name` | string | Country or region name. |
| `real_eer` | double | Real effective exchange rate index. |
| `nominal_eer` | double | Nominal effective exchange rate index. |
| `real_change` | double | Percentage change from previous period (real). |
| `date` | string | Date as YYYY-MM. |

#### `worldmonitor.economic.v1.BisPolicyRate` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_code` | string | ISO 2-letter country code (US, GB, JP, etc.) |
| `country_name` | string | Country or region name. |
| `rate` | double | Current policy rate percentage. |
| `previous_rate` | double | Previous period rate percentage. |
| `date` | string | Date as YYYY-MM. |
| `central_bank` | string | Central bank name (e.g. "Federal Reserve"). |

#### `worldmonitor.economic.v1.BlsObservation` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `year` | string | Year of the observation. |
| `period` | string | Period code (e.g. "M01" for January, "A01" for annual). |
| `period_name` | string | Human-readable period name. |
| `value` | string | Observed value. |

#### `worldmonitor.economic.v1.BlsSeries` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `series_id` | string | BLS series ID (e.g. "CES0500000001"). |
| `title` | string | Human-readable series title. |
| `units` | string | Unit of measure. |
| `observations` | BlsObservation[] | Observations ordered by date ascending. |

#### `worldmonitor.economic.v1.ChinaMacroIndicator` — 32 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `label` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `category` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `value` | double | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `has_value` | bool | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `prior_value` | double | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `has_prior_value` | bool | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `unit` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `observation_date` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `source` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `source_url` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `stale` | bool | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `unavailable_reason` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `context_only` | bool | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `geography` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `seasonal_adjustment` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `period_kind` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `observation_period` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `release_time` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `retrieval_time` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `direction` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `direction_reason` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `comparison_basis` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `comparison_value` | double | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `has_comparison_value` | bool | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `revision_state` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `vintage_id` | string | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `revision_sequence` | int32 | Kept as "indicator" for API compatibility; each row is a versioned, revision-aware official observation in cache schema v2. |
| `provenance_json` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `vintages` | ChinaMacroVintage[] | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `transport_status` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `transport_failure_reason` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |

#### `worldmonitor.economic.v1.ChinaMacroPillarPulse` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `pillar` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `direction` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `reason` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `observation_ids` | string[] | Canonical #5581 payload, validated before crossing the cache/API boundary. |

#### `worldmonitor.economic.v1.ChinaMacroSourceDecision` — 13 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `source` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `host` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `status` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `reason` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `checked_at` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `optional` | bool | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `request_count` | int32 | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `publisher_id` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `redirect_behavior` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `request_budget` | int32 | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `robots_status` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `terms_status` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `source_url` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |

#### `worldmonitor.economic.v1.ChinaMacroVintage` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `vintage_id` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `sequence` | int32 | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `state` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `value` | double | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `has_value` | bool | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `observation_period` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `period_kind` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `release_time` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `retrieval_time` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `superseded_by` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `provenance_json` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |

#### `worldmonitor.economic.v1.ChinaReleaseEvent` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `event` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `country_code` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `release_date` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `release_time` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `timezone` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `kind` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `status` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `source` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |
| `source_url` | string | Canonical #5581 payload, validated before crossing the cache/API boundary. |

#### `worldmonitor.economic.v1.CountryBasket` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | string |  |
| `name` | string |  |
| `currency` | string |  |
| `flag` | string |  |
| `total_usd` | double |  |
| `fx_rate` | double |  |
| `items` | GroceryItemPrice[] |  |
| `wow_pct` | double |  |

#### `worldmonitor.economic.v1.CrudeInventoryWeek` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `period` | string | ISO week period (YYYY-MM-DD, Monday of the EIA report week). |
| `stocks_mb` | double | Total crude oil stocks in millions of barrels. |
| `weekly_change_mb` | double | Week-over-week change in millions of barrels. Positive = build (bearish), negative = draw (bullish). Absent for the oldest week when no prior week is available for comparison. |

#### `worldmonitor.economic.v1.CrudeInventoryWeekRef` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `period` | string |  |
| `stocks_mb` | double |  |
| `weekly_change_mb` | double |  |

#### `worldmonitor.economic.v1.EcbFxRate` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `pair` | string | Currency pair label, e.g. "EURUSD". |
| `rate` | double | Exchange rate (units of quote currency per 1 EUR). |
| `date` | string | Date of the observation in YYYY-MM-DD format. |
| `change1d` | double | 1-day change in rate (absolute). |

#### `worldmonitor.economic.v1.EconomicEvent` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `event` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `country` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `date` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `impact` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `actual` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `estimate` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `previous` | string | Inclusive upper date bound in YYYY-MM-DD format. |
| `unit` | string | Inclusive upper date bound in YYYY-MM-DD format. |

#### `worldmonitor.economic.v1.EconomicStressComponent` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string |  |
| `label` | string |  |
| `raw_value` | double |  |
| `score` | double |  |
| `weight` | double |  |
| `missing` | bool |  |

#### `worldmonitor.economic.v1.EnergyCapacitySeries` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `energy_source` | string | Number of years of historical data. Default 20 if not set. Accepted but currently ignored; no-op until this handler supports the parameter. |
| `name` | string | Number of years of historical data. Default 20 if not set. Accepted but currently ignored; no-op until this handler supports the parameter. |
| `data` | EnergyCapacityYear[] | Number of years of historical data. Default 20 if not set. Accepted but currently ignored; no-op until this handler supports the parameter. |

#### `worldmonitor.economic.v1.EnergyCapacityYear` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `year` | int32 | Number of years of historical data. Default 20 if not set. Accepted but currently ignored; no-op until this handler supports the parameter. |
| `capacity_mw` | double | Number of years of historical data. Default 20 if not set. Accepted but currently ignored; no-op until this handler supports the parameter. |

#### `worldmonitor.economic.v1.EnergyCrisisPolicy` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country` | string | Country name. |
| `country_code` | string | ISO 3166-1 alpha-2 country code. |
| `category` | string | Policy category: "conservation" or "consumer_support". |
| `sector` | string | Affected sector: transport, buildings, industry, electricity, agriculture, general. |
| `measure` | string | Description of the policy measure. |
| `date_announced` | string | Date announced in ISO-8601 (YYYY-MM-DD) format. |
| `status` | string | Status of the policy: active, planned, or ended. |

#### `worldmonitor.economic.v1.EnergyPrice` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Human-readable name (e.g., "WTI Crude Oil", "Henry Hub Natural Gas"). |
| `price` | double | Current price in USD. |
| `unit` | string | Unit of measurement (e.g., "$/barrel", "$/MMBtu"). |
| `change` | double | Percentage change from previous period. |

#### `worldmonitor.economic.v1.EuFsiObservation` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string |  |
| `value` | double |  |

#### `worldmonitor.economic.v1.EuGasStorageHistoryEntry` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string | Calendar date (YYYY-MM-DD). |
| `fill_pct` | double | Storage fill level as a percentage of working gas volume capacity. |
| `gas_twh` | double | Working gas volume in storage (TWh). |

#### `worldmonitor.economic.v1.EuYieldCurveData` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string | Date of the observation (YYYY-MM or YYYY-MM-DD). |
| `source` | string | Data source identifier (e.g. "ecb-aaa"). |
| `updated_at` | string | ISO 8601 timestamp when this was last seeded. |

#### `worldmonitor.economic.v1.EurostatMetric` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `value` | double | Numeric value (e.g. 2.3 for 2.3%). |
| `date` | string | Period string (e.g. "2024-01" for monthly, "2024-Q1" for quarterly). |
| `unit` | string | Unit of measurement (e.g. "%"). |
| `prior_value` | double | Prior period value for delta calculation (e.g. previous month/quarter). |
| `has_prior` | bool | True when prior_value is present (proto3 can't distinguish 0 from absent). |

#### `worldmonitor.economic.v1.FaoFoodPricePoint` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string |  |
| `ffpi` | double |  |
| `meat` | double |  |
| `dairy` | double |  |
| `cereals` | double |  |
| `oils` | double |  |
| `sugar` | double |  |

#### `worldmonitor.economic.v1.FearGreedHistoryEntry` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string | Date string (YYYY-MM-DD). |

#### `worldmonitor.economic.v1.FearGreedSignal` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | Classification label (e.g., "Extreme Fear", "Greed"). |
| `value` | int32 | Current index value (0-100). |
| `history` | FearGreedHistoryEntry[] | Last 30 days of history. |

#### `worldmonitor.economic.v1.FlowStructureSignal` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | "PASSIVE GAP", "ALIGNED", or "UNKNOWN". |
| `btc_return_5` | double | BTC 5-day return percentage. |
| `qqq_return_5` | double | QQQ 5-day return percentage. |

#### `worldmonitor.economic.v1.FredObservation` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string | Observation date as YYYY-MM-DD string. |
| `value` | double | Observation value. |

#### `worldmonitor.economic.v1.FredSeries` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | Series title. |
| `units` | string | Unit of measurement. |
| `frequency` | string | Data frequency (e.g., "Monthly", "Quarterly"). |
| `observations` | FredObservation[] | Observations in the series. |

#### `worldmonitor.economic.v1.FuelCountryPrice` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | string |  |
| `name` | string |  |
| `currency` | string |  |
| `flag` | string |  |
| `gasoline` | FuelPrice |  |
| `diesel` | FuelPrice |  |
| `fx_rate` | double |  |

#### `worldmonitor.economic.v1.FuelPrice` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `usd_price` | double |  |
| `local_price` | double |  |
| `grade` | string |  |
| `source` | string |  |
| `available` | bool |  |
| `wow_pct` | double |  |
| `observed_at` | string |  |

#### `worldmonitor.economic.v1.GlobalTender` — 21 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string |  |
| `source` | string |  |
| `source_notice_id` | string |  |
| `official_url` | string |  |
| `country_code` | string |  |
| `region` | string |  |
| `title` | string |  |
| `description` | string |  |
| `buyer` | string |  |
| `published_at` | string |  |
| `updated_at` | string |  |
| `deadline` | string |  |
| `status` | string |  |
| `notice_type` | string |  |
| `money` | TenderMoney |  |
| `category_codes` | string[] |  |
| `sectors` | string[] |  |
| `eligibility_requirements` | string[] |  |
| `submission_urls` | string[] |  |
| `participation_mode` | string |  |
| `automation_fit` | AutomationFit |  |

#### `worldmonitor.economic.v1.GroceryItemPrice` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `item_id` | string |  |
| `item_name` | string |  |
| `unit` | string |  |
| `local_price` | double |  |
| `usd_price` | double |  |
| `currency` | string |  |
| `source_site` | string |  |
| `available` | bool |  |

#### `worldmonitor.economic.v1.HashRateSignal` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | "GROWING", "DECLINING", "STABLE", or "UNKNOWN". |
| `change_30d` | double | Hash rate change over 30 days as percentage. |

#### `worldmonitor.economic.v1.LiquiditySignal` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | "SQUEEZE", "NORMAL", or "UNKNOWN". |
| `value` | double | JPY 30d ROC percentage, absent if unavailable. |
| `sparkline` | double[] | Last 30 JPY close prices. |

#### `worldmonitor.economic.v1.MacroMeta` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `qqq_sparkline` | double[] | Last 30 QQQ close prices for sparkline. |

#### `worldmonitor.economic.v1.MacroRegimeSignal` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | "RISK-ON", "DEFENSIVE", or "UNKNOWN". |
| `qqq_roc_20` | double | QQQ 20d ROC percentage. |
| `xlp_roc_20` | double | XLP 20d ROC percentage. |

#### `worldmonitor.economic.v1.MacroSignals` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `liquidity` | LiquiditySignal | JPY-based liquidity squeeze detection. |
| `flow_structure` | FlowStructureSignal | BTC vs QQQ 5-day return comparison. |
| `macro_regime` | MacroRegimeSignal | QQQ vs XLP 20-day rate of change regime. |
| `technical_trend` | TechnicalTrendSignal | BTC price vs moving averages and VWAP. |
| `hash_rate` | HashRateSignal | Bitcoin mining hash rate momentum. |
| `price_momentum` | PriceMomentumSignal | Price momentum via Mayer Multiple. |
| `fear_greed` | FearGreedSignal | Crypto Fear & Greed index. |

#### `worldmonitor.economic.v1.NatGasStorageWeek` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `period` | string | ISO week period (YYYY-MM-DD, Monday of the EIA report week). |
| `stor_bcf` | double | Working gas in underground storage, Lower-48 States, in Bcf. |
| `weekly_change_bcf` | double | Week-over-week change in Bcf. Positive = build (bearish for gas prices), negative = draw (bullish). Absent for the oldest week when no prior week is available for comparison. |

#### `worldmonitor.economic.v1.NatGasWeekRef` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `period` | string |  |
| `stor_bcf` | double |  |
| `weekly_change_bcf` | double |  |

#### `worldmonitor.economic.v1.NationalDebtEntry` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iso3` | string | ISO3 country code (e.g. "USA"). |
| `debt_usd` | double | Total debt in USD at baseline_ts. |
| `gdp_usd` | double | GDP in USD (nominal, latest year). |
| `debt_to_gdp` | double | Debt as % of GDP. |
| `annual_growth` | double | Year-over-year debt growth percent (2023->2024). |
| `per_second_rate` | double | Deficit-derived accrual in USD per second. |
| `per_day_rate` | double | Deficit-derived accrual in USD per day. |
| `baseline_ts` | int64 | UTC ms timestamp anchoring the debt_usd figure (2024-01-01T00:00:00Z). |
| `source` | string | Human-readable source string. |

#### `worldmonitor.economic.v1.OilInventoriesEuGas` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `fill_pct` | double |  |
| `fill_pct_change_1d` | double |  |
| `trend` | string |  |
| `history` | OilInventoriesEuGasDay[] |  |

#### `worldmonitor.economic.v1.OilInventoriesEuGasDay` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string |  |
| `fill_pct` | double |  |

#### `worldmonitor.economic.v1.OilInventoriesIeaMember` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iso2` | string |  |
| `days_of_cover` | double |  |
| `net_exporter` | bool |  |
| `below_obligation` | bool |  |

#### `worldmonitor.economic.v1.OilInventoriesIeaStocks` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `data_month` | string |  |
| `members` | OilInventoriesIeaMember[] |  |
| `europe` | OilInventoriesRegionStats |  |
| `asia_pacific` | OilInventoriesRegionStats |  |
| `north_america` | OilInventoriesRegionStats |  |

#### `worldmonitor.economic.v1.OilInventoriesRefinery` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `inputs_mbpd` | double |  |
| `period` | string |  |

#### `worldmonitor.economic.v1.OilInventoriesRegionStats` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `avg_days` | double |  |
| `min_days` | double |  |
| `count_below_obligation` | int32 |  |

#### `worldmonitor.economic.v1.OilInventoriesSprSnapshot` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `latest_stocks_mb` | double |  |
| `change_wow` | double |  |
| `weeks` | OilInventoriesSprWeek[] |  |

#### `worldmonitor.economic.v1.OilInventoriesSprWeek` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `period` | string |  |
| `stocks_mb` | double |  |

#### `worldmonitor.economic.v1.OilStocksAnalysisMember` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iso2` | string | ISO 3166-1 alpha-2 country code. |
| `days_of_cover` | int32 | Days of supply cover (absent when country is a net exporter or data anomaly). |
| `net_exporter` | bool | True when the country is classified as a net exporter by IEA. |
| `below_obligation` | bool | True when days_of_cover < 90 (IEA 90-day obligation threshold). |
| `obligation_met` | bool | True when the 90-day obligation is met (net exporters always true). |
| `rank` | int32 | Rank within the IEA member ranking (1-indexed, net exporters ranked last). |
| `vs_obligation` | int32 | days_of_cover - 90; absent for net exporters. |

#### `worldmonitor.economic.v1.OilStocksRegionalSummary` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `europe` | OilStocksRegionalSummaryEurope | OilStocksRegionalSummary holds regional aggregates for the three IEA regions. |
| `asia_pacific` | OilStocksRegionalSummaryAsiaPacific | OilStocksRegionalSummary holds regional aggregates for the three IEA regions. |
| `north_america` | OilStocksRegionalSummaryNorthAmerica | OilStocksRegionalSummary holds regional aggregates for the three IEA regions. |

#### `worldmonitor.economic.v1.OilStocksRegionalSummaryAsiaPacific` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `avg_days` | int32 | Mean days of cover across Asia-Pacific members (AU, JP, KR, NZ). |
| `min_days` | int32 | Minimum days of cover across Asia-Pacific members. |
| `count_below_obligation` | int32 | Count of Asia-Pacific members below the 90-day obligation. |

#### `worldmonitor.economic.v1.OilStocksRegionalSummaryEurope` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `avg_days` | int32 | Mean days of cover across non-net-exporter European members. |
| `min_days` | int32 | Minimum days of cover across non-net-exporter European members. |
| `count_below_obligation` | int32 | Count of European members below the 90-day obligation. |

#### `worldmonitor.economic.v1.OilStocksRegionalSummaryNorthAmerica` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `net_exporters` | int32 | Count of net exporters in North America (CA, MX, US). |
| `avg_days` | int32 | Average days of cover for non-exporter North American members (if any). |

#### `worldmonitor.economic.v1.PriceMomentumSignal` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | "STRONG", "MODERATE", "WEAK", or "UNKNOWN". |

#### `worldmonitor.economic.v1.TechnicalTrendSignal` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | "BULLISH", "BEARISH", "NEUTRAL", or "UNKNOWN". |
| `btc_price` | double | Current BTC price. |
| `sma_50` | double | 50-day simple moving average. |
| `sma_200` | double | 200-day simple moving average. |
| `vwap_30d` | double | 30-day volume-weighted average price. |
| `mayer_multiple` | double | Mayer multiple (BTC price / SMA200). |
| `sparkline` | double[] | Last 30 BTC close prices. |

#### `worldmonitor.economic.v1.TenderMoney` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `amount` | double |  |
| `currency` | string |  |

#### `worldmonitor.economic.v1.TenderSourceStatus` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `source` | string |  |
| `state` | string |  |
| `record_count` | int32 |  |
| `fetched_at` | string | Time of the most recent retrieval attempt for this source. |
| `error` | string | Time of the most recent retrieval attempt for this source. |
| `last_successful_at` | string | Time of the most recent successful retrieval; preserved across failures. |
| `stale` | bool | Time of the most recent successful retrieval; preserved across failures. |
| `paced` | bool | Time of the most recent successful retrieval; preserved across failures. |

#### `worldmonitor.economic.v1.WorldBankCountryData` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_name` | string | Country name. |
| `indicator_name` | string | Indicator name. |
| `year` | int32 | Data year. |
| `value` | double | Indicator value. |

---

### 3.4 `intelligence` — 14 个面板消费

- proto 文件：38 个（`classify_event.proto`, `compute_energy_shock.proto`, `deduct_situation.proto`, `get_china_decision_signals.proto`, `get_company_enrichment.proto`, `get_country_coverage.proto`, `get_country_energy_profile.proto`, `get_country_facts.proto` …）
- message：135 个（业务数据 65，包装 70）；enum：5 个
- 消费面板：`cascade`, `cii`, `cross-source-signals`, `deduction`, `gdelt-intel`, `geo-hubs`, `intel`, `news-market-correlation`, `regional-intelligence`, `strategic-posture`, `strategic-risk`, `tech-hubs` …

#### `worldmonitor.intelligence.v1.ActorState` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `actor_id` | string | ActorState is one geopolitical actor's leverage score in the region. |
| `name` | string | ActorState is one geopolitical actor's leverage score in the region. |
| `role` | string | role: aggressor / stabilizer / swing / broker |
| `leverage_domains` | string[] | leverage_domains: energy / military / diplomatic / economic / maritime |
| `leverage_score` | double | leverage_domains: energy / military / diplomatic / economic / maritime |
| `delta` | double | leverage_domains: energy / military / diplomatic / economic / maritime |
| `evidence_ids` | string[] | leverage_domains: energy / military / diplomatic / economic / maritime |

#### `worldmonitor.intelligence.v1.AirportNodeStatus` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `icao` | string | AirportNodeStatus captures airport-level disruption state. |
| `name` | string | AirportNodeStatus captures airport-level disruption state. |
| `status` | string | status: normal / disrupted / closed |
| `disruption_reason` | string | status: normal / disrupted / closed |

#### `worldmonitor.intelligence.v1.AirspaceStatus` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `airspace_id` | string | AirspaceStatus captures FIR-level airspace state. |
| `status` | string | status: open / restricted / closed |
| `reason` | string | status: open / restricted / closed |

#### `worldmonitor.intelligence.v1.BalanceDriver` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `axis` | string | BalanceDriver is one contributor to an axis score. Links back to evidence. |
| `description` | string | BalanceDriver is one contributor to an axis score. Links back to evidence. |
| `magnitude` | double | BalanceDriver is one contributor to an axis score. Links back to evidence. |
| `evidence_ids` | string[] | BalanceDriver is one contributor to an axis score. Links back to evidence. |
| `orientation` | string | orientation: "pressure" / "buffer" |

#### `worldmonitor.intelligence.v1.BalanceVector` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `coercive_pressure` | double | Pressures (high = bad) |
| `domestic_fragility` | double | Pressures (high = bad) |
| `capital_stress` | double | Pressures (high = bad) |
| `energy_vulnerability` | double | Pressures (high = bad) |
| `alliance_cohesion` | double | Buffers (high = good) |
| `maritime_access` | double | Buffers (high = good) |
| `energy_leverage` | double | Buffers (high = good) |
| `net_balance` | double | Derived: mean(buffers) - mean(pressures), range [-1, +1] |
| `pressures` | BalanceDriver[] | Decomposition |
| `buffers` | BalanceDriver[] | Decomposition |

#### `worldmonitor.intelligence.v1.BriefSource` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | Source article headline. |
| `source` | string | Source outlet or feed label. |
| `url` | string | Absolute http(s) source article URL. |
| `published_at` | string | Article publication time, when available. |

#### `worldmonitor.intelligence.v1.CiiComponents` — 0 字段

（oneof / map 等结构，见 proto 原文）

#### `worldmonitor.intelligence.v1.CiiScore` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `region` | string | Region or country identifier. |
| `trend` | worldmonitor.core.v1.TrendDirection | Score trend direction. |
| `components` | CiiComponents | Contributing component scores. |
| `methodology_version` | string | Methodology version string for this score (for example, the current CII formula version). Bumped whenever CII_FORMULA_VERSION changes so API clients can detect score or movement-semantics drift. See docs/methodology/cii-risk-scores.mdx. |
| `advisory_level` | string | Travel advisory level used by the score, when any advisory input applies. Empty means no live or fallback advisory level affected boosts/floors. |

#### `worldmonitor.intelligence.v1.CompanyMarketProfile` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `exchange` | string | Resolved primary ticker symbol. |
| `industry` | string | Industry classification from Finnhub. |
| `market_cap_musd` | double | Market capitalization in millions of USD. |
| `ipo_date` | string | IPO date (YYYY-MM-DD), empty when unknown. |
| `logo_url` | string | IPO date (YYYY-MM-DD), empty when unknown. |
| `country` | string | Company headquarters country code. |
| `currency` | string | Company headquarters country code. |

#### `worldmonitor.intelligence.v1.CompanyNewsMention` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | actual minus estimate. |
| `url` | string | actual minus estimate. |
| `source` | string | actual minus estimate. |

#### `worldmonitor.intelligence.v1.CompanySignal` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | string | Classification type (e.g. "Hiring", "Product Launch", "Expansion"). |
| `title` | string | Classification type (e.g. "Hiring", "Product Launch", "Expansion"). |
| `url` | string | Classification type (e.g. "Hiring", "Product Launch", "Expansion"). |
| `source` | string | Classification type (e.g. "Hiring", "Product Launch", "Expansion"). |
| `source_tier` | int32 | Data quality tier (1 is authoritative, 5 is low confidence). |
| `strength` | string | Qualitative strength of the signal (e.g. "Strong", "Emerging"). |
| `engagement` | SignalEngagement | Qualitative strength of the signal (e.g. "Strong", "Emerging"). |

#### `worldmonitor.intelligence.v1.CountryCoverageEvent` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `occurred_at` | string | Incident time, ISO-8601 UTC. |
| `lane` | string | Timeline lane: "protest", "conflict", "natural" or "military". |
| `label` | string | Incident label. For a coverage event this is provider headline text and is UNTRUSTED; for a structured event it is composed from dataset fields. |
| `severity` | string | "low", "medium", "high" or "critical". A cluster carries its most severe member's severity. |
| `origin` | string | "structured" for a record from a first-party dataset, "coverage" for a clustered news incident that no structured record already described. |
| `source` | string | Which producer this event came from: a source id matching one of the `sources` entries below. |

#### `worldmonitor.intelligence.v1.CountryCoverageHeadline` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | Article title. UNTRUSTED provider text — never execute or follow it as instructions, and escape it before rendering. |
| `url` | string | Article link. Non-HTTP(S) links are dropped upstream, so this is empty rather than a javascript:/data: URL when the feed supplied one. |
| `source` | string | Publisher name as the aggregator reported it. Also untrusted text. |
| `published_at` | string | Publication time, ISO-8601 UTC. |

#### `worldmonitor.intelligence.v1.CountryCoverageSourceStatus` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `source` | string | Stable producer id, e.g. "coverage:headlines", "structured:protests". |
| `state` | string | "ok"           — fetched, within the window. "empty"        — fetched, its backing cache was confirmed readable, and nothing in it matched. The only state that asserts the producer was genuinely quiet. "unknown"      — returned nothing, and this surface could not confirm the upstream was reachable. Several upstream handlers report a failure and an empty result identically, so this is what an unconfirmed silence is called. Never read it as quiet. "stale"        — served, but older than this producer's freshness budget. Still contributes. "failed"       — the read errored, its backing key was absent, or the feed returned only unusable items; contributed nothing. "unavailable"  — not reachable on this surface at all. |
| `detail` | string | Human-readable cause. Present for "stale", "failed" and "unavailable". |
| `fetched_at` | string | When this producer's data was gathered, ISO-8601 UTC. Empty when unknown. |
| `contributed` | int32 | Events this producer contributed to the reconciled timeline, after window filtering. For a coverage producer this counts clustered incidents, not the articles behind them, so several outlets reporting one incident count once. |

#### `worldmonitor.intelligence.v1.CrossSourceSignal` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique signal identifier. |
| `type` | CrossSourceSignalType | Signal type category. |
| `theater` | string | Theater / geographic context (e.g. "Eastern Europe", "Red Sea", "Global Markets"). |
| `summary` | string | Human-readable summary of the signal. |
| `severity` | CrossSourceSignalSeverity | Computed severity tier. |
| `contributing_types` | string[] | For COMPOSITE_ESCALATION: list of contributing signal type names. |
| `signal_count` | int32 | For COMPOSITE_ESCALATION: number of co-firing signals in theater. |

#### `worldmonitor.intelligence.v1.EarningsSurprise` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `period` | string | Fiscal period end date (YYYY-MM-DD). |
| `actual_eps` | double | Fiscal period end date (YYYY-MM-DD). |
| `estimate_eps` | double | Fiscal period end date (YYYY-MM-DD). |
| `surprise` | double | actual minus estimate. |
| `surprise_percent` | double | actual minus estimate. |
| `year` | int32 | actual minus estimate. |
| `quarter` | int32 | actual minus estimate. |

#### `worldmonitor.intelligence.v1.EnrichedCompany` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | True when identity could not be resolved because the SEC registry was unreadable, or when a resolved company's enrichment sources all failed. Responses with this set are never cached. |
| `domain` | string | True when identity could not be resolved because the SEC registry was unreadable, or when a resolved company's enrichment sources all failed. Responses with this set are never cached. |
| `description` | string | Industry classification (SEC SIC description). |
| `location` | string | Business location, such as "Cupertino, CA". |
| `website` | string | Business location, such as "Cupertino, CA". |
| `cik` | string | SEC Central Index Key (zero-padded 10 digits), empty when no EDGAR match. |
| `ticker` | string | Resolved primary ticker symbol. |

#### `worldmonitor.intelligence.v1.EventClassification` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `category` | string | Event category (e.g., "military", "economic", "social"). |
| `subcategory` | string | Event subcategory. |
| `severity` | worldmonitor.core.v1.SeverityLevel | Severity assessment. |
| `analysis` | string | Brief AI-generated analysis. |
| `entities` | string[] | Related entities identified. |

#### `worldmonitor.intelligence.v1.EvidenceItem` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | EvidenceItem is one upstream data point linked from balance drivers, narrative sections, and triggers. |
| `type` | string | type: vessel_track / flight_surge / news_headline / cii_spike / chokepoint_status / sanctions_move / market_signal / mobility_disruption |
| `source` | string | source: AIS / ADSB / GDELT / ACLED / Yahoo / OREF / NOTAM / ... |
| `summary` | string | source: AIS / ADSB / GDELT / ACLED / Yahoo / OREF / NOTAM / ... |
| `confidence` | double | source: AIS / ADSB / GDELT / ACLED / Yahoo / OREF / NOTAM / ... |
| `theater` | string | source: AIS / ADSB / GDELT / ACLED / Yahoo / OREF / NOTAM / ... |
| `corridor` | string | source: AIS / ADSB / GDELT / ACLED / Yahoo / OREF / NOTAM / ... |

#### `worldmonitor.intelligence.v1.FlightCorridorStress` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `corridor` | string | FlightCorridorStress captures per-corridor reroute intensity. |
| `stress_level` | double | FlightCorridorStress captures per-corridor reroute intensity. |
| `rerouted_flights_24h` | int32 | FlightCorridorStress captures per-corridor reroute intensity. |

#### `worldmonitor.intelligence.v1.GasSensitivity` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lng_share_of_imports` | double | Fraction, not percent. Absent when the measurement is unavailable. |
| `lng_imports_tj` | double | Fraction, not percent. Absent when the measurement is unavailable. |
| `lng_disruption_tj` | double | Assumed monthly LNG loss against the route baseline, independent of current shipping flow. |
| `total_demand_tj` | double | Assumed monthly LNG loss against the route baseline, independent of current shipping flow. |
| `deficit_pct` | double | Loss as percent of recorded demand. May exceed 100; not a supply-shortage estimate. |
| `data_available` | bool | Loss as percent of recorded demand. May exceed 100; not a supply-shortage estimate. |
| `assessment` | string | Loss as percent of recorded demand. May exceed 100; not a supply-shortage estimate. |
| `storage` | GasStorageObservation | National stock observation only. No operational endurance is estimated. |
| `data_source` | string | National stock observation only. No operational endurance is estimated. |
| `data_month` | string | JODI observation month (YYYY-MM), or empty when unknown. Availability does not imply freshness. |
| `model_basis` | string | "assumed_route_sensitivity". No country-specific supplier exposure is measured. |

#### `worldmonitor.intelligence.v1.GasStorageBuffer` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `fill_pct` | double | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `gas_twh` | double | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `buffer_days` | double | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `trend` | string | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `date` | string | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `scope` | string | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |

#### `worldmonitor.intelligence.v1.GasStorageObservation` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `fill_pct` | double | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `gas_twh` | double | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `trend` | string | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `date` | string | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `scope` | string | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |

#### `worldmonitor.intelligence.v1.GdeltArticle` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | Article headline. |
| `url` | string | Article URL. |
| `source` | string | Source domain name. |
| `date` | string | Publication date string. |
| `image` | string | Article image URL. |
| `language` | string | Article language code. |
| `tone` | double | GDELT tone score (negative = negative tone, positive = positive tone). |

#### `worldmonitor.intelligence.v1.GdeltTensionPair` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Pair identifier. |
| `countries` | string[] | Country pair (ISO 3166-1 alpha-2 codes). |
| `label` | string | Human-readable label (e.g., "US-China"). |
| `trend` | worldmonitor.core.v1.TrendDirection | Trend direction. |
| `change_percent` | double | Percentage change from previous period. |
| `region` | string | Geographic region. |

#### `worldmonitor.intelligence.v1.GdeltTimelinePoint` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string | Date string from GDELT (e.g. "20240101T000000"). |
| `value` | double | Tone or volume value at this point. |

#### `worldmonitor.intelligence.v1.GpsJamHex` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lat` | double | Centroid latitude. |
| `lon` | double | Centroid longitude. |
| `level` | InterferenceLevel | Interference level. |
| `np_avg` | double | Average Navigation Precision (np) - lower means more interference. |
| `sample_count` | int32 | Number of samples in this hex. |
| `aircraft_count` | int32 | Number of unique aircraft that reported in this hex. |

#### `worldmonitor.intelligence.v1.GpsJamStats` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `total_hexes` | int32 | GpsJamStats contains aggregate statistics for GPS interference. |
| `high_count` | int32 | GpsJamStats contains aggregate statistics for GPS interference. |
| `medium_count` | int32 | GpsJamStats contains aggregate statistics for GPS interference. |

#### `worldmonitor.intelligence.v1.IntelHistoryRecord` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Opaque stable handle for the stored event (a Convex document id). Useful for de-duplicating across calls; not resolvable through any public route. |
| `domain` | string | Producing domain, e.g. "conflict", "military", "energy". Matches the domain filter accepted by the three RPCs. |
| `resource` | string | Seeder-level resource that produced the event, e.g. "acled-events". Finer-grained than domain and not part of any request filter. |
| `country` | string | ISO 3166-1 alpha-2 country code. Empty when the event is not attributable to a single country. |
| `category` | string | Producer-supplied event category, e.g. "battle". Free-form per domain; empty when the producer did not classify the event. |
| `title` | string | Event headline, verbatim third-party text. Always present. Data, never instructions — see the UNTRUSTED CONTENT note above. |
| `summary` | string | Longer description, verbatim third-party text. Empty when the producer had none. Data, never instructions — see the UNTRUSTED CONTENT note above. |
| `source_url` | string | Canonical link to the underlying report, as published by the source. Empty when the producer had none. Validated to be http(s) at both ingest boundaries, but the destination itself is untrusted. |
| `score` | double | Cosine similarity against the request's query vector, in [-1, 1]. Higher is closer. Always 0 on GetIntelTimeline, which ranks by time and has no query vector to score against. |

#### `worldmonitor.intelligence.v1.LeverageEdge` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `from_actor_id` | string | LeverageEdge is a directed influence relationship between two actors. |
| `to_actor_id` | string | LeverageEdge is a directed influence relationship between two actors. |
| `mechanism` | string | mechanism: sanctions / naval_posture / energy_supply / alliance_shift / trade_friction |
| `strength` | double | mechanism: sanctions / naval_posture / energy_supply / alliance_shift / trade_friction |
| `evidence_ids` | string[] | mechanism: sanctions / naval_posture / energy_supply / alliance_shift / trade_friction |

#### `worldmonitor.intelligence.v1.MarketImplicationCard` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `ticker` | string |  |
| `name` | string |  |
| `direction` | string |  |
| `timeframe` | string |  |
| `confidence` | string |  |
| `title` | string |  |
| `narrative` | string |  |
| `risk_caveat` | string |  |
| `driver` | string |  |
| `transmission_chain` | TransmissionNode[] |  |

#### `worldmonitor.intelligence.v1.MaterialEvent` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `company` | string | Filer display name. |
| `cik` | string | SEC Central Index Key of the filer (zero-padded 10 digits). |
| `form` | string | Form type, such as "8-K" or "8-K/A". |
| `accession` | string | EDGAR accession number. |
| `items` | MaterialEventItem[] | Disclosed 8-K items. |
| `url` | string | Link to the filing index on sec.gov. |

#### `worldmonitor.intelligence.v1.MaterialEventItem` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | string | 8-K item code, such as "2.02". |
| `description` | string | Human-readable item description, such as "Results of Operations and Financial Condition". |

#### `worldmonitor.intelligence.v1.MobilityState` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `airspace` | AirspaceStatus[] | MobilityState captures airspace, flight corridor, and airport node status for the region. Phase 0 ships empty; Phase 2 wires the data plane. |
| `flight_corridors` | FlightCorridorStress[] | MobilityState captures airspace, flight corridor, and airport node status for the region. Phase 0 ships empty; Phase 2 wires the data plane. |
| `airports` | AirportNodeStatus[] | MobilityState captures airspace, flight corridor, and airport node status for the region. Phase 0 ships empty; Phase 2 wires the data plane. |
| `reroute_intensity` | double | MobilityState captures airspace, flight corridor, and airport node status for the region. Phase 0 ships empty; Phase 2 wires the data plane. |
| `notam_closures` | string[] | MobilityState captures airspace, flight corridor, and airport node status for the region. Phase 0 ships empty; Phase 2 wires the data plane. |

#### `worldmonitor.intelligence.v1.NarrativeSection` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `text` | string | NarrativeSection is one block of narrative text plus its supporting evidence. |
| `evidence_ids` | string[] | NarrativeSection is one block of narrative text plus its supporting evidence. |

#### `worldmonitor.intelligence.v1.OrefAlert` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | A single Red Alert event. |
| `cat` | string | A single Red Alert event. |
| `title` | string | A single Red Alert event. |
| `data` | string[] | A single Red Alert event. |
| `desc` | string | A single Red Alert event. |

#### `worldmonitor.intelligence.v1.OrefWave` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `alerts` | OrefAlert[] | A wave of alerts occurring at the same time. |

#### `worldmonitor.intelligence.v1.PizzintLocation` — 13 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `place_id` | string | Google Places ID. |
| `name` | string | Location name. |
| `address` | string | Street address. |
| `current_popularity` | int32 | Current popularity score (0-200+). |
| `percentage_of_usual` | int32 | Percentage of usual activity. Zero if unavailable. |
| `is_spike` | bool | Whether activity constitutes a spike. |
| `spike_magnitude` | double | Spike magnitude above baseline. Zero if no spike. |
| `data_source` | string | Data source identifier. |
| `recorded_at` | string | Recording timestamp as ISO 8601 string. |
| `data_freshness` | DataFreshness | Data freshness. |
| `is_closed_now` | bool | Whether the location is currently closed. |
| `lat` | double | Latitude of the location. |
| `lng` | double | Longitude of the location. |

#### `worldmonitor.intelligence.v1.PizzintStatus` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `defcon_label` | string | Human-readable DEFCON label. |
| `aggregate_activity` | double | Aggregate activity score. |
| `active_spikes` | int32 | Number of active spike locations. |
| `locations_monitored` | int32 | Total monitored locations. |
| `locations_open` | int32 | Currently open locations. |
| `data_freshness` | DataFreshness | Data freshness assessment. |
| `locations` | PizzintLocation[] | Individual monitored locations. |

#### `worldmonitor.intelligence.v1.PortActivityEntry` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `port_id` | string | ISO 3166-1 alpha-2 country code for port activity. |
| `port_name` | string | ISO 3166-1 alpha-2 country code for port activity. |
| `lat` | double | ISO 3166-1 alpha-2 country code for port activity. |
| `lon` | double | ISO 3166-1 alpha-2 country code for port activity. |
| `tanker_calls_30d` | int32 | ISO 3166-1 alpha-2 country code for port activity. |
| `trend_delta_pct` | double | ISO 3166-1 alpha-2 country code for port activity. |
| `import_tanker_dwt` | double | ISO 3166-1 alpha-2 country code for port activity. |
| `export_tanker_dwt` | double | ISO 3166-1 alpha-2 country code for port activity. |
| `anomaly_signal` | bool | ISO 3166-1 alpha-2 country code for port activity. |

#### `worldmonitor.intelligence.v1.ProductImpact` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `product` | string | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `output_loss_kbd` | double | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `demand_kbd` | double | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |
| `deficit_pct` | double | Fuel mode to model: "oil", "gas", or "both". Defaults to "oil". |

#### `worldmonitor.intelligence.v1.RegimeState` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `label` | string | label: calm / stressed_equilibrium / coercive_stalemate / fragmentation_risk / managed_deescalation / escalation_ladder |
| `previous_label` | string | label: calm / stressed_equilibrium / coercive_stalemate / fragmentation_risk / managed_deescalation / escalation_ladder |
| `transition_driver` | string | label: calm / stressed_equilibrium / coercive_stalemate / fragmentation_risk / managed_deescalation / escalation_ladder |

#### `worldmonitor.intelligence.v1.RegimeTransition` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `region_id` | string | RegimeTransition is a single recorded regime change moment. One of these lands in the log each time diffRegionalSnapshot() reports regime_changed. |
| `label` | string | Current regime label (the label the region just moved INTO). |
| `previous_label` | string | Previous regime label (the label the region was in before). Empty for the first-ever recorded transition for a region. |
| `transition_driver` | string | Free-text driver string from the seed writer (e.g. "cross_source_surge"). May be empty. |
| `snapshot_id` | string | Snapshot id that materialized this transition. Points back to the full snapshot via intelligence:snapshot-by-id:v1:{snapshot_id}. |

#### `worldmonitor.intelligence.v1.RegionalBrief` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `region_id` | string | RegionalBrief is a weekly LLM-synthesized intelligence summary for one region. Written by scripts/seed-regional-briefs.mjs on a weekly cron. |
| `situation_recap` | string | RegionalBrief is a weekly LLM-synthesized intelligence summary for one region. Written by scripts/seed-regional-briefs.mjs on a weekly cron. |
| `regime_trajectory` | string | RegionalBrief is a weekly LLM-synthesized intelligence summary for one region. Written by scripts/seed-regional-briefs.mjs on a weekly cron. |
| `key_developments` | string[] | RegionalBrief is a weekly LLM-synthesized intelligence summary for one region. Written by scripts/seed-regional-briefs.mjs on a weekly cron. |
| `risk_outlook` | string | RegionalBrief is a weekly LLM-synthesized intelligence summary for one region. Written by scripts/seed-regional-briefs.mjs on a weekly cron. |
| `provider` | string | RegionalBrief is a weekly LLM-synthesized intelligence summary for one region. Written by scripts/seed-regional-briefs.mjs on a weekly cron. |
| `model` | string | RegionalBrief is a weekly LLM-synthesized intelligence summary for one region. Written by scripts/seed-regional-briefs.mjs on a weekly cron. |

#### `worldmonitor.intelligence.v1.RegionalNarrative` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `situation` | NarrativeSection | RegionalNarrative is the LLM-synthesized narrative layer. Every section links back to evidence via evidence_ids. |
| `balance_assessment` | NarrativeSection | RegionalNarrative is the LLM-synthesized narrative layer. Every section links back to evidence via evidence_ids. |
| `outlook_24h` | NarrativeSection | RegionalNarrative is the LLM-synthesized narrative layer. Every section links back to evidence via evidence_ids. |
| `outlook_7d` | NarrativeSection | RegionalNarrative is the LLM-synthesized narrative layer. Every section links back to evidence via evidence_ids. |
| `outlook_30d` | NarrativeSection | RegionalNarrative is the LLM-synthesized narrative layer. Every section links back to evidence via evidence_ids. |
| `watch_items` | NarrativeSection[] | RegionalNarrative is the LLM-synthesized narrative layer. Every section links back to evidence via evidence_ids. |

#### `worldmonitor.intelligence.v1.RegionalSnapshot` — 12 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `region_id` | string | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `meta` | SnapshotMeta | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `regime` | RegimeState | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `balance` | BalanceVector | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `actors` | ActorState[] | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `leverage_edges` | LeverageEdge[] | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `scenario_sets` | ScenarioSet[] | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `transmission_paths` | TransmissionPath[] | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `triggers` | TriggerLadder | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `mobility` | MobilityState | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `evidence` | EvidenceItem[] | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |
| `narrative` | RegionalNarrative | RegionalSnapshot is the canonical intelligence object for one region. See docs/internal/pro-regional-intelligence-upgrade.md for the full spec and shared/regions.types.d.ts for the authoritative TypeScript contract. |

#### `worldmonitor.intelligence.v1.Satellite` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Name of the satellite. |
| `country` | string | ISO country code of the operator/owner. |
| `type` | string | Purpose category (e.g., "sar", "optical", "military"). |
| `alt` | double | Orbital altitude in kilometers. |
| `velocity` | double | Velocity in km/s. |
| `inclination` | double | Orbital inclination in degrees. |
| `line1` | string | TLE line 1. |
| `line2` | string | TLE line 2. |

#### `worldmonitor.intelligence.v1.ScenarioLane` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | name: base / escalation / containment / fragmentation |
| `probability` | double | name: base / escalation / containment / fragmentation |
| `trigger_ids` | string[] | name: base / escalation / containment / fragmentation |
| `consequences` | string[] | name: base / escalation / containment / fragmentation |
| `transmissions` | TransmissionPath[] | name: base / escalation / containment / fragmentation |

#### `worldmonitor.intelligence.v1.ScenarioSet` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `horizon` | string | horizon: 24h / 7d / 30d |
| `lanes` | ScenarioLane[] | horizon: 24h / 7d / 30d |

#### `worldmonitor.intelligence.v1.SecFiling` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `form` | string | Total filings known for this CIK in the recent EDGAR submissions window. |
| `file_date` | string | Total filings known for this CIK in the recent EDGAR submissions window. |
| `description` | string | Total filings known for this CIK in the recent EDGAR submissions window. |
| `url` | string | Link to the filing index on sec.gov. |
| `items` | string[] | 8-K item codes disclosed in this filing (e.g. "2.02"), empty for other forms. |

#### `worldmonitor.intelligence.v1.SecFilingSearchResult` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `company` | string | Filer display name, such as "Apple Inc. (AAPL) (CIK 0000320193)". |
| `cik` | string | SEC Central Index Key of the primary filer (zero-padded 10 digits). |
| `form` | string | SEC Central Index Key of the primary filer (zero-padded 10 digits). |
| `file_date` | string | Filing date (YYYY-MM-DD). |
| `items` | string[] | 8-K item codes disclosed in this filing, empty for other forms. |
| `url` | string | Link to the filing document on sec.gov. |
| `accession` | string | EDGAR accession number, such as "0000320193-26-000123". |

#### `worldmonitor.intelligence.v1.SecFilings` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `total_filings` | int32 | Total filings known for this CIK in the recent EDGAR submissions window. |
| `recent_filings` | SecFiling[] | Total filings known for this CIK in the recent EDGAR submissions window. |

#### `worldmonitor.intelligence.v1.SecurityAdvisoryItem` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `link` | string |  |
| `pub_date` | string |  |
| `source` | string |  |
| `source_country` | string |  |
| `level` | string |  |
| `country` | string |  |

#### `worldmonitor.intelligence.v1.SignalEngagement` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `points` | int32 | Qualitative strength of the signal (e.g. "Strong", "Emerging"). |
| `comments` | int32 | Qualitative strength of the signal (e.g. "Strong", "Emerging"). |
| `stars` | int32 | Qualitative strength of the signal (e.g. "Strong", "Emerging"). |
| `forks` | int32 | Qualitative strength of the signal (e.g. "Strong", "Emerging"). |
| `mentions` | int32 | Qualitative strength of the signal (e.g. "Strong", "Emerging"). |

#### `worldmonitor.intelligence.v1.SignalSummary` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `total_signals` | int32 | Qualitative strength of the signal (e.g. "Strong", "Emerging"). |
| `strongest_signal` | CompanySignal | Qualitative strength of the signal (e.g. "Strong", "Emerging"). |
| `signal_diversity` | int32 | Qualitative strength of the signal (e.g. "Strong", "Emerging"). |

#### `worldmonitor.intelligence.v1.SnapshotMeta` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `snapshot_id` | string | SnapshotMeta carries the trust trail (versions, confidence, input freshness, narrative provenance, idempotency id). |
| `model_version` | string | SnapshotMeta carries the trust trail (versions, confidence, input freshness, narrative provenance, idempotency id). |
| `scoring_version` | string | SnapshotMeta carries the trust trail (versions, confidence, input freshness, narrative provenance, idempotency id). |
| `geography_version` | string | SnapshotMeta carries the trust trail (versions, confidence, input freshness, narrative provenance, idempotency id). |
| `snapshot_confidence` | double | SnapshotMeta carries the trust trail (versions, confidence, input freshness, narrative provenance, idempotency id). |
| `missing_inputs` | string[] | SnapshotMeta carries the trust trail (versions, confidence, input freshness, narrative provenance, idempotency id). |
| `stale_inputs` | string[] | SnapshotMeta carries the trust trail (versions, confidence, input freshness, narrative provenance, idempotency id). |
| `trigger_reason` | string | trigger_reason: scheduled_6h / regime_shift / trigger_activation / corridor_break / leverage_shift |
| `narrative_provider` | string | trigger_reason: scheduled_6h / regime_shift / trigger_activation / corridor_break / leverage_shift |
| `narrative_model` | string | trigger_reason: scheduled_6h / regime_shift / trigger_activation / corridor_break / leverage_shift |

#### `worldmonitor.intelligence.v1.SocialVelocityPost` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Reddit post ID. |
| `title` | string | Post title. |
| `subreddit` | string | Subreddit name (without r/ prefix). |
| `url` | string | Direct URL to the post. |
| `score` | int32 | Reddit score (upvotes - downvotes). |
| `upvote_ratio` | double | Upvote ratio (0.0–1.0). |
| `num_comments` | int32 | Number of comments. |
| `velocity_score` | double | Composite velocity score accounting for recency, score, and ratio. |

#### `worldmonitor.intelligence.v1.StrategicRisk` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `region` | string | Country or region identifier. |
| `level` | worldmonitor.core.v1.SeverityLevel | Risk level. |
| `factors` | string[] | Risk factors contributing to the assessment. |
| `trend` | worldmonitor.core.v1.TrendDirection | Trend direction. |

#### `worldmonitor.intelligence.v1.TelegramMessage` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique message identifier. |
| `channel_id` | string | Identifier of the originating channel. |
| `channel_name` | string | Human-readable name of the channel. |
| `text` | string | Sanitized message content. |
| `media_urls` | string[] | Direct links to associated media (images, videos). |
| `source_url` | string | Link to the original post on Telegram. |
| `topic` | string | Auto-classified topic based on content. |

#### `worldmonitor.intelligence.v1.TransmissionNode` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `node` | string |  |
| `impact_type` | string |  |
| `logic` | string |  |

#### `worldmonitor.intelligence.v1.TransmissionPath` — 14 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `start` | string | TransmissionPath describes how a regional event propagates to markets, logistics, mobility, or other domains. Typed for ranking and calibration. |
| `mechanism` | string | TransmissionPath describes how a regional event propagates to markets, logistics, mobility, or other domains. Typed for ranking and calibration. |
| `end` | string | TransmissionPath describes how a regional event propagates to markets, logistics, mobility, or other domains. Typed for ranking and calibration. |
| `severity` | string | severity: critical / high / medium / low |
| `corridor_id` | string | severity: critical / high / medium / low |
| `confidence` | double | severity: critical / high / medium / low |
| `latency_hours` | int32 | severity: critical / high / medium / low |
| `impacted_asset_class` | string | impacted_asset_class: crude / lng / container / fx / equity / agri / metals / ... |
| `impacted_regions` | string[] | impacted_asset_class: crude / lng / container / fx / equity / agri / metals / ... |
| `magnitude_low` | double | impacted_asset_class: crude / lng / container / fx / equity / agri / metals / ... |
| `magnitude_high` | double | impacted_asset_class: crude / lng / container / fx / equity / agri / metals / ... |
| `magnitude_unit` | string | magnitude_unit: usd_bbl / pct / usd_teu / basis_points / ... |
| `template_id` | string | magnitude_unit: usd_bbl / pct / usd_teu / basis_points / ... |
| `template_version` | string | magnitude_unit: usd_bbl / pct / usd_teu / basis_points / ... |

#### `worldmonitor.intelligence.v1.Trigger` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Trigger is a structured threshold assertion against a named metric. |
| `description` | string | Trigger is a structured threshold assertion against a named metric. |
| `threshold` | TriggerThreshold | Trigger is a structured threshold assertion against a named metric. |
| `activated` | bool | Trigger is a structured threshold assertion against a named metric. |
| `scenario_lane` | string | scenario_lane: base / escalation / containment / fragmentation |
| `evidence_ids` | string[] | scenario_lane: base / escalation / containment / fragmentation |

#### `worldmonitor.intelligence.v1.TriggerLadder` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `active` | Trigger[] | TriggerLadder buckets triggers by activation state. |
| `watching` | Trigger[] | TriggerLadder buckets triggers by activation state. |
| `dormant` | Trigger[] | TriggerLadder buckets triggers by activation state. |

#### `worldmonitor.intelligence.v1.TriggerThreshold` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `metric` | string | TriggerThreshold defines the metric/operator/value/window/baseline for deterministic trigger evaluation. |
| `operator` | string | operator: gt / gte / lt / lte / delta_gt / delta_lt |
| `value` | double | operator: gt / gte / lt / lte / delta_gt / delta_lt |
| `window_minutes` | int32 | operator: gt / gte / lt / lte / delta_gt / delta_lt |
| `baseline` | string | baseline: trailing_7d / trailing_30d / fixed |

#### `worldmonitor.intelligence.v1.XFeedItem` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique post identifier (handle:postId). |
| `account_id` | string | Numeric X account id (stable across handle renames). |
| `account_name` | string | Human-readable account label. |
| `handle` | string | Current @handle without the leading @. |
| `topic` | string | Curated topic bucket. |
| `permalink` | string | Canonical permalink to the original post. |
| `facts` | string[] | Derived facts only (no tweet body). |
| `has_media` | bool | Whether the post had media attachments when ingested. |
| `lang` | string | Publisher language code when provided by the API. |
| `content_state` | string | "active" or "deleted" (tombstoned within 24h of deletion). |

##### `intelligence` 域枚举

| enum | 取值 |
|---|---|
| `CrossSourceSignalSeverity` | `CROSS_SOURCE_SIGNAL_SEVERITY_UNSPECIFIED`, `CROSS_SOURCE_SIGNAL_SEVERITY_LOW`, `CROSS_SOURCE_SIGNAL_SEVERITY_MEDIUM`, `CROSS_SOURCE_SIGNAL_SEVERITY_HIGH`, `CROSS_SOURCE_SIGNAL_SEVERITY_CRITICAL` |
| `CrossSourceSignalType` | `CROSS_SOURCE_SIGNAL_TYPE_UNSPECIFIED`, `CROSS_SOURCE_SIGNAL_TYPE_COMPOSITE_ESCALATION`, `CROSS_SOURCE_SIGNAL_TYPE_THERMAL_SPIKE`, `CROSS_SOURCE_SIGNAL_TYPE_GPS_JAMMING`, `CROSS_SOURCE_SIGNAL_TYPE_MILITARY_FLIGHT_SURGE`, `CROSS_SOURCE_SIGNAL_TYPE_UNREST_SURGE`, `CROSS_SOURCE_SIGNAL_TYPE_OREF_ALERT_CLUSTER`, `CROSS_SOURCE_SIGNAL_TYPE_VIX_SPIKE`, `CROSS_SOURCE_SIGNAL_TYPE_COMMODITY_SHOCK`, `CROSS_SOURCE_SIGNAL_TYPE_CYBER_ESCALATION`, `CROSS_SOURCE_SIGNAL_TYPE_SHIPPING_DISRUPTION`, `CROSS_SOURCE_SIGNAL_TYPE_SANCTIONS_SURGE`, `CROSS_SOURCE_SIGNAL_TYPE_EARTHQUAKE_SIGNIFICANT`, `CROSS_SOURCE_SIGNAL_TYPE_RADIATION_ANOMALY`, `CROSS_SOURCE_SIGNAL_TYPE_INFRASTRUCTURE_OUTAGE`, `CROSS_SOURCE_SIGNAL_TYPE_WILDFIRE_ESCALATION`, `CROSS_SOURCE_SIGNAL_TYPE_DISPLACEMENT_SURGE`, `CROSS_SOURCE_SIGNAL_TYPE_FORECAST_DETERIORATION`, `CROSS_SOURCE_SIGNAL_TYPE_MARKET_STRESS`, `CROSS_SOURCE_SIGNAL_TYPE_WEATHER_EXTREME`, `CROSS_SOURCE_SIGNAL_TYPE_MEDIA_TONE_DETERIORATION`, `CROSS_SOURCE_SIGNAL_TYPE_RISK_SCORE_SPIKE`, `CROSS_SOURCE_SIGNAL_TYPE_PHYSICAL_PREMIUM_REGIME_TRANSITION`, `CROSS_SOURCE_SIGNAL_TYPE_REGULATORY_ACTION` |
| `DataFreshness` | `DATA_FRESHNESS_UNSPECIFIED`, `DATA_FRESHNESS_FRESH`, `DATA_FRESHNESS_STALE` |
| `InterferenceLevel` | `INTERFERENCE_LEVEL_UNSPECIFIED`, `INTERFERENCE_LEVEL_LOW`, `INTERFERENCE_LEVEL_MEDIUM`, `INTERFERENCE_LEVEL_HIGH` |
| `Mode` | `MODE_UNSPECIFIED`, `MODE_HISTORY` |

---

### 3.5 `supply_chain` — 9 个面板消费

- proto 文件：24 个（`get_bypass_options.proto`, `get_china_corridor_control_towers.proto`, `get_chokepoint_dependencies.proto`, `get_chokepoint_history.proto`, `get_chokepoint_status.proto`, `get_country_chokepoint_index.proto`, `get_country_cost_shock.proto`, `get_country_products.proto` …）
- message：100 个（业务数据 49，包装 51）；enum：5 个
- 消费面板：`chokepoint-strip`, `energy-complex`, `energy-crisis`, `energy-disruptions`, `energy-risk-overview`, `hormuz-tracker`, `pipeline-status`, `storage-facility-map`, `supply-chain`

#### `worldmonitor.supply_chain.v1.BypassCorridorOption` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |
| `name` | string | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |
| `type` | string | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |
| `added_transit_days` | int32 | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |
| `added_cost_multiplier` | double | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |
| `war_risk_tier` | string | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |
| `status` | CorridorStatus | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |
| `from_port` | GeoPoint | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |
| `to_port` | GeoPoint | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |

#### `worldmonitor.supply_chain.v1.BypassOption` — 12 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 0-100, percent of capacity blocked (default: 100) |
| `name` | string | 0-100, percent of capacity blocked (default: 100) |
| `type` | string | 0-100, percent of capacity blocked (default: 100) |
| `added_transit_days` | int32 | 0-100, percent of capacity blocked (default: 100) |
| `added_cost_multiplier` | double | 0-100, percent of capacity blocked (default: 100) |
| `capacity_constraint_tonnage` | int64 | 0-100, percent of capacity blocked (default: 100) |
| `suitable_cargo_types` | string[] | 0-100, percent of capacity blocked (default: 100) |
| `activation_threshold` | string | 0-100, percent of capacity blocked (default: 100) |
| `waypoint_chokepoint_ids` | string[] | 0-100, percent of capacity blocked (default: 100) |
| `live_score` | double | 0-100, percent of capacity blocked (default: 100) |
| `bypass_war_risk_tier` | WarRiskTier | 0-100, percent of capacity blocked (default: 100) |
| `notes` | string | 0-100, percent of capacity blocked (default: 100) |

#### `worldmonitor.supply_chain.v1.ChokepointDependency` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_iso2` | string | ISO 3166-1 alpha-2 code for the exposed country. |
| `country_name` | string | English display name for the exposed country. |
| `commodity_id` | string | Stable reviewed commodity mapping identifier. |
| `commodity` | string | Human-readable commodity name. |
| `transit_share` | double | Share of the country's mapped commodity exposure using this chokepoint, from 0 to 1. |
| `weighted_transit_share` | double | Disruption-adjusted transit share, from 0 to 1. |
| `score` | double | Commodity vulnerability score from 0 to 100; absent when evidence is insufficient. |
| `band` | string | Score band: low, moderate, high, or critical; empty when the score is absent. |
| `state` | string | Evidence state: ok, insufficient_data, or stale_input. |
| `reasons` | string[] | Machine-readable explanations for an insufficient or stale state. |
| `methodology_version` | string | Version of the scoring methodology that produced this dependency. |

#### `worldmonitor.supply_chain.v1.ChokepointExposureEntry` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `chokepoint_id` | string | Canonical chokepoint ID from the chokepoint registry. |
| `chokepoint_name` | string | Human-readable chokepoint name. |
| `exposure_score` | double | Exposure score 0-100; higher = more dependent on this chokepoint. With bilateral product data, sums routeCoverage * exporterShare * productWeight * 100 across matching products; fallback uses route overlap only. HS2 27 supported energy chokepoints receive a 1.5x boost capped at 100. |
| `coast_side` | string | Which ocean/basin side the country's ports face (atlantic, pacific, indian, med, multi, landlocked). |
| `shock_supported` | bool | Whether the shock model is supported for this chokepoint + hs2 combination. |

#### `worldmonitor.supply_chain.v1.ChokepointExposureSummary` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `chokepoint_id` | string | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |
| `chokepoint_name` | string | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |
| `exposure_pct` | int32 | BypassCorridorOption is a single enriched bypass corridor for the Route Explorer UI. Includes coordinate endpoints so the client can call MapContainer.setBypassRoutes directly without any client-side geometry lookup. |

#### `worldmonitor.supply_chain.v1.ChokepointInfo` — 17 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Name of the nearest active GDACS hazard event within the configured radius, or empty string when no nearby alert applies. |
| `name` | string | Name of the nearest active GDACS hazard event within the configured radius, or empty string when no nearby alert applies. |
| `lat` | double | Name of the nearest active GDACS hazard event within the configured radius, or empty string when no nearby alert applies. |
| `lon` | double | Name of the nearest active GDACS hazard event within the configured radius, or empty string when no nearby alert applies. |
| `disruption_score` | int32 | Name of the nearest active GDACS hazard event within the configured radius, or empty string when no nearby alert applies. |
| `status` | string | Traffic-light score badge: green (<20), yellow (20-49), or red (>=50). Not an operational closure taxonomy. |
| `active_warnings` | int32 | Traffic-light score badge: green (<20), yellow (20-49), or red (>=50). Not an operational closure taxonomy. |
| `congestion_level` | string | AIS-derived congestion level. "normal" is an observed AIS level, not a default. Empty when ais_snapshot_available is false. |
| `affected_routes` | string[] | AIS-derived congestion level. "normal" is an observed AIS level, not a default. Empty when ais_snapshot_available is false. |
| `description` | string | AIS-derived congestion level. "normal" is an observed AIS level, not a default. Empty when ais_snapshot_available is false. |
| `ais_disruptions` | int32 | AIS-derived congestion level. "normal" is an observed AIS level, not a default. Empty when ais_snapshot_available is false. |
| `directions` | string[] | AIS-derived congestion level. "normal" is an observed AIS level, not a default. Empty when ais_snapshot_available is false. |
| `transit_summary` | TransitSummary | AIS-derived congestion level. "normal" is an observed AIS level, not a default. Empty when ais_snapshot_available is false. |
| `flow_estimate` | FlowEstimate | AIS-derived congestion level. "normal" is an observed AIS level, not a default. Empty when ais_snapshot_available is false. |
| `war_risk_tier` | WarRiskTier | AIS-derived congestion level. "normal" is an observed AIS level, not a default. Empty when ais_snapshot_available is false. |
| `navigational_warnings_available` | bool | True when the NGA navigational-warning source returned a valid response, including a valid empty list. Missing legacy values fail closed. |
| `ais_snapshot_available` | bool | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |

#### `worldmonitor.supply_chain.v1.CommodityVulnerability` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_iso2` | string | ISO 3166-1 alpha-2 code for the scored country. |
| `country_name` | string | English display name for the scored country. |
| `commodity_id` | string | Stable reviewed commodity mapping identifier. |
| `commodity` | string | Human-readable commodity name. |
| `score` | double | Vulnerability score from 0 to 100; absent when evidence is insufficient. |
| `band` | string | Score band: low, moderate, high, or critical; empty when the score is absent. |
| `components` | VulnerabilityComponents | Normalized concentration, transit, and buffer components. |
| `coverage` | string[] | Source coverage labels that contributed to this score. |
| `state` | string | Evidence state: ok, insufficient_data, or stale_input. |
| `reasons` | string[] | Machine-readable explanations for an insufficient or stale state. |
| `methodology_version` | string | Version of the scoring methodology that produced this row. |

#### `worldmonitor.supply_chain.v1.CountryProduct` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `hs4` | string |  |
| `description` | string |  |
| `total_value` | double |  |
| `top_exporters` | ProductExporter[] |  |
| `year` | int32 |  |

#### `worldmonitor.supply_chain.v1.CriticalMineral` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `mineral` | string | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |
| `top_producers` | MineralProducer[] | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |
| `hhi` | double | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |
| `risk_rating` | string | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |
| `global_production` | double | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |
| `unit` | string | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |

#### `worldmonitor.supply_chain.v1.EnergyDisruptionEntry` — 15 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | If true, only return events with endAt empty (still ongoing). |
| `asset_id` | string | Maps to a pipeline or storage-facility id seeded elsewhere. |
| `asset_type` | string | One of: "pipeline" / "storage" |
| `event_type` | string | One of: "sabotage" / "sanction" / "maintenance" / "mechanical" / "weather" / "commercial" / "war" / "other" |
| `start_at` | string | One of: "sabotage" / "sanction" / "maintenance" / "mechanical" / "weather" / "commercial" / "war" / "other" |
| `end_at` | string | Empty string when event is still ongoing. |
| `capacity_offline_bcm_yr` | double | Headline-offline capacity (contextual — 0 when not applicable). |
| `capacity_offline_mbd` | double | Headline-offline capacity (contextual — 0 when not applicable). |
| `cause_chain` | string[] | Contributing causes, primary-first. |
| `short_description` | string | Contributing causes, primary-first. |
| `sources` | EnergyDisruptionSource[] | Contributing causes, primary-first. |
| `classifier_version` | string | Contributing causes, primary-first. |
| `classifier_confidence` | double | Contributing causes, primary-first. |
| `last_evidence_update` | string | Contributing causes, primary-first. |
| `countries` | string[] | Countries touched by the referenced asset (pipeline: fromCountry + toCountry + transitCountries; storage: country). Denormalised at seed time so CountryDeepDivePanel can filter events without a second RPC. Always non-empty in well-formed payloads; empty only if the upstream asset was removed without an event update. Per plan §R/#5 decision B. |

#### `worldmonitor.supply_chain.v1.EnergyDisruptionSource` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `authority` | string | Countries touched by the referenced asset (pipeline: fromCountry + toCountry + transitCountries; storage: country). Denormalised at seed time so CountryDeepDivePanel can filter events without a second RPC. Always non-empty in well-formed payloads; empty only if the upstream asset was removed without an event update. Per plan §R/#5 decision B. |
| `title` | string | Countries touched by the referenced asset (pipeline: fromCountry + toCountry + transitCountries; storage: country). Denormalised at seed time so CountryDeepDivePanel can filter events without a second RPC. Always non-empty in well-formed payloads; empty only if the upstream asset was removed without an event update. Per plan §R/#5 decision B. |
| `url` | string | Countries touched by the referenced asset (pipeline: fromCountry + toCountry + transitCountries; storage: country). Denormalised at seed time so CountryDeepDivePanel can filter events without a second RPC. Always non-empty in well-formed payloads; empty only if the upstream asset was removed without an event update. Per plan §R/#5 decision B. |
| `date` | string | Countries touched by the referenced asset (pipeline: fromCountry + toCountry + transitCountries; storage: country). Denormalised at seed time so CountryDeepDivePanel can filter events without a second RPC. Always non-empty in well-formed payloads; empty only if the upstream asset was removed without an event update. Per plan §R/#5 decision B. |
| `source_type` | string | Countries touched by the referenced asset (pipeline: fromCountry + toCountry + transitCountries; storage: country). Denormalised at seed time so CountryDeepDivePanel can filter events without a second RPC. Always non-empty in well-formed payloads; empty only if the upstream asset was removed without an event update. Per plan §R/#5 decision B. |

#### `worldmonitor.supply_chain.v1.FlowEstimate` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `current_mbd` | double | Current estimated flow in million barrels/day. Computed as baseline_mbd * flow_ratio. |
| `baseline_mbd` | double | EIA 2023 annual reference level in million barrels/day for the mapped seven-item live-flow subset. |
| `flow_ratio` | double | Latest 7-day PortWatch average divided by the preceding rolling baseline window of up to 90 days, clamped to 0.0-1.5. |
| `disrupted` | bool | True when each of the latest 3 daily ratios is below 85% of the same rolling baseline window. Separate from the green/yellow/red status badge. |
| `source` | FlowSource | Flow source: "portwatch-dwt" when DWT-majority coverage is used, otherwise "portwatch-counts" for vessel-count coverage. Those are the only two the seeder emits; FLOW_SOURCE_UNSPECIFIED means the cached estimate carried a coverage basis this taxonomy does not list, which the endpoint reports rather than passing through undeclared. |
| `hazard_alert_level` | string | Nearest active GDACS hazard alert level within the configured radius: "RED", "ORANGE", or empty string when no nearby alert applies.  Deliberately an open string rather than a closed enum like source: the empty string is a real published value here, and the pinned sebuf codegen drops an empty (sebuf.http.enum_value), so "" cannot be expressed as an enum's JSON name. Verified at both the zero and a non-zero value; see #6106 before retrying. |
| `hazard_alert_name` | string | Name of the nearest active GDACS hazard event within the configured radius, or empty string when no nearby alert applies. |

#### `worldmonitor.supply_chain.v1.FuelShortageEntry` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Fuel-shortage identifier to load with full evidence details. |
| `country` | string | Fuel-shortage identifier to load with full evidence details. |
| `product` | string | One of: "petrol" / "diesel" / "jet" / "heating_oil" |
| `severity` | string | One of: "confirmed" / "watch"  (classifier output — not a client-side derivation) |
| `first_seen` | string | One of: "confirmed" / "watch"  (classifier output — not a client-side derivation) |
| `last_confirmed` | string | One of: "confirmed" / "watch"  (classifier output — not a client-side derivation) |
| `resolved_at` | string | Empty string when not yet resolved. |
| `impact_types` | string[] | Observable consumer-facing impacts. Subset of: "stations_closed" / "rationing" / "flights_cancelled" / "import_cut" / "price_spike" |
| `cause_chain` | string[] | Contributing root causes, ordered primary-first. Subset of: "upstream_refinery" / "logistics" / "policy" / "chokepoint" / "sanction" / "war" / "import_cut" |
| `short_description` | string | Contributing root causes, ordered primary-first. Subset of: "upstream_refinery" / "logistics" / "policy" / "chokepoint" / "sanction" / "war" / "import_cut" |
| `evidence` | FuelShortageEvidence | Contributing root causes, ordered primary-first. Subset of: "upstream_refinery" / "logistics" / "policy" / "chokepoint" / "sanction" / "war" / "import_cut" |

#### `worldmonitor.supply_chain.v1.FuelShortageEvidence` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `evidence_sources` | FuelShortageEvidenceSource[] | Contributing root causes, ordered primary-first. Subset of: "upstream_refinery" / "logistics" / "policy" / "chokepoint" / "sanction" / "war" / "import_cut" |
| `first_regulator_confirmation` | string | ISO date of the first regulator confirmation, if any. Empty when severity is "watch" on press-only signal. |
| `classifier_version` | string | ISO date of the first regulator confirmation, if any. Empty when severity is "watch" on press-only signal. |
| `classifier_confidence` | double | ISO date of the first regulator confirmation, if any. Empty when severity is "watch" on press-only signal. |
| `last_evidence_update` | string | ISO date of the first regulator confirmation, if any. Empty when severity is "watch" on press-only signal. |

#### `worldmonitor.supply_chain.v1.FuelShortageEvidenceSource` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `authority` | string | ISO date of the first regulator confirmation, if any. Empty when severity is "watch" on press-only signal. |
| `title` | string | ISO date of the first regulator confirmation, if any. Empty when severity is "watch" on press-only signal. |
| `url` | string | ISO date of the first regulator confirmation, if any. Empty when severity is "watch" on press-only signal. |
| `date` | string | ISO date of the first regulator confirmation, if any. Empty when severity is "watch" on press-only signal. |
| `source_type` | string | One of: "regulator" / "operator" / "press" / "ais-relay" / "satellite" |

#### `worldmonitor.supply_chain.v1.GeoPoint` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lon` | double | GeoPoint is a [longitude, latitude] pair. |
| `lat` | double | GeoPoint is a [longitude, latitude] pair. |

#### `worldmonitor.supply_chain.v1.LatLon` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lat` | double | Server-derived public badge. One of: "flowing" / "reduced" / "offline" / "disputed" |
| `lon` | double | Server-derived public badge. One of: "flowing" / "reduced" / "offline" / "disputed" |

#### `worldmonitor.supply_chain.v1.MineralCountryHolding` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `commodity_id` | string |  |
| `commodity` | string |  |
| `stage` | string |  |
| `output` | double |  |
| `share` | double |  |
| `withheld` | bool |  |

#### `worldmonitor.supply_chain.v1.MineralCountryPortfolio` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iso2` | string |  |
| `holdings` | MineralCountryHolding[] |  |

#### `worldmonitor.supply_chain.v1.MineralCountryShare` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iso2` | string |  |
| `country` | string |  |
| `output` | double |  |
| `share` | double |  |
| `withheld` | bool |  |
| `estimated` | bool |  |
| `residual` | bool |  |

#### `worldmonitor.supply_chain.v1.MineralProducer` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country` | string | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |
| `country_code` | string | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |
| `production_tonnes` | double | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |
| `share_pct` | double | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |

#### `worldmonitor.supply_chain.v1.MineralProductionRecord` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `commodity_id` | string |  |
| `commodity` | string |  |
| `year` | int32 |  |
| `unit` | string |  |
| `mine` | MineralStageSnapshot |  |
| `refinery` | MineralStageSnapshot |  |
| `sources` | string[] |  |

#### `worldmonitor.supply_chain.v1.MineralStageSnapshot` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `year` | int32 |  |
| `unit` | string |  |
| `countries` | MineralCountryShare[] |  |
| `hhi` | double |  |
| `world_total` | double |  |
| `withheld_count` | int32 |  |

#### `worldmonitor.supply_chain.v1.MultiSectorCostShock` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `hs2` | string | HS2 chapter code (e.g. "27" mineral fuels, "85" electronics). |
| `hs2_label` | string | Friendly chapter label (e.g. "Energy", "Electronics"). |
| `import_value_annual` | double | Total annual import value (USD) for this sector. |
| `freight_added_pct_per_ton` | double | Bypass-corridor freight uplift fraction (0.10 == +10% per ton). |
| `war_risk_premium_bps` | int32 | War-risk insurance premium (basis points) sourced from the chokepoint tier. |
| `added_transit_days` | int32 | Bypass-corridor transit penalty (informational). |
| `total_cost_shock_per_day` | double | Bypass-corridor transit penalty (informational). |
| `total_cost_shock_30_days` | double | Bypass-corridor transit penalty (informational). |
| `total_cost_shock_90_days` | double | Bypass-corridor transit penalty (informational). |
| `total_cost_shock` | double | Cost for the requested closure_days window. |
| `closure_days` | int32 | Echoes the clamped closure duration used for total_cost_shock (1-365). |

#### `worldmonitor.supply_chain.v1.NumberRange` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `min` | int32 | Inclusive integer range for transit days / freight USD estimates. |
| `max` | int32 | Inclusive integer range for transit days / freight USD estimates. |

#### `worldmonitor.supply_chain.v1.OperatorStatement` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `text` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `url` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `date` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |

#### `worldmonitor.supply_chain.v1.PipelineEntry` — 16 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Revision entries from the auto-revision log for this asset. Sorted newest-first. Empty on first load of a newly-added pipeline. |
| `name` | string | Revision entries from the auto-revision log for this asset. Sorted newest-first. Empty on first load of a newly-added pipeline. |
| `operator` | string | Revision entries from the auto-revision log for this asset. Sorted newest-first. Empty on first load of a newly-added pipeline. |
| `commodity_type` | string | Either "gas" or "oil". |
| `from_country` | string | Either "gas" or "oil". |
| `to_country` | string | Either "gas" or "oil". |
| `transit_countries` | string[] | Either "gas" or "oil". |
| `capacity_bcm_yr` | double | Either "gas" or "oil". |
| `capacity_mbd` | double | Either "gas" or "oil". |
| `length_km` | int32 | Either "gas" or "oil". |
| `in_service` | int32 | Either "gas" or "oil". |
| `start_point` | LatLon | Either "gas" or "oil". |
| `end_point` | LatLon | Either "gas" or "oil". |
| `waypoints` | LatLon[] | Either "gas" or "oil". |
| `evidence` | PipelineEvidence | Either "gas" or "oil". |
| `public_badge` | string | Server-derived public badge. One of: "flowing" / "reduced" / "offline" / "disputed" |

#### `worldmonitor.supply_chain.v1.PipelineEvidence` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `physical_state` | string | One of: "flowing" / "reduced" / "offline" / "unknown" |
| `physical_state_source` | string | One of: "operator" / "regulator" / "press" / "satellite" / "ais-relay" |
| `operator_statement` | OperatorStatement | One of: "operator" / "regulator" / "press" / "satellite" / "ais-relay" |
| `commercial_state` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `sanction_refs` | SanctionRef[] | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `last_evidence_update` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `classifier_version` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `classifier_confidence` | double | One of: "under_contract" / "expired" / "suspended" / "unknown" |

#### `worldmonitor.supply_chain.v1.PipelineRevisionEntry` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `field_changed` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `previous_value` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `new_value` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `trigger` | string | One of: "classifier" / "source" / "decay" / "override" |
| `sources_used` | string[] | One of: "classifier" / "source" / "decay" / "override" |
| `classifier_version` | string | One of: "classifier" / "source" / "decay" / "override" |

#### `worldmonitor.supply_chain.v1.ProductExporter` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `partner_code` | int32 |  |
| `partner_iso2` | string |  |
| `value` | double |  |
| `share` | double |  |

#### `worldmonitor.supply_chain.v1.SanctionRef` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `authority` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `list_id` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `date` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `url` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |

#### `worldmonitor.supply_chain.v1.ShippingIndex` — 12 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `index_id` | string | Basis for the decision-grade period-over-period change. The custom JSON values preserve the lowercase strings already present in Redis and consumed by downstream matchers while exposing a closed taxonomy to generated clients and OpenAPI. |
| `name` | string | Basis for the decision-grade period-over-period change. The custom JSON values preserve the lowercase strings already present in Redis and consumed by downstream matchers while exposing a closed taxonomy to generated clients and OpenAPI. |
| `current_value` | double | Basis for the decision-grade period-over-period change. The custom JSON values preserve the lowercase strings already present in Redis and consumed by downstream matchers while exposing a closed taxonomy to generated clients and OpenAPI. |
| `previous_value` | double | Legacy display field. For the Shanghai Shipping Exchange indices (SCFI, CCFI) this DELIBERATELY falls back to the current level when the exchange published no comparable prior, so it cannot distinguish "unchanged week" from "no prior at all". Use prior_period_value for decision work. |
| `change_pct` | double | Legacy display field with the same fail-OPEN fallback as previous_value (a flat 0 when no prior exists). Use period_change_pct for decision work. |
| `unit` | string | Legacy display field with the same fail-OPEN fallback as previous_value (a flat 0 when no prior exists). Use period_change_pct for decision work. |
| `history` | ShippingRatePoint[] | Legacy display field with the same fail-OPEN fallback as previous_value (a flat 0 when no prior exists). Use period_change_pct for decision work. |
| `spike_alert` | bool | Legacy display field with the same fail-OPEN fallback as previous_value (a flat 0 when no prior exists). Use period_change_pct for decision work. |
| `period_change_pct` | double | Decision-grade period-over-period move in percent (#6066). Optional so a missing reading is ABSENT from the response rather than collapsing to 0, which would render identically to a real unchanged period. Fails CLOSED: present only when the publisher reported its own percentage or a comparable prior-period level. A single index level never becomes a change. The endpoint normalizes a missing reading to ABSENT (canonical ProtoJSON: serializers omit, parsers treat null as unset) — a plain JSON client can still tell absent from null, so read absence, not null. |
| `period_change_basis` | PeriodChangeBasis | Provenance of period_change_pct: "publisher_reported" when the exchange published the percentage itself, or "derived_from_prior_period_level" when it was computed from prior_period_value. Absent whenever period_change_pct is absent. |
| `prior_period_value` | double | The publisher's own prior-period index level that period_change_pct was measured against. Absent when the publisher shipped no comparable prior. |
| `prior_period_date` | string | Observation date (YYYY-MM-DD) of prior_period_value, as published. Absent whenever prior_period_value is absent, or when the publisher dated the level only implicitly. |

#### `worldmonitor.supply_chain.v1.ShippingRatePoint` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string |  |
| `value` | double |  |

#### `worldmonitor.supply_chain.v1.ShippingStressCarrier` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `symbol` | string | Ticker or identifier (e.g., "BDRY", "ZIM"). |
| `name` | string | Human-readable name. |
| `price` | double | Current price. |
| `change_pct` | double | Percentage change from previous close. |
| `carrier_type` | string | Carrier type: "etf" / "carrier" / "index". |
| `sparkline` | double[] | 30-day price sparkline. |

#### `worldmonitor.supply_chain.v1.StorageEvidence` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `physical_state` | string | One of: "operational" / "reduced" / "offline" / "under_construction" / "unknown" |
| `physical_state_source` | string | One of: "operator" / "regulator" / "press" / "satellite" / "ais-relay" |
| `operator_statement` | StorageOperatorStatement | One of: "operator" / "regulator" / "press" / "satellite" / "ais-relay" |
| `commercial_state` | string | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `sanction_refs` | StorageSanctionRef[] | One of: "under_contract" / "expired" / "suspended" / "unknown" |
| `fill_disclosed` | bool | Whether working-gas / stock-level fill is publicly disclosed for this asset. LNG export terminals, for instance, tend NOT to disclose; UGS sites in Europe are required to disclose via GIE AGSI+. |
| `fill_source` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `last_evidence_update` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `classifier_version` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `classifier_confidence` | double | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |

#### `worldmonitor.supply_chain.v1.StorageFacilityEntry` — 13 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Storage facility identifier to load with full evidence details. |
| `name` | string | Storage facility identifier to load with full evidence details. |
| `operator` | string | Storage facility identifier to load with full evidence details. |
| `facility_type` | string | One of: "ugs" / "spr" / "lng_export" / "lng_import" / "crude_tank_farm" |
| `country` | string | One of: "ugs" / "spr" / "lng_export" / "lng_import" / "crude_tank_farm" |
| `location` | StorageLatLon | One of: "ugs" / "spr" / "lng_export" / "lng_import" / "crude_tank_farm" |
| `capacity_twh` | double | Working capacity in the facility's native unit (see working_capacity_unit). Exactly ONE of these is populated per facility, chosen by facility_type: ugs                              → capacity_twh spr, crude_tank_farm             → capacity_mb lng_export, lng_import           → capacity_mtpa |
| `capacity_mb` | double | Working capacity in the facility's native unit (see working_capacity_unit). Exactly ONE of these is populated per facility, chosen by facility_type: ugs                              → capacity_twh spr, crude_tank_farm             → capacity_mb lng_export, lng_import           → capacity_mtpa |
| `capacity_mtpa` | double | Working capacity in the facility's native unit (see working_capacity_unit). Exactly ONE of these is populated per facility, chosen by facility_type: ugs                              → capacity_twh spr, crude_tank_farm             → capacity_mb lng_export, lng_import           → capacity_mtpa |
| `working_capacity_unit` | string | One of: "TWh" / "Mb" / "Mtpa" |
| `in_service` | int32 | One of: "TWh" / "Mb" / "Mtpa" |
| `evidence` | StorageEvidence | One of: "TWh" / "Mb" / "Mtpa" |
| `public_badge` | string | Server-derived public badge. One of: "operational" / "reduced" / "offline" / "disputed" |

#### `worldmonitor.supply_chain.v1.StorageFacilityRevisionEntry` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `field_changed` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `previous_value` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `new_value` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `trigger` | string | One of: "classifier" / "source" / "decay" / "override" |
| `sources_used` | string[] | One of: "classifier" / "source" / "decay" / "override" |
| `classifier_version` | string | One of: "classifier" / "source" / "decay" / "override" |

#### `worldmonitor.supply_chain.v1.StorageLatLon` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lat` | double | Server-derived public badge. One of: "operational" / "reduced" / "offline" / "disputed" |
| `lon` | double | Server-derived public badge. One of: "operational" / "reduced" / "offline" / "disputed" |

#### `worldmonitor.supply_chain.v1.StorageOperatorStatement` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `text` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `url` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `date` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |

#### `worldmonitor.supply_chain.v1.StorageSanctionRef` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `authority` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `list_id` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `date` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |
| `url` | string | Source of the disclosed fill series ("GIE AGSI+", "EIA SPR weekly stock report", etc.). Empty when fill_disclosed=false. |

#### `worldmonitor.supply_chain.v1.StrategicProduct` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `hs4` | string |  |
| `label` | string |  |
| `total_value_usd` | double |  |
| `top_exporter_iso2` | string |  |
| `top_exporter_share` | double |  |
| `primary_chokepoint_id` | string |  |

#### `worldmonitor.supply_chain.v1.TransitDayCount` — 14 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `tanker` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `cargo` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `other` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `total` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `container` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `dry_bulk` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `general_cargo` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `roro` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `cap_container` | double | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `cap_dry_bulk` | double | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `cap_general_cargo` | double | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `cap_roro` | double | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `cap_tanker` | double | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |

#### `worldmonitor.supply_chain.v1.TransitSummary` — 13 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `today_total` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `today_tanker` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `today_cargo` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `today_other` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `wow_change_pct` | double | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `history` | TransitDayCount[] | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `risk_level` | string | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `incident_count_7d` | int32 | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `disruption_pct` | double | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `risk_summary` | string | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `risk_report_action` | string | True when the AIS snapshot source returned a valid response. This owns both ais_disruptions and congestion_level. Missing legacy values fail closed. |
| `data_available` | bool | False when the upstream portwatch source did not return history for this chokepoint in the current cycle — wow_change_pct and history are then zero-state fill, not genuine readings. Client should render a "transit data unavailable" indicator and skip chart rendering.  This says nothing about today_* — those come from the relay's in-memory AIS window, a separate source. Read today_counts_available for those. |
| `today_counts_available` | bool | False when the relay's 24h AIS window held no crossings for this chokepoint, so today_total/tanker/cargo/other are unsupplied rather than a measured zero (#7457). The fields stay 0 to keep the int32 contract; clients must withhold the count when this is false instead of publishing the 0. True means the counts are a real measurement. |

#### `worldmonitor.supply_chain.v1.VulnerabilityBuffer` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `state` | string | Buffer evidence state: known or unknown. |
| `vulnerability` | double | Residual vulnerability after the available buffer, from 0 to 1. |
| `kind` | string | Buffer source class, such as stocks_to_use or gas_storage_fill. |
| `inputs` | VulnerabilityInput[] | Provenance observations used for the buffer. |

#### `worldmonitor.supply_chain.v1.VulnerabilityComponents` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `source_concentration` | VulnerabilitySourceConcentration | Supplier and producer concentration component. |
| `transit_exposure` | VulnerabilityTransitExposure | Maritime chokepoint transit component. |
| `buffer` | VulnerabilityBuffer | Strategic stock or storage buffer component. |

#### `worldmonitor.supply_chain.v1.VulnerabilityInput` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `source_key` | string | Redis or source-contract key that supplied this observation. |
| `source_name` | string | Human-readable source name. |
| `source_url` | string | Public source or methodology URL. |
| `value` | double | Numeric observation used by the scorer; absent when the source is unknown. |
| `year` | int32 | Observation year when the source publishes annual data. |
| `fetched_at` | string | ISO 8601 timestamp when the source snapshot was fetched. |
| `stale` | bool | True when this observation is older than its source-specific freshness budget. |
| `detail` | string | Bounded explanation of the mapped input. |

#### `worldmonitor.supply_chain.v1.VulnerabilitySourceConcentration` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `value` | double | Combined supplier or producer concentration from 0 to 1. |
| `import_hhi` | double | Import supplier Herfindahl-Hirschman concentration from 0 to 1. |
| `mine_hhi` | double | Mine-stage production concentration from 0 to 1. |
| `refinery_hhi` | double | Refinery-stage production concentration from 0 to 1. |
| `production_hhi` | double | Combined mine and refinery production concentration from 0 to 1. |
| `production_coverage` | string | Producer-stage coverage used for the combined concentration. |
| `coverage` | string | Overall concentration coverage state. |
| `inputs` | VulnerabilityInput[] | Provenance observations used for concentration. |

#### `worldmonitor.supply_chain.v1.VulnerabilityTransitExposure` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `value` | double | Combined chokepoint exposure from 0 to 1. |
| `chokepoints` | VulnerabilityTransitRoute[] | Mapped chokepoints that contribute to the combined exposure. |

#### `worldmonitor.supply_chain.v1.VulnerabilityTransitRoute` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Stable chokepoint identifier. |
| `name` | string | Human-readable chokepoint name. |
| `transit_share` | double | Country and commodity exposure share using this route, from 0 to 1. |
| `weighted_transit_share` | double | Transit share after the current disruption multiplier, from 0 to 1. |
| `status` | string | Current route state: baseline, disrupted, or unknown when the flow row is absent. |
| `inputs` | VulnerabilityInput[] | Provenance observations used for the route exposure. |

##### `supply_chain` 域枚举

| enum | 取值 |
|---|---|
| `CorridorStatus` | `CORRIDOR_STATUS_UNSPECIFIED`, `CORRIDOR_STATUS_ACTIVE`, `CORRIDOR_STATUS_PROPOSED`, `CORRIDOR_STATUS_UNAVAILABLE` |
| `DependencyFlag` | `DEPENDENCY_FLAG_UNSPECIFIED`, `DEPENDENCY_FLAG_SINGLE_SOURCE_CRITICAL`, `DEPENDENCY_FLAG_SINGLE_CORRIDOR_CRITICAL`, `DEPENDENCY_FLAG_COMPOUND_RISK`, `DEPENDENCY_FLAG_DIVERSIFIABLE` |
| `FlowSource` | `FLOW_SOURCE_UNSPECIFIED`, `FLOW_SOURCE_PORTWATCH_DWT`, `FLOW_SOURCE_PORTWATCH_COUNTS` |
| `PeriodChangeBasis` | `PERIOD_CHANGE_BASIS_UNSPECIFIED`, `PERIOD_CHANGE_BASIS_PUBLISHER_REPORTED`, `PERIOD_CHANGE_BASIS_DERIVED_FROM_PRIOR_PERIOD_LEVEL` |
| `WarRiskTier` | `WAR_RISK_TIER_UNSPECIFIED`, `WAR_RISK_TIER_NORMAL`, `WAR_RISK_TIER_ELEVATED`, `WAR_RISK_TIER_HIGH`, `WAR_RISK_TIER_CRITICAL`, `WAR_RISK_TIER_WAR_ZONE` |

---

### 3.6 `positive_events` — 7 个面板消费

- proto 文件：2 个（`list_positive_geo_events.proto`, `service.proto`）
- message：3 个（业务数据 1，包装 2）；enum：0 个
- 消费面板：`counters`, `digest`, `positive-feed`, `progress`, `renewable`, `species`, `spotlight`

#### `worldmonitor.positive_events.v1.PositiveGeoEvent` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `latitude` | double |  |
| `longitude` | double |  |
| `name` | string |  |
| `category` | string |  |
| `count` | int32 |  |

---

### 3.7 `safety` — 7 个面板消费

- proto 文件：2 个（`service.proto`, `toronto_safety.proto`）
- message：4 个（业务数据 2，包装 2）；enum：0 个
- 消费面板：`disease-outbreaks`, `fuel-shortages`, `internet-disruptions`, `population-exposure`, `service-status`, `storage-facility-map`, `toronto-safety`

#### `worldmonitor.safety.v1.TorontoAnnualAggregate` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Optional event-year filter for tps_calls_attended. |
| `event_year` | int32 | Optional event-year filter for tps_calls_attended. |
| `division_original` | string | Optional event-year filter for tps_calls_attended. |
| `division_final` | string | Optional event-year filter for tps_calls_attended. |
| `neighbourhood` | string | Optional event-year filter for tps_calls_attended. |
| `event_count` | double | Optional event-year filter for tps_calls_attended. |
| `incident_point` | bool | Optional event-year filter for tps_calls_attended. |

#### `worldmonitor.safety.v1.TorontoReportedOccurrence` — 13 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Optional event-year filter for tps_calls_attended. |
| `event_unique_id` | string | Optional event-year filter for tps_calls_attended. |
| `report_date` | string | Optional event-year filter for tps_calls_attended. |
| `occurrence_date` | string | Optional event-year filter for tps_calls_attended. |
| `division` | string | Optional event-year filter for tps_calls_attended. |
| `location_type` | string | Optional event-year filter for tps_calls_attended. |
| `premises_type` | string | Optional event-year filter for tps_calls_attended. |
| `offence` | string | Optional event-year filter for tps_calls_attended. |
| `csi_category` | string | Optional event-year filter for tps_calls_attended. |
| `neighbourhood` | string | Optional event-year filter for tps_calls_attended. |
| `longitude` | double | Optional event-year filter for tps_calls_attended. |
| `latitude` | double | Optional event-year filter for tps_calls_attended. |
| `approximate` | bool | Optional event-year filter for tps_calls_attended. |

---

### 3.8 `research` — 6 个面板消费

- proto 文件：6 个（`list_arxiv_papers.proto`, `list_hackernews_items.proto`, `list_tech_events.proto`, `list_trending_repos.proto`, `research_item.proto`, `service.proto`）
- message：13 个（业务数据 5，包装 8）；enum：0 个
- 消费面板：`ai-regulation`, `breakthroughs`, `events`, `funding`, `github`, `unicorns`

#### `worldmonitor.research.v1.ArxivPaper` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `summary` | string | Paper abstract (may be truncated). |
| `authors` | string[] | Author names. |
| `categories` | string[] | arXiv categories (e.g., "cs.AI", "cs.LG"). |
| `url` | string | URL to the paper. |

#### `worldmonitor.research.v1.GithubRepo` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `description` | string | Repository description. |
| `language` | string | Primary programming language. |
| `stars_today` | int32 | Stars gained in the trending period. |
| `forks` | int32 | Number of open forks. |
| `url` | string | Repository URL. |

#### `worldmonitor.research.v1.HackernewsItem` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int32 | HN item ID. |
| `url` | string | URL (empty for Ask HN / Show HN text posts). |
| `comment_count` | int32 | Number of comments. |
| `by` | string | Author username. |

#### `worldmonitor.research.v1.TechEvent` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique event identifier. |
| `title` | string | Event title. |
| `type` | string | Event type: "conference", "earnings", "ipo", "other". |
| `location` | string | Location description. |
| `coords` | TechEventCoords | Geocoded coordinates (may be absent). |
| `start_date` | string | Start date (YYYY-MM-DD). |
| `end_date` | string | End date (YYYY-MM-DD). |
| `url` | string | Event URL. |
| `source` | string | Source: "techmeme", "dev.events", "curated". |
| `description` | string | Event description. |

#### `worldmonitor.research.v1.TechEventCoords` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lat` | double | Latitude. |
| `lng` | double | Longitude. |
| `country` | string | Country name or code. |
| `original` | string | Original location string before normalization. |
| `virtual` | bool | Whether this is a virtual/online event. |

---

### 3.9 `military` — 3 个面板消费

- proto 文件：14 个（`get_aircraft_details.proto`, `get_aircraft_details_batch.proto`, `get_defense_industrial_base.proto`, `get_theater_posture.proto`, `get_usni_fleet_report.proto`, `get_wingbits_live_flight.proto`, `get_wingbits_status.proto`, `list_defense_patents.proto` …）
- message：37 个（业务数据 16，包装 21）；enum：5 个
- 消费面板：`defense-patents`, `escalation-correlation`, `military-correlation`

#### `worldmonitor.military.v1.AircraftDetails` — 15 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `icao24` | string | ICAO 24-bit hex address. |
| `registration` | string | Aircraft registration number. |
| `manufacturer_icao` | string | ICAO manufacturer code. |
| `manufacturer_name` | string | Full manufacturer name. |
| `model` | string | Aircraft model. |
| `typecode` | string | ICAO type designator code. |
| `serial_number` | string | Manufacturer serial number. |
| `icao_aircraft_type` | string | ICAO aircraft type designator. |
| `operator` | string | Operator name. |
| `operator_callsign` | string | Operator callsign. |
| `operator_icao` | string | Operator ICAO code. |
| `owner` | string | Registered owner. |
| `built` | string | Build date. |
| `engines` | string | Engine description. |
| `category_description` | string | ICAO category description. |

#### `worldmonitor.military.v1.ArmsSupplierDependency` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `supplier_iso2` | string | ISO 3166-1 alpha-2 country code. |
| `tiv_share` | double | ISO 3166-1 alpha-2 country code. |

#### `worldmonitor.military.v1.BattleForceSummary` — 0 字段

（oneof / map 等结构，见 proto 原文）

#### `worldmonitor.military.v1.DefenseIndustrialMetric` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `available` | bool | ISO 3166-1 alpha-2 country code. |
| `value` | double | ISO 3166-1 alpha-2 country code. |
| `year` | int32 | ISO 3166-1 alpha-2 country code. |
| `previous_value` | double | ISO 3166-1 alpha-2 country code. |
| `previous_year` | int32 | ISO 3166-1 alpha-2 country code. |
| `source` | string | ISO 3166-1 alpha-2 country code. |

#### `worldmonitor.military.v1.DefensePatentFiling` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `patent_id` | string | USPTO patent ID. |
| `title` | string | Patent title. |
| `date` | string | Filing date (YYYY-MM-DD). |
| `assignee` | string | Primary assignee organization name. |
| `cpc_code` | string | CPC classification code (e.g. "H04B", "F42B"). |
| `cpc_desc` | string | CPC class description. |
| `abstract` | string | Compatibility field retained for existing clients. Always empty because USPTO Open Data Portal Patent File Wrapper records do not include abstracts. |
| `url` | string | USPTO patent URL. |

#### `worldmonitor.military.v1.FlightEnrichment` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `manufacturer` | string | Aircraft manufacturer. |
| `owner` | string | Registered owner. |
| `operator_name` | string | Operator name. |
| `type_code` | string | ICAO type code. |
| `built_year` | string | Year the aircraft was built. |
| `confirmed_military` | bool | Whether confirmed as military. |
| `military_branch` | string | Military branch designation. |

#### `worldmonitor.military.v1.MilitaryBaseCluster` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `latitude` | double | Optional country filter for military bases. |
| `longitude` | double | Optional country filter for military bases. |
| `count` | int32 | Optional country filter for military bases. |
| `dominant_type` | string | Optional country filter for military bases. |
| `expansion_zoom` | int32 | Optional country filter for military bases. |

#### `worldmonitor.military.v1.MilitaryBaseEntry` — 15 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Optional country filter for military bases. |
| `name` | string | Optional country filter for military bases. |
| `latitude` | double | Optional country filter for military bases. |
| `longitude` | double | Optional country filter for military bases. |
| `kind` | string | Optional country filter for military bases. |
| `country_iso2` | string | Optional country filter for military bases. |
| `type` | string | Optional country filter for military bases. |
| `tier` | int32 | Optional country filter for military bases. |
| `cat_airforce` | bool | Optional country filter for military bases. |
| `cat_naval` | bool | Optional country filter for military bases. |
| `cat_nuclear` | bool | Optional country filter for military bases. |
| `cat_space` | bool | Optional country filter for military bases. |
| `cat_training` | bool | Optional country filter for military bases. |
| `branch` | string | Optional country filter for military bases. |
| `status` | string | Optional country filter for military bases. |

#### `worldmonitor.military.v1.MilitaryFlight` — 21 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `callsign` | string | Aircraft callsign. |
| `hex_code` | string | ICAO 24-bit hex address. Canonical form is UPPERCASE — seeders and handlers must uppercase before writing so hex-based lookups (src/services/military-flights.ts:getFlightByHex) match regardless of upstream source casing. |
| `registration` | string | Aircraft registration number. |
| `aircraft_type` | MilitaryAircraftType | Type of military aircraft. |
| `aircraft_model` | string | Specific aircraft model (e.g., "F-35A", "C-17A"). |
| `operator` | MilitaryOperator | Operating military branch or force. |
| `operator_country` | string | Country operating the aircraft (ISO 3166-1 alpha-2). |
| `location` | worldmonitor.core.v1.GeoCoordinates | Current position. |
| `altitude` | double | Altitude in feet. |
| `heading` | double | Heading in degrees. |
| `speed` | double | Speed in knots. |
| `vertical_rate` | double | Vertical rate in feet per minute. |
| `on_ground` | bool | Whether the aircraft is on the ground. |
| `squawk` | string | Transponder squawk code. |
| `origin` | string | ICAO code of the origin airport. |
| `destination` | string | ICAO code of the destination airport. |
| `confidence` | MilitaryConfidence | Confidence in aircraft identification. |
| `is_interesting` | bool | Whether flagged for unusual activity. |
| `note` | string | Analyst note. |
| `enrichment` | FlightEnrichment | Wingbits enrichment data. |
| `source` | string | Provider that supplied this observation (for example, "adsb.lol" or "opensky"). |

#### `worldmonitor.military.v1.MilitaryFlightCluster` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique cluster identifier. |
| `name` | string | Descriptive name of the cluster. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Cluster centroid location. |
| `flight_count` | int32 | Number of flights in the cluster. |
| `flights` | MilitaryFlight[] | The flights in this cluster. |
| `dominant_operator` | MilitaryOperator | Dominant operator in the cluster. |
| `activity_type` | MilitaryActivityType | Assessed activity type. |

#### `worldmonitor.military.v1.MilitaryVessel` — 19 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `mmsi` | string | Maritime Mobile Service Identity. |
| `name` | string | Vessel name. |
| `vessel_type` | MilitaryVesselType | Type of military vessel. |
| `ais_ship_type` | string | Human-readable AIS ship type (e.g., "Cargo", "Tanker"). |
| `hull_number` | string | Hull number (e.g., "DDG-51", "CVN-78"). |
| `operator` | MilitaryOperator | Operating military branch or force. |
| `operator_country` | string | Country operating the vessel (ISO 3166-1 alpha-2). |
| `location` | worldmonitor.core.v1.GeoCoordinates | Current position. |
| `heading` | double | Heading in degrees. |
| `speed` | double | Speed in knots. |
| `course` | double | Course over ground in degrees. |
| `destination` | string | AIS-reported destination. |
| `ais_gap_minutes` | int32 | Minutes since last AIS signal. |
| `is_dark` | bool | Whether AIS appears disabled or suspicious. |
| `near_chokepoint` | string | Name of nearby strategic waterway, if any. |
| `near_base` | string | Name of nearby naval base, if any. |
| `confidence` | MilitaryConfidence | Confidence in vessel identification. |
| `is_interesting` | bool | Whether flagged for unusual activity. |
| `note` | string | Analyst note. |

#### `worldmonitor.military.v1.TheaterPosture` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `theater` | string | Theater name (e.g., "Indo-Pacific", "European", "Middle East"). |
| `posture_level` | string | Overall posture assessment. |
| `active_flights` | int32 | Number of active flights in the theater. |
| `tracked_vessels` | int32 | Number of tracked vessels in the theater. |
| `active_operations` | string[] | Notable ongoing operations. |

#### `worldmonitor.military.v1.USNIFleetReport` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `article_url` | string | URL of the source article. |
| `article_date` | string | Publication date of the article. |
| `article_title` | string | Title of the article. |
| `battle_force_summary` | BattleForceSummary | Battle force summary statistics, if present in the article. |
| `vessels` | USNIVessel[] | All vessels identified in the article. |
| `strike_groups` | USNIStrikeGroup[] | Carrier strike groups identified in the article. |
| `regions` | string[] | Unique region names mentioned in the article. |
| `parsing_warnings` | string[] | Warnings generated during parsing. |

#### `worldmonitor.military.v1.USNIStrikeGroup` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Strike group name (e.g., "Abraham Lincoln Carrier Strike Group"). |
| `carrier` | string | Carrier name and hull (e.g., "USS Abraham Lincoln (CVN-72)"). |
| `air_wing` | string | Assigned air wing (e.g., "Carrier Air Wing Nine"). |
| `destroyer_squadron` | string | Assigned destroyer squadron. |
| `escorts` | string[] | Escort vessels in the strike group. |

#### `worldmonitor.military.v1.USNIVessel` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `vessel_type` | string | Vessel type classification (e.g., "carrier", "destroyer", "submarine"). |
| `region` | string | Region name where the vessel is operating. |
| `region_lat` | double | Approximate latitude for the region. |
| `region_lon` | double | Approximate longitude for the region. |
| `deployment_status` | string | Deployment status (e.g., "deployed", "underway", "in-port", "unknown"). |
| `home_port` | string | Home port, if identified from the article text. |
| `strike_group` | string | Strike group assignment, if any. |
| `activity_description` | string | Brief activity description parsed from article prose. |
| `article_url` | string | URL of the USNI article this vessel was parsed from. |
| `article_date` | string | Publication date of the USNI article. |

#### `worldmonitor.military.v1.WingbitsLiveFlight` — 29 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `icao24` | string | ICAO 24-bit hex address. |
| `callsign` | string | Live callsign. |
| `lat` | double | Latitude in decimal degrees. |
| `lon` | double | Longitude in decimal degrees. |
| `altitude` | double | Altitude in feet. |
| `speed` | double | Ground speed in knots. |
| `heading` | double | Track/heading in degrees. |
| `vertical_rate` | double | Vertical rate in feet per minute (positive = climb, negative = descent). |
| `registration` | string | Aircraft registration number. |
| `model` | string | Aircraft model (e.g. "PC-12/45"). |
| `operator` | string | Operator name. |
| `on_ground` | bool | True if the aircraft is on the ground. |
| `last_seen` | int64 | Unix timestamp of the last position update. |
| `dep_iata` | string | Schedule — from ecs-api.wingbits.com/v1/flights/schedule/{callsign} Departure airport IATA code (e.g. "FJR"). |
| `arr_iata` | string | Arrival airport IATA code (e.g. "BOM"). |
| `dep_time_utc` | string | Scheduled departure time UTC (ISO 8601). |
| `arr_time_utc` | string | Scheduled arrival time UTC (ISO 8601). |
| `dep_estimated_utc` | string | Estimated departure time UTC (ISO 8601). |
| `arr_estimated_utc` | string | Estimated arrival time UTC (ISO 8601). |
| `dep_delayed_min` | int32 | Departure delay in minutes (negative = early). |
| `arr_delayed_min` | int32 | Arrival delay in minutes (negative = early). |
| `flight_status` | string | Flight status string (e.g. "en-route", "landed", "scheduled"). |
| `flight_duration_min` | int32 | Scheduled flight duration in minutes. |
| `arr_terminal` | string | Arrival terminal (e.g. "2"). |
| `photo_url` | string | Photo — from api.planespotters.net/pub/photos/hex/{icao24} Aircraft photo URL (large thumbnail ~497x280). |
| `photo_link` | string | Permalink to the photo page on planespotters.net. |
| `photo_credit` | string | Photographer credit name. |
| `callsign_iata` | string | Airline — resolved server-side from the ICAO callsign prefix. IATA-equivalent callsign (e.g. "EK528" for ICAO "UAE528"). Empty if no mapping. |
| `airline_name` | string | Airline name (e.g. "Emirates"). Empty if no mapping. |

##### `military` 域枚举

| enum | 取值 |
|---|---|
| `MilitaryActivityType` | `MILITARY_ACTIVITY_TYPE_UNSPECIFIED`, `MILITARY_ACTIVITY_TYPE_EXERCISE`, `MILITARY_ACTIVITY_TYPE_PATROL`, `MILITARY_ACTIVITY_TYPE_TRANSPORT`, `MILITARY_ACTIVITY_TYPE_DEPLOYMENT`, `MILITARY_ACTIVITY_TYPE_TRANSIT`, `MILITARY_ACTIVITY_TYPE_UNKNOWN` |
| `MilitaryAircraftType` | `MILITARY_AIRCRAFT_TYPE_UNSPECIFIED`, `MILITARY_AIRCRAFT_TYPE_FIGHTER`, `MILITARY_AIRCRAFT_TYPE_BOMBER`, `MILITARY_AIRCRAFT_TYPE_TRANSPORT`, `MILITARY_AIRCRAFT_TYPE_TANKER`, `MILITARY_AIRCRAFT_TYPE_AWACS`, `MILITARY_AIRCRAFT_TYPE_RECONNAISSANCE`, `MILITARY_AIRCRAFT_TYPE_HELICOPTER`, `MILITARY_AIRCRAFT_TYPE_DRONE`, `MILITARY_AIRCRAFT_TYPE_PATROL`, `MILITARY_AIRCRAFT_TYPE_SPECIAL_OPS`, `MILITARY_AIRCRAFT_TYPE_VIP`, `MILITARY_AIRCRAFT_TYPE_UNKNOWN` |
| `MilitaryConfidence` | `MILITARY_CONFIDENCE_UNSPECIFIED`, `MILITARY_CONFIDENCE_LOW`, `MILITARY_CONFIDENCE_MEDIUM`, `MILITARY_CONFIDENCE_HIGH` |
| `MilitaryOperator` | `MILITARY_OPERATOR_UNSPECIFIED`, `MILITARY_OPERATOR_USAF`, `MILITARY_OPERATOR_USN`, `MILITARY_OPERATOR_USMC`, `MILITARY_OPERATOR_USA`, `MILITARY_OPERATOR_RAF`, `MILITARY_OPERATOR_RN`, `MILITARY_OPERATOR_FAF`, `MILITARY_OPERATOR_GAF`, `MILITARY_OPERATOR_PLAAF`, `MILITARY_OPERATOR_PLAN`, `MILITARY_OPERATOR_VKS`, `MILITARY_OPERATOR_IAF`, `MILITARY_OPERATOR_NATO`, `MILITARY_OPERATOR_OTHER` |
| `MilitaryVesselType` | `MILITARY_VESSEL_TYPE_UNSPECIFIED`, `MILITARY_VESSEL_TYPE_CARRIER`, `MILITARY_VESSEL_TYPE_DESTROYER`, `MILITARY_VESSEL_TYPE_FRIGATE`, `MILITARY_VESSEL_TYPE_SUBMARINE`, `MILITARY_VESSEL_TYPE_AMPHIBIOUS`, `MILITARY_VESSEL_TYPE_PATROL`, `MILITARY_VESSEL_TYPE_AUXILIARY`, `MILITARY_VESSEL_TYPE_RESEARCH`, `MILITARY_VESSEL_TYPE_ICEBREAKER`, `MILITARY_VESSEL_TYPE_SPECIAL`, `MILITARY_VESSEL_TYPE_UNKNOWN` |

---

### 3.10 `climate` — 2 个面板消费

- proto 文件：12 个（`climate_anomaly.proto`, `climate_disaster.proto`, `climate_news_item.proto`, `co2_monitoring.proto`, `get_co2_monitoring.proto`, `get_ocean_ice_data.proto`, `list_air_quality_data.proto`, `list_climate_anomalies.proto` …）
- message：20 个（业务数据 8，包装 12）；enum：2 个
- 消费面板：`climate`, `population-exposure`

#### `worldmonitor.climate.v1.AirQualityStation` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `city` | string |  |
| `country_code` | string |  |
| `lat` | double |  |
| `lng` | double |  |
| `pm25` | double |  |
| `aqi` | int32 |  |
| `risk_level` | string |  |
| `pollutant` | string |  |
| `source` | string |  |

#### `worldmonitor.climate.v1.ClimateAnomaly` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `location` | worldmonitor.core.v1.GeoCoordinates | Representative location for the anomaly zone. |
| `temp_delta` | double | Temperature deviation from normal in degrees Celsius. |
| `precip_delta` | double | Precipitation deviation from normal in millimeters. |
| `severity` | AnomalySeverity | Severity classification of the anomaly. |
| `type` | AnomalyType | Type of climate anomaly observed. |

#### `worldmonitor.climate.v1.ClimateDisaster` — 12 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique event identifier. |
| `type` | string | Disaster type: flood, cyclone, drought, heatwave, wildfire. |
| `name` | string | Human-readable event name. |
| `country` | string | Country name. |
| `country_code` | string | ISO 3166-1 alpha-2 country code. |
| `lat` | double | Event latitude. |
| `lng` | double | Event longitude. |
| `severity` | string | Severity level. GDACS: green/orange/red. ReliefWeb: low/medium/high. |
| `status` | string | Event status: alert/ongoing/past. |
| `affected_population` | int32 | Affected population when available. |
| `source` | string | Source system: GDACS, ReliefWeb, NASA FIRMS. |
| `source_url` | string | Source URL for drill-down. |

#### `worldmonitor.climate.v1.ClimateNewsItem` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique identifier (URL hash + publish timestamp). |
| `title` | string | Article headline. |
| `url` | string | Canonical article URL. |
| `source_name` | string | Source publication name. |
| `summary` | string | Short summary/description (max 300 chars in seed pipeline). |

#### `worldmonitor.climate.v1.Co2DataPoint` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `month` | string |  |
| `ppm` | double |  |
| `anomaly` | double | Year-over-year delta vs same calendar month, in ppm. |

#### `worldmonitor.climate.v1.Co2Monitoring` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `current_ppm` | double |  |
| `year_ago_ppm` | double |  |
| `annual_growth_rate` | double |  |
| `pre_industrial_baseline` | double |  |
| `monthly_average` | double |  |
| `trend_12m` | Co2DataPoint[] |  |
| `methane_ppb` | double |  |
| `nitrous_oxide_ppb` | double |  |
| `measured_at` | int64 |  |
| `station` | string |  |

#### `worldmonitor.climate.v1.IceTrendPoint` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `month` | string |  |
| `extent_mkm2` | double |  |
| `anomaly_mkm2` | double |  |

#### `worldmonitor.climate.v1.OceanIceData` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `arctic_extent_mkm2` | double |  |
| `arctic_extent_anomaly_mkm2` | double |  |
| `arctic_trend` | string |  |
| `sea_level_mm_above_1993` | double |  |
| `sea_level_annual_rise_mm` | double |  |
| `ohc_0_700m_zj` | double |  |
| `sst_anomaly_c` | double |  |
| `ice_trend_12m` | IceTrendPoint[] |  |

##### `climate` 域枚举

| enum | 取值 |
|---|---|
| `AnomalySeverity` | `ANOMALY_SEVERITY_UNSPECIFIED`, `ANOMALY_SEVERITY_NORMAL`, `ANOMALY_SEVERITY_MODERATE`, `ANOMALY_SEVERITY_EXTREME` |
| `AnomalyType` | `ANOMALY_TYPE_UNSPECIFIED`, `ANOMALY_TYPE_WARM`, `ANOMALY_TYPE_COLD`, `ANOMALY_TYPE_WET`, `ANOMALY_TYPE_DRY`, `ANOMALY_TYPE_MIXED` |

---

### 3.11 `conflict` — 2 个面板消费

- proto 文件：9 个（`acled_event.proto`, `get_humanitarian_summary.proto`, `get_humanitarian_summary_batch.proto`, `humanitarian_summary.proto`, `list_acled_events.proto`, `list_iran_events.proto`, `list_ucdp_events.proto`, `service.proto` …）
- message：14 个（业务数据 4，包装 10）；enum：1 个
- 消费面板：`energy-disruptions`, `ucdp-events`

#### `worldmonitor.conflict.v1.AcledConflictEvent` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `event_type` | string | ACLED event type classification (e.g., "Battles", "Explosions/Remote violence"). |
| `country` | string | Country where the event occurred. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Geographic location of the event. |
| `fatalities` | int32 | Reported fatalities from this event. |
| `actors` | string[] | Named actors involved in the event. |
| `source` | string | Source article or report. |
| `admin1` | string | Administrative region within the country. |

#### `worldmonitor.conflict.v1.HumanitarianCountrySummary` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_code` | string | ISO 3166-1 alpha-2 country code. |
| `country_name` | string | Country name. |
| `conflict_events_total` | int32 | Total conflict events in the reference period. |
| `conflict_political_violence_events` | int32 | Political violence + civilian targeting event count. |
| `conflict_fatalities` | int32 | Total fatalities from political violence and civilian targeting. |
| `reference_period` | string | Reference period start date (YYYY-MM-DD). |
| `conflict_demonstrations` | int32 | Number of demonstration events. |

#### `worldmonitor.conflict.v1.IranEvent` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string |  |
| `title` | string |  |
| `category` | string |  |
| `source_url` | string |  |
| `latitude` | double |  |
| `longitude` | double |  |
| `location_name` | string |  |
| `timestamp` | int64 |  |
| `severity` | string |  |

#### `worldmonitor.conflict.v1.UcdpViolenceEvent` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `location` | worldmonitor.core.v1.GeoCoordinates | Geographic location of the event. |
| `country` | string | Country where the event occurred. |
| `side_a` | string | Primary party in the conflict (Side A). |
| `side_b` | string | Secondary party in the conflict (Side B). |
| `deaths_best` | int32 | Best estimate of deaths. |
| `deaths_low` | int32 | Low estimate of deaths. |
| `deaths_high` | int32 | High estimate of deaths. |
| `violence_type` | UcdpViolenceType | Type of violence. |
| `source_original` | string | Original source of the event report. |

##### `conflict` 域枚举

| enum | 取值 |
|---|---|
| `UcdpViolenceType` | `UCDP_VIOLENCE_TYPE_UNSPECIFIED`, `UCDP_VIOLENCE_TYPE_STATE_BASED`, `UCDP_VIOLENCE_TYPE_NON_STATE`, `UCDP_VIOLENCE_TYPE_ONE_SIDED` |

---

### 3.12 `cyber` — 2 个面板消费

- proto 文件：3 个（`cyber_threat.proto`, `list_cyber_threats.proto`, `service.proto`）
- message：3 个（业务数据 1，包装 2）；enum：3 个
- 消费面板：`internet-disruptions`, `security`

#### `worldmonitor.cyber.v1.CyberThreat` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | CyberThreatType | Type of cyber threat. |
| `source` | CyberThreatSource | Source of the threat intelligence. |
| `indicator` | string | Threat indicator value (IP, domain, or URL). |
| `indicator_type` | CyberThreatIndicatorType | Type of the indicator. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Geolocation of the threat indicator. |
| `country` | string | Country of origin (ISO 3166-1 alpha-2). |
| `severity` | worldmonitor.core.v1.CriticalityLevel | Threat criticality level. |
| `malware_family` | string | Associated malware family, if known. |
| `tags` | string[] | Descriptive tags. |

##### `cyber` 域枚举

| enum | 取值 |
|---|---|
| `CyberThreatIndicatorType` | `CYBER_THREAT_INDICATOR_TYPE_UNSPECIFIED`, `CYBER_THREAT_INDICATOR_TYPE_IP`, `CYBER_THREAT_INDICATOR_TYPE_DOMAIN`, `CYBER_THREAT_INDICATOR_TYPE_URL` |
| `CyberThreatSource` | `CYBER_THREAT_SOURCE_UNSPECIFIED`, `CYBER_THREAT_SOURCE_FEODO`, `CYBER_THREAT_SOURCE_URLHAUS`, `CYBER_THREAT_SOURCE_C2INTEL`, `CYBER_THREAT_SOURCE_OTX`, `CYBER_THREAT_SOURCE_ABUSEIPDB` |
| `CyberThreatType` | `CYBER_THREAT_TYPE_UNSPECIFIED`, `CYBER_THREAT_TYPE_C2_SERVER`, `CYBER_THREAT_TYPE_MALWARE_HOST`, `CYBER_THREAT_TYPE_PHISHING`, `CYBER_THREAT_TYPE_MALICIOUS_URL` |

---

### 3.13 `imagery` — 2 个面板消费

- proto 文件：2 个（`search_imagery.proto`, `service.proto`）
- message：3 个（业务数据 1，包装 2）；enum：0 个
- 消费面板：`live-webcams`, `windy-webcams`

#### `worldmonitor.imagery.v1.ImageryScene` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Maximum number of imagery scenes to return. |
| `satellite` | string | Maximum number of imagery scenes to return. |
| `datetime` | string | Maximum number of imagery scenes to return. |
| `resolution_m` | double | Maximum number of imagery scenes to return. |
| `mode` | string | Maximum number of imagery scenes to return. |
| `geometry_geojson` | string | Maximum number of imagery scenes to return. |
| `preview_url` | string | Maximum number of imagery scenes to return. |
| `asset_url` | string | Maximum number of imagery scenes to return. |

---

### 3.14 `maritime` — 2 个面板消费

- proto 文件：4 个（`get_vessel_snapshot.proto`, `list_navigational_warnings.proto`, `service.proto`, `vessel_snapshot.proto`）
- message：10 个（业务数据 6，包装 4）；enum：2 个
- 消费面板：`chokepoint-strip`, `live-webcams`

#### `worldmonitor.maritime.v1.AisDensityZone` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Zone name (e.g., "Strait of Malacca"). |
| `location` | worldmonitor.core.v1.GeoCoordinates | Zone centroid location. |
| `delta_pct` | double | Change from baseline as a percentage. |
| `ships_per_day` | int32 | Estimated ships per day. |
| `note` | string | Analyst note. |

#### `worldmonitor.maritime.v1.AisDisruption` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Descriptive name. |
| `type` | AisDisruptionType | Type of AIS disruption. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Location of the disruption. |
| `severity` | AisDisruptionSeverity | Disruption severity. |
| `change_pct` | double | Percentage change from normal. |
| `window_hours` | int32 | Analysis window in hours. |
| `dark_ships` | int32 | Number of dark ships (AIS off) detected. |
| `vessel_count` | int32 | Number of vessels in the affected area. |
| `region` | string | Region name. |
| `description` | string | Human-readable description. |

#### `worldmonitor.maritime.v1.AisSnapshotStatus` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `connected` | bool | Whether the relay WebSocket is connected to the AIS provider. |
| `vessels` | int32 | Number of vessels currently tracked by the relay. |
| `messages` | int32 | Total AIS messages processed in the current session. |

#### `worldmonitor.maritime.v1.NavigationalWarning` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Warning identifier. |
| `title` | string | Warning title. |
| `text` | string | Full warning text. |
| `area` | string | Geographic area affected. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Location of the warning. |
| `authority` | string | Warning source authority. |

#### `worldmonitor.maritime.v1.SnapshotCandidateReport` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `mmsi` | string | Maritime Mobile Service Identity. |
| `name` | string | Vessel name (may be empty if unknown). |
| `lat` | double | Latitude in decimal degrees. |
| `lon` | double | Longitude in decimal degrees. |
| `ship_type` | int32 | AIS ship type code (0 if unknown). |
| `heading` | int32 | Heading in degrees (0-359, or 511 for unavailable). |
| `speed` | double | Speed over ground in knots. |
| `course` | int32 | Course over ground in degrees. |

#### `worldmonitor.maritime.v1.VesselSnapshot` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `density_zones` | AisDensityZone[] | Density zones showing vessel concentrations. |
| `disruptions` | AisDisruption[] | Detected AIS disruptions. |
| `sequence` | int32 | Monotonic sequence number from the relay. Clients use this to detect stale responses during polling. |
| `status` | AisSnapshotStatus | Relay health status. |
| `candidate_reports` | SnapshotCandidateReport[] | Recent position reports for individual vessels. Only populated when the request sets include_candidates=true — empty otherwise. |
| `tanker_reports` | SnapshotCandidateReport[] | Recent position reports for tanker vessels (AIS ship type 80-89). Only populated when the request sets include_tankers=true — empty otherwise. Reuses the SnapshotCandidateReport message shape; the field is parallel to candidate_reports (military-detection) so adding tanker-rendering doesn't change the meaning of the existing surface. |

##### `maritime` 域枚举

| enum | 取值 |
|---|---|
| `AisDisruptionSeverity` | `AIS_DISRUPTION_SEVERITY_UNSPECIFIED`, `AIS_DISRUPTION_SEVERITY_LOW`, `AIS_DISRUPTION_SEVERITY_ELEVATED`, `AIS_DISRUPTION_SEVERITY_HIGH` |
| `AisDisruptionType` | `AIS_DISRUPTION_TYPE_UNSPECIFIED`, `AIS_DISRUPTION_TYPE_GAP_SPIKE`, `AIS_DISRUPTION_TYPE_CHOKEPOINT_CONGESTION` |

---

### 3.15 `natural` — 2 个面板消费

- proto 文件：2 个（`list_natural_events.proto`, `service.proto`）
- message：8 个（业务数据 6，包装 2）；enum：0 个
- 消费面板：`disaster-correlation`, `satellite-fires`

#### `worldmonitor.natural.v1.CoordRing` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `points` | Coordinate[] | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |

#### `worldmonitor.natural.v1.Coordinate` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lon` | double | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `lat` | double | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |

#### `worldmonitor.natural.v1.CycloneAgencyObservation` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `agency` | string | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `agency_id` | string | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `lat` | double | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `lon` | double | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `wind_kt` | int32 | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `wind_averaging_period_minutes` | int32 | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `pressure_mb` | int32 | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `classification` | string | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `status` | string | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `source_name` | string | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `source_url` | string | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |

#### `worldmonitor.natural.v1.ForecastPoint` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lat` | double | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `lon` | double | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `hour` | int32 | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `wind_kt` | int32 | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `category` | int32 | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |

#### `worldmonitor.natural.v1.NaturalEvent` — 29 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string |  |
| `title` | string |  |
| `description` | string |  |
| `category` | string |  |
| `category_title` | string |  |
| `lat` | double |  |
| `lon` | double |  |
| `magnitude` | double |  |
| `magnitude_unit` | string |  |
| `source_url` | string |  |
| `source_name` | string |  |
| `closed` | bool |  |
| `storm_id` | string | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `storm_name` | string | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `basin` | string | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `storm_category` | int32 | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `classification` | string | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `wind_kt` | int32 | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `pressure_mb` | int32 | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `movement_dir` | int32 | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `movement_speed_kt` | int32 | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `forecast_track` | ForecastPoint[] | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `cone_polygon` | CoordRing[] | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `past_track` | PastTrackPoint[] | Optional tropical cyclone fields (populated for severeStorms from GDACS TC / NHC) |
| `canonical_id` | string | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `matching_confidence` | string | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `canonical_aliases` | string[] | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `wind_averaging_period_minutes` | int32 | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `agency_observations` | CycloneAgencyObservation[] | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |

#### `worldmonitor.natural.v1.PastTrackPoint` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lat` | double | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `lon` | double | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |
| `wind_kt` | int32 | Cross-agency tropical cyclone identity and attribution. These fields keep each agency's observation intact instead of collapsing incompatible wind averaging periods into one number. |

---

### 3.16 `prediction` — 2 个面板消费

- proto 文件：3 个（`list_prediction_markets.proto`, `prediction_market.proto`, `service.proto`）
- message：3 个（业务数据 1，包装 2）；enum：1 个
- 消费面板：`gdelt-intel`, `polymarket`

#### `worldmonitor.prediction.v1.PredictionMarket` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | Market question or title. |
| `url` | string | URL to the market page. |
| `category` | string | Market category (e.g., "Politics", "Crypto", "Sports"). |
| `source` | MarketSource | Source platform (Polymarket, Kalshi, etc.). |

##### `prediction` 域枚举

| enum | 取值 |
|---|---|
| `MarketSource` | `MARKET_SOURCE_UNSPECIFIED`, `MARKET_SOURCE_POLYMARKET`, `MARKET_SOURCE_KALSHI` |

---

### 3.17 `aviation` — 1 个面板消费

- proto 文件：18 个（`airport_delay.proto`, `aviation_news_item.proto`, `carrier.proto`, `flight_instance.proto`, `get_airport_ops_summary.proto`, `get_carrier_ops.proto`, `get_flight_status.proto`, `get_youtube_live_stream_info.proto` …）
- message：34 个（业务数据 12，包装 22）；enum：8 个
- 消费面板：`airline-intel`

#### `worldmonitor.aviation.v1.AirportDelayAlert` — 15 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iata` | string | IATA airport code (e.g., "JFK"). |
| `icao` | string | ICAO airport code (e.g., "KJFK"). |
| `name` | string | Airport name. |
| `city` | string | City where the airport is located. |
| `country` | string | Country code (ISO 3166-1 alpha-2). |
| `location` | worldmonitor.core.v1.GeoCoordinates | Airport location. |
| `region` | AirportRegion | Geographic region. |
| `delay_type` | FlightDelayType | Type of delay. |
| `severity` | FlightDelaySeverity | Delay severity. |
| `avg_delay_minutes` | int32 | Average delay in minutes. |
| `delayed_flights_pct` | double | Percentage of delayed flights. |
| `cancelled_flights` | int32 | Number of cancelled flights. |
| `total_flights` | int32 | Total flights scheduled. |
| `reason` | string | Human-readable reason for delays. |
| `source` | FlightDelaySource | Data source. |

#### `worldmonitor.aviation.v1.AirportOpsSummary` — 13 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iata` | string | IATA airport code. |
| `icao` | string | ICAO airport code. |
| `name` | string | Airport name. |
| `timezone` | string | IANA timezone (e.g., "Europe/Istanbul"). |
| `delay_pct` | double | Percentage of flights currently delayed (0-100). |
| `avg_delay_minutes` | int32 | Average delay in minutes across delayed flights. |
| `cancellation_rate` | double | Cancellation rate as a percentage (0-100). |
| `total_flights` | int32 | Total flights in the observation window. |
| `closure_status` | bool | Whether the airport is currently closed. |
| `notam_flags` | string[] | Active NOTAM summary flags (e.g., "RWY 06/24 CLSD", "LOW VIS OPS"). |
| `severity` | FlightDelaySeverity | Overall severity assessment. |
| `top_delay_reasons` | string[] | Top reasons for delays. |
| `source` | string | Data source identifier. |

#### `worldmonitor.aviation.v1.AirportRef` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iata` | string | IATA airport code (e.g., "IST"). |
| `icao` | string | ICAO airport code (e.g., "LTFM"). |
| `name` | string | Airport name (e.g., "Istanbul Airport"). |
| `timezone` | string | IANA timezone (e.g., "Europe/Istanbul"). |

#### `worldmonitor.aviation.v1.AviationNewsItem` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique item identifier (hash of URL). |
| `title` | string | Article title. |
| `url` | string | Article URL. |
| `source_name` | string | Name of the news source (e.g., "FlightGlobal"). |
| `snippet` | string | Short text snippet or description. |
| `matched_entities` | string[] | Entities matched from the query (airport codes, airline names). |
| `image_url` | string | Article image URL (if available). |

#### `worldmonitor.aviation.v1.Carrier` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iata_code` | string | IATA two-letter airline code (e.g., "TK"). |
| `icao_code` | string | ICAO three-letter airline code (e.g., "THY"). |
| `name` | string | Full airline name (e.g., "Turkish Airlines"). |

#### `worldmonitor.aviation.v1.CarrierOpsSummary` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `carrier` | Carrier | The airline carrier. |
| `airport` | string | Airport IATA code this summary applies to. |
| `total_flights` | int32 | Total flights observed. |
| `delayed_count` | int32 | Number of delayed flights. |
| `cancelled_count` | int32 | Number of cancelled flights. |
| `avg_delay_minutes` | int32 | Average delay in minutes across delayed flights. |
| `delay_pct` | double | Delay percentage (0-100). |
| `cancellation_rate` | double | Cancellation rate (0-100). |

#### `worldmonitor.aviation.v1.DatePriceEntry` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string | Departure date in YYYY-MM-DD format. |
| `return_date` | string | Return date in YYYY-MM-DD format; empty for one-way results. |
| `price` | double | Return date in YYYY-MM-DD format; empty for one-way results. |

#### `worldmonitor.aviation.v1.FlightInstance` — 15 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `flight_number` | string | IATA flight number (e.g., "TK1952"). |
| `date` | string | Departure date in ISO 8601 format (e.g., "2026-03-05"). |
| `operating_carrier` | Carrier | Operating carrier for this flight. |
| `origin` | AirportRef | Origin airport. |
| `destination` | AirportRef | Destination airport. |
| `status` | FlightInstanceStatus | Current operational status. |
| `delay_minutes` | int32 | Delay in minutes (0 if on time, negative if early). |
| `cancelled` | bool | Whether the flight is cancelled. |
| `diverted` | bool | Whether the flight has been diverted. |
| `gate` | string | Departure gate (if available). |
| `terminal` | string | Departure terminal (if available). |
| `aircraft_icao24` | string | ICAO 24-bit transponder address of the aircraft (hex, e.g., "4b1805"). |
| `aircraft_type` | string | Aircraft type designator (e.g., "B738"). |
| `codeshare_flight_numbers` | string[] | Codeshare flight numbers marketed under this operating flight. |
| `source` | string | Data source provider name. |

#### `worldmonitor.aviation.v1.GoogleFlightLeg` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `airline_code` | string | GoogleFlightLeg represents a single flight segment (one plane, one takeoff and landing). |
| `flight_number` | string | GoogleFlightLeg represents a single flight segment (one plane, one takeoff and landing). |
| `departure_airport` | string | GoogleFlightLeg represents a single flight segment (one plane, one takeoff and landing). |
| `arrival_airport` | string | GoogleFlightLeg represents a single flight segment (one plane, one takeoff and landing). |
| `departure_datetime` | string | ISO 8601 local datetime, e.g. "2025-06-01T08:45". |
| `arrival_datetime` | string | ISO 8601 local datetime, e.g. "2025-06-01T08:45". |
| `duration_minutes` | int32 | ISO 8601 local datetime, e.g. "2025-06-01T08:45". |

#### `worldmonitor.aviation.v1.GoogleFlightResult` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `legs` | GoogleFlightLeg[] | GoogleFlightResult represents a complete itinerary (one or more legs). |
| `price` | double | GoogleFlightResult represents a complete itinerary (one or more legs). |
| `duration_minutes` | int32 | GoogleFlightResult represents a complete itinerary (one or more legs). |
| `stops` | int32 | GoogleFlightResult represents a complete itinerary (one or more legs). |

#### `worldmonitor.aviation.v1.PositionSample` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `icao24` | string | ICAO 24-bit transponder address (hex, e.g., "4b1805"). |
| `callsign` | string | ATC callsign (e.g., "THY7CX"). |
| `lat` | double | Latitude in decimal degrees. |
| `lon` | double | Longitude in decimal degrees. |
| `altitude_m` | double | Barometric altitude in metres. |
| `ground_speed_kts` | double | Ground speed in knots. |
| `track_deg` | double | True track over ground in degrees (0 = North, clockwise). |
| `vertical_rate` | double | Vertical rate in metres per second (positive = climbing). |
| `on_ground` | bool | Whether the aircraft is on the ground. |
| `source` | PositionSource | Position data source. |

#### `worldmonitor.aviation.v1.PriceQuote` — 15 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique quote identifier. |
| `origin` | string | Origin airport IATA code. |
| `destination` | string | Destination airport IATA code. |
| `departure_date` | string | Outbound departure date (ISO 8601). |
| `return_date` | string | Return date (ISO 8601), empty for one-way. |
| `carrier` | Carrier | Marketing carrier for this offer. |
| `price_amount` | double | Total price amount. |
| `currency` | string | ISO 4217 currency code (e.g., "EUR", "USD", "TRY"). |
| `cabin` | CabinClass | Cabin class of the offer. |
| `stops` | int32 | Number of stops (0 = nonstop). |
| `duration_minutes` | int32 | Total travel duration in minutes. |
| `booking_url` | string | Booking URL or deep-link (if available). |
| `provider` | string | Provider name (e.g., "amadeus", "demo"). |
| `is_indicative` | bool | Whether the price is indicative rather than bookable. |
| `checkout_ref` | string | Reference used during the checkout process (for follow-up actions). |

##### `aviation` 域枚举

| enum | 取值 |
|---|---|
| `AirportRegion` | `AIRPORT_REGION_UNSPECIFIED`, `AIRPORT_REGION_AMERICAS`, `AIRPORT_REGION_EUROPE`, `AIRPORT_REGION_APAC`, `AIRPORT_REGION_MENA`, `AIRPORT_REGION_AFRICA` |
| `CabinClass` | `CABIN_CLASS_UNSPECIFIED`, `CABIN_CLASS_ECONOMY`, `CABIN_CLASS_PREMIUM_ECONOMY`, `CABIN_CLASS_BUSINESS`, `CABIN_CLASS_FIRST` |
| `FlightDelaySeverity` | `FLIGHT_DELAY_SEVERITY_UNSPECIFIED`, `FLIGHT_DELAY_SEVERITY_NORMAL`, `FLIGHT_DELAY_SEVERITY_MINOR`, `FLIGHT_DELAY_SEVERITY_MODERATE`, `FLIGHT_DELAY_SEVERITY_MAJOR`, `FLIGHT_DELAY_SEVERITY_SEVERE`, `FLIGHT_DELAY_SEVERITY_UNKNOWN` |
| `FlightDelaySource` | `FLIGHT_DELAY_SOURCE_UNSPECIFIED`, `FLIGHT_DELAY_SOURCE_FAA`, `FLIGHT_DELAY_SOURCE_EUROCONTROL`, `FLIGHT_DELAY_SOURCE_COMPUTED`, `FLIGHT_DELAY_SOURCE_AVIATIONSTACK`, `FLIGHT_DELAY_SOURCE_NOTAM` |
| `FlightDelayType` | `FLIGHT_DELAY_TYPE_UNSPECIFIED`, `FLIGHT_DELAY_TYPE_GROUND_STOP`, `FLIGHT_DELAY_TYPE_GROUND_DELAY`, `FLIGHT_DELAY_TYPE_DEPARTURE_DELAY`, `FLIGHT_DELAY_TYPE_ARRIVAL_DELAY`, `FLIGHT_DELAY_TYPE_GENERAL`, `FLIGHT_DELAY_TYPE_CLOSURE` |
| `FlightDirection` | `FLIGHT_DIRECTION_UNSPECIFIED`, `FLIGHT_DIRECTION_DEPARTURE`, `FLIGHT_DIRECTION_ARRIVAL`, `FLIGHT_DIRECTION_BOTH` |
| `FlightInstanceStatus` | `FLIGHT_INSTANCE_STATUS_UNSPECIFIED`, `FLIGHT_INSTANCE_STATUS_SCHEDULED`, `FLIGHT_INSTANCE_STATUS_BOARDING`, `FLIGHT_INSTANCE_STATUS_DEPARTED`, `FLIGHT_INSTANCE_STATUS_AIRBORNE`, `FLIGHT_INSTANCE_STATUS_LANDED`, `FLIGHT_INSTANCE_STATUS_ARRIVED`, `FLIGHT_INSTANCE_STATUS_CANCELLED`, `FLIGHT_INSTANCE_STATUS_DIVERTED`, `FLIGHT_INSTANCE_STATUS_UNKNOWN` |
| `PositionSource` | `POSITION_SOURCE_UNSPECIFIED`, `POSITION_SOURCE_OPENSKY`, `POSITION_SOURCE_WINGBITS`, `POSITION_SOURCE_SIMULATED` |

---

### 3.18 `consumer_prices` — 1 个面板消费

- proto 文件：8 个（`consumer_prices_data.proto`, `get_consumer_price_basket_series.proto`, `get_consumer_price_freshness.proto`, `get_consumer_price_overview.proto`, `list_consumer_price_categories.proto`, `list_consumer_price_movers.proto`, `list_retailer_price_spreads.proto`, `service.proto`）
- message：17 个（业务数据 5，包装 12）；enum：0 个
- 消费面板：`consumer-prices`

#### `worldmonitor.consumer_prices.v1.BasketPoint` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | string | date is the ISO 8601 date string (YYYY-MM-DD). |
| `index` | double | index is the basket index value (base = 100). |

#### `worldmonitor.consumer_prices.v1.CategorySnapshot` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `slug` | string | slug is the machine-readable category identifier (e.g. "eggs", "rice"). |
| `name` | string | name is the human-readable category label. |
| `wow_pct` | double | wow_pct is the week-over-week percentage change. |
| `mom_pct` | double | mom_pct is the month-over-month percentage change. |
| `current_index` | double | current_index is the current price index value (base = 100). |
| `sparkline` | double[] | sparkline is an ordered sequence of index values for the selected range. |
| `coverage_pct` | double | coverage_pct is the percentage of basket items observed for this category. |
| `item_count` | int32 | item_count is the number of observed products in this category. |

#### `worldmonitor.consumer_prices.v1.PriceMover` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `product_id` | string | product_id is the retailer product identifier. |
| `title` | string | title is the normalized product title. |
| `category` | string | category is the product category slug. |
| `retailer_slug` | string | retailer_slug identifies the retailer where this move was observed. |
| `change_pct` | double | change_pct is the signed percentage change over the selected window. |
| `current_price` | double | current_price is the latest observed price. |
| `currency_code` | string | currency_code is the ISO 4217 currency code. |

#### `worldmonitor.consumer_prices.v1.RetailerFreshnessInfo` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `slug` | string | slug is the retailer identifier. |
| `name` | string | name is the retailer display name. |
| `last_run_at` | int64 | last_run_at is the Unix millisecond timestamp of the last successful scrape. |
| `status` | string | status is one of "ok", "stale", "failed", "unknown". |
| `parse_success_rate` | double | parse_success_rate is the fraction of pages parsed successfully (0–1). |
| `freshness_min` | int32 | freshness_min is minutes since last successful observation. |

#### `worldmonitor.consumer_prices.v1.RetailerSpread` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `slug` | string | slug is the retailer identifier. |
| `name` | string | name is the retailer display name. |
| `basket_total` | double | basket_total is the sum of matched basket item prices at this retailer. |
| `delta_vs_cheapest` | double | delta_vs_cheapest is the absolute price difference vs the cheapest retailer. |
| `delta_vs_cheapest_pct` | double | delta_vs_cheapest_pct is the percentage difference vs the cheapest retailer. |
| `item_count` | int32 | item_count is the number of matched basket items observed. |
| `freshness_min` | int32 | freshness_min is minutes since the last successful scrape for this retailer. |
| `currency_code` | string | currency_code is the ISO 4217 currency code. |

---

### 3.19 `displacement` — 1 个面板消费

- proto 文件：4 个（`displacement.proto`, `get_displacement_summary.proto`, `get_population_exposure.proto`, `service.proto`）
- message：10 个（业务数据 6，包装 4）；enum：0 个
- 消费面板：`displacement`

#### `worldmonitor.displacement.v1.CountryDisplacement` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Country name. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Representative location for mapping. |

#### `worldmonitor.displacement.v1.CountryPopulationEntry` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | string | ISO 3166-1 alpha-3 country code. |
| `name` | string | Country name. |
| `density_per_km2` | int32 | Population density per square kilometer. |

#### `worldmonitor.displacement.v1.DisplacementFlow` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `origin_name` | string | Origin country name. |
| `asylum_name` | string | Asylum country name. |
| `origin_location` | worldmonitor.core.v1.GeoCoordinates | Origin country representative location. |
| `asylum_location` | worldmonitor.core.v1.GeoCoordinates | Asylum country representative location. |

#### `worldmonitor.displacement.v1.DisplacementSummary` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `year` | int32 | Data year. |
| `global_totals` | GlobalDisplacementTotals | Global totals across all categories. |
| `countries` | CountryDisplacement[] | Per-country displacement breakdowns. |
| `top_flows` | DisplacementFlow[] | Top displacement flows between countries. |

#### `worldmonitor.displacement.v1.ExposureResult` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `exposure_radius_km` | double | Radius used for the estimate in km. |
| `nearest_country` | string | ISO3 code of nearest priority country. |
| `density_per_km2` | int32 | Population density used for the estimate. |

#### `worldmonitor.displacement.v1.GlobalDisplacementTotals` — 0 字段

（oneof / map 等结构，见 proto 原文）

---

### 3.20 `forecast` — 1 个面板消费

- proto 文件：7 个（`forecast.proto`, `get_forecast_scorecard.proto`, `get_forecasts.proto`, `get_simulation_outcome.proto`, `get_simulation_package.proto`, `service.proto`, `trigger_simulation.proto`）
- message：30 个（业务数据 20，包装 10）；enum：0 个
- 消费面板：`forecast`

#### `worldmonitor.forecast.v1.CalibrationInfo` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `market_title` | string |  |
| `market_price` | double |  |
| `drift` | double |  |
| `source` | string |  |

#### `worldmonitor.forecast.v1.CascadeEffect` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `domain` | string |  |
| `effect` | string |  |
| `probability` | double |  |

#### `worldmonitor.forecast.v1.Forecast` — 21 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Projected 30-day probability after domain-curve normalization. |
| `domain` | string | Projected 30-day probability after domain-curve normalization. |
| `region` | string | Projected 30-day probability after domain-curve normalization. |
| `title` | string | Projected 30-day probability after domain-curve normalization. |
| `scenario` | string | Projected 30-day probability after domain-curve normalization. |
| `feed_summary` | string | Projected 30-day probability after domain-curve normalization. |
| `probability` | double | Projected 30-day probability after domain-curve normalization. |
| `confidence` | double | Projected 30-day probability after domain-curve normalization. |
| `time_horizon` | string | Projected 30-day probability after domain-curve normalization. |
| `signals` | ForecastSignal[] | Projected 30-day probability after domain-curve normalization. |
| `cascades` | CascadeEffect[] | Projected 30-day probability after domain-curve normalization. |
| `trend` | string | Forecast trend direction. Current values are "rising", "falling", and "stable". The seeder compares probability against the prior forecast snapshot and uses a +/-0.05 deadband: deltas above +0.05 are rising, below -0.05 are falling, and everything inside the band is stable. |
| `prior_probability` | double | Forecast trend direction. Current values are "rising", "falling", and "stable". The seeder compares probability against the prior forecast snapshot and uses a +/-0.05 deadband: deltas above +0.05 are rising, below -0.05 are falling, and everything inside the band is stable. |
| `calibration` | CalibrationInfo | Forecast trend direction. Current values are "rising", "falling", and "stable". The seeder compares probability against the prior forecast snapshot and uses a +/-0.05 deadband: deltas above +0.05 are rising, below -0.05 are falling, and everything inside the band is stable. |
| `perspectives` | Perspectives | Forecast trend direction. Current values are "rising", "falling", and "stable". The seeder compares probability against the prior forecast snapshot and uses a +/-0.05 deadband: deltas above +0.05 are rising, below -0.05 are falling, and everything inside the band is stable. |
| `projections` | Projections | Forecast trend direction. Current values are "rising", "falling", and "stable". The seeder compares probability against the prior forecast snapshot and uses a +/-0.05 deadband: deltas above +0.05 are rising, below -0.05 are falling, and everything inside the band is stable. |
| `case_file` | ForecastCase | Forecast trend direction. Current values are "rising", "falling", and "stable". The seeder compares probability against the prior forecast snapshot and uses a +/-0.05 deadband: deltas above +0.05 are rising, below -0.05 are falling, and everything inside the band is stable. |
| `simulation_adjustment` | double | Simulation-scoring fields — populated when the deep forecast simulation pipeline has run for this forecast's state and produced a non-zero adjustment. simulation_adjustment: raw score delta (+0.08–+0.12 positive, -0.12/-0.15 negative). sim_path_confidence: clamped [0,1] confidence of the matched sim top-path; 0 = not set. demoted_by_simulation: true when a negative adjustment crossed the 0.50 acceptance threshold. |
| `sim_path_confidence` | double | Simulation-scoring fields — populated when the deep forecast simulation pipeline has run for this forecast's state and produced a non-zero adjustment. simulation_adjustment: raw score delta (+0.08–+0.12 positive, -0.12/-0.15 negative). sim_path_confidence: clamped [0,1] confidence of the matched sim top-path; 0 = not set. demoted_by_simulation: true when a negative adjustment crossed the 0.50 acceptance threshold. |
| `demoted_by_simulation` | bool | Simulation-scoring fields — populated when the deep forecast simulation pipeline has run for this forecast's state and produced a non-zero adjustment. simulation_adjustment: raw score delta (+0.08–+0.12 positive, -0.12/-0.15 negative). sim_path_confidence: clamped [0,1] confidence of the matched sim top-path; 0 = not set. demoted_by_simulation: true when a negative adjustment crossed the 0.50 acceptance threshold. |
| `resolution` | ResolutionSpec | Resolution spec — the machine-checkable outcome contract for this forecast (see ResolutionSpec). "hard" specs resolve for free by metric comparison against source_feed; "judged" specs resolve via a later LLM judge against question. Nullable: a forecast that never passed through the resolution enrichment pass carries null. deadline is an epoch-milliseconds timestamp. |

#### `worldmonitor.forecast.v1.ForecastActor` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Projected 30-day probability after domain-curve normalization. |
| `name` | string | Projected 30-day probability after domain-curve normalization. |
| `category` | string | Projected 30-day probability after domain-curve normalization. |
| `role` | string | Projected 30-day probability after domain-curve normalization. |
| `objectives` | string[] | Projected 30-day probability after domain-curve normalization. |
| `constraints` | string[] | Projected 30-day probability after domain-curve normalization. |
| `likely_actions` | string[] | Projected 30-day probability after domain-curve normalization. |
| `influence_score` | double | Projected 30-day probability after domain-curve normalization. |

#### `worldmonitor.forecast.v1.ForecastBranch` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `kind` | string | Projected 30-day probability after domain-curve normalization. |
| `title` | string | Projected 30-day probability after domain-curve normalization. |
| `summary` | string | Projected 30-day probability after domain-curve normalization. |
| `outcome` | string | Projected 30-day probability after domain-curve normalization. |
| `projected_probability` | double | Projected 30-day probability after domain-curve normalization. |
| `rounds` | ForecastBranchRound[] | Projected 30-day probability after domain-curve normalization. |

#### `worldmonitor.forecast.v1.ForecastBranchRound` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `round` | int32 | Projected 30-day probability after domain-curve normalization. |
| `focus` | string | Projected 30-day probability after domain-curve normalization. |
| `developments` | string[] | Projected 30-day probability after domain-curve normalization. |
| `actor_moves` | string[] | Projected 30-day probability after domain-curve normalization. |
| `probability_shift` | double | Projected 30-day probability after domain-curve normalization. |

#### `worldmonitor.forecast.v1.ForecastCase` — 12 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `supporting_evidence` | ForecastCaseEvidence[] | Projected 30-day probability after domain-curve normalization. |
| `counter_evidence` | ForecastCaseEvidence[] | Projected 30-day probability after domain-curve normalization. |
| `triggers` | string[] | Projected 30-day probability after domain-curve normalization. |
| `actor_lenses` | string[] | Projected 30-day probability after domain-curve normalization. |
| `base_case` | string | Projected 30-day probability after domain-curve normalization. |
| `escalatory_case` | string | Projected 30-day probability after domain-curve normalization. |
| `contrarian_case` | string | Projected 30-day probability after domain-curve normalization. |
| `change_summary` | string | Projected 30-day probability after domain-curve normalization. |
| `change_items` | string[] | Projected 30-day probability after domain-curve normalization. |
| `actors` | ForecastActor[] | Projected 30-day probability after domain-curve normalization. |
| `world_state` | ForecastWorldState | Projected 30-day probability after domain-curve normalization. |
| `branches` | ForecastBranch[] | Projected 30-day probability after domain-curve normalization. |

#### `worldmonitor.forecast.v1.ForecastCaseEvidence` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | string | Projected 30-day probability after domain-curve normalization. |
| `summary` | string | Projected 30-day probability after domain-curve normalization. |
| `weight` | double | Projected 30-day probability after domain-curve normalization. |

#### `worldmonitor.forecast.v1.ForecastSignal` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | string |  |
| `value` | string |  |
| `weight` | double |  |

#### `worldmonitor.forecast.v1.ForecastWorldState` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `summary` | string | Projected 30-day probability after domain-curve normalization. |
| `active_pressures` | string[] | Projected 30-day probability after domain-curve normalization. |
| `stabilizers` | string[] | Projected 30-day probability after domain-curve normalization. |
| `key_unknowns` | string[] | Projected 30-day probability after domain-curve normalization. |

#### `worldmonitor.forecast.v1.Perspectives` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `strategic` | string |  |
| `regional` | string |  |
| `contrarian` | string |  |

#### `worldmonitor.forecast.v1.Projections` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `h24` | double | Projected 24-hour probability after domain-curve normalization. |
| `d7` | double | Projected 7-day probability after domain-curve normalization. |
| `d30` | double | Projected 30-day probability after domain-curve normalization. |

#### `worldmonitor.forecast.v1.ResolutionSpec` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `kind` | string | Machine-checkable resolution spec — makes a forecast a scoreable *bet*. Every forecast carries exactly one spec, either "hard" or "judged": - "hard":   auto-resolvable by a free metric comparison against a WorldMonitor feed the detector already scored from. Sets metric_key (feed + path expression), operator, threshold, window, and source_feed (a RESOLUTION_FEED_KEYS allowlist member). baseline_value is set only when operator is "crosses" (the emission-time metric value the move is measured from). - "judged": resolved by a later LLM judge against the question string; no numeric threshold, but still a resolution deadline. kind and operator are strings, not proto enums, mirroring the trend field above so a new operator/kind never requires a proto migration to land in the 45-day history. Current kind values are "hard" and "judged"; current operator values are ">=", "<=", and "crosses". kind and deadline are always set; every other field is optional and absent (persisted as JSON null) when it does not apply to the kind — a judged spec carries no threshold/baseline_value so "no threshold" is never confused with a real threshold of 0, and a hard spec carries no question. |
| `metric_key` | string | Machine-checkable resolution spec — makes a forecast a scoreable *bet*. Every forecast carries exactly one spec, either "hard" or "judged": - "hard":   auto-resolvable by a free metric comparison against a WorldMonitor feed the detector already scored from. Sets metric_key (feed + path expression), operator, threshold, window, and source_feed (a RESOLUTION_FEED_KEYS allowlist member). baseline_value is set only when operator is "crosses" (the emission-time metric value the move is measured from). - "judged": resolved by a later LLM judge against the question string; no numeric threshold, but still a resolution deadline. kind and operator are strings, not proto enums, mirroring the trend field above so a new operator/kind never requires a proto migration to land in the 45-day history. Current kind values are "hard" and "judged"; current operator values are ">=", "<=", and "crosses". kind and deadline are always set; every other field is optional and absent (persisted as JSON null) when it does not apply to the kind — a judged spec carries no threshold/baseline_value so "no threshold" is never confused with a real threshold of 0, and a hard spec carries no question. |
| `operator` | string | Machine-checkable resolution spec — makes a forecast a scoreable *bet*. Every forecast carries exactly one spec, either "hard" or "judged": - "hard":   auto-resolvable by a free metric comparison against a WorldMonitor feed the detector already scored from. Sets metric_key (feed + path expression), operator, threshold, window, and source_feed (a RESOLUTION_FEED_KEYS allowlist member). baseline_value is set only when operator is "crosses" (the emission-time metric value the move is measured from). - "judged": resolved by a later LLM judge against the question string; no numeric threshold, but still a resolution deadline. kind and operator are strings, not proto enums, mirroring the trend field above so a new operator/kind never requires a proto migration to land in the 45-day history. Current kind values are "hard" and "judged"; current operator values are ">=", "<=", and "crosses". kind and deadline are always set; every other field is optional and absent (persisted as JSON null) when it does not apply to the kind — a judged spec carries no threshold/baseline_value so "no threshold" is never confused with a real threshold of 0, and a hard spec carries no question. |
| `threshold` | double | Machine-checkable resolution spec — makes a forecast a scoreable *bet*. Every forecast carries exactly one spec, either "hard" or "judged": - "hard":   auto-resolvable by a free metric comparison against a WorldMonitor feed the detector already scored from. Sets metric_key (feed + path expression), operator, threshold, window, and source_feed (a RESOLUTION_FEED_KEYS allowlist member). baseline_value is set only when operator is "crosses" (the emission-time metric value the move is measured from). - "judged": resolved by a later LLM judge against the question string; no numeric threshold, but still a resolution deadline. kind and operator are strings, not proto enums, mirroring the trend field above so a new operator/kind never requires a proto migration to land in the 45-day history. Current kind values are "hard" and "judged"; current operator values are ">=", "<=", and "crosses". kind and deadline are always set; every other field is optional and absent (persisted as JSON null) when it does not apply to the kind — a judged spec carries no threshold/baseline_value so "no threshold" is never confused with a real threshold of 0, and a hard spec carries no question. |
| `baseline_value` | double | Machine-checkable resolution spec — makes a forecast a scoreable *bet*. Every forecast carries exactly one spec, either "hard" or "judged": - "hard":   auto-resolvable by a free metric comparison against a WorldMonitor feed the detector already scored from. Sets metric_key (feed + path expression), operator, threshold, window, and source_feed (a RESOLUTION_FEED_KEYS allowlist member). baseline_value is set only when operator is "crosses" (the emission-time metric value the move is measured from). - "judged": resolved by a later LLM judge against the question string; no numeric threshold, but still a resolution deadline. kind and operator are strings, not proto enums, mirroring the trend field above so a new operator/kind never requires a proto migration to land in the 45-day history. Current kind values are "hard" and "judged"; current operator values are ">=", "<=", and "crosses". kind and deadline are always set; every other field is optional and absent (persisted as JSON null) when it does not apply to the kind — a judged spec carries no threshold/baseline_value so "no threshold" is never confused with a real threshold of 0, and a hard spec carries no question. |
| `window` | string | Machine-checkable resolution spec — makes a forecast a scoreable *bet*. Every forecast carries exactly one spec, either "hard" or "judged": - "hard":   auto-resolvable by a free metric comparison against a WorldMonitor feed the detector already scored from. Sets metric_key (feed + path expression), operator, threshold, window, and source_feed (a RESOLUTION_FEED_KEYS allowlist member). baseline_value is set only when operator is "crosses" (the emission-time metric value the move is measured from). - "judged": resolved by a later LLM judge against the question string; no numeric threshold, but still a resolution deadline. kind and operator are strings, not proto enums, mirroring the trend field above so a new operator/kind never requires a proto migration to land in the 45-day history. Current kind values are "hard" and "judged"; current operator values are ">=", "<=", and "crosses". kind and deadline are always set; every other field is optional and absent (persisted as JSON null) when it does not apply to the kind — a judged spec carries no threshold/baseline_value so "no threshold" is never confused with a real threshold of 0, and a hard spec carries no question. |
| `source_feed` | string | Machine-checkable resolution spec — makes a forecast a scoreable *bet*. Every forecast carries exactly one spec, either "hard" or "judged": - "hard":   auto-resolvable by a free metric comparison against a WorldMonitor feed the detector already scored from. Sets metric_key (feed + path expression), operator, threshold, window, and source_feed (a RESOLUTION_FEED_KEYS allowlist member). baseline_value is set only when operator is "crosses" (the emission-time metric value the move is measured from). - "judged": resolved by a later LLM judge against the question string; no numeric threshold, but still a resolution deadline. kind and operator are strings, not proto enums, mirroring the trend field above so a new operator/kind never requires a proto migration to land in the 45-day history. Current kind values are "hard" and "judged"; current operator values are ">=", "<=", and "crosses". kind and deadline are always set; every other field is optional and absent (persisted as JSON null) when it does not apply to the kind — a judged spec carries no threshold/baseline_value so "no threshold" is never confused with a real threshold of 0, and a hard spec carries no question. |
| `question` | string | Machine-checkable resolution spec — makes a forecast a scoreable *bet*. Every forecast carries exactly one spec, either "hard" or "judged": - "hard":   auto-resolvable by a free metric comparison against a WorldMonitor feed the detector already scored from. Sets metric_key (feed + path expression), operator, threshold, window, and source_feed (a RESOLUTION_FEED_KEYS allowlist member). baseline_value is set only when operator is "crosses" (the emission-time metric value the move is measured from). - "judged": resolved by a later LLM judge against the question string; no numeric threshold, but still a resolution deadline. kind and operator are strings, not proto enums, mirroring the trend field above so a new operator/kind never requires a proto migration to land in the 45-day history. Current kind values are "hard" and "judged"; current operator values are ">=", "<=", and "crosses". kind and deadline are always set; every other field is optional and absent (persisted as JSON null) when it does not apply to the kind — a judged spec carries no threshold/baseline_value so "no threshold" is never confused with a real threshold of 0, and a hard spec carries no question. |

#### `worldmonitor.forecast.v1.ScorecardCalibrationBucket` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `bucket` | string |  |
| `min_probability` | double |  |
| `max_probability` | double |  |
| `count` | int32 |  |
| `predicted_mean` | double |  |
| `realized_rate` | double |  |
| `brier` | double |  |

#### `worldmonitor.forecast.v1.ScorecardDomainGroup` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `domain` | string |  |
| `resolved` | int32 |  |
| `scored` | int32 |  |
| `void` | int32 |  |
| `void_rate` | double |  |
| `brier` | double |  |
| `log_score` | double |  |

#### `worldmonitor.forecast.v1.ScorecardGenerationOriginGroup` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `generation_origin` | string |  |
| `resolved` | int32 |  |
| `scored` | int32 |  |
| `void` | int32 |  |
| `void_rate` | double |  |
| `brier` | double |  |
| `log_score` | double |  |

#### `worldmonitor.forecast.v1.ScorecardMarketSkill` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `count` | int32 |  |
| `forecast_brier` | double |  |
| `market_brier` | double |  |
| `brier_delta` | double |  |

#### `worldmonitor.forecast.v1.ScorecardSkill` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `count` | int32 | Headline "real skill" summary: Brier/log score over scored entries whose generation origin is NOT synthetic backfill or an unpromoted shadow stream. count 0 with excluded_scored > 0 means the headline is unmeasurable because everything scored was synthetic — the honest signal for a collapsed funnel. |
| `brier` | double | Headline "real skill" summary: Brier/log score over scored entries whose generation origin is NOT synthetic backfill or an unpromoted shadow stream. count 0 with excluded_scored > 0 means the headline is unmeasurable because everything scored was synthetic — the honest signal for a collapsed funnel. |
| `log_score` | double | Headline "real skill" summary: Brier/log score over scored entries whose generation origin is NOT synthetic backfill or an unpromoted shadow stream. count 0 with excluded_scored > 0 means the headline is unmeasurable because everything scored was synthetic — the honest signal for a collapsed funnel. |
| `excluded_scored` | int32 | Headline "real skill" summary: Brier/log score over scored entries whose generation origin is NOT synthetic backfill or an unpromoted shadow stream. count 0 with excluded_scored > 0 means the headline is unmeasurable because everything scored was synthetic — the honest signal for a collapsed funnel. |
| `excluded_origins` | string[] | Headline "real skill" summary: Brier/log score over scored entries whose generation origin is NOT synthetic backfill or an unpromoted shadow stream. count 0 with excluded_scored > 0 means the headline is unmeasurable because everything scored was synthetic — the honest signal for a collapsed funnel. |

#### `worldmonitor.forecast.v1.ScorecardSummary` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `count` | int32 |  |
| `brier` | double |  |
| `log_score` | double |  |

#### `worldmonitor.forecast.v1.ScorecardTotals` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `entries` | int32 |  |
| `resolved` | int32 |  |
| `pending` | int32 |  |
| `pending_judge` | int32 |  |
| `scored` | int32 |  |
| `void` | int32 |  |
| `void_rate` | double |  |
| `publication_coverage` | double |  |

---

### 3.21 `giving` — 1 个面板消费

- proto 文件：3 个（`get_giving_summary.proto`, `giving.proto`, `service.proto`）
- message：8 个（业务数据 6，包装 2）；enum：0 个
- 消费面板：`giving`

#### `worldmonitor.giving.v1.CategoryBreakdown` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `category` | string | Category name (e.g., "Medical", "Disaster Relief", "Education"). |
| `share` | double | Published share (0-1) when verified. Zero is an unavailable sentinel when the category evidence is unverified. |
| `change_24h` | double | Legacy 24-hour change. Zero is a not-collected compatibility sentinel. |
| `active_campaigns` | int32 | Legacy live campaign count. Zero is a not-collected compatibility sentinel. |
| `trending` | bool | Legacy live trending indicator. Corrected static snapshots emit false. |

#### `worldmonitor.giving.v1.CryptoGivingSummary` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `daily_inflow_usd` | double | Daily USD equivalent from a verified annual claim, if available. |
| `tracked_wallets` | int32 | Verified tracked-wallet count, if available. |
| `transactions_24h` | int32 | Measured transactions in the last 24 hours, if a collector exists. |
| `top_receivers` | string[] | Verified receiving platforms or organizations, if available. |
| `pct_of_total` | double | Verified on-chain share of the relevant giving denominator, if available. |

#### `worldmonitor.giving.v1.GivingProvenance` — 17 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `subject` | string | Human-readable subject of the claim or collection-status record. |
| `source_name` | string | Publisher or authority responsible for the referenced claim. |
| `source_url` | string | HTTPS URL for the source or stable audit record. |
| `reference_period` | string | Period covered by the source claim (for example, "2024" or "25 years cumulative"). |
| `source_published_at` | string | Verified source publication date when known. Empty means not verified; it must never fall back to generated_at, fetched_at, or access time. |
| `measurement_basis` | string | What the reported number measures (annual, weekly average, cumulative, institutional context, compatibility sentinel, or collection status). |
| `status` | string | Verification status. Allowed values: "verified", "partially_verified", "unverified", "not_collected", "not_applicable". Consumers must treat unknown future values as "unverified". |
| `covered_metric_paths` | string[] | Stable proto response field paths covered by this evidence record. Field names use the proto snake_case spelling (for example, "summary.estimated_daily_flow_usd"). |
| `included_in_highlighted_aggregate` | bool | Whether this claim contributes to the highlighted tracked-platform aggregate. |
| `reported_value` | double | Numeric value exactly as reported or recorded for the compatibility status. |
| `reported_unit` | string | Unit attached to reported_value without implicit currency conversion. |
| `notes` | string | Exact-claim text and any limitations needed to audit the record. |
| `value_qualifier` | string | Source qualifier such as "more_than", "about", "reported", or "not_measured". |
| `source_locator` | string | Stable location within the source where the claim can be found. |
| `accessed_at` | string | Date the source was checked (YYYY-MM-DD); not a source observation time. |
| `denominator` | string | Time/value denominator used by the source claim. |
| `derivation` | string | Explicit derivation applied to the claim, or why no derivation is allowed. |

#### `worldmonitor.giving.v1.GivingSummary` — 12 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `generated_at` | string | Response summary generation time (ISO 8601). This is a transport/cache timestamp, not a source publication or observation time. |
| `activity_index` | double | Legacy numeric compatibility sentinel. Corrected snapshots emit 0 and activity_index_available=false; this is not a measured score. |
| `trend` | string | Legacy string compatibility sentinel. Corrected snapshots retain "stable" with trend_available=false; this is not a measured directional trend. |
| `estimated_daily_flow_usd` | double | Daily USD equivalent of only aggregate-eligible, verified annual or defensibly annualized tracked-platform claims. It is not a live daily observation or an estimate of all global giving. |
| `platforms` | PlatformGiving[] | Per-platform projections from the full published-claim snapshot. |
| `categories` | CategoryBreakdown[] | Compatibility category projections. Unsupported values remain zero sentinels and their provenance status explains that they are unverified or not collected. |
| `crypto` | CryptoGivingSummary | Compatibility crypto projection. Corrected snapshots do not imply that a live on-chain collector exists. |
| `institutional` | InstitutionalGiving | Verified institutional context, kept separate from personal-platform flow. |
| `data_mode` | string | Evidence mode: "published_estimate" or "partial_estimate". If absent in an older payload, consumers must treat the payload as legacy/unknown, never as a published estimate by proto scalar default. |
| `trend_available` | bool | True only when trend contains a measured directional trend. Corrected published-claim snapshots emit false. |
| `provenance` | GivingProvenance[] | Claim-level source evidence for the full snapshot, including claims outside any platform/category array projection. |
| `activity_index_available` | bool | True only when activity_index contains a measured score. Corrected published-claim snapshots emit false. |

#### `worldmonitor.giving.v1.InstitutionalGiving` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `oecd_oda_annual_usd_bn` | double | Latest OECD ODA total (annual, USD billions). |
| `oecd_data_year` | int32 | Year of latest OECD data. |
| `caf_world_giving_index` | double | CAF World Giving Index score (latest). |
| `caf_data_year` | int32 | Year of latest CAF data. |
| `candid_grants_tracked` | int32 | Number of foundation grants tracked (Candid). |
| `data_lag` | string | Data lag description (e.g., "Quarterly", "Annual"). |

#### `worldmonitor.giving.v1.PlatformGiving` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `daily_volume_usd` | double | Daily USD equivalent derived from an aggregate-eligible published claim. Zero means no eligible conversion, not measured zero giving. |
| `active_campaigns_sampled` | int32 | Legacy live-sampling field. Zero is a not-collected compatibility sentinel unless provenance says otherwise. |
| `new_campaigns_24h` | int32 | Legacy 24-hour field. Zero is a not-collected compatibility sentinel unless provenance says otherwise. |
| `donation_velocity` | double | Legacy live-velocity field. Zero is a not-collected compatibility sentinel unless provenance says otherwise. |
| `data_freshness` | string | Legacy source basis/cadence ("annual", "cumulative", or "unknown"), not response freshness or source age. |
| `last_updated` | string | Verified source publication date only. Empty when no publication date was verified; request/cache time must never be substituted. |

---

### 3.22 `radiation` — 1 个面板消费

- proto 文件：3 个（`list_radiation_observations.proto`, `radiation_observation.proto`, `service.proto`）
- message：3 个（业务数据 1，包装 2）；enum：4 个
- 消费面板：`radiation-watch`

#### `worldmonitor.radiation.v1.RadiationObservation` — 17 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `source` | RadiationSource | Upstream source for the observation. |
| `location_name` | string | Human-readable location label. |
| `country` | string | Country or territory label. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Geographic location of the reading. |
| `value` | double | Dose equivalent rate normalized to nSv/h. |
| `unit` | string | Display unit, currently always nSv/h after normalization. |
| `freshness` | RadiationFreshness | Freshness bucket derived from observation age. |
| `baseline_value` | double | Rolling baseline for this station in nSv/h. |
| `delta` | double | Current reading minus rolling baseline in nSv/h. |
| `z_score` | double | Standard deviation distance from the rolling baseline. |
| `severity` | RadiationSeverity | Interpreted anomaly severity for the current reading. |
| `contributing_sources` | RadiationSource[] | Sources contributing to this synthesized observation. |
| `confidence` | RadiationConfidence | Confidence in the current synthesized observation. |
| `corroborated` | bool | Whether a second source corroborated the observed pattern. |
| `conflicting_sources` | bool | Whether contributing sources materially disagree. |
| `converted_from_cpm` | bool | True when the value was converted from CPM using a generic fallback. |
| `source_count` | int32 | Number of distinct contributing sources. |

##### `radiation` 域枚举

| enum | 取值 |
|---|---|
| `RadiationConfidence` | `RADIATION_CONFIDENCE_UNSPECIFIED`, `RADIATION_CONFIDENCE_LOW`, `RADIATION_CONFIDENCE_MEDIUM`, `RADIATION_CONFIDENCE_HIGH` |
| `RadiationFreshness` | `RADIATION_FRESHNESS_UNSPECIFIED`, `RADIATION_FRESHNESS_LIVE`, `RADIATION_FRESHNESS_RECENT`, `RADIATION_FRESHNESS_HISTORICAL` |
| `RadiationSeverity` | `RADIATION_SEVERITY_UNSPECIFIED`, `RADIATION_SEVERITY_NORMAL`, `RADIATION_SEVERITY_ELEVATED`, `RADIATION_SEVERITY_SPIKE` |
| `RadiationSource` | `RADIATION_SOURCE_UNSPECIFIED`, `RADIATION_SOURCE_EPA_RADNET`, `RADIATION_SOURCE_SAFECAST` |

---

### 3.23 `sanctions` — 1 个面板消费

- proto 文件：6 个（`country_sanctions_pressure.proto`, `list_sanctions_pressure.proto`, `lookup_entity.proto`, `program_sanctions_pressure.proto`, `sanctions_entry.proto`, `service.proto`）
- message：8 个（业务数据 4，包装 4）；enum：1 个
- 消费面板：`sanctions-pressure`

#### `worldmonitor.sanctions.v1.CountrySanctionsPressure` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_code` | string | CountrySanctionsPressure summarizes designation volume and recent additions by country. |
| `country_name` | string | CountrySanctionsPressure summarizes designation volume and recent additions by country. |
| `entry_count` | int32 | CountrySanctionsPressure summarizes designation volume and recent additions by country. |
| `new_entry_count` | int32 | CountrySanctionsPressure summarizes designation volume and recent additions by country. |
| `vessel_count` | int32 | CountrySanctionsPressure summarizes designation volume and recent additions by country. |
| `aircraft_count` | int32 | CountrySanctionsPressure summarizes designation volume and recent additions by country. |

#### `worldmonitor.sanctions.v1.ProgramSanctionsPressure` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `program` | string | ProgramSanctionsPressure summarizes designation volume and recent additions by OFAC program. |
| `entry_count` | int32 | ProgramSanctionsPressure summarizes designation volume and recent additions by OFAC program. |
| `new_entry_count` | int32 | ProgramSanctionsPressure summarizes designation volume and recent additions by OFAC program. |

#### `worldmonitor.sanctions.v1.SanctionEntityMatch` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | SanctionEntityMatch is a compact entity match from the lookup index. |
| `name` | string | SanctionEntityMatch is a compact entity match from the lookup index. |
| `entity_type` | string | SanctionEntityMatch is a compact entity match from the lookup index. |
| `country_codes` | string[] | SanctionEntityMatch is a compact entity match from the lookup index. |
| `programs` | string[] | SanctionEntityMatch is a compact entity match from the lookup index. |

#### `worldmonitor.sanctions.v1.SanctionsEntry` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | SanctionsEntry is a normalized OFAC sanctions designation. |
| `name` | string | SanctionsEntry is a normalized OFAC sanctions designation. |
| `entity_type` | SanctionsEntityType | SanctionsEntry is a normalized OFAC sanctions designation. |
| `country_codes` | string[] | SanctionsEntry is a normalized OFAC sanctions designation. |
| `country_names` | string[] | SanctionsEntry is a normalized OFAC sanctions designation. |
| `programs` | string[] | SanctionsEntry is a normalized OFAC sanctions designation. |
| `source_lists` | string[] | SanctionsEntry is a normalized OFAC sanctions designation. |
| `effective_at` | int64 | SanctionsEntry is a normalized OFAC sanctions designation. |
| `is_new` | bool | SanctionsEntry is a normalized OFAC sanctions designation. |
| `note` | string | SanctionsEntry is a normalized OFAC sanctions designation. |

##### `sanctions` 域枚举

| enum | 取值 |
|---|---|
| `SanctionsEntityType` | `SANCTIONS_ENTITY_TYPE_UNSPECIFIED`, `SANCTIONS_ENTITY_TYPE_ENTITY`, `SANCTIONS_ENTITY_TYPE_INDIVIDUAL`, `SANCTIONS_ENTITY_TYPE_VESSEL`, `SANCTIONS_ENTITY_TYPE_AIRCRAFT` |

---

### 3.24 `thermal` — 1 个面板消费

- proto 文件：3 个（`list_thermal_escalations.proto`, `service.proto`, `thermal_escalation_cluster.proto`）
- message：4 个（业务数据 2，包装 2）；enum：4 个
- 消费面板：`thermal-escalation`

#### `worldmonitor.thermal.v1.ThermalEscalationCluster` — 26 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string |  |
| `centroid` | worldmonitor.core.v1.GeoCoordinates |  |
| `country_code` | string |  |
| `country_name` | string |  |
| `region_label` | string |  |
| `first_detected_at` | string |  |
| `last_detected_at` | string |  |
| `observation_count` | int32 |  |
| `unique_source_count` | int32 |  |
| `max_brightness` | double |  |
| `avg_brightness` | double |  |
| `max_frp` | double |  |
| `total_frp` | double |  |
| `night_detection_share` | double |  |
| `baseline_expected_count` | double |  |
| `baseline_expected_frp` | double |  |
| `count_delta` | double |  |
| `frp_delta` | double |  |
| `z_score` | double |  |
| `persistence_hours` | double |  |
| `status` | ThermalStatus |  |
| `context` | ThermalContext |  |
| `confidence` | ThermalConfidence |  |
| `strategic_relevance` | ThermalStrategicRelevance |  |
| `nearby_assets` | string[] |  |
| `narrative_flags` | string[] |  |

#### `worldmonitor.thermal.v1.ThermalEscalationSummary` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `cluster_count` | int32 | Maximum number of thermal escalation clusters to return. |
| `elevated_count` | int32 | Maximum number of thermal escalation clusters to return. |
| `spike_count` | int32 | Maximum number of thermal escalation clusters to return. |
| `persistent_count` | int32 | Maximum number of thermal escalation clusters to return. |
| `conflict_adjacent_count` | int32 | Maximum number of thermal escalation clusters to return. |
| `high_relevance_count` | int32 | Maximum number of thermal escalation clusters to return. |

##### `thermal` 域枚举

| enum | 取值 |
|---|---|
| `ThermalConfidence` | `THERMAL_CONFIDENCE_UNSPECIFIED`, `THERMAL_CONFIDENCE_LOW`, `THERMAL_CONFIDENCE_MEDIUM`, `THERMAL_CONFIDENCE_HIGH` |
| `ThermalContext` | `THERMAL_CONTEXT_UNSPECIFIED`, `THERMAL_CONTEXT_WILDLAND`, `THERMAL_CONTEXT_URBAN_EDGE`, `THERMAL_CONTEXT_INDUSTRIAL`, `THERMAL_CONTEXT_ENERGY_ADJACENT`, `THERMAL_CONTEXT_CONFLICT_ADJACENT`, `THERMAL_CONTEXT_LOGISTICS_ADJACENT`, `THERMAL_CONTEXT_MIXED` |
| `ThermalStatus` | `THERMAL_STATUS_UNSPECIFIED`, `THERMAL_STATUS_NORMAL`, `THERMAL_STATUS_ELEVATED`, `THERMAL_STATUS_SPIKE`, `THERMAL_STATUS_PERSISTENT` |
| `ThermalStrategicRelevance` | `THERMAL_RELEVANCE_UNSPECIFIED`, `THERMAL_RELEVANCE_LOW`, `THERMAL_RELEVANCE_MEDIUM`, `THERMAL_RELEVANCE_HIGH` |

---

### 3.25 `trade` — 1 个面板消费

- proto 文件：8 个（`get_customs_revenue.proto`, `get_tariff_trends.proto`, `get_trade_barriers.proto`, `get_trade_flows.proto`, `get_trade_restrictions.proto`, `list_comtrade_flows.proto`, `service.proto`, `trade_data.proto`）
- message：19 个（业务数据 7，包装 12）；enum：2 个
- 消费面板：`trade-policy`

#### `worldmonitor.trade.v1.ComtradeFlowRecord` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `reporter_code` | string | UN Comtrade reporter code. |
| `reporter_name` | string | Reporter country name. |
| `partner_code` | string | Partner country code ("000" = world total). |
| `partner_name` | string | Partner country name. |
| `cmd_code` | string | HS commodity code. |
| `cmd_desc` | string | Commodity description. |
| `year` | int32 | Reporting year. |
| `trade_value_usd` | double | Trade value in USD. |
| `net_weight_kg` | double | Net weight in kg. |
| `yoy_change` | double | Year-over-year change (ratio, e.g. 0.35 = +35%). |
| `is_anomaly` | bool | True if the YoY change exceeds the anomaly threshold (30%). |

#### `worldmonitor.trade.v1.CustomsRevenueMonth` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `record_date` | string | Monthly US customs duties revenue from Treasury MTS data. |
| `fiscal_year` | int32 | Monthly US customs duties revenue from Treasury MTS data. |
| `calendar_year` | int32 | Monthly US customs duties revenue from Treasury MTS data. |
| `calendar_month` | int32 | Monthly US customs duties revenue from Treasury MTS data. |
| `monthly_amount_billions` | double | Monthly US customs duties revenue from Treasury MTS data. |
| `fytd_amount_billions` | double | Monthly US customs duties revenue from Treasury MTS data. |

#### `worldmonitor.trade.v1.EffectiveTariffRate` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `source_name` | string | Source name for the effective-rate estimate. |
| `source_url` | string | Canonical source URL for the estimate/methodology. |
| `observation_period` | string | Human-readable observation period (for example "December 2025"). |
| `updated_at` | string | ISO 8601 date when the source page was last updated, if known. |
| `tariff_rate` | double | Effective tariff rate (percentage). |

#### `worldmonitor.trade.v1.TariffDataPoint` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `reporting_country` | string | WTO member code of reporting country. |
| `partner_country` | string | WTO member code of partner country. |
| `product_sector` | string | Product sector or HS chapter. |
| `year` | int32 | Year of observation. |
| `tariff_rate` | double | Applied MFN tariff rate (percentage). |
| `bound_rate` | double | WTO bound tariff rate (percentage). |
| `indicator_code` | string | WTO indicator code used for this datapoint. |

#### `worldmonitor.trade.v1.TradeBarrier` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique barrier notification identifier. |
| `notifying_country` | string | Country that notified the measure. |
| `title` | string | Title of the notification. |
| `measure_type` | string | Measure classification: "SPS" or "TBT". |
| `product_description` | string | Product description or affected goods. |
| `objective` | string | Stated objective of the measure. |
| `status` | string | Status of the notification. |
| `date_distributed` | string | ISO 8601 date when notification was distributed. |
| `source_url` | string | WTO source document URL (must be http/https protocol). |

#### `worldmonitor.trade.v1.TradeFlowRecord` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `reporting_country` | string | WTO member code of reporting country. |
| `partner_country` | string | WTO member code of partner country. |
| `year` | int32 | Year of observation. |
| `export_value_usd` | double | Merchandise export value in millions USD. |
| `import_value_usd` | double | Merchandise import value in millions USD. |
| `yoy_export_change` | double | Year-over-year export change (percentage). |
| `yoy_import_change` | double | Year-over-year import change (percentage). |
| `product_sector` | string | Product sector or HS chapter. |

#### `worldmonitor.trade.v1.TradeRestriction` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique restriction identifier from WTO. |
| `reporting_country` | string | ISO 3166-1 alpha-3 or WTO member code of reporting country. |
| `affected_country` | string | Country affected by the restriction. |
| `product_sector` | string | Product sector or HS chapter description. |
| `measure_type` | string | Measure classification: "QR", "EXPORT_BAN", "IMPORT_BAN", "LICENSING". |
| `description` | string | Human-readable description of the measure. |
| `status` | string | Current status: "IN_FORCE", "TERMINATED", "NOTIFIED". |
| `notified_at` | string | ISO 8601 date when measure was notified. |
| `source_url` | string | WTO source document URL (must be http/https protocol). |

##### `trade` 域枚举

| enum | 取值 |
|---|---|
| `TariffTrendUnavailableReason` | `TARIFF_TREND_UNAVAILABLE_REASON_UNSPECIFIED`, `TARIFF_TREND_UNAVAILABLE_REASON_INVALID_REQUEST`, `TARIFF_TREND_UNAVAILABLE_REASON_NOT_COVERED`, `TARIFF_TREND_UNAVAILABLE_REASON_SEED_MISSING`, `TARIFF_TREND_UNAVAILABLE_REASON_COVERAGE_UNKNOWN`, `TARIFF_TREND_UNAVAILABLE_REASON_CACHE_UNAVAILABLE` |
| `TradeFlowUnavailableReason` | `TRADE_FLOW_UNAVAILABLE_REASON_UNSPECIFIED`, `TRADE_FLOW_UNAVAILABLE_REASON_INVALID_REQUEST`, `TRADE_FLOW_UNAVAILABLE_REASON_NOT_COVERED`, `TRADE_FLOW_UNAVAILABLE_REASON_SEED_MISSING`, `TRADE_FLOW_UNAVAILABLE_REASON_COVERAGE_UNKNOWN`, `TRADE_FLOW_UNAVAILABLE_REASON_CACHE_UNAVAILABLE` |

---

### 3.26 `unrest` — 1 个面板消费

- proto 文件：3 个（`list_unrest_events.proto`, `service.proto`, `unrest_event.proto`）
- message：4 个（业务数据 2，包装 2）；enum：3 个
- 消费面板：`social-velocity`

#### `worldmonitor.unrest.v1.UnrestCluster` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique cluster identifier. |
| `country` | string | Country of the cluster. |
| `region` | string | Region within the country. |
| `event_count` | int32 | Number of events in this cluster. |
| `events` | UnrestEvent[] | The events in this cluster. |
| `severity` | worldmonitor.core.v1.SeverityLevel | Overall severity of the cluster. |
| `primary_cause` | string | Primary cause or theme of the unrest. |

#### `worldmonitor.unrest.v1.UnrestEvent` — 15 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | Event title or headline. |
| `summary` | string | Brief summary of the event. |
| `event_type` | UnrestEventType | Type of unrest event. |
| `city` | string | City where the event occurred. |
| `country` | string | Country where the event occurred. |
| `region` | string | Administrative region within the country. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Geographic location of the event. |
| `severity` | worldmonitor.core.v1.SeverityLevel | Severity assessment. |
| `fatalities` | int32 | Reported fatalities, if any. |
| `sources` | string[] | Source identifiers. |
| `source_type` | UnrestSourceType | Data source type. |
| `tags` | string[] | Descriptive tags. |
| `actors` | string[] | Named actors involved. |
| `confidence` | ConfidenceLevel | Confidence in the event data. |
| `source_urls` | string[] | Source article URLs, when provided by the upstream feed. |

##### `unrest` 域枚举

| enum | 取值 |
|---|---|
| `ConfidenceLevel` | `CONFIDENCE_LEVEL_UNSPECIFIED`, `CONFIDENCE_LEVEL_LOW`, `CONFIDENCE_LEVEL_MEDIUM`, `CONFIDENCE_LEVEL_HIGH` |
| `UnrestEventType` | `UNREST_EVENT_TYPE_UNSPECIFIED`, `UNREST_EVENT_TYPE_PROTEST`, `UNREST_EVENT_TYPE_RIOT`, `UNREST_EVENT_TYPE_STRIKE`, `UNREST_EVENT_TYPE_DEMONSTRATION`, `UNREST_EVENT_TYPE_CIVIL_UNREST` |
| `UnrestSourceType` | `UNREST_SOURCE_TYPE_UNSPECIFIED`, `UNREST_SOURCE_TYPE_ACLED`, `UNREST_SOURCE_TYPE_GDELT`, `UNREST_SOURCE_TYPE_RSS` |

---

### 3.27 `batch` — 0 个面板消费

- proto 文件：2 个（`execute_batch.proto`, `service.proto`）
- message：5 个（业务数据 2，包装 3）；enum：0 个

#### `worldmonitor.batch.v1.BatchOperationBody` — 0 字段

（oneof / map 等结构，见 proto 原文）

#### `worldmonitor.batch.v1.BatchOperationResult` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Correlation id from the request (or the operation's zero-based index when omitted). |
| `status` | int32 | HTTP status code returned by the operation, or 0 when the operation could not be executed at all (see error). |
| `body` | BatchOperationBody | Decoded JSON response body of the operation, exactly as the target operation returned it. Omitted when error is set. |
| `error` | string | Machine-readable failure reason when no response body is available: invalid_path, nested_batch, timeout, fetch_failed, response_too_large, or invalid_json. |

---

### 3.28 `company_monitoring` — 0 个面板消费

- proto 文件：5 个（`company_monitoring.proto`, `coverage.proto`, `events.proto`, `portfolio.proto`, `service.proto`）
- message：35 个（业务数据 7，包装 28）；enum：17 个

#### `worldmonitor.company_monitoring.v1.CompanyCoverage` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `state` | CompanyCoverageState | CompanyCoverage separates source completeness, assessment readiness, and observation. |
| `observation` | CompanyObservationState | CompanyCoverage separates source completeness, assessment readiness, and observation. |
| `assessment_ready` | bool | CompanyCoverage separates source completeness, assessment readiness, and observation. |
| `changed_at` | string | CompanyCoverage separates source completeness, assessment readiness, and observation. |

#### `worldmonitor.company_monitoring.v1.CompanyMaterialImpact` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `is_current` | bool | Stable WorldMonitor logical IDs; never storage-layer document IDs. |
| `direction` | MaterialImpactDirection | Stable WorldMonitor logical IDs; never storage-layer document IDs. |
| `magnitude` | MaterialImpactMagnitude | Stable WorldMonitor logical IDs; never storage-layer document IDs. |
| `confidence` | ConfidenceAxes | Stable WorldMonitor logical IDs; never storage-layer document IDs. |
| `lifecycle` | MaterialImpactLifecycle | Stable WorldMonitor logical IDs; never storage-layer document IDs. |
| `occurred_at` | string | Stable WorldMonitor logical IDs; never storage-layer document IDs. |
| `changed_at` | string | Stable WorldMonitor logical IDs; never storage-layer document IDs. |
| `evidence_truncated` | bool | Stable WorldMonitor logical IDs; never storage-layer document IDs. |

#### `worldmonitor.company_monitoring.v1.CompanyMonitoringFeatureFlags` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `exa_provider` | bool | CompanyMonitoringFeatureFlags exposes independent rollout state without an aggregate switch. |
| `x_provider` | bool | CompanyMonitoringFeatureFlags exposes independent rollout state without an aggregate switch. |
| `publication` | bool | CompanyMonitoringFeatureFlags exposes independent rollout state without an aggregate switch. |
| `rest_writes` | bool | CompanyMonitoringFeatureFlags exposes independent rollout state without an aggregate switch. |
| `ui` | bool | CompanyMonitoringFeatureFlags exposes independent rollout state without an aggregate switch. |
| `alerts` | bool | CompanyMonitoringFeatureFlags exposes independent rollout state without an aggregate switch. |

#### `worldmonitor.company_monitoring.v1.ConfidenceAxes` — 0 字段

（oneof / map 等结构，见 proto 原文）

#### `worldmonitor.company_monitoring.v1.MaterialEvent` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lifecycle` | MaterialImpactLifecycle | Stable WorldMonitor logical ID; never a storage-layer document ID. |
| `occurred_at` | string | Stable WorldMonitor logical ID; never a storage-layer document ID. |

#### `worldmonitor.company_monitoring.v1.MonitoredCompany` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Stable WorldMonitor logical ID; never a storage-layer document ID. |
| `domicile_country` | DomicileCountry | Stable WorldMonitor logical ID; never a storage-layer document ID. |
| `lifecycle` | MonitoredCompanyLifecycle | Stable WorldMonitor logical ID; never a storage-layer document ID. |
| `coverage` | CompanyCoverageState | Stable WorldMonitor logical ID; never a storage-layer document ID. |
| `observation` | CompanyObservationState | Stable WorldMonitor logical ID; never a storage-layer document ID. |
| `created_at` | string | Stable WorldMonitor logical ID; never a storage-layer document ID. |
| `updated_at` | string | Stable WorldMonitor logical ID; never a storage-layer document ID. |
| `canonical_url` | string | Stable WorldMonitor logical ID; never a storage-layer document ID. |

#### `worldmonitor.company_monitoring.v1.SnapshotBoundary` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `snapshot_as_of` | string | SnapshotBoundary closes initialization gaps before latest-state polling begins. |

##### `company_monitoring` 域枚举

| enum | 取值 |
|---|---|
| `CompanyClaimAllowedUse` | `COMPANY_CLAIM_ALLOWED_USE_UNSPECIFIED`, `COMPANY_CLAIM_ALLOWED_USE_DISCOVERY`, `COMPANY_CLAIM_ALLOWED_USE_ATTRIBUTION`, `COMPANY_CLAIM_ALLOWED_USE_PRIMARY_EVIDENCE` |
| `CompanyClaimTrustState` | `COMPANY_CLAIM_TRUST_STATE_UNSPECIFIED`, `COMPANY_CLAIM_TRUST_STATE_DECLARED`, `COMPANY_CLAIM_TRUST_STATE_VERIFIED`, `COMPANY_CLAIM_TRUST_STATE_EXPIRED`, `COMPANY_CLAIM_TRUST_STATE_REJECTED` |
| `CompanyClaimType` | `COMPANY_CLAIM_TYPE_UNSPECIFIED`, `COMPANY_CLAIM_TYPE_ALIAS`, `COMPANY_CLAIM_TYPE_DOMAIN`, `COMPANY_CLAIM_TYPE_LEGAL_IDENTIFIER`, `COMPANY_CLAIM_TYPE_X_ACCOUNT_ID`, `COMPANY_CLAIM_TYPE_X_HANDLE`, `COMPANY_CLAIM_TYPE_LOCATION`, `COMPANY_CLAIM_TYPE_CUSTOMER_REFERENCE` |
| `CompanyCoverageState` | `COMPANY_COVERAGE_STATE_UNSPECIFIED`, `COMPANY_COVERAGE_STATE_AWAITING_FIRST_SCAN`, `COMPANY_COVERAGE_STATE_ADEQUATE`, `COMPANY_COVERAGE_STATE_PARTIAL`, `COMPANY_COVERAGE_STATE_STALE`, `COMPANY_COVERAGE_STATE_UNAVAILABLE`, `COMPANY_COVERAGE_STATE_NEEDS_CONFIRMATION`, `COMPANY_COVERAGE_STATE_IDENTITY_UNRESOLVED` |
| `CompanyEventPollState` | `COMPANY_EVENT_POLL_STATE_UNSPECIFIED`, `COMPANY_EVENT_POLL_STATE_CURRENT`, `COMPANY_EVENT_POLL_STATE_SNAPSHOT_REQUIRED` |
| `CompanyImportRowOutcome` | `COMPANY_IMPORT_ROW_OUTCOME_UNSPECIFIED`, `COMPANY_IMPORT_ROW_OUTCOME_CREATED`, `COMPANY_IMPORT_ROW_OUTCOME_REPLAYED`, `COMPANY_IMPORT_ROW_OUTCOME_CONFLICT`, `COMPANY_IMPORT_ROW_OUTCOME_REJECTED`, `COMPANY_IMPORT_ROW_OUTCOME_NO_OP` |
| `CompanyMonitoringAccessState` | `COMPANY_MONITORING_ACCESS_STATE_UNSPECIFIED`, `COMPANY_MONITORING_ACCESS_STATE_DISABLED`, `COMPANY_MONITORING_ACCESS_STATE_ENTITLED`, `COMPANY_MONITORING_ACCESS_STATE_ENTITLEMENT_LAPSED`, `COMPANY_MONITORING_ACCESS_STATE_DENIED` |
| `CompanyObservationState` | `COMPANY_OBSERVATION_STATE_UNSPECIFIED`, `COMPANY_OBSERVATION_STATE_EVENTS_OBSERVED`, `COMPANY_OBSERVATION_STATE_NO_EVENTS_OBSERVED`, `COMPANY_OBSERVATION_STATE_UNKNOWN` |
| `DomicileCountry` | `DOMICILE_COUNTRY_UNSPECIFIED`, `DOMICILE_COUNTRY_US`, `DOMICILE_COUNTRY_GB` |
| `EvidenceAuthorityTier` | `EVIDENCE_AUTHORITY_TIER_UNSPECIFIED`, `EVIDENCE_AUTHORITY_TIER_PRIMARY_VERIFIED`, `EVIDENCE_AUTHORITY_TIER_INDEPENDENT_AUTHORITATIVE`, `EVIDENCE_AUTHORITY_TIER_ORDINARY` |
| `MaterialImpactChannel` | `MATERIAL_IMPACT_CHANNEL_UNSPECIFIED`, `MATERIAL_IMPACT_CHANNEL_REPUTATION`, `MATERIAL_IMPACT_CHANNEL_FINANCES` |
| `MaterialImpactDirection` | `MATERIAL_IMPACT_DIRECTION_UNSPECIFIED`, `MATERIAL_IMPACT_DIRECTION_POSITIVE`, `MATERIAL_IMPACT_DIRECTION_NEGATIVE`, `MATERIAL_IMPACT_DIRECTION_MIXED` |
| `MaterialImpactLifecycle` | `MATERIAL_IMPACT_LIFECYCLE_UNSPECIFIED`, `MATERIAL_IMPACT_LIFECYCLE_ADMITTED`, `MATERIAL_IMPACT_LIFECYCLE_CORRECTED`, `MATERIAL_IMPACT_LIFECYCLE_RETRACTED` |
| `MaterialImpactMagnitude` | `MATERIAL_IMPACT_MAGNITUDE_UNSPECIFIED`, `MATERIAL_IMPACT_MAGNITUDE_LOW`, `MATERIAL_IMPACT_MAGNITUDE_MEDIUM`, `MATERIAL_IMPACT_MAGNITUDE_HIGH` |
| `MonitoredCompanyLifecycle` | `MONITORED_COMPANY_LIFECYCLE_UNSPECIFIED`, `MONITORED_COMPANY_LIFECYCLE_ACTIVE`, `MONITORED_COMPANY_LIFECYCLE_PAUSED`, `MONITORED_COMPANY_LIFECYCLE_REMOVED` |
| `MonitoringProvider` | `MONITORING_PROVIDER_UNSPECIFIED`, `MONITORING_PROVIDER_EXA`, `MONITORING_PROVIDER_X` |
| `ProviderCoverageState` | `PROVIDER_COVERAGE_STATE_UNSPECIFIED`, `PROVIDER_COVERAGE_STATE_COMPLETE`, `PROVIDER_COVERAGE_STATE_PARTIAL`, `PROVIDER_COVERAGE_STATE_FAILED` |

---

### 3.29 `core` — 0 个面板消费

- proto 文件：8 个（`country.proto`, `general_error.proto`, `geo.proto`, `i18n.proto`, `identifiers.proto`, `pagination.proto`, `severity.proto`, `time.proto`）
- message：12 个（业务数据 5，包装 7）；enum：3 个

#### `worldmonitor.core.v1.GeoBlocked` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `reason` | string | Human-readable reason for the geographic restriction. |

#### `worldmonitor.core.v1.GeoCoordinates` — 0 字段

（oneof / map 等结构，见 proto 原文）

#### `worldmonitor.core.v1.MaintenanceMode` — 0 字段

（oneof / map 等结构，见 proto 原文）

#### `worldmonitor.core.v1.RateLimited` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `retry_after_seconds` | int32 | Number of seconds to wait before retrying the request. |
| `provider` | string | Name of the upstream provider that imposed the rate limit. |

#### `worldmonitor.core.v1.UpstreamDown` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `provider` | string | Name of the unavailable upstream provider. |
| `message` | string | Human-readable description of the outage. |

##### `core` 域枚举

| enum | 取值 |
|---|---|
| `CriticalityLevel` | `CRITICALITY_LEVEL_UNSPECIFIED`, `CRITICALITY_LEVEL_LOW`, `CRITICALITY_LEVEL_MEDIUM`, `CRITICALITY_LEVEL_HIGH`, `CRITICALITY_LEVEL_CRITICAL` |
| `SeverityLevel` | `SEVERITY_LEVEL_UNSPECIFIED`, `SEVERITY_LEVEL_LOW`, `SEVERITY_LEVEL_MEDIUM`, `SEVERITY_LEVEL_HIGH` |
| `TrendDirection` | `TREND_DIRECTION_UNSPECIFIED`, `TREND_DIRECTION_RISING`, `TREND_DIRECTION_STABLE`, `TREND_DIRECTION_FALLING` |

---

### 3.30 `health` — 0 个面板消费

- proto 文件：3 个（`list_air_quality_alerts.proto`, `list_disease_outbreaks.proto`, `service.proto`）
- message：6 个（业务数据 2，包装 4）；enum：0 个

#### `worldmonitor.health.v1.AirQualityAlert` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `city` | string |  |
| `country_code` | string |  |
| `lat` | double |  |
| `lng` | double |  |
| `pm25` | double |  |
| `aqi` | int32 |  |
| `risk_level` | string |  |
| `pollutant` | string |  |
| `source` | string |  |

#### `worldmonitor.health.v1.DiseaseOutbreakItem` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Unique identifier (URL-derived). |
| `disease` | string | Disease or outbreak name. |
| `location` | string | Affected country or region. |
| `country_code` | string | ISO2 country code when known. |
| `alert_level` | string | Alert level: "watch" / "warning" / "alert". |
| `summary` | string | Short description from the source. |
| `source_url` | string | Source URL. |
| `source_name` | string | Source name (e.g., "WHO", "ProMED", "HealthMap"). |
| `lat` | double | Precise latitude from source (overrides country centroid on map when non-zero). |
| `lng` | double | Precise longitude from source (overrides country centroid on map when non-zero). |
| `cases` | int32 | Case count if reported by source (0 = unknown). |

---

### 3.31 `infrastructure` — 0 个面板消费

- proto 文件：13 个（`get_bootstrap_data.proto`, `get_cable_health.proto`, `get_ip_geo.proto`, `get_temporal_baseline.proto`, `infrastructure.proto`, `list_internet_ddos_attacks.proto`, `list_internet_outages.proto`, `list_internet_traffic_anomalies.proto` …）
- message：33 个（业务数据 10，包装 23）；enum：3 个

#### `worldmonitor.infrastructure.v1.BaselineAnomaly` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `z_score` | double | Number of standard deviations from the mean. |
| `severity` | string | Severity label: "critical", "high", "medium", "normal". |
| `multiplier` | double | Ratio of current count to baseline mean. |

#### `worldmonitor.infrastructure.v1.BaselineStats` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `mean` | double | Running mean of observed counts. |
| `std_dev` | double | Standard deviation derived from Welford's M2. |
| `sample_count` | int32 | Number of samples incorporated so far. |

#### `worldmonitor.infrastructure.v1.BaselineUpdate` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `count` | double | Submitted count. The disabled endpoint does not persist this value. |

#### `worldmonitor.infrastructure.v1.CableHealthEvidence` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `source` | string | Evidence source (e.g. "NGA"). |
| `summary` | string | Human-readable summary of the evidence. |

#### `worldmonitor.infrastructure.v1.DdosAttackSummaryEntry` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `label` | string | Protocol or vector name (e.g. "TCP", "UDP", "networkFlood"). |
| `percentage` | float | Percentage share of total DDoS traffic (0–100). |

#### `worldmonitor.infrastructure.v1.DdosLocationHit` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_code` | string | ISO 3166-1 alpha-2 country code. |
| `country_name` | string | Country display name. |
| `percentage` | float | Percentage share of total DDoS traffic targeting this location (0-100). |
| `latitude` | float | Latitude of the target location. |
| `longitude` | float | Longitude of the target location. |

#### `worldmonitor.infrastructure.v1.InternetOutage` — 10 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | Outage title. |
| `link` | string | URL to the outage report. |
| `description` | string | Outage description. |
| `country` | string | Affected country (ISO 3166-1 alpha-2). |
| `region` | string | Affected region within the country. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Outage location. |
| `severity` | OutageSeverity | Outage severity. |
| `categories` | string[] | Affected infrastructure categories. |
| `cause` | string | Root cause, if determined. |
| `outage_type` | string | Outage type classification. |

#### `worldmonitor.infrastructure.v1.ServiceStatus` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Service identifier. |
| `name` | string | Service display name. |
| `status` | ServiceOperationalStatus | Current operational status. |
| `description` | string | Status description. |
| `url` | string | Service URL or homepage. |
| `latency_ms` | int32 | Response latency in milliseconds. |

#### `worldmonitor.infrastructure.v1.TemporalAnomaly` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | string |  |
| `region` | string |  |
| `current_count` | int32 |  |
| `expected_count` | int32 |  |
| `z_score` | double |  |
| `severity` | string |  |
| `multiplier` | double |  |
| `message` | string |  |

#### `worldmonitor.infrastructure.v1.TrafficAnomaly` — 9 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `uuid` | string | Unique identifier for the anomaly. |
| `type` | string | Anomaly type (e.g. "ANOMALY_DNS", "ANOMALY_BGP"). |
| `status` | string | Current status ("ONGOING" or "HISTORICAL"). |
| `asn` | string | Autonomous System Number affected. |
| `asn_name` | string | ASN display name. |
| `location_code` | string | ISO 3166-1 alpha-2 country code. |
| `location_name` | string | Country display name. |
| `latitude` | float | Latitude of the affected location. |
| `longitude` | float | Longitude of the affected location. |

##### `infrastructure` 域枚举

| enum | 取值 |
|---|---|
| `CableHealthStatus` | `CABLE_HEALTH_STATUS_UNSPECIFIED`, `CABLE_HEALTH_STATUS_OK`, `CABLE_HEALTH_STATUS_DEGRADED`, `CABLE_HEALTH_STATUS_FAULT` |
| `OutageSeverity` | `OUTAGE_SEVERITY_UNSPECIFIED`, `OUTAGE_SEVERITY_PARTIAL`, `OUTAGE_SEVERITY_MAJOR`, `OUTAGE_SEVERITY_TOTAL` |
| `ServiceOperationalStatus` | `SERVICE_OPERATIONAL_STATUS_UNSPECIFIED`, `SERVICE_OPERATIONAL_STATUS_OPERATIONAL`, `SERVICE_OPERATIONAL_STATUS_DEGRADED`, `SERVICE_OPERATIONAL_STATUS_PARTIAL_OUTAGE`, `SERVICE_OPERATIONAL_STATUS_MAJOR_OUTAGE`, `SERVICE_OPERATIONAL_STATUS_MAINTENANCE` |

---

### 3.32 `leads` — 0 个面板消费

- proto 文件：3 个（`register_interest.proto`, `service.proto`, `submit_contact.proto`）
- message：4 个（业务数据 4，包装 0）；enum：0 个

#### `worldmonitor.leads.v1.RegisterInterestRequest` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `source` | string | RegisterInterestRequest carries a Pro-waitlist signup. |
| `app_version` | string | RegisterInterestRequest carries a Pro-waitlist signup. |
| `referred_by` | string | RegisterInterestRequest carries a Pro-waitlist signup. |
| `website` | string | Honeypot — bots auto-fill this hidden field; real submissions leave it empty. |
| `turnstile_token` | string | Cloudflare Turnstile token. Desktop sources bypass Turnstile; see handler. |

#### `worldmonitor.leads.v1.RegisterInterestResponse` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | "registered" for a new signup; "already_registered" for a returning email. |
| `referral_code` | string | Stable referral code for this email. |
| `referral_count` | int32 | Number of signups credited to this email. |
| `position` | int32 | Waitlist position at registration time. Present only when status == "registered". |
| `email_suppressed` | bool | True when the email is on the suppression list (prior bounce) and no confirmation was sent. |

#### `worldmonitor.leads.v1.SubmitContactRequest` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `message` | string | SubmitContactRequest carries an enterprise contact form submission. |
| `source` | string | SubmitContactRequest carries an enterprise contact form submission. |
| `website` | string | Honeypot — bots auto-fill this hidden field; real submissions leave it empty. |

#### `worldmonitor.leads.v1.SubmitContactResponse` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | Always "sent" on success. |
| `email_sent` | bool | True when the Resend notification to ops was delivered. |

---

### 3.33 `resilience` — 0 个面板消费

- proto 文件：8 个（`get_demographics_capability.proto`, `get_food_stocks.proto`, `get_resilience_indicators.proto`, `get_resilience_ranking.proto`, `get_resilience_runtime_manifest.proto`, `get_resilience_score.proto`, `resilience.proto`, `service.proto`）
- message：33 个（业务数据 21，包装 12）；enum：0 个

#### `worldmonitor.resilience.v1.CapabilityObservation` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `available` | bool | True only when value, year, source and unit passed the server contract. |
| `value` | double | Numeric observation. Read available first: zero is also the proto3 placeholder. |
| `year` | uint32 | Observation year from the source, not the seed run year. |
| `source` | string | Provider or dataset attribution stored with the observation. |
| `unit` | string | Human-readable unit such as "percent", "people", or "years". |

#### `worldmonitor.resilience.v1.DemographicsAgeStructure` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `available` | bool | Most recent source observation year retained for the stage. |
| `median_age_years` | CapabilityObservation | Most recent source observation year retained for the stage. |
| `old_age_dependency_ratio_percent` | CapabilityObservation | Most recent source observation year retained for the stage. |
| `total_dependency_ratio_percent` | CapabilityObservation | Most recent source observation year retained for the stage. |
| `working_age_population_people` | CapabilityObservation | Most recent source observation year retained for the stage. |
| `working_age_population_projected_10y_people` | CapabilityObservation | Most recent source observation year retained for the stage. |

#### `worldmonitor.resilience.v1.DemographicsCapabilityStage` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Stable stage name: wpp, education, or ilostat. |
| `status` | string | Seeder state, normally fresh, retained, or unavailable. |
| `fetched_at` | string | ISO-8601 time of the data retained for this stage. |
| `record_count` | uint32 | Number of country records retained for the stage. |
| `newest_observation_year` | uint32 | Most recent source observation year retained for the stage. |

#### `worldmonitor.resilience.v1.DemographicsEducation` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `available` | bool | Most recent source observation year retained for the stage. |
| `tertiary_enrollment_gross_percent` | CapabilityObservation | Most recent source observation year retained for the stage. |
| `stem_graduates_share_percent` | CapabilityObservation | Most recent source observation year retained for the stage. |
| `researchers_per_million` | CapabilityObservation | Most recent source observation year retained for the stage. |

#### `worldmonitor.resilience.v1.DemographicsIndustrialWorkforce` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `available` | bool | Most recent source observation year retained for the stage. |
| `craft_trades_employment_people` | CapabilityObservation | Most recent source observation year retained for the stage. |
| `plant_machine_operators_employment_people` | CapabilityObservation | Most recent source observation year retained for the stage. |
| `trained_industrial_workforce_people` | CapabilityObservation | Most recent source observation year retained for the stage. |
| `manufacturing_employment_share_percent` | CapabilityObservation | Most recent source observation year retained for the stage. |

#### `worldmonitor.resilience.v1.DimensionFreshness` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `last_observed_at_ms` | int64 | Unix milliseconds when the oldest constituent signal in this dimension was last observed (min fetchedAt across INDICATOR_REGISTRY entries for this dimension). 0 when no signal has ever been observed. |
| `staleness` | string | Worst staleness level across the dimension's constituent signals, classified by classifyStaleness against each signal's cadence. One of: "fresh", "aging", "stale". Empty string when no signals. |

#### `worldmonitor.resilience.v1.FoodStockRecord` — 14 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_code` | string | ISO 3166-1 alpha-2, or "WORLD" for the global balance sheet. |
| `commodity` | string | Commodity slug: wheat, corn, rice, soybeans, barley, palmOil. |
| `marketing_year` | string | Marketing year label stored verbatim, e.g. "2025/26". Never a calendar year. |
| `stocks_to_use` | double | Ending stocks divided by total use (0.18 = 18%). Read has_stocks_to_use BEFORE this value: proto3 has no presence for a bare double, so an unknown ratio and a genuine 0% are the same wire value. USDA/PSD estimates ending stocks only for selected countries, so a minor producer routinely reports real production and consumption with no stocks series at all — and 0.0% on a food-security surface reads as famine, not as "not measured". |
| `has_stocks_to_use` | bool | False when stocks_to_use is a placeholder rather than a measurement. |
| `ending_stocks_tmt` | double | Ending stocks in thousand metric tons. Read has_ending_stocks first, for the same reason as stocks_to_use above. |
| `has_ending_stocks` | bool | False when ending_stocks_tmt is a placeholder rather than a measurement. |
| `total_use_tmt` | double | 1000 MT. PSD country: consumption + exports. WORLD: consumption. FAOSTAT: domestic-supply quantity. |
| `production_tmt` | double | Production in thousand metric tons. Zero when unknown. |
| `consumption_tmt` | double | 1000 MT. PSD: domestic consumption. FAOSTAT: domestic-supply quantity. Zero when unknown. |
| `imports_tmt` | double | Imports in thousand metric tons. Zero when unknown. |
| `exports_tmt` | double | Exports in thousand metric tons. Zero when unknown. |
| `unit` | string | Unit the raw quantities are stored in, typically "1000 MT". |
| `source` | string | "psd" or "faostat". FAOSTAT Food Balances supplies production and domestic-supply, but no stocks. |

#### `worldmonitor.resilience.v1.ResilienceDimension` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Worst staleness level across the dimension's constituent signals, classified by classifyStaleness against each signal's cadence. One of: "fresh", "aging", "stale". Empty string when no signals. |
| `score` | double | Worst staleness level across the dimension's constituent signals, classified by classifyStaleness against each signal's cadence. One of: "fresh", "aging", "stale". Empty string when no signals. |
| `coverage` | double | Worst staleness level across the dimension's constituent signals, classified by classifyStaleness against each signal's cadence. One of: "fresh", "aging", "stale". Empty string when no signals. |
| `observed_weight` | double | Worst staleness level across the dimension's constituent signals, classified by classifyStaleness against each signal's cadence. One of: "fresh", "aging", "stale". Empty string when no signals. |
| `imputed_weight` | double | Worst staleness level across the dimension's constituent signals, classified by classifyStaleness against each signal's cadence. One of: "fresh", "aging", "stale". Empty string when no signals. |
| `imputation_class` | string | Four-class imputation taxonomy (Phase 1 T1.7). One of: "stable-absence", "unmonitored", "source-failure", "not-applicable". Empty string when the dimension has any observed data AND is not structurally not-applicable. The "not-applicable" value (plan 2026-04-26-001 §U3) is emitted when the dim's construct does not apply to this country (e.g. sovereignFiscalBuffer for non-SWF economies); it is paired with coverage:0 and observed_weight:0 so the dim contributes nothing to the domain mean and is filtered out of user-facing confidence/coverage signals on both server and client. See docs/methodology/country-resilience-index.mdx. |
| `freshness` | DimensionFreshness | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |

#### `worldmonitor.resilience.v1.ResilienceDomain` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |
| `score` | double | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |
| `weight` | double | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |
| `dimensions` | ResilienceDimension[] | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |

#### `worldmonitor.resilience.v1.ResilienceIndicator` — 29 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Stable indicator identifier from the 72-row registry. |
| `dimension` | string | Stable identifier of the dimension that owns this indicator. |
| `tier` | string | Scoring tier: core, enrichment, or experimental. |
| `active` | bool | Active means the current construct version can use this indicator. |
| `included_in_dimension_score` | bool | True when this country observation participated in the dimension score. |
| `state` | string | observed, imputed, missing, fallback, source-failure, inactive, retired, or not-applicable. |
| `reason` | string | Explains exclusion, inactive selection, retirement, or fallback state. |
| `normalized_score_available` | bool | True when normalized_score contains the score used by the scorer. |
| `normalized_score` | double | Indicator score normalized to the 0-100 resilience scale. |
| `nominal_weight` | double | Configured indicator weight before runtime selection or reweighting. |
| `runtime_weight_available` | bool | True when runtime_weight applies to this execution path. |
| `runtime_weight` | double | Weight selected by the executed scorer branch before normalization. |
| `scoring_weight_share_available` | bool | True when scoring_weight_share applies to this execution path. |
| `scoring_weight_share` | double | Indicator share of the active blend after runtime reweighting. |
| `literal_contribution` | double | Indicator contribution before dimension-level caps or adjustments. |
| `effective_contribution` | double | Reconciled contribution after dimension-level caps or adjustments. |
| `imputation_class` | string | Empty for observed or unavailable rows; otherwise the scorer taxonomy. |
| `source_year_available` | bool | True when source_year contains the provider observation year. |
| `source_year` | uint32 | Provider observation year, not the WorldMonitor retrieval year. |
| `observation_age_available` | bool | Age of the source observation, not the time since WorldMonitor fetched it. |
| `observation_age_value` | uint32 | Integer observation age expressed in observation_age_unit. |
| `observation_age_unit` | string | "days" for an observation timestamp or "years" for an annual source row. |
| `observation_age_basis` | string | "observation-timestamp" or "source-year". Never derived from retrieval time. |
| `retrieved_at_available` | bool | True when retrieved_at contains an explicit retrieval timestamp. |
| `retrieved_at` | string | Explicit ISO-8601 retrieval timestamp; never inferred from source year. |
| `observed_at_available` | bool | True when observed_at contains a provider observation timestamp. |
| `observed_at` | string | Provider observation timestamp in ISO-8601 form. |
| `sources` | ResilienceIndicatorSource[] | Provider observation timestamp in ISO-8601 form. |
| `raw_value` | ResilienceIndicatorRawValue | Provider observation timestamp in ISO-8601 form. |

#### `worldmonitor.resilience.v1.ResilienceIndicatorDimension` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Stable dimension identifier from the resilience construct. |
| `score` | double | Final dimension score on the 0-100 scale. |
| `coverage` | double | Fraction of active dimension weight backed by observations, from 0 to 1. |
| `pre_policy_score` | double | Dimension score before a policy cap or other post-blend adjustment. |
| `policy_cap_name` | string | Name of the applied post-blend policy cap, or empty when none applies. |
| `policy_cap_factor` | double | Multiplicative factor applied by the post-blend policy cap. |
| `literal_contribution_total` | double | Sum of literal indicator contributions before dimension-level policy. |
| `effective_contribution_total` | double | Sum of exposed effective contributions. This reconciles to score. |
| `active` | bool | False for retired or runtime-disabled placeholder dimensions. |
| `reconciliation_available` | bool | True when effective_contribution_total is required to equal score. |
| `reason` | string | Explanation when this dimension is inactive or cannot reconcile contributions. |

#### `worldmonitor.resilience.v1.ResilienceIndicatorRawValue` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `available` | bool | True only when at least one raw value representation may be redistributed. |
| `numeric_value` | double | Numeric raw observation. Read numeric_value_available before this value. |
| `numeric_value_available` | bool | True when numeric_value contains an audited redistributable observation. |
| `text_value` | string | Categorical raw observation. Read text_value_available before this value. |
| `text_value_available` | bool | True when text_value contains an audited redistributable observation. |
| `unit` | string | Unit attached to the raw observation, for example percent or days. |
| `status` | string | available, absent, restricted, audit-incomplete, conditional, ineligible-observation, or unknown-indicator. |
| `reason` | string | Human-readable explanation for an unavailable or withheld value. |

#### `worldmonitor.resilience.v1.ResilienceIndicatorSource` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | string | Stable source or cache key used by the resilience scorer. |
| `name` | string | Human-readable provider or dataset name. |
| `attribution` | string | Attribution text that callers must preserve when displaying the value. |
| `license` | string | Audited source license or redistribution classification. |
| `url` | string | Canonical provider or methodology URL when one is available. |
| `observation_provenance` | bool | True only when this source was recorded for the selected country observation. False means the entry is registry attribution, not observation provenance. |
| `license_url` | string | Canonical URL for the audited source license or redistribution terms. |
| `attribution_url` | string | Canonical attribution URL when it differs from the source dataset URL. |

#### `worldmonitor.resilience.v1.ResiliencePillar` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | "structural-readiness" / "live-shock-exposure" / "recovery-capacity". |
| `score` | double | Pillar score in [0, 100], mean of member domains weighted by domain.weight * average_dimension_coverage. |
| `weight` | double | Pillar weight in the pillar-combined score. Per the plan: 0.40 / 0.35 / 0.25. |
| `coverage` | double | Coverage in [0, 1], mean of member-domain average dimension coverage. |
| `domains` | ResilienceDomain[] | Subset of the 6 ResilienceDomains that compose this pillar. |

#### `worldmonitor.resilience.v1.ResilienceRankingCacheState` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `fetched_at` | string |  |
| `count` | int32 |  |
| `scored` | int32 |  |
| `total` | int32 |  |

#### `worldmonitor.resilience.v1.ResilienceRankingItem` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `country_code` | string | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |
| `overall_score` | double | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |
| `level` | string | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |
| `low_confidence` | bool | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |
| `overall_coverage` | double | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |
| `rank_stable` | bool | Freshness aggregated across the constituent signals of the dimension. Phase 1 T1.5 of the reference-grade upgrade plan. Empty `last_observed_at_ms=0` + `staleness=""` when the dimension has no signals tracked in the indicator registry. |
| `headline_eligible` | bool | Current headline-ranking eligibility. True only when the country passes the headline gate: coverage >= 0.65 AND (population >= 200k OR coverage >= 0.85) AND !lowConfidence. GetResilienceRanking includes only eligible countries in items[]; scored but ineligible countries remain in greyedOut[]. |

#### `worldmonitor.resilience.v1.ResilienceRuntimeCacheState` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `score_prefix` | string |  |
| `ranking_key` | string |  |
| `history_prefix` | string |  |
| `interval_prefix` | string |  |
| `interval_methodology` | string |  |

#### `worldmonitor.resilience.v1.ResilienceRuntimeConstructVersions` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `energy` | string | Safe derived energy construct version. Valid values: "legacy" or "v2". |
| `education` | string | Safe derived education construct version. Valid values: "active" or "rollback". |
| `financial_system_exposure` | string | Safe derived financial-system construct version. Valid values: "active" or "rollback". |

#### `worldmonitor.resilience.v1.ResilienceRuntimeFlag` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string |  |
| `enabled` | bool |  |

#### `worldmonitor.resilience.v1.ResilienceRuntimeIntervalState` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `available` | bool | True only when the public sample interval matches the active formula, education construct version, and interval methodology. |
| `methodology` | string | Public methodology tag used to audit scoreInterval/rankStable semantics. |
| `sample_country` | string | ISO2 country used for the public availability probe. |
| `last_observed_at` | string | Latest safe observed timestamp from interval seed-meta or sample payload. |

#### `worldmonitor.resilience.v1.ScoreInterval` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `p05` | double | ISO 3166-1 alpha-2 country code to score. |
| `p95` | double | ISO 3166-1 alpha-2 country code to score. |

---

### 3.34 `scenario` — 0 个面板消费

- proto 文件：4 个（`get_scenario_status.proto`, `list_scenario_templates.proto`, `run_scenario.proto`, `service.proto`）
- message：12 个（业务数据 6，包装 6）；enum：0 个

#### `worldmonitor.scenario.v1.ScenarioCoverage` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | string | complete, partial, or unknown. Complete refers to the bounded manifest only. |
| `country_ids` | string[] | Requested countries: one selected country or the manifest country universe. |
| `hs2_codes` | string[] | Requested template chapters, or manifest chapters for all-sector templates. |
| `records` | ScenarioCoverageRecord[] | One entry per requested country/chapter pair when the manifest is known, so len(country_ids) x len(hs2_codes) entries — 197 x 17 = 3,349 (~450 KB) at current seeded cardinality for an all-sector template, or len(hs2_codes) for a scoped country. Empty when status is "unknown". |
| `manifest_fetched_at` | string | Seed metadata production time, not trade observation time. |

#### `worldmonitor.scenario.v1.ScenarioCoverageRecord` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iso2` | string | Requested 2-letter ISO country code; paired with hs2 as the record reference. |
| `hs2` | string | Requested 2-digit HS chapter; paired with iso2 as the record reference. |
| `state` | string | evaluated, missing, malformed, incomplete_routes, or not_seeded. incomplete_routes means the cached record was well-formed but did not carry an entry for every chokepoint this scenario disrupts — seeder/template registry drift, NOT corrupt cache data. |
| `basis` | string | flow_weighted or country_route_fallback, only for evaluated records. |
| `raw_impact` | double | Relative score units, not currency. Present only for evaluated records. |
| `fetched_at` | string | Cache production time. Observation date is unknown unless separately supplied. |

#### `worldmonitor.scenario.v1.ScenarioImpactCountry` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `iso2` | string | 2-letter ISO country code. |
| `total_impact` | double | Raw weighted impact value aggregated across the country's exposed HS2 chapters. Physical scenarios use exposureScore * (disruption_pct / 100) * cost_shock_multiplier; tariff-shock scenarios use vulnerabilityIndex * cost_shock_multiplier. Relative-only - not a currency amount. |
| `impact_pct` | int32 | Impact as a 0-100 share of max(maxReturnedTotalImpact, 1), capped at 100. Because of the denominator floor, the top country can be below 100 when all returned totalImpact values are below 1. |
| `evaluated_records` | int32 | Country/sector records that actually produced total_impact. |
| `requested_records` | int32 | Country/sector records requested for this country. |
| `partial_evidence` | bool | True when evaluated_records < requested_records. total_impact is then a LOWER BOUND over the evidence that was available, not the country's impact, and must not be read as low exposure. |

#### `worldmonitor.scenario.v1.ScenarioResult` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `affected_chokepoint_ids` | string[] | Chokepoint ids disrupted by this scenario. |
| `top_impact_countries` | ScenarioImpactCountry[] | Top 20 countries by aggregated impact, sorted desc by total_impact. |
| `template` | ScenarioResultTemplate | Effective run parameters. disruption_pct is the caller override when supplied, otherwise the registry default; the remaining fields come from the registry. |
| `scenario_id` | string | Selected catalog template identifier. |
| `scoped_iso2` | string | Empty means all countries in the manifest. |
| `coverage` | ScenarioCoverage | Bounded country/sector evidence and gaps used for this run. |
| `computed_at` | string | Computation time, not source observation time. |

#### `worldmonitor.scenario.v1.ScenarioResultTemplate` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Worker-derived template key, not a display name. Physical scenarios join affected_chokepoint_ids with `+`; tariff-type scenarios may use `tariff_shock` when no physical chokepoint is affected. |
| `disruption_pct` | int32 | 0-100 percent of chokepoint capacity blocked. The EFFECTIVE severity: the caller's RunScenarioRequest.disruption_pct when supplied, else the registry default. |
| `duration_days` | int32 | Descriptive duration in days; not an input to the impact calculation. |
| `cost_shock_multiplier` | double | Freight cost multiplier applied on top of bypass corridor costs. |

#### `worldmonitor.scenario.v1.ScenarioTemplate` — 7 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | ScenarioTemplate mirrors the catalog shape served by GET /api/scenario/v1/list-scenario-templates. The authoritative template registry lives in server/worldmonitor/supply-chain/v1/scenario-templates.ts. |
| `name` | string | ScenarioTemplate mirrors the catalog shape served by GET /api/scenario/v1/list-scenario-templates. The authoritative template registry lives in server/worldmonitor/supply-chain/v1/scenario-templates.ts. |
| `affected_chokepoint_ids` | string[] | Chokepoint ids this scenario disrupts. Empty for tariff-shock scenarios that have no physical chokepoint closure. |
| `disruption_pct` | int32 | 0-100 percent of chokepoint capacity blocked. |
| `duration_days` | int32 | Estimated duration of disruption in days. |
| `affected_hs2` | string[] | HS2 chapter codes affected. Empty means ALL sectors are affected. |
| `cost_shock_multiplier` | double | Freight cost multiplier applied on top of bypass corridor costs. |

---

### 3.35 `scorecard` — 0 个面板消费

- proto 文件：5 个（`get_bloc_scorecard.proto`, `get_five_factor_scorecard.proto`, `list_five_factor_scorecards.proto`, `scorecard.proto`, `service.proto`）
- message：15 个（业务数据 9，包装 6）；enum：0 个

#### `worldmonitor.scorecard.v1.ExcludedBlocMember` — 0 字段

（oneof / map 等结构，见 proto 原文）

#### `worldmonitor.scorecard.v1.FiveFactorBlocScorecard` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |
| `label` | string | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |
| `computed_at` | string | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |
| `excluded_members` | ExcludedBlocMember[] | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |
| `pillars` | FiveFactorPillar[] | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |

#### `worldmonitor.scorecard.v1.FiveFactorCountryScorecard` — 2 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `computed_at` | string | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |
| `pillars` | FiveFactorPillar[] | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |

#### `worldmonitor.scorecard.v1.FiveFactorCountryScorecardSummary` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `pillars` | FiveFactorPillarSummary[] | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |

#### `worldmonitor.scorecard.v1.FiveFactorPillar` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `has_score` | bool | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |
| `inputs` | ScorecardEvidence[] | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |
| `excluded_members` | ExcludedBlocMember[] | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |
| `member_weights` | ScorecardMemberWeight[] | Exact member populations available to the bloc aggregation. |

#### `worldmonitor.scorecard.v1.FiveFactorPillarSummary` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `has_score` | bool | Read before score and sub_score. When false, both numeric zeros are protobuf placeholders for insufficient data. |

#### `worldmonitor.scorecard.v1.ScorecardEvidence` — 8 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `input_id` | string |  |
| `available` | bool |  |
| `value` | double |  |
| `has_value` | bool |  |
| `unit` | string |  |
| `source` | string |  |
| `source_key` | string |  |
| `observations` | ScorecardObservation[] |  |

#### `worldmonitor.scorecard.v1.ScorecardMemberWeight` — 1 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `has_population` | bool | Read before population_millions; false means the numeric zero is a placeholder. |

#### `worldmonitor.scorecard.v1.ScorecardObservation` — 5 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string |  |
| `value` | double |  |
| `unit` | string |  |
| `source` | string |  |
| `indicator_code` | string |  |

---

### 3.36 `seismology` — 0 个面板消费

- proto 文件：3 个（`earthquake.proto`, `list_earthquakes.proto`, `service.proto`）
- message：3 个（业务数据 1，包装 2）；enum：0 个

#### `worldmonitor.seismology.v1.Earthquake` — 11 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `place` | string | Human-readable place description (e.g., "10 km SW of Anchorage, Alaska"). |
| `magnitude` | double | Earthquake magnitude on the Richter scale. |
| `depth_km` | double | Depth in kilometers below the surface. |
| `location` | worldmonitor.core.v1.GeoCoordinates | Geographic location of the epicenter. |
| `source_url` | string | URL to the USGS or Earthquakes Canada event detail page. |
| `near_test_site` | bool | True when epicenter is within 100 km of a known nuclear test site. |
| `test_site_name` | string | Name of the nearest test site (e.g. "Punggye-ri"), when near_test_site is true. |
| `concern_score` | double | Composite concern score 0–100 based on magnitude, depth, and proximity. |
| `concern_level` | string | Human-readable concern level: "low" / "moderate" / "elevated" / "critical". |
| `source` | string | Reporting agency: "usgs" (USGS) or "nrcan" (Earthquakes Canada / NRCan). |
| `category` | string | NRCan event category when present (e.g. "known earthquake", "suspected industry-related"). Empty for USGS. |

---

### 3.37 `shipping` — 0 个面板消费

- proto 文件：4 个（`list_webhooks.proto`, `register_webhook.proto`, `route_intelligence.proto`, `service.proto`）
- message：9 个（业务数据 3，包装 6）；enum：0 个

#### `worldmonitor.shipping.v1.BypassOption` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Single bypass-corridor option around a disrupted chokepoint. |
| `name` | string | Single bypass-corridor option around a disrupted chokepoint. |
| `type` | string | Type of bypass (e.g., "maritime_detour", "land_corridor"). |
| `added_transit_days` | int32 | Type of bypass (e.g., "maritime_detour", "land_corridor"). |
| `added_cost_multiplier` | double | Type of bypass (e.g., "maritime_detour", "land_corridor"). |
| `activation_threshold` | string | Enum-like string, e.g., "DISRUPTION_SCORE_60". |

#### `worldmonitor.shipping.v1.ChokepointExposure` — 3 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `chokepoint_id` | string | Single chokepoint exposure for a route. |
| `chokepoint_name` | string | Single chokepoint exposure for a route. |
| `exposure_pct` | int32 | Single chokepoint exposure for a route. |

#### `worldmonitor.shipping.v1.WebhookSummary` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `subscriber_id` | string | Single webhook record in the list response. `secret` is intentionally omitted; use rotate-secret to obtain a new one. |
| `callback_url` | string | Single webhook record in the list response. `secret` is intentionally omitted; use rotate-secret to obtain a new one. |
| `chokepoint_ids` | string[] | Single webhook record in the list response. `secret` is intentionally omitted; use rotate-secret to obtain a new one. |
| `alert_threshold` | int32 | Single webhook record in the list response. `secret` is intentionally omitted; use rotate-secret to obtain a new one. |
| `created_at` | string | ISO-8601 timestamp of registration. |
| `active` | bool | ISO-8601 timestamp of registration. |

---

### 3.38 `webcam` — 0 个面板消费

- proto 文件：3 个（`get_webcam_image.proto`, `list_webcams.proto`, `service.proto`）
- message：6 个（业务数据 2，包装 4）；enum：0 个

#### `worldmonitor.webcam.v1.WebcamCluster` — 4 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `lat` | double | Northern latitude bound of the map viewport. |
| `lng` | double | Northern latitude bound of the map viewport. |
| `count` | int32 | Northern latitude bound of the map viewport. |
| `categories` | string[] | Northern latitude bound of the map viewport. |

#### `worldmonitor.webcam.v1.WebcamEntry` — 6 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `webcam_id` | string | Northern latitude bound of the map viewport. |
| `title` | string | Northern latitude bound of the map viewport. |
| `lat` | double | Northern latitude bound of the map viewport. |
| `lng` | double | Northern latitude bound of the map viewport. |
| `category` | string | Northern latitude bound of the map viewport. |
| `country` | string | Northern latitude bound of the map viewport. |

---

### 3.39 `wildfire` — 0 个面板消费

- proto 文件：3 个（`fire_detection.proto`, `list_fire_detections.proto`, `service.proto`）
- message：3 个（业务数据 1，包装 2）；enum：1 个

#### `worldmonitor.wildfire.v1.FireDetection` — 14 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `location` | worldmonitor.core.v1.GeoCoordinates | Geographic location of the fire detection. |
| `brightness` | double | Brightness temperature in Kelvin. |
| `frp` | double | Fire radiative power in MW. |
| `confidence` | FireConfidence | Detection confidence level. |
| `satellite` | string | Satellite that detected the fire (e.g., "MODIS", "VIIRS", "LANDSAT"). |
| `region` | string | Monitored region name (e.g., "Ukraine", "Russia", "Iran"). |
| `day_night` | string | Day or night detection ("D" or "N"). |
| `possible_explosion` | bool | Whether the thermal signature suggests a possible explosion rather than a fire (FRP > 80 MW and brightness > 380 K). |
| `source` | string | Producer of the row: "firms" for satellite detections, "cwfis" / "bcws" for agency-reported fires. Absent means FIRMS, for rows written before this field. |
| `kind` | string | Agency fire classification, e.g. "wildfire", "prescribed", "outOfControl". Empty for satellite detections, which classify nothing. |
| `emergency` | bool | Whether the row should page. Prescribed burns are reported fires but are NOT emergencies, and must not be treated as such by a consumer. |
| `agency_fire_id` | string | Agency's own identifier for the fire, stable across ticks. Empty for FIRMS. |
| `agency_code` | string | Reporting agency code (e.g. "BC", "AB", "ON"). Empty for FIRMS. |
| `fire_size` | double | Reported fire size in HECTARES. 0 when unknown or not applicable — FIRMS detections report radiative power, not area. Named to match the key the seeder actually emits: a proto field the payload never populates is worse than no field, because consumers see it in the schema and get nothing. |

##### `wildfire` 域枚举

| enum | 取值 |
|---|---|
| `FireConfidence` | `FIRE_CONFIDENCE_UNSPECIFIED`, `FIRE_CONFIDENCE_LOW`, `FIRE_CONFIDENCE_NOMINAL`, `FIRE_CONFIDENCE_HIGH` |

---

## 4. 横切说明

### 4.1 core 公共类型
跨域复用的公共结构（`core` 域）：`BoundingBox`, `CountryCode`, `GeneralError`, `GeoBlocked`, `GeoCoordinates`, `LocalizableString`, `MaintenanceMode`, `PaginationRequest`, `PaginationResponse`, `RateLimited`, `TimeRange`, `UpstreamDown`。任何域的 `location` 字段统一为 `worldmonitor.core.v1.GeoCoordinates`，错误语义统一用 `GeoBlocked / RateLimited / UpstreamDown / MaintenanceMode`。

### 4.2 未走 proto 契约的数据面
| 数据通道 | 涉及面板数 | 说明 |
|---|---|---|
| `ask` | 4 | 'Ask' 对话式 AI 问答通道 |
| `chat_analyst` | 3 | 对话式 AI 市场分析师通道 |
| `rss_proxy` | 2 | api/rss-proxy.js 直通上游 RSS（新闻/直播/播客类面板） |
| `a2a` | 2 | A2A（agent-to-agent）协议通道 |
| `correlation_runtime_mode` | 1 | 交叉关联面板运行时模式开关（前端状态） |
| `user_prefs` | 1 | 用户偏好/自选配置（持久化设置） |
| `latest_brief` | 1 | AI 生成的最新简报缓存 |
| `security` | 1 | 安全/威胁面通道 |
| `oref_alerts` | 1 | ORef 警报数据通道 |
| `telegram_feed` | 1 | Telegram 情报频道订阅直通 |
| `github` | 1 | GitHub Trending / 仓库数据直通 |

### 4.3 阅读建议
- 查某面板吃什么数据：第 2 节按面板 ID 定位 → 第 3 节对应域字段表。
- 查某 proto 消息被哪些面板消费：搜索消息名。
- 字段类型中带 `worldmonitor.*` 前缀的均为嵌套 proto 消息，可在对应域小节展开。

### 4.4 姊妹文档
| 文档 | 内容 |
|---|---|
| `wm-full-architecture-report.md` | 完整架构报告（121KB，含面板目录/管道×3/环境变量五部分合并版） |
| `wm-panels-analysis.md` | 164 面板目录（ID/名称/变体/Premium/API 端点） |
| `wm-pipelines-1/2/3.md` | 9+4+8 业务域数据管道详解 |
| `wm-env-variables.md` | 122 个环境变量精读 + 409 处引用 |
