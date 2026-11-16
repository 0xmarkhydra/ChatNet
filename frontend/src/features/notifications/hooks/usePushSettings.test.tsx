// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../../shared/types/session'
import { usePushSettings, type UsePushSettingsDeps } from './usePushSettings'

const { sendTest, enable, sync } = vi.hoisted(() => ({
  sendTest: vi.fn(),
  enable: vi.fn(),
  sync: vi.fn(),
}))

vi.mock('../api/push', () => ({
  requestPushTest: (...args: unknown[]) => sendTest(...args),
  syncPushSubscription: (...args: unknown[]) => sync(...args),
}))
vi.mock('../lib/onesignal', () => ({
  enableOneSignalPush: (...args: unknown[]) => enable(...args),
  disableOneSignalPush: vi.fn(),
  setupOneSignal: vi.fn(),
  isPushDisabled: () => false,
}))
vi.mock('../lib/incomingSound', () => ({
  persistMessageSoundEnabled: vi.fn(),
}))

const user = (id: string): Session => ({
  token: 'test-' + id, sessionId: id,
  user: { id: id === 'A' ? 1 : 2, email: id + '@test.invalid', username: id, displayName: id },
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

function setup() {
  const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const setters = {
    setNotice: vi.fn(), setPushBusy: vi.fn(), setPushEnabled: vi.fn(),
    setPushPrompt: vi.fn(), setPushInitFailed: vi.fn(),
  }
  let actions: ReturnType<typeof usePushSettings>
  function Probe({ session }: { session: Session }) {
    actions = usePushSettings({
      apiFetch: vi.fn(), installPrompt: null, isStandalone: false,
      messageSound: { current: null }, messageSoundEnabledRef: { current: true },
      pushAppId: 'test-app', pushBusy: false, pushConfigured: true,
      pushEnabled: false, pushInitFailed: false, session,
      setInstallPrompt: vi.fn(), setMessageSoundEnabled: vi.fn(),
      ...setters,
    } as UsePushSettingsDeps)
    return null
  }

  return {
    setters,
    get actions() { return actions! },
    async render(session: Session) { await act(async () => root.render(<Probe session={session} />)) },
    async close() {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    },
  }
}

afterEach(() => { vi.clearAllMocks() })

describe('push notification async session isolation', () => {
  it('does not show a test-push result from the first A visit after A → B → A', async () => {
    const probe = setup()
    const pending = deferred<Response>()
    sendTest.mockReturnValueOnce(pending.promise)
    try {
      await probe.render(user('A'))
      let outcome: Promise<boolean> | undefined
      await act(async () => { outcome = probe.actions.sendTestPush(false, true) })
      await probe.render(user('B'))
      await probe.render(user('A'))
      await act(async () => pending.resolve(new Response(JSON.stringify({ recipients: 2 }), { status: 200 })))
      expect(await outcome).toBe(false)
      expect(probe.setters.setNotice).not.toHaveBeenCalled()
    } finally {
      await probe.close()
    }
  })

  it('does not apply an old OneSignal opt-in response to the new account UI', async () => {
    const probe = setup()
    const pending = deferred<{ optedIn: boolean; supported: boolean; permission: 'granted'; subscriptionId: string }>()
    enable.mockReturnValueOnce(pending.promise)
    try {
      await probe.render(user('A'))
      let operation: Promise<void> | undefined
      await act(async () => { operation = probe.actions.togglePush() })
      expect(probe.setters.setPushBusy).toHaveBeenCalledWith(true)
      await probe.render(user('B'))
      probe.setters.setPushBusy.mockClear()
      await act(async () => pending.resolve({
        optedIn: true, supported: true, permission: 'granted', subscriptionId: 'device-1',
      }))
      await operation
      expect(probe.setters.setPushEnabled).not.toHaveBeenCalled()
      expect(probe.setters.setNotice).not.toHaveBeenCalled()
      expect(probe.setters.setPushBusy).not.toHaveBeenCalled()
      expect(sync).not.toHaveBeenCalled()
    } finally {
      await probe.close()
    }
  })
  it('does not update the UI after unmount while a push request is pending', async () => {
    const probe = setup()
    const pending = deferred<Response>()
    sendTest.mockReturnValueOnce(pending.promise)
    let closed = false
    try {
      await probe.render(user('A'))
      let outcome: Promise<boolean> | undefined
      await act(async () => { outcome = probe.actions.sendTestPush(false, true) })
      await probe.close()
      closed = true
      await act(async () => pending.resolve(new Response(JSON.stringify({ recipients: 1 }), { status: 200 })))
      expect(await outcome).toBe(false)
      expect(probe.setters.setNotice).not.toHaveBeenCalled()
    } finally {
      if (!closed) await probe.close()
    }
  })

  it('still enables push and synchronizes the subscription in the active session', async () => {
    const probe = setup()
    enable.mockResolvedValueOnce({
      optedIn: true, supported: true, permission: 'granted', subscriptionId: 'device-1',
    })
    sync.mockResolvedValueOnce(new Response(null, { status: 204 }))
    try {
      await probe.render(user('A'))
      await act(async () => { await probe.actions.togglePush() })
      expect(probe.setters.setPushEnabled).toHaveBeenCalledWith(true)
      expect(probe.setters.setPushBusy.mock.calls.map(([busy]) => busy)).toEqual([true, false])
      expect(probe.setters.setNotice).toHaveBeenCalledWith('Đã bật thông báo SocCO.')
      expect(sync).toHaveBeenCalledOnce()
    } finally {
      await probe.close()
    }
  })

})
