# A · 海外业务安全咨询（`security` variant）前端设计

> 状态：第 1 节（共 7 节，按节确认）
> 日期：2026-10-14
> 对应方案：纯增量（不改 WM 核心文件）

---

## 1. 目标 · 用户 · 边界

### 1.1 一句话目标

`security` variant 是产品 A「海外业务安全咨询」的前端：把 WM 已有的"地缘安全"六面板（军事 / 冲突 / 气候 / 船舶 / 航空 / 网络威胁）**全保留**，在这之上铺一层"国别风险热力台 + 制裁筛选 + AI 简报"门面，让客户能在 30 秒内对一个国家得出"该不该去 / 能不能做生意"的可操作判断。

### 1.2 目标用户

| 角色 | 场景 | 一周使用频率 |
|---|---|---|
| 海外项目负责人 | 出差前查目的国风险 | 1-3 次 |
| 跨国公司差旅合规 | 团组行程风险评估 | 5-10 次 |
| 海外业务 BD | 谈判国制裁/限制筛查 | 2-5 次 |
| 顾问/律所 | 客户提问"X 国怎么样" | 每日 5+ |

### 1.3 显式边界

**做**：
- 复用 globe.gl + deck.gl + 高德底瓦片（已确定）
- 复用 WM `CountryBriefPanel` / `CountryBriefOutput` / `CountryDeepDivePanel`（国别详情）
- 复用 zh-collector 数据层（PG `wm` 库 + WM-redis `zh:news:*:v1`）
- i18n 补 `src/locales/zh.json`（约 100 词术语）

**不做**：
- 不删 6 面板中任何一个（用户硬约束）
- 不改 `src/config/panels.ts` / `src/app/panel-enablement.ts` / `src/config/variant.ts` 等 WM 核心文件
- 不动 WM 原生 `CountryBriefPanel` 内部实现（只新增"打开方式"和"前置门厅"）
- 不接第三方地图（只用 globe.gl + 高德）
- 不集成 BettaFish（GPL-2.0；与第 1 章决策一致）
- 不做 Telegram 机器人 / 公众号（与产品方案一致）
- 不做多租户 / 域名 / HTTPS（属 W7-W8 范围，本 spec 不覆盖）

### 1.4 与产品方案 / 文档的关系

| 来源 | 角色 |
|---|---|
| `worldmonitor-product-plan.md` v1.0 | 商业决策基线（A 是什么、为什么、合规红线）|
| `/opt/worldmonitor-upgrade-plan/` 第 1/9 章 | 设计思路来源（不照抄 React+Tailwind 代码）|
| `OpencodetestLog.md` | 已落地的 zh-collector 状态（C.1 跑通；PG/Redis 双写）|
| 本 spec | 仅覆盖**前端**；后端 / zh-collector 改动单独提 |

### 1.5 验收（粗粒度，第 6 节细化）

- ✅ `SITE_VARIANTS` 加 `'security'`（唯一改动在 `src/config/variant.ts` 旁添加新 variant 文件，**不动** `variant.ts` 本体）
- ✅ 打开 `?variant=security` 看到：3D 地球 + 6 面板全在 + 新增"国别风险热力"层
- ✅ 点任一国家 → 打开 `CountryBriefPage`（中文 i18n 已补）
- ✅ 详情页可触发 AI 简报（SSE 走 WM 原链路）
- ✅ 五套制裁筛选器（OFAC/EU/UN/UK/MOFCOM）作为可勾选 filter

---

## 2. 信息架构与路由

### 2.1 路由（保持 WM 现有 URL 形态，不动 SPA 入口）

| 路径 | 用途 | 复用 / 新增 |
|---|---|---|
| `/?variant=security` | 主场（3D 地球 + 6 面板 + 风险热力层）| 复用 `index.html` + 新 variant 配置 |
| `/?variant=security&country=IR` | 打开指定国家的 brief（直链）| 复用 CountryBriefPage 参数化 |
| `/?variant=security#country-brief` | 触发 CountryBriefPanel 弹层 | 复用 hash 路由 |
| `/?variant=security&focus=sanctions` | 默认聚焦"制裁筛选"视图 | 新增 query param 解析（不破坏现有 query） |

> 约束：**不引入新路由库**；不写 React Router；沿用 WM 现有的 `?variant=` / `#anchor` 模式。

### 2.2 主页布局

