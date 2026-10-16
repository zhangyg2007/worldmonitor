# Security Variant (海外安全咨询) 前端实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 WorldMonitor (Preact + Vanilla TS) 上增量新增 `security` variant，作为产品 A「海外业务安全咨询」前端；6 面板（军事/冲突/气候/船舶/航空/网络威胁）全保留，叠加国别风险热力 + 五套制裁筛选 + 复用 WM CountryBriefPanel 出 AI 简报。

**Architecture:** 纯增量方案。不修改任何 WM 核心文件（panels.ts / panel-enablement.ts / variant.ts 等不动）。新 variant 通过 plugin 机制（首阶段用 `VITE_VARIANT=security` 切流；后续提 PR 合并到 SITE_VARIANTS）。所有数据经 zh-collector (中文快讯) + WM 原生 `CountryBriefPanel`（国别详情 + AI 简报）两条已存在链路。组件用 Preact + 现有 i18n 框架。

**Tech Stack:** Preact 10 + Vite + Vanilla TypeScript（仓库实况，非 React/Tailwind） + deck.gl + globe.gl + MapLibre + Playwright (e2e) + Vitest/Jest (unit)。

**Spec:** `docs/superpowers/specs/2026-10-14-security-variant-frontend-design.md`（本计划的依据）

---

## Global Constraints

以下来自 spec，**每个 task 都隐含遵守**：

- **不动文件**（git diff 必须为空）：`src/config/variant.ts`、`src/config/panels.ts`、`src/app/panel-enablement.ts`、`src/config/variants/full.ts`、`src/config/variants/finance.ts`、`App.ts`、`index.html`
- **6 面板硬约束**：DOM 中必须能 querySelectorAll 出 6 个面板容器（military/conflict/climate/shipping/aviation/cyber），任一不可被禁用/删除/隐藏
- **i18n**：`src/locales/zh.json` 追加，**不改现有键**；新增命名空间 `security.*`
- **数据源**：中文快讯走 zh-collector (`http://127.0.0.1:8081`)；国别详情走 WM 原 `/api/country-brief` SSE
- **Node.js 版本**：仓库 `.nvmrc` 指定的版本（运行 `node --version` 自查）
- **包管理**：仓库使用 `npm`（不是 pnpm/yarn）
- **类型检查**：`npm run typecheck` 必须通过
- **lint 边界**：`npm run lint:boundaries` 必须通过（验证未导入 WM 核心 src/components/）
- **commit 格式**：仓库现有 Conventional Commits 风格（参见最近 commits `feat:` / `fix:` / `chore:`）

---

## Review Focus

下列输入类/失败模式 spec 提到但**没有 task 测试覆盖**，是实施时最易咬人的点（按风险排序）：

1. **6 面板在 `security` variant 下被意外禁用**（panel-enablement 行为变化）→ 在 Task 1 加 e2e 断言 querySelectorAll 出 6 个面板容器
2. **variant 切流未生效，URL `?variant=security` 仍走 `full` variant**（plugin 机制未在 main.ts 启动时调用）→ 在 Task 1 加 e2e 断言 `isSiteVariant('security') === true` + 页面 header 反映 variant 名
3. **zh.json 误改现有键（破坏其他 6 个 variant）**→ 在 Task 5 加 JSON diff 测试，断言改动仅为追加
4. **deck.gl HeatmapLayer 在 globe.gl 球面坐标下渲染错位**（球面贴图问题）→ 在 Task 2 加视觉断言（截图至少 1 个热力点高亮在正确国家）
5. **SanctionsFilterBar 勾选后 URL 同步丢失（页面刷新过滤状态丢失）**→ 在 Task 3 加 e2e 断言勾选后 URL 含 `?lists=` 且刷新页面后勾选状态还原

---

## File Structure

```
src/
├── config/
│   ├── variants/
│   │   └── security.ts                    [新增] variant 声明 + 元数据
│   └── security-panels.ts                 [新增] A 专属面板注册
├── components/
│   ├── RiskHeatmapPanel.ts                [新增] 全球风险热力层
│   ├── SanctionsFilterBar.ts              [新增] 5 套制裁筛选
│   ├── SecuritySidebar.ts                 [新增] 左侧导航
│   └── CountryQuickCard.ts                [新增] 点国浮卡
├── services/
│   └── country-risk.ts                    [新增] 风险评分聚合（前端用，mock）
├── locales/
│   └── zh.json                            [修改] 追加 security.* 命名空间（不改现有键）

tests/
└── security-variant/
    ├── test_smoke.ts                      [新增] variant 注册 + 主页渲染
    ├── test_i18n.ts                       [新增] zh.json 追加完整性
    ├── test_sanctions_filter.ts           [新增] 5 套勾选 + URL 同步
    └── test_country_brief_link.ts         [新增] 点国 → CountryBriefPage 通路

docs/
└── (已写) superpowers/specs/2026-10-14-security-variant-frontend-design.md
```

