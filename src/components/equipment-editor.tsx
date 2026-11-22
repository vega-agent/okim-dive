'use client'
import { useId, useState } from 'react'
import { Equipment, ITEMS, SIZES, RENTAL_NOTICE, equipmentFromProfile } from '@/lib/diver-equipment'

// M6 owner revision (2026-11-21): My Okim renders equipment as separate
// "Equipment" and "Sizes & fit" sub-cards sharing ONE state. The hook + section
// components below are exported for that; the default EquipmentEditor keeps the
// exact previous single-fieldset output for the booking wizard and profile.
export function useEquipmentValue(initial: Equipment | undefined, profile: unknown, onChange?: (e: Equipment) => void) {
  const [value, setValue] = useState(initial ?? equipmentFromProfile(profile))
  const update = (v: Equipment) => { setValue(v); onChange?.(v) }
  return { value, update }
}

type SectionProps = { value: Equipment; update: (e: Equipment) => void; locale?: 'en' | 'zh'; disabled?: boolean; idPrefix?: string }

export function EquipmentChoices({ value, update, profile, locale = 'en', disabled = false, idPrefix }: SectionProps & { profile?: unknown }) {
  const autoPrefix = useId()
  const prefix = idPrefix ?? autoPrefix
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0 }}>
    <input type="hidden" name="equipment" value={JSON.stringify(value)} />
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(['own', 'rent', 'none'] as const).map((choice, i) => <button style={{ minHeight: 44 }} className="btn btn-secondary" key={choice} type="button" onClick={() => update({ ...value, choices: Object.fromEntries(ITEMS.map(([id]) => [id, choice])) })}>{[t('Bring all', '全部自带'), t('Rent all', '全部需租'), t('Remove all', '全部不需要')][i]}</button>)}<button style={{ minHeight: 44 }} className="btn btn-secondary" type="button" onClick={() => update(equipmentFromProfile(profile))}>{t('Reset from profile', '从资料重置')}</button></div>
    {(['own', 'rent', 'none'] as const).map((choice, i) => <section key={choice}><h4>{[t('Bringing my own', '自带装备'), t('May need to rent', '可能需要租赁'), t('Not needed', '不需要')][i]}</h4>{ITEMS.filter(([id]) => value.choices[id] === choice).map(([id, en, zh]) => <div key={id} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><label htmlFor={`${prefix}-equipment-${id}`}>{t(en, zh)}</label><select id={`${prefix}-equipment-${id}`} style={{ minHeight: 44, maxWidth: '65%' }} value={choice} onChange={e => update({ ...value, choices: { ...value.choices, [id]: e.target.value as 'own' | 'rent' | 'none' } })}><option value="own">{t('Bringing my own', '自带')}</option><option value="rent">{t('May need to rent', '可能需租')}</option><option value="none">{t('Not needed', '不需要')}</option></select></div>)}</section>)}
  </fieldset>
}

