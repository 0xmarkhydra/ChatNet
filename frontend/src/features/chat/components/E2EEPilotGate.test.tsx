// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest } from '../../../shared/types/api'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { ConversationEncryptionMode } from '../types'
import E2EEPilotGate from './E2EEPilotGate'

vi.mock('./E2EEPilotPanel', () => ({
  default: ({ request }: { request: ApiRequest }) => (
    <button onClick={() => { void request('/api/panel-refresh') }}>Refresh pilot</button>
  ),
}))

function Harness({ scope, request }: { scope: string; request: ApiRequest }) {
  const [mode, setMode] = useScopedState<ConversationEncryptionMode | 'unknown'>(scope, 'unknown')
  const conversationId = Number(scope.split(':').at(-1))
  return <>
    <output>{mode}</output>
    <E2EEPilotGate key={scope} conversationId={conversationId} userId={10} otherUserId={11} request={request} onModeChange={setMode} />
  </>
}

describe('direct chat encryption warning stability', () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const mode = () => host.querySelector('output')?.textContent
  const render = async (scope: string, request: ApiRequest) => {
    await act(async () => root.render(<StrictMode><Harness scope={scope} request={request} /></StrictMode>))
  }
  const runStartup = async () => {
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    host = document.createElement('div')
    root = createRoot(host)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps the banner mode on API helper changes and gives the open pilot the latest helper', async () => {
    const first = vi.fn<ApiRequest>().mockResolvedValue(Response.json({ mode: 'legacy', pilotEnabled: true }))
    await render('session:7', first)
    await runStartup()
    expect(mode()).toBe('legacy')
    const next = vi.fn<ApiRequest>().mockResolvedValue(Response.json({}))
    await render('session:7', next)
    expect(mode()).toBe('legacy')
    await runStartup()
    expect(first).toHaveBeenCalledTimes(1)
    expect(next).not.toHaveBeenCalled()
    const refresh = host.querySelector('button')
    expect(refresh).not.toBeNull()
    await act(async () => refresh?.click())
    expect(next).toHaveBeenCalledWith('/api/panel-refresh', undefined)
  })

  it('clears on scope changes and ignores results from an earlier visit to the same chat', async () => {
    const first = vi.fn<ApiRequest>().mockResolvedValue(Response.json({ mode: 'legacy' }))
    await render('session:7', first)
    await runStartup()
    expect(mode()).toBe('legacy')

    let respond!: (response: Response) => void
    const prompt = vi.fn<ApiRequest>().mockImplementation(() => new Promise(resolve => { respond = resolve }))
    await render('session:8', prompt)
    expect(mode()).toBe('unknown')
    await runStartup()
    const confirmed = vi.fn<ApiRequest>().mockResolvedValue(Response.json({ mode: 'e2ee' }))
    await render('session:7', confirmed)
    expect(mode()).toBe('unknown')
    await runStartup()
    expect(mode()).toBe('e2ee')
    await act(async () => respond(Response.json({ mode: 'legacy' })))
    expect(mode()).toBe('e2ee')

    await render('other-session:7', vi.fn<ApiRequest>().mockResolvedValue(Response.json({ mode: 'legacy', autoEnabled: true })))
    expect(mode()).toBe('unknown')
    await runStartup()
    expect(mode()).toBe('pending')
  })
})
