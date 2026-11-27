import type { ApiRequest } from '../../../shared/types/api'
import { defaultBundle, UI_BUNDLE_MESSAGES, UI_BUNDLE_VERSION, type UIBundle, type UIBundleKey } from '../lib/i18n'

const BATCH_SIZE = 100

function placeholders(text: string) {
  return (text.match(/\{\w+\}/g) || []).sort().join(',')
}

// Only static catalog strings are sent. User messages, names and other content are never included.
export async function fetchUiBundle(request: ApiRequest, locale: string, signal?: AbortSignal): Promise<UIBundle> {
  const entries = Object.entries(UI_BUNDLE_MESSAGES) as [UIBundleKey, string][]
  const batches = []
  for (let offset = 0; offset < entries.length; offset += BATCH_SIZE) batches.push(entries.slice(offset, offset + BATCH_SIZE))
  const bundle = defaultBundle()
  for (let offset = 0; offset < batches.length; offset += 2) {
    signal?.throwIfAborted()
    const results = await Promise.all(batches.slice(offset, offset + 2).map(async entries => {
      const messages = Object.fromEntries(entries)
      const response = await request('/api/i18n/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ locale, version: UI_BUNDLE_VERSION, messages }),
      })
      if (!response.ok) throw new Error('cannot load UI locale')
      const result = await response.json() as { locale?: string; messages?: Record<string, unknown> }
      if (result.locale !== locale || !result.messages) throw new Error('invalid UI bundle')
      return entries.map(([key, source]) => {
        const value = result.messages?.[key]
        if (typeof value !== 'string' || !value.trim() || placeholders(value) !== placeholders(source)) throw new Error('incomplete UI bundle')
        return [key, value] as const
      })
    }))
    for (const result of results) for (const [key, value] of result) bundle[key] = value
  }
  signal?.throwIfAborted()
  return bundle
}