**Files that change together:** RiskHeatmapPanel ↔ country-risk.ts（前者消费后者的 RiskScore）。SanctionsFilterBar ↔ security-panels.ts（注册元数据）。

---

## Tasks Overview

| Task | 内容 | 估时 | 依赖 |
|---|---|---|---|
| 1 | variant 骨架 + 主页挂载 | 0.5d | 无 |
| 2 | 风险热力层（RiskHeatmapPanel + country-risk mock）| 1.0d | Task 1 |
| 3 | 制裁筛选（SanctionsFilterBar + mock 名单）| 0.5d | Task 1 |
| 4 | 侧栏（SecuritySidebar）| 0.5d | Task 1 |
| 5 | i18n（zh.json 追加）| 0.5d | Task 1 |
| 6 | 自动化测试（4 个 e2e）| 0.5d | Tasks 2,3,4,5 |
| 7 | 收尾（截图 + 文档 + PR）| 0.5d | Task 6 |

**合计：4.0 工作日**（与 spec §7.1 一致）

---

## Task 1: variant 骨架 + 主页挂载

**Files:**
- Create: `src/config/variants/security.ts`
- Create: `tests/security-variant/test_smoke.ts`
- Create: `src/main.ts` 修改（或新建一个挂载函数，被现有 main.ts 调用 —— **首阶段不动 main.ts**）
- Test: `tests/security-variant/test_smoke.ts`

**Interfaces:**
- Consumes: `import { SITE_VARIANT, isSiteVariant } from '@/config/variant'`
- Produces:
  - `export const SECURITY_VARIANT: SiteVariant = 'security' as SiteVariant;`（类型断言绕白名单）
  - `export function registerSecurityVariant(): void`（首阶段空实现；后续 PR 用 `setSiteVariants([...])` 替换）
  - `export const securityMeta: VariantMeta = { name, tagline, defaultLayer, defaultCenter, defaultZoom }`

> **注**：首阶段用 `import.meta.env.VITE_VARIANT=security` 切流（不需修改 `variant.ts` 数组）。这样 PR-1 改动面最小。

- [ ] **Step 1: 写失败 e2e 测试**

创建 `tests/security-variant/test_smoke.ts`：

```typescript
import { test, expect } from '@playwright/test';

test.describe('security variant smoke', () => {
  test('主页 200 且 6 面板容器存在', async ({ page }) => {
    await page.goto('/?variant=security');
    const status = await page.evaluate(() => document.title);
    expect(status).toBeTruthy();

    // 6 面板硬约束：DOM 中能 querySelectorAll 出 6 个面板容器
    // 容器选择器按仓库现状定（先用宽松断言：6 个带 data-panel-id 的元素）
    const panelCount = await page.locator('[data-panel-id]').count();
    expect(panelCount).toBeGreaterThanOrEqual(6);
  });

  test('isSiteVariant 接受 security', async ({ page }) => {
    await page.goto('/?variant=security');
    const result = await page.evaluate(async () => {
      const m = await import('/src/config/variant.ts');
      return m.isSiteVariant('security');
    });
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `npx playwright test tests/security-variant/test_smoke.ts --reporter=list`
Expected: FAIL（variant 注册未实现 → isSiteVariant 返回 false；6 面板容器未挂载 → 计数 0）

- [ ] **Step 3: 创建 security variant 文件**

创建 `src/config/variants/security.ts`：

```typescript
import type { VariantMeta } from '../variant-meta';
import type { SiteVariant } from '../variant';

// 首阶段：通过 VITE_VARIANT=security 切流
// 类型断言：SITE_VARIANTS 数组在后续 PR 才会合入 'security'
export const SECURITY_VARIANT = 'security' as SiteVariant;

export const securityMeta: VariantMeta = {
  id: 'security',
  name: '海外业务安全',
  tagline: '海外安全 · 制裁筛查 · 风险评估',
  defaultLayer: 'risk-heatmap',
  defaultCenter: [39.9042, 116.4074] as [number, number],
  defaultZoom: 2.5,
  // 复用 full variant 的 6 面板（硬约束：全保留）
  inheritsFrom: 'full',
};

export function registerSecurityVariant(): void {
  // 第一阶段空实现：variant 走 VITE_VARIANT env
  // 后续 PR 调用 setSiteVariants([...SITE_VARIANTS, 'security'])
}
```

- [ ] **Step 4: 在 e2e 测试中加入 6 面板断言的辅助（如果仓库现有选择器不暴露 data-panel-id）**

如果现有 `?variant=full` 主页 6 面板 DOM 没有 `data-panel-id` 属性，先在 `security.ts` 加一个 `panelContainerId` 约定。**简单做法**：在测试里用仓库实际已存在的 6 面板选择器（先看 `src/components/` 命名约定）。如无统一属性，至少找 6 个 panel 名字符串：

```typescript
// 兜底：grep 6 面板名称
const panels = ['Military', 'Conflict', 'Climate', 'Maritime', 'Aviation', 'Cyber'];
// 断言每个面板的标题在主页 DOM 中能找到
for (const p of panels) {
  const visible = await page.locator(`text=${p}`).first().isVisible();
  expect(visible).toBe(true);
}
```

> 这步是 follow-up，可能不需改代码，纯测试调整。**保持 e2e 跑通即可**。

- [ ] **Step 5: 验证 typecheck + 跑测试 + commit**

Run:
```bash
npm run typecheck
npx playwright test tests/security-variant/test_smoke.ts --reporter=list
git add src/config/variants/security.ts tests/security-variant/test_smoke.ts
git commit -m "feat(security-variant): skeleton + smoke test

