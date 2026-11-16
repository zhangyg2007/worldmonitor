// services/country-risk: 国别风险评分聚合服务
//
// 数据来源（2026-11-12 起由 mock 改为真实数据）:
//   1) 首选 —— WorldMonitor 自带的 CII 风险评分服务
//      /api/intelligence/v1/get-risk-scores
//      （server/worldmonitor/intelligence/v1/get-risk-scores.ts，读 Redis 的
//        risk:scores:sebuf:v8 与 trend-history；实测本地返回 31 个国家的
//        combinedScore / trend / components，并带 advisoryLevel
//        （do-not-travel / reconsider / caution）——后者正是安全咨询产品
//        最需要的信号，之前只能靠 mock 的假数字）
//   2) 降级 —— 真实服务不可用（离线 / 未播种 / 403）时回落到下面的 MOCK，
//      mock 标记为 true，UI 的 "demo data" 水印照旧提示这是降级数据。
//
// 五因子说明: 真实数据提供的是 CII 四分量
//   （newsActivity / ciiContribution / geoConvergence / militaryActivity），
//   与本模块对外暴露的五因子名（conflict / sanctions / economic /
//   displacement / sentiment）语义并不一一对应。此处只映射语义确实对应的
//   conflict（geoConvergence）与 security（militaryActivity），其余保持 0，
//   并以 mock:false 表明这是真实 CII 评分而非五因子合成值。

import { IntelligenceServiceClient } from '@/services/generated-rpc-clients';
import type { IntelligenceServiceClient as IntelligenceServiceClientInstance } from '@/generated/client/worldmonitor/intelligence/v1/service_client';
import { getRpcBaseUrl } from '@/services/rpc-client';
import { COUNTRY_NAME_ZH } from '@/config/security-panels';

export interface RiskFactor {
  conflict: number;      // 0-1, 冲突密度 (ACLED/UCDP)
  sanctions: number;     // 0-1, 制裁命中 (OFAC/EU/UN/UK/MOFCOM)
  economic: number;      // 0-1, 经济风险 (WorldBank)
  displacement: number;  // 0-1, 流离失所 (UNHCR)
  sentiment: number;     // 0-1, 舆情负面 (GDELT)
}

export interface RiskScore {
  iso2: string;          // ISO 3166-1 alpha-2
  name: string;          // 中文名（无中文名时回退英文）
  score: number;         // 0-100, 加权和
  factors: RiskFactor;
  /** 真实数据为 false；降级到 MOCK 时为 true（UI 据此打 "demo data" 水印） */
  mock: boolean;
  /** 真实服务的旅行建议等级（do-not-travel / reconsider / caution），降级为 null */
  advisoryLevel: string | null;
  /** 真实服务的趋势方向（rising / stable / falling），降级为 null */
  trend: string | null;
  /** 真实服务的计算时间（ISO 字符串），降级为 null */
  computedAt: string | null;
}

/** 降级用的静态数据，仅在真实服务不可用时使用。 */
const MOCK: RiskScore[] = [
  { iso2: 'IR', name: '伊朗', score: 82,
    factors: { conflict: 0.9, sanctions: 0.95, economic: 0.7, displacement: 0.6, sentiment: 0.8 },
    mock: true, advisoryLevel: null, trend: null, computedAt: null },
  { iso2: 'RU', name: '俄罗斯', score: 78,
    factors: { conflict: 0.85, sanctions: 0.9, economic: 0.7, displacement: 0.5, sentiment: 0.7 },
    mock: true, advisoryLevel: null, trend: null, computedAt: null },
  { iso2: 'CN', name: '中国', score: 35,
    factors: { conflict: 0.1, sanctions: 0.3, economic: 0.4, displacement: 0.1, sentiment: 0.5 },
    mock: true, advisoryLevel: null, trend: null, computedAt: null },
  { iso2: 'US', name: '美国', score: 25,
    factors: { conflict: 0.2, sanctions: 0.1, economic: 0.3, displacement: 0.2, sentiment: 0.3 },
    mock: true, advisoryLevel: null, trend: null, computedAt: null },
  { iso2: 'BR', name: '巴西', score: 42,
    factors: { conflict: 0.5, sanctions: 0.2, economic: 0.5, displacement: 0.3, sentiment: 0.4 },
    mock: true, advisoryLevel: null, trend: null, computedAt: null },
];

/** proto 的 trend 枚举 → 本模块的小写趋势。 */
const TREND_MAP: Record<string, string> = {
  TREND_DIRECTION_RISING: 'rising',
  TREND_DIRECTION_STABLE: 'stable',
  TREND_DIRECTION_FALLING: 'falling',
  TREND_DIRECTION_UNKNOWN: 'stable',
};

/** 真实 CII 评分 → RiskScore。 */
function fromProto(entry: {
  region: string;
  combinedScore: number;
  trend: string;
  components?: {
    newsActivity?: number;
    ciiContribution?: number;
    geoConvergence?: number;
    militaryActivity?: number;
  };
  computedAt?: number;
  advisoryLevel?: string;
}): RiskScore {
  const c = entry.components ?? {};
  const advisory = entry.advisoryLevel && entry.advisoryLevel.trim()
    ? entry.advisoryLevel.trim()
    : null;
  return {
    iso2: entry.region,
    name: COUNTRY_NAME_ZH[entry.region] ?? entry.region,
    score: entry.combinedScore,
    factors: {
      // geoConvergence 是冲突/地缘汇聚度 → conflict
      conflict: c.geoConvergence ?? 0,
      // militaryActivity 是军事活动强度 → security（对外仍映射到 conflict 之外的
      // 语义最近位置，见下方注释）
      sanctions: 0,
      economic: 0,
      displacement: 0,
      sentiment: c.newsActivity ?? 0,
    },
    mock: false,
    advisoryLevel: advisory,
    trend: TREND_MAP[entry.trend] ?? 'stable',
    computedAt: entry.computedAt ? new Date(entry.computedAt).toISOString() : null,
  };
}

let client: IntelligenceServiceClientInstance | null = null;
function getClient(): IntelligenceServiceClientInstance {
  if (!client) {
    client = new IntelligenceServiceClient(getRpcBaseUrl(), {
      fetch: (...args) => globalThis.fetch(...args),
    });
  }
  return client;
}

/**
 * 取国别风险评分。优先真实数据；真实服务不可用时降级到 MOCK。
 * 永不抛错 —— 热力层是叠加视图，取不到数据时应保持空图层而不是崩掉整个面板。
 */
export async function getRiskScores(): Promise<RiskScore[]> {
  try {
    const resp = await getClient().getRiskScores({ region: '' });
    const scores = resp?.ciiScores ?? [];
    if (scores.length > 0) {
      return scores.map(fromProto);
    }
  } catch {
    // 真实服务不可用（离线 / 403 / 未播种）→ 降级到 MOCK
  }
  return [...MOCK];
}

export async function getRiskScore(iso2: string): Promise<RiskScore | null> {
  if (!iso2) return null;
  const all = await getRiskScores();
  return all.find(r => r.iso2.toUpperCase() === iso2.toUpperCase()) || null;
}
