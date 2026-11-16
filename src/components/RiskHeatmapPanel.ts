// RiskHeatmapPanel: 在 globe.gl 上叠加风险热力层
// 首阶段: ScatteredLayer (球面坐标更稳) + "demo data" 水印
// 真 HeatmapLayer 留 W4-W6 性能优化阶段
//
// 注意: 不替换 globe; 6 面板已有图层全部保留 (用户硬约束)

import { getRiskScores, type RiskScore } from '@/services/country-risk';
import { getCountryCentroid, preloadCountryGeometry } from '@/services/country-geometry';

export interface RiskHeatmapPanelOptions {
  containerId: string;
  center: [number, number];
  zoom: number;
}

interface ScatteredPoint {
  coordinates: [number, number];
  weight: number;
  iso2: string;
  name: string;
  advisoryLevel: string | null;
  trend: string | null;
  mock: boolean;
}

/**
 * ISO2 → 中心经纬度。
 *
 * 以前是 5 个 mock 国家的硬编码表，真实数据回来后（31 国）其余国家会落到
 * [0,0]，热力层会画到几内亚湾。现在改用仓库既有的国家几何服务
 * (src/services/country-geometry.ts) 从 countries.geojson 的 bbox 算质心，
 * 覆盖全部有几何的国家；几何未加载时回落到坐标表。
 */
const ISO2_COORDS_FALLBACK: Record<string, [number, number]> = {
  IR: [53.6880, 32.4279],
  RU: [105.3188, 61.5240],
  CN: [104.1954, 35.8617],
  US: [-95.7129, 37.0902],
  BR: [-51.9253, -14.2350],
};

function iso2ToCoords(iso2: string): [number, number] | null {
  const centroid = getCountryCentroid(iso2);
  if (centroid) {
    return [centroid.lat, centroid.lon];
  }
  return ISO2_COORDS_FALLBACK[iso2] ?? null;
}

export class RiskHeatmapPanel {
  private scores: RiskScore[] = [];
  private container: HTMLElement | null = null;
  private deckLayer: { type: string; data: ScatteredPoint[] } | null = null;

  constructor(private opts: RiskHeatmapPanelOptions) {}

  async mount(): Promise<void> {
    this.container = document.getElementById(this.opts.containerId);
    if (!this.container) {
      throw new Error(`Container ${this.opts.containerId} not found`);
    }

    this.scores = await getRiskScores();
    // 几何服务可能尚未加载（首次进入时 App 的预加载还在途），先确保加载完，
    // 否则国家质心取不到，热力点会缺失。
    await preloadCountryGeometry();
    this.renderWaterMark();
    this.attachDeckLayer();
  }

  unmount(): void {
    if (this.container) {
      this.container.replaceChildren();
    }
    this.deckLayer = null;
    this.container = null;
  }

  /**
   * 数据来源水印。只有在真实服务不可用、降级到 mock 数据时才标 "demo data"；
   * 真实 CII 评分不标，避免把真数据误当成演示数据。
   */
  private renderWaterMark(): void {
    if (!this.container) return;
    if (!this.scores.some(s => s.mock)) return;
    const mark = document.createElement('div');
    mark.className = 'risk-heatmap-watermark';
    mark.textContent = 'demo data';
    mark.style.cssText =
      'position:absolute;top:8px;right:8px;background:rgba(255,200,0,0.85);' +
      'color:#000;padding:2px 8px;font-size:11px;border-radius:3px;z-index:10;';
    this.container.appendChild(mark);
  }

  /**
   * 接 deck.gl ScatteredLayer.
   * 真实接入需与 globe.gl 实例共享 deck 实例, 此处只 stub 数据。
   * TODO(Task W4-W6): 用 deck.gl 的 deckOverlay 实际渲染到 globe。
   */
  private attachDeckLayer(): void {
    if (!this.container) return;

    const points: ScatteredPoint[] = [];
    for (const s of this.scores) {
      const coords = iso2ToCoords(s.iso2);
      // 没有坐标的国家直接跳过，不要画到 [0,0]。
      if (!coords) continue;
      points.push({
        coordinates: coords,
        weight: s.score / 100,
        iso2: s.iso2,
        name: s.name,
        advisoryLevel: s.advisoryLevel ?? null,
        trend: s.trend ?? null,
        mock: s.mock,
      });
    }

    this.deckLayer = {
      type: 'ScatterplotLayer',
      data: points,
    };

    // DOM 调试标记 (headless 测试可验证)
    const debug = document.createElement('div');
    debug.className = 'risk-heatmap-debug';
    debug.dataset.pointCount = String(points.length);
    debug.style.cssText = 'display:none;';  // 隐藏, 仅供测试读取
    this.container.appendChild(debug);
  }

  getLayer(): { type: string; data: ScatteredPoint[] } | null {
    return this.deckLayer;
  }
}