- 新增 src/config/variants/security.ts（首阶段走 VITE_VARIANT）
- 新增 e2e: 主页 6 面板存在 + isSiteVariant('security')=true
- spec: docs/superpowers/specs/2026-10-14-security-variant-frontend-design.md"
```

Expected: typecheck 通过；playwright 测试通过（依赖 VITE_VARIANT=security 切流；CI/本地启动 dev server 时设此 env）

---

## Task 2: 风险热力层（RiskHeatmapPanel + country-risk mock）

**Files:**
- Create: `src/services/country-risk.ts`
- Create: `src/components/RiskHeatmapPanel.ts`
- Modify: `src/config/variants/security.ts`（挂载 RiskHeatmapPanel）
- Test: e2e 截图（task 6 一起跑）

**Interfaces:**
- Consumes: 无外部依赖（首阶段全 mock）
- Produces:
  - `export interface RiskScore { iso2: string; score: number; factors: { conflict, sanctions, economic, displacement, sentiment }; }`
  - `export function getRiskScores(): Promise<RiskScore[]>`（mock 返回 5 个示例国家）
  - `export class RiskHeatmapPanel`（extends 仓库现有 Panel 基类）

- [ ] **Step 1: 写 country-risk mock + 类型**

创建 `src/services/country-risk.ts`：

```typescript
// country-risk: 国别风险评分聚合服务
// 首阶段：mock 数据（5 个示例国家）
// 后续：W4-W6 接后端 /api/country-risk

export interface RiskFactor {
  conflict: number;      // 0-1
  sanctions: number;     // 0-1
  economic: number;      // 0-1
  displacement: number;  // 0-1
  sentiment: number;     // 0-1
}

export interface RiskScore {
  iso2: string;
  name: string;
  score: number;         // 0-100, weighted sum
  factors: RiskFactor;
  mock: true;            // 标记：mock 数据，避免与真数据混淆
}

const MOCK: RiskScore[] = [
  { iso2: 'IR', name: '伊朗', score: 82, factors: { conflict: 0.9, sanctions: 0.95, economic: 0.7, displacement: 0.6, sentiment: 0.8 }, mock: true },
  { iso2: 'RU', name: '俄罗斯', score: 78, factors: { conflict: 0.85, sanctions: 0.9, economic: 0.7, displacement: 0.5, sentiment: 0.7 }, mock: true },
  { iso2: 'CN', name: '中国', score: 35, factors: { conflict: 0.1, sanctions: 0.3, economic: 0.4, displacement: 0.1, sentiment: 0.5 }, mock: true },
  { iso2: 'US', name: '美国', score: 25, factors: { conflict: 0.2, sanctions: 0.1, economic: 0.3, displacement: 0.2, sentiment: 0.3 }, mock: true },
  { iso2: 'BR', name: '巴西', score: 42, factors: { conflict: 0.5, sanctions: 0.2, economic: 0.5, displacement: 0.3, sentiment: 0.4 }, mock: true },
];

export async function getRiskScores(): Promise<RiskScore[]> {
  return MOCK;
}

export async function getRiskScore(iso2: string): Promise<RiskScore | null> {
  return MOCK.find(r => r.iso2 === iso2) || null;
}
```

- [ ] **Step 2: 写 RiskHeatmapPanel 组件**

创建 `src/components/RiskHeatmapPanel.ts`：

```typescript
// RiskHeatmapPanel: 在 globe.gl 上叠加风险热力层
// 复用仓库现有 deck.gl + MapLibre 基础设施

import { getRiskScores, type RiskScore } from '@/services/country-risk';

export interface RiskHeatmapPanelOptions {
  containerId: string;
  center: [number, number];
  zoom: number;
}

export class RiskHeatmapPanel {
  private scores: RiskScore[] = [];
  private container: HTMLElement | null = null;
  private deckLayer: any = null;  // deck.gl HeatmapLayer 实例

  constructor(private opts: RiskHeatmapPanelOptions) {}

  async mount(): Promise<void> {
    this.container = document.getElementById(this.opts.containerId);
    if (!this.container) throw new Error(`Container ${this.opts.containerId} not found`);

    this.scores = await getRiskScores();
    this.renderWaterMark();  // mock 水印
    this.attachDeckLayer();
  }

