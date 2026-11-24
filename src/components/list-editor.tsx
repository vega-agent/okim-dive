'use client'

// Row inputs with two square buttons at the right: × remove this row,
// + insert a row below (owner 2026-11-22: common add/remove pattern,
// no bottom Add button). 44px square targets, clean v2 button language.
// `translate` adds a per-row Translate icon AFTER × / + so the text field,
// ×, + and Translate always share one line (#47).
import { useState } from 'react'
import TranslateButton from '@/components/translate-button'
import '../../styles/list-editor.css'

export default function ListEditor({ name, label, items, placeholder, addLabel, removeLabel, translate, flagTip }: {
  name: string
  label: string
  items: string[]
  placeholder: string
  addLabel: string
  removeLabel: string
  translate?: { from: 'en' | 'zh'; to: 'en' | 'zh'; textFor: (index: number) => string }
  flagTip?: string
}) {
  const [rows, setRows] = useState<string[]>(items.length ? items : [''])
  const set = (i: number, v: string) => setRows(rows.map((r, j) => j === i ? v : r))
  const add = (i: number) => setRows([...rows.slice(0, i + 1), '', ...rows.slice(i + 1)])
  const remove = (i: number) => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [''])
  return <div className={`portal-field span-2 list-editor${flagTip ? ' field-blocked' : ''}`} data-tip={flagTip}>
    <div className="list-editor-head"><span className="portal-field-label">{label}{flagTip && <span className="blocker-dot" aria-hidden="true" />}</span></div>
    {rows.map((row, i) => <div key={i} className="list-editor-row">
      <input name={name} value={row} placeholder={placeholder} maxLength={500} onChange={e => set(i, e.target.value)} />
      <button type="button" className="list-editor-btn" aria-label={`${removeLabel} ${i + 1}`} onClick={() => remove(i)}>×</button>
      <button type="button" className="list-editor-btn" aria-label={`${addLabel} ${i + 1}`} onClick={() => add(i)}>+</button>
      {translate && <TranslateButton from={translate.from} to={translate.to} getTexts={() => [translate.textFor(i)]} onResults={([v]) => { if (v) set(i, v) }} />}
    </div>)}
  </div>
}