```
┌──────────────────────────────────────────────────────────────────┐
│ TopBar:  [logo]  [搜索国家]  [AI 简报]  [制裁筛选▾]  [设置]   🇨🇳中 │
├──────────────┬───────────────────────────────────────────────────┤
│              │                                                   │
│ 侧栏：        │             3D 地球（globe.gl + deck.gl）         │
│ - 全球风险    │             └─ 高德底瓦片                         │
│   热力台 ★    │             └─ 风险热力层（新增）                  │
│ - 事件流      │             └─ 6 面板已有图层（保留）              │
│ - 制裁名单    │                                                   │
│ - 我的订阅    │                                                   │
│ - 设置        │                                                   │
│              │                                                   │
├──────────────┴───────────────────────────────────────────────────┤
│ 6 面板（保留）：[军事][冲突][气候][船舶][航空][网络威胁]          │
│ 右侧浮动：[AI 简报按钮]（沿用 CountryBriefPanel 触发器）        │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 三层"门厅"逻辑

| 层 | 入口 | 内容 | 实现 |
|---|---|---|---|
| 1. 热力台（首屏主视图）| 主页 | 地球 + 风险热力 + 6 面板 | 新增 layer（不替换 globe）|
| 2. 国别概览（侧栏点击）| 侧栏 | 该国 CII/风险评分/事件摘要 | 复用 CountryBriefPanel 入口（仅 i18n 化）|
| 3. AI 简报详情 | 浮按钮 / CountryBriefPanel 内"生成简报" | SSE 推送的 Markdown 报告 | 复用 CountryBriefOutput 渲染 |

### 2.4 不动 / 改的部分（一行清单）

- 不动：`App.ts`、`index.html`、router 文件、panel-enablement.ts、panels.ts、variant.ts、SITE_VARIANTS 数组本体
- 改：仅**新增** `src/config/variants/security.ts`、新增面板（见第 3 节）、新增风险热力 layer、zh.json 补词
- 新增：3 个新组件（见第 3 节）+ 1 个新 layer 渲染器

---

## 3. 组件与面板拆分

### 3.1 改动面（明确"不动"避免越界）

**新增文件（7 个）**：
| 路径 | 作用 | 大小估 |
|---|---|---|
| `src/config/variants/security.ts` | variant 声明 + 元数据 + 站点信息 | ~80 行 |
| `src/components/RiskHeatmapPanel.ts` | 全球风险热力层（首屏主视图）| ~250 行 |
| `src/components/SanctionsFilterBar.ts` | 五套制裁筛选器（OFAC/EU/UN/UK/MOFCOM）| ~180 行 |
| `src/components/SecuritySidebar.ts` | 左侧导航（热力台/事件流/制裁/订阅）| ~120 行 |
| `src/components/CountryQuickCard.ts` | 点国家后的轻量卡片（替代跳转）| ~150 行 |
| `src/services/country-risk.ts` | 风险评分聚合服务（前端用）| ~100 行 |
| `src/config/security-panels.ts` | A 专属面板注册（避免污染 panels.ts）| ~60 行 |

**修改文件（仅 1 个）**：
- `src/locales/zh.json` — 追加约 100 词术语（"风险热力"/"制裁名单"/"国别简报"等）。**追加，不改现有键**。

**不动**（重要）：
- `src/config/variant.ts`（SITE_VARIANTS 数组本体）→ **不直接改**；用 plugin 注册机制
- `src/config/panels.ts`、`src/app/panel-enablement.ts`
- 任何 `CountryBriefPanel*` 内部实现
- globe.gl / deck.gl / MapLibre 配置
- `App.ts`、`index.html`

### 3.2 variant 注册（关键：如何"不动" `variant.ts`）

> 仍要加 `'security'` 到 SITE_VARIANTS。研究显示 WM 用 `import.meta.env.VITE_VARIANT` 选 variant。**新机制**：
>
> 在 `security.ts` 中导出 `registerSecurityVariant()`，被 `main.ts` 启动时调用，调用 `setSiteVariants(['full', ..., 'security'])`（新增的辅助函数）。这样：
> - 第一次提交不需改 `variant.ts`
> - 第二次提 PR 时再合入 `'security'` 到 SITE_VARIANTS（同步到 `tests/desktop-one-binary-model.test.mjs`）

### 3.3 新增组件职责

| 组件 | 输入 props | 输出 | 依赖 |
|---|---|---|---|
| `RiskHeatmapPanel` | `countries: Country[]` (从 country-risk 拉) | deck.gl HeatmapLayer 实例 | deck.gl、`services/country-risk` |
| `SanctionsFilterBar` | `selected: Set<SdnSource>`, `onChange: (s) => void` | URL query `?focus=sanctions&lists=ofac,eu` | zh.json、URL utility |
| `SecuritySidebar` | `currentView: 'heat' \| 'events' \| 'sanctions' \| 'subs'` | 视图切换 | localStorage（记忆）|
| `CountryQuickCard` | `countryCode: string` | 浮卡（CII/简报链接）| CountryBriefPanel 入口、RiskScore |
| `country-risk` service | `getRiskScore(iso2): Promise<RiskScore>` | 5 因子 + 总分 | 后端 `/api/country-risk`（C.4 阶段）|

### 3.4 复用 + 不重复

| 复用 | 替代写新 |
|---|---|
| `CountryBriefPanel`（CII/制裁/事件/AI 简报）| 完整国家详情页 |
| `CountryBriefOutput`（Markdown 渲染）| 自写 markdown 渲染器 |
| `RiskScore`（CII 五因子）| 自写评分 |
| `globe.gl` + `deck.gl` + MapLibre | 高德平面地图 |
| `useLocalStorage` / `useUrlState`（WM 已有 hooks）| URL / 状态管理新库 |

### 3.5 6 面板保留的实现

> `RiskHeatmapPanel` 是**叠加在 globe.gl 上的一层**，不替换 globe 本身。6 面板的所有事件图层（军事/冲突/气候/船舶/航空/网络）**继续工作**，热力层只是把它们的位置 + 强度聚合到一张热图上。

---

## 4. 数据流与后端契约

### 4.1 数据源（已存在 / 需新增）

| 数据 | 来源 | 端点 | 状态 |
|---|---|---|---|
| 全球事件（中文）| zh-collector | `GET http://127.0.0.1:8081/api/recent?days=7` | ✅ 已跑通（OpencodetestLog 验证）|
| 6 面板数据（军事/冲突/气候/船舶/航空/网络）| WM 现有 seeder | 走原 `/api/*` 端点 | ✅ 不动 |
| 国别风险评分 | **新增后端** | `GET /api/country-risk?iso2=IR` | ⬜ W4-W6 范围，本 spec **不实现**；先用占位数据（取 6 面板事件数）|
| 五套制裁名单 | **新增** | `GET /api/sanctions/list?source=ofac` | ⬜ W4-W6 范围；本 spec 用 mock JSON 占位 |
| 国别 AI 简报 | WM 原链路 | `GET /api/country-brief?iso2=IR&stream=true` (SSE) | ✅ 复用 |

