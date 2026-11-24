'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { requestPortalLink } from '@/lib/portal-sign-in-action'
import { useLocale } from '@/lib/use-locale'

function SendButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <button className="btn btn-primary" type="submit" disabled={pending}>{label}</button>
}

export default function PortalSignIn() {
  const zh = useLocale() === 'zh'
  const [state, action] = useFormState(requestPortalLink, '')
  const messages: Record<string, string> = {
    sent: zh ? '如果此邮箱有教练权限，您将收到登录链接。链接在 15 分钟内有效。' : 'If this email has instructor access, you’ll receive a sign-in link. It expires in 15 minutes.',
    invalid: zh ? '请输入有效的邮箱地址。' : 'Enter a valid email address.',
    wait: zh ? '请求过于频繁，请稍后再试。' : 'Please wait before requesting another link.',
    error: zh ? '登录链接发送失败，请重试。' : 'We couldn’t send the sign-in link. Please try again.',
  }
  return <main className="ocean-journey"><section className="trips-section"><div className="container">
    <div className="booking-shell" data-locale-managed><div className="booking-card">
      <h1>{zh ? '教练登录' : 'Instructor sign-in'}</h1>
      <form action={action} className="booking-form">
        <div className="form-group">
          <label htmlFor="portal-email">{zh ? '教练邮箱' : 'Instructor email'}</label>
          <input id="portal-email" name="email" type="email" autoComplete="email" required />
        </div>
        <SendButton label={zh ? '发送登录链接' : 'Email me a sign-in link'} />
        <p role="status">{messages[state]}</p>
      </form>
    </div></div>
  </div></section></main>
}
