'use client'

/**
 * Locale hook for new app surfaces (trip detail, booking, invoice).
 * Marketing pages keep the M2 DOM-dictionary approach; data-driven surfaces
 * render EN/CN directly from bilingual DB content and subscribe to the
 * site-wide language toggle via the okim-language-change event.
 * SSR defaults to EN; hydrates to the stored preference.
 */
import { useEffect, useState } from 'react'

export type Locale = 'en' | 'zh'

/**
 * `initial` pins the starting locale (signed-in app surfaces use the customer's
 * stored locale per MVP-SPEC §11, not the browser preference); without it the
 * hook reads the site-wide browser preference. `onChange` fires on toggle.
 */
export function useLocale(initial?: Locale, onChange?: (locale: Locale) => void): Locale {
  const [locale, setLocale] = useState<Locale>(initial ?? 'en')

  useEffect(() => {
    if (initial === undefined) {
      const read = (): Locale => {
        try {
          return localStorage.getItem('okim-language') === 'zh' ? 'zh' : 'en'
        } catch {
          return document.documentElement.lang === 'zh-CN' ? 'zh' : 'en'
        }
      }
      setLocale(read())
    }
    const handler = (event: Event) => {
      const next = (event as CustomEvent<Locale>).detail === 'zh' ? 'zh' : 'en'
      setLocale(next)
      onChange?.(next)
    }
    window.addEventListener('okim-language-change', handler)
    return () => window.removeEventListener('okim-language-change', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  return locale
}

/** Pick the bilingual value for the active locale. */
export function pick<T>(locale: Locale, en: T, zh: T | null | undefined): T {
  return locale === 'zh' && zh != null ? zh : en
}