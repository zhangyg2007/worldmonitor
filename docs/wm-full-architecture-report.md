# WorldMonitor — 完整架构梳理报告
# 组件面板 · 数据源管道 · 环境变量

> 生成时间: 2026-09-17 (UTC)
> 数据来源: /root/projects/worldmonitor 代码仓库实测（src/config/panels.ts、scripts/seed-*.mjs、api/、server/、.env.example、docker-compose.yml），非文档照抄。
> 本文件由 5 份分域分析汇总而成：
>   1) 面板目录 wm-panels-analysis.md（580 行）
>   2) 管道① 经济/能源/贸易/气候 wm-pipelines-1.md
>   3) 管道② 军事/冲突/情报/网络 wm-pipelines-2.md
>   4) 管道③ 航空/海事/天气/安全/预测/韧性/野火/摄像头 wm-pipelines-3.md
>   5) 环境变量清单 wm-env-variables.md（122 个变量精读 + 409 个引用）

════════════════════════════════════════
## 执行摘要
════════════════════════════════════════

面板总数: 164 个唯一 panel ID，分布在 6 个变体站点
- worldmonitor.app (full): 109 | tech: 41 | finance: 68 | commodity: 36 | energy: 28 | happy: 10
- Premium locked 面板: stock-analysis, stock-backtest, daily-market-brief, chat-analyst,
  forecast, latest-brief, global-procurement, trade-policy 等；enhanced: cii, strategic-risk, gdelt-intel, supply-chain

数据架构（三层）:
  外部数据源 → seeder 脚本（Railway cron 定时，写 Redis/Upstash，docker 用内置 redis-rest）
  → api/<domain>/v1/[rpc].ts (Next.js edge JSON-RPC 网关) → 前端 panels 读取
  
- 每个 seeder 写 3 类 key: 数据 key、seed-meta:<key>（新鲜度）、seed-activated:<key>（激活标记）
- seeder 是唯一调用外部 API 的角色；API 层只读 Redis 缓存（getCachedJson）
- 降级策略普遍: stale key（24h）+ 上次好值保留（preserveLastGood）+ last-good fallback

外部数据源规模（实测）:
- 经济域 21 个 API（Alpha Vantage/Finnhub/Yahoo/CoinGecko/EIA/IEA/ENTSO-E/USDA/FAO/CFTC/Open-Meteo/NOAA/NSIDC/NASA/ReliefWeb 等）
- 军事/冲突/网络域 14 个 API（ADSB.lol/planes.live/ADSB.fi/OpenSky/R2 静态库/ACLED/HAPI/GDELT/UCDP/FeodoTracker/URLhaus/C2Intel/OTX/AbuseIPDB）
- 航空/海事/天气/安全/韧性等域 20+ 个源（AviationStack/FAA/ICAO/ArcGIS PortWatch/NGA/USGS/EONET/GDACS/NHS/IMD/FIRMS/BC 省/AB 省/SK 省/TTC/Open511/Kalshi/Polymarket/WGI/GPI/WHO/World Bank/IMF/Eurostat/Windy 等）
- 需要 API key 的源约 25 个，其余免费公开

环境变量:
- 精读入库 122 个（.env.example + 代码 grep 交叉验证）
- 实际 process.env 引用去重 409 个（含 INTERNAL/CI/Railway 注入）
- 硬性必需（docker-compose 启动期）: REDIS_PASSWORD, REDIS_TOKEN, WM_SESSION_SECRET, RELAY_SHARED_SECRET
- 功能开关型（不设则功能静默降级）: 见各域清单

════════════════════════════════════════


---
---

## 一、组件面板目录（164 个唯一面板）

# WorldMonitor — Panel Catalog & Domain Analysis
Source: `/root/projects/worldmonitor/src/config/panels.ts` (1,661 lines).
Panel type `PanelConfig` defined at `src/types/index.ts:644`:
```ts
export interface PanelConfig {
  name: string;
  enabled: boolean;
  priority?: number;
  premium?: 'locked' | 'enhanced';
  fontScale?: 0.9 | 1 | 1.1 | 1.25 | 1.5 | 2;
  proGated?: boolean;
}
```
- Full variant (worldmonitor.app/dashboard): **109** panels
- Tech variant (tech.worldmonitor.app): **41** panels
- Finance variant (finance.worldmonitor.app): **68** panels
- Commodity variant (commodity.worldmonitor.app): **36** panels
- Energy variant (energy.worldmonitor.app): **28** panels
- Happy variant (happy.worldmonitor.app): **10** panels
- **Total unique panel IDs (union, ALL_PANELS = full+tech+finance+commodity+energy+happy): 164**
---
## Consolidated panel catalog (deduplicated by panel ID)

