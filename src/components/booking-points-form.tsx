'use client'

import { useRef, useState } from 'react'
import { redeemPoints } from '@/lib/portal-actions'
import { redemptionDiscountMinor } from '@/lib/points-accounting'
import FinancialActionForm from './financial-action-form'

export type Redemption = { revision: number; availablePoints: number; maximumPoints: number; finalMinor: number; redeemValue: string; rmRate: string }
type Eligible = { id: string; label: string; currency: string; redemption: Redemption }
export default function BookingPointsForm({ options, bookingId, locale, close, onPending }: {
  options: Eligible[]; bookingId?: string; locale: 'en' | 'zh'; close: () => void; onPending: (pending: boolean) => void
}) {
  const [selected, setSelected] = useState(bookingId ?? '')
  const [points, setPoints] = useState('')
  const intent = useRef({ payload: '', key: '' })
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const option = options.find(b => b.id === selected)
  const terms = option?.redemption
  const valid = !!terms && /^\d+$/.test(points) && Number(points) > 0 && Number(points) <= terms.maximumPoints
  const discount = valid ? redemptionDiscountMinor(Number(points), terms.redeemValue, terms.rmRate) : 0
  const money = (minor: number) => option?.currency + ' ' + (minor / 100).toFixed(2)
  return <FinancialActionForm locale={locale} close={close} onPending={onPending} disabled={!valid || !discount}
    confirm={t('Apply points', '确认抵扣积分')} action={async form => {
      const payload = JSON.stringify([selected, points, terms?.revision, discount])
      if (intent.current.payload !== payload) intent.current = { payload, key: crypto.randomUUID() }
      form.set('expectedRevision', String(terms?.revision))
      form.set('expectedDiscountMinor', String(discount))
      form.set('bookingId', selected)
      form.set('operationKey', intent.current.key)
      return redeemPoints(form)
    }}>
    {bookingId ? <p className="portal-dialog-context span-2">{option?.label}</p> : <label className="span-2">{t('Booking', '预订')}
      <select required value={selected} onChange={e => { setSelected(e.target.value); setPoints('') }}>
        <option value="" disabled>{t('Choose an eligible booking', '选择可抵扣积分的预订')}</option>
        {options.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
    </label>}
    {selected && !terms && <p className="portal-hint span-2">{t('This booking is no longer eligible for points.', '此预订当前无法抵扣积分。')}</p>}
    {terms && <>
      <p className="portal-hint span-2">{t('Available points', '可用积分')} {terms.availablePoints} · {t('Maximum discount', '最高抵扣金额')} {money(redemptionDiscountMinor(terms.maximumPoints, terms.redeemValue, terms.rmRate))}</p>
      <label className="span-2">{t('Points to redeem', '使用积分数')}<input name="points" type="number" min="1" step="1" max={terms.maximumPoints}
        value={points} onChange={e => setPoints(e.target.value)} required /></label>
      <dl className="booking-summary span-2" aria-live="polite">
        <div><dt>{t('Original final payment', '原尾款')}</dt><dd>{money(terms.finalMinor)}</dd></div>
        <div><dt>{t('Points discount', '积分抵扣')}</dt><dd>{money(discount)}</dd></div>
        <div><dt>{t('Adjusted final payment', '抵扣后尾款')}</dt><dd>{money(terms.finalMinor - discount)}</dd></div>
      </dl>
    </>}
  </FinancialActionForm>
}
