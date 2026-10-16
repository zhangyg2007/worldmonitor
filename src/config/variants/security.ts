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

export const SECURITY_VARIANT = 'security' as SiteVariant;

export const securityMeta: VariantMeta = {
  title: 'World Monitor Security — 海外业务安全咨询',
  description: '国别风险热力 + 五套制裁筛查 + AI 简报；6 面板（军事 / 冲突 / 气候 / 船舶 / 航空 / 网络威胁）全保留。',
  keywords: '海外安全, 国别风险, 制裁筛查, OFAC, 欧盟制裁, 联合国制裁, MOFCOM 50% 规则, AI 简报, 出差风险, 商业咨询',
  url: 'https://www.worldmonitor.app/security',
  siteName: 'World Monitor Security',
  shortName: 'WM Security',
  subject: '海外业务安全 · 国别风险评估 · 制裁合规',
  classification: 'Security Intelligence Dashboard, OSINT Tool, Travel Risk Assessment',
  categories: ['security', 'compliance', 'productivity'],
  features: [
    '国别风险热力（5 因子：冲突 / 制裁 / 经济 / 流离 / 舆情）',
    '五套制裁名单筛选（OFAC / EU / UN / UK / MOFCOM）',
    '中国 50% 规则（MOFCOM 61 号）',
    'AI 国别简报（复用 CountryBriefPanel + SSE）',
    '军事 / 冲突 / 气候 / 船舶 / 航空 / 网络威胁 6 面板全保留',
    '中文舆情流（对接 zh-collector）',
  ],
};

export function registerSecurityVariant(): void {
  // 已通过 SITE_VARIANTS 注册 (Task 1 Step 3 Ruling 4)。
  // 此函数为后续扩展占位 (例如向 plugin registry 注入 panel 列表)。
}

export function mountSecurityPanels(): Promise<void> {
  // 累加挂载 (Ruling 1):
  //   Task 2: RiskHeatmapPanel
  //   Task 3: SanctionsFilterBar
  //   Task 4: SecuritySidebar
  return import('@/components/RiskHeatmapPanel')
    .then(({ RiskHeatmapPanel }) => {
      const heatmap = new RiskHeatmapPanel({
        containerId: 'risk-heatmap-container',
        center: [39.9042, 116.4074],
        zoom: 2.5,
      });
      return heatmap.mount();
    })
    .then(() =>
      import('@/components/SanctionsFilterBar').then(({ SanctionsFilterBar }) => {
        const url = new URLSearchParams(window.location.search);
        const filter = new SanctionsFilterBar(
          {
            containerId: 'sanctions-filter-container',
            onChange: (sel) => {
              // 后续 W4-W6: 触发 country-risk 重算 (含制裁命中数)
              // eslint-disable-next-line no-console
              console.log('sanctions selected:', Array.from(sel).join(','));
            },
          },
          url,
        );
        filter.mount();
      }),
    )
    .then(() =>
      import('@/components/SecuritySidebar').then(({ SecuritySidebar }) => {
        const sidebar = new SecuritySidebar({
          containerId: 'security-sidebar-container',
          onChange: (view) => {
            // 后续: 根据视图切换主页内容
            // eslint-disable-next-line no-console
            console.log('view changed:', view);
          },
        });
        sidebar.mount();
      }),
    );
}