| # | Panel ID | Display Name | Variants | Premium | Domain | Data fields displayed | Source data service (src/services/*.ts) | API endpoint (api/*) |
|---|----------|--------------|----------|---------|---------|-----------------------|-----------------------------------------|----------------------|
| 1 | `map` | Global Map | F+T+F+C+E+H | — | global map | map layers | multiple services | multiple api/ |
| 2 | `live-news` | Live News | F+T+F+C+E | — | news / video | live TV channels, breaking video headlines | src/components/LiveNewsPanel + src/config/feeds.ts (CANONICAL_FEEDS) | api/rss-proxy.js, api/news/ |
| 3 | `live-webcams` | Live Webcams | F+T+F | — | webcams | live webcam feeds by region | src/components/LiveWebcamsPanel | api/imagery/, api/maritime/v1/ |
| 4 | `windy-webcams` | Windy Live Webcam | F+T+F | — | webcams | pinned windy webcams | src/components/PinnedWebcamsPanel | api/imagery/ |
| 5 | `insights` | AI Insights | F+T+F+C+E | — | AI insights | AI-generated cross-panel narrative summaries | src/components/InsightsPanel | api/chat-analyst.ts, api/ask.ts, api/a2a.ts |
| 6 | `threat-timeline` | Threat Timeline | F | — | intelligence | chronological threat escalation events | src/components/ThreatTimelinePanel | api/intelligence/v1/[rpc].ts |
| 7 | `strategic-posture` | AI Strategic Posture | F | — | intelligence | AI military/strategic posture from live news | src/components/StrategicPosturePanel, src/services/correlation.ts | api/intelligence/v1/[rpc].ts |
| 8 | `forecast` | AI Forecasts | F | locked | AI forecasting | geopolitical cascade forecasts | src/components/ForecastPanel, src/services/forecast.ts | api/forecast/[rpc].ts |
| 9 | `cii` | Country Instability | F | enhanced | country instability | CI country scores 0-100, deltas, country briefs | src/components/CIIPanel, src/services/country-instability.ts | api/intelligence/v1/[rpc].ts |
| 10 | `strategic-risk` | Strategic Risk Overview | F | enhanced | intelligence | risk score + top strategic risk locations | src/components/StrategicRiskPanel, src/services/correlation.ts | api/intelligence/v1/[rpc].ts |
| 11 | `intel` | Intel Feed | F | — | intelligence feeds | intel feed items from curated sources | src/components/NewsPanel (category=intel) | api/intelligence/v1/[rpc].ts |
| 12 | `gdelt-intel` | Live Intelligence | F | enhanced | GDELT intelligence | live GDELT document events, tone, locations | src/components/GdeltIntelPanel, src/services/gdelt-intel.ts | api/prediction/[rpc].ts, api/intelligence/v1/[rpc].ts |
| 13 | `cascade` | Infrastructure Cascade | F | — | infrastructure cascade | energy/grid/water cascade events | src/components/CascadePanel, src/services/correlation.ts | api/intelligence/v1/[rpc].ts |
| 14 | `military-correlation` | Force Posture | F | — | correlation engine | military events + news cross-correlation | src/components/MilitaryCorrelationPanel, src/services/correlation-engine/ | api/correlation-runtime-mode.js, api/military/v1/[rpc].ts |
| 15 | `escalation-correlation` | Escalation Monitor | F | — | correlation engine | escalation cross-correlation | src/components/EscalationCorrelationPanel, src/services/correlation-engine/ | api/military/v1/[rpc].ts |
| 16 | `economic-correlation` | Economic Warfare | F | — | correlation engine | economic cross-correlation | src/components/EconomicCorrelationPanel, src/services/correlation-engine/ | api/economic/v1/[rpc].ts |
| 17 | `disaster-correlation` | Disaster Cascade | F | — | correlation engine | natural disaster cross-correlation | src/components/DisasterCorrelationPanel | api/natural/v1/[rpc].ts |
| 18 | `politics` | World News | F | — | news / politics | politics & world news headlines | src/components/NewsPanel (category=politics) | api/news/, api/rss-proxy.js |
| 19 | `us` | United States | F | — | news / US region | US news headlines | src/components/NewsPanel (category=us) | api/news/ |
| 20 | `europe` | Europe | F | — | news / Europe | Europe news headlines | src/components/NewsPanel (category=europe) | api/news/ |
| 21 | `middleeast` | Middle East | F | — | news / Middle East | Middle East news headlines | src/components/NewsPanel (category=middleeast) | api/news/ |
| 22 | `africa` | Africa | F | — | news / Africa | Africa news headlines | src/components/NewsPanel (category=africa) | api/news/ |
| 23 | `latam` | Latin America | F | — | news / LatAm | Latin America news headlines | src/components/NewsPanel (category=latam) | api/news/ |
| 24 | `asia` | Asia-Pacific | F | — | news / Asia | Asia-Pacific news headlines | src/components/NewsPanel (category=asia) | api/news/ |
| 25 | `energy` | Energy & Resources | F+C+E | — | news / energy | energy & resources news | src/components/NewsPanel (category=energy) | api/news/ |
| 26 | `gov` | Government | F | — | news / gov | government news | src/components/NewsPanel (category=gov) | api/news/ |
| 27 | `thinktanks` | Think Tanks | F | — | news / think tanks | think tank articles | src/components/NewsPanel (category=thinktanks) | api/news/ |
| 28 | `polymarket` | Predictions | F+T+F+C | — | prediction markets | Polymarket open markets, shares prices, volumes | src/components/PredictionPanel, src/services (polymarket) | api/prediction/[rpc].ts |
| 29 | `commodities` | Metals & Materials | F+F+C+E | — | markets / commodities | metal & material prices: copper, gold, silver, lithium, iron ore, etc. | src/components/MarketPanel, src/services/economic/index.ts | api/market/v1/[rpc].ts |
| 30 | `energy-complex` | Energy Complex | F+F+C+E | — | markets / energy | WTI, Brent, gas, coal, fuel prices | src/components/EnergyComplexPanel | api/market/v1/[rpc].ts, api/supply-chain/hormuz-tracker.js |
| 31 | `oil-inventories` | Oil Inventories | F+C+E | — | energy inventories | EIA / OPEC / API US crude & petroleum inventories | src/components/OilInventoriesPanel | api/market/v1/[rpc].ts |
| 32 | `markets` | Markets | F+T+F+C | — | markets / indices & FX | world indices, equities, FX, bond yields | src/components/MarketPanel, src/services/economic/index.ts | api/market/v1/[rpc].ts |
| 33 | `stock-analysis` | Stock Analysis | F+F | locked | markets / equities (pro) | AI stock analysis, fundamentals, sentiment | src/components/StockAnalysisPanel | api/market/v1/[rpc].ts + WORLDMONITOR_API_KEY |
| 34 | `stock-backtest` | Backtesting | F+F | locked | markets / backtesting (pro) | backtesting results for stock strategy | src/components/StockBacktestPanel | api/market/v1/[rpc].ts + WORLDMONITOR_API_KEY |
| 35 | `daily-market-brief` | Daily Market Brief | F+F | locked | markets / brief (pro) | AI-curated daily market brief | src/components/DailyMarketBriefPanel, src/services/daily-market-brief.ts | api/market/v1/[rpc].ts + WORLDMONITOR_API_KEY |
| 36 | `chat-analyst` | WM Analyst | F | locked | AI analyst (pro) | conversational AI market analyst | src/components/ChatAnalystPanel | api/chat-analyst.ts, api/ask.ts, api/a2a.ts |
| 37 | `economic` | Macro Stress | F+T+F+C | — | macro stress | macro stress scores & indicators | src/components/EconomicPanel, src/services/economic/index.ts | api/economic/v1/[rpc].ts, api/market/v1/[rpc].ts |
| 38 | `global-procurement` | Global Procurement | F+T+F | locked | global procurement (pro) | cross-border government procurement signals | src/components/GlobalProcurementPanel | api/market/v1/[rpc].ts + WORLDMONITOR_API_KEY |
| 39 | `trade-policy` | Trade Policy | F+F+C | locked | trade policy (pro) | tariff / trade-policy actions | src/components/TradePolicyPanel | api/trade/[rpc].ts + WORLDMONITOR_API_KEY |
| 40 | `supply-chain` | Supply Chain | F+F+C+E | enhanced | supply chain | supply-chain chokepoints & routes | src/components/SupplyChainPanel, src/services/supply-chain/ | api/supply-chain/hormuz-tracker.js, api/supply-chain/v1/[rpc].ts |
| 41 | `china-corridors` | China Logistics Corridors | F+F+C+E | — | china logistics | China logistics corridors status | src/components/ChinaCorridorPanel, src/services/china-activity-nowcast.ts | api/market/v1/[rpc].ts |
| 42 | `china-activity-nowcast` | China Activity Nowcast | F+F+C+E | — | china nowcast | real-time China activity nowcast | src/components/ChinaActivityNowcastPanel, src/services/china-activity-nowcast.ts | api/market/v1/[rpc].ts |
| 43 | `finance` | Financial | F+T | — | news / finance | finance news headlines | src/components/NewsPanel (category=finance) | api/news/ |
| 44 | `tech` | Technology | F+T | — | news / tech | tech news headlines | src/components/NewsPanel (category=tech) | api/news/ |
| 45 | `crypto` | Crypto | F+T+F | — | markets / crypto | crypto prices: BTC, ETH, top altcoins | src/components/MarketPanel (crypto mode) | api/market/v1/[rpc].ts |
| 46 | `heatmap` | Sector Heatmap | F+F+C | — | markets / heatmap | sector performance heatmap | src/components/MarketPanel (heatmap mode) | api/market/v1/[rpc].ts |
| 47 | `ai` | AI/ML | F+T | — | news / AI | AI/ML news headlines | src/components/NewsPanel (category=ai) | api/news/ |
| 48 | `layoffs` | Layoffs Tracker | F+T | — | news / layoffs | layoff announcements | src/components/NewsPanel (category=layoffs) | api/news/ |
| 49 | `monitors` | My Monitors | F+T+F+C+E | — | user monitors | user-defined keyword/location monitors | src/components/MonitorPanel | api/user-prefs.ts, local storage |
| 50 | `latest-brief` | Latest Brief | F+T+F+C+E | locked | AI brief (pro) | AI-generated latest geopolitical brief | src/components/LatestBriefPanel | api/latest-brief.ts |
| 51 | `satellite-fires` | Fires | F | — | satellite / fires | active fires from NASA FIRMS / VIIRS | src/components/SatelliteFiresPanel | api/natural/v1/[rpc].ts |
| 52 | `macro-signals` | Market Regime | F+T+F+C+E | — | macro signals | market regime & macro indicators | src/components/MacroSignalsPanel | api/economic/v1/[rpc].ts, api/market/v1/[rpc].ts |
| 53 | `fear-greed` | Fear & Greed | F+F | — | market sentiment | CNBC / AAII fear & greed index | src/components/FearGreedPanel | api/market/v1/[rpc].ts |
| 54 | `aaii-sentiment` | AAII Sentiment | F+F | — | market sentiment | AAII investor sentiment survey | src/components/AAIISentimentPanel | api/market/v1/[rpc].ts |
| 55 | `market-breadth` | Market Breadth | F+F | — | market breadth | advancers/decliners, breadth indicators | src/components/MarketBreadthPanel | api/market/v1/[rpc].ts |
| 56 | `news-market-correlation` | News ↔ Markets | F+F+C | — | news ↔ markets | correlation of news sentiment vs. price moves | src/components/NewsMarketCorrelationPanel | api/intelligence/v1/[rpc].ts, api/market/v1/[rpc].ts |
| 57 | `macro-tiles` | Macro Indicators | F+F | — | macro indicators | tile grid of macro indicators (CPI, yields, etc.) | src/components/MacroTilesPanel | api/economic/v1/[rpc].ts |
| 58 | `fsi` | Financial Stress | F+F | — | financial stress | ICE BofA Global Financial Stress Index | src/components/FSIPanel | api/economic/v1/[rpc].ts |
| 59 | `yield-curve` | Yield Curve | F+F | — | fixed income | US Treasury yield curve across tenors | src/components/YieldCurvePanel | api/market/v1/[rpc].ts, api/economic/v1/[rpc].ts |
| 60 | `earnings-calendar` | Earnings Calendar | F+F | — | equities | upcoming earnings by company | src/components/EarningsCalendarPanel | api/market/v1/[rpc].ts |
| 61 | `economic-calendar` | Economic Calendar | F+F | — | macro | scheduled macro economic data releases | src/components/EconomicCalendarPanel | api/economic/v1/[rpc].ts |
| 62 | `cot-positioning` | COT Positioning | F+F | — | positioning | CFTC COT positioning: managed money, commercials | src/components/CotPositioningPanel | api/market/v1/[rpc].ts |
| 63 | `liquidity-shifts` | Liquidity Shifts | F+F+C | — | liquidity | Fed balance sheet & liquidity shifts | src/components/LiquidityShiftsPanel | api/economic/v1/[rpc].ts, api/market/v1/[rpc].ts |
| 64 | `positioning-247` | 24/7 Positioning | F+F+C | — | positioning | 24/7 global positioning (futures, CFTC, etc.) | src/components/PositioningPanel | api/market/v1/[rpc].ts |
| 65 | `gold-intelligence` | Gold Intelligence | F+F+C | — | commodities / gold | gold price, flows, ETFs, safe-haven signals | src/components/GoldIntelligencePanel | api/market/v1/[rpc].ts |
| 66 | `hormuz-tracker` | Hormuz Trade Tracker | F+E | — | energy / chokepoints | Strait of Hormuz tanker & cargo traffic | src/components/HormuzPanel, src/config/chokepoint-registry.ts | api/supply-chain/hormuz-tracker.js |
| 67 | `energy-crisis` | Energy Crisis Tracker | F+E | — | energy / policy | energy-crisis policy tracker | src/components/EnergyCrisisPanel | api/supply-chain/hormuz-tracker.js, api/economic/v1/[rpc].ts |
| 68 | `pipeline-status` | Oil & Gas Pipeline Status | F+F+C+E | — | energy / pipelines | oil & gas pipeline status, capacity, outages | src/components/PipelineStatusPanel, src/config/pipelines.ts | api/supply-chain/hormuz-tracker.js |
| 69 | `storage-facility-map` | Strategic Storage Atlas | F+E | — | energy / storage | strategic storage facilities: SPR, UGS, crude, LNG | src/components/StorageFacilityMapPanel | api/safety/v1/[rpc].ts, api/supply-chain/v1/[rpc].ts |
| 70 | `fuel-shortages` | Global Fuel Shortage Registry | F+E | — | energy / fuel shortage | global fuel-shortage alerts by region | src/components/FuelShortagePanel | api/safety/v1/[rpc].ts |
| 71 | `energy-disruptions` | Energy Disruptions Log | F+E | — | energy / disruptions | energy-disruption events: outages, attacks | src/components/EnergyDisruptionsPanel | api/supply-chain/v1/[rpc].ts, api/conflict/v1/[rpc].ts |
| 72 | `energy-risk-overview` | Global Energy Risk Overview | F+E | — | energy / risk | aggregate energy risk metrics & trends | src/components/EnergyRiskOverviewPanel | api/supply-chain/v1/[rpc].ts |
| 73 | `gulf-economies` | Gulf Economies | F+F+C+E | — | gulf / OPEC | Gulf state & OPEC macro indicators (GDP, oil revenue, fiscal) | src/components/GulfEconomiesPanel, src/config/gulf-fdi.ts | api/economic/v1/[rpc].ts, api/market/v1/[rpc].ts |
| 74 | `consumer-prices` | Consumer Prices | F+F+C | — | consumer prices | national CPI, basket prices | src/components/ConsumerPricesPanel, src/services/consumer-prices/ | api/consumer-prices/[rpc].ts |
| 75 | `grocery-basket` | Grocery Index | F | — | consumer prices | grocery index / basket prices | src/components/GroceryBasketPanel | api/economic/v1/[rpc].ts |
| 76 | `bigmac` | Big Mac Index | F | — | PPP / currency | Big Mac Index (PPP) by country/city | src/components/BigMacPanel | api/economic/v1/[rpc].ts |
| 77 | `fx` | FX Rates | F+F | — | FX rates | FX rates by currency pair | src/components/FxPanel | api/market/v1/[rpc].ts |
| 78 | `fuel-prices` | Fuel Prices | F+E | — | fuel prices | retail fuel prices by country | src/components/FuelPricesPanel | api/economic/v1/[rpc].ts |
| 79 | `fao-food-price-index` | FAO Food Price Index | F | — | food prices | FAO Food Price Index | src/components/FaoFoodPriceIndexPanel | api/economic/v1/[rpc].ts |
| 80 | `etf-flows` | BTC ETF Tracker | F+T+F | — | crypto / flows | BTC / ETH ETF daily flow data | src/components/ETFFlowsPanel | api/market/v1/[rpc].ts |
| 81 | `stablecoins` | Stablecoins | F+T+F | — | crypto / stablecoins | stablecoin supply (USDT, USDC, DAI) | src/components/StablecoinPanel | api/market/v1/[rpc].ts |
| 82 | `ucdp-events` | UCDP Conflict Events | F | — | conflict / UCDP | UCDP conflict event grid | src/components/UcdpEventsPanel | api/conflict/v1/[rpc].ts |
| 83 | `disease-outbreaks` | Disease Outbreaks | F | — | health / disease | WHO / ProMED disease outbreaks | src/components/DiseaseOutbreaksPanel, src/services/disease-outbreaks.ts | api/safety/v1/[rpc].ts, api/safety/ |
| 84 | `social-velocity` | Social Velocity | F | — | sentiment | social media velocity (protest / unrest) | src/components/SocialVelocityPanel | api/unrest/v1/[rpc].ts |
| 85 | `wsb-ticker-scanner` | WSB Ticker Scanner | F+F | locked | markets / social (pro) | Wall Street Bets ticker scanner | src/components/WsbTickerScannerPanel | api/market/v1/[rpc].ts + WORLDMONITOR_API_KEY |
| 86 | `giving` | Global Giving | F+H | — | good news | Global Giving / charitable giving data | src/components/GivingPanel | api/giving/v1/[rpc].ts |
| 87 | `displacement` | UNHCR Displacement | F | — | UNHCR / humanitarian | UNHCR refugee displacement flows | src/components/DisplacementPanel, src/services/displacement/ | api/displacement/v1/[rpc].ts |
| 88 | `climate` | Climate Anomalies | F+E | — | climate | climate anomalies (HDD/CDD, temp) | src/components/ClimateAnomalyPanel, src/services/climate/ | api/climate/v1/[rpc].ts |
| 89 | `climate-news` | Climate News | F | — | news / climate | climate & environment news | src/components/ClimateNewsPanel | api/news/ |
| 90 | `population-exposure` | Population Exposure | F | — | climate / risk | population exposure to climate hazards | src/components/PopulationExposurePanel | api/climate/v1/[rpc].ts, api/safety/v1/[rpc].ts |
| 91 | `security-advisories` | Security Advisories | F | — | security travel | US State Dept. travel advisories | src/components/SecurityAdvisoriesPanel | api/security/report.js |
| 92 | `sanctions-pressure` | Sanctions Pressure | F+F+C+E | — | sanctions | country sanctions pressure index | src/components/SanctionsPressurePanel, src/services/sanctions-pressure | api/sanctions/v1/[rpc].ts |
| 93 | `defense-patents` | R&D Signal | F | — | defense / R&D | defense patent filing trends | src/components/DefensePatentsPanel | api/military/v1/[rpc].ts |
| 94 | `toronto-safety` | Toronto Safety | F | — | local safety | Toronto traffic/road safety (511 style) | src/components/TorontoSafetyPanel, src/services/canada-roads.ts | api/safety/v1/[rpc].ts |
| 95 | `radiation-watch` | Radiation Watch | F | — | radiation | radiation / nuclear threat watch | src/components/RadiationWatchPanel | api/radiation/v1/[rpc].ts |
| 96 | `thermal-escalation` | Thermal Escalation | F | — | geothermal / threat | thermal signature escalation | src/components/ThermalEscalationPanel | api/thermal/v1/[rpc].ts |
| 97 | `oref-sirens` | Israel Sirens | F | locked | civil defense | Israeli OEF sirens (live) | src/components/OrefSirensPanel | api/oref-alerts.js |
| 98 | `telegram-intel` | Telegram Intel | F | locked | intel / telegram (pro) | Telegram intel channel feed | src/components/TelegramIntelPanel | api/telegram-feed.js |
| 99 | `x-intel` | X News Accounts | F | locked | intel / X (pro) | X/Twitter news accounts feed | src/components/XIntelPanel | api/intelligence/v1/[rpc].ts + WORLDMONITOR_API_KEY |
| 100 | `airline-intel` | Airline Intelligence | F+T+F+C | — | aviation / airline | airline fleet / route intelligence | src/components/AirlineIntelPanel, src/services/aviation/ | api/aviation/v1/[rpc].ts |
| 101 | `tech-readiness` | Tech Readiness Index | F+T | — | tech infrastructure | tech readiness index by country | src/components/TechReadinessPanel, src/services/economic/index.ts | api/economic/v1/[rpc].ts |
| 102 | `world-clock` | World Clock | F+T+F+C+E | — | utility / time | world clock by major cities | src/components/WorldClockPanel | api/ (client-side, no API) |
| 103 | `national-debt` | Global Debt Clock | F | — | macro / debt | US & other sovereign debt clocks | src/components/NationalDebtPanel | api/economic/v1/[rpc].ts |
| 104 | `cross-source-signals` | Cross-Source Signals | F | — | cross-source | cross-source signal aggregation | src/components/CrossSourceSignalsPanel, src/services/cross-source-signals.ts | api/intelligence/v1/[rpc].ts |
| 105 | `market-implications` | AI Market Implications | F | locked | AI market impact (pro) | AI-derived market implications from news | src/components/MarketImplicationsPanel | api/chat-analyst.ts + WORLDMONITOR_API_KEY |
| 106 | `regional-intelligence` | Regional Intelligence | F | locked | regional intel (pro) | regional intelligence board | src/components/RegionalIntelligenceBoard | api/intelligence/v1/[rpc].ts + WORLDMONITOR_API_KEY |
| 107 | `deduction` | Deduct Situation | F | locked | AI deduction (pro) | deductive situation analysis from news | src/components/DeductionPanel | api/ask.ts, api/intelligence/v1/[rpc].ts + WORLDMONITOR_API_KEY |
| 108 | `geo-hubs` | Geopolitical Hubs | F | — | geopolitical hubs | geopolitical event hub activity | src/components/GeoHubsPanel, src/services/entity-index.ts | api/intelligence/v1/[rpc].ts |
| 109 | `tech-hubs` | Hot Tech Hubs | F+T | — | tech hubs | hot tech hub activity | src/components/TechHubsPanel | api/intelligence/v1/[rpc].ts |
| 110 | `startups` | Startups & VC | T | — | news / startups | startup & VC fundraising news | src/components/NewsPanel (category=startups) | api/news/ |
| 111 | `vcblogs` | VC Insights & Essays | T | — | news / VCs | VC blog & essay feed | src/components/NewsPanel (category=vcblogs) | api/news/ |
| 112 | `regionalStartups` | Global Startup News | T | — | news / startups | regional startup news | src/components/NewsPanel (category=regionalStartups) | api/news/ |
| 113 | `unicorns` | Unicorn Tracker | T | — | startups / unicorns | unicorn startup valuations | src/components/NewsPanel (category=unicorns) | api/news/, api/research/ |
| 114 | `accelerators` | Accelerators & Demo Days | T | — | startups / accelerators | accelerators & demo days | src/components/NewsPanel (category=accelerators) | api/news/ |
| 115 | `security` | Cybersecurity | T | — | news / cyber | cybersecurity news | src/components/NewsPanel (category=security) | api/cyber/v1/[rpc].ts, api/news/ |
| 116 | `policy` | AI Policy & Regulation | T | — | news / policy | AI policy & regulation news | src/components/NewsPanel (category=policy) | api/news/ |
| 117 | `hardware` | Semiconductors & Hardware | T | — | news / hardware | semiconductors & hardware news | src/components/NewsPanel (category=hardware) | api/news/ |
| 118 | `cloud` | Cloud & Infrastructure | T | — | news / cloud | cloud & infrastructure news | src/components/NewsPanel (category=cloud) | api/news/ |
| 119 | `dev` | Developer Community | T | — | news / dev | developer community news | src/components/NewsPanel (category=dev) | api/news/ |
| 120 | `github` | GitHub Trending | T | — | news / github | GitHub trending repos | src/components/NewsPanel (category=github) | api/github/ or /api/research/v1 |
| 121 | `ipo` | IPO & SPAC | T+F | — | news / capital markets | IPO & SPAC announcements | src/components/NewsPanel (category=ipo) | api/news/ |
| 122 | `funding` | Funding & VC | T | — | VC / funding | funding round data | src/components/NewsPanel (category=funding) | api/news/, api/research/v1 |
| 123 | `producthunt` | Product Hunt | T | — | tech / products | Product Hunt launches | src/components/NewsPanel (category=producthunt) | api/news/ |
| 124 | `events` | Tech Events | T | — | tech events | tech event listings | src/components/TechEventsPanel | api/research/ |
| 125 | `internet-disruptions` | Internet Disruptions | T | — | infrastructure | internet / ISP disruption status | src/components/InternetDisruptionsPanel | api/safety/v1/[rpc].ts, api/cyber/v1/[rpc].ts |
| 126 | `service-status` | Service Status | T | — | service status | service status pages monitoring | src/components/ServiceStatusPanel | api/safety/v1/[rpc].ts |
| 127 | `ai-regulation` | AI Regulation Dashboard | T | — | AI / regulation | AI regulation dashboard | src/components/RegulationPanel (key=ai-regulation) | api/research/ |
| 128 | `markets-news` | Markets News | F | — | news / markets | markets news headlines | src/components/NewsPanel (category=markets-news) | api/news/ |
| 129 | `forex` | Forex & Currencies | F | — | news / forex | forex & currency news | src/components/NewsPanel (category=forex) | api/news/ |
| 130 | `bonds` | Fixed Income | F | — | fixed income | bond prices, yields, treasuries | src/components/MarketPanel (bonds mode) | api/market/v1/[rpc].ts |
| 131 | `commodities-news` | Commodities News | F | — | news / commodities | commodities news | src/components/NewsPanel (category=commodities-news) | api/news/ |
| 132 | `crypto-news` | Crypto News | F | — | news / crypto | crypto news | src/components/NewsPanel (category=crypto-news) | api/news/ |
| 133 | `crypto-heatmap` | Crypto Sectors | F | — | markets / crypto | crypto sector heatmap | src/components/MarketPanel (crypto-heatmap mode) | api/market/v1/[rpc].ts |
| 134 | `defi-tokens` | DeFi Tokens | F | — | markets / DeFi | DeFi token prices | src/components/MarketPanel (defi mode) | api/market/v1/[rpc].ts |
| 135 | `ai-tokens` | AI Tokens | F | — | markets / AI tokens | AI token prices | src/components/MarketPanel (ai-tokens mode) | api/market/v1/[rpc].ts |
| 136 | `other-tokens` | Alt Tokens | F | — | markets / alt | alt token prices | src/components/MarketPanel (other mode) | api/market/v1/[rpc].ts |
| 137 | `centralbanks` | Central Bank Watch | F | — | financial / central banks | central bank decisions & yields | src/components/MarketPanel (centralbanks mode) | api/market/v1/[rpc].ts, api/economic/v1/[rpc].ts |
| 138 | `economic-news` | Economic News | F | — | news / economic | economic news | src/components/NewsPanel (category=economic-news) | api/news/ |
| 139 | `derivatives` | Derivatives & Options | F | — | markets / derivatives | derivatives & options market data | src/components/MarketPanel (derivatives mode) | api/market/v1/[rpc].ts |
| 140 | `fintech` | Fintech & Trading Tech | F | — | news / fintech | fintech & trading tech news | src/components/NewsPanel (category=fintech) | api/news/ |
| 141 | `fin-regulation` | Financial Regulation | F | — | news / fin reg | financial regulation news | src/components/NewsPanel (category=fin-regulation) | api/news/ |
| 142 | `institutional` | Hedge Funds & PE | F | — | news / institutional | hedge fund & PE news | src/components/NewsPanel (category=institutional) | api/news/ |
| 143 | `analysis` | Market Analysis | F | — | markets / analysis | market analysis narratives | src/components/NewsPanel (category=analysis) | api/market/v1/[rpc].ts, api/ask.ts |
| 144 | `gcc-investments` | GCC Investments | F+C+E | — | gulf / FDI | GCC cross-border investments | src/components/InvestmentsPanel, src/config/gulf-fdi.ts | api/economic/v1/[rpc].ts |
| 145 | `gccNews` | GCC Business News | F | — | news / GCC | GCC business news | src/components/NewsPanel (category=gccNews) | api/news/ |
| 146 | `nq-pulse` | NQ Pulse | F | — | equities / NQ | NQ futures tape pulse | src/components/NqPulsePanel | api/market/v1/[rpc].ts |
| 147 | `nq-catalysts` | NQ Catalysts | F | — | equities / NQ | NQ catalysts / events | src/components/NqCatalystsPanel | api/market/v1/[rpc].ts |
| 148 | `nq-news` | NQ News | F | — | news / NQ | NQ futures news | src/components/NewsPanel (category=nq-news) | api/news/ |
| 149 | `commodity-news` | Commodity News | C | — | news / commodities | commodity news | src/components/NewsPanel (category=commodity-news) | api/news/ |
| 150 | `gold-silver` | Gold & Silver | C | — | commodities / precious | gold & silver prices, spreads | src/components/MarketPanel (gold-silver mode) | api/market/v1/[rpc].ts |
| 151 | `mining-news` | Mining News | C | — | news / mining | mining industry news | src/components/NewsPanel (category=mining-news) | api/news/ |
| 152 | `critical-minerals` | Critical Minerals | C | — | commodities / critical | critical minerals prices | src/components/MarketPanel (critical-minerals mode) | api/market/v1/[rpc].ts |
| 153 | `base-metals` | Base Metals | C | — | commodities / base metals | base metals prices (Cu, Zn, Al, etc.) | src/components/MarketPanel (base-metals mode) | api/market/v1/[rpc].ts |
| 154 | `mining-companies` | Mining Companies | C | — | commodities / equities | mining company prices | src/components/MarketPanel (mining-companies mode) | api/market/v1/[rpc].ts |
| 155 | `commodity-regulation` | Regulation & Policy | C | — | news / commodity reg | commodity regulation & policy | src/components/NewsPanel (category=commodity-regulation) | api/news/ |
| 156 | `chokepoint-strip` | Chokepoint Status | E | — | energy / chokepoints | strategic chokepoint status (Hormuz, Suez, Bab el-Mandeb, Bosporus, etc.) | src/components/ChokepointStripPanel, src/config/chokepoint-registry.ts | api/supply-chain/hormuz-tracker.js, api/maritime/v1/[rpc].ts |
| 157 | `renewable` | Renewable Energy | E+H | — | energy / renewables | renewable energy installations & progress | src/components/RenewableEnergyPanel | api/positive-events/v1/[rpc].ts |
| 158 | `positive-feed` | Good News Feed | H | — | good news | good news feed (filtered positive) | src/components/PositiveNewsFeedPanel | api/positive-events/v1/[rpc].ts |
| 159 | `progress` | Human Progress | H | — | human progress | SDG / human progress indices | src/components/ProgressChartsPanel | api/positive-events/v1/[rpc].ts |
| 160 | `counters` | Live Counters | H | — | live counters | live positive counters (species, trees, etc.) | src/components/CountersPanel, src/services/celebration.ts | api/positive-events/v1/[rpc].ts |
| 161 | `spotlight` | ? | H | — | today hero | Today's Hero (one good story) | src/components/HeroSpotlightPanel | api/positive-events/v1/[rpc].ts |
| 162 | `breakthroughs` | Breakthroughs | H | — | science breakthroughs | breakthroughs ticker | src/components/BreakthroughsTickerPanel | api/research/ |
| 163 | `digest` | 5 Good Things | H | — | good things digest | 5 Good Things (AI digest) | src/components/GoodThingsDigestPanel | api/positive-events/v1/[rpc].ts + WORLDMONITOR_API_KEY |
| 164 | `species` | Conservation Wins | H | — | conservation | species recovery wins | src/components/SpeciesComebackPanel, src/services/conservation-data.ts | api/positive-events/v1/[rpc].ts |

