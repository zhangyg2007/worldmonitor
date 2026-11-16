// tests/dom/security-variant-country-risk.test.mts
// country-risk 服务 + 风险热力层
//
// 2026-11-12: 数据源由 mock 改为真实的 CII 风险评分服务
// (/api/intelligence/v1/get-risk-scores)。本文件同时覆盖两条路径:
//   1) 真实服务可用  → mock:false, 带 advisoryLevel / trend / 中文名
//   2) 真实服务不可用 → 降级到静态 MOCK, mock:true (UI 打 demo data 水印)
// 之前只有第 2 条被覆盖 —— 单元测试直接实例化组件, 测不到取数路径。

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const REAL_RESPONSE = {
  ciiScores: [
    {
      region: 'UA',
      combinedScore: 74,
      trend: 'TREND_DIRECTION_RISING',
      components: {
        newsActivity: 0.4,
        ciiContribution: 0.3,
        geoConvergence: 0.6,
        militaryActivity: 0.5,
      },
      computedAt: 1794467491761,
      advisoryLevel: 'do-not-travel',
      advisoryProvenance: 'fixture',
    },
    {
      region: 'CN',
      combinedScore: 35,
      trend: 'TREND_DIRECTION_STABLE',
      components: {
        newsActivity: 0.2,
        ciiContribution: 0.1,
        geoConvergence: 0.05,
        militaryActivity: 0.05,
      },
      computedAt: 1794467491761,
      advisoryLevel: '',
      advisoryProvenance: 'fixture',
    },
  ],
  strategicRisks: [],
  degraded: false,
  stale: false,
};

/** 让 intelligence 客户端的 getRiskScores 返回指定值（或抛错）。 */
function stubRiskScores(impl: () => Promise<unknown>): void {
  vi.doMock('@/services/generated-rpc-clients', () => ({
    IntelligenceServiceClient: class {
      getRiskScores = impl;
    },
  }));
  vi.doMock('@/services/rpc-client', () => ({
    getRpcBaseUrl: () => 'http://localhost:3000',
  }));
}

describe('country-risk service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/services/generated-rpc-clients');
    vi.doUnmock('@/services/rpc-client');
    vi.resetModules();
  });

  it('真实服务可用: 返回真实 CII 评分, mock=false, 映射 advisoryLevel/trend/中文名', async () => {
    stubRiskScores(async () => REAL_RESPONSE);
    const { getRiskScores } = await import('@/services/country-risk');
    const all = await getRiskScores();

    expect(all.length).toBe(2);
    expect(all.every(s => s.mock === false)).toBe(true);

    const ua = all.find(s => s.iso2 === 'UA');
    expect(ua?.score).toBe(74);
    expect(ua?.name).toBe('乌克兰');          // 中文名映射
    expect(ua?.advisoryLevel).toBe('do-not-travel');
    expect(ua?.trend).toBe('rising');
    expect(ua?.computedAt).toBe(new Date(1794467491761).toISOString());
    // geoConvergence → conflict, newsActivity → sentiment
    expect(ua?.factors.conflict).toBeCloseTo(0.6);
    expect(ua?.factors.sentiment).toBeCloseTo(0.4);

    // 空 advisoryLevel → null（不伪造）
    expect(all.find(s => s.iso2 === 'CN')?.advisoryLevel).toBeNull();
  });

  it('真实服务不可用: 降级到 MOCK, mock=true, 不抛错', async () => {
    stubRiskScores(async () => { throw new Error('offline'); });
    const { getRiskScores } = await import('@/services/country-risk');
    const all = await getRiskScores();

    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(all.every(s => s.mock === true)).toBe(true);
    expect(all.find(s => s.iso2 === 'IR')?.name).toBe('伊朗');
  });

  it('真实服务返回空: 同样降级到 MOCK', async () => {
    stubRiskScores(async () => ({ ciiScores: [], strategicRisks: [], degraded: true, stale: true }));
    const { getRiskScores } = await import('@/services/country-risk');
    const all = await getRiskScores();
    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(all.every(s => s.mock === true)).toBe(true);
  });

  it('RiskScore 类型: 5 因子 + 总分 + iso2 + mock 标记', async () => {
    const { getRiskScores } = await import('@/services/country-risk');
    const all = await getRiskScores();
    expect(all.length).toBeGreaterThanOrEqual(3);

    for (const s of all) {
      expect(typeof s.iso2).toBe('string');
      expect(s.iso2.length).toBe(2);
      expect(typeof s.name).toBe('string');
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(typeof s.mock).toBe('boolean');
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

    const miss = await getRiskScore('XX');
    expect(miss).toBeNull();
  });
});

describe('RiskHeatmapPanel 挂载', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="risk-heatmap-container"></div>';
    // Stub the RPC client so the panel never reaches for the production API:
    // getRpcBaseUrl() falls back to the public host when nothing is
    // configured, and an unmocked mount would attempt a real outbound call.
    stubRiskScores(async () => REAL_RESPONSE);
    // The country geometry service fetches /data/countries.geojson; stub it so
    // the unit test never touches the network for centroids.
    vi.doMock('@/services/country-geometry', () => ({
      preloadCountryGeometry: async () => {},
      isCountryGeometryLoaded: () => true,
      getCountryCentroid: (code: string) => {
        const table: Record<string, [number, number]> = {
          UA: [31.2, 49.4], CN: [35.8, 104.1], IR: [32.4, 53.6],
        };
        const hit = table[code];
        return hit ? { lat: hit[0], lon: hit[1] } : null;
      },
    }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.doUnmock('@/services/generated-rpc-clients');
    vi.doUnmock('@/services/rpc-client');
    vi.doUnmock('@/services/country-geometry');
    vi.resetModules();
  });

  it('mount() 在容器存在时不抛错', async () => {
    const { RiskHeatmapPanel } = await import('@/components/RiskHeatmapPanel');
    const panel = new RiskHeatmapPanel({
      containerId: 'risk-heatmap-container',
      center: [0, 0],
      zoom: 2,
    });
    await expect(panel.mount()).resolves.not.toThrow();
    // 真实数据不打 "demo data" 水印
    expect(document.querySelector('.risk-heatmap-watermark')).toBeNull();
    // 调试标记记录了真实数据点数
    const debug = document.querySelector('.risk-heatmap-debug');
    expect(Number(debug?.getAttribute('data-point-count'))).toBeGreaterThan(0);
  });

  it('mount() 降级到 mock 时加 "demo data" 水印', async () => {
    vi.doMock('@/services/generated-rpc-clients', () => ({
      IntelligenceServiceClient: class {
        getRiskScores = async () => { throw new Error('offline'); };
      },
    }));
    vi.resetModules();
    const { RiskHeatmapPanel } = await import('@/components/RiskHeatmapPanel');
    const panel = new RiskHeatmapPanel({
      containerId: 'risk-heatmap-container',
      center: [0, 0],
      zoom: 2,
    });
    await expect(panel.mount()).resolves.not.toThrow();
    expect(document.querySelector('.risk-heatmap-watermark')?.textContent).toBe('demo data');
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
    stubRiskScores(async () => REAL_RESPONSE);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.doUnmock('@/services/generated-rpc-clients');
    vi.doUnmock('@/services/rpc-client');
    vi.resetModules();
  });

  it('Task 2 阶段 mountSecurityPanels 调用 RiskHeatmapPanel', async () => {
    const mod = await import('@/app/security-variant-panels');
    await expect(mod.mountSecurityPanels()).resolves.not.toThrow();
  });
});
