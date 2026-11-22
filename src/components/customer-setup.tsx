'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setCustomerName } from '@/lib/booking-actions'
import { useLocale } from '@/lib/use-locale'

/**
 * Customer setup (owner decision 2026-11-21): one unique diver name, captured
 * once after the first magic-link sign-in, before the booking wizard. Names
 * are case-insensitively unique so Iris never sees ambiguous customers.
 */
export default function CustomerSetup() {
  const l = useLocale()
  const t = (en: string, zh: string) => l === 'zh' ? zh : en
  const [error, setError] = useState<'taken' | 'invalid' | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    setError(null)
    startTransition(async () => {
      const result = await setCustomerName(data)
      if (result.status === 'saved') router.refresh()
      else setError(result.status === 'taken' ? 'taken' : 'invalid')
    })
  }

  return <div className="booking-shell customer-setup" data-locale-managed>
    <div className="booking-card">
      <h2 className="booking-title">{t('Welcome to Okim Dive', '欢迎来到 Okim Dive')}</h2>
      <p className="booking-intro">{t('One quick setup step: choose the name Iris will know you by. It is unique to you — if another diver already uses it, add a surname or initial.', '只需一步设置：请选择 Iris 认识你的称呼。此名称为你独有——若已有其他潜水员使用，请加上姓氏或首字母。')}</p>
      <form onSubmit={submit} className="booking-form">
        <div className="form-group">
          <label htmlFor="setup-name">{t('Your name', '你的称呼')} *</label>
          <input id="setup-name" name="name" required minLength={2} maxLength={200} autoComplete="name"
            placeholder={t('e.g. Jeff Lee — the name Iris will see', '例如：Jeff Lee —— Iris 将看到的称呼')} />
          {error && <p className="form-status form-status-error" role="alert">{error === 'taken'
            ? t('That name is already used by another diver — add a surname or initial.', '该称呼已被其他潜水员使用——请加上姓氏或首字母。')
            : t('Please enter your name (at least 2 characters).', '请输入你的称呼（至少 2 个字符）。')}</p>}
        </div>
        <button className="btn btn-primary" disabled={pending}>{pending ? t('Saving…', '保存中…') : t('Save and continue', '保存并继续')}</button>
      </form>
    </div>
  </div>
}