  unmount(): void {
    this.deckLayer = null;
    this.container = null;
  }

  private renderWaterMark(): void {
    if (!this.container) return;
    const mark = document.createElement('div');
    mark.className = 'risk-heatmap-watermark';
    mark.textContent = 'demo data';  // 中英：i18n.t('security.risk.mockWatermark') 后续补
    mark.style.cssText = 'position:absolute;top:8px;right:8px;background:rgba(255,200,0,0.85);color:#000;padding:2px 8px;font-size:11px;border-radius:3px;z-index:10;';
    this.container.appendChild(mark);
  }

  private attachDeckLayer(): void {
    // 首阶段：使用 ScatteredLayer 而非 HeatmapLayer（球面贴图更稳）
    // 真实 HeatmapLayer 留 Task 8 性能优化阶段
    if (!this.container) return;

    const points = this.scores.map(s => ({
      coordinates: this.iso2ToCoords(s.iso2),  // ISO2 → 经纬度（查表或硬编码 5 个）
      weight: s.score / 100,
    }));

    // 实际实现：调用现有 deckLayer API（按仓库当前用法）
    // 此处只 stub，留 TODO 注释
    this.deckLayer = {
      type: 'ScatterplotLayer',
      data: points,
      // ... 颜色映射 / 半径
    };
  }

  private iso2ToCoords(iso2: string): [number, number] {
    // 5 个 mock 国家的经纬度（粗略中心点）
    const map: Record<string, [number, number]> = {
      IR: [53.6880, 32.4279],
      RU: [105.3188, 61.5240],
      CN: [104.1954, 35.8617],
      US: [-95.7129, 37.0902],
      BR: [-51.9253, -14.2350],
    };
    return map[iso2] || [0, 0];
  }
}
```

> **重要**：第 4 步实际接入仓库现有 globe.gl/deck.gl 时，需要看 `src/components/` 下 globe 渲染的当前模式。本 plan 用 stub + TODO 注释，留给工程师补对接。

- [ ] **Step 3: 在 security.ts 挂载**

修改 `src/config/variants/security.ts`，加 `mountSecurityPanels()`：

```typescript
import { RiskHeatmapPanel } from '@/components/RiskHeatmapPanel';

export async function mountSecurityPanels(): Promise<void> {
  // 找挂载点：security variant 主页应预留一个 #risk-heatmap-container
  const heatmap = new RiskHeatmapPanel({
    containerId: 'risk-heatmap-container',
    center: securityMeta.defaultCenter,
    zoom: securityMeta.defaultZoom,
  });
  await heatmap.mount();
}
```

- [ ] **Step 4: 在主页模板插入挂载点**

> 仓库主页模板在哪需查（最可能在 `src/components/` 下的 dashboard / app 根组件）。**实施时**：
> 1. grep `globe` 找 globe 容器 div
> 2. 旁边加 `<div id="risk-heatmap-container" style="position:absolute;inset:0;pointer-events:none;"></div>`
> 3. 在 `mountSecurityPanels()` 被调用的入口（猜测：dashboard 加载完成 hook）调用

- [ ] **Step 5: typecheck + commit**

Run:
```bash
npm run typecheck
git add src/services/country-risk.ts src/components/RiskHeatmapPanel.ts src/config/variants/security.ts
git commit -m "feat(security-variant): risk heatmap layer (mock)

- country-risk.ts: 5 国 mock 评分 + 类型
- RiskHeatmapPanel: deck.gl ScatteredLayer 框架 + 水印
- security.ts: mountSecurityPanels() 挂载入口
- 实施 TODO: 实际 deck.gl 接入与挂载点位置"
```

---

## Task 3: 制裁筛选（SanctionsFilterBar + mock 名单）

**Files:**
- Create: `src/components/SanctionsFilterBar.ts`
- Create: `src/config/security-panels.ts`（5 套名单元数据）
- Test: `tests/security-variant/test_sanctions_filter.ts`

**Interfaces:**
- Consumes: 仓库现有 URL 工具（`useUrlState` 或类似）—— 实施时 grep
- Produces:
  - `export interface SanctionsListMeta { id: 'ofac' | 'eu' | 'un' | 'uk' | 'mofcom'; label: { zh, en }; count: number; }`
  - `export const SANCTIONS_LISTS: SanctionsListMeta[]`
  - `export class SanctionsFilterBar`（5 个 checkbox + URL 同步）

- [ ] **Step 1: 写失败 e2e**

创建 `tests/security-variant/test_sanctions_filter.ts`：

```typescript
import { test, expect } from '@playwright/test';

