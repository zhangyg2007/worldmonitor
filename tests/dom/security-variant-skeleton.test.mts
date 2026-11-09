// tests/dom/security-variant-skeleton.test.mts
// Task 1: variant 骨架 + 6 面板硬约束 + 导出契约
//
// 6 面板 (用户硬约束: 军事/冲突/气候/船舶/航空/网络威胁 全保留):
//   - 在 WM 仓库, 这些面板是 "地图图层" (DEFAULT_MAP_LAYERS), 而非 PanelConfig
//   - 对应 key: military / conflicts / natural / ais / flights / cyberThreats
//   - 见 src/config/variants/full.ts:52-100

import { describe, expect, it } from 'vitest';
import { SITE_VARIANTS, isSiteVariant } from '@/config/variant';
import { DEFAULT_MAP_LAYERS } from '@/config/variants/full';
import type { securityMeta } from '@/config/variants/security';

const SIX_LAYER_IDS = [
  'military',      // 军事
  'conflicts',     // 冲突
  'natural',       // 气候 (含地震/野火)
  'ais',           // 船舶
  'flights',       // 航空
  'cyberThreats',  // 网络威胁
] as const;

describe('security variant skeleton', () => {
  it('6 面板硬约束: full variant DEFAULT_MAP_LAYERS 含全部 6 key', () => {
    for (const id of SIX_LAYER_IDS) {
      expect(
        id in DEFAULT_MAP_LAYERS,
        `layer ${id} must exist in full variant DEFAULT_MAP_LAYERS`,
      ).toBe(true);
    }
  });

  it('security variant 已被注册到 SITE_VARIANTS', () => {
    // spec §1.5 验收: SITE_VARIANTS 加 'security'
    expect((SITE_VARIANTS as readonly string[]).includes('security')).toBe(true);
    expect(isSiteVariant('security')).toBe(true);
  });

  it('security.ts 导出 4 个核心符号', async () => {
    const mod = await import('@/config/variants/security');
    expect(typeof mod.SECURITY_VARIANT).toBe('string');
    expect((mod.SECURITY_VARIANT as string) === 'security').toBe(true);
    expect(typeof mod.securityMeta).toBe('object');
    expect(typeof mod.registerSecurityVariant).toBe('function');
    // mountSecurityPanels lives in app/ (config/ may not import components/).
    const appMod = await import('@/app/security-variant-panels');
    expect(typeof appMod.mountSecurityPanels).toBe('function');
  });

  it('securityMeta 含必填字段 (title/description/keywords/shortName)', async () => {
    const mod = await import('@/config/variants/security');
    const meta: VariantMeta = mod.securityMeta;
    expect(meta.title).toBeTruthy();
    expect(meta.description).toBeTruthy();
    expect(meta.keywords).toBeTruthy();
    expect(meta.shortName).toBeTruthy();
  });
});

import type { VariantMeta } from '@/config/variant-meta';
