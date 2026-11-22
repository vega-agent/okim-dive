/**
 * Transactional emails beyond the Auth.js magic link (MVP-SPEC §11).
 * M5 item 6: bilingual trip-cancellation notice. Sent in the customer's stored
 * locale; calm, capable tone per the vibe doc — no guarantees, refund is a
 * stated next step Iris executes externally (§6), never an automated promise.
 */
import { Resend } from 'resend'
import { localEmailsDisabled } from './local-email-gate'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type TripCancelledEmail = {
  to: string
  locale: 'en' | 'zh'
  customerName: string
  tripTitle: string
  bookingIds: string[]
  reason: string
}

function cancelledEmailHtml(d: TripCancelledEmail): string {
  const zh = d.locale === 'zh'
  const name = escapeHtml(d.customerName || (zh ? '潜水员' : 'diver'))
  const title = escapeHtml(d.tripTitle)
  const reason = escapeHtml(d.reason)
  const ids = d.bookingIds.map(escapeHtml).join(', ')
  const button = 'display:inline-block;background:#e63946;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;'
  const body = zh ? `
    <p style="margin:0 0 12px;">${name}，你好：</p>
    <p style="margin:0 0 12px;">很抱歉通知你，行程 <strong>${title}</strong> 已取消。预订编号：${ids}。</p>
    <p style="margin:0 0 12px;color:#6c757d;font-size:14px;">取消原因：${reason}</p>
    <p style="margin:0 0 12px;">接下来：Iris 会逐一安排已核实付款的全额退款，并通过 WhatsApp 或邮件与你确认退款进度。已累积的 Okim 积分会在退款记录时相应冲正。无需你操作，请留意 Iris 的消息。</p>
    <p style="margin:0 0 24px;">如有疑问，直接回复本邮件或通过 WhatsApp 联系 Iris。</p>
    <p style="margin:0;">Iris · Okim Dive</p>` : `
    <p style="margin:0 0 12px;">Hi ${name},</p>
    <p style="margin:0 0 12px;">We're sorry to let you know that <strong>${title}</strong> has been cancelled. Booking reference${d.bookingIds.length > 1 ? 's' : ''}: ${ids}.</p>
    <p style="margin:0 0 12px;color:#6c757d;font-size:14px;">Reason: ${reason}</p>
    <p style="margin:0 0 12px;">What happens next: Iris will arrange a full refund of every verified payment, one by one, and confirm progress with you over WhatsApp or email. Okim Points earned on those payments are reversed when each refund is recorded. Nothing is needed from you — watch for Iris's message.</p>
    <p style="margin:0 0 24px;">Questions? Reply to this email or reach Iris on WhatsApp.</p>
    <p style="margin:0;">Iris · Okim Dive</p>`
  return `<!DOCTYPE html>
<html><body style="margin:0;background:#f1faee;font-family:Lato,'Noto Sans SC',Arial,sans-serif;color:#264653;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:20px;font-weight:700;margin:0 0 24px;">Okim Dive</p>
    ${body}
  </div>
</body></html>`
}

/** Sends one cancellation notice. Returns true on accept; never throws (cancel must not fail on email). */
export async function sendTripCancelledEmail(d: TripCancelledEmail): Promise<boolean> {
  if (localEmailsDisabled()) return false
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  try {
    const client = new Resend(apiKey)
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM ?? 'Okim Dive <onboarding@resend.dev>',
      to: d.to,
      subject: d.locale === 'zh'
        ? `你的 Okim Dive 行程已取消 · ${d.tripTitle}`
        : `Your Okim Dive trip has been cancelled · ${d.tripTitle}`,
      html: cancelledEmailHtml(d),
    })
    if (error) {
      console.error('[trip-cancelled-email] send rejected.', error.message)
      return false
    }
    return true
  } catch (error) {
    console.error('[trip-cancelled-email] send failed.', error instanceof Error ? error.message : String(error))
    return false
  }
}

/* ---------- Seamless journey (S1–S4, 2026-11-22): deposit prompt, reminder,
   confirmation, hold expiry/release. Same calm vibe; one CTA max; failures
   never throw — the booking flow must not fail on email. ---------- */