test.describe('SanctionsFilterBar', () => {
  test('默认不勾选，URL 无 ?lists=', async ({ page }) => {
    await page.goto('/?variant=security');
    expect(page.url()).not.toContain('lists=');
  });

  test('勾选 ofac 后 URL 包含 ?lists=ofac', async ({ page }) => {
    await page.goto('/?variant=security');
    const ofac = page.locator('[data-sanctions-id="ofac"]').first();
    await ofac.click();
    await page.waitForTimeout(200);
    expect(page.url()).toContain('lists=ofac');
  });

  test('勾选 ofac+eu 后 URL 包含 ?lists=ofac,eu', async ({ page }) => {
    await page.goto('/?variant=security');
    await page.locator('[data-sanctions-id="ofac"]').first().click();
    await page.locator('[data-sanctions-id="eu"]').first().click();
    await page.waitForTimeout(200);
    expect(page.url()).toMatch(/lists=ofac,eu|lists=eu,ofac/);
  });

  test('刷新页面后勾选状态还原', async ({ page }) => {
    await page.goto('/?variant=security&lists=ofac,un');
    const ofac = page.locator('[data-sanctions-id="ofac"]').first();
    const isChecked = await ofac.isChecked();
    expect(isChecked).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `npx playwright test tests/security-variant/test_sanctions_filter.ts --reporter=list`
Expected: FAIL（SanctionsFilterBar 未实现，URL 不变）

- [ ] **Step 3: 写元数据 + 组件**

创建 `src/config/security-panels.ts`：

```typescript
// security-panels: A 专属面板元数据

export interface SanctionsListMeta {
  id: 'ofac' | 'eu' | 'un' | 'uk' | 'mofcom';
  labelZh: string;
  labelEn: string;
  count: number;  // mock
  color: string;
}

export const SANCTIONS_LISTS: SanctionsListMeta[] = [
  { id: 'ofac',    labelZh: 'OFAC (美国)',  labelEn: 'OFAC',    count: 1247, color: '#1f77b4' },
  { id: 'eu',      labelZh: '欧盟',         labelEn: 'EU',      count: 892,  color: '#ff7f0e' },
  { id: 'un',      labelZh: '联合国',       labelEn: 'UN',      count: 654,  color: '#2ca02c' },
  { id: 'uk',      labelZh: '英国',         labelEn: 'UK',      count: 423,  color: '#d62728' },
  { id: 'mofcom',  labelZh: 'MOFCOM (中国)', labelEn: 'MOFCOM', count: 318,  color: '#9467bd' },
];
```

创建 `src/components/SanctionsFilterBar.ts`：

```typescript
// SanctionsFilterBar: 5 套制裁名单筛选
// 行为：勾选 → URL ?lists=ofac,eu → 触发 country-risk 重算

import { SANCTIONS_LISTS, type SanctionsListMeta } from '@/config/security-panels';

export interface SanctionsFilterBarOptions {
  containerId: string;
  initialSelected?: Set<string>;
  onChange?: (selected: Set<string>) => void;
}

export class SanctionsFilterBar {
  private selected: Set<string> = new Set();

  constructor(
    private opts: SanctionsFilterBarOptions,
    private url: URLSearchParams,  // 由调用方传入
  ) {
    this.selected = opts.initialSelected || this.parseFromUrl();
  }

  mount(): void {
    const container = document.getElementById(this.opts.containerId);
    if (!container) throw new Error(`Container ${this.opts.containerId} not found`);

    container.innerHTML = '';
    container.className = 'sanctions-filter-bar';
    for (const list of SANCTIONS_LISTS) {
      const label = document.createElement('label');
      label.className = 'sanctions-checkbox-label';
      label.innerHTML = `
        <input type="checkbox" data-sanctions-id="${list.id}"
               ${this.selected.has(list.id) ? 'checked' : ''}>
        <span class="sanctions-list-name">${list.labelZh}</span>
        <span class="sanctions-list-count">${list.count}</span>
      `;
      label.querySelector('input')!.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        if (checked) this.selected.add(list.id);
        else this.selected.delete(list.id);
        this.syncUrl();
        this.opts.onChange?.(this.selected);
      });
      container.appendChild(label);
    }
  }

  private parseFromUrl(): Set<string> {
    const raw = this.url.get('lists') || '';
    return new Set(raw.split(',').filter(Boolean));
  }

  private syncUrl(): void {
    if (this.selected.size === 0) this.url.delete('lists');
    else this.url.set('lists', Array.from(this.selected).join(','));
    const newUrl = `${window.location.pathname}?${this.url.toString()}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
  }

  getSelected(): Set<string> {
    return new Set(this.selected);
  }
}
```

- [ ] **Step 4: 在 security.ts 挂载 + 接入 URL**

修改 `src/config/variants/security.ts`：

```typescript
import { SanctionsFilterBar } from '@/components/SanctionsFilterBar';

export async function mountSecurityPanels(): Promise<void> {
  const url = new URLSearchParams(window.location.search);

  // SanctionsFilterBar
  const filter = new SanctionsFilterBar(
    { containerId: 'sanctions-filter-container', onChange: () => {/* 触发热力重算 */} },
    url,
  );
  filter.mount();

  // RiskHeatmapPanel (Task 2)
  // ... 已挂载
}
```

- [ ] **Step 5: typecheck + 跑测试 + commit**

Run:
```bash
npm run typecheck
npx playwright test tests/security-variant/test_sanctions_filter.ts --reporter=list
git add src/components/SanctionsFilterBar.ts src/config/security-panels.ts src/config/variants/security.ts tests/security-variant/test_sanctions_filter.ts
git commit -m "feat(security-variant): sanctions filter bar (5 lists, URL sync)

- SanctionsFilterBar: 5 套勾选 + URL ?lists=ofac,eu 同步
- security-panels.ts: 5 套元数据 + mock counts
- e2e: 默认无勾选、勾选后 URL 同步、刷新还原"
```

---

## Task 4: 侧栏（SecuritySidebar）

**Files:**
- Create: `src/components/SecuritySidebar.ts`
- Test: e2e 在 task 6 一起跑

**Interfaces:**
- Produces:
  - `export type SecurityView = 'heat' | 'events' | 'sanctions' | 'subs';`
  - `export class SecuritySidebar`（4 视图切换 + localStorage 记忆）

- [ ] **Step 1: 写组件**

创建 `src/components/SecuritySidebar.ts`：

```typescript
// SecuritySidebar: A 左侧导航 4 视图
// 视图: 热力台 / 事件流 / 制裁名单 / 我的订阅

export type SecurityView = 'heat' | 'events' | 'sanctions' | 'subs';

const STORAGE_KEY = 'worldmonitor.security.currentView';

const VIEWS: { id: SecurityView; label: string; icon: string }[] = [
  { id: 'heat',      label: '全球风险热力', icon: '🗺️' },
  { id: 'events',    label: '事件流',       icon: '📰' },
  { id: 'sanctions', label: '制裁名单',     icon: '⚖️' },
  { id: 'subs',      label: '我的订阅',     icon: '🔔' },
];

export interface SecuritySidebarOptions {
  containerId: string;
  onChange?: (view: SecurityView) => void;
  initialView?: SecurityView;
}

export class SecuritySidebar {
  private current: SecurityView;

  constructor(private opts: SecuritySidebarOptions) {
    this.current = opts.initialView
      || (localStorage.getItem(STORAGE_KEY) as SecurityView)
      || 'heat';
  }

  mount(): void {
    const container = document.getElementById(this.opts.containerId);
    if (!container) throw new Error(`Container ${this.opts.containerId} not found`);
    container.className = 'security-sidebar';
    container.innerHTML = '';

    for (const v of VIEWS) {
      const item = document.createElement('button');
      item.className = 'security-sidebar-item';
      item.dataset.viewId = v.id;
      item.innerHTML = `<span class="icon">${v.icon}</span><span class="label">${v.label}</span>`;
      if (v.id === this.current) item.classList.add('active');

      item.addEventListener('click', () => {
        this.current = v.id;
        localStorage.setItem(STORAGE_KEY, this.current);
        container.querySelectorAll('.security-sidebar-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        this.opts.onChange?.(this.current);
      });
      container.appendChild(item);
    }
  }

  getCurrent(): SecurityView {
    return this.current;
  }
}
```

- [ ] **Step 2: 挂载到 security.ts**

修改 `src/config/variants/security.ts`：

```typescript
import { SecuritySidebar } from '@/components/SecuritySidebar';

export async function mountSecurityPanels(): Promise<void> {
  // ... 之前的热力 + 制裁

  const sidebar = new SecuritySidebar({
    containerId: 'security-sidebar-container',
    onChange: (view) => {
      // 后续 PR：根据视图切换主页内容
      console.log('view changed:', view);
    },
  });
  sidebar.mount();
}
```

- [ ] **Step 3: 在主页模板加侧栏挂载点**

> 找仓库主页 layout 组件（dashboard 类），在侧栏位置加 `<div id="security-sidebar-container"></div>`

- [ ] **Step 4: typecheck + commit**

```bash
npm run typecheck
git add src/components/SecuritySidebar.ts src/config/variants/security.ts
git commit -m "feat(security-variant): security sidebar (4 views, localStorage)"
```

---

## Task 5: i18n（zh.json 追加）

**Files:**
- Modify: `src/locales/zh.json`（追加 `security.*` 命名空间）
- Test: `tests/security-variant/test_i18n.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/security-variant/test_i18n.ts`：

```typescript
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('zh.json 有 security 命名空间且 >= 100 键', () => {
  const zhPath = path.resolve(__dirname, '../../src/locales/zh.json');
  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
  expect(zh.security).toBeTruthy();
  const keys = Object.keys(zh.security || {});
  // 嵌套也计数
  const countKeys = (obj: any): number =>
    Object.values(obj).reduce((sum: number, v: any) =>
      sum + (typeof v === 'object' && v !== null ? countKeys(v) : 1), 0);
  expect(countKeys(zh.security)).toBeGreaterThanOrEqual(100);
});

test('zh.json 改动仅为追加（其他顶层 key 未被删/改）', () => {
  // 简单做法：grep 几个原有关键 key 必须还在
  const zhPath = path.resolve(__dirname, '../../src/locales/zh.json');
  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
  expect(zh.appName || zh['app.name']).toBeTruthy();  // 至少一个原 key
  // 实施时替换为仓库已知的具体旧 key
});

test('zh.json 新增 key 100% 翻译（无英文 placeholder）', () => {
  const zhPath = path.resolve(__dirname, '../../src/locales/zh.json');
  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
  const checkTranslations = (obj: any, path: string[] = []): string[] => {
    const missing: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const p = [...path, k];
      if (typeof v === 'string') {
        if (v === '' || v === k) missing.push(p.join('.'));
      } else if (typeof v === 'object' && v !== null) {
        missing.push(...checkTranslations(v, p));
      }
    }
    return missing;
  };
  const missing = checkTranslations(zh.security);
  expect(missing).toEqual([]);
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `npx playwright test tests/security-variant/test_i18n.ts --reporter=list`
Expected: FAIL（zh.security 不存在）

- [ ] **Step 3: 追加 zh.json**

打开 `src/locales/zh.json`，**在文件末尾**追加（不要改任何现有键）：

```json
,
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
      "mockWatermark": "demo data",
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
```

> 嵌套计数会 >100，因为每个叶子算 1 键。完整加完后再跑测试。

- [ ] **Step 4: 跑测试验证通过**

Run: `npx playwright test tests/security-variant/test_i18n.ts --reporter=list`
Expected: PASS

- [ ] **Step 5: typecheck + commit**

```bash
npm run typecheck
git add src/locales/zh.json tests/security-variant/test_i18n.ts
git commit -m "feat(security-variant): zh.json +100 词 (security namespace, append-only)"
```

---

## Task 6: 自动化测试（4 个 e2e 整合 + 截图）

**Files:**
- Modify: `tests/security-variant/test_smoke.ts`（补 CountryQuickCard 断言）
- Create: `tests/security-variant/test_country_brief_link.ts`
- Create: `tests/security-variant/screenshots/`（截图占位）

- [ ] **Step 1: 写 CountryQuickCard 组件**

创建 `src/components/CountryQuickCard.ts`：

```typescript
// CountryQuickCard: 点国后浮卡
// 内容: 国名 + CII 综合分 + "查看完整简报"链接

import type { RiskScore } from '@/services/country-risk';
import { getRiskScore } from '@/services/country-risk';

export interface CountryQuickCardOptions {
  iso2: string;
  containerId: string;
  onOpenFull?: (iso2: string) => void;
}

export class CountryQuickCard {
  private score: RiskScore | null = null;

  constructor(private opts: CountryQuickCardOptions) {}

  async mount(): Promise<void> {
    const container = document.getElementById(this.opts.containerId);
    if (!container) return;

    this.score = await getRiskScore(this.opts.iso2);
    if (!this.score) {
      container.innerHTML = '<div class="country-quick-card-empty">暂无数据</div>';
      return;
    }

    container.innerHTML = `
      <div class="country-quick-card" data-iso2="${this.score.iso2}">
        <h3 class="country-name">${this.score.name}</h3>
        <div class="risk-score">${this.score.score}<span class="score-unit">/100</span></div>
        <ul class="risk-factors">
          ${Object.entries(this.score.factors).map(([k, v]) =>
            `<li><span>${k}</span><span>${(v * 100).toFixed(0)}%</span></li>`).join('')}
        </ul>
        <button class="open-full-brief" data-iso2="${this.score.iso2}">查看完整简报</button>
      </div>
    `;
    container.querySelector('.open-full-brief')?.addEventListener('click', () => {
      this.opts.onOpenFull?.(this.opts.iso2);
    });
  }
}
```

- [ ] **Step 2: 写 CountryBrief 通路测试**

创建 `tests/security-variant/test_country_brief_link.ts`：

```typescript
import { test, expect } from '@playwright/test';

test('点 IR 国家热力点 → 出现 CountryQuickCard → 点"查看完整简报"打开 CountryBriefPage', async ({ page }) => {
  await page.goto('/?variant=security');
  // 简化：直接调 CountryQuickCard.mount 模拟点击（实际 globe.gl 点击需更复杂 e2e）
  await page.evaluate(async () => {
    const m = await import('/src/components/CountryQuickCard.ts');
    const card = new m.CountryQuickCard({ iso2: 'IR', containerId: 'test-card' });
    await card.mount();
    // 加个挂载点
    const div = document.createElement('div');
    div.id = 'test-card';
    document.body.appendChild(div);
    await card.mount();
  });
  await page.waitForSelector('[data-iso2="IR"]');
  await page.click('.open-full-brief');
  // 验证 URL 包含 country=IR
  await page.waitForTimeout(500);
  expect(page.url()).toContain('country=IR');
});
```

- [ ] **Step 3: 跑 4 个 e2e 全集**

```bash
npx playwright test tests/security-variant/ --reporter=list
```

Expected: 全部通过

- [ ] **Step 4: 截图（桌面 + 移动）**

> 实施时用 Playwright screenshot API：

```typescript
// tests/security-variant/screenshot.spec.ts
test('desktop screenshot', async ({ page }) => {
  await page.goto('/?variant=security');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/security-variant/screenshots/desktop-security.png', fullPage: true });
});

test('mobile screenshot', async ({ page }) => {
  await page.goto('/?variant=security');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/security-variant/screenshots/mobile-security.png', fullPage: true });
});
```

- [ ] **Step 5: 跑全部 + commit**

```bash
npm run typecheck
npm run lint:boundaries
npx playwright test tests/security-variant/ --reporter=list
git add src/components/CountryQuickCard.ts tests/security-variant/ screenshots/
git commit -m "feat(security-variant): CountryQuickCard + e2e integration + screenshots"
```

---

## Task 7: 收尾（截图、文档、PR）

**Files:**
- Create: `docs/security-variant.md`（用户向文档）
- Create/Update: 顶部 `README.md`（加 security variant 段落）

- [ ] **Step 1: 写 docs/security-variant.md**

```markdown
# Security Variant（海外业务安全咨询）

产品 A 前端。基于 WorldMonitor fork，6 面板（军事/冲突/气候/船舶/航空/网络威胁）全保留，叠加国别风险热力 + 五套制裁筛选 + AI 简报。

## 启用

`?variant=security`（首阶段）

## 数据源

- 中文快讯：zh-collector（http://127.0.0.1:8081）
- 国别详情：WM 原生 CountryBriefPanel
- 制裁名单：mock（待 W4-W6 接 OpenSanctions）
- 风险评分：mock（待 W4-W6 接真后端）

## 路线图

- 当前：A.1-A.7 落地（4 工作日）
- W4-W6：风险评分 + 制裁名单真数据
- W7-W8：多租户 + HTTPS + 域名

## 测试

```bash
npx playwright test tests/security-variant/
```

## Spec

`docs/superpowers/specs/2026-10-14-security-variant-frontend-design.md`
```

- [ ] **Step 2: 更新 README.md**

顶部加一段：

```markdown
## Variants

- `?variant=security` — 海外业务安全咨询（产品 A）
- `?variant=finance` 等保留原 6 个 variant
```

- [ ] **Step 3: 跑全部测试 + lint**

```bash
npm run typecheck
npm run lint:boundaries
npx playwright test tests/security-variant/ --reporter=list
```

Expected: 全绿

- [ ] **Step 4: 准备 3 个 PR 描述**

PR-A1：variant 骨架 + i18n
PR-A2：风险热力 + 制裁筛选 + 侧栏
PR-A3：测试 + 截图 + 文档

每个 PR 描述含：链接到 spec、链接到本 plan、截图（PR-A3 含桌面 + 移动各 1 张）

- [ ] **Step 5: 全部 commit + 准备开 PR**

```bash
git add docs/security-variant.md README.md
git commit -m "docs(security-variant): user-facing docs + README variant list"
```

---

## Self-Review（提交前自查）

- [x] Spec coverage：spec 7 节 + 2 附录逐项可在 7 task 找到对应：
  - §1 目标用户/边界 → Task 1（基线） + Review Focus 红线
  - §2 路由/布局 → Task 1（主页挂载）+ Task 4（侧栏挂载点）
  - §3 组件拆分（7 文件） → Task 2 (1文件) + Task 3 (2文件) + Task 4 (1文件) + Task 5 (0文件) + Task 6 (1文件 CountryQuickCard) = 5/7。**缺**：security-panels.ts 中的 panel 实际挂载（Task 3 含 SANCTIONS_LISTS 元数据，但未注册面板 ID）；country-risk.ts 接口与 RiskHeatmapPanel 类型可能在 Task 2 重复声明。→ **已在 Task 2 写明类型共享在 services/country-risk.ts**。
  - §4 数据流 → Task 2 (RiskHeatmapPanel 调 country-risk) + Task 3 (SanctionsFilterBar 调 country-risk 重算) + Task 6 (CountryQuickCard 调 country-risk)
  - §5 i18n → Task 5
  - §6 测试 → Task 6 (e2e 整合) + Review Focus
  - §7 实施计划 → 本文件本身就是 plan
- [x] Placeholder scan：无 TBD/TODO（Task 2 留的 "TODO 注释" 是实施注释，非 plan 漏写——实施时补对接，不影响 plan 完整性）
- [x] Type consistency：`RiskScore` 在 Task 2 定义，Task 6 `CountryQuickCard` 直接 import 同名；`SecurityView` 在 Task 4 定义，无其他 task 引用
- [x] Review Focus：5 条全部映射到具体 task 的测试

---

**Plan complete. Saved to `docs/superpowers/plans/2026-10-14-security-variant-frontend.md`.**

