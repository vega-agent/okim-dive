'use client'

import { useState } from 'react'
import {
  cancelBooking,
  recordBookingRefund,
  recordCompletedCorrection,
  respondToPostponement,
} from '@/lib/payment-actions'
import { cancellationRefundSnapshot, type BookingPaymentSummary, type CancellationKind } from '@/lib/payment-schedule'

export type PendingDateChange = {
  id: string
  oldStart: string | null
  oldEnd: string | null
  newStart: string
  newEnd: string
}
type Props = {
  mode: 'cancel' | 'refund' | 'correction' | 'postponement'
  summary: BookingPaymentSummary
  locale: 'en' | 'zh'
  today: string
  change?: PendingDateChange | null
  sources?: { id: string; number: number; refundableMinor: number; paidOn: string | null; amount: string }[]
  close: () => void
  onPending: (pending: boolean) => void
}

export default function BookingLifecycleForm({
  mode,
  summary: initial,
  locale,
  today,
  change,
  sources,
  close,
  onPending,
}: Props) {
  const [key] = useState(() => crypto.randomUUID())
  const [summary, setSummary] = useState(initial)
  const [kind, setKind] = useState<CancellationKind>('diver_withdrawal')
  const [decision, setDecision] = useState('')
  const [sourceId, setSourceId] = useState('')
  const selectedSource = sources?.find(p => p.id === sourceId)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const t = (en: string, zh: string) => (locale === 'zh' ? zh : en)
  const money = (amount: number) => summary.currency + ' ' + (amount / 100).toFixed(2)
  const preview = mode === 'cancel' ? cancellationRefundSnapshot(summary, kind) : null
  const errors = {
    invalid: t('Review the date and details.', '请核对日期和资料。'),
    closed: t('This booking no longer allows this change.', '此预订当前无法进行此操作。'),
    excess: t('The amount exceeds the available refund.', '金额超过可退款余额。'),
    forbidden: t('Instructor sign-in required.', '请用教练账号登录。'),
    key_reused: t('This request was previously saved with different details.', '此操作已按其他资料保存。'),
    unavailable: t('Could not save. Review and try again.', '未能保存，请核对后重试。'),
  }
  async function save(form: FormData) {
    if (saving) return
    setSaving(true)
    onPending(true)
    setMessage('')
    form.set('bookingId', summary.bookingId)
    form.set('expectedRevision', String(summary.revision))
    form.set('operationKey', key)
    try {
      const action = {
        cancel: cancelBooking,
        refund: recordBookingRefund,
        correction: recordCompletedCorrection,
        postponement: respondToPostponement,
      }[mode]
      const result = await action(form)
      if (result.status === 'saved') {
        close()
        return
      }
      if (result.status === 'stale') {
        setSummary(result.summary)
        setMessage(
          t(
            'Payment history changed. Review the updated amounts before saving.',
            '付款记录已更新，请核对金额后再保存。',
          ),
        )
      } else setMessage(errors[result.messageKey])
    } catch {
      setMessage(errors.unavailable)
    } finally {
      setSaving(false)
      onPending(false)
    }
  }
  return (
    <form onSubmit={event => { event.preventDefault(); void save(new FormData(event.currentTarget)) }} className="booking-form portal-form">
      <fieldset className="financial-fields" disabled={saving}>
      {mode === 'cancel' && (
        <>
          <label>
            {t('Cancellation category', '取消类别')}
            <select name="cancellationKind" value={kind} onChange={(e) => setKind(e.target.value as CancellationKind)}>
              <option value="diver_withdrawal">{t('Diver withdrawal', '潜水员退出')}</option>
              <option value="nonpayment">{t('Nonpayment', '未付款')}</option>
              <option value="no_show">{t('No-show', '未出席')}</option>
              <option value="operator_cancelled">{t('Operator cancellation', '主办方取消')}</option>
            </select>
          </label>
          <p className="portal-hint span-2">
            {t('Net paid', '净付款')} {money(summary.netReceivedMinor)} · {t('Deposits retained', '保留订金')}{' '}
            {money(summary.netReceivedMinor - preview!.refundEntitlementMinor)} · {t('Refund due', '应退款')}{' '}
            {money(preview!.refundEntitlementMinor)}
          </p>
        </>
      )}
      {mode === 'postponement' && change && (
        <>
          <input type="hidden" name="changeId" value={change.id} />
          <p className="span-2">
            {t('Previous travel dates', '原行程日期')} {change.oldStart?.slice(0, 10) ?? '—'} –{' '}
            {change.oldEnd?.slice(0, 10) ?? '—'}
            <br />
            {t('New travel dates', '新行程日期')} {change.newStart.slice(0, 10)} – {change.newEnd.slice(0, 10)}
          </p>
          {decision === 'decline' && <p className="span-2">{t('Net paid', '净付款')} {money(summary.netReceivedMinor)} · {t('Deposits retained', '保留订金')} {money(0)} · {t('Refund due', '应退款')} {money(summary.netReceivedMinor)}</p>}
          <label>
            {t('Diver’s decision', '潜水员的选择')}
            <select name="decision" required value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="" disabled>
                {t('Choose a response', '请选择')}
              </option>
              <option value="accept">{t('Accept new dates', '接受新日期')}</option>
              <option value="decline">{t('Decline and receive a full refund', '不接受改期并全额退款')}</option>
            </select>
          </label>
        </>
      )}
      {(mode === 'refund' || mode === 'correction') && (
        <>
          {mode === 'correction' && (
            <label className="span-2">
              {t('Original receipt', '原收据')}
              <select name="paymentId" required value={sourceId} onChange={e => setSourceId(e.target.value)}>
                <option value="" disabled>
                  {t('Choose a receipt', '选择收据')}
                </option>
                {sources?.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.paidOn && p.paidOn + ' · '}{t('Receipt', '凭证')} {p.number} · {summary.currency} {p.amount} · {t('Available', '可退')} {money(p.refundableMinor)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === 'refund' && (
            <p className="span-2">
              {t('Refund agreed', '应退总额')} {money(summary.refundEntitlementMinor)} · {t('Refund recorded', '已登记退款')} {money(summary.refundEntitlementMinor - summary.refundOutstandingMinor)} · {t('Refund still due', '尚需退款')} {money(summary.refundOutstandingMinor)}
            </p>
          )}
          <label>
            {t('Amount refunded', '已退款金额')}
            <input
              name="amount"
              type="number"
              required
              step="0.01"
              min="0.01"
              max={mode === 'refund' ? summary.refundOutstandingMinor / 100 : selectedSource && selectedSource.refundableMinor / 100}
              defaultValue={mode === 'refund' ? (summary.refundOutstandingMinor / 100).toFixed(2) : undefined}
            />
          </label>
          <label>
            {t('Refund date', '退款日期')}
            <input type="date" name="paidOn" required defaultValue={today} max={today} />
          </label>
        </>
      )}
      {(mode === 'correction' || mode === 'cancel' || (mode === 'postponement' && decision === 'decline')) && (
        <label className="span-2">
          {mode === 'correction' ? t('Reason', '原因') : t('Cancellation reason (shown to diver)', '取消原因（向潜水员展示）')}
          <input name="reason" required maxLength={500} />
        </label>
      )}
      </fieldset>
      {message && (
        <p role="alert" className="span-2">
          {message}
        </p>
      )}
      <div className="portal-dialog-actions span-2">
        <button type="button" className="btn btn-secondary" onClick={close} disabled={saving}>
          {t('Back', '返回')}
        </button>
        <button className={mode === 'cancel' ? 'btn btn-danger-solid' : 'btn btn-primary'} disabled={saving}>
          {saving
            ? t('Saving…', '保存中…')
            : mode === 'cancel'
              ? t('Cancel booking', '取消预订')
              : mode === 'postponement'
                ? t('Record decision', '记录选择')
                : t('Record refund', '登记退款')}
        </button>
      </div>
    </form>
  )
}