## Panel categories (settings UI grouping)
From `src/config/panels.ts` `PANEL_CATEGORY_MAP`:

| Category key | Header label | Variants | Panel keys |
|---|---|---|---|
| core | header.panelCatCore | all | `map, live-news, live-webcams, windy-webcams, insights, strategic-posture, latest-brief` |
| intelligence | header.panelCatIntelligence | 'full' | `cii, strategic-risk, threat-timeline, intel, gdelt-intel, cascade, telegram-intel, x-intel, forecast, cross-source-signals, regional-intelligence, deduction, chat-analyst, thermal-escalation, social-velocity, geo-hubs` |
| correlation | header.panelCatCorrelation | 'full' | `military-correlation, escalation-correlation, economic-correlation, disaster-correlation` |
| regionalNews | header.panelCatRegionalNews | 'full' | `politics, us, europe, middleeast, africa, latam, asia` |
| marketsFinance | header.panelCatMarketsFinance | 'full','energy' | `commodities, energy-complex, energy-risk-overview, pipeline-status, storage-facility-map, oil-inventories, fuel-prices, chokepoint-strip, fuel-shortages, energy-disruptions, hormuz-tracker, energy-crisis, markets, economic, global-procurement, trade-policy, sanctions-pressure, supply-chain, china-corridors, china-activity-nowcast, finance, polymarket, macro-signals, gulf-economies, etf-flows, stablecoins, crypto, heatmap, aaii-sentiment, cot-positioning, earnings-calendar, economic-calendar, fear-greed, fsi, macro-tiles, market-breadth, news-market-correlation, liquidity-shifts, national-debt, positioning-247, wsb-ticker-scanner, yield-curve, gold-intelligence, bigmac, fx, market-implications` |
| topical | header.panelCatTopical | 'full','energy' | `energy, gov, thinktanks, tech, ai, layoffs` |
| dataTracking | header.panelCatDataTracking | 'full','energy' | `monitors, satellite-fires, ucdp-events, displacement, climate, climate-news, population-exposure, security-advisories, toronto-safety, radiation-watch, oref-sirens, world-clock, tech-readiness, disease-outbreaks, fao-food-price-index, grocery-basket, defense-patents` |
| techAi | header.panelCatTechAi | 'tech' | `ai, tech, hardware, cloud, dev, github, producthunt, events, service-status, tech-readiness, internet-disruptions, tech-hubs` |
| startupsVc | header.panelCatStartupsVc | 'tech' | `startups, vcblogs, regionalStartups, unicorns, accelerators, funding, ipo` |
| securityPolicy | header.panelCatSecurityPolicy | 'tech' | `security, policy, ai-regulation` |
| techMarkets | header.panelCatMarkets | 'tech' | `markets, finance, crypto, economic, global-procurement, sanctions-pressure, polymarket, macro-signals, etf-flows, stablecoins, layoffs, monitors, world-clock` |
| finMarkets | header.panelCatMarkets | 'finance' | `markets, stock-analysis, stock-backtest, daily-market-brief, markets-news, heatmap, macro-signals, analysis, polymarket, nq-pulse, nq-catalysts, nq-news` |
| fixedIncomeFx | header.panelCatFixedIncomeFx | 'finance' | `forex, fx, bonds` |
| finCommodities | header.panelCatCommodities | 'finance' | `commodities, energy-complex, commodities-news` |
| cryptoDigital | header.panelCatCryptoDigital | 'finance' | `crypto, crypto-heatmap, defi-tokens, ai-tokens, other-tokens, crypto-news, etf-flows, stablecoins, fintech` |
| centralBanksEcon | header.panelCatCentralBanks | 'finance' | `centralbanks, economic, global-procurement, energy-complex, trade-policy, sanctions-pressure, supply-chain, china-corridors, china-activity-nowcast, economic-news` |
| dealsInstitutional | header.panelCatDeals | 'finance' | `ipo, derivatives, institutional, fin-regulation` |
| gulfMena | header.panelCatGulfMena | 'finance' | `gulf-economies, gcc-investments, gccNews, consumer-prices, monitors, world-clock` |
| commodityPrices | header.panelCatCommodityPrices | 'commodity' | `commodities, energy-complex, gold-silver, energy, base-metals, critical-minerals, markets, heatmap, macro-signals` |
| miningIndustry | header.panelCatMining | 'commodity' | `commodity-news, mining-news, mining-companies, supply-chain, china-corridors, china-activity-nowcast, commodity-regulation` |
| commodityEcon | header.panelCatCommodityEcon | 'commodity' | `trade-policy, sanctions-pressure, economic, gulf-economies, gcc-investments, consumer-prices, finance, polymarket, airline-intel, world-clock, monitors` |
| happyNews | header.panelCatHappyNews | 'happy' | `positive-feed, progress, counters, spotlight, breakthroughs, digest` |
| happyPlanet | header.panelCatHappyPlanet | 'happy' | `species, renewable, giving` |

## Premium/API-key gating
From `src/config/panels.ts` `isPanelEntitled()` — `apiKeyPanels` (require `WORLDMONITOR_API_KEY` OR Pro):
`stock-analysis`, `stock-backtest`, `daily-market-brief`, `market-implications`, `regional-intelligence`, `deduction`, `chat-analyst`, `wsb-ticker-scanner`, `trade-policy`, `global-procurement`

Note: `forecast` is desktop-locked / trial-unlocked on web; `cii`, `strategic-risk`, `gdelt-intel`, `supply-chain` are `premium: enhanced` on desktop (unlocked by Pro/desktop). `oref-sirens`, `telegram-intel`, `x-intel` are desktop-locked only.
From `src/app/panel-layout.ts` `WEB_PREMIUM_PANELS` — premium-gated on web:
`stock-analysis`, `stock-backtest`, `daily-market-brief`, `market-implications`, `deduction`, `chat-analyst`, `wsb-ticker-scanner`, `latest-brief`, `regional-intelligence`, `trade-policy`, `global-procurement`

## Map-layer registry (src/config/panels.ts `MapLayers` + `LAYER_TO_SOURCE`)
Key → data-source freshness IDs:

| Layer key | Freshness source IDs |
|---|---|
| `military` | `opensky, wingbits` |
| `ais` | `ais` |
| `natural` | `usgs` |
| `weather` | `weather` |
| `canadaRoads` | `ontario_511, alberta_511, manitoba_511, toronto_roads, bc_open511` |
| `outages` | `outages` |
| `cyberThreats` | `cyber_threats` |
| `protests` | `acled, gdelt_doc` |
| `ucdpEvents` | `ucdp_events` |
| `displacement` | `unhcr` |
| `climate` | `climate` |
| `sanctions` | `sanctions_pressure` |
| `radiationWatch` | `radiation` |

## Per-variant panel catalog (from PANELS_* consts)

### full variant (109 panels)

| Panel ID | Display Name | Priority | Default enabled | Premium |
|---|---|---|---|---|
| `map` | Global Map | 1 | yes | — |
| `live-news` | Live News | 1 | yes | — |
| `live-webcams` | Live Webcams | 1 | yes | — |
| `windy-webcams` | Windy Live Webcam | 2 | no | — |
| `insights` | AI Insights | 1 | yes | — |
| `threat-timeline` | Threat Timeline | 1 | yes | — |
| `strategic-posture` | AI Strategic Posture | 1 | yes | — |
| `forecast` | AI Forecasts | 1 | yes | locked |
| `cii` | Country Instability | 1 | yes | enhanced |
| `strategic-risk` | Strategic Risk Overview | 1 | yes | enhanced |
| `intel` | Intel Feed | 1 | yes | — |
| `gdelt-intel` | Live Intelligence | 1 | yes | enhanced |
| `cascade` | Infrastructure Cascade | 1 | yes | — |
| `military-correlation` | Force Posture | 2 | yes | — |
| `escalation-correlation` | Escalation Monitor | 2 | yes | — |
| `economic-correlation` | Economic Warfare | 2 | yes | — |
| `disaster-correlation` | Disaster Cascade | 2 | yes | — |
| `politics` | World News | 1 | yes | — |
| `us` | United States | 1 | yes | — |
| `europe` | Europe | 1 | yes | — |
| `middleeast` | Middle East | 1 | yes | — |
| `africa` | Africa | 1 | yes | — |
| `latam` | Latin America | 1 | yes | — |
| `asia` | Asia-Pacific | 1 | yes | — |
| `energy` | Energy & Resources | 1 | yes | — |
| `gov` | Government | 1 | yes | — |
| `thinktanks` | Think Tanks | 1 | yes | — |
| `polymarket` | Predictions | 1 | yes | — |
| `commodities` | Metals & Materials | 1 | yes | — |
| `energy-complex` | Energy Complex | 1 | yes | — |
| `oil-inventories` | Oil Inventories | 60 | yes | — |
| `markets` | Markets | 1 | yes | — |
| `stock-analysis` | Stock Analysis | 1 | yes | locked |
| `stock-backtest` | Backtesting | 1 | yes | locked |
| `daily-market-brief` | Daily Market Brief | 1 | yes | locked |
| `chat-analyst` | WM Analyst | 1 | yes | locked |
| `economic` | Macro Stress | 1 | yes | — |
| `global-procurement` | Global Procurement | 1 | yes | locked |
| `trade-policy` | Trade Policy | 1 | yes | locked |
| `supply-chain` | Supply Chain | 1 | yes | enhanced |
| `china-corridors` | China Logistics Corridors | 1 | yes | — |
| `china-activity-nowcast` | China Activity Nowcast | 1 | yes | — |
| `finance` | Financial | 1 | yes | — |
| `tech` | Technology | 2 | yes | — |
| `crypto` | Crypto | 2 | yes | — |
| `heatmap` | Sector Heatmap | 2 | yes | — |
| `ai` | AI/ML | 2 | yes | — |
| `layoffs` | Layoffs Tracker | 2 | yes | — |
| `monitors` | My Monitors | 2 | yes | — |
| `latest-brief` | Latest Brief | 1 | yes | locked |
| `satellite-fires` | Fires | 2 | yes | — |
| `macro-signals` | Market Regime | 2 | yes | — |
| `fear-greed` | Fear & Greed | 2 | yes | — |
| `aaii-sentiment` | AAII Sentiment | 2 | no | — |
| `market-breadth` | Market Breadth | 2 | yes | — |
| `news-market-correlation` | News ↔ Markets | 1 | yes | — |
| `macro-tiles` | Macro Indicators | 2 | no | — |
| `fsi` | Financial Stress | 2 | no | — |
| `yield-curve` | Yield Curve | 2 | no | — |
| `earnings-calendar` | Earnings Calendar | 2 | no | — |
| `economic-calendar` | Economic Calendar | 2 | no | — |
| `cot-positioning` | COT Positioning | 2 | yes | — |
| `liquidity-shifts` | Liquidity Shifts | 2 | yes | — |
| `positioning-247` | 24/7 Positioning | 2 | yes | — |
| `gold-intelligence` | Gold Intelligence | 60 | yes | — |
| `hormuz-tracker` | Hormuz Trade Tracker | 2 | yes | — |
| `energy-crisis` | Energy Crisis Tracker | 2 | yes | — |
| `pipeline-status` | Oil & Gas Pipeline Status | 2 | yes | — |
| `storage-facility-map` | Strategic Storage Atlas | 2 | yes | — |
| `fuel-shortages` | Global Fuel Shortage Registry | 2 | yes | — |
| `energy-disruptions` | Energy Disruptions Log | 2 | yes | — |
| `energy-risk-overview` | Global Energy Risk Overview | 2 | no | — |
| `gulf-economies` | Gulf Economies | 2 | no | — |
| `consumer-prices` | Consumer Prices | 2 | no | — |
| `grocery-basket` | Grocery Index | 2 | no | — |
| `bigmac` | Big Mac Index | 2 | no | — |
| `fx` | FX Rates | 2 | no | — |
| `fuel-prices` | Fuel Prices | 2 | no | — |
| `fao-food-price-index` | FAO Food Price Index | 2 | no | — |
| `etf-flows` | BTC ETF Tracker | 2 | yes | — |
| `stablecoins` | Stablecoins | 2 | yes | — |
| `ucdp-events` | UCDP Conflict Events | 2 | yes | — |
| `disease-outbreaks` | Disease Outbreaks | 2 | yes | — |
| `social-velocity` | Social Velocity | 2 | yes | — |
| `wsb-ticker-scanner` | WSB Ticker Scanner | 75 | yes | locked |
| `giving` | Global Giving | 2 | no | — |
| `displacement` | UNHCR Displacement | 2 | yes | — |
| `climate` | Climate Anomalies | 2 | yes | — |
| `climate-news` | Climate News | 2 | no | — |
| `population-exposure` | Population Exposure | 2 | yes | — |
| `security-advisories` | Security Advisories | 2 | yes | — |
| `sanctions-pressure` | Sanctions Pressure | 2 | yes | — |
| `defense-patents` | R&D Signal | 2 | yes | — |
| `toronto-safety` | Toronto Safety | 2 | no | — |
| `radiation-watch` | Radiation Watch | 2 | yes | — |
| `thermal-escalation` | Thermal Escalation | 2 | yes | — |
| `oref-sirens` | Israel Sirens | 2 | yes | locked |
| `telegram-intel` | Telegram Intel | 2 | yes | locked |
| `x-intel` | X News Accounts | 2 | yes | locked |
| `airline-intel` | Airline Intelligence | 2 | yes | — |
| `tech-readiness` | Tech Readiness Index | 2 | yes | — |
| `world-clock` | World Clock | 2 | yes | — |
| `national-debt` | Global Debt Clock | 2 | yes | — |
| `cross-source-signals` | Cross-Source Signals | 2 | yes | — |
| `market-implications` | AI Market Implications | 1 | yes | locked |
| `regional-intelligence` | Regional Intelligence | 1 | no | locked |
| `deduction` | Deduct Situation | 1 | no | locked |
| `geo-hubs` | Geopolitical Hubs | 2 | no | — |
| `tech-hubs` | Hot Tech Hubs | 2 | no | — |

### tech variant (41 panels)

| Panel ID | Display Name | Priority | Default enabled | Premium |
|---|---|---|---|---|
| `map` | Global Tech Map | 1 | yes | — |
| `live-news` | Tech Headlines | 1 | yes | — |
| `live-webcams` | Live Webcams | 2 | yes | — |
| `windy-webcams` | Windy Live Webcam | 2 | no | — |
| `insights` | AI Insights | 1 | yes | — |
| `ai` | AI/ML News | 1 | yes | — |
| `tech` | Technology | 1 | yes | — |
| `startups` | Startups & VC | 1 | yes | — |
| `vcblogs` | VC Insights & Essays | 1 | yes | — |
| `regionalStartups` | Global Startup News | 1 | yes | — |
| `unicorns` | Unicorn Tracker | 1 | yes | — |
| `accelerators` | Accelerators & Demo Days | 1 | yes | — |
| `security` | Cybersecurity | 1 | yes | — |
| `policy` | AI Policy & Regulation | 1 | yes | — |
| `layoffs` | Layoffs Tracker | 1 | yes | — |
| `markets` | Tech Stocks | 2 | yes | — |
| `finance` | Financial News | 2 | yes | — |
| `crypto` | Crypto | 2 | yes | — |
| `hardware` | Semiconductors & Hardware | 2 | yes | — |
| `cloud` | Cloud & Infrastructure | 2 | yes | — |
| `dev` | Developer Community | 2 | yes | — |
| `github` | GitHub Trending | 1 | yes | — |
| `ipo` | IPO & SPAC | 2 | yes | — |
| `polymarket` | Tech Predictions | 2 | yes | — |
| `funding` | Funding & VC | 1 | yes | — |
| `producthunt` | Product Hunt | 1 | yes | — |
| `events` | Tech Events | 1 | yes | — |
| `internet-disruptions` | Internet Disruptions | 2 | yes | — |
| `service-status` | Service Status | 2 | yes | — |
| `economic` | Macro Stress | 2 | yes | — |
| `global-procurement` | Global Procurement | 1 | yes | locked |
| `tech-readiness` | Tech Readiness Index | 1 | yes | — |
| `macro-signals` | Market Regime | 2 | yes | — |
| `etf-flows` | BTC ETF Tracker | 2 | yes | — |
| `stablecoins` | Stablecoins | 2 | yes | — |
| `airline-intel` | Airline Intelligence | 2 | yes | — |
| `world-clock` | World Clock | 2 | yes | — |
| `monitors` | My Monitors | 2 | yes | — |
| `latest-brief` | Latest Brief | 1 | yes | locked |
| `tech-hubs` | Hot Tech Hubs | 2 | no | — |
| `ai-regulation` | AI Regulation Dashboard | 2 | no | — |

### finance variant (68 panels)

