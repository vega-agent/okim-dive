// Chrome built-in Translator API helper (owner decision 2026-11-22: Chrome
// native translate button for Messages / Trips / Payment instructions).
// On-device NMT in Chrome/Edge desktop — no API key, no server, text never
// leaves the browser. Other browsers: feature-detected away, manual flow stays.
// MVP-SPEC #36 amends the #32 "no embedded AI" rule for this draft assist only;
// publish/save remains the human approval gate.

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

interface TranslatorInstance {
  translate(text: string): Promise<string>
}

interface TranslatorFactory {
  availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>
  create(opts: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (m: { addEventListener: (type: 'downloadprogress', cb: (e: { loaded: number }) => void) => void }) => void
  }): Promise<TranslatorInstance>
}

declare global {
  interface Window {
    Translator?: TranslatorFactory
  }
}

const instances = new Map<string, Promise<TranslatorInstance>>()

export function translatorSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Translator !== 'undefined'
}

export async function pairAvailability(from: string, to: string): Promise<Availability> {
  if (!translatorSupported()) return 'unavailable'
  try {
    return await window.Translator!.availability({ sourceLanguage: from, targetLanguage: to })
  } catch {
    return 'unavailable'
  }
}

/** Translate one text, reusing a cached translator per language pair. */
export async function translateText(from: string, to: string, text: string, onProgress?: (fraction: number) => void): Promise<string> {
  const key = `${from}-${to}`
  if (!instances.has(key)) {
    const created = window.Translator!.create({
      sourceLanguage: from,
      targetLanguage: to,
      monitor(m) {
        m.addEventListener('downloadprogress', e => onProgress?.(e.loaded))
      },
    })
    instances.set(key, created)
    created.catch(() => instances.delete(key))
  }
  const translator = await instances.get(key)!
  return translator.translate(text)
}