export function EquipmentSizes({ value, update, locale = 'en', disabled = false, profileMode = false, grid = false }: SectionProps & { profileMode?: boolean; grid?: boolean }) {
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const rental = Object.values(value.choices).includes('rent')
  if (grid || profileMode) {
    // Owner revision: 3-column size grid matching the field grids above, with
    // fit/other notes as multi-line textareas at the very bottom.
    const on = (id: 'wetsuit' | 'bcd') => profileMode || value.choices[id] === 'rent'
    const footOn = profileMode || value.choices.boots === 'rent' || value.choices.fins === 'rent'
    const off = (active: boolean) => active ? '' : ' eq-size-off'
    const hint = (active: boolean) => active ? undefined : t('Only needed when rented', '仅租赁时需要')
    return <fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0 }}>
      <div className="eq-sizes-grid">
        <label className={'eq-size-cell' + off(on('wetsuit'))} title={hint(on('wetsuit'))}>{t('Wetsuit size', '湿衣尺码')}<select disabled={!on('wetsuit')} style={{ minHeight: 44 }} value={value.wetsuit} onChange={e => update({ ...value, wetsuit: e.target.value })}>{SIZES.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className={'eq-size-cell' + off(on('bcd'))} title={hint(on('bcd'))}>{t('BCD size', 'BCD 尺码')}<select disabled={!on('bcd')} style={{ minHeight: 44 }} value={value.bcd} onChange={e => update({ ...value, bcd: e.target.value })}>{SIZES.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className={'eq-size-cell' + off(footOn)} title={hint(footOn)}>{t('Footwear size', '鞋码')}<span className="eq-foot"><input disabled={!footOn} style={{ minHeight: 44 }} value={value.footwear} onChange={e => update({ ...value, footwear: e.target.value })} /><select disabled={!footOn} style={{ minHeight: 44 }} value={value.footwearUnit} onChange={e => update({ ...value, footwearUnit: e.target.value })}>{['EU', 'UK', 'US'].map(s => <option key={s}>{s}</option>)}</select></span></label>
      </div>
      <div className="eq-notes-grid">
        <label>{t('Optional fit note', '合身备注（选填）')}<textarea maxLength={200} rows={3} value={value.fitNote} onChange={e => update({ ...value, fitNote: e.target.value })} /></label>
        <label>{t('Other equipment note', '其他装备备注')}<textarea maxLength={200} rows={3} value={value.otherNote} onChange={e => update({ ...value, otherNote: e.target.value })} /></label>
      </div>
    </fieldset>
  }
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0 }}>
    {(['wetsuit', 'bcd'] as const).filter(id => profileMode || value.choices[id] === 'rent').map(id => <label key={id} style={{ display: 'block' }}>{t(id === 'bcd' ? 'Approximate BCD size' : 'Approximate wetsuit size', id === 'bcd' ? 'BCD 大致尺码' : '湿衣大致尺码')}<select style={{ minHeight: 44 }} value={value[id]} onChange={e => update({ ...value, [id]: e.target.value })}>{SIZES.map(s => <option key={s}>{s}</option>)}</select></label>)}
    {(profileMode || value.choices.boots === 'rent' || value.choices.fins === 'rent') && <label>{t('Footwear size (or Unsure)', '鞋码（或 Unsure）')}<input style={{ minHeight: 44 }} value={value.footwear} onChange={e => update({ ...value, footwear: e.target.value })} /><select style={{ minHeight: 44 }} value={value.footwearUnit} onChange={e => update({ ...value, footwearUnit: e.target.value })}>{['EU', 'UK', 'US'].map(s => <option key={s}>{s}</option>)}</select></label>}
    {(profileMode || rental) && <label>{t('Optional fit note', '合身备注（选填）')}<input maxLength={200} style={{ minHeight: 44 }} value={value.fitNote} onChange={e => update({ ...value, fitNote: e.target.value })} /></label>}
    <label>{t('Other equipment note', '其他装备备注')}<input maxLength={200} style={{ minHeight: 44 }} value={value.otherNote} onChange={e => update({ ...value, otherNote: e.target.value })} /></label>
  </fieldset>
}

export function EquipmentNotices({ locale = 'en' }: { locale?: 'en' | 'zh' }) {
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  return <>
    <p>{RENTAL_NOTICE[locale === 'zh' ? 1 : 0]}</p>
    <p>{t('Rental cost and payment are arranged at the dive shop on the trip, outside your invoice, balance and points. Contact Iris about safe participation or refunds.', '租赁费用与付款在行程期间于潜店安排，不计入发票、余额或积分。安全参与或退款问题请联系 Iris。')}</p>
  </>
}

export default function EquipmentEditor({ initial, profile, locale = 'en', disabled = false, profileMode = false, notices = true, onChange }: { initial?: Equipment; profile?: unknown; locale?: 'en' | 'zh'; disabled?: boolean; profileMode?: boolean; notices?: boolean; onChange?: (e: Equipment) => void }) {
  const prefix = useId()
  const { value, update } = useEquipmentValue(initial, profile, onChange)
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0 }}><legend>{t('Equipment planning', '装备计划')}</legend>
    {profileMode && <input type="hidden" name="equipment" value={JSON.stringify(value)} />}
    {profileMode && ITEMS.map(([id, en, zh]) => <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}><input type="checkbox" style={{ width: 24, height: 24 }} checked={value.choices[id] === 'own'} onChange={e => update({ ...value, choices: { ...value.choices, [id]: e.target.checked ? 'own' : 'rent' } })} />{t(en, zh)}</label>)}
    {!profileMode && <EquipmentChoices value={value} update={update} profile={profile} locale={locale} disabled={disabled} idPrefix={prefix} />}
    <EquipmentSizes value={value} update={update} locale={locale} disabled={disabled} profileMode={profileMode} />
    {notices && <EquipmentNotices locale={locale} />}
  </fieldset>
}