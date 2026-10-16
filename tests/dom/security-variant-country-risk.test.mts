// tests/dom/security-variant-country-risk.test.mts
// Task 2: 风险热力层 + country-risk mock
// 验证: country-risk 提供 RiskScore 类型与 getRiskScores/getRiskScore;
//       mountSecurityPanels 在 RiskHeatmapPanel 容器存在时返回 (不抛错)

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

describe('country-risk service', () => {
  it('RiskScore 类型: 5 因子 + 总分 + iso2 + mock 标记', async () => {
    const { getRiskScores, getRiskScore } = await import('@/services/country-risk');
    const all = await getRiskScores();
    expect(all.length).toBeGreaterThanOrEqual(3);

    for (const s of all) {
      expect(typeof s.iso2).toBe('string');
      expect(s.iso2.length).toBe(2);
      expect(typeof s.name).toBe('string');
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(s.mock).toBe(true);  // mock 标记必须为 true (避免与真数据混淆)
      // 5 因子 (冲突/制裁/经济/流离/舆情)
      for (const k of ['conflict', 'sanctions', 'economic', 'displacement', 'sentiment'] as const) {
        const v = s.factors[k];
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('getRiskScore(iso2): 命中返回 RiskScore; 不命中返回 null', async () => {
    const { getRiskScore } = await import('@/services/country-risk');
    const hit = await getRiskScore('IR');
    expect(hit).toBeTruthy();
    expect(hit?.name).toBe('伊朗');
    expect(hit?.mock).toBe(true);

    const miss = await getRiskScore('XX');
    expect(miss).toBeNull();
  });
});

describe('RiskHeatmapPanel 挂载', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="risk-heatmap-container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mount() 在容器存在时不抛错 + 加 "demo data" 水印', async () => {
    const { RiskHeatmapPanel } = await import('@/components/RiskHeatmapPanel');
    const panel = new RiskHeatmapPanel({
      containerId: 'risk-heatmap-container',
      center: [0, 0],
      zoom: 2,
    });
    await expect(panel.mount()).resolves.not.toThrow();
    const watermark = document.querySelector('.risk-heatmap-watermark');
    expect(watermark?.textContent).toBe('demo data');
  });

  it('mount() 在容器缺失时抛错', async () => {
    document.body.innerHTML = '';
    const { RiskHeatmapPanel } = await import('@/components/RiskHeatmapPanel');
    const panel = new RiskHeatmapPanel({
      containerId: 'nonexistent',
      center: [0, 0],
      zoom: 2,
    });
    await expect(panel.mount()).rejects.toThrow();
  });
});

describe('mountSecurityPanels 累加', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="risk-heatmap-container"></div>
      <div id="sanctions-filter-container"></div>
      <div id="security-sidebar-container"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Task 2 阶段 mountSecurityPanels 调用 RiskHeatmapPanel', async () => {
    const mod = await import('@/config/variants/security');
    await expect(mod.mountSecurityPanels()).resolves.not.toThrow();
  });
});
