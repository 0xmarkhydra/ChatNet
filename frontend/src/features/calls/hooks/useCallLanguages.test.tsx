// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CallRequest } from '../lib/calls'
import { useCallLanguages } from './useCallLanguages'

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const oldActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('localStorage', { getItem: () => null })
})

afterEach(() => {
  vi.unstubAllGlobals()
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = oldActEnvironment
})

function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const pending: Array<(value: Response) => void> = []
  const request = vi.fn((_path: string) => new Promise<Response>((resolve) => pending.push(resolve))) as unknown as CallRequest
  let current: ReturnType<typeof useCallLanguages> | null = null

  function Probe({ targetLanguage }: { targetLanguage: string }) {
    current = useCallLanguages(request, 'en', targetLanguage)
    return null
  }

  async function render(targetLanguage: string) {
    await act(async () => root.render(<Probe targetLanguage={targetLanguage} />))
  }
  async function resolve(languages: string[]) {
    await act(async () => {
      pending.shift()?.(new Response(JSON.stringify({ languages }), { status: 200 }))
      await Promise.resolve()
      await Promise.resolve()
    })
  }
  async function close() {
    await act(async () => root.unmount())
    host.remove()
  }
  return { render, resolve, close, get current() { return current }, get pending() { return pending } }
}

describe('call language async selection', () => {
  it('uses the latest target language when the language catalog resolves late', async () => {
    const probe = setup()
    try {
      await probe.render('fr')
      expect(probe.pending).toHaveLength(1)
      await probe.render('de')
      expect(probe.pending).toHaveLength(1)
      await probe.resolve(['de', 'en'])
      expect(probe.current?.callTargetLanguage).toBe('de')
    } finally {
      await probe.close()
    }
  })

  it('preserves a new manual choice made while the catalog is pending', async () => {
    const probe = setup()
    try {
      await probe.render('fr')
      await act(async () => probe.current?.setCallTargetLanguage('ja'))
      await probe.resolve(['ja', 'en'])
      expect(probe.current?.callTargetLanguage).toBe('ja')
    } finally {
      await probe.close()
    }
  })

  it('discards a catalog response after unmount', async () => {
    const probe = setup()
    await probe.render('fr')
    await probe.close()
    await probe.resolve(['en'])
    expect(probe.pending).toHaveLength(0)
  })
})
