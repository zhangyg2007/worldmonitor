# Security Variant（海外业务安全咨询）

产品 A 前端。基于 WorldMonitor fork，6 面板（军事 / 冲突 / 气候 / 船舶 / 航空 / 网络威胁）**全保留**，叠加：

- 国别风险热力台（5 因子：冲突 / 制裁 / 经济 / 流离 / 舆情）
- 五套制裁名单筛选（OFAC / EU / UN / UK / MOFCOM）+ 中国 50% 规则
- AI 国别简报（复用 WM `CountryBriefPanel` + SSE）
- 中文舆情流（对接 `zh-collector`）

## 启用

- 浏览器：`?variant=security` 切到本 variant
- Tauri 桌面：localStorage `worldmonitor-variant=security` 后重启
- hostname（`security.worldmonitor.app`）暂未申请域名（属 W7-W8）

## 数据源

| 数据 | 端点 | 状态 |
|---|---|---|
| 中文快讯 | zh-collector `http://127.0.0.1:8081/api/recent` | ✅ 跑通（OpencodetestLog）|
| 国别详情 / AI 简报 | WM 原生 `/api/country-brief`（SSE）| ✅ 复用 |
| 6 面板（军事/冲突/气候/船舶/航空/网络）| WM 原生 `DEFAULT_MAP_LAYERS` | ✅ 全保留 |
| 国别风险评分 | **mock** | ⬜ W4-W6 接真后端 |
| 5 套制裁名单 | **mock** | ⬜ W4-W6 接 OpenSanctions 批文件 |

mock 数据均标 `mock: true` 或 `demo data` 水印，避免与真数据混淆。

## 路线图

| 阶段 | 内容 |
|---|---|
| ✅ 当前 | variant 骨架 + 风险热力层 + 制裁筛选 + 侧栏 + i18n (33 词) |
| ⬜ W4-W6 | 真风险评分（5 因子聚合）+ 制裁名单真数据（OpenSanctions 批文件）|
| ⬜ W4-W6 | 性能优化（HeatmapLayer 替代 ScatteredLayer）|
| ⬜ W7-W8 | 多租户 + HTTPS + 域名（security.worldmonitor.app）|

## 测试

```bash
# vitest DOM 测试 (6 文件, 32 测)
npx vitest run --config vitest.dom.config.mts tests/dom/security-variant-*.test.mts

# 仓库 baseline 不被破坏
npx tsc --noEmit
```

> **未在 PR 范围**：真实 Playwright DOM 验证（需 dev server 启动 + globe.gl 渲染 + 6 面板 querySelector）—— 留后续 dev session 在 CI 上跑 `test:e2e:security`。

## 文件清单

| 路径 | 行数 | 说明 |
|---|---|---|
| `src/config/variant.ts` | +1 | SITE_VARIANTS append 'security' (Ruling 4) |
| `src/config/webmcp.ts` | +1 | WEBMCP_VARIANT_INVENTORIES add 'security': false (Ruling 6) |
| `src/config/variants/security.ts` | +85 | variant 文件 + securityMeta + mountSecurityPanels() 累加 |
| `src/config/security-panels.ts` | +20 | 5 套制裁名单元数据 |
| `src/services/country-risk.ts` | +45 | RiskScore 类型 + 5 国 mock |
| `src/components/RiskHeatmapPanel.ts` | +88 | ScatteredLayer stub + demo data 水印 |
| `src/components/SanctionsFilterBar.ts` | +90 | 勾选 + URL 同步 |
| `src/components/SecuritySidebar.ts` | +83 | 4 视图 + localStorage |
| `src/locales/zh.json` | +33 leaves | security.* 命名空间 (append-only) |
| `tests/dom/security-variant-*.test.mts` | 6 文件 / 32 测 | 全套绿 |

## Spec / Plan

- Spec: `docs/superpowers/specs/2026-10-14-security-variant-frontend-design.md`
- Plan: `docs/superpowers/plans/2026-10-14-security-variant-frontend.md`
- Ledger: `.superpowers/sdd/2026-10-14-security-variant-frontend/progress.md`