### 4.2 前端数据流图

```
┌──────────────────┐
│ RiskHeatmapPanel │  ←── country-risk.ts ─── /api/country-risk (W4-W6 mock)
│                  │                              ↓
│  + deck.gl       │                       5 因子聚合: 冲突/制裁/经济/流离/舆情
│  HeatmapLayer    │
└────────┬─────────┘
         │  (点国)
         ↓
┌──────────────────┐
│ CountryQuickCard │  ←── zh-collector /api/recent?keyword=<国名> (中文新闻)
│                  │  ←── WM /api/country-brief (CII 简报)
└────────┬─────────┘
         │  (点"查看详情")
         ↓
┌──────────────────┐
│ CountryBriefPanel│  ←── 原 WM 组件，不动
│  + CountryBrief  │       └─ /api/country-brief?stream=true (SSE)
│    Output 渲染   │
└──────────────────┘

并行:
┌──────────────────┐
│SanctionsFilterBar│  ←── 5 套名单选择 → URL ?lists=ofac,eu,un,uk,mofcom
│                  │                                  ↓
│  勾选 → 热力重算 │              CountryRisk 取 5 套名单 hit 数作"制裁"维度
└──────────────────┘
```

### 4.3 缓存与刷新策略

| 数据 | 缓存 | 刷新 | 备注 |
|---|---|---|---|
| 风险评分 | Redis key `country-risk:v1:{iso2}` TTL 1h | 客户端 SWR 1h | 后端 W4-W6 实现后用 |
| 6 面板事件 | WM 现有 3 层缓存 | 不动 | |
| 制裁名单 | Redis hash `sanctions:{source}` TTL 24h | 后端 cron | W4-W6 |
| AI 简报 | WM 现有 24h 缓存 | 不动 | |

