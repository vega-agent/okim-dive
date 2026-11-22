export const ITEMS = [['mask','Mask','面镜'],['snorkel','Snorkel','呼吸管'],['fins','Fins','脚蹼'],['boots','Boots','潜水靴'],['wetsuit','Wetsuit / exposure suit','湿衣／防护衣'],['bcd','BCD','浮力调节装置'],['regulator','Regulator set','调节器组'],['computer','Dive computer','潜水电脑'],['smb','SMB / DSMB','水面标志浮标'],['torch','Torch','潜水灯'],['camera','Action camera','运动相机'],['other','Other','其他']] as const
export const SIZES = ['XS','S','M','L','XL','XXL','Other','Unsure']
export type Equipment = { choices: Record<string, 'own' | 'rent' | 'none'>; wetsuit: string; bcd: string; footwear: string; footwearUnit: string; fitNote: string; otherNote: string }
export function equipmentFromProfile(raw: unknown): Equipment {
  const p = (raw ?? {}) as Partial<Equipment>
  return { choices: Object.fromEntries(ITEMS.map(([id]) => [id, p.choices?.[id] === 'own' ? 'own' : p.choices?.[id] === 'none' ? 'none' : 'rent'])), wetsuit:p.wetsuit ?? 'Unsure', bcd:p.bcd ?? 'Unsure', footwear:p.footwear ?? 'Unsure', footwearUnit:p.footwearUnit ?? 'EU', fitNote:p.fitNote ?? '', otherNote:p.otherNote ?? '' }
}
export function parseEquipment(raw: unknown): Equipment | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Equipment
  if (!p.choices || ITEMS.some(([id]) => !['own','rent','none'].includes(p.choices[id]))) return null
  if (!SIZES.includes(p.wetsuit) || !SIZES.includes(p.bcd) || !['EU','UK','US'].includes(p.footwearUnit)) return null
  if (typeof p.footwear !== 'string' || !/^(Unsure|\d{1,2}(\.5)?)$/.test(p.footwear)) return null
  if ([p.fitNote,p.otherNote].some(x => typeof x !== 'string' || x.length > 200)) return null
  return { choices:Object.fromEntries(ITEMS.map(([id]) => [id,p.choices[id]])), wetsuit:p.wetsuit,bcd:p.bcd,footwear:p.footwear,footwearUnit:p.footwearUnit,fitNote:p.fitNote,otherNote:p.otherNote }
}
export function activeUpcoming(status:string, tripStatus:string, departure:Date|null, now=new Date()) {
  return ['awaiting_deposit','payment_claimed','deposit_verified','confirmed'].includes(status) && !['draft','departed','completed','cancelled'].includes(tripStatus) && !!departure && departure.getTime()>now.getTime()
}
export function equipmentEditable(status:string, tripStatus:string, departure:Date|null, now=new Date()) {
  return activeUpcoming(status,tripStatus,departure,now) && departure!.getTime()-now.getTime()>86400000
}
export const RENTAL_NOTICE = ['Rental items are subject to availability at the dive shop. This list indicates your needs only—it does not reserve equipment or confirm availability, fit, or price.','租赁装备以潜店实际供应为准。此清单仅说明你的需求，不代表预留装备，也不确认供应、合身程度或价格。'] as const
