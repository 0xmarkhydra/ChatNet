import { describe, expect, it } from 'vitest'
import { fetchUiBundle } from './uiBundle'
import { UI_BUNDLE_MESSAGES } from '../lib/i18n'

describe('UI bundle transport', () => {
  it('batches the static catalog within backend limits', async () => {
    const seen: Record<string, string> = {}
    let calls = 0
    const result = await fetchUiBundle(async (_path, init) => {
      calls++
      const body = JSON.parse(String(init?.body))
      expect(body.locale).toBe('ja')
      expect(Object.keys(body.messages).length).toBeLessThanOrEqual(100)
      Object.assign(seen, body.messages)
      return Response.json({ locale: body.locale, messages: body.messages })
    }, 'ja')
    expect(calls).toBeGreaterThan(1)
    expect(seen).toEqual(UI_BUNDLE_MESSAGES)
    expect(result).toEqual(UI_BUNDLE_MESSAGES)
  })

  it('rejects invalid locale, missing placeholders and failed requests', async () => {
    await expect(fetchUiBundle(async () => Response.json({ locale: 'en', messages: {} }), 'ja')).rejects.toThrow()
    await expect(fetchUiBundle(async (_path, init) => {
      const body = JSON.parse(String(init?.body))
      return Response.json({ locale: 'ja', messages: { ...body.messages, 'nav.chatUnread': 'invalid' } })
    }, 'ja')).rejects.toThrow('incomplete UI bundle')
    await expect(fetchUiBundle(async () => new Response(null, { status: 503 }), 'ja')).rejects.toThrow()
  })

  it('does not request a new bundle when already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    let calls = 0
    await expect(fetchUiBundle(async () => { calls++; return new Response() }, 'ja', controller.signal)).rejects.toThrow()
    expect(calls).toBe(0)
  })
})
