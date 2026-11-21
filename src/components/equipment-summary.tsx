'use client'

// M6 i18n fix: equipment summaries render in the active portal locale only
// (were hardcoded "EN / 中文" literals leaking Chinese onto EN surfaces).
import { useLocale, pick } from '@/lib/use-locale'
import { ITEMS, Equipment, SIZES } from '@/lib/diver-equipment'

export default function EquipmentSummary({ value }: { value: unknown }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  if (!value) return <p>{t('Not provided', '未提供')}</p>
  const e = value as Equipment
  const groups = [['own', 'Bringing my own', '自带'], ['rent', 'May need to rent', '可能需租'], ['none', 'Not needed', '不需要']] as const
  return <div>
    {groups.map(([c, en, zh]) => <p key={c}><strong>{t(en, zh)}: </strong>{ITEMS.filter(([id]) => e.choices?.[id] === c).map(([id, ien, izh]) => pick(locale, ien, izh)).join(' · ') || '—'}</p>)}
    {(['wetsuit', 'bcd'] as const).filter(id => e.choices?.[id] === 'rent').map(id => <p key={id}>{id === 'bcd' ? 'BCD' : t('Wetsuit', '湿衣')}: {SIZES.includes(e[id]) ? e[id] : t('Unsure', '不确定')}</p>)}
    {(e.choices?.boots === 'rent' || e.choices?.fins === 'rent') && <p>{t('Footwear', '鞋码')}: {e.footwear} {e.footwearUnit}</p>}
    {e.fitNote && <p>{t('Fit note', '合身备注')}: {e.fitNote}</p>}
    {e.otherNote && <p>{t('Other', '其他')}: {e.otherNote}</p>}
  </div>
}