import { Resend } from 'resend'
import type { StageInput } from './payment-schedule'
import { localEmailsDisabled } from './local-email-gate'

export type DepositPromptEmail = {
  to: string; locale: 'en' | 'zh'; customerName: string; tripTitle: string
  bookingId: string; currency: string; stages: StageInput[]
}

const escape = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

export async function sendDepositPromptEmail(d: DepositPromptEmail): Promise<boolean> {
  if (localEmailsDisabled() || !process.env.RESEND_API_KEY) return false
  const t = (en: string, zh: string) => d.locale === 'zh' ? zh : en
  const schedule = d.stages.map(stage => {
    const title = stage.kind === 'final' ? t('Final payment','尾款') : t('Deposit ','订金 ') + stage.position
    return '<li>' + title + ' · ' + escape(d.currency) + ' ' + (stage.amountMinor / 100).toFixed(2) +
      (stage.amountMinor && stage.dueDate ? ' · ' + escape(stage.dueDate) : '') + '</li>'
  }).join('')
  const reference = escape(d.bookingId)
  const myOkim = new URL('/myokim', process.env.AUTH_URL).href
  const html = '<p>' + escape(d.customerName) + t(', your place is reserved for ', '，已为你预留行程名额：') +
    escape(d.tripTitle) + t('.','。') + '</p>' + '<ul>' + schedule + '</ul><p>' +
    t('Use bank transfer or PayNow with reference ','请通过银行转账或 PayNow 付款，备注预订编号 ') + reference +
    t('. Iris will share the account details directly. Send your transfer screenshot to her on WhatsApp. She confirms your place once the full first deposit is verified.',
      '。Iris 会直接提供收款资料。转账后请通过 WhatsApp 发给她付款截图。第一笔订金全部到账并核实后，预订即获确认。') +
    '</p><p><a href="' + escape(myOkim) + '">' + t('View My Okim','查看我的 Okim') + '</a></p><p>Iris · Okim Dive</p>'
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: process.env.EMAIL_FROM ?? 'Okim Dive <onboarding@resend.dev>', to: d.to,
    subject: t('Booking received · ','已收到预订 · ') + d.tripTitle, html,
  })
  return !error
}
