/**
 * Transactional emails beyond the Auth.js magic link (MVP-SPEC §11).
 * M5 item 6: bilingual trip-cancellation notice. Sent in the customer's stored
 * locale; calm, capable tone per the vibe doc — no guarantees, refund is a
 * stated next step Iris executes externally (§6), never an automated promise.
 */
import { Resend } from 'resend'

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