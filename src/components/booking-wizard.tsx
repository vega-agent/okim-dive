'use client'

// M4 booking wizard (MVP-SPEC §5): email → magic link → declarations + policy
// acceptance → booking + invoice. Payment evidence is manual via WhatsApp
// (decision #20) — the confirmation explains the next step, no upload UI.
// Bilingual via useLocale (data-driven surface).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, pick } from '@/lib/use-locale'
import { requestMagicLink, createBooking, setCustomerLocale, type BookingResult } from '@/lib/booking-actions'

type PolicyText = { version: number; bodyEn: string; bodyZh: string }

export type BookingWizardProps = {
  slug: string
  titleEn: string
  titleZh: string | null
  priceDisplay: string | null
  depositTextEn: string | null
  depositTextZh: string | null
  authenticated: boolean
  customerName: string
  customerLocale: 'en' | 'zh'
  sessionEmail: string
  refund: PolicyText
  terms: PolicyText
}

const L = {
  stepEmail: ['Email', '邮箱'],
  stepDetails: ['Your details', '填写资料'],
  stepDone: ['Confirmed', '完成'],
  emailTitle: ['Sign in to book', '登录以预订'],
  emailIntro: ['We will email you a secure sign-in link. No password needed.', '我们会通过电子邮件发送安全登录链接，无需密码。'],
  emailLabel: ['Email address', '电子邮件'],
  emailPlaceholder: ['you@example.com', 'you@example.com'],
  sendLink: ['Email me a sign-in link', '发送登录链接'],
  sending: ['Sending…', '发送中…'],
  sentTitle: ['Check your email', '请查收邮件'],
  sentIntro: ['We sent a sign-in link to', '我们已发送登录链接至'],
  sentExpiry: ['The link expires in 15 minutes and works once. Opening it on another device is fine — it returns you here.', '链接 15 分钟内有效，仅可使用一次。在其他设备打开也没问题——会回到此页面。'],
  resend: ['Resend link', '重新发送'],
  resendWait: ['Resend available in', '后可重新发送'],
  seconds: ['s', '秒'],
  cooldownMsg: ['Please wait a moment before requesting another link.', '请稍候再请求新的链接。'],
  rateMsg: ['Too many links requested. Try again later or contact us.', '请求次数过多，请稍后再试或联系我们。'],
  errorMsg: ['Something went wrong. Please try again.', '出现问题，请重试。'],
  detailsTitle: ['Your diving details', '你的潜水资料'],
  detailsIntro: ['Iris reviews these declarations before the trip. Answer honestly — safety decisions are always made by the instructor.', 'Iris 会在行程前审核这些申报。请如实填写——安全决定始终由教练作出。'],
  nameLabel: ['Full name', '姓名'],
  namePlaceholder: ['As on your certification card', '与认证卡上一致'],
  signedInAs: ['Signed in as', '已登录'],
  whatsappLabel: ['WhatsApp number (optional)', 'WhatsApp 号码（选填）'],
  whatsappPlaceholder: ['For trip coordination', '用于行程协调'],
  certLabel: ['Certification level', '认证等级'],
  certPlaceholder: ['Select your level', '选择你的等级'],
  certOptions: [['Open Water', '开放水域'], ['Advanced Open Water', '进阶开放水域'], ['Rescue Diver', '救援潜水员'], ['Divemaster or above', '潜水长或以上'], ['Other / equivalent', '其他／同等资格']],
  divesLabel: ['Logged dives', '记录潜水次数'],
  divesPlaceholder: ['Approximate number', '大致次数'],
  insuranceLabel: ['I have dive/travel insurance for this trip.', '我已为本次行程购买潜水／旅游保险。'],
  medicalLabel: ['I will complete a medical self-declaration and disclose any conditions that could affect diving.', '我将填写健康自我申报，并披露任何可能影响潜水的状况。'],
  emergencyNameLabel: ['Emergency contact name', '紧急联系人姓名'],
  emergencyNamePlaceholder: ['Next of kin or close contact', '亲属或密切联系人'],
  emergencyPhoneLabel: ['Emergency contact phone', '紧急联系人电话'],
  emergencyPhonePlaceholder: ['With country code', '含国家区号'],
  dobLabel: ['Date of birth', '出生日期'],
  policySummary: ['Read the refund policy and terms before accepting', '接受前请阅读退款政策与条款'],
  refundHeading: ['Refund policy', '退款政策'],
  termsHeading: ['Terms of booking', '预订条款'],
  version: ['Version', '版本'],
  acceptLabel: ['I accept the refund policy and terms shown above.', '我接受上述退款政策与条款。'],
  submitBooking: ['Create booking', '创建预订'],
  submitting: ['Creating…', '创建中…'],
  invalidMsg: ['Please complete all required fields and accept the policies.', '请填写所有必填项并接受政策。'],
  unavailableMsg: ['This trip is not open for booking right now.', '此行程目前不可预订。'],
  unauthMsg: ['Your sign-in expired. Start again with your email.', '登录已过期，请重新用邮箱开始。'],
  doneTitle: ['Booking received', '预订已收到'],
  doneIntro: ['Your booking is awaiting deposit. A slot is confirmed only after Iris verifies your deposit, subject to availability.', '你的预订等待订金。只有在 Iris 核实订金后、且仍有名额时，名额才会确认。'],
  bookingIdLabel: ['Booking ID (use as transfer reference)', '预订编号（用作转账备注）'],
  invoiceLabel: ['Invoice', '发票'],
  depositLabel: ['Deposit due now', '现在应付订金'],
  balanceLabel: ['Balance', '尾款'],
  balanceDueLabel: ['Balance due by', '尾款截止日期'],
  payTitle: ['How to pay', '如何付款'],
  payStep1: ['Transfer the deposit externally (bank transfer or PayNow), using your Booking ID as the reference.', '通过外部方式支付订金（银行转账或 PayNow），以预订编号作为转账备注。'],
  payStep2: ['Send the transfer screenshot to Iris via WhatsApp.', '通过 WhatsApp 将转账截图发给 Iris。'],
  payStep3: ['Iris checks the bank record and confirms your slot. You will receive a receipt.', 'Iris 核对银行记录后确认你的名额，你将收到收据。'],
  contactLink: ['Contact details for WhatsApp', 'WhatsApp 联系方式'],
  viewInvoice: ['View invoice', '查看发票'],
  backToTrip: ['Back to trip', '返回行程'],
  bankNote: ['Iris will share her receiving account details with you directly.', 'Iris 会直接向你提供收款账户信息。'],
} as const

