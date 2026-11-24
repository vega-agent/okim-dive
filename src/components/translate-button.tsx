'use client'

// Translate assist (MVP-SPEC #36/#40): a 44px icon button at the END of each
// bilingual field, with an instant styled tooltip (DESIGN-SYSTEM v1.8 pattern).
// Fills this field from the other language via Chrome's on-device Translator
// API; renders nothing when unsupported. Output is a DRAFT — the status line
// says review before saving/publishing; the human save/publish click remains
// the approval gate (#32).
import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/use-locale'
import { pairAvailability, translateText, translatorSupported } from '@/lib/browser-translate'
import '../../styles/translate.css'

export default function TranslateButton({ from, to, getTexts, onResults }: {
  from: 'en' | 'zh'
  to: 'en' | 'zh'
  getTexts: () => string[]
  onResults: (values: string[]) => void
}) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [status, setStatus] = useState<'draft' | 'empty' | 'error' | null>(null)

  useEffect(() => {
    let alive = true
    if (!translatorSupported()) return
    pairAvailability(from, to).then(a => { if (alive) setReady(a !== 'unavailable') })
    return () => { alive = false }
  }, [from, to])

  if (!ready) return null

  const run = async () => {
    const texts = getTexts()
    if (texts.every(s => !s.trim())) { setStatus('empty'); return }
    setBusy(true)
    setStatus(null)
    setProgress(null)
    try {
      const out: string[] = []
      for (const text of texts) {
        out.push(text.trim() ? await translateText(from, to, text, f => setProgress(f)) : '')
      }
      onResults(out)
      setStatus('draft')
    } catch {
      setStatus('error')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const label = from === 'en' ? t('Translate from English', '从英文翻译') : t('Translate from Chinese', '从中文翻译')
  return <>
    <button type="button" className="translate-icon-btn" data-tip={label} aria-label={label} onClick={run} disabled={busy}>
      <img src="/assets/icons/ui-translate.webp" alt="" width={24} height={24} />
    </button>
    <span className="translate-status portal-fineprint" role="status" aria-live="polite">
      {busy && progress !== null && progress < 1 && t(`Downloading language model… ${Math.round(progress * 100)}% (one time)`, `正在下载语言模型… ${Math.round(progress * 100)}%（仅首次）`)}
      {!busy && status === 'draft' && t('Machine draft — review before saving or publishing.', '机器草稿——保存或发布前请检查。')}
      {!busy && status === 'empty' && t('Write the other language first, then translate.', '请先填写另一种语言，再翻译。')}
      {!busy && status === 'error' && t('Translation failed — retry or type manually.', '翻译失败——请重试或手动输入。')}
    </span>
  </>
}