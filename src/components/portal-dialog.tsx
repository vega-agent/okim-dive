'use client'

// Portal v2 (PORTAL-REDESIGN-V2-PLAN V8): one native <dialog> for one-time
// actions and viewing functions. Compact version of the approved trip-dialog
// language (white card, mist header band, deep backdrop). Esc / backdrop / ×
// close; the parent closes it on submit and the server action revalidates.
import { useEffect, useRef, type ReactNode } from 'react'

export default function PortalDialog({ open, title, closeLabel, onClose, children, pending = false }: {
  open: boolean; title: string; closeLabel: string; onClose: () => void; children: ReactNode; pending?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return <dialog ref={ref} className="portal-dialog" aria-label={title}
    onCancel={e => { e.preventDefault(); if (!pending) onClose() }}
    onClick={e => { if (!pending && e.target === ref.current) onClose() }}>
    <div className="portal-dialog-head">
      <h2>{title}</h2>
      <button type="button" className="portal-dialog-close" aria-label={closeLabel} disabled={pending} onClick={onClose}>×</button>
    </div>
    <div className="portal-dialog-body">{children}</div>
  </dialog>
}