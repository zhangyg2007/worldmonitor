// services/country-risk: 国别风险评分聚合服务
// 首阶段: mock 数据 (5 个示例国家) — W4-W6 阶段接真后端 /api/country-risk
// 标 mock=true 避免与真数据混淆

export interface RiskFactor {
  conflict: number;      // 0-1, 冲突密度 (ACLED/UCDP)
  sanctions: number;     // 0-1, 制裁命中 (OFAC/EU/UN/UK/MOFCOM)
  economic: number;      // 0-1, 经济风险 (WorldBank)
  displacement: number;  // 0-1, 流离失所 (UNHCR)
  sentiment: number;     // 0-1, 舆情负面 (GDELT)
}

export interface RiskScore {
  iso2: string;          // ISO 3166-1 alpha-2
  name: string;          // 中文名
  score: number;         // 0-100, 加权和
  factors: RiskFactor;
  /** mock 数据标记, 真后端接通后改为 false 或删除字段 */
  mock: true;
}

const MOCK: RiskScore[] = [
  { iso2: 'IR', name: '伊朗', score: 82,
    factors: { conflict: 0.9, sanctions: 0.95, economic: 0.7, displacement: 0.6, sentiment: 0.8 },
    mock: true },
  { iso2: 'RU', name: '俄罗斯', score: 78,
    factors: { conflict: 0.85, sanctions: 0.9, economic: 0.7, displacement: 0.5, sentiment: 0.7 },
    mock: true },
  { iso2: 'CN', name: '中国', score: 35,
    factors: { conflict: 0.1, sanctions: 0.3, economic: 0.4, displacement: 0.1, sentiment: 0.5 },
    mock: true },
  { iso2: 'US', name: '美国', score: 25,
    factors: { conflict: 0.2, sanctions: 0.1, economic: 0.3, displacement: 0.2, sentiment: 0.3 },
    mock: true },
  { iso2: 'BR', name: '巴西', score: 42,
    factors: { conflict: 0.5, sanctions: 0.2, economic: 0.5, displacement: 0.3, sentiment: 0.4 },
    mock: true },
];

export async function getRiskScores(): Promise<RiskScore[]> {
  // 首阶段同步返回; 真后端阶段改为 await fetch('/api/country-risk')
  return [...MOCK];
}

export async function getRiskScore(iso2: string): Promise<RiskScore | null> {
  if (!iso2) return null;
  return MOCK.find(r => r.iso2.toUpperCase() === iso2.toUpperCase()) || null;
}
