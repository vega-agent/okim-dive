'use client'

// M6 owner revision (2026-11-21): Profile relaid out to the §13 sub-card
// pattern — full container width (matches the tab bar), three grouped cards
// (Contact & language / Certification & dives / Equipment defaults), weight
// discipline, one right-aligned Save at the end, rental notices as fine print.
// Field names, validation and saveDiverProfile behavior unchanged.
import { useState } from 'react'
import CertificationFields from './certification-fields'
import EquipmentEditor from './equipment-editor'
import { saveDiverProfile } from '@/lib/diver-actions'
import { RENTAL_NOTICE } from '@/lib/diver-equipment'

export default function DiverProfile({ customer }: { customer: { id: string; name: string; email: string; phone: string | null; locale: 'en' | 'zh'; diverProfile: Record<string, unknown> | null } }) {
  const [notice, setNotice] = useState(''); const [pending, setPending] = useState(false)
  const t = (en: string, zh: string) => customer.locale === 'zh' ? zh : en
  const p = customer.diverProfile ?? {}
  return <section id="profile" className="my-profile">
    <div className="portal-card-head my-profile-head">
      <h2><img src="/assets/icons/ui-diver.webp" alt="" width={20} height={20} />{t('Diver profile', '潜水员资料')}</h2>
    </div>
    <form onSubmit={async e => { e.preventDefault(); setPending(true); const r = await saveDiverProfile(new FormData(e.currentTarget)); setNotice(r === 'saved' ? t('Saved. Upcoming eligibility changes need Iris review.', '已保存。即将出发预订的资格变更需 Iris 审核。') : t('Not saved. Check your details or contact Iris.', '未保存。请检查资料或联系 Iris。')); setPending(false) }}>
      <section className="my-subcard">
        <header className="my-subcard-head"><h3><img src="/assets/icons/ui-contact.webp" alt="" width={20} height={20} />{t('Contact & language', '联系与语言')}</h3></header>
        <div className="my-subcard-body">
          <p className="my-meta">{customer.id} · {customer.email} — {t('your customer ID is permanent; contact Iris to change your email.', '客户编号永久不变；如需更改邮箱请联系 Iris。')}</p>
          <div className="profile-grid">
            <div className="form-group"><label htmlFor="profile-name">{t('Name', '称呼')}</label><input id="profile-name" name="name" style={{ minHeight: 44 }} required maxLength={100} defaultValue={customer.name} /></div>
            <div className="form-group"><label htmlFor="profile-phone">{t('Phone', '电话')}</label><input id="profile-phone" name="phone" style={{ minHeight: 44 }} maxLength={40} defaultValue={customer.phone ?? ''} /></div>
            <label>{t('Language', '语言')}<select name="locale" defaultValue={customer.locale} style={{ minHeight: 44 }}><option value="en">{t('English', '英文')}</option><option value="zh">{t('Chinese (Simplified)', '简体中文')}</option></select></label>
          </div>
        </div>
      </section>
      <section className="my-subcard">
        <header className="my-subcard-head"><h3><img src="/assets/icons/ui-cert-card.webp" alt="" width={20} height={20} />{t('Certification & dives', '认证与潜水记录')}</h3></header>
        <div className="my-subcard-body">
          <p className="my-meta">{t('Self-declared; Iris reviews suitability before each trip.', '自行申报；Iris 会在每次行程前审核适宜性。')}</p>
          <div className="profile-grid">
            <CertificationFields agency={String(p.agency ?? 'Not certified')} level={String(p.level ?? 'Not certified')} locale={customer.locale} />
            <label>{t('Total logged dives (not a logbook)', '累计潜水次数（非完整日志）')}<input name="dives" type="number" min={0} max={10000} required style={{ minHeight: 44 }} defaultValue={Number(p.dives ?? 0)} /></label>
          </div>
        </div>
      </section>
      <section className="my-subcard">
        <header className="my-subcard-head"><h3><img src="/assets/icons/eq-bring-mask.webp" alt="" width={20} height={20} />{t('Equipment defaults', '装备默认')}</h3></header>
        <div className="my-subcard-body">
          <p className="my-meta">{t('These defaults auto-fill the equipment board on new bookings.', '这些默认值会自动填入新预订的装备分类板。')}</p>
          <div className="profile-eq">
            <EquipmentEditor profileMode profile={p.equipment} locale={customer.locale} notices={false} />
          </div>
        </div>
      </section>
      <div className="my-save-row">
        <p role="status">{notice}</p>
        <button className="btn btn-primary" disabled={pending} style={{ minHeight: 44 }}>{t('Save profile', '保存资料')}</button>
      </div>
      <p className="my-disclaimer">{RENTAL_NOTICE[customer.locale === 'zh' ? 1 : 0]} {t('Rental cost and payment are arranged at the dive shop on the trip, outside your invoice, balance and points.', '租赁费用与付款在行程期间于潜店安排，不计入发票、余额或积分。')}</p>
      <p className="my-disclaimer">{t('Declaration: the information you provide must be true, complete and accurate at the point of registration. You are responsible for its truthfulness; Iris relies on it for trip planning and safety. Tell Iris immediately if anything changes.', '声明：你所提供的信息在登记时必须真实、完整、准确。你须对其真实性负责；Iris 依赖这些资料进行行程规划与安全保障。如有任何变更，请立即告知 Iris。')}</p>
    </form>
  </section>
}