export default function BookingWizard(props: BookingWizardProps) {
  // Signed-in: the customer's stored locale wins (default EN); toggling persists it.
  const locale = useLocale(
    props.authenticated ? props.customerLocale : undefined,
    props.authenticated ? (next) => void setCustomerLocale(next) : undefined,
  )
  const t = (pair: readonly [string, string]) => pick(locale, pair[0], pair[1])
  const [step, setStep] = useState<'email' | 'sent' | 'details' | 'confirmed'>(props.authenticated ? 'details' : 'email')
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [result, setResult] = useState<Extract<BookingResult, { status: 'created' }> | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const sendLink = async (target: string) => {
    setPending(true)
    setNotice(null)
    const res = await requestMagicLink(target, props.slug)
    setPending(false)
    if (res.status === 'sent') { setStep('sent'); setCooldown(60) }
    else if (res.status === 'cooldown') { setNotice(t(L.cooldownMsg)); setCooldown(60); setStep('sent') }
    else if (res.status === 'rate_limited') setNotice(t(L.rateMsg))
    else setNotice(t(L.errorMsg))
  }

  const submitDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    ;(form.elements.namedItem('locale') as HTMLInputElement).value = locale
    setPending(true)
    setNotice(null)
    const res = await createBooking(props.slug, new FormData(form))
    setPending(false)
    if (res.status === 'created') { setResult(res); setStep('confirmed') }
    else if (res.status === 'invalid') setNotice(t(L.invalidMsg))
    else if (res.status === 'trip_unavailable') setNotice(t(L.unavailableMsg))
    else if (res.status === 'unauthenticated') { setNotice(t(L.unauthMsg)); setStep('email') }
    else setNotice(t(L.errorMsg))
  }

  const stepIndex = step === 'email' || step === 'sent' ? 0 : step === 'details' ? 1 : 2

  return (
    <div className="booking-shell" data-locale-managed>
      <ol className="booking-steps">
        {[L.stepEmail, L.stepDetails, L.stepDone].map((label, i) => (
          <li key={label[0]} className={i === stepIndex ? 'current' : i < stepIndex ? 'done' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
            <span className="booking-step-mark" aria-hidden="true">{i + 1}</span>{t(label)}
          </li>
        ))}
      </ol>

      <div className="booking-card">
        <h2 className="booking-title">{pick(locale, props.titleEn, props.titleZh)}</h2>
        {props.priceDisplay && <p className="booking-price">{props.priceDisplay}</p>}

        {step === 'email' && (
          <form onSubmit={(e) => { e.preventDefault(); void sendLink(email) }}>
            <h3>{t(L.emailTitle)}</h3>
            <p className="booking-intro">{t(L.emailIntro)}</p>
            <div className="form-group">
              <label htmlFor="booking-email">{t(L.emailLabel)} *</label>
              <input id="booking-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t(L.emailPlaceholder)} autoComplete="email" />
            </div>
            {notice && <p className="form-status form-status-error" role="alert">{notice}</p>}
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? t(L.sending) : t(L.sendLink)}</button>
          </form>
        )}

        {step === 'sent' && (
          <div role="status">
            <h3>{t(L.sentTitle)}</h3>
            <p className="booking-intro">{t(L.sentIntro)} <strong>{email}</strong></p>
            <p className="booking-intro">{t(L.sentExpiry)}</p>
            {notice && <p className="form-status form-status-error" role="alert">{notice}</p>}
            <button type="button" className="btn btn-primary" disabled={pending || cooldown > 0} onClick={() => void sendLink(email)}>
              {cooldown > 0 ? `${t(L.resendWait)} ${cooldown}${t(L.seconds)}` : t(L.resend)}
            </button>
          </div>
        )}

        {step === 'details' && (
          <form onSubmit={submitDetails}>
            <input type="hidden" name="locale" defaultValue="en" />
            <h3>{t(L.detailsTitle)}</h3>
            <p className="booking-intro">{t(L.detailsIntro)}</p>
            <p className="booking-signed-in">{t(L.signedInAs)} <strong>{props.sessionEmail}</strong></p>
            <div className="form-group">
              <label htmlFor="b-name">{t(L.nameLabel)} *</label>
              <input id="b-name" name="name" required defaultValue={props.customerName} placeholder={t(L.namePlaceholder)} autoComplete="name" />
            </div>
            <div className="form-group">
              <label htmlFor="b-whatsapp">{t(L.whatsappLabel)}</label>
              <input id="b-whatsapp" name="whatsapp" type="tel" placeholder={t(L.whatsappPlaceholder)} autoComplete="tel" />
            </div>
            <div className="form-group">
              <label htmlFor="b-cert">{t(L.certLabel)} *</label>
              <select id="b-cert" name="cert_level" required defaultValue="">
                <option value="" disabled>{t(L.certPlaceholder)}</option>
                {L.certOptions.map(([en, zh]) => <option key={en} value={en}>{pick(locale, en, zh)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="b-dives">{t(L.divesLabel)} *</label>
              <input id="b-dives" name="logged_dives" type="number" min={0} max={10000} required inputMode="numeric" placeholder={t(L.divesPlaceholder)} />
            </div>
            <div className="form-group form-consent">
              <label><input type="checkbox" name="insurance" required /> {t(L.insuranceLabel)} *</label>
            </div>
            <div className="form-group form-consent">
              <label><input type="checkbox" name="medical" required /> {t(L.medicalLabel)} *</label>
            </div>
            <div className="form-group">
              <label htmlFor="b-emergency-name">{t(L.emergencyNameLabel)} *</label>
              <input id="b-emergency-name" name="emergency_name" required placeholder={t(L.emergencyNamePlaceholder)} />
            </div>
            <div className="form-group">
              <label htmlFor="b-emergency-phone">{t(L.emergencyPhoneLabel)} *</label>
              <input id="b-emergency-phone" name="emergency_phone" type="tel" required placeholder={t(L.emergencyPhonePlaceholder)} />
            </div>
            <div className="form-group">
              <label htmlFor="b-dob">{t(L.dobLabel)} *</label>
              <input id="b-dob" name="dob" type="date" required />
            </div>
            <details className="booking-policy">
              <summary>{t(L.policySummary)} *</summary>
              <h4>{t(L.refundHeading)} · {t(L.version)} {props.refund.version}</h4>
              <div className="booking-policy-body">{pick(locale, props.refund.bodyEn, props.refund.bodyZh)}</div>
              <h4>{t(L.termsHeading)} · {t(L.version)} {props.terms.version}</h4>
              <div className="booking-policy-body">{pick(locale, props.terms.bodyEn, props.terms.bodyZh)}</div>
            </details>
            <div className="form-group form-consent">
              <label><input type="checkbox" name="accept_policy" required /> {t(L.acceptLabel)} *</label>
            </div>
            {notice && <p className="form-status form-status-error" role="alert">{notice}</p>}
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? t(L.submitting) : t(L.submitBooking)}</button>
          </form>
        )}

        {step === 'confirmed' && result && (
          <div role="status">
            <h3>{t(L.doneTitle)}</h3>
            <p className="booking-intro">{t(L.doneIntro)}</p>
            <dl className="booking-summary">
              <div><dt>{t(L.bookingIdLabel)}</dt><dd className="booking-id">{result.bookingId}</dd></div>
              <div><dt>{t(L.invoiceLabel)}</dt><dd>{result.invoiceNumber}</dd></div>
              <div><dt>{t(L.depositLabel)}</dt><dd>{result.currency} {result.deposit}</dd></div>
              <div><dt>{t(L.balanceLabel)}</dt><dd>{result.currency} {result.balance}</dd></div>
              {result.balanceDue && <div><dt>{t(L.balanceDueLabel)}</dt><dd>{result.balanceDue}</dd></div>}
            </dl>
            <h4>{t(L.payTitle)}</h4>
            <ol className="booking-pay-steps">
              <li>{t(L.payStep1)}</li>
              <li>{t(L.payStep2)} <Link href="/contact" className="text-link">{t(L.contactLink)}</Link></li>
              <li>{t(L.payStep3)}</li>
            </ol>
            <p className="booking-intro">{t(L.bankNote)}</p>
            <div className="booking-actions">
              <Link className="btn btn-primary" href={`/invoice/${result.bookingId}`}>{t(L.viewInvoice)}</Link>
              <Link className="text-link" href={`/trips/${props.slug}`}>{t(L.backToTrip)}</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}