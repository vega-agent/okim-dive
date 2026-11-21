'use client'

// M6 public policy view — self-localized from versioned DB content (EN+ZH
// published together). Public page: browser language preference applies.
// Body is plain text from the portal editor: blank-line blocks, "- " bullets.
// The seeded demo notice stays visible until Iris publishes final wording.
import { useLocale, pick, type Locale } from '@/lib/use-locale'
import type { ReactNode } from 'react'

type Props = {
  kind: 'refund' | 'privacy' | 'terms'
  version: number
  effectiveAt: string
  bodyEn: string
  bodyZh: string
}

const titles = {
  refund: { en: 'Refund Policy', zh: '退款政策' },
  privacy: { en: 'Privacy Policy', zh: '隐私政策' },
  terms: { en: 'Terms of Booking', zh: '预订条款' },
} as const

// Plain-text body from the portal editor, rendered for reading. The editor
// stores single newlines inside sections and blank lines between them, so a
// block is walked as segments: a short unpunctuated lead line becomes a
// heading; runs of "- " lines become bullets; runs of "1. " lines become a
// numbered list (a lone numbered lead-in followed by prose is a heading).
// The redundant "… — Okim Dive" document title line is dropped (h1 carries it).
const isBullet = (l: string) => /^-\s/.test(l)
const isNumbered = (l: string) => /^\d+\.\s/.test(l)
const headLike = (l: string) => l.length <= 60 && !/[.!?。！？:]$/.test(l)

function Blocks({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map(b => b.split('\n').map(l => l.trim()).filter(Boolean)).filter(b => b.length)
  return <>{blocks.map((lines, bi) => {
    if (lines.length === 1 && /—\s*Okim Dive$/i.test(lines[0])) return null
    const nodes: ReactNode[] = []
    let heading: string | null = null
    let i = 0
    if (!isBullet(lines[0]) && !isNumbered(lines[0]) && headLike(lines[0])) { heading = lines[0]; i = 1 }
    while (i < lines.length) {
      if (isBullet(lines[i])) {
        const run: string[] = []
        while (i < lines.length && isBullet(lines[i])) run.push(lines[i++].replace(/^-\s+/, ''))
        nodes.push(<ul key={nodes.length}>{run.map((l, j) => <li key={j}>{l}</li>)}</ul>)
      } else if (isNumbered(lines[i])) {
        const run: string[] = []
        while (i < lines.length && isNumbered(lines[i])) run.push(lines[i++].replace(/^\d+\.\s+/, ''))
        const loneLead = run.length === 1 && i < lines.length && !isBullet(lines[i]) && run[0].length <= 70 && !/[.!?。！？]$/.test(run[0])
        if (loneLead && !heading) { heading = run[0]; continue }
        nodes.push(<ol key={nodes.length}>{run.map((l, j) => <li key={j}>{l}</li>)}</ol>)
      } else {
        const run: string[] = []
        while (i < lines.length && !isBullet(lines[i]) && !isNumbered(lines[i])) run.push(lines[i++])
        nodes.push(<p key={nodes.length}>{run.map((l, j) => <span key={j}>{l}{j < run.length - 1 && <br />}</span>)}</p>)
      }
    }
    if (heading) return <section key={bi} className="policy-section"><h2>{heading}</h2>{nodes}</section>
    return <div key={bi}>{nodes}</div>
  })}</>
}

export default function PolicyView({ kind, version, effectiveAt, bodyEn, bodyZh }: Props) {
  const locale: Locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const body = pick(locale, bodyEn, bodyZh)
  const firstBlock = body.split(/\n{2,}/)[0] ?? ''
  const isDemoNotice = /demo wording|演示措辞/i.test(firstBlock)
  const date = new Date(effectiveAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const others = (Object.keys(titles) as (keyof typeof titles)[]).filter(k => k !== kind)

  return <article className="policy-doc" data-locale-managed>
    <h1>{t(titles[kind].en, titles[kind].zh)}</h1>
    <p className="policy-meta">{t(`Version ${version} · effective`, `版本 ${version} · 生效日期`)} {date}</p>
    {isDemoNotice && <p className="policy-notice" role="note">{firstBlock}</p>}
    <div className="policy-body">
      <Blocks text={isDemoNotice ? body.slice(firstBlock.length).replace(/^\n+/, '') : body} />
    </div>
    <nav className="policy-links" aria-label={t('Related policies', '相关政策')}>
      {others.map(k => <a key={k} href={`/${k === 'refund' ? 'refund-policy' : k}`}>{t(titles[k].en, titles[k].zh)}</a>)}
      <a href="/contact">{t('Questions? Contact Iris', '有疑问？联系 Iris')}</a>
    </nav>
  </article>
}