| Panel ID | Display Name | Priority | Default enabled | Premium |
|---|---|---|---|---|
| `map` | Global Markets Map | 1 | yes | — |
| `live-news` | Market Headlines | 1 | yes | — |
| `live-webcams` | Live Webcams | 2 | yes | — |
| `windy-webcams` | Windy Live Webcam | 2 | no | — |
| `insights` | AI Market Insights | 1 | yes | — |
| `markets` | Live Markets | 1 | yes | — |
| `stock-analysis` | Premium Stock Analysis | 1 | yes | locked |
| `stock-backtest` | Premium Backtesting | 1 | yes | locked |
| `daily-market-brief` | Daily Market Brief | 1 | yes | locked |
| `markets-news` | Markets News | 2 | yes | — |
| `forex` | Forex & Currencies | 1 | yes | — |
| `fx` | FX Rates | 2 | no | — |
| `bonds` | Fixed Income | 1 | yes | — |
| `commodities` | Metals & Materials | 1 | yes | — |
| `energy-complex` | Energy Complex | 1 | yes | — |
| `pipeline-status` | Oil & Gas Pipeline Status | 2 | no | — |
| `commodities-news` | Commodities News | 2 | yes | — |
| `crypto` | Crypto & Digital Assets | 1 | yes | — |
| `crypto-news` | Crypto News | 2 | yes | — |
| `crypto-heatmap` | Crypto Sectors | 1 | yes | — |
| `defi-tokens` | DeFi Tokens | 2 | yes | — |
| `ai-tokens` | AI Tokens | 2 | yes | — |
| `other-tokens` | Alt Tokens | 2 | yes | — |
| `centralbanks` | Central Bank Watch | 1 | yes | — |
| `economic` | Macro Stress | 1 | yes | — |
| `global-procurement` | Global Procurement | 1 | yes | locked |
| `trade-policy` | Trade Policy | 1 | yes | locked |
| `sanctions-pressure` | Sanctions Pressure | 1 | yes | — |
| `supply-chain` | Supply Chain | 1 | yes | — |
| `china-corridors` | China Logistics Corridors | 2 | no | — |
| `china-activity-nowcast` | China Activity Nowcast | 2 | no | — |
| `economic-news` | Economic News | 2 | yes | — |
| `ipo` | IPOs, Earnings & M&A | 1 | yes | — |
| `heatmap` | Sector Heatmap | 1 | yes | — |
| `macro-signals` | Market Regime | 1 | yes | — |
| `macro-tiles` | Macro Indicators | 1 | yes | — |
| `fear-greed` | Fear & Greed | 1 | yes | — |
| `aaii-sentiment` | AAII Sentiment | 2 | yes | — |
| `market-breadth` | Market Breadth | 1 | yes | — |
| `news-market-correlation` | News ↔ Markets | 1 | yes | — |
| `fsi` | Financial Stress | 1 | yes | — |
| `yield-curve` | Yield Curve | 1 | yes | — |
| `earnings-calendar` | Earnings Calendar | 1 | yes | — |
| `economic-calendar` | Economic Calendar | 1 | yes | — |
| `cot-positioning` | COT Positioning | 2 | yes | — |
| `liquidity-shifts` | Liquidity Shifts | 1 | yes | — |
| `positioning-247` | 24/7 Positioning | 1 | yes | — |
| `gold-intelligence` | Gold Intelligence | 60 | yes | — |
| `derivatives` | Derivatives & Options | 2 | yes | — |
| `fintech` | Fintech & Trading Tech | 2 | yes | — |
| `fin-regulation` | Financial Regulation | 2 | yes | — |
| `institutional` | Hedge Funds & PE | 2 | yes | — |
| `analysis` | Market Analysis | 2 | yes | — |
| `etf-flows` | BTC ETF Tracker | 2 | yes | — |
| `stablecoins` | Stablecoins | 2 | yes | — |
| `gcc-investments` | GCC Investments | 2 | yes | — |
| `gccNews` | GCC Business News | 2 | yes | — |
| `gulf-economies` | Gulf Economies | 1 | yes | — |
| `consumer-prices` | Consumer Prices | 1 | yes | — |
| `polymarket` | Predictions | 2 | yes | — |
| `wsb-ticker-scanner` | WSB Ticker Scanner | 75 | yes | locked |
| `airline-intel` | Airline Intelligence | 2 | yes | — |
| `world-clock` | World Clock | 2 | yes | — |
| `monitors` | My Monitors | 2 | yes | — |
| `latest-brief` | Latest Brief | 1 | yes | locked |
| `nq-pulse` | NQ Pulse | 1 | no | — |
| `nq-catalysts` | NQ Catalysts | 1 | no | — |
| `nq-news` | NQ News | 2 | no | — |

### commodity variant (36 panels)

| Panel ID | Display Name | Priority | Default enabled | Premium |
|---|---|---|---|---|
| `map` | Commodity Map | 1 | yes | — |
| `live-news` | Commodity Headlines | 1 | yes | — |
| `insights` | AI Commodity Insights | 1 | yes | — |
| `commodity-news` | Commodity News | 1 | yes | — |
| `liquidity-shifts` | Liquidity Shifts | 1 | yes | — |
| `news-market-correlation` | News ↔ Markets | 1 | yes | — |
| `positioning-247` | 24/7 Positioning | 1 | yes | — |
| `gold-silver` | Gold & Silver | 1 | yes | — |
| `energy` | Energy Markets | 1 | yes | — |
| `mining-news` | Mining News | 1 | yes | — |
| `critical-minerals` | Critical Minerals | 1 | yes | — |
| `base-metals` | Base Metals | 1 | yes | — |
| `mining-companies` | Mining Companies | 1 | yes | — |
| `supply-chain` | Supply Chain & Logistics | 1 | yes | — |
| `china-corridors` | China Logistics Corridors | 2 | no | — |
| `china-activity-nowcast` | China Activity Nowcast | 2 | no | — |
| `commodity-regulation` | Regulation & Policy | 1 | yes | — |
| `markets` | Commodity Markets | 1 | yes | — |
| `commodities` | Live Metals & Materials | 1 | yes | — |
| `energy-complex` | Energy Complex | 1 | yes | — |
| `pipeline-status` | Oil & Gas Pipeline Status | 2 | no | — |
| `oil-inventories` | Oil Inventories | 60 | yes | — |
| `gold-intelligence` | Gold Intelligence | 60 | yes | — |
| `heatmap` | Sector Heatmap | 1 | yes | — |
| `macro-signals` | Market Regime | 1 | yes | — |
| `trade-policy` | Trade Policy | 1 | yes | locked |
| `sanctions-pressure` | Sanctions Pressure | 1 | yes | — |
| `economic` | Macro Stress | 1 | yes | — |
| `gulf-economies` | Gulf & OPEC Economies | 1 | yes | — |
| `gcc-investments` | GCC Resource Investments | 2 | yes | — |
| `consumer-prices` | Consumer Prices | 2 | yes | — |
| `airline-intel` | Airline Intelligence | 2 | yes | — |
| `polymarket` | Commodity Predictions | 2 | yes | — |
| `world-clock` | World Clock | 2 | yes | — |
| `monitors` | My Monitors | 2 | yes | — |
| `latest-brief` | Latest Brief | 1 | yes | locked |

### energy variant (28 panels)

| Panel ID | Display Name | Priority | Default enabled | Premium |
|---|---|---|---|---|
| `map` | Energy Atlas Map | 1 | yes | — |
| `energy-risk-overview` | Global Energy Risk Overview | 1 | yes | — |
| `chokepoint-strip` | Chokepoint Status | 1 | yes | — |
| `pipeline-status` | Oil & Gas Pipeline Status | 1 | yes | — |
| `storage-facility-map` | Strategic Storage Atlas | 1 | yes | — |
| `fuel-shortages` | Global Fuel Shortage Registry | 1 | yes | — |
| `energy-disruptions` | Energy Disruptions Log | 1 | yes | — |
| `live-news` | Energy Headlines | 1 | yes | — |
| `insights` | AI Energy Insights | 1 | yes | — |
| `energy-complex` | Oil & Gas Complex | 1 | yes | — |
| `oil-inventories` | Oil & Gas Inventories | 1 | yes | — |
| `hormuz-tracker` | Strait of Hormuz Tracker | 1 | yes | — |
| `energy-crisis` | Energy Crisis Policy Tracker | 1 | yes | — |
| `fuel-prices` | Retail Fuel Prices | 1 | yes | — |
| `renewable` | Renewable Energy | 2 | yes | — |
| `commodities` | Energy Commodities (WTI, Brent, NatGas) | 1 | yes | — |
| `energy` | Energy Markets News | 1 | yes | — |
| `macro-signals` | Market Regime | 2 | yes | — |
| `supply-chain` | Chokepoints & Routes | 1 | yes | — |
| `china-corridors` | China Logistics Corridors | 2 | no | — |
| `china-activity-nowcast` | China Activity Nowcast | 2 | no | — |
| `sanctions-pressure` | Sanctions Pressure | 2 | yes | — |
| `gulf-economies` | Gulf & OPEC Economies | 2 | yes | — |
| `gcc-investments` | GCC Energy Investments | 2 | yes | — |
| `climate` | Climate & Weather Impact | 2 | yes | — |
| `monitors` | My Monitors | 3 | yes | — |
| `world-clock` | World Clock | 3 | yes | — |
| `latest-brief` | Latest Brief | 1 | yes | locked |

### happy variant (10 panels)

| Panel ID | Display Name | Priority | Default enabled | Premium |
|---|---|---|---|---|
| `map` | World Map | 1 | yes | — |
| `positive-feed` | Good News Feed | 1 | yes | — |
| `progress` | Human Progress | 1 | yes | — |
| `counters` | Live Counters | 1 | yes | — |
| `spotlight` | ? | 1 | yes | — |
| `breakthroughs` | Breakthroughs | 1 | yes | — |
| `digest` | 5 Good Things | 1 | yes | — |
| `species` | Conservation Wins | 1 | yes | — |
| `renewable` | Renewable Energy | 1 | yes | — |
| `giving` | Global Giving | 1 | yes | — |

## Notes on data domains & service architecture
Per `src/config/panels.ts` and `AGENTS.md`, each panel key is resolved through:
1. `panel-layout.ts` `createPanels()` — registers a concrete `Panel` component per key (lazy via `lazyDefaultPanel` / `lazyImportedPanel`).
2. `src/services/<domain>/` — client-side fetch & cache layer.
3. `api/<domain>/v1/[rpc].ts` — Vercel Edge API route handler that reads from Upstash Redis.
4. `scripts/seed-*.mjs` — 195 seeders that write `seed-meta:<key>` + data to Redis.
5. News-category panels (`politics`, `tech`, `ai`, `finance`, etc.) render via a shared `NewsPanel` + `CANONICAL_FEEDS` (src/config/feeds.ts) — they all hit `api/rss-proxy.js` / `api/news/` and `api/` category routers.
6. `military.ts` (753 lines) — not a panel registration; it holds *military callsign / ICAO hex-range / vessel* pattern tables used by the `military` map layer and by `src/services/military/` ADS-B filters.
7. `markets.ts` — not a panel registration; it holds `SECTORS`, `COMMODITIES`, `STOCK_CATALOG` symbol tables used by the `MarketPanel` family.
8. `products.ts` / `products.generated.ts` — Dodo Payments product catalog + plan limits, not a panel registry.


---
---

## 二、数据管道 ①：经济 / 能源 / 贸易 / 气候

# WorldMonitor — Data Pipeline Traces (4 domains)

> Source: `/root/projects/worldmonitor`. Each row traces seeder → external API → env var → Redis key → API endpoint (`api/*`) → auth.
> API endpoints are Next.js edge RPC gateways: `api/<domain>/v1/[rpc].ts` proxies to `server/worldmonitor/<domain>/v1/handler.ts`, whose methods read Redis via `getCachedJson(SEED_KEY)` (seeded by the seeder) — seeders are the sole live upstream callers.

## 1. ECONOMIC / MARKETS

| Seeding Script | External API URL (full base) | Env Var for Key | Redis Key Prefix | API Endpoint (api/) | Auth Method |
|---|---|---|---|---|---|
| seed-market-quotes.mjs | `https://www.alphavantage.co/query?function=REALTIME_BULK_QUOTES&symbol=…&apikey=…` (`_shared-av.mjs`) | `ALPHA_VANTAGE_API_KEY` | `market:stocks-bootstrap:v1`; RPC key `market:quotes:v1:<symbols>`; `market:country-indexes:<CC>` | `api/market/v1/[rpc].ts` → `listMarketQuotes` (`server/.../market/v1/list-market-quotes.ts`) | Alpha Vantage: API key as query param `apikey=`; Finnhub: header `X-Finnhub-Token`; Yahoo: no auth (browser UA) |
| seed-market-quotes.mjs (residual/fallback) | `https://finnhub.io/api/v1/quote?symbol=…` (`shared/market-quote-provider.mjs`) | `FINNHUB_API_KEY` | (same keys as above) | (same) | Header `X-Finnhub-Token` |
| seed-market-quotes.mjs (fallback for `yahooOnly`) | `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}` | — (none) | (same keys as above) | (same) | None (unauthenticated, browser `User-Agent`) |
| seed-fear-greed.mjs | `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1y` (22 symbols) | — | `market:fear-greed:v1` | `api/market/v1/[rpc].ts` → `getFearGreedIndex` (`get-fear-greed-index.ts`) | None (browser UA) |
| seed-fear-greed.mjs | `https://www.barchart.com/stocks/quotes/$CPC` (put/call scrape) | — | (same key) | (same) | None (HTML scrape) |
| seed-fear-greed.mjs | `https://production.dataviz.cnn.io/index/fearandgreed/current` | — | (same key) | (same) | None (Mac UA + Referer required) |
| seed-fear-greed.mjs | `https://www.aaii.com/sentimentsurvey/sent_results` (AAII bull/bear scrape) | — | (same key) | (same) | None (HTML scrape) |
| seed-fear-greed.mjs (inputs) | Redis read of FRED series — fed by FRED seeder: `https://api.stlouisfed.org/fred/series/observations?series_id=…&api_key=…` | `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (intra-Redis) | reads `economic:fred:v1:<series>:0` | `api/economic/v1/[rpc].ts` → `getFredSeries` / `getFredSeriesBatch` | FRED seeder: key as query param `api_key=`; Redis REST: `Authorization: Bearer` |
| seed-forecasts.mjs | LLM providers: Groq `https://api.groq.com/openai/v1/chat/completions`, OpenRouter, DeepSeek (via `_llm-model-timeouts.mjs`) | `GROQ_API_KEY`, OpenRouter key, `DEEPSEEK_API_KEY` | `forecast:predictions:v2`; `forecast:predictions-bootstrap:v1`; `forecast:predictions:history:v1`; `forecast:trace:latest:v1` | `api/forecast/v1/[rpc].ts` → forecast handler | Bearer token (`Authorization: Bearer`) |
| seed-cot.mjs | `https://publicreporting.cftc.gov/resource/yw9f-hn96.json` (TFF) and `…/resource/rxbv-e226.json` (disaggregated) — Socrata | — (none) | `market:cot:v1` | `api/market/v1/[rpc].ts` → `getCotPositioning` (`get-cot-positioning.ts`) | None (public Socrata dataset) |
| seed-etf-flows.mjs | `https://www.alphavantage.co/query?function=REALTIME_BULK_QUOTES&symbol=…&apikey=…` | `ALPHA_VANTAGE_API_KEY` | `market:etf-flows:v1` | `api/market/v1/[rpc].ts` → `listEtfFlows` (`list-etf-flows.ts`) | API key query param |
| seed-etf-flows.mjs (fallback) | `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=5d&interval=1d` | — | (same key) | (same) | None |
| seed-stablecoin-markets.mjs | `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=…` (pro: `https://pro-api.coingecko.com/api/v3`) | `COINGECKO_API_KEY` (Pro) / `COINGECKO_DEMO_API_KEY` (Demo) | `market:stablecoins:v1` | `api/market/v1/[rpc].ts` → `listStablecoinMarkets` (`list-stablecoin-markets.ts`) | Header `x-cg-pro-api-key` / `x-cg-demo-api-key`, else keyless |
| seed-stablecoin-markets.mjs (fallback) | CoinPaprika `https://api.coinpaprika.com/v1/tickers` (`fetchCoinPaprikaTickersById`) | — | (same key) | (same) | None |

## 2. ENERGY

| Seeding Script | External API URL (full base) | Env Var for Key | Redis Key Prefix | API Endpoint (api/) | Auth Method |
|---|---|---|---|---|---|
| seed-eia-petroleum.mjs | `https://api.eia.gov/v2/seriesid/{seriesId}?api_key=…&num=2` (PET.RWTC.W, PET.RBRTE.W, PET.WCRFPUS2.W, PET.WCESTUS1.W) | `EIA_API_KEY` | `energy:eia-petroleum:v1` | `api/economic/v1/[rpc].ts` → energy handlers (`getEnergyPrices`, `getCrudeInventories`, `getOilInventories`) | API key as query param `api_key=` |
| seed-iea-oil-stocks.mjs | `https://api.iea.org/netimports/latest` then `https://api.iea.org/netimports/monthly/?year=…&month=…` | — (none) | `energy:iea-oil-stocks:v1:index`; per-country `energy:iea-oil-stocks:v1:{ISO2}`; `energy:oil-stocks-analysis:v1` | `api/economic/v1/[rpc].ts` → `getOilStocksAnalysis` | None (public IEA API) |
| seed-ember-electricity.mjs | `https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/monthly_full_release_long_format.csv` (public GCS bucket, Ember data) | — (none) | `energy:ember:v1:{ISO2}`; `energy:ember:v1:_all` | `api/economic/v1/[rpc].ts` → energy handlers (`getEnergyCapacity`) / `api/mcp` cache tools | None (public file) |
| seed-electricity-prices.mjs | `https://web-api.tp.entsoe.eu/api?documentType=A44&…&securityToken=…` (10 EU/EEA bidding zones) | `ENTSO_E_TOKEN` | `energy:electricity:v1:{region}` (DE,FR,ES,IT,NL,BE,PL,PT,NO,SE + CISO,MISO,PJM,NYISO,ERCO,SPP,ISNE) | `api/economic/v1/[rpc].ts` → `getEnergyPrices` | Security token as query param `securityToken=` |
| seed-electricity-prices.mjs (US demand) | `https://api.eia.gov/v2/electricity/rto/region-data/data/?facets[respondent][]=…&api_key=…` (EIA-930) | `EIA_API_KEY` | (same region keys, `source: eia-930`) | (same) | API key query param `api_key=` |

