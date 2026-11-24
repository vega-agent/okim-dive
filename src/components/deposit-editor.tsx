'use client'
import '../../styles/list-editor.css'

export type DepositRow = { amount: string; dueDate: string }

export default function DepositEditor({ rows, onChange, disabled, depositLabel, dueLabel, addLabel, removeLabel }: {
  rows: DepositRow[]
  onChange: (rows: DepositRow[]) => void
  disabled: boolean
  depositLabel: string
  dueLabel: string
  addLabel: string
  removeLabel: string
}) {
  const update = (index: number, patch: Partial<DepositRow>) =>
    onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  return <div className="deposit-editor">
    {rows.map((row, index) => <div key={index} className="deposit-row">
      <label>{depositLabel} {index + 1}
        <input name="depositAmount" type="number" min="0.01" step="0.01" value={row.amount}
          onChange={event => update(index, { amount: event.target.value })} disabled={disabled} placeholder="0.00" />
      </label>
      <label>{dueLabel}
        <input name="depositDueDate" type="date" value={row.dueDate}
          aria-label={depositLabel + ' ' + (index + 1) + ' · ' + dueLabel}
          onChange={event => update(index, { dueDate: event.target.value })} disabled={disabled} />
      </label>
      {index === 1 && <button type="button" className="list-editor-btn" aria-label={removeLabel}
        disabled={disabled} onClick={() => onChange(rows.slice(0, 1))}>×</button>}
    </div>)}
    {rows.length < 2 && <button type="button" className="btn btn-secondary" disabled={disabled}
      onClick={() => onChange([...rows, { amount: '', dueDate: '' }])}>{addLabel}</button>}
  </div>
}
