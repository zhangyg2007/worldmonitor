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

/**
 * ISO2 → 中文国名。风险评分服务返回的是英文名（TIER1_COUNTRIES），
 * security variant 是中文界面，这里补一层中文。未收录的 ISO2 回退英文。
 *
 * 覆盖范围: 当前 CII 风险评分返回的全部 31 个国家，加上常见的高风险国家，
 * 以免上游新增国家时界面退化成英文（不报错，只是不够本地化）。
 */
export const COUNTRY_NAME_ZH: Record<string, string> = {
  UA: '乌克兰', SY: '叙利亚', YE: '也门', MM: '缅甸', AF: '阿富汗',
  IR: '伊朗', IL: '以色列', PK: '巴基斯坦', VE: '委内瑞拉', CU: '古巴',
  MX: '墨西哥', IQ: '伊拉克', LB: '黎巴嫩', RU: '俄罗斯', KP: '朝鲜',
  TR: '土耳其', TW: '中国台湾', CN: '中国', SA: '沙特阿拉伯', IN: '印度',
  EG: '埃及', BR: '巴西', KR: '韩国', PL: '波兰', FR: '法国',
  AE: '阿联酋', QA: '卡塔尔', US: '美国', DE: '德国', GB: '英国',
  JP: '日本', LY: '利比亚', SD: '苏丹', SO: '索马里', HT: '海地',
  ZW: '津巴布韦', CD: '刚果（金）', ML: '马里', BF: '布基纳法索',
  NE: '尼日尔', TD: '乍得', SS: '南苏丹', BI: '布隆迪', ER: '厄立特里亚',
  MZ: '莫桑比克', MG: '马达加斯加', BY: '白俄罗斯', NI: '尼加拉瓜',
};
