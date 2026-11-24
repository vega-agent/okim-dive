'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { recordBookingPayment } from '@/lib/payment-actions'
import { parseMoneyMinor, previewPayment, type BookingPaymentSummary } from '@/lib/payment-schedule'

export default function RecordPaymentDialog({ summary, today, locale, context, onSave, onClose, onPendingChange }: {
  summary: BookingPaymentSummary; today: string; locale: 'en' | 'zh'; context: ReactNode; onSave: (receiptUrl: string) => void; onClose: () => void; onPendingChange: (pending: boolean) => void
}) {
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const [current, setCurrent] = useState(summary)
  const [amount, setAmount] = useState((summary.suggestedAmountMinor / 100).toFixed(2))
  const [paidOn, setPaidOn] = useState(today)
  const [notice, setNotice] = useState<'stale' | 'error' | null>(null)
  const [pending, setPending] = useState(false)
  const intent = useRef({ payload: '', key: '' })
  const money = (minor: number) => current.currency + ' ' + (minor / 100).toFixed(2)
  let enteredMinor: number | undefined
  let preview: ReturnType<typeof previewPayment> | undefined
  try { enteredMinor = parseMoneyMinor(amount); preview = previewPayment(current, enteredMinor) } catch { /* An unfinished input has no allocation. */ }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !preview) return
    const payload = [current.revision, amount, paidOn].join('|')
    if (intent.current.payload !== payload) intent.current = { payload, key: crypto.randomUUID() }
    const form = new FormData(event.currentTarget)
    form.set('bookingId', current.bookingId)
    form.set('expectedRevision', String(current.revision))
    form.set('operationKey', intent.current.key)
    setPending(true)
    onPendingChange(true)
    setNotice(null)
    try {
      const result = await recordBookingPayment(form)
      if (result.status === 'saved') onSave(result.receiptUrl)
      else if (result.status === 'stale') {
        setCurrent(result.summary)
        setNotice('stale')
      } else setNotice('error')
    } catch { setNotice('error') }
    finally { setPending(false); onPendingChange(false) }
  }
  return <form onSubmit={submit} className="booking-form portal-form">
    <div className="span-2">{context}</div>
    <label>{t('Amount received', '到账金额')} ({current.currency})<input name="amount" type="number" min="0.01" max={(current.outstandingMinor / 100).toFixed(2)} step="0.01"
      value={amount} onChange={e => setAmount(e.target.value)} required disabled={pending} /></label>
    <label>{t('Date paid', '付款日期')}<input name="paidOn" type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} max={today} required disabled={pending} /></label>
    {preview && <div className="span-2" aria-live="polite">{preview.allocations.map(a => {
      const stage = current.stages.find(s => s.id === a.stageId)!
      return <p key={a.stageId}>{stage.kind === 'final' ? t('Final payment', '尾款') : t('Deposit ', '订金 ') + stage.position} · {money(a.amountMinor)}</p>
    })}<p>{t('Remaining after payment', '本次付款后待付')} · {money(preview.remainingMinor)}</p></div>}
    {enteredMinor !== undefined && enteredMinor > current.outstandingMinor && <p className="portal-warning span-2" role="status">
      {t('This amount exceeds the outstanding balance.', '此金额超过待付余额。')} {money(current.outstandingMinor)}
    </p>}
    {notice && <p role="alert" className="portal-warning span-2">{notice === 'stale' ? t('The booking changed. Review the new allocation before confirming your bank amount.', '预订已更新。请核对新的分配结果后再确认实际到账金额。')
      : t('Payment could not be saved. Check the booking and try again.', '未能保存收款记录，请核对预订后再试。')}</p>}
    <div className="portal-dialog-actions span-2">
      <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>{t('Cancel', '取消')}</button>
      <button className="btn btn-primary" disabled={pending || !preview}>{pending ? t('Saving…', '保存中…') : t('Confirm payment', '确认收款')}</button>
    </div>
  </form>
}
