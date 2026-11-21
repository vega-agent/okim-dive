'use client'
import { useState } from 'react'

/** Compact add/remove row list for highlights, itinerary, included, costs. */
export default function ListEditor({ name, label, items, placeholder, addLabel, removeLabel }: {
  name: string
  label: string
  items: string[]
  placeholder: string
  addLabel: string
  removeLabel: string
}) {
  const [rows, setRows] = useState<string[]>(items.length ? items : [''])
  return <div className="portal-field span-2 list-editor">
    <span className="portal-field-label">{label}</span>
    {rows.map((row, i) => <div key={i} className="list-editor-row">
      <input name={name} value={row} placeholder={placeholder} maxLength={500}
        onChange={e => setRows(rows.map((r, j) => j === i ? e.target.value : r))} />
      <button type="button" className="list-editor-remove" aria-label={`${removeLabel} ${i + 1}`}
        onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [''])}>×</button>
    </div>)}
    <button type="button" className="btn btn-secondary list-editor-add" onClick={() => setRows([...rows, ''])}>{addLabel}</button>
  </div>
}