const baseUrl = () => (process.env.AUTH_URL ?? 'http://localhost:3100').replace(/\/$/, '')
const money = (currency: string, amount: string) => `${currency} ${Number(amount).toFixed(2)}`
const longDate = (iso: string, locale: 'en' | 'zh') => new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function shell(body: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;background:#f1faee;font-family:Lato,'Noto Sans SC',Arial,sans-serif;color:#264653;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:20px;font-weight:700;margin:0 0 24px;">Okim Dive</p>
    ${body}
  </div>
</body></html>`
}
const cta = (href: string, label: string) => `<p style="margin:0 0 24px;"><a href="${href}" style="display:inline-block;background:#e63946;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">${label}</a></p>`
const sign = (zh: boolean) => `<p style="margin:0;">Iris · Okim Dive</p>`

export type DepositPromptEmail = {
  to: string; locale: 'en' | 'zh'; customerName: string; tripTitle: string
  bookingId: string; amount: string; currency: string; dueDate: string
}

function promptHtml(d: DepositPromptEmail, reminder: boolean): string {
  const zh = d.locale === 'zh'
  const name = escapeHtml(d.customerName || (zh ? '潜水员' : 'diver'))
  const title = escapeHtml(d.tripTitle)
  const due = longDate(d.dueDate, d.locale)
  const amount = money(d.currency, d.amount)
  const ref = escapeHtml(d.bookingId)
  const body = zh ? `
    <p style="margin:0 0 12px;">${name}，你好：</p>
    <p style="margin:0 0 12px;">${reminder ? '提醒：' : ''}你的 <strong>${title}</strong> 预订已保留名额 14 天。请在 <strong>${due}</strong> 前转账订金 <strong>${amount}</strong>。</p>
    <p style="margin:0 0 12px;">转账备注请使用预订编号：<strong>${ref}</strong>。转账后请把截图通过 WhatsApp 发给 Iris——她核对银行到账后会确认你的预订，确认邮件与收据会随即送达。</p>
    <p style="margin:0 0 12px;color:#6c757d;font-size:14px;">逾期未付款，名额将自动释放；如需延期，请联系 Iris。</p>
    ${cta(`${baseUrl()}/myokim`, '查看我的预订')}
    <p style="margin:0 0 24px;">如有疑问，直接回复本邮件或通过 WhatsApp 联系 Iris。</p>
    ${sign(true)}` : `
    <p style="margin:0 0 12px;">Hi ${name},</p>
    <p style="margin:0 0 12px;">${reminder ? 'A reminder: ' : ''}your <strong>${title}</strong> booking is holding a slot for 14 days. Please transfer the deposit of <strong>${amount}</strong> by <strong>${due}</strong>.</p>
    <p style="margin:0 0 12px;">Use your booking reference as the transfer reference: <strong>${ref}</strong>. After transferring, send the screenshot to Iris on WhatsApp — once she matches it in the bank record she confirms your booking, and a confirmation email with your receipt follows.</p>
    <p style="margin:0 0 12px;color:#6c757d;font-size:14px;">If payment doesn't arrive by the due date, the slot is released automatically. Need more time? Contact Iris.</p>
    ${cta(`${baseUrl()}/myokim`, 'View my booking')}
    <p style="margin:0 0 24px;">Questions? Reply to this email or reach Iris on WhatsApp.</p>
    ${sign(false)}`
  return shell(body)
}

async function sendPrompt(d: DepositPromptEmail, reminder: boolean): Promise<boolean> {
  if (localEmailsDisabled()) return false
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  const tag = reminder ? 'deposit-reminder-email' : 'deposit-prompt-email'
  try {
    const client = new Resend(apiKey)
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM ?? 'Okim Dive <onboarding@resend.dev>',
      to: d.to,
      subject: d.locale === 'zh'
        ? (reminder ? `订金提醒 · ${d.tripTitle} · 截止 ${longDate(d.dueDate, 'zh')}` : `预订已保留 · ${d.tripTitle} · 请于 ${longDate(d.dueDate, 'zh')} 前转账订金`)
        : (reminder ? `Deposit reminder · ${d.tripTitle} · due ${longDate(d.dueDate, 'en')}` : `Booking held · ${d.tripTitle} · deposit due ${longDate(d.dueDate, 'en')}`),
      html: promptHtml(d, reminder),
    })
    if (error) { console.error(`[${tag}] send rejected.`, error.message); return false }
    return true
  } catch (error) {
    console.error(`[${tag}] send failed.`, error instanceof Error ? error.message : String(error))
    return false
  }
}

/** Transfer prompt at booking (S1). Never throws. */
export async function sendDepositPromptEmail(d: DepositPromptEmail): Promise<boolean> { return sendPrompt(d, false) }
/** Reminder 3 days before the hold expires (S4, #22). Never throws. */
export async function sendDepositReminderEmail(d: DepositPromptEmail): Promise<boolean> { return sendPrompt(d, true) }

export type BookingConfirmedEmail = {
  to: string; locale: 'en' | 'zh'; customerName: string; tripTitle: string
  bookingId: string; amount: string; currency: string; kind: string
  paymentId: string; pointsEarned: number; balanceDue: string | null
}

/** Confirmation + receipt when Iris clicks Received (S1/S4). Never throws. */
export async function sendBookingConfirmedEmail(d: BookingConfirmedEmail): Promise<boolean> {
  if (localEmailsDisabled()) return false
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  const zh = d.locale === 'zh'
  const name = escapeHtml(d.customerName || (zh ? '潜水员' : 'diver'))
  const title = escapeHtml(d.tripTitle)
  const kindLabel = d.kind === 'deposit' ? (zh ? '订金' : 'deposit') : d.kind === 'balance' ? (zh ? '尾款' : 'balance') : (zh ? '全款' : 'full payment')
  const balanceLine = d.balanceDue
    ? (zh ? `<p style="margin:0 0 12px;">尾款请于 ${longDate(d.balanceDue, 'zh')} 前缴清——届时你会收到提醒。</p>` : `<p style="margin:0 0 12px;">The balance is due by ${longDate(d.balanceDue, 'en')} — you'll receive a reminder.</p>`)
    : ''
  const body = zh ? `
    <p style="margin:0 0 12px;">${name}，你好：</p>
    <p style="margin:0 0 12px;">好消息——Iris 已核对银行到账，你的 <strong>${title}</strong> 预订（编号 ${escapeHtml(d.bookingId)}）<strong>已确认</strong>。本次收到${kindLabel} <strong>${money(d.currency, d.amount)}</strong>。</p>
    <p style="margin:0 0 12px;">付款不会发放积分。Iris 确认你的个人预订已完成后，才会按净核实现金付款一次性发放积分；发放后即可使用，有效期为完成日起 12 个日历月。</p>
    ${balanceLine}
    ${cta(`${baseUrl()}/receipt/${encodeURIComponent(d.paymentId)}`, '查看收据')}
    <p style="margin:0 0 24px;">出发前的准备与简报，Iris 会通过 WhatsApp 与你安排。</p>
    ${sign(true)}` : `
    <p style="margin:0 0 12px;">Hi ${name},</p>
    <p style="margin:0 0 12px;">Good news — Iris matched your transfer in the bank record. Your <strong>${title}</strong> booking (reference ${escapeHtml(d.bookingId)}) is <strong>confirmed</strong>. We received your ${kindLabel} of <strong>${money(d.currency, d.amount)}</strong>.</p>
    <p style="margin:0 0 12px;">Payments do not award points. Iris awards points once on completion of your individual booking, based on net verified cash paid. They are immediately usable and expire 12 calendar months from completion.</p>
    ${balanceLine}
    ${cta(`${baseUrl()}/receipt/${encodeURIComponent(d.paymentId)}`, 'View receipt')}
    <p style="margin:0 0 24px;">Iris will arrange prep and briefing with you over WhatsApp before departure.</p>
    ${sign(false)}`
  try {
    const client = new Resend(apiKey)
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM ?? 'Okim Dive <onboarding@resend.dev>',
      to: d.to,
      subject: zh ? `预订已确认 · ${d.tripTitle}` : `Booking confirmed · ${d.tripTitle}`,
      html: shell(body),
    })
    if (error) { console.error('[booking-confirmed-email] send rejected.', error.message); return false }
    return true
  } catch (error) {
    console.error('[booking-confirmed-email] send failed.', error instanceof Error ? error.message : String(error))
    return false
  }
}

