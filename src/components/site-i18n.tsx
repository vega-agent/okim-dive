'use client'

// M2 port of scripts/site/site-i18n.js runtime logic.
// Same DOM text-node translation approach and dictionary keys as the static site,
// so rendered EN/中文 output stays identical. Re-applies on client-side navigation.
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import translations from '@/lib/translations'

const original = new WeakMap<Text, string>()
const originalAttr = new WeakMap<Element, Record<string, string>>()
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()

// Attributes carrying user-visible text. The lang/nav toggles and journey track
// set their aria-labels explicitly in applyLanguage, so they are skipped here.
const TRANSLATABLE_ATTRS = ['placeholder', 'aria-label']
const ATTR_SKIP_SELECTOR = '[data-lang-toggle], .nav-toggle, .journey-track'

function translateAttrs(el: Element, language: string) {
  if (el.matches(ATTR_SKIP_SELECTOR)) return
  const attrs: [string, string][] = []
  for (const name of TRANSLATABLE_ATTRS) {
    const value = el.getAttribute(name)
    if (value) attrs.push([name, value])
  }
  if (el.tagName === 'OPTGROUP') {
    const label = el.getAttribute('label')
    if (label) attrs.push(['label', label])
  }
  if (!attrs.length) return
  let saved = originalAttr.get(el)
  if (!saved) {
    saved = {}
    originalAttr.set(el, saved)
  }
  for (const [name, value] of attrs) {
    if (!(name in saved)) saved[name] = value
    const source = saved[name]
    const key = normalize(source)
    el.setAttribute(name, language === 'zh' ? (translations[key] || source) : source)
  }
}

function translateNode(node: Node, language: string) {
  if (node.nodeType !== Node.TEXT_NODE) return
  const text = node as Text
  if (!original.has(text)) original.set(text, text.nodeValue ?? '')
  const source = original.get(text) as string
  const value = normalize(source)
  if (!value) return
  text.nodeValue = language === 'zh' ? (translations[value] || source) : source
}

function translateSubtree(root: Node, language: string) {
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element
    translateAttrs(el, language)
    el.querySelectorAll('[placeholder], [aria-label], optgroup').forEach((child) => translateAttrs(child, language))
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) translateNode(node, language)
}

export default function SiteI18n() {
  const pathname = usePathname()
  const languageRef = useRef('en')
  const mountedRef = useRef(false)

  useEffect(() => {
    function applyLanguage(language: string) {
      languageRef.current = language
      document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
      document.title = language === 'zh'
        ? (translations[document.title] || document.title)
        : (document.body.dataset.enTitle || document.title)
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) translateNode(node, language)
      document.body.querySelectorAll('[placeholder], [aria-label], optgroup').forEach((el) => translateAttrs(el, language))
      document.querySelectorAll('[data-lang-toggle]').forEach((button) => {
        button.textContent = language === 'zh' ? 'English' : '中文'
        button.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到简体中文')
        button.setAttribute('aria-pressed', String(language === 'zh'))
      })
      document.querySelectorAll('.nav-toggle').forEach((button) => {
        button.setAttribute('aria-label', language === 'zh' ? '切换导航菜单' : 'Toggle navigation')
      })
      document.querySelectorAll('.journey-track').forEach((track) => {
        track.setAttribute('aria-label', language === 'zh' ? '潜水课程进阶路径' : 'Diving course progression')
      })
      localStorage.setItem('okim-language', language)
    }

    // New page after client-side navigation: record its English title, then re-apply.
    // Deferred a tick on navigation so Next's metadata effect has set the new title first.
    const reapply = () => {
      document.body.dataset.enTitle = document.title
      applyLanguage(mountedRef.current ? languageRef.current : (localStorage.getItem('okim-language') || 'en'))
      mountedRef.current = true
    }
    const timer = mountedRef.current ? window.setTimeout(reapply, 0) : (reapply(), 0)

    const observer = new MutationObserver((mutations) => {
      if (languageRef.current !== 'zh') return
      mutations.forEach(({ addedNodes }) => addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) translateNode(node, languageRef.current)
        else if (node.nodeType === Node.ELEMENT_NODE) translateSubtree(node, languageRef.current)
      }))
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest('[data-lang-toggle]')) {
        applyLanguage(document.documentElement.lang === 'zh-CN' ? 'en' : 'zh')
      }
    }
    document.addEventListener('click', onClick)

    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      document.removeEventListener('click', onClick)
    }
  }, [pathname])

  return null
}