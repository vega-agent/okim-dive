'use client'
import { useState, type ReactNode } from 'react'

// (?) help toggle per card: explains what action the instructor needs to take.
export default function CardHelp({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="portal-help-toggle" aria-expanded={open} aria-controls={id} aria-label={label} onClick={() => setOpen(v => !v)}>?</button>
    <div id={id} className="portal-help" role="note" hidden={!open}>{children}</div>
  </>
}