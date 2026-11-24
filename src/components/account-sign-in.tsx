'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { requestDiverLink, requestPortalLink } from '@/lib/account-sign-in-actions'
import { useLocale } from '@/lib/use-locale'

function SendButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <button className="btn btn-primary" type="submit" disabled={pending}>{label}</button>
}

export default function AccountSignIn({ area }: { area: 'portal' | 'myokim' }) {
  const instructor = area === 'portal'
  const zh = useLocale() === 'zh'
  const t = (en: string, cn: string) => zh ? cn : en
  const [state, action] = useFormState(instructor ? requestPortalLink : requestDiverLink, '')
  const messages: Record<string, string> = {
    sent: instructor
      ? t('If this email has instructor access, you’ll receive a sign-in link. It expires in 15 minutes.', '如果此邮箱有教练权限，您将收到登录链接。链接在 15 分钟内有效。')
      : t('Check your email for a sign-in link. It expires in 15 minutes.', '请查看邮箱中的登录链接。链接在 15 分钟内有效。'),
    invalid: zh ? '请输入有效的邮箱地址。' : 'Enter a valid email address.',
    wait: zh ? '请求过于频繁，请稍后再试。' : 'Please wait before requesting another link.',
    error: zh ? '登录链接发送失败，请重试。' : 'We couldn’t send the sign-in link. Please try again.',
  }
  const heading = instructor ? t('Instructor sign-in', '教练登录') : t('Sign in to My Okim', '登录我的 Okim')
  const emailLabel = instructor ? t('Instructor email', '教练邮箱') : t('Email address', '邮箱')
  return <main className="ocean-journey"><section className="trips-section"><div className="container">
    <div className="booking-shell" data-locale-managed><div className="booking-card">
      <h1>{heading}</h1>
      <form action={action} className="booking-form">
        <div className="form-group">
          <label htmlFor={area + '-email'}>{emailLabel}</label>
          <input id={area + '-email'} name="email" type="email" autoComplete="email" required />
        </div>
        <SendButton label={zh ? '发送登录链接' : 'Email me a sign-in link'} />
        <p role="status">{messages[state]}</p>
      </form>
    </div></div>
  </div></section></main>
}
