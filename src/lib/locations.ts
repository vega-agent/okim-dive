// Asian dive countries (owner 2026-11-22, MVP-SPEC #39): Settings picks a
// COUNTRY (Asia only for now) — local currency + timezone load automatically.
// The dive site and nearest airport are typed per trip (a dive-site dropdown
// would grow unbounded). Payment currency is separate: shops may charge USD
// even where the local currency differs. Adding a country = a code change.

export type CountryKey = 'malaysia' | 'indonesia' | 'thailand' | 'philippines' | 'japan' | 'maldives' | 'sri-lanka' | 'vietnam'

export type CountryInfo = {
  nameEn: string
  nameZh: string
  localCurrency: string
  timezone: string
}

export const COUNTRIES: Record<CountryKey, CountryInfo> = {
  malaysia: { nameEn: 'Malaysia', nameZh: '马来西亚', localCurrency: 'MYR', timezone: 'Asia/Kuala_Lumpur' },
  indonesia: { nameEn: 'Indonesia', nameZh: '印度尼西亚', localCurrency: 'IDR', timezone: 'Asia/Jakarta' },
  thailand: { nameEn: 'Thailand', nameZh: '泰国', localCurrency: 'THB', timezone: 'Asia/Bangkok' },
  philippines: { nameEn: 'Philippines', nameZh: '菲律宾', localCurrency: 'PHP', timezone: 'Asia/Manila' },
  japan: { nameEn: 'Japan', nameZh: '日本', localCurrency: 'JPY', timezone: 'Asia/Tokyo' },
  maldives: { nameEn: 'Maldives', nameZh: '马尔代夫', localCurrency: 'MVR', timezone: 'Indian/Maldives' },
  'sri-lanka': { nameEn: 'Sri Lanka', nameZh: '斯里兰卡', localCurrency: 'LKR', timezone: 'Asia/Colombo' },
  vietnam: { nameEn: 'Vietnam', nameZh: '越南', localCurrency: 'VND', timezone: 'Asia/Ho_Chi_Minh' },
}

export const COUNTRY_KEYS = Object.keys(COUNTRIES) as CountryKey[]

export function countryOf(key: string | null | undefined): CountryInfo {
  return COUNTRIES[(key as CountryKey) in COUNTRIES ? (key as CountryKey) : 'malaysia']
}

// Curated dive-site reference (owner 2026-11-22, MVP-SPEC #41): Iris TYPES the
// dive site; a case-insensitive match auto-displays nearest airport + jetty /
// transfer. No dive-site dropdown (would grow unbounded). Unknown sites show
// "—" until added here. Adding a site = a code change.
export type SiteInfo = {
  match: string[]
  airportEn: string
  airportZh: string
  jettyEn: string
  jettyZh: string
}

export const SITES: SiteInfo[] = [
  { match: ['tioman', '刁曼'], airportEn: 'Tioman Airport (TOD), or Kuala Lumpur (KUL)', airportZh: '刁曼岛机场（TOD），或吉隆坡（KUL）', jettyEn: 'Mersing / Tanjung Gemok jetty · ≈2 h ferry', jettyZh: '丰盛港 / 丹绒格莫码头 · 船程约 2 小时' },
  { match: ['sipadan', 'mabul', 'kapalai', '西巴丹', '马布', '卡帕莱'], airportEn: 'Tawau Airport (TWU)', airportZh: '斗湖机场（TWU）', jettyEn: 'Semporna jetty · ≈45 min boat', jettyZh: '仙本那码头 · 船程约 45 分钟' },
  { match: ['raja ampat', '四王', 'waigeo', 'misool'], airportEn: 'Sorong Airport (SOQ)', airportZh: '索龙机场（SOQ）', jettyEn: 'Sorong harbour · ≈2 h ferry to Waisai', jettyZh: '索龙港 · 往卫赛船程约 2 小时' },
  { match: ['perhentian', '停泊'], airportEn: 'Kuala Terengganu (TGG) or Kota Bharu (KBR)', airportZh: '瓜拉登嘉楼（TGG）或哥打巴鲁（KBR）', jettyEn: 'Kuala Besut jetty · ≈30 min boat', jettyZh: '瓜拉勿述码头 · 船程约 30 分钟' },
  { match: ['redang', '热浪'], airportEn: 'Kuala Terengganu (TGG)', airportZh: '瓜拉登嘉楼（TGG）', jettyEn: 'Merang / Shahbandar jetty · ≈45 min boat', jettyZh: '墨浪 /  Shahbandar 码头 · 船程约 45 分钟' },
  { match: ['phuket', 'similan', '普吉', '斯米兰'], airportEn: 'Phuket Airport (HKT)', airportZh: '普吉机场（HKT）', jettyEn: 'Thap Lamu pier · ≈1.5 h boat (Similan)', jettyZh: 'Thap Lamu 码头 · 往斯米兰船程约 1.5 小时' },
  { match: ['koh tao', '涛岛', 'sail rock'], airportEn: 'Koh Samui (USM) or Surat Thani (URT)', airportZh: '苏梅岛（USM）或素叻他尼（URT）', jettyEn: 'Surat Thani / Chumphon ferry · ≈1.5–2 h', jettyZh: '素叻他尼 / 春蓬渡轮 · 约 1.5–2 小时' },
  { match: ['coron', 'palawan', '科隆', '巴拉望'], airportEn: 'Busuanga (USU) or Puerto Princesa (PPS)', airportZh: '布苏安加（USU）或公主港（PPS）', jettyEn: 'Coron town pier · ≈30–60 min boat', jettyZh: '科隆镇码头 · 船程约 30–60 分钟' },
  { match: ['nusa penida', 'nusa lembongan', 'lombok', 'gili', '蓝梦', '吉利'], airportEn: 'Denpasar (DPS) or Lombok (LOP)', airportZh: '登巴萨（DPS）或龙目（LOP）', jettyEn: 'Sanur harbour · ≈30–45 min fast boat', jettyZh: '沙努尔港 · 快船约 30–45 分钟' },
  { match: ['maldives', '马尔代夫', 'male', '马累'], airportEn: 'Malé Airport (MLE)', airportZh: '马累机场（MLE）', jettyEn: 'Malé · speedboat or seaplane transfer', jettyZh: '马累 · 快艇或水上飞机接送' },
  { match: ['okinawa', '冲绳', 'kerama', '庆良间'], airportEn: 'Naha Airport (OKA)', airportZh: '那霸机场（OKA）', jettyEn: 'Naha / Chatan harbour · ≈30–60 min boat', jettyZh: '那霸 / 北谷港 · 船程约 30–60 分钟' },
]

export function matchSite(name: string | null | undefined): SiteInfo | null {
  const n = (name ?? '').toLowerCase().trim()
  if (!n) return null
  return SITES.find(s => s.match.some(m => n.includes(m))) ?? null
}