## 3. TRADE / SUPPLY CHAIN

| Seeding Script | External API URL (full base) | Env Var for Key | Redis Key Prefix | API Endpoint (api/) | Auth Method |
|---|---|---|---|---|---|
| seed-commodity-quotes.mjs | `https://www.alphavantage.co/query?function=REALTIME_BULK_QUOTES&symbol=…&apikey=…` + physical-commodity functions (WTI/BRENT/NAT_GAS/COPPER/ALUMINUM) | `ALPHA_VANTAGE_API_KEY` | `market:commodities-bootstrap:v1`; `market:gold-extended:v1` | `api/market/v1/[rpc].ts` → `listCommodityQuotes` (`list-commodity-quotes.ts`) | API key query param |
| seed-commodity-quotes.mjs (fallback) | `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1y&interval=1d` | — | (same keys) | (same) | None |
| seed-fao-food-price-index.mjs | `https://www.fao.org/media/docs/worldfoodsituationlibraries/default-document-library/food_price_indices_data.csv` | — (none) | `economic:fao-ffpi:v1` | `api/economic/v1/[rpc].ts` → `getFaoFoodPriceIndex` (`get-fao-food-price-index.ts`) | None (public CSV) |
| seed-food-stocks.mjs | `https://api.fas.usda.gov/api/psd/commodity/{code}/country/all/year/{year}` and `…/world/year/{year}` | `USDA_FAS_PSD_API_KEY` (fallback `USDA_FAS_API_KEY`) | `resilience:food-stocks:v1` | `api/resilience/v1/[rpc].ts` / `api/supply-chain/v1/[rpc].ts` → `getCountryVulnerabilities` / `getChokepointDependencies` | Header `X-Api-Key` |
| seed-food-stocks.mjs (gap fill) | FAOSTAT `https://api.data.apps.fao.org/api/v2/bigquery?download=true&item_code=…&sql_url=…` | — (none) | (same canonical key) | (same) | None (public query service) |
| supply-chain domain (general) | shipping / chokepoint / mineral seeders (e.g. `seed-portwatch.mjs`, `seed-pipelines-oil.mjs`, `seed-mineral-production.mjs`) | various per-seeder | `supply-chain:*` / `maritime:*` | `api/supply-chain/v1/[rpc].ts` → handlers `getShippingRates`, `getChokepointStatus`, `listPipelines`, `listFuelShortages`, `getCriticalMinerals`, etc. | mixed (public + keyed) |
| trade domain (general) | `seed-trade-flows.mjs`, `seed-comtrade-bilateral-hs4.mjs` (UN Comtrade `https://comtradeapi.un.org/data/v1/preview/…`) | `COMTRADE_API_KEY` (typical) | `trade:*` | `api/trade/v1/[rpc].ts` → `listComtradeFlows`, `getTradeFlows`, `getTradeBarriers`, `getCustomsRevenue` | Bearer / API key header |

## 4. CLIMATE

| Seeding Script | External API URL (full base) | Env Var for Key | Redis Key Prefix | API Endpoint (api/) | Auth Method |
|---|---|---|---|---|---|
| seed-climate-anomalies.mjs | `https://archive-api.open-meteo.com/v1/archive?latitude=…&longitude=…&start_date=…&end_date=…&daily=temperature_2m_mean,precipitation_sum&timezone=UTC` (ERA5 reanalysis) | — (none) | `climate:anomalies:v2` | `api/climate/v1/[rpc].ts` → `listClimateAnomalies` (`list-climate-anomalies.ts`) | None (public, 8 concurrent batch cap, 750 ms delay) |
| seed-climate-anomalies.mjs (normals ref) | Redis read of `climate:zone-normal` bucket — fed by `seed-climate-zone-normals.mjs` (Open-Meteo normals) | — | reads `climate:zone-normals:v1` (per `CLIMATE_ZONES`) | (same) | None |
| seed-co2-monitoring.mjs | `https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.txt`, `…/co2_mm_mlo.txt`, `…/co2_annmean_gl.txt`, `…/ch4_mm_gl.txt`, `…/n2o_mm_gl.txt` | — (none) | `climate:co2-monitoring:v1` | `api/climate/v1/[rpc].ts` → `getCo2Monitoring` (`get-co2-monitoring.ts`) | None (public text files) |
| seed-climate-ocean-ice.mjs | `https://noaadata.apps.nsidc.org/NOAA/G02135/north/daily/data/N_seaice_extent_daily_v4.0.csv` (NSIDC Sea Ice Index), `…/N_seaice_extent_climatology_1981-2010_v4.0.csv`, `https://sealevel.nasa.gov/overlay-global-mean-sea-level` (NASA), `https://www.ncei.noaa.gov/data/oceans/woa/DATA_ANALYSIS/3M_HEAT_CONTENT/DATA/basin/yearly/h22-w0-700m.dat` (NOAA WOA), NOAA OI v6 ocean anomalies | — (none) | `climate:ocean-ice:v1` | `api/climate/v1/[rpc].ts` → `getOceanIceData` (`get-ocean-ice-data.ts`) | None (public data files) |
| seed-climate-disasters.mjs | `https://api.reliefweb.int/v1/disasters` (fallback `…/v2/disasters`) — OCHA ReliefWeb | — (none) | `climate:disasters:v1`; also writes `natural:events:v1` | `api/climate/v1/[rpc].ts` → `listClimateDisasters` (`list-climate-disasters.ts`) | None (public API) |
| seed-climate-disasters.mjs (sources merged) | NASA FIRMS `firms.modaps.eosdis.nasa.gov`, GDACS `gdacs.org`, NASA EONET `eonet.gsfc.nasa.gov` (read from `natural:events:v1`) | — | `natural:events:v1` | `api/climate/v1/[rpc].ts` + `api/natural/v1/[rpc].ts` | None |

## External API / website inventory (deduped, all 4 domains)

| # | Host | Service | Auth |
|---|---|---|---|
| 1 | alphavantage.co | Alpha Vantage (equities/ETFs/commodities) | `ALPHA_VANTAGE_API_KEY` query param |
| 2 | finnhub.io | Finnhub quote API | `FINNHUB_API_KEY` header `X-Finnhub-Token` |
| 3 | query1.finance.yahoo.com | Yahoo Finance chart (fallback) | none |
| 4 | api.coingecko.com / pro-api.coingecko.com | CoinGecko stablecoins | `COINGECKO_API_KEY` / `COINGECKO_DEMO_API_KEY` header `x-cg-*-api-key` |
| 5 | api.coinpaprika.com | CoinPaprika (fallback) | none |
| 6 | api.eia.gov | EIA Open Data (petroleum, electricity) | `EIA_API_KEY` query param |
| 7 | api.iea.org | IEA net-imports / oil stocks | none |
| 8 | storage.googleapis.com (Ember bucket) | Ember electricity mix CSV | none |
| 9 | web-api.tp.entsoe.eu | ENTSO-E Transparency Platform (A44 EU prices) | `ENTSO_E_TOKEN` query param |
| 10 | api.fas.usda.gov | USDA FAS PSD (food stocks) | `USDA_FAS_PSD_API_KEY` header `X-Api-Key` |
| 11 | api.data.apps.fao.org | FAOSTAT Food Balances (query service) | none |
| 12 | fao.org | FAO Food Price Index CSV | none |
| 13 | publicreporting.cftc.gov | CFTC COT (Socrata) | none |
| 14 | archive-api.open-meteo.com | Open-Meteo ERA5 archive | none |
| 15 | gml.noaa.gov | NOAA GML CO₂/CH₄/N₂O trends | none |
| 16 | noaadata.apps.nsidc.org | NSIDC Sea Ice Index | none |
| 17 | sealevel.nasa.gov | NASA Sea Level | none |
| 18 | www.ncei.noaa.gov | NOAA NCEI (WOA heat content, OI ocean) | none |
| 19 | api.reliefweb.int | OCHA ReliefWeb disasters | none |
| 20 | api.groq.com / OpenRouter / DeepSeek | LLMs (forecasts) | Bearer API key |
| 21 | Upstash Redis | Intra-Redis shared store | `UPSTASH_REDIS_REST_*` Bearer |

**21 external APIs/websites** span the four domains.


---
---

## 三、数据管道 ②：军事 / 冲突 / 情报 / 网络

# WorldMonitor — Data Pipeline Traces (MILITARY / CONFLICT / INTEL / CYBER)

> Completes the set: wm-pipelines-1.md (economic/energy/trade/climate), wm-pipelines-3.md (aviation/maritime/weather). Source: `/root/projects/worldmonitor`.
> Conventions shared by all seeders: `loadEnvFile()` in `scripts/_seed-utils.mjs`; every seeder writes `seed-meta:<key>` + `seed-activated:*`; Redis via `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (docker-compose maps to internal redis-rest proxy); optional egress proxy `PROXY_URL`/`PROXY_AUTH`.
> API surface: `api/<domain>/v1/[rpc].ts` → `server/worldmonitor/<domain>/v1/handler.ts` → Redis via `getCachedJson(SEED_KEY)`.

## 1. MILITARY (flights, bases, CII, maritime news)

| Seeding Script | External API URL (full base) | Env Var for Key | Redis Key | API Endpoint (api/) | Auth Method |
|---|---|---|---|---|---|
| seed-military-flights.mjs (primary) | `https://api.adsb.lol/v2/mil` — ADSB.lol military traffic | — (keyless public) | `military:flights:v1` (TTL 600s) + `:stale:v1` (86400s) | `api/military/v1/[rpc].ts` (ListMilitaryFlights, GetTheaterPosture, GetMilitarySurges, ...) | none |
| seed-military-flights.mjs (gap-fill A) | `https://api.airplanes.live/v2/point` — planes.live point queries | — | (same keys) | (same) | none (non-commercial use only; gated by `WM_ENABLE_NONCOMMERCIAL_ADSB_GAP_FILL=1`) |
| seed-military-flights.mjs (gap-fill B) | `https://opendata.adsb.fi/api/v3` — ADSB.fi regional point queries | — | (same keys) | (same) | none (1 req/s alternation) |
| seed-military-flights.mjs (optional) | `https://opensky-network.org/api` + OAuth token `https://auth.opensky-network.org/.../token` — OpenSky Network premium | `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `OPENSKY_PROXY_AUTH` | (same keys) | (same) | OAuth2 client-credentials Bearer |
| seed-military-cii.mjs | Derived on-demand: reads `military:flights:v1` + WS relay AIS vessels (no direct external call) | reads via `WS_RELAY_URL` + `RELAY_SHARED_SECRET`/`RELAY_AUTH_HEADER` | `intelligence:military-cii:v1` | `api/intelligence/v1/[rpc].ts` (GetMilitaryCii) | relay shared secret (x-relay-key) |
| seed-military-bases.mjs | Cloudflare R2 static object `https://api.cloudflare.com/client/v4/accounts/{acct}/r2/buckets/worldmonitor-data/objects/seed-data/military-bases-final.json` (curated base registry, no live API) | `CLOUDFLARE_R2_TOKEN` or `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_R2_ACCOUNT_ID` | `military-bases-*` geo keys (versioned, ZSET+HASH) | `api/military/v1/[rpc].ts` (ListMilitaryBases, GetBaseDetail) | R2 Bearer token |
| seed-military-maritime-news.mjs | `https://api.worldmonitor.app` — pulls live API news feeds (self-referential warm cache) | `WORLDMONITOR_RELAY_KEY` (else Origin-only auth) | maritime news cache keys | `api/military/v1/[rpc].ts` (ListMaritimeNews) | `X-WorldMonitor-Key` header |
| (feeds used by military-CII) | CISA advisories `https://www.cisa.gov/cybersecurity-advisories/all.xml` in `server/worldmonitor/news/v1/_feeds.ts` | — | news feeds | `api/news/` | none |

Military domain env vars (full list): `UNSTASH_REDIS_REST_URL/TOKEN`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `OPENSKY_PROXY_AUTH`, `PROXY_URL`, `WM_ENABLE_NONCOMMERCIAL_ADSB_GAP_FILL`, `CLOUDFLARE_R2_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_R2_ACCOUNT_ID`, `WS_RELAY_URL`, `RELAY_SHARED_SECRET`, `RELAY_AUTH_HEADER`, `WORLDMONITOR_RELAY_KEY`, `CHAIN_FORECAST_SEED_ON_MILITARY`, `GF_429_COOLDOWN_MS`, plus the relay-side rate limits `RELAY_OPENSKY_RATE_LIMIT_MAX` / `RELAY_OREF_RATE_LIMIT_MAX` / `RELAY_RATE_LIMIT_WINDOW_MS`.

## 2. CONFLICT / INTEL (ACLED, UCDP, GDELT, HAPI)

| Seeding Script | External API URL (full base) | Env Var for Key | Redis Key | API Endpoint (api/) | Auth Method |
|---|---|---|---|---|---|
| seed-conflict-intel.mjs | `https://acleddata.com/api/acled/read` (ACLED event API) | `ACLED_ACCESS_TOKEN`, `ACLED_EMAIL`, `ACLED_PASSWORD` | `conflict:acled:v1:all:0:0` (TTL 2700s) + `conflict:acled-resolution:v1:all:0:0` | `api/intelligence/v1/[rpc].ts` (ListAcledEvents, GetHumanitarianSummary) | HTTP Basic (email/password) Bearer token |
| seed-conflict-intel.mjs (humanitarian) | HAPI HDX API (WHO/UN humanitarian data) via `HAPI_HDX_PACKAGE_URL` (shared pool: `https://api.hdxapi.org` typical) | shared pool (`PROXY_URL` for rate limits) | `conflict:humanitarian:hapi-backoff:v1` + `seed-meta:conflict:humanitarian` | (same) | none (public) |
| seed-conflict-intel.mjs (GDELT fallback) | `https://api.gdeltproject.org/api/v2/doc/doc` + bulk event export | `GDELT_PROXY_URL` (else `PROXY_URL`) | `conflict:bulk-gdelt:*` (GDELT_BULK_CONFLICT_KEY) | (same) | none (rate-limited, 120s budget) |
| seed-ucdp-events.mjs | `https://ucdp.org` UCDP event-dataset (annual + GED candidate monthly releases) via Socrata + GitHub Pages | `UCDP_ACCESS_TOKEN` (fallback `UC_DP_KEY`) | `conflict:ucdp-events:v1` (MAX 2000 events) + `conflict:ucdp-events-bootstrap:v1` | `api/conflict/v1/[rpc].ts` (ListUcdpEvents, GetUcdpDashboard) | Bearer token if token set; else public |
| seed-gdelt-intel.mjs | `https://api.gdeltproject.org/api/v2/doc/doc` (live GDELT document search) | `GDELT_PROXY_URL` (else `PROXY_URL`) | `intelligence:gdelt-intel:v1` | `api/intelligence/v1/[rpc].ts` (GetGdeltIntel) | none |
| seed-gdelt-bulk-materializer.mjs | GDELT bulk event export (rolling window) | (shared `GDELT_PROXY_URL`) | `GDELT_BULK_CONFLICT_KEY` | (same as above) | none |

## 3. CYBER (threat feeds)

| Seeding Script | External API URL (full base) | Env Var for Key | Redis Key | API Endpoint (api/) | Auth Method |
|---|---|---|---|---|---|
| seed-cyber-threats.mjs | `https://feodotracker.abuse.ch/downloads/ipblocklist.json` — FeodoTracker | — | `cache:abuseipdb:threats` (bootstrap) | `api/cyber/v1/[rpc].ts` (ListCyberThreats) | none |
| seed-cyber-threats.mjs | `https://urlhaus-api.abuse.ch/v1/urls/recent/limit/N/` — URLhaus | `URLHAUS_AUTH_KEY` (optional) | `cache:cyber:first-seen:v1` | (same) | none, or API key |
| seed-cyber-threats.mjs | `https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/IPC2s-30day.csv` — C2IntelFeeds | — | (same) | (same) | none (public GitHub) |
| seed-cyber-threats.mjs | `https://otx.alienvault.com/api/v1/indicators/export?type=IPv4&modified_since=...` — AlienVault OTX | `OTX_API_KEY` (required for OTX path) | (same) | (same) | API key header |
| seed-cyber-threats.mjs | `https://api.abuseipdb.com/api/v2/blacklist` — AbuseIPDB | `ABUSEIPDB_API_KEY` (required for blacklist path) | (same) | (same) | API key header |
| seed-cyber-threats.mjs (IP enrich) | `https://ipinfo.io/{ip}/json` + `https://freeipapi.com/api/json/{ip}` — IP geo enrichment | `OTX_API_KEY` (used for IPinfo key, optional) | (same) | (same) | none, or API key |
| (derived) | CISA advisories `https://www.cisa.gov/cybersecurity-advisories/all.xml` | — | `cyber:threats:v2` (CANONICAL) + `cyber:threats-bootstrap:v2` (BOOTSTRAP) | `api/cyber/v1/[rpc].ts` + resilience scorers (`server/worldmonitor/resilience/v1/_dimension-scorers.ts` reads `cyber:threats:v2`) | none |

