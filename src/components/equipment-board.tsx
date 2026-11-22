'use client'

// M6 owner experiment (2026-11-21): equipment as pills in three side-by-side
// columns — Bring / Rent / No need. Divers move pills by drag (desktop) or by
// tapping a pill and choosing a destination (touch + keyboard). Columns
// auto-fill from the profile's equipment list via useEquipmentValue.
import { useEffect, useState } from 'react'
import { Equipment, ITEMS } from '@/lib/diver-equipment'

const COLS = [['own', 'Bring', '自带'], ['rent', 'Rent', '需租'], ['none', 'No need', '不需要']] as const
type Choice = 'own' | 'rent' | 'none'

export default function EquipmentBoard({ value, update, profile, locale = 'en', disabled = false, idPrefix }: {
  value: Equipment; update: (e: Equipment) => void; profile?: unknown; locale?: 'en' | 'zh'; disabled?: boolean; idPrefix?: string
}) {
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const [menu, setMenu] = useState<string | null>(null)
  const [drag, setDrag] = useState<string | null>(null)
  const move = (id: string, choice: Choice) => { update({ ...value, choices: { ...value.choices, [id]: choice } }); setMenu(null) }

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!(e.target as Element).closest('.eq-pill-wrap')) setMenu(null) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    document.addEventListener('click', close)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', key) }
  }, [menu])

  const prefix = idPrefix ?? 'eq'
  const allTo = (choice: Choice) => update({ ...value, choices: Object.fromEntries(ITEMS.map(([id]) => [id, choice])) })
  const iconFor = (choice: Choice) => choice === 'own' ? '/assets/icons/eq-bring-mask.webp' : choice === 'rent' ? '/assets/icons/eq-rent-tag.webp' : '/assets/icons/eq-remove-crossed-mask.webp'
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0 }}>
    <input type="hidden" name="equipment" value={JSON.stringify(value)} />
    <div className="eq-board" role="group" aria-label={t('Equipment columns: Bring, Rent, No need', '装备分类：自带、需租、不需要')}>
      {COLS.map(([choice, en, zh]) => {
        const items = ITEMS.filter(([id]) => value.choices[id] === choice)
        const allLabel = t(choice === 'own' ? 'Bring all' : choice === 'rent' ? 'Rent all' : 'Remove all', choice === 'own' ? '全部自带' : choice === 'rent' ? '全部需租' : '全部不需要')
        const allHint = t(choice === 'own' ? 'Move every item to Bring' : choice === 'rent' ? 'Move every item to Rent' : 'Mark every item not needed', choice === 'own' ? '将所有装备移入自带' : choice === 'rent' ? '将所有装备移入需租' : '将所有装备标记为不需要')
        return <div key={choice} className={`eq-col${drag ? ' eq-col-drop' : ''}`}
          onDragOver={e => { if (!disabled) e.preventDefault() }}
          onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && ITEMS.some(([i]) => i === id)) move(id, choice); setDrag(null) }}>
          <h4>{t(en, zh)}<span className="eq-count">{items.length}</span>
            <button type="button" className="eq-icon-btn" aria-label={allLabel} data-tip={allHint} onClick={() => allTo(choice)}><img src={iconFor(choice)} alt="" width={24} height={24} /></button>
          </h4>
          <div className="eq-pills">
            {items.map(([id, ien, izh]) => <span key={id} className="eq-pill-wrap">
              <button type="button" id={`${prefix}-pill-${id}`} className="eq-pill" draggable={!disabled}
                onDragStart={e => { e.dataTransfer.setData('text/plain', id); setDrag(id) }}
                onDragEnd={() => setDrag(null)}
                aria-haspopup="menu" aria-expanded={menu === id}
                aria-label={`${t(ien, izh)} — ${t('move to another column', '移至其他列')}`}
                onClick={() => setMenu(menu === id ? null : id)}>
                {t(ien, izh)}
              </button>
              {menu === id && <span role="menu" className="eq-menu" aria-label={t('Move to', '移至')}>
                {COLS.filter(([c]) => c !== choice).map(([c, cen, czh]) => <button key={c} type="button" role="menuitem" onClick={() => move(id, c)}>{t(cen, czh)}</button>)}
              </span>}
            </span>)}
            {items.length === 0 && <p className="eq-empty">{t('Empty — move a pill here.', '空——将标签移入此列。')}</p>}
          </div>
        </div>
      })}
    </div>
  </fieldset>
}