'use client'
import { useState } from 'react'
import { useLocale } from '@/lib/use-locale'
import { updateTripSettings, setLaunchState, cancelTrip, deleteDraft } from '@/lib/trip-actions'
import { CERT_OPTIONS, publishBlockers, tripDisplayState, type SerializedTrip } from '@/lib/trip-display'
import TripEditorNav from '@/components/trip-editor-nav'
import CardHelp from '@/components/portal-card-help'

export default function TripSettingsEditor({ trip, consumed, bookingCount }: { trip: SerializedTrip; consumed: number; bookingCount: number }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const [currency, setCurrency] = useState(trip.currency)
  const [price, setPrice] = useState(String(trip.priceAmount))
  const [depositType, setDepositType] = useState(trip.depositType)
  const [depositValue, setDepositValue] = useState(String(trip.depositValue))
  const priceN = Number(price) || 0
  const depositN = Number(depositValue) || 0
  const deposit = depositType === 'percent' ? Math.round(priceN * depositN) / 100 : Math.min(depositN, priceN)
  const balance = Math.round((priceN - deposit) * 100) / 100
  const money = (n: number) => `${currency} ${n.toFixed(2)}`
  const slugLocked = trip.status !== 'draft' || trip.published || bookingCount > 0
  const blockers = publishBlockers(trip)
  const state = tripDisplayState(trip, consumed, trip.capacity)
  const cancelled = trip.status === 'cancelled'
  const deletable = trip.status === 'draft' && !trip.published && bookingCount === 0
  const dateValue = (iso: string | null) => iso ? iso.slice(0, 10) : ''

  return <main className="ocean-journey portal trip-editor" data-locale-managed><div className="container">
    <TripEditorNav trip={trip} active="settings" consumed={consumed} />

    {bookingCount > 0 && !cancelled && <p className="portal-warning" role="status">
      {t(`${bookingCount} booking(s) on this trip — price/date changes affect new bookings only; existing invoices keep their snapshot. Capacity cannot drop below ${consumed} held/confirmed slots.`,
        `本行程已有 ${bookingCount} 个预订——价格/日期修改仅影响新预订；已有账单保留其快照。名额不能低于已占用的 ${consumed} 个名额。`)}
    </p>}
    {cancelled && <p className="portal-warning" role="status">{t('This trip is cancelled and read-only. Duplicate it to relaunch.', '本行程已取消，只读。如需重新发布，请复制。')}</p>}

    <form action={updateTripSettings} key={trip.updatedAt} className="trip-editor-form">
      <input type="hidden" name="tripId" value={trip.id} />

      <section className="portal-card">
        <div className="portal-card-head">
          <h2>{t('Identity', '基本信息')}</h2>
          <CardHelp id="identity-help" label={t('Help: identity', '帮助：基本信息')}>
            <p>{t('The slug is the public URL. It locks once the trip is launched or has bookings, because links get shared.', 'slug 是公开网址。行程发布后或有预订时即锁定，因为链接会被分享。')}</p>
          </CardHelp>
        </div>
        <div className="booking-form portal-form">
          <label className="span-2">{t('Slug (public URL)', 'Slug（公开网址）')}
            <input name="slug" defaultValue={trip.slug} disabled={slugLocked || cancelled} maxLength={100} placeholder={t('auto-generated-from-the-trip-name', '由行程名称自动生成')} />
          </label>
          {slugLocked && <p className="portal-hint span-2">{t('Slug locked — the trip is launched or has bookings.', 'Slug 已锁定——行程已发布或有预订。')}</p>}
          <label className="span-2 portal-consent"><input type="checkbox" name="sample" defaultChecked={trip.sample} disabled={cancelled} />{t('Sample trip — honest label shown to divers until facts are confirmed', '示例行程——在事实确认前向潜水员展示诚实标注')}</label>
        </div>
      </section>

      <section className="portal-card">
        <h2>{t('Schedule', '日期')}</h2>
        <div className="booking-form portal-form">
          <label>{t('Departure', '出发日期')}<input name="travelStart" type="date" defaultValue={dateValue(trip.travelStart)} disabled={cancelled} /></label>
          <label>{t('Trip timezone (IANA)', '行程时区（IANA）')}<input name="departureTimezone" required defaultValue={trip.departureTimezone} disabled={cancelled} placeholder="Asia/Kuala_Lumpur" /></label>
          <label>{t('Return', '结束日期')}<input name="travelEnd" type="date" defaultValue={dateValue(trip.travelEnd)} disabled={cancelled} /></label>
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-card-head">
          <h2>{t('Pricing', '价格')}</h2>
          <CardHelp id="pricing-help" label={t('Help: pricing', '帮助：价格')}>
            <p>{t('These facts drive booking math and auto-write the display lines in both languages. Existing bookings keep their invoice snapshot.', '这些事实驱动预订计算，并自动生成两种语言的展示文案。已有预订保留其账单快照。')}</p>
          </CardHelp>
        </div>
        <div className="booking-form portal-form">
          <label>{t('Currency', '币种')}
            <select name="currency" value={currency} onChange={e => setCurrency(e.target.value)} disabled={cancelled}>
              {['MYR', 'SGD', 'USD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>{t('Price per person', '每人价格')}<input name="priceAmount" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} disabled={cancelled} placeholder="0.00" /></label>
          <div className="portal-field span-2">
            <span className="portal-field-label" id="deposit-type-label">{t('Deposit type', '订金类型')}</span>
            <div className="kind-pills" role="radiogroup" aria-labelledby="deposit-type-label">
              {[['percent', 'Percent', '百分比'], ['fixed', 'Fixed amount', '固定金额']].map(([value, en, zh]) =>
                <label key={value} className="kind-pill"><input type="radio" name="depositType" value={value} checked={depositType === value} onChange={() => setDepositType(value)} disabled={cancelled} /><span>{t(en, zh)}</span></label>)}
            </div>
          </div>
          <label>{depositType === 'percent' ? t('Deposit percent', '订金百分比') : t('Deposit amount', '订金金额')}
            <input name="depositValue" type="number" min="0" step="0.01" value={depositValue} onChange={e => setDepositValue(e.target.value)} disabled={cancelled} placeholder="0" /></label>
          <label>{t('Balance due (days before departure)', '尾款期限（出发前天数）')}<input name="balanceDueDays" type="number" min="0" step="1" defaultValue={trip.balanceDueDays} disabled={cancelled} /></label>
          <label>{t('RM rate (points conversion)', 'RM 汇率（积分换算）')}<input name="rmRate" type="number" min="0.0001" step="0.0001" defaultValue={trip.rmRate} disabled={cancelled} /></label>
          <p className="portal-currency span-2">{t('Deposit', '订金')} {money(deposit)} · {t('Balance', '尾款')} {money(balance)}</p>
        </div>
      </section>

      <section className="portal-card">
        <h2>{t('Capacity', '名额')}</h2>
        <div className="booking-form portal-form">
          <label>{t('Total slots', '总名额')}<input name="capacity" type="number" min="1" step="1" defaultValue={trip.capacity} disabled={cancelled} /></label>
          <label>{t('Minimum participants', '最低成团人数')}<input name="minParticipants" type="number" min="1" step="1" defaultValue={trip.minParticipants} disabled={cancelled} /></label>
          <p className="portal-hint span-2">{t(`${consumed} slot(s) currently held or confirmed. Minimum participants is reviewed manually by Iris — no auto-cancellation.`, `当前已占用 ${consumed} 个名额。最低成团人数由 Iris 人工审核——不会自动取消。`)}</p>
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-card-head">
          <h2>{t('Requirements', '参加要求')}</h2>
          <CardHelp id="requirements-help" label={t('Help: requirements', '帮助：参加要求')}>
            <p>{t('Iris sets requirements; suitability is always her decision, never the software’s. These feed the booking declarations.', '要求由 Iris 设定；适宜性始终由她判断，软件不作决定。这些要求会用于预订申报。')}</p>
          </CardHelp>
        </div>
        <div className="booking-form portal-form">
          <label>{t('Minimum certification', '最低证书级别')}
            <select name="reqCertLevel" defaultValue={trip.reqCertLevel ?? ''} disabled={cancelled}>
              <option value="">{t('Any / no minimum', '不限')}</option>
              {CERT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>{t('Minimum logged dives', '最低潜水次数')}<input name="reqMinDives" type="number" min="0" step="1" defaultValue={trip.reqMinDives ?? ''} disabled={cancelled} placeholder={t('No minimum', '不限')} /></label>
          <label className="span-2 portal-consent"><input type="checkbox" name="reqInsurance" defaultChecked={trip.reqInsurance} disabled={cancelled} />{t('Dive insurance required', '须持有潜水保险')}</label>
          <label className="span-2 portal-consent"><input type="checkbox" name="reqMedical" defaultChecked={trip.reqMedical} disabled={cancelled} />{t('Medical declaration required', '须填写健康申报')}</label>
        </div>
      </section>

      {!cancelled && <button className="btn btn-primary trip-editor-save">{t('Save settings', '保存设置')}</button>}
    </form>

    {!cancelled && <section className="portal-card">
      <div className="portal-card-head">
        <h2>{t('Launch', '发布')}</h2>
        <CardHelp id="launch-help" label={t('Help: launch', '帮助：发布')}>
          <p>{t('Current state', '当前状态')}: {t(state.en, state.zh)}</p>
          <ol>
            <li>{t('Open for booking: live trip page with the book button.', '开放预订：行程页上线并显示预订按钮。')}</li>
            <li>{t('Inquiries only: live trip page with the contact form, no booking.', '仅接受咨询：行程页上线并显示联系表单，不可预订。')}</li>
            <li>{t('Closed: hidden from the public site; existing bookings and payments stay serviceable.', '关闭：从公开网站隐藏；已有预订和付款仍可处理。')}</li>
            <li>{t('Draft: hidden, editable slug; only before any booking exists.', '草稿：隐藏，slug 可编辑；仅限尚无预订时。')}</li>
          </ol>
        </CardHelp>
      </div>
      {blockers.length > 0 && <div className="portal-warning" role="status">
        <strong>{t('Publishing is blocked until:', '发布前请先完成：')}</strong>
        <ul>{blockers.map((b, i) => <li key={i}>{t(b.en, b.zh)}</li>)}</ul>
      </div>}
      <form action={setLaunchState} className="portal-eligibility">
        <input type="hidden" name="tripId" value={trip.id} />
        <button name="state" value="open" className="btn btn-primary" disabled={blockers.length > 0}>{t('Open for booking', '开放预订')}</button>
        <button name="state" value="inquiries" className="btn btn-secondary" disabled={blockers.length > 0}>{t('Inquiries only', '仅接受咨询')}</button>
        <button name="state" value="closed" className="btn btn-secondary" disabled={trip.status === 'draft'}>{t('Close trip', '关闭行程')}</button>
        <button name="state" value="draft" className="btn btn-secondary" disabled={bookingCount > 0 || trip.status === 'draft'}>{t('Back to draft', '回到草稿')}</button>
      </form>
    </section>}

    {!cancelled && <section className="portal-card">
      <div className="portal-card-head">
        <h2>{t('Cancel trip', '取消行程')}</h2>
        <CardHelp id="cancel-help" label={t('Help: cancel trip', '帮助：取消行程')}>
          <p>{t('For weather, minimum participants not met, or operator issues.', '适用于天气、未达成团人数或运营问题。')}</p>
          <ol>
            <li>{t('Paid bookings are flagged for full refund; unpaid bookings are cancelled.', '已付款预订标记为全额退款；未付款预订直接取消。')}</li>
            <li>{t('Every affected diver is emailed in their language.', '每位受影响潜水员都会收到其语言的邮件通知。')}</li>
            <li>{t('Then record each external refund in Financial ops — points reverse automatically there.', '随后在财务操作中记录每笔外部退款——积分会在该处自动冲正。')}</li>
          </ol>
        </CardHelp>
      </div>
      <form action={cancelTrip} className="booking-form portal-form">
        <input type="hidden" name="tripId" value={trip.id} />
        <label className="span-2">{t('Cancellation reason (shown to divers)', '取消原因（向潜水员展示）')}
          <input name="reason" required maxLength={500} placeholder={t('e.g. insufficient participants / weather advisory', '例如：人数不足／天气预警')} />
        </label>
        <label className="span-2 portal-consent"><input type="checkbox" name="confirm" required />{t('I understand all active bookings will be flagged for refund or cancelled, and divers will be emailed.', '我了解所有进行中的预订将被标记退款或取消，并会邮件通知潜水员。')}</label>
        <button className="btn btn-secondary span-2">{t('Cancel this trip', '取消此行程')}</button>
      </form>
    </section>}

    {deletable && <section className="portal-card">
      <h2>{t('Delete draft', '删除草稿')}</h2>
      <p className="portal-hint">{t('Only unpublished drafts without bookings can be deleted. A full snapshot is kept in the audit log.', '仅可删除无预订的未发布草稿。审计日志会保留完整快照。')}</p>
      <form action={deleteDraft}>
        <input type="hidden" name="tripId" value={trip.id} />
        <button className="btn btn-secondary">{t('Delete this draft', '删除此草稿')}</button>
      </form>
    </section>}
  </div></main>
}