### 4.4 错误处理（前端可观察）

| 场景 | 行为 | UI 反馈 |
|---|---|---|
| `/api/country-risk` 5xx | 降级：用 6 面板事件数算简易分 | 顶部灰条"风险评分为近似值" |
| `/api/sanctions/list` 5xx | 显示"名单暂不可用" | 筛选器灰禁 |
| zh-collector 5xx | 不影响（仅快讯不可用）| 卡片显示"暂无近期舆情" |
| SSE 断流 | 自动重连 × 3 | toast "重连中..." |
| LLM 超时 | 显示"AI 简报暂不可用" | 详情页可点"重试" |

### 4.5 暂未覆盖（明确推迟）

- 多租户 / 鉴权（属 W7-W8）
- 实时告警推送（属 W6，需微信/邮件 webhook，本仓库已有 `ais-relay` 容器）
- 报告导出 PDF（属 B variant spec 重点）
- 历史回放（属未来 L4 性能项）

---

## 5. 国际化和中文文案

### 5.1 策略（已定：补 `src/locales/zh.json`）

- **追加**（不改现有键）到 `src/locales/zh.json`
- 不创建新文件、不动 loader
- 所有新增组件文案走 `i18n.t('key')` 模式（WM 已用）
- 兜底：英文 fallback（WM 现成机制）

### 5.2 新增词条（约 100 条，按命名空间分组）

```json
{
  "security": {
    "title": "海外业务安全",
    "tagline": "海外安全 · 制裁筛查 · 风险评估",
    "views": {
      "heat": "全球风险热力",
      "events": "事件流",
      "sanctions": "制裁名单",
      "subscriptions": "我的订阅"
    },
    "filters": {
      "sanctionsBar": "制裁名单筛选",
      "allLists": "全部名单",
      "sources": {
        "ofac": "OFAC (美国)",
        "eu": "欧盟",
        "un": "联合国",
        "uk": "英国",
        "mofcom": "MOFCOM (中国)"
      },
      "rule50": "中国 50% 规则（MOFCOM 61 号）"
    },
    "risk": {
      "title": "国别风险",
      "score": "综合评分",
      "factors": {
        "conflict": "冲突密度",
        "sanctions": "制裁命中",
        "economic": "经济风险",
        "displacement": "流离失所",
        "sentiment": "舆情"
      },
      "approx": "风险评分为近似值（数据源部分降级）",
      "loading": "正在加载风险数据..."
    },
    "country": {
      "quickCard": "快速概览",
      "openFull": "查看完整简报",
      "noRecentNews": "暂无近期舆情"
    },
    "ai": {
      "brief": "AI 简报",
      "generate": "生成 AI 简报",
      "reconnecting": "重连中...",
      "unavailable": "AI 简报暂不可用，请稍后重试"
    },
    "errors": {
      "sanctionsDown": "制裁名单暂不可用",
      "riskDown": "风险评分暂不可用，已降级到近似值"
    }
  }
}
```

### 5.3 现有 i18n 键的复用

- 6 面板相关键（军事/冲突/气候/船舶/航空/网络）→ 不动，复用
- CountryBriefPanel 内部键 → 不动（CountryBriefPanel 是 i18n 已就绪的现有组件）
- zh.json 已有的 2850 键 → 不动

### 5.4 翻译质量门槛

- 金融/制裁术语与 product-plan v1.0 第二章"合规红线"完全一致
- 缩写首次出现给中英对照（如 "OFAC (美国) 外国资产控制办公室"）
- 风险等级用色/标签/文案三处一致

---

## 6. 测试与验收

### 6.1 测试层级（沿用 OpencodetestLog 风格：L0-L4）

