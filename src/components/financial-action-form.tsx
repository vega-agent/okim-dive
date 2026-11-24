'use client'

import { useRef, useState, type ReactNode } from 'react'

export default function FinancialActionForm({ action, close, onPending, locale, children, confirm, danger, disabled = false }: {
  action: (form: FormData) => Promise<void | { status: 'saved' | 'stale' }>; close: () => void; onPending: (pending: boolean) => void
  locale: 'en' | 'zh'; children: ReactNode; confirm: string; danger?: boolean; disabled?: boolean
}) {
  const active = useRef(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<'error' | 'stale' | null>(null)
  const zh = locale === 'zh'
  return <form className="booking-form portal-form" onSubmit={async event => {
    event.preventDefault()
    if (active.current || disabled) return
    active.current = true
    const form = new FormData(event.currentTarget)
    setSaving(true); setNotice(null); onPending(true)
    try {
      const result = await action(form)
      if (result?.status === 'stale') setNotice('stale')
      else close()
    } catch { setNotice('error') }
    finally { active.current = false; setSaving(false); onPending(false) }
  }}>
    <fieldset className="financial-fields" disabled={saving}>{children}</fieldset>
    {notice && <p className="portal-warning span-2" role="alert">{notice === 'stale' ? (zh ? '资料已变更，请核对更新后的金额和预订，再次确认。' : 'The details changed. Review the updated amounts and bookings before confirming again.') : (zh ? '未能保存，请核对最新的预订资料后重试。' : 'Could not save. Check the current booking details and try again.')}</p>}
    <div className="portal-dialog-actions span-2">
      <button type="button" disabled={saving} className="btn btn-secondary" onClick={close}>{zh ? '返回' : 'Back'}</button>
      <button disabled={saving || disabled} className={danger ? 'btn btn-danger-solid' : 'btn btn-primary'}>{saving ? (zh ? '保存中…' : 'Saving…') : confirm}</button>
    </div>
  </form>
}