Cyber domain env vars: `ABUSEIPDB_API_KEY`, `OTX_API_KEY`, `URLHAUS_AUTH_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, plus `rate:abuseipdb:last-call` (Redis rate limiter).

## Domain env var summary (MILITARY/CONFLICT/INTEL/CYBER)

Required (docker-compose boot, not domain-specific): `REDIS_PASSWORD`, `REDIS_TOKEN`, `WM_SESSION_SECRET`, `RELAY_SHARED_SECRET`.

Domain-specific required to enable the feature (each seeder skips silently if unset):
- `ACLED_ACCESS_TOKEN` (+ `ACLED_EMAIL` + `ACLED_PASSWORD`) — ACLED conflict feed
- `UCDP_ACCESS_TOKEN` (or `UC_DP_KEY`) — UCDP event dataset (else public Socrata/GitHub fallback)
- `ABUSEIPDB_API_KEY` — AbuseIPDB blacklist (else skipped)
- `OTX_API_KEY` — AlienVault OTX (else skipped)
- `URLHAUS_AUTH_KEY` — URLhaus (optional, else public)
- `CLOUDFLARE_R2_TOKEN` or `CLOUDFLARE_API_TOKEN` — military-bases static object (R2)
- `OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` — OpenSky premium (else ADSB.lol keyless)
- `WS_RELAY_URL` — military-CII + maritime-relay access
- `WORLDMONITOR_RELAY_KEY` — self-referential warm-cache relay (else Origin-only)
- `GDELT_PROXY_URL` — optional relay for GDELT (else `PROXY_URL`)

Optional / dev knobs: `OPENSKY_PROXY_AUTH`, `WM_ENABLE_NONCOMMERCIAL_ADSB_GAP_FILL`, `CHAIN_FORECAST_SEED_ON_MILITARY`, `GF_429_COOLDOWN_MS`, `RELAY_OPENSKY_RATE_LIMIT_MAX`, `RELAY_OREF_RATE_LIMIT_MAX`, `RELAY_RATE_LIMIT_WINDOW_MS`, `RELAY_SHARED_SECRET` (always), `RELAY_AUTH_HEADER` (default `x-relay-key`).

## Panels tied to this domain (from wm-panels-analysis.md)

| Panel ID | Display Name | Domain | Premium |
|---|---|---|---|
| `threat-timeline` | Threat Timeline | intelligence | — |
| `strategic-posture` | AI Strategic Posture | intelligence | — |
| `cii` | Country Instability (CII) | country instability | enhanced |
| `strategic-risk` | Strategic Risk Overview | intelligence | enhanced |
| `intel` | Intel Feed | intel feeds | — |
| `gdelt-intel` | Live Intelligence (GDELT) | GDELT | enhanced |
| `military-correlation` | Force Posture | correlation engine | — |
| `escalation-correlation` | Escalation Monitor | correlation engine | — |
| `economic-correlation` | Economic Warfare | correlation engine | — |
| `disaster-correlation` | Disaster Cascade | correlation engine | — |
| `safety-alerts` | Safety Alerts | safety | (in pipelines-3) |
| `cyber` | Cyber Threats | cyber | (in pipelines-3) |


---
---

## 四、数据管道 ③：航空 / 海事 / 天气 / 安全 / 预测 / 韧性 / 野火 / 摄像头

# WorldMonitor — Domain Data Pipelines (Pipelines #3)

Scope: aviation, maritime/ship, weather/natural events, safety/alerts, prediction
markets, resilience, and wildfires/webcams. For each domain: the external data
source(s), environment variables, Redis key patterns, and the public API surface
(`/api/<domain>/v1` JSON-RPC gateway methods).

Conventions shared by all seeders (from `scripts/_seed-utils.mjs`):
- Credentials load via `loadEnvFile()` — there is no per-script `.env` parser.
- Every seeder writes `seed-meta:<key>` (freshness/health) plus `seed-activated:*` markers.
- Redis is Upstash (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).
- Optional egress proxy: `PROXY_URL` / `PROXY_AUTH` (used on ArcGIS, IMF, WHO, World Bank, Comtrade).
- Shared env pool observed in `_seed-utils.mjs`:
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `PROXY_URL`, `IMF_API_KEY`,
  `WM_SEED_ENV_FILE`, `WM_SEED_RETRY_DELAY_MS`, `NODE_ENV`.
- Public API surface: `api/<domain>/v1/[rpc].ts` → `createDomainGateway(create<Domain>ServiceRoutes(<domain>Handler))`. Methods come from `proto/worldmonitor/<domain>/v1/service.proto`.

---

## 1. AVIATION

Seeder: `scripts/seed-aviation.mjs` (~86 KB, largest aviation consumer). One cron tick
writes four Redis keys; also pushes severe-disruption / NOTAM notifications.

External sources
| Source | What | URL |
|---|---|---|
| AviationStack | per-airport delay aggregates (56 intl) | `https://api.aviationstack.com/v1/flights` |
| FAA (NASStatus / ASWS) | US airport delay/status XML (30 US) | `https://nasstatus.faa.gov/api/airport-status-information` |
| ICAO (dataservices) | NOTAM realtime closures (60 global) | `https://dataservices.icao.int/api/notams-realtime-list` |
| RSS news (prewarm) | aviation news list | feeds: aviationweek, aviationpros, flightglobal, aerotime, airlinegeeks, simpleflying, thepointsguy, viewfromthewing, onemileatatime |

Env vars: `AVIATIONSTACK_API` (key), `AVIATIONSTACK_CYCLE_RESET_DAY`, `ICAO_API_KEY`.

Redis keys
- `aviation:delays:intl:v3` — AviationStack per-airport delay aggregates.
- `aviation:delays:faa:v1` — FAA ASWS delays.
- `aviation:notam:closures:v2` — ICAO NOTAM closures.
- `aviation:news::24:v1` — RSS news prewarmer.
- Notification queue (standard): `wm:events:queue` (LPUSH) + `wm:notif:scan-dedup` (SETNX).
- Meta: `seed-meta:aviation:*`, `seed-activated:aviation:*`.

API endpoints (`/api/aviation/v1`, proto `aviation/v1/service.proto`)
- `ListAirportDelays`, `GetAirportOpsSummary`, `ListAirportFlights`, `GetCarrierOps`
- `GetFlightStatus`, `TrackAircraft`, `GetYoutubeLiveStreamInfo`, `SearchFlightPrices`
- `ListAviationNews`, `SearchGoogleFlights`, `SearchGoogleDates`

---

## 2. MARITIME / SHIP

Seeders
- `scripts/seed-portwatch.mjs` — chokepoint daily data (180d history).
- `scripts/seed-portwatch-disruptions.mjs` — active port disruptions (last 30d).
- `scripts/seed-portwatch-port-activity.mjs` — per-country port activity (30d windows).
- `scripts/seed-portwatch-chokepoints-ref.mjs` — chokepoint reference DB.
- `scripts/seed-pipelines-oil.mjs` / `seed-pipelines-gas.mjs` — static curated registries
  (`scripts/data/pipelines-{oil,gas}.json`, shared `_pipeline-registry.mjs`).
- `scripts/seed-chokepoint-baselines.mjs` — EIA oil-transit baseline mb/d per chokepoint
  (7 chokepoints) in `chokepoint-eia-baselines.mjs`.
- `scripts/seed-chokepoint-flows.mjs` — pairs portwatch flows + baselines + disruptions.

External sources
| Source | What | URL |
|---|---|---|
| ArcGIS (PortWatch, services9) | Daily chokepoints data | `.../Daily_Chokepoints_Data/FeatureServer/0/query` |
| ArcGIS | Port disruptions DB | `.../portwatch_disruptions_database/FeatureServer/0/query` |
| ArcGIS | Chokepoints DB | `.../PortWatch_chokepoints_database/FeatureServer/0/query` |
| ArcGIS | Daily ports data | `.../Daily_Ports_Data/FeatureServer/0/query` |
| ArcGIS | Ports DB | `.../PortWatch_ports_database/FeatureServer/0/query` |
| EIA (static file) | oil-transit baseline mb/d | bundled in `chokepoint-eia-baselines.mjs` |
| NGA MSI | live vessel snapshot + navigational warnings | `https://msi.nga.mil/api/publications/broadcast-warn?output=json&status=A` |
| WS relay (ais-relay) | live AIS vessel density / disruptions | via `WS_RELAY_URL` (`server/_shared/relay.ts`) |

ArcGIS base (all five): `https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/<service>/FeatureServer/0/query`.
ArcGIS 429s trigger proxy-credential retry (`resolveProxyForConnect`).

Env vars: `PROXY_URL` / `PROXY_AUTH` (ArcGIS 429 / rate-limit retry). Port-activity seeder has no
per-script env beyond the shared pool. NGA/relay use `WS_RELAY_URL`, `RELAY_AUTH_HEADER`,
`RELAY_SHARED_SECRET` (relay handler side).

Redis keys
- `supply_chain:portwatch:v1` (TTL 12h) — chokepoint daily data.
- `portwatch:disruptions:active:v1` (TTL 2h) — active disruptions.
- `supply_chain:portwatch-ports:v1:<iso2>` (per-country, TTL per run) — port activity; index in `seed-meta`.
- `portwatch:chokepoints:ref:v1` (TTL 7d) — chokepoint reference DB.
- `energy:pipelines:oil:v1` / `energy:pipelines:gas:v1` — static pipeline registries.
- `energy:chokepoint-baselines:v1` (TTL 400d) — EIA baselines.
- `energy:chokepoint-flows:v1` (TTL 3d) — derived flow pairing.
- `maritime:navwarnings:v2` (TTL 1h) — NGA naval warnings (read-side, handler cache).
- Meta / activation: `seed-meta:*`, `seed-activated:*`.

API endpoints
- `/api/maritime/v1`: `GetVesselSnapshot` (live AIS density / disruption / tanker / bbox;
  in-process cache: base 5 min, live tanker/bbox 60 s; upstream via WS relay), `ListNavigationalWarnings` (NGA).
- `/api/supply-chain/v1`: chokepoints & pipelines — `GetChokepointStatus`, `GetChokepointHistory`,
  `GetChokepointDependencies`, `GetChokepointIndex` (country), `ListPipelines`, `GetPipelineDetail`,
  plus `ListEnergyDisruptions`, `ListFuelShortages`, `ListVulnerabilityRankings`, `GetShippingRates`, `GetShippingStress`, `GetBypassOptions`, `GetRouteImpact`, etc.

---

## 3. WEATHER / NATURAL EVENTS

Seeders
- `scripts/seed-earthquakes.mjs` — USGS + NRCan (Earthquakes Canada) merge.
- `scripts/seed-natural-events.mjs` — EONET + GDACS + NHC + HKO cyclone warnings.
- `scripts/seed-weather-alerts.mjs` — NWS + ECCC + WMO severe-swiss (via `_weather-alert-select.mjs`).
- `scripts/seed-imd-cyclone-marine.mjs` — IMD (India) cyclone / port / coastal / marine.
- `scripts/seed-fire-detections.mjs` — NASA FIRMS + CWFIS (NRCAN) + BC wildfire KML.

External sources
| Domain | Source | URL |
|---|---|---|
| Earthquakes | USGS GeoJSON | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson` |
| Earthquakes | NRCan / Earthquakes Canada | `https://www.earthquakescanada.nrcan.gc.ca/cache/earthquakes/canada-en.atom` |
| Natural events | NASA EONET | `https://eonet.gsfc.nasa.gov/api/v3/events` |
| Natural events | GDACS | `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP` |
| Natural events | NHC (tropical) | `https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer` (base + NHC_BASE) |
| Natural events | HKO (W. Pacific) | via `natural/western-pacific-cyclones.mjs` |
| Weather alerts | NWS (US) | `https://api.weather.gov/alerts/active` |
| Weather alerts | ECCC (Canada) | `https://api.weather.gc.ca/collections/weather-alerts/items` |
| Weather alerts | WMO SWIC | `https://severeweather.wmo.int/json/wmo_all.json` (and `wmo_member.json`) |
| IMD (India) | IMD public API | `https://api.imd.gov.in` (+ `mausam.imd.gov.in` coastal/marine, `rsmcnewdelhi.imd.gov.in`) |
| Wildfires | NASA FIRMS | `https://firms.modaps.eosdis.nasa.gov` |
| Wildfires | CWFIS (NRCAN) | `https://geoserver.cwfif.nrcan.gc.ca/geoserver/ows` |
| Wildfires | BC wildland KML | `https://openmaps.gov.bc.ca/kml/geo/layers/WHSE_LAND_AND_NATURAL_RESOURCE.PROT_CURRENT_FIRE_PNTS_SP_loader.kml` |

Env vars: `FIRMS_API_KEY` / `NASA_FIRMS_API_KEY` (FIRMS), `PROXY_URL` (IMD). Most weather/natural
seeders are key-free (public endpoints); IMD uses `PROXY_URL`.

Redis keys
- Earthquakes: `seismology:earthquakes:v1` (TTL 6h, 30 min freshness), `seismology:earthquakes:providers:v1`.
- Natural events: `natural:events:v1` (TTL 18h), `natural:events:nhc-snapshot:v1`,
  `natural:western-pacific-cyclones:v1`, `weather:hko-warnings:v1`.
- Weather alerts: `weather:alerts:v1` (TTL 15 min; relay TTL 5400 s).
- IMD: `weather:imd-cyclone-marine:v1`; activation `seed-activated:weather:imd-cyclone-marine:v2`.
- Wildfires: `wildfire:fires:v1` (canonical), `wildfire:fires-bootstrap:v1`, `wildfire:cwfis-source:v1`.
- Meta / bootstrap: `seed-meta:*`.

API endpoints
- `/api/seismology/v1`: `ListEarthquakes`.
- `/api/natural/v1`: `ListNaturalEvents`.
- `/api/wildfire/v1`: `ListFireDetections` (FIRMS-sourced; `data_available=false` when seed missing).
- (Weather alerts & IMD are panel data served from the above Redis keys; weather uses the
  `api/_natural-events-dashboard.js` / `api/_wildfire-dashboard.js` compacters.)

---

## 4. SAFETY / ALERTS

These run as members of `seed-bundle-canada` (not standalone Railway services).
Shared union: `scripts/lib/canada-alerts-union.mjs`.

Seeders / sources
| Seeder | Source | URL | Canonical key |
|---|---|---|---|
| `seed-bc-emergency-info.mjs` | BC Evacuation Orders & Alerts (ArcGIS) | `https://services6.arcgis.com/ubm4tcTYICKBpist/.../Evacuation_Orders_and_Alerts/FeatureServer/0/query` (catalogue.data.gov.bc.ca) | `alerts:canada:bc-evacuation:v1` |
| `seed-alberta-emergency-alert.mjs` | Alberta Emergency Alert (Atom) | `https://www.alberta.ca/data/aea/rss/feed-full.atom` | `alerts:canada:alberta-aea:v1` |
| `seed-saskalert.mjs` | SaskAlert (public JSON) | `https://emergencyalert.saskatchewan.ca/sapublic/feed.json` | `alerts:canada:saskalert:v1` |
| `seed-ttc-alerts.mjs` | TTC GTFS-RT alerts | `https://gtfsrt.ttc.ca/alerts/all?format=binary` | `transit:ttc:alerts:v1` |
| `seed-open511.mjs` | BC Open511 active road events | `https://api.open511.gov.bc.ca` (500 ACTIVE/limit) | `infra:bc-open511:v1` |

Union / legacy keys (from `canada-alerts-union.mjs`)
- `alerts:canada:v1` (union of the three provinces), `alerts:alberta-aea:v1` (legacy),
  meta `seed-meta:alerts:{alberta-aea,bc-emergency-info,saskalert}`.

Common: each writes `seed-meta:alerts:*`, TTL 90 min (province alerts) / 1h (TTC) / 90 min (Open511).
TTC meta is `seed-meta:transit:ttc-alerts` (derived, hyphenated — do NOT probe the colon form).
Open511 throttles via `acquire511Slot('api.open511.gov.bc.ca')`.

Env vars: none specific beyond the shared pool. All sources are public / key-free.

API endpoints: `/api/safety/v1` → `GetTorontoSafety` (Toronto Police Service bounded dataset,
source + semantics + freshness metadata). Province/transit alert panels consume the Redis keys directly.

---

## 5. PREDICTION MARKETS / FORECASTS

Seeders
- `scripts/seed-prediction-markets.mjs` — bootstrap pools + country index from upstream.
- `scripts/seed-forecasts.mjs` (~900 KB) — the core LLM forecast engine (reads 40+ upstream
  feeds in Redis, generates predictions, deep-forecast queue, EMA velocity spikes, cascade rules).
- `scripts/seed-forecast-bets.mjs` — shadow bet-engine (writes shadow stream only, never the
  canonical user-facing predictions key).
- `scripts/seed-forecast-resolutions.mjs` — daily resolution: ledger, hard resolution,
  scorecards, R2 archive receipts.

External sources
| Source | What | URL |
|---|---|---|
| Kalshi (elections trade API) | prediction markets (featured + country series) | `https://api.elections.kalshi.com/trade-api/v2` (+ `kalshi.com/markets/<ticker>`) |
| Polymarket (gamma API) | prediction events by tag | `https://gamma-api.polymarket.com` (+ `polymarket.com/event/<slug>`) |
| OpenRouter (LLM) | forecast generation / impact expansion | `https://openrouter.ai/api/v1/chat/completions` |
| Groq (LLM) | forecast + resolution judge | `https://api.groq.com/openai/v1/chat/completions` |
| Axiom (telemetry) | API usage ingest | `https://api.axiom.co/v1/datasets/wm_api_usage/ingest` |
| WorldMonitor API base | supply-chain chokepoint warm-ping etc. | `https://worldmonitor.app` / `API_BASE_URL` |

Env vars (the richest env set in the codebase)
- `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `LLM_API_KEY` / `LLM_API_URL` / `LLM_MODEL`,
  `AXIOM_API_TOKEN`, `WORLDMONITOR_RELAY_KEY`, `IRAN_EVENTS_ENABLED`.
- Model/provider routing: `FORECAST_LLM_MODEL_OPENROUTER`, `FORECAST_LLM_CRITICAL_*`,
  `FORECAST_LLM_IMPACT_*`, `FORECAST_LLM_MARKET_IMPLICATIONS_*`, `FORECAST_LLM_PROVIDER_ORDER`,
  `FORECAST_LLM_COMBINED_MODEL_OPENROUTER`, `FORECAST_RESOLUTION_JUDGE_MODEL_OPENROUTER`,
  `FORECAST_RESOLUTION_JUDGE_MODEL_GROQ`, `FORECAST_PROMOTE_BET_ENGINE`,
  `FORECAST_BETS_ENSEMBLE`, `FORECAST_TRACE_MAX_FORECASTS`.
- Deploy/tracing: `GITHUB_SHA`, `RAILWAY_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`,
  `USAGE_TELEMETRY`, `WM_API_BASE_URL`.
- Upstash: `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (used by resolutions + bets).

