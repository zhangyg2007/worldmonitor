// security-panels: A 专属面板元数据
// 5 套制裁名单 (OFAC/EU/UN/UK/MOFCOM) + 后续 W4-W6 接真后端

export type SanctionsSource = 'ofac' | 'eu' | 'un' | 'uk' | 'mofcom';

export interface SanctionsListMeta {
  id: SanctionsSource;
  labelZh: string;
  labelEn: string;
  count: number;       // mock 命中数
  color: string;
}

export const SANCTIONS_LISTS: SanctionsListMeta[] = [
  { id: 'ofac',   labelZh: 'OFAC (美国)',   labelEn: 'OFAC',    count: 1247, color: '#1f77b4' },
  { id: 'eu',     labelZh: '欧盟',          labelEn: 'EU',      count: 892,  color: '#ff7f0e' },
  { id: 'un',     labelZh: '联合国',        labelEn: 'UN',      count: 654,  color: '#2ca02c' },
  { id: 'uk',     labelZh: '英国',          labelEn: 'UK',      count: 423,  color: '#d62728' },
  { id: 'mofcom', labelZh: 'MOFCOM (中国)', labelEn: 'MOFCOM',  count: 318,  color: '#9467bd' },
];

export const SANCTIONS_IDS: SanctionsSource[] = SANCTIONS_LISTS.map(s => s.id);
