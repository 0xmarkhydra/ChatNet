// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import ProfileNote from './ProfileNote'

afterEach(() => vi.unstubAllGlobals())

const noteResponse = (content: string) => ({
  ok: true,
  json: async () => ({ note: {
    content, visibility: 'public', version: '1',
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  } }),
}) as Response

it('never shows the previous user note after switching username, even if responses arrive late', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const pending = new Map<string, (response: Response) => void>()
  const request = vi.fn((path: string) => new Promise<Response>(resolve => { pending.set(path, resolve) }))
  const host = document.createElement('div')
  const root = createRoot(host)
  const render = (username: string) => act(async () => root.render(<ProfileNote username={username} request={request} />))
  const answer = (username: string, content: string) =>
    act(async () => pending.get(`/api/users/${username}/note`)!(noteResponse(content)))

  try {
    await render('alice')
    await answer('alice', 'Ghi chú của Alice')
    expect(host.textContent).toContain('Ghi chú của Alice')

    await render('bob')
    expect(host.textContent).not.toContain('Ghi chú của Alice')

    await render('carol')
    await answer('bob', 'Ghi chú của Bob')
    expect(host.textContent).not.toContain('Ghi chú của Bob')
    await answer('carol', 'Ghi chú của Carol')
    expect(host.textContent).toContain('Ghi chú của Carol')

    await render('alice')
    expect(host.textContent).not.toContain('Ghi chú của')
  } finally {
    await act(async () => root.unmount())
  }
})
