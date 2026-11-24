'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { requestDiverLink, requestPortalLink } from '@/lib/account-sign-in-actions'
import { useLocale } from '@/lib/use-locale'
import styles from './account-sign-in.module.css'

function SendButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return <button className={styles.submit} type="submit" disabled={pending} aria-busy={pending}>{pending ? pendingLabel : label}</button>
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
  const instruction = instructor
    ? t('Use your approved instructor email to access the portal.', '请使用已获授权的教练邮箱登录工作台。')
    : t('Use your booking email to view your trips and Okim Points.', '使用预订时的邮箱查看行程与 Okim 积分。')

  return <main className={styles.page} data-locale-managed>
    <div className={styles.card}>
      <div className={instructor ? styles.instructorArt : styles.diverArt} aria-hidden="true" />
      <div className={styles.panel}>
        <h1>{heading}</h1>
        <p className={styles.intro}>{instruction}</p>
        <form action={action} className={styles.form}>
          <label htmlFor={area + '-email'}>{emailLabel}</label>
          <input id={area + '-email'} name="email" type="email" autoComplete="email" required />
          <SendButton label={t('Email me a sign-in link', '发送登录链接')} pendingLabel={t('Sending…', '正在发送…')} />
          <p role="status" className={styles.status} data-state={state}>{messages[state]}</p>
        </form>
      </div>
    </div>
  </main>
}