| 层 | 覆盖 | 工具 | 关键命令 |
|---|---|---|---|
| **L0 冒烟** | variant 切换、热力台渲染、6 面板存在 | `npm run dev:security` + 浏览器 | `curl -I http://localhost:5173/?variant=security` 200 |
| **L1 契约** | 新增组件 props 类型 / zh.json schema | `npm run typecheck` + `tsc --noEmit` | `npm run lint:boundaries` |
| **L2 集成** | 点击国家 → CountryBriefPanel 打开；AI 简报 SSE 链路通 | Playwright e2e | `npm run e2e:security` |
| **L3 视觉** | 中文 i18n 不漏字、3D 地球高德瓦片正确加载 | 截图比对 | Playwright screenshot |
| **L4 性能** | 首屏 TTFB < 1.5s；热力层 60fps | Lighthouse | `npm run lighthouse:security` |

### 6.2 验收清单（与第 1.5 节呼应，可勾选）

**功能性**：
- [ ] `SITE_VARIANTS` 注册 `'security'`（或经 plugin 机制注册），`isSiteVariant('security') === true`
- [ ] `?variant=security` 主页 200，渲染 3D 地球 + 6 面板 + 风险热力层
- [ ] 6 面板全部存在并可启用/禁用（沿用现有 panel-enablement 机制）
- [ ] 点国家 → CountryQuickCard 弹出 → 点"查看完整简报" → CountryBriefPage 打开
- [ ] CountryBriefPage 内可触发 AI 简报，SSE 推送完毕，CountryBriefOutput 渲染
- [ ] SanctionsFilterBar 5 套名单可勾选，URL 反映 `?lists=ofac,eu`，热力图重算
- [ ] SecuritySidebar 4 个视图（热力/事件/制裁/订阅）可切换，localStorage 记忆

**非功能性**：
- [ ] `npm run typecheck` 通过
- [ ] `npm run lint:boundaries` 通过（验证未导入 `src/components` 内 WM 核心）
- [ ] 桌面/移动两种 viewport 截图正常
- [ ] zh.json 新增 100 词，无重复 key、无未翻译
- [ ] 不修改 `src/config/panels.ts` / `src/app/panel-enablement.ts` / `src/config/variant.ts`（git diff 校验）

**红线**：
- [ ] **任何 6 面板都不可被禁用/删除/隐藏**（断言：DOM 中能 querySelectorAll 出 6 个面板容器）
- [ ] 6 面板数据源全部走原链路（zh-collector 与之正交，仅供风险热力层做聚合）

### 6.3 自动化测试（本 spec 必落）

新增 `tests/security-variant/`：

- `test_smoke.ts` — 验证 variant 注册 + 主页渲染 + 6 面板存在（Playwright）
- `test_i18n.ts` — 验证 zh.json 新增词条 schema + 100% 翻译
- `test_sanctions_filter.ts` — 验证 5 套勾选 + URL 同步
- `test_country_brief_link.ts` — 验证点国 → CountryBriefPage 通

全部接 CI（沿用 `npm run e2e` 入口），跑挂即阻塞 PR。

### 6.4 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| deck.gl HeatmapLayer 在 globe.gl 3D 球上不工作（球面贴图问题）| 中 | 改用 ScatteredLayer + 颜色映射；或加 toggle 切 2D 平面图 |
| CountryBriefPanel 内部实现未来变化导致链接断 | 低 | 用公开 props 接口（`countryIso`），不读内部状态 |
| variant 注册机制被上游拒绝合并 | 中 | 第 1 阶段先 `VITE_VARIANT=security` 切流；后续提 PR 改 SITE_VARIANTS |
| 高德底瓦片 CORS 或商业授权 | 低 | 与 B variant 共享高德 key；5000 次/天免费额度足够 demo |
| 5 套制裁名单 mock JSON 不准 | 中 | 标 "demo data" 水印；正式版 W4-W6 接 OpenSanctions 批文件 |

---

## 7. 实施计划

### 7.1 阶段切分（与 product-plan v1.0 W1-W6 节奏对齐）

| 阶段 | 内容 | 估时 | 验证 |
|---|---|---|---|
| **A.1** variant 骨架 | `src/config/variants/security.ts` + plugin 注册 + 主页挂载 | 0.5d | `?variant=security` 200，6 面板全部在 |
| **A.2** 风险热力层 | `RiskHeatmapPanel` + `country-risk.ts`（mock） | 1d | 主页看热力、点国看卡 |
| **A.3** 制裁筛选 | `SanctionsFilterBar` + mock 名单 JSON | 0.5d | 5 套勾选 + URL 同步 |
| **A.4** 侧栏 + 导航 | `SecuritySidebar` + 4 视图切换 | 0.5d | 切换流畅，localStorage 记忆 |
| **A.5** i18n | 追加 zh.json 100 词 | 0.5d | `npm run typecheck` 过，e2e 截图无未翻译 |
| **A.6** 自动化测试 | `tests/security-variant/*` 4 个测试 | 0.5d | CI 接 e2e 跑通 |
| **A.7** 收尾 | 截图、文档、PR 准备 | 0.5d | 桌面/移动 2 张截图 + PR 描述 |

