// RiskHeatmapPanel: 在 globe.gl 上叠加风险热力层
// 首阶段: ScatteredLayer (球面坐标更稳) + "demo data" 水印
// 真 HeatmapLayer 留 W4-W6 性能优化阶段
//
// 注意: 不替换 globe; 6 面板已有图层全部保留 (用户硬约束)

import { getRiskScores, type RiskScore } from '@/services/country-risk';

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
}

/** ISO2 → 中心经纬度 (5 个 mock 国家) */
const ISO2_COORDS: Record<string, [number, number]> = {
  IR: [53.6880, 32.4279],
  RU: [105.3188, 61.5240],
  CN: [104.1954, 35.8617],
  US: [-95.7129, 37.0902],
  BR: [-51.9253, -14.2350],
};

function iso2ToCoords(iso2: string): [number, number] {
  return ISO2_COORDS[iso2] || [0, 0];
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

  /** mock 数据水印 (避免与真数据混淆) */
  private renderWaterMark(): void {
    if (!this.container) return;
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

    const points: ScatteredPoint[] = this.scores.map(s => ({
      coordinates: iso2ToCoords(s.iso2),
      weight: s.score / 100,
      iso2: s.iso2,
      name: s.name,
    }));

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