export type HoldExpiredEmail = {
  to: string; locale: 'en' | 'zh'; customerName: string; tripTitle: string
  bookingId: string; mode: 'expired' | 'released'; reason?: string
}

/** Hold expiry or instructor release (S4, #22). Calm, no blame. Never throws. */
export async function sendHoldExpiredEmail(d: HoldExpiredEmail): Promise<boolean> {
  if (localEmailsDisabled()) return false
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  const zh = d.locale === 'zh'
  const name = escapeHtml(d.customerName || (zh ? '潜水员' : 'diver'))
  const title = escapeHtml(d.tripTitle)
  const reasonLine = d.mode === 'released' && d.reason
    ? `<p style="margin:0 0 12px;color:#6c757d;font-size:14px;">${zh ? '原因' : 'Reason'}: ${escapeHtml(d.reason)}</p>`
    : ''
  const body = zh ? `
    <p style="margin:0 0 12px;">${name}，你好：</p>
    <p style="margin:0 0 12px;">你的 <strong>${title}</strong> 预订（编号 ${escapeHtml(d.bookingId)}）${d.mode === 'expired' ? '因 14 天内未收到订金，名额已自动释放' : '已由 Iris 释放'}。未收取任何费用。</p>
    ${reasonLine}
    <p style="margin:0 0 12px;">仍想同行？名额开放时欢迎重新预订，或直接联系 Iris 安排。</p>
    ${cta(`${baseUrl()}/trips`, '查看行程')}
    ${sign(true)}` : `
    <p style="margin:0 0 12px;">Hi ${name},</p>
    <p style="margin:0 0 12px;">Your <strong>${title}</strong> booking (reference ${escapeHtml(d.bookingId)}) ${d.mode === 'expired' ? 'has been released automatically — no deposit arrived within the 14-day window' : 'has been released by Iris'}. Nothing has been charged.</p>
    ${reasonLine}
    <p style="margin:0 0 12px;">Still want to join? You're welcome to rebook when a slot is open, or contact Iris to arrange.</p>
    ${cta(`${baseUrl()}/trips`, 'Browse trips')}
    ${sign(false)}`
  try {
    const client = new Resend(apiKey)
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM ?? 'Okim Dive <onboarding@resend.dev>',
      to: d.to,
      subject: zh ? `预订名额已释放 · ${d.tripTitle}` : `Booking slot released · ${d.tripTitle}`,
      html: shell(body),
    })
    if (error) { console.error('[hold-expired-email] send rejected.', error.message); return false }
    return true
  } catch (error) {
    console.error('[hold-expired-email] send failed.', error instanceof Error ? error.message : String(error))
    return false
  }
}