**合计：4.5 工作日**

### 7.2 PR 拆分（推荐 3 个 PR，依次合入）

| PR | 内容 | 风险 | 依赖 |
|---|---|---|---|
| **PR-A1** variant 骨架 + 主页挂载 + i18n 兜底 | 低 | 任何 WM 核心不动 | 无 |
| **PR-A2** RiskHeatmapPanel + SanctionsFilterBar + SecuritySidebar | 中 | deck.gl 在球面的工作需要真测 | PR-A1 |
| **PR-A3** e2e 测试 + 截图 + PR 文档 | 低 | CI 资源 | PR-A2 |

### 7.3 依赖与并行

- **同步依赖**：
  - zh-collector 已跑通（OpencodetestLog 验证 C.1）→ A 的中文舆情数据源就绪
  - WM `CountryBriefPanel` / `CountryBriefOutput` 已存在 → A 不重写国家详情
- **可并行**：
  - PR-A2 的 3 个新组件可分别提交（甚至 3 个小 PR）
  - `country-risk.ts` mock 与制裁名单 mock 互不依赖
- **阻塞**：
  - A 的"真"国别风险评分（5 因子 + 制裁 + 经济）属 W4-W6，需后端 `/api/country-risk`。**本 spec 用 mock 占位，标"demo data"水印**；等 W4-W6 落地后切真数据

### 7.4 交付物清单

| 类别 | 路径 |
|---|---|
| Spec | `docs/superpowers/specs/2026-10-14-security-variant-frontend-design.md`（本文件）|
| 代码 | 7 个新文件 + 1 个修改文件（见第 3.1 节）|
| 测试 | `tests/security-variant/{test_smoke,test_i18n,test_sanctions_filter,test_country_brief_link}.ts` |
| 文档 | 顶部链接到本 spec；README 加 security variant 段落 |
| 截图 | 桌面 + 移动 × 4 视图 = 8 张 |
| PR | 3 个 PR（PR-A1 / PR-A2 / PR-A3）|

### 7.5 移交（实施启动后）

按 brainstorming 流程，本 spec 通过后**调用 `writing-plans` 技能**把本文件拆成可执行的小步实施计划（含每个 task 的 owner、依赖、验证）。`writing-plans` 不会改本 spec，仅产出实施 sidecar。

---

## 附 A · 与上游决策的不一致提醒

| 来源 | 说 | 本 spec 决定 | 备注 |
|---|---|---|---|
| 第 1 章 1.1.5 | 删军事/卫星/航空/航海/气候 | **6 面板全保留** | 用户硬约束 |
| 第 1 章 1.2 | 单产品：商业咨询 AI 助手 | **双产品 A+B** | 与 product-plan v1.0 对齐 |
| 第 9 章 9.6 | React+Tailwind 数据源适配器 | **不改框架** | 仓库实况是 Preact+Vanilla TS |
| 第 9 章 9.7 | AI 研报按钮 = 主入口 | **次入口**（主页是热力台）| A 的"国别 AI 简报"走 CountryBriefPanel |
| product-plan 5.5 | MCP 暴露 generate_report | **A 不需要**（CountryBriefPanel 已自带）| B 才需要 |

## 附 B · spec 自审（提交前自查）

- [x] 无 "TBD" / "TODO"（推迟项已在第 4.5 节明确列出）
- [x] 各节不矛盾：路由 ↔ 组件 ↔ 数据流 ↔ 测试 一致
- [x] 范围聚焦：本 spec 只覆盖 A variant 前端；B variant 拆单独 spec
- [x] 需求可执行：每个验收项（6.2）有具体命令或 DOM 查询
- [x] 边界明确：1.3 节"做/不做"清单

---

**全文结束**。请整体看一遍本 spec，**整体 OK 就告诉我"spec 接受"**，我接着调 `writing-plans` 技能把本 spec 拆为实施 sidecar。如某节需要返工，告诉我节号与改法。