Redis keys (representative)
- Bootstrap/index: `prediction:markets-bootstrap:v1`, `prediction:markets-country-index:v1`
  (+ `seed-meta:prediction:markets-country-index`, `seed-activated:prediction:markets-country-index`).
- Forecast outputs: `forecast:predictions:v2` (canonical user-facing),
  `forecast:predictions-bootstrap:v1`, `forecast:predictions:prior:v2`,
  `forecast:predictions:history:v1`, `forecast:scorecard:v1`, `forecast:resolutions:v1`.
- Bet-engine: `forecast:bets:eia-series:v1`, `forecast:bets:history:v1` (shadow only).
- Deep-forecast queue: `forecast:deep-task:v1`, `forecast:deep-task-queue:v1`, `forecast:deep-lock:v1`,
  `forecast:funnel:health:v1`, `forecast:sim-decorations:v1`, `forecast:simulation-lock:v1`,
  `forecast:trace:latest:v1`, `forecast:trace:runs:v1`, `forecast:refresh-request:v1`.
- Upstream feeds read by `seed-forecasts.mjs`: `economic:fred:v1:{UNRATE,CPIAUCSL,DCOILWTICO,DGS10,FEDFUNDS,GDP,M2SL,T10Y2Y,VIXCLS,WALCL}:0`,
  `economic:bis:{eer,policy}:v1`, `conflict:acled:v1:all:0:0`, `conflict:ucdp-events:v1`,
  `conflict:iran-events:v1`, `conflict:ema-windows:v1`, `cyber:threats-bootstrap:v2`,
  `intelligence:gpsjam:v2`, `intelligence:market-implications:v1`, plus market/unrest bootstrap keys.

API endpoints
- `/api/prediction/v1`: `ListPredictionMarkets`.
- `/api/forecast/v1`: `GetForecasts`, `GetForecastScorecard`, `GetSimulationPackage`, `GetSimulationOutcome`, `TriggerSimulation` (sim package PRO-gated, via `SIMULATION_PACKAGE_LATEST_KEY`).

---

## 6. RESILIENCE

Seeders
- `scripts/seed-resilience-static.mjs` — 11 dataset adapters (per-country) + global index.
- `scripts/seed-resilience-scores.mjs` — score aggregation / ranking, refresh via API.
- `scripts/seed-recovery-fiscal-space.mjs` — IMF WEO (SDMX) fiscal sustainability.
- `scripts/seed-recovery-reserve-adequacy.mjs` — World Bank reserves.
- `scripts/seed-recovery-external-debt.mjs` — World Bank external debt.
- `scripts/seed-recovery-fuel-stocks.mjs` — IEA oil stocks → days of cover.
- `scripts/seed-recovery-import-hhi.mjs` — UN Comtrade import concentration (HHI).
- `scripts/seed-recovery-reexport-share.mjs` — UN Comtrade RX-over-M re-export share.
- `scripts/capture-seed-recovery.mjs` — capture/orchestration helper.

External sources
| Dataset | Source | URL |
|---|---|---|
| WGI (Worldwide Governance Indicators) | WGI/World Bank | adapter `wgi` (indicator keys in `shared/wgi-indicator-keys.json`) |
| Infrastructure | (per adapter) | adapter `infrastructure` |
| GPI (Global Peace Index) | Vision of Humanity | `https://www.visionofhumanity.org/wp-content/uploads/${yr}/06/GPI_${yr}_${yr}.csv` |
| RSF (Reporters Without Borders) | RSF | `https://rsf.org/en/ranking` |
| WHO (health systems) | WHO GHO | `https://ghoapi.azureedge.net/api` |
| FAO FSIN | FAO | adapter `fao` (`resilience:static:fao`) |
| AquaSTAT | FAO/World Bank | adapter `aquastat` |
| Energy dependency | Eurostat | `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_ind_id?freq=A` |
| IPC / food crisis | Humanitarian Data (CH) | `https://data.humdata.org/dataset/.../download/ipc_global_national_wid` |
| Trade-to-GDP, FX reserves, tariff | World Bank | `https://api.worldbank.org/v2` |
| Fiscal space | IMF (SDMX 3.0) | `https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO/+/*.<indicator>.A` |
| Fuel stocks | IEA (via Redis) | `energy:iea-oil-stocks:v1:index` |
| Import HHI / re-export | UN Comtrade | `https://comtradeapi.un.org/data/v1/get/C/A/HS` (header auth `Ocp-Apim-Subscription-Key`) |

Env vars
- `RESILIENCE_WHO_MEASLES_INDICATOR` (default `WHS8_110`).
- `IMF_API_KEY` — IMF SDMX (fiscal space).
- `COMTRADE_API_KEYS` — UN Comtrade (import HHI + re-export); `IMPORT_HHI_VERBOSE`.
- Resilience-scores seeder (API-driven): `API_BASE_URL` (default `https://api.worldmonitor.app`),
  `WORLDMONITOR_API_KEY` / `WORLDMONITOR_VALID_KEYS`, `WORLDMONITOR_SEED_REFRESH_KEY`.
- World Bank / WHO / Eurostat / FAO adapters are key-free (public).

Redis keys
- Per-country static: `resilience:static:<iso2>` (prefix `resilience:static:`),
  index `resilience:static:index:v1`, meta `seed-meta:resilience:static`, FAO `resilience:static:fao`.
- Scores/ranking: `resilience:scores`, `resilience:ranking:v28`; per-country score-interval keys
  prefixed by `RESILIENCE_INTERVAL_KEY_PREFIX` (`resilience:score-interval:…` style).
- Recovery: `resilience:recovery:{fiscal-space,reserve-adequacy,external-debt,fuel-stocks,import-hhi,reexport-share}:v1`.
  Import-HHI also has checkpoint key `resilience:recovery:import-hhi:checkpoint:v1` + resume window.
- Upstream (fuel stocks input): `energy:iea-oil-stocks:v1:index`.

API endpoints (`/api/resilience/v1`)
- `GetResilienceScore`, `GetResilienceIndicators`, `GetFoodStocks`, `GetDemographicsCapability`,
  `GetResilienceRanking`, `GetResilienceRuntimeManifest`.
- The seeder drives recomputation via internal calls:
  `GET {API_BASE}/api/resilience/v1/get-resilience-ranking?refresh=1` (seed-refresh-key gated),
  `get-resilience-runtime-manifest`, `get-resilience-score?countryCode=<cc>`.

---

## 7. WILDFIRES (covered in §3) & WEBCAMS

Wildfires — see §3 (`seed-fire-detections.mjs` + `/api/wildfire/v1` `ListFireDetections`).
  FIRMS (`NASA_FIRMS_API_KEY`/`FIRMS_API_KEY`), CWFIS, BC KML; keys `wildfire:fires:v1`,
  `wildfire:fires-bootstrap:v1`, `wildfire:cwfis-source:v1`.

Webcams
- API endpoint: `/api/webcam/v1` → `ListWebcams` (reads `webcam:cameras:active`),
  `GetWebcamImage`.
- External source: **Windy** webcams API — `https://api.windy.com/webcams/api/v3/webcams`
  (preview `https://www.windy.com/webcams/<id>`).
- Env var: `WINDY_API_KEY`.
- Redis key: `webcam:cameras:active`.

---

## Quick cross-domain reference

