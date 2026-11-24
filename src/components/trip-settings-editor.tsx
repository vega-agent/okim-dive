'use client'
import { useRef, useState } from 'react'
import { useLocale } from '@/lib/use-locale'
import { updateTripSettings, setLaunchState, deleteDraft } from '@/lib/trip-actions'
import { CERT_OPTIONS, publishBlockers, type SerializedTrip } from '@/lib/trip-display'
import { COUNTRIES, COUNTRY_KEYS, matchSite, type CountryKey } from '@/lib/locations'
import TripEditorNav from '@/components/trip-editor-nav'
import CardHelp from '@/components/portal-card-help'
import PortalDialog from '@/components/portal-dialog'
import TranslateButton from '@/components/translate-button'
import DepositEditor, { type DepositRow } from '@/components/deposit-editor'
import IconAction, { icons } from '@/components/icon-action'

export default function TripSettingsEditor({ trip, consumed, bookingCount, deposits }: { trip: SerializedTrip; consumed: number; bookingCount: number; deposits: { amount: string; dueDate: string | null }[] }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const [currency, setCurrency] = useState(trip.currency)
  const titleEnRef = useRef<HTMLInputElement>(null)
  const titleZhRef = useRef<HTMLInputElement>(null)
  const [countryKey, setCountryKey] = useState<CountryKey>((trip.locationKey as CountryKey) in COUNTRIES ? trip.locationKey as CountryKey : 'malaysia')
  const loc = COUNTRIES[countryKey]
  const [diveSite, setDiveSite] = useState(trip.diveSiteEn ?? '')
  const diveSiteZhRef = useRef<HTMLInputElement>(null)
  const site = matchSite(diveSite)
  const tzOffset = (tz: string) => {
    try { return new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? '' } catch { return '' }
  }
  const [price, setPrice] = useState(String(trip.priceAmount))
  const [dialog, setDialog] = useState<null | 'closed' | 'draft' | 'delete'>(null)
  const [depRows, setDepRows] = useState<DepositRow[]>(deposits.length ? deposits.map(d => ({ amount: Number(d.amount) ? d.amount : '', dueDate: d.dueDate ?? '' })) : [{ amount: '', dueDate: '' }])
  const priceN = Number(price) || 0
  const depTotal = Math.round(depRows.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100
  const balance = Math.round((priceN - depTotal) * 100) / 100
  const money = (n: number) => `${currency} ${n.toFixed(2)}`
  const slugLocked = trip.status !== 'draft' || trip.published || bookingCount > 0
  const blockers = publishBlockers(trip, deposits)
  const flag = (key: string) => {
    const hits = blockers.filter(b => b.fields?.includes(key))
    return { cls: hits.length ? ' field-blocked' : '', tip: hits.length ? hits.map(b => t(b.en, b.zh)).join(' · ') : undefined }
  }
  const fPrice = flag('price'), fDep = flag('deposits'), fStart = flag('travelStart'), fEnd = flag('travelEnd'), fCap = flag('capacity')
  const fTitleEn = flag('content:title:en'), fTitleZh = flag('content:title:zh'), fSiteEn = flag('content:location:en'), fSiteZh = flag('content:location:zh')
  const cancelled = trip.status === 'cancelled'
  const deletable = trip.status === 'draft' && !trip.published && bookingCount === 0
  const dateValue = (iso: string | null) => iso ? iso.slice(0, 10) : ''
  const blockedTip = t('Complete the highlighted fields first', '请先完成标记的字段')
  const openName = t('Open for booking', '开放预订')
  const navActions = cancelled ? undefined : <>
    <IconAction type="submit" form="trip-settings-form" tip={t('Save settings', '保存设置')}>{icons.save}</IconAction>
    <form action={setLaunchState}><input type="hidden" name="tripId" value={trip.id} />
      <IconAction type="submit" name="state" value="open" disabled={blockers.length > 0} tip={blockers.length ? `${openName} — ${blockedTip}` : openName}>{icons.open}</IconAction>
    </form>
    {trip.status !== 'draft' && <IconAction tip={t('Close trip', '关闭行程')} onClick={() => setDialog('closed')}>{icons.close}</IconAction>}
    {bookingCount === 0 && trip.status !== 'draft' && <IconAction tip={t('Back to draft', '回到草稿')} onClick={() => setDialog('draft')}>{icons.draft}</IconAction>}
    {deletable && <IconAction danger tip={t('Delete draft', '删除草稿')} onClick={() => setDialog('delete')}>{icons.trash}</IconAction>}
  </>

  return <main className="ocean-journey portal trip-editor" data-locale-managed><div className="container">
    <TripEditorNav trip={trip} active="settings" consumed={consumed} actions={navActions} />

    {bookingCount > 0 && !cancelled && <p className="portal-warning" role="status">
      {t(`${bookingCount} booking(s) on this trip — price/date changes affect new bookings only; existing invoices keep their snapshot. Capacity cannot drop below ${consumed} held/confirmed slots.`,
        `本行程已有 ${bookingCount} 个预订——价格/日期修改仅影响新预订；已有账单保留其快照。名额不能低于已占用的 ${consumed} 个名额。`)}
    </p>}
    {cancelled && <p className="portal-warning" role="status">{t('This trip is cancelled and read-only. Duplicate it to relaunch.', '本行程已取消，只读。如需重新发布，请复制。')}</p>}

    <form id="trip-settings-form" action={updateTripSettings} key={trip.updatedAt} className="trip-editor-form">
      <input type="hidden" name="tripId" value={trip.id} />

      <section className="portal-card">
        <div className="portal-card-head">
          <h2>{t('Identity', '基本信息')}</h2>
          <CardHelp id="identity-help" label={t('Help: identity', '帮助：基本信息')}>
            <p>{t('The public URL is auto-generated from the trip name — never hand-typed, so no typos or duplicate names. It locks once the trip is launched or has bookings, because links get shared.', '公开网址由行程名称自动生成——无需手填，避免拼写错误或重名。行程发布后或有预订时即锁定，因为链接会被分享。')}</p>
          </CardHelp>
        </div>
        <div className="booking-form portal-form">
          <div className={`translate-field span-2${fTitleEn.cls}`} data-tip={fTitleEn.tip}>
            <label htmlFor="trip-title-en"><span>{t('Trip name (English)', '行程名称（英文）')}{fTitleEn.tip && <span className="blocker-dot" aria-hidden="true" />}</span></label>
            <input id="trip-title-en" name="titleEn" ref={titleEnRef} defaultValue={trip.titleEn} required maxLength={200} disabled={cancelled} placeholder={t('e.g. Tioman Reef Weekend', '例如：Tioman Reef Weekend')} />
            <TranslateButton from="zh" to="en" getTexts={() => [titleZhRef.current?.value ?? '']} onResults={([v]) => { if (v && titleEnRef.current) titleEnRef.current.value = v }} />
          </div>
          <div className={`translate-field span-2${fTitleZh.cls}`} data-tip={fTitleZh.tip}>
            <label htmlFor="trip-title-zh"><span>{t('Trip name (Chinese)', '行程名称（中文）')}{fTitleZh.tip && <span className="blocker-dot" aria-hidden="true" />}</span></label>
            <input id="trip-title-zh" name="titleZh" ref={titleZhRef} defaultValue={trip.titleZh} maxLength={200} disabled={cancelled} placeholder={t('Chinese trip name', '例如：刁曼岛珊瑚礁周末')} />
            <TranslateButton from="en" to="zh" getTexts={() => [titleEnRef.current?.value ?? '']} onResults={([v]) => { if (v && titleZhRef.current) titleZhRef.current.value = v }} />
          </div>
          <p className="portal-hint span-2">{t('Public URL', '公开网址')}: <strong>/trips/{trip.slug}</strong>{slugLocked ? ` · ${t('locked — launched or has bookings', '已锁定——已发布或有预订')}` : ` · ${t('auto from the trip name until launch', '发布前随行程名称自动更新')}`}</p>
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-card-head">
          <h2>{t('Location', '地点')}</h2>
          <CardHelp id="location-help" label={t('Help: location', '帮助：地点')}>
            <p>{t('Pick the country (Asia) and type the dive site — local currency, timezone, nearest airport and jetty/transfer display automatically for known sites.', '选择国家（亚洲）并填写潜点——当地货币、时区、最近机场与码头接驳信息对已知潜点自动显示。')}</p>
          </CardHelp>
        </div>
        <div className="booking-form portal-form">
          <label className="span-2">{t('Country', '国家')}
            <select name="locationKey" value={countryKey} onChange={e => setCountryKey(e.target.value as CountryKey)} disabled={cancelled}>
              {COUNTRY_KEYS.map(k => <option key={k} value={k}>{t(COUNTRIES[k].nameEn, COUNTRIES[k].nameZh)}</option>)}
            </select>
          </label>
          <div className={`translate-field${fSiteEn.cls}`} data-tip={fSiteEn.tip}>
            <label htmlFor="dive-site-en"><span>{t('Dive site (English)', '潜点（英文）')}{fSiteEn.tip && <span className="blocker-dot" aria-hidden="true" />}</span></label>
            <input id="dive-site-en" name="diveSiteEn" value={diveSite} onChange={e => setDiveSite(e.target.value)} maxLength={200} disabled={cancelled} placeholder={t('e.g. Tioman Island', '例如：Tioman Island')} />
            <TranslateButton from="zh" to="en" getTexts={() => [diveSiteZhRef.current?.value ?? '']} onResults={([v]) => { if (v) setDiveSite(v) }} />
          </div>
          <div className={`translate-field${fSiteZh.cls}`} data-tip={fSiteZh.tip}>
            <label htmlFor="dive-site-zh"><span>{t('Dive site (Chinese)', '潜点（中文）')}{fSiteZh.tip && <span className="blocker-dot" aria-hidden="true" />}</span></label>
            <input id="dive-site-zh" name="diveSiteZh" ref={diveSiteZhRef} defaultValue={trip.diveSiteZh ?? ''} maxLength={200} disabled={cancelled} placeholder={t('Chinese dive site name', '例如：刁曼岛')} />
            <TranslateButton from="en" to="zh" getTexts={() => [diveSite]} onResults={([v]) => { if (v && diveSiteZhRef.current) diveSiteZhRef.current.value = v }} />
          </div>
          <dl className="location-facts span-2">
            <div><dt>{t('Local currency', '当地货币')}</dt><dd>{loc.localCurrency}</dd></div>
            <div><dt>{t('Timezone', '时区')}</dt><dd>{loc.timezone} ({tzOffset(loc.timezone)})</dd></div>
            <div><dt>{t('Nearest airport', '最近机场')}</dt><dd>{site ? t(site.airportEn, site.airportZh) : '—'}</dd></div>
            <div><dt>{t('Jetty & transfer', '码头与接驳')}</dt><dd>{site ? t(site.jettyEn, site.jettyZh) : '—'}</dd></div>
          </dl>
          {!site && diveSite.trim() !== '' && <p className="portal-hint span-2">{t('Airport and jetty info display automatically for known sites; new sites are added to the reference list.', '已知潜点会自动显示机场与码头信息；新潜点需加入参考清单。')}</p>}
        </div>
      </section>

      <section className="portal-card">
        <h2>{t('Schedule', '日期')}</h2>
        <div className="booking-form portal-form">
          <label className={fStart.cls.trim() || undefined} data-tip={fStart.tip}><span>{t('Departure', '出发日期')}{fStart.tip && <span className="blocker-dot" aria-hidden="true" />}</span><input name="travelStart" type="date" defaultValue={dateValue(trip.travelStart)} disabled={cancelled} /></label>
          <label className={fEnd.cls.trim() || undefined} data-tip={fEnd.tip}><span>{t('Return', '结束日期')}{fEnd.tip && <span className="blocker-dot" aria-hidden="true" />}</span><input name="travelEnd" type="date" defaultValue={dateValue(trip.travelEnd)} disabled={cancelled} /></label>
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
          <label className={fPrice.cls.trim() || undefined} data-tip={fPrice.tip}><span>{t('Price per person', '每人价格')}{fPrice.tip && <span className="blocker-dot" aria-hidden="true" />}</span><input name="priceAmount" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} disabled={cancelled} placeholder="0.00" /></label>
          <div className={`portal-field span-2${fDep.cls}`} data-tip={fDep.tip}>
            <span className="portal-field-label">{t('Deposits (fixed amounts)', '订金（固定金额）')}{fDep.tip && <span className="blocker-dot" aria-hidden="true" />}</span>
            <DepositEditor rows={depRows} onChange={setDepRows} disabled={cancelled}
              depositLabel={t('Deposit', '订金')} dueLabel={t('Due date', '截止日期')}
              addLabel={t('Add second deposit', '添加第二笔订金')} removeLabel={t('Remove second deposit', '移除第二笔订金')} />
          </div>
          <label className={flag('balanceDueDate').cls.trim() || undefined} data-tip={flag('balanceDueDate').tip}><span>{t('Final payment due date', '尾款截止日期')}{flag('balanceDueDate').tip && <span className="blocker-dot" aria-hidden="true" />}</span><input name="balanceDueDate" type="date" defaultValue={trip.balanceDueDate ?? ''} disabled={cancelled || balance === 0} /></label>
          <p className="portal-hint">{t('Points rate', '积分汇率')}: {Number(trip.rmRate).toFixed(4)} · {t('fixed when the trip was created', '行程创建时锁定')}</p>
          <p className="portal-currency span-2">{t('Deposits total', '订金合计')} {money(depTotal)} · {t('Balance', '尾款')} {money(balance)}</p>
        </div>
      </section>

      <section className="portal-card">
        <h2>{t('Capacity', '名额')}</h2>
        <div className="booking-form portal-form">
          <label className={fCap.cls.trim() || undefined} data-tip={fCap.tip}><span>{t('Total slots', '总名额')}{fCap.tip && <span className="blocker-dot" aria-hidden="true" />}</span><input name="capacity" type="number" min="1" step="1" defaultValue={trip.capacity} disabled={cancelled} /></label>
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

    </form>

    <PortalDialog open={dialog === 'closed'} title={t('Close trip', '关闭行程')} closeLabel={t('Close', '关闭')} onClose={() => setDialog(null)}>
      <form action={setLaunchState} className="booking-form" onSubmit={() => setDialog(null)}>
        <input type="hidden" name="tripId" value={trip.id} />
        <input type="hidden" name="state" value="closed" />
        <p className="portal-hint">{t('The trip page is hidden from the public site. Existing bookings and payments stay serviceable.', '行程页将从公开网站隐藏。已有预订和付款仍可处理。')}</p>
        <button className="btn btn-primary">{t('Close trip', '关闭行程')}</button>
      </form>
    </PortalDialog>

    <PortalDialog open={dialog === 'draft'} title={t('Back to draft', '回到草稿')} closeLabel={t('Close', '关闭')} onClose={() => setDialog(null)}>
      <form action={setLaunchState} className="booking-form" onSubmit={() => setDialog(null)}>
        <input type="hidden" name="tripId" value={trip.id} />
        <input type="hidden" name="state" value="draft" />
        <p className="portal-hint">{t('The trip is hidden from the public site. Only possible while no booking exists.', '行程将从公开网站隐藏。仅限尚无预订时可用。')}</p>
        <button className="btn btn-primary">{t('Back to draft', '回到草稿')}</button>
      </form>
    </PortalDialog>

    <PortalDialog open={dialog === 'delete'} title={t('Delete draft', '删除草稿')} closeLabel={t('Close', '关闭')} onClose={() => setDialog(null)}>
      <form action={deleteDraft} className="booking-form" onSubmit={() => setDialog(null)}>
        <input type="hidden" name="tripId" value={trip.id} />
        <p className="portal-hint">{t('Only unpublished drafts without bookings can be deleted. A full snapshot is kept in the audit log.', '仅可删除无预订的未发布草稿。审计日志会保留完整快照。')}</p>
        <button className="btn btn-danger-solid">{t('Delete this draft', '删除此草稿')}</button>
      </form>
    </PortalDialog>
  </div></main>
}