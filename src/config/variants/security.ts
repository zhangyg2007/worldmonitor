// Security variant — 海外业务安全咨询 (产品 A 前端)
// 6 面板 (军事/冲突/气候/船舶/航空/网络威胁) 全保留
// 叠加: 国别风险热力 + 五套制裁筛选 + AI 简报 (复用 WM CountryBriefPanel)
// 数据源: zh-collector (中文快讯) + WM 原生 /api/country-brief
//
// spec: docs/superpowers/specs/2026-10-14-security-variant-frontend-design.md
// plan: docs/superpowers/plans/2026-10-14-security-variant-frontend.md
//
// 注意: VariantMeta 接口 (variant-meta.ts) 必填 10 字段:
//   title, description, keywords, url, siteName, shortName,
//   subject, classification, categories[], features[]
// 本文件遵循该 shape; spec §3 中提到的 defaultLayer/center/zoom 不在
// VariantMeta 中, 留待 Task 2/3/4 在 mountSecurityPanels() 内消费.

import type { VariantMeta } from '../variant-meta';
import type { SiteVariant } from '../variant';
import { VARIANT_META } from '../variant-meta';

export const SECURITY_VARIANT = 'security' as SiteVariant;

// Canonical metadata lives in ../variant-meta so vite.config.ts (which reads
// VARIANT_META for the built HTML) and this module share one source. The
// re-export keeps the `securityMeta` symbol this module has always exported.
export const securityMeta: VariantMeta = VARIANT_META.security;

export function registerSecurityVariant(): void {
  // 已通过 SITE_VARIANTS 注册 (Task 1 Step 3 Ruling 4)。
  // 此函数为后续扩展占位 (例如向 plugin registry 注入 panel 列表)。
}

// The mounting orchestration lives in src/app/security-variant-panels.ts:
// config/ may not import components/ or app/ (the import direction is
// types → config → services → components → app), so a config module that
// instantiates UI components is a backward import. This module keeps the
// variant declaration and metadata only; import mountSecurityPanels from
// '@/app/security-variant-panels' at the call site.