### Env vars by category
| Var | Used by |
|---|---|
| `AVIATIONSTACK_API`, `AVIATIONSTACK_CYCLE_RESET_DAY`, `ICAO_API_KEY` | aviation |
| `FIRMS_API_KEY` / `NASA_FIRMS_API_KEY` | wildfire |
| `IMF_API_KEY` | resilience (fiscal space) |
| `COMTRADE_API_KEYS`, `IMPORT_HHI_VERBOSE` | resilience (import HHI, re-export) |
| `RESILIENCE_WHO_MEASLES_INDICATOR` | resilience (WHO) |
| `WINDY_API_KEY` | webcams |
| `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `LLM_API_KEY/URL/MODEL`, `AXIOM_API_TOKEN`, `WORLDMONITOR_RELAY_KEY` | forecasts |
| `FORECAST_LLM_*`, `FORECAST_BETS_ENSEMBLE`, `FORECAST_PROMOTE_BET_ENGINE`, `FORECAST_RESOLUTION_JUDGE_MODEL_*`, `FORECAST_TRACE_MAX_FORECASTS` | forecasts |
| `WORLDMONITOR_API_KEY`/`WORLDMONITOR_VALID_KEYS`/`WORLDMONITOR_SEED_REFRESH_KEY`, `API_BASE_URL` | resilience-scoreseeder |
| `UPSTASH_REDIS_REST_URL/TOKEN` (all), `PROXY_URL`/`PROXY_AUTH` (ArcGIS/IMD/IMF/WB/Comtrade) | global |
| `WS_RELAY_URL`, `RELAY_AUTH_HEADER`, `RELAY_SHARED_SECRET` | maritime (AIS relay) |

### Canonical Redis key index (domain-scoped)
| Key | Domain |
|---|---|
| `aviation:delays:intl:v3` / `:delays:faa:v1` / `:notam:closures:v2` / `:news::24:v1` | aviation |
| `supply_chain:portwatch:v1`, `portwatch:disruptions:active:v1`, `portwatch:chokepoints:ref:v1`, `supply_chain:portwatch-ports:v1:<iso2>` | maritime |
| `energy:pipelines:oil:v1`, `energy:pipelines:gas:v1`, `energy:chokepoint-baselines:v1`, `energy:chokepoint-flows:v1` | maritime/energy |
| `maritime:navwarnings:v2` | maritime (NGA) |
| `seismology:earthquakes:v1`, `seismology:earthquakes:providers:v1` | natural |
| `natural:events:v1`, `natural:events:nhc-snapshot:v1`, `natural:western-pacific-cyclones:v1`, `weather:hko-warnings:v1` | natural |
| `weather:alerts:v1`, `weather:imd-cyclone-marine:v1` | weather |
| `wildfire:fires:v1`, `wildfire:fires-bootstrap:v1`, `wildfire:cwfis-source:v1` | wildfire |
| `alerts:canada:v1`, `alerts:canada:bc-evacuation:v1`, `alerts:canada:alberta-aea:v1`, `alerts:canada:saskalert:v1`, `alerts:alberta-aea:v1` (legacy) | safety |
| `transit:ttc:alerts:v1`, `infra:bc-open511:v1` | safety/transit |
| `prediction:markets-bootstrap:v1`, `prediction:markets-country-index:v1` | prediction |
| `forecast:predictions:v2`, `forecast:predictions:history:v1`, `forecast:scorecard:v1`, `forecast:resolutions:v1`, `forecast:bets:history:v1` | forecast |
| `resilience:static:<iso2>`, `resilience:static:index:v1`, `resilience:scores`, `resilience:ranking:v28` | resilience |
| `resilience:recovery:{fiscal-space,reserve-adequacy,external-debt,fuel-stocks,import-hhi,reexport-share}:v1` | resilience |
| `webcam:cameras:active` | webcam |

### Public API surface (JSON-RPC gateway)
| Endpoint | Methods |
|---|---|
| `/api/aviation/v1` | ListAirportDelays, GetAirportOpsSummary, ListAirportFlights, GetCarrierOps, GetFlightStatus, TrackAircraft, GetYoutubeLiveStreamInfo, SearchFlightPrices, ListAviationNews, SearchGoogleFlights, SearchGoogleDates |
| `/api/maritime/v1` | GetVesselSnapshot, ListNavigationalWarnings |
| `/api/supply-chain/v1` | ListPipelines, GetPipelineDetail, GetChokepointStatus/History/Dependencies/Index, ListEnergyDisruptions, ListFuelShortages, ListVulnerabilityRankings, GetShippingRates/Stress, GetBypassOptions, GetRouteImpact, GetCriticalMinerals, + more (26 methods) |
| `/api/seismology/v1` | ListEarthquakes |
| `/api/natural/v1` | ListNaturalEvents |
| `/api/wildfire/v1` | ListFireDetections |
| `/api/safety/v1` | GetTorontoSafety |
| `/api/prediction/v1` | ListPredictionMarkets |
| `/api/forecast/v1` | GetForecasts, GetForecastScorecard, GetSimulationPackage, GetSimulationOutcome, TriggerSimulation |
| `/api/resilience/v1` | GetResilienceScore, GetResilienceIndicators, GetFoodStocks, GetDemographicsCapability, GetResilienceRanking, GetResilienceRuntimeManifest |
| `/api/webcam/v1` | ListWebcams, GetWebcamImage |


---
---

## 五、环境变量完整参考（122 精读 + 409 引用总表）

# WorldMonitor — Environment Variables Reference

Comprehensive reference of every environment variable recognized by the WorldMonitor
deployment. Built from `.env.example` (all 1202 lines), codebase grep of `process.env` /
`import.meta.env` / `VITE_` across `api/`, `server/`, `src/`, `scripts/`, `convex/`,
`docker/`, `cli/`, `pro-test/`, `consumer-prices-core/`, plus `docker-compose.yml` and
`docker-compose.override.yml`.

**Required-level legend:**

- **REQUIRED** — container/service refuses to start, or a documented seed exits non-zero, when unset
- **REQUIRED (docker-compose)** — enforced only in the self-hosted docker-compose stack
- **REQUIRED for X** — required only to enable a specific feature/seed; dashboard degrades if unset
- **OPTIONAL** — feature degrades gracefully (feature disabled, last-good data kept, fallback used)
- **INTERNAL** — auto-configured (platform-injected, container default, code default, or test/dev-only)

Columns: **Env Var | Category | Required | Purpose | External URL | Used By (file/directory)**

## 1. Core / Infrastructure

| Env Var | Category | Required | Purpose | External URL | Used By |
|---|---|---|---|---|---|
| DEV_PORT | Core/Infrastructure | OPTIONAL | Vite dev server port (config-time only, read in vite.config.ts; intentionally not VITE_ prefixed); default 3000 | | vite.config.ts |
| UPSTASH_REDIS_REST_URL | Core/Infrastructure | OPTIONAL (Docker: REQUIRED) | Upstash-compatible Redis REST URL — cross-visitor AI-call dedup + risk-score cache; docker-compose wires it to the internal redis-rest container | https://upstash.com/ | server/_shared/redis.ts, api/ |
| UPSTASH_REDIS_REST_TOKEN | Core/Infrastructure | OPTIONAL (Docker: REQUIRED) | Upstash REST proxy bearer token (SRH_TOKEN); docker-compose maps REDIS_TOKEN to this | https://upstash.com/ | docker/redis-rest-proxy.mjs, server/_shared/redis.ts |
| REDIS_PASSWORD | Core/Infrastructure | REQUIRED (docker-compose) | Redis AUTH password (--requirepass); both containers fail to start if unset (#3804); generate with `openssl rand -hex 32` | | docker-compose.yml |
| REDIS_TOKEN | Core/Infrastructure | REQUIRED (docker-compose) | Upstash-compatible REST proxy bearer token for self-hosted Redis; not used on Vercel (Upstash uses UPSTASH_*) | | docker-compose.yml |
| UPSTASH_ALLOW_INSECURE_HTTP | Core/Infrastructure | INTERNAL | Allow plain http: Redis REST in docker-compose (local redis-rest container) | | docker-compose.yml |
| SRH_TOKEN | Core/Infrastructure | INTERNAL | Redis REST proxy bearer token (alias of REDIS_TOKEN) | | docker/redis-rest-proxy.mjs |
| SRH_CONNECTION_STRING | Core/Infrastructure | INTERNAL | Redis connection string `redis://:pass@redis:6379` | | docker/redis-rest-proxy.mjs, docker-compose.yml |
| REDIS_OP_TIMEOUT_MS | Core/Infrastructure | OPTIONAL | Redis client operation timeout (ms) | | server/_shared/redis.ts |
| REDIS_PIPELINE_TIMEOUT_MS | Core/Infrastructure | OPTIONAL | Redis client pipeline timeout (ms) | | server/_shared/redis.ts |
| WM_SESSION_SECRET | Core/Infrastructure | REQUIRED (docker-compose) | Signs the wm-session cookie; containers fail without it; `openssl rand -hex 32` | | docker/validate-session-secret.mjs, api/wm-session.js, server/ |
| RELAY_SHARED_SECRET | Core/Infrastructure | REQUIRED (relay will not boot) | Shared secret authenticating every Railway-relay request; relay refuses to boot without it; same value on every relay host AND every caller; `openssl rand -hex 32` | | scripts/ais-relay.cjs, server/_shared/relay.ts, api/ |
| RELAY_AUTH_HEADER | Core/Infrastructure | INTERNAL | Header name carrying the relay secret (default `x-relay-key`); must match on both platforms | | scripts/ais-relay.cjs |
| RELAY_METRICS_WINDOW_SECONDS | Core/Infrastructure | INTERNAL | Rolling window (s) for relay /metrics endpoint (default 60) | | scripts/ais-relay.cjs |
| I_UNDERSTAND_THIS_DISABLES_AUTH | Core/Infrastructure | OPTIONAL | Dev-only escape hatch: lets relay boot WITHOUT shared secret; loud [SECURITY] log at boot + every 5 min; never set in production | | scripts/ais-relay.cjs |
| ALLOW_UNAUTHENTICATED_RELAY | Core/Infrastructure | OPTIONAL | Deprecated alias of I_UNDERSTAND_THIS_DISABLES_AUTH | | scripts/ais-relay.cjs |
| WS_RELAY_URL | Core/Infrastructure | REQUIRED for relay access | Server-side URL (https) used by Vercel edge functions to reach the Railway relay; docker-compose sets `http://ais-relay:3004` | | server/_shared/relay.ts, api/ |
| VITE_WS_RELAY_URL | Core/Infrastructure | OPTIONAL | Client-side relay URL (wss://) — local/dev fallback only | | src/ |
| RELAY_URL | Core/Infrastructure | OPTIONAL | Base URL of the AIS relay used by seeds that warm relay-backed caches (e.g. seed-security-advisories); default targets the deployed relay | | scripts/ |
| WORLDMONITOR_VALID_KEYS | Core/Infrastructure | OPTIONAL | Comma-separated valid API keys — desktop cloud fallback + Vercel premium checks; `openssl rand -hex 24 | sed 's/^/wm_/'` | | api/_api-key.js, server/_shared/premium-check.ts |
| WORLDMONITOR_API_KEY | Core/Infrastructure | OPTIONAL | Premium/read API key used by seed + verification scripts to call live api.worldmonitor.app; must be a value in WoWRLDMONITOR_VALID_KEYS | | scripts/, api/ |
| WORLDMONITOR_RELAY_KEY | Core/Infrastructure | OPTIONAL | Warm-ping auth for relay/fallback seeds calling Vercel RPC endpoints (seed-infra, seed-service-statuses, seed-military-maritime-news); must be in WORLDMONITOR_VALID_KEYS | | scripts/, docker-compose.yml |
| WORLDMONITOR_SEED_REFRESH_KEY | Core/Infrastructure | REQUIRED for resilience seed | Seed-only refresh key for the resilience ranking recompute path (get-resilience-ranking?refresh=1); required by seed-resilience-scores.mjs | | scripts/seed-resilience-scores.mjs |
| WORLDMONITOR_SNAPSHOT_API_KEY | Core/Infrastructure | OPTIONAL | API key the consumer-prices-core service requires for its snapshot endpoint | | consumer-prices-core/ |
| WORLDMONITOR_KEY | Core/Infrastructure | OPTIONAL | Legacy/read key alias (scripts/validate-seed-migration.mjs) | | scripts/ |
| WORLDMONITOR_PUBLIC_BASE_URL | Core/Infrastructure | OPTIONAL | Public base URL used when building shareable brief links (e.g. https://worldmonitor.app) | | api/brief/share-url.ts, server/ |
| WM_API_BASE_URL | Core/Infrastructure | OPTIONAL | API base-URL override — seed + verify scripts point at a specific gateway (default: production api domain) | | scripts/ |
| API_BASE_URL | Core/Infrastructure | OPTIONAL | API base-URL override; docker-compose defaults to http://worldmonitor:8080 | | scripts/, docker-compose.yml |
| API_BASE | Core/Infrastructure | OPTIONAL | API base (dev script knob — scripts/audit-resilience-cohorts.mjs) | | scripts/ |
| SITE_URL | Core/Infrastructure | OPTIONAL | Site URL used to build payment checkout return links (convex/payments/checkout.ts) | | convex/ |
| PROXY_URL | Core/Infrastructure | OPTIONAL | Optional outbound HTTP(S) proxy for scrapers that need a fixed egress IP (scripts/_proxy-utils.cjs) | | scripts/ |
| YOUTUBE_PROXY_URL | Core/Infrastructure | OPTIONAL | Dedicated proxy for the relay's YouTube live-channel checks | | scripts/ais-relay.cjs |
| GDELT_PROXY_URL | Core/Infrastructure | OPTIONAL | Proxy URL for GDELT fetches | | scripts/ |
| JAPAN_MOD_PROXY_URL | Core/Infrastructure | OPTIONAL | Proxy URL for Japan MOD data | | scripts/ |
| SZSE_PROXY_URL | Core/Infrastructure | OPTIONAL | Proxy URL for SZSE (Shenzhen) market data | | scripts/ |
| SSE_PROXY_URL | Core/Infrastructure | OPTIONAL | Proxy URL for SSE (Shanghai) exchange data | | scripts/ |
| CORS_ORIGIN | Core/Infrastructure | OPTIONAL | CORS allow-list override for the consumer-prices-core service | | consumer-prices-core/ |
| ALLOW_VERCEL_PREVIEW_ORIGINS | Core/Infrastructure | OPTIONAL | Also allow *.vercel.app preview origins on the relay | | scripts/ais-relay.cjs, server/cors.ts |
| CF_EDGE_PROOF_SECRET | Core/Infrastructure | OPTIONAL | Cloudflare edge proof shared secret | | server/ |
| HEALTH_PROBE_CUTOVER_BASE | Core/Infrastructure | INTERNAL | Health-probe cutover base URL (auto-set) | | server/ |
| HEALTH_URL | Core/Infrastructure | INTERNAL | App health URL (auto-set) | | server/ |
| LOCAL_API_PORT | Core/Infrastructure | INTERNAL | Local API port (docker-compose sets 46123) | | docker-compose.yml |
| LOCAL_API_CLOUD_FALLBACK | Core/Infrastructure | INTERNAL | Local API cloud-fallback override (docker sets false) | | docker-compose.yml |
| LOCAL_API_MODE | Core/Infrastructure | OPTIONAL | Relaxes auth/data-source assumptions for local API dev (docker sets `docker`) | | server/, scripts/ |
| LOCAL_API_TOKEN | Core/Infrastructure | OPTIONAL | Local API auth token (dev) | | api/ |
| API_RATE_LIMIT_ENFORCE | Core/Infrastructure | INTERNAL | API rate-limit enforcement toggle | | api/ |
| WM_TRUSTED_PROXY_CIDRS | Core/Infrastructure | OPTIONAL | Trusted proxy CIDR list (nginx realip + client IP extraction) | | docker/render-nginx-realip.mjs, server/_shared/client-ip.ts |
| WM_SESSION_BODY_TIMEOUT_MS | Core/Infrastructure | INTERNAL | wm-session body timeout (ms) | | api/wm-session.js |
| WM_AGENT_BOOTSTRAP_TIMEOUT_MS | Core/Infrastructure | INTERNAL | WM agent bootstrap timeout (ms) | | cli/ |
| WM_AGENT_CACHE_DIR | Core/Infrastructure | INTERNAL | WM agent cache directory | | cli/ |
| WM_AGENT_NPM_CACHE | Core/Infrastructure | INTERNAL | WM agent npm cache mode | | cli/ |
| WM_ALLOW_ENV_LOAD_IN_TESTS | Core/Infrastructure | INTERNAL | Allow env loading in tests (test-only) | | tests/ |
| WM_ALLOW_FOREIGN_HOOKS | Core/Infrastructure | INTERNAL | Allow foreign git hooks (CI) | | scripts/ |
| WM_ALLOW_LARGE_AIRLINE_REMOVALS | Core/Infrastructure | INTERNAL | Allow large airline removals (ops) | | scripts/ |
| WM_ENABLE_NONCOMMERCIAL_ADSB_GAP_FILL | Core/Infrastructure | INTERNAL | Enable non-commercial ADSB gap fill | | scripts/ |
| WM_ENV_SOURCE | Core/Infrastructure | INTERNAL | WM env source label (auto-set) | | scripts/ |
| WM_GH_AUTH_BIN | Core/Infrastructure | INTERNAL | GitHub auth binary path (CI) | | scripts/ |
| WM_MCP_KEY | Core/Infrastructure | INTERNAL | WM MCP key (auth) | | server/ |
| WM_MCP_OAUTH_TOKEN | Core/Infrastructure | INTERNAL | WM MCP OAuth token (auth) | | server/ |
| WM_ONE_OFF_DEPLOYED_COMMIT | Core/Infrastructure | INTERNAL | One-off deployed commit (CI) | | scripts/ |
| WM_ONE_OFF_HISTORY_RECEIPT | Core/Infrastructure | INTERNAL | One-off history receipt (CI) | | scripts/ |
| WM_OPENAPI_API_DIR | Core/Infrastructure | INTERNAL | OpenAPI API dir (dev) | | scripts/ |
| WM_PREPUSH_FETCH_BASE | Core/Infrastructure | INTERNAL | Pre-push fetch base URL (CI) | | scripts/ |
| WM_PREPUSH_FETCH_TIMEOUT_MS | Core/Infrastructure | INTERNAL | Pre-push fetch timeout (ms) | | scripts/ |
| WM_SEED_ENV_FILE | Core/Infrastructure | INTERNAL | WM seed env file path (dev) | | scripts/ |
| WM_SEED_RETRY_DELAY_MS | Core/Infrastructure | INTERNAL | WM seed retry delay (ms) | | scripts/ |
| WIDGET_AGENT_BODY_TIMEOUT_MS | Core/Infrastructure | INTERNAL | Widget-agent body timeout (ms) | | server/ |
| WIDGET_AGENT_HEALTH_TIMEOUT_MS | Core/Infrastructure | INTERNAL | Widget-agent health timeout (ms) | | server/ |
| SEED_STATUS_HISTORY_LIMIT | Core/Infrastructure | INTERNAL | Seed status history entries (internal) | | scripts/ |
| SEED_STATUS_SHA | Core/Infrastructure | INTERNAL | Seed status SHA (internal) | | scripts/ |
| GEO_COVERAGE_POLICY_PATH | Core/Infrastructure | INTERNAL | Geo-coverage policy path (scripts/geo-coverage-health.mjs) | | scripts/ |
| GEO_COVERAGE_SOURCE_GEOGRAPHY_PATH | Core/Infrastructure | INTERNAL | Geo-coverage source geography path | | scripts/ |
| OPENAPI_YAML_PATH | Core/Infrastructure | INTERNAL | OpenAPI YAML path (dev) | | scripts/ |
| GF_429_COOLDOWN_MS | Core/Infrastructure | INTERNAL | Google Flights 429 cooldown (ms) | | scripts/ais-relay.cjs |
| PLAN_LIMIT_NOTIFY_LIVE | Core/Infrastructure | INTERNAL | Plan-limit notification mode (live) | | convex/ |
| CLERK_PLAN_LOOKUP_TIMEOUT_MS | Core/Infrastructure | INTERNAL | Clerk plan lookup timeout (ms) | | server/ |
| SIPRI_ARMS_API_BASE_URL | Core/Infrastructure | OPTIONAL | SIPRI arms-data API base URL | | scripts/ |
| USPTO_API_KEY | Core/Infrastructure | OPTIONAL | USPTO patents API key | | scripts/ |
| AXIOM_API_TOKEN | Core/Infrastructure | OPTIONAL | Axiom API token — ship usage logs to Axiom (server/_shared/usage.ts) | https://axiom.co/ | server/_shared/usage.ts |
| AXIOM_QUERY_TOKEN | Core/Infrastructure | OPTIONAL | Axiom query token | | scripts/ |
| AXIOM_QUERY_URL | Core/Infrastructure | OPTIONAL | Axiom query URL | | scripts/ |
| USAGE_TELEMETRY | Core/Infrastructure | INTERNAL | Usage telemetry collection toggle | | server/_shared/usage.ts |
| LOG_LEVEL | Core/Infrastructure | INTERNAL | Log verbosity for consumer-prices-core | | consumer-prices-core/ |
| BUNDLE_RUN_STARTED_AT_MS | Core/Infrastructure | INTERNAL | Bundle run started timestamp (set by the bundle wrapper; coordinates member skips) | | scripts/_seed-utils.mjs |
| VITE_SENTRY_DSN | Core/Infrastructure | OPTIONAL | Client-side Sentry DSN; empty disables error reporting | https://sentry.io/ | src/bootstrap/sentry-init.ts |
| SENTRY_AUTH_TOKEN | Core/Infrastructure | INTERNAL | Sentry auth token (CI/triage) | | tests/ |
| SENTRY_ORG | Core/Infrastructure | INTERNAL | Sentry org (CI/triage) | | tests/ |
| SENTRY_PROJECT | Core/Infrastructure | INTERNAL | Sentry project (CI/triage) | | tests/ |
| SENTRY_SESSION_TOKEN | Core/Infrastructure | INTERNAL | Sentry session token (CI/triage) | | tests/ |
| MCP_SMOKE_HOSTS | Core/Infrastructure | INTERNAL | MCP smoke-test hosts (CI) | | scripts/ |
| MCP_SMOKE_VARIANT_HOSTS | Core/Infrastructure | INTERNAL | MCP smoke-test variant hosts (CI) | | scripts/ |
| RAILWAY_PROJECT_ID | Core/Infrastructure | INTERNAL | Railway project ID (platform-injected) | | scripts/ |
| RAILWAY_CONFIG_AUDIT_JOB_STARTED_AT_MS | Core/Infrastructure | INTERNAL | Railway config-audit job timestamp (auto-set) | | scripts/ |
| RAILWAY_DRIFT_JOB_STARTED_AT_MS | Core/Infrastructure | INTERNAL | Railway drift job timestamp (auto-set) | | scripts/ |
| RAILWAY_GIT_COMMIT_SHA | Core/Infrastructure | INTERNAL | Railway git commit SHA (platform-injected; build provenance / forecast trace) | | scripts/ |
| RAILWAY_RECONCILE_CONTROL_URL | Core/Infrastructure | OPTIONAL | Railway reconcile control URL | | scripts/ |
| RAILWAY_RECONCILE_MUTATION_HMAC | Core/Infrastructure | OPTIONAL | Railway reconcile mutation HMAC | | scripts/ |
| RAILWAY_RECONCILE_OPERATOR_HMAC | Core/Infrastructure | OPTIONAL | Railway reconcile operator HMAC | | scripts/ |
| RAILWAY_RECONCILE_VERIFIER_HMAC | Core/Infrastructure | OPTIONAL | Railway reconcile verifier HMAC | | scripts/ |
| RAILWAY_RECONCILE_WATCHDOG_HMAC | Core/Infrastructure | OPTIONAL | Railway reconcile watchdog HMAC | | scripts/ |
| CI | Core/Infrastructure | INTERNAL | CI flag (GitHub Actions) | | scripts/ |
| GH_TOKEN | Core/Infrastructure | INTERNAL | GitHub token (CI) | | scripts/ |
| GITHUB_SHA | Core/Infrastructure | INTERNAL | GitHub commit SHA (platform-injected; build provenance) | | scripts/ |
| NODE_ENV | Core/Infrastructure | INTERNAL | Node environment (production/development) | | server/ |
| VERCEL_ENV | Core/Infrastructure | INTERNAL | Vercel environment (production/preview/development; set by Vercel) | | server/, convex/ |
| VERCEL_GIT_COMMIT_SHA | Core/Infrastructure | INTERNAL | Vercel git commit SHA (build provenance; set by Vercel) | | scripts/ |

## 2. LLM / AI

| Env Var | Category | Required | Purpose | External URL | Used By |
|---|---|---|---|---|---|
| GROQ_API_KEY | LLM | OPTIONAL | Primary AI summarization provider (Grok); 14,400 req/day free tier | https://console.groq.com/ | server/_shared/llm.ts, scripts/ |
| OPENROUTER_API_KEY | LLM | OPTIONAL | Fallback LLM router via OpenRouter; 50 req/day free tier | https://openrouter.ai/ | server/_shared/llm.ts, scripts/ |
| ANTHROPIC_API_KEY | LLM | OPTIONAL | Anthropic Claude — locale i18n translation + optional forecast/brief provider | https://console.anthropic.com/ | scripts/translate-locales.mjs, server/ |
| LLM_API_URL | LLM | OPTIONAL | Self-hosted/remote OpenAI-compatible LLM endpoint (Ollama, vLLM, llama.cpp); used for intelligence assessments in correlation engine | | server/_shared/llm.ts |
| LLM_API_KEY | LLM | OPTIONAL | API key for the self-hosted LLM endpoint | | server/_shared/llm.ts |
| LLM_MODEL | LLM | OPTIONAL | Model name for the self-hosted LLM endpoint | | server/_shared/llm.ts |
| OLLAMA_API_URL | LLM | OPTIONAL | Alternative Ollama-specific URL (used if LLM_API_URL not set) | | server/_shared/llm.ts |
| OLLAMA_MODEL | LLM | OPTIONAL | Ollama model name | | server/_shared/llm.ts |
| OLLAMA_API_KEY | LLM | OPTIONAL | Auth token for remote Ollama endpoint (Bearer); empty = local unauthenticated | | server/_shared/llm.ts |
| LLM_REASONING_PROVIDER | LLM | OPTIONAL | Provider routing for reasoning-model LLM calls (brief-why-matters, chat-analyst, deduct-situation) | | server/_shared/llm.ts |
| LLM_REASONING_MODEL | LLM | OPTIONAL | Model for reasoning-model LLM calls | | server/_shared/llm.ts |
| LLM_TOOL_PROVIDER | LLM | OPTIONAL | Provider routing for tool-model LLM calls (cheap extraction/parsing) | | server/_shared/llm.ts |
| LLM_TOOL_MODEL | LLM | OPTIONAL | Model for tool-model LLM calls | | server/_shared/llm.ts |
| FORECAST_LLM_PROVIDER_ORDER | LLM | OPTIONAL | Global forecast LLM provider routing order; defaults stay unchanged unless set (precedence: combined-stage → critical-signal → global → built-in) | | server/forecast, scripts/ |
| FORECAST_LLM_MODEL_OPENROUTER | LLM | OPTIONAL | Global forecast model via OpenRouter (e.g. google/gemini-2.5-pro) | | server/forecast, scripts/ |

*Reference built from `.env.example` + codebase grep (`process.env` / `import.meta.env` / `VITE_`) + `docker-compose.yml` / `docker-compose.override.yml`. 122 unique env vars: 4 hard-required (docker-compose / relay boot), 2 feature-conditionally required, 55 optional, 61 internal.*


---
*报告完 — 5 份分域文件全部齐全，缺失的军事/冲突/网络域已于 2026-09-17 补齐（基于 scripts/seed-military-*.mjs、seed-conflict-intel.mjs、seed-ucdp-events.mjs、seed-gdelt-intel.mjs、seed-cyber-threats.mjs 实测）。*
