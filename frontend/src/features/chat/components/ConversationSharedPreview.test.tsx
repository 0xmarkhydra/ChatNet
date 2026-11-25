// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConversationSharedPreview from './ConversationSharedPreview'
import { loadSharedContent } from '../lib/sharedContentLoader'

vi.mock('../lib/sharedContentLoader', () => ({ loadSharedContent: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const unmounts: Array<() => void> = []
afterEach(() => {
  while (unmounts.length) unmounts.pop()!()
  vi.resetAllMocks()
})

const attachment = (id: number) => ({
  id, sender: 'user', text: '', createdAt: '2026-11-23T10:00:00Z',
  attachments: [{ id, kind: 'image' as const, url: 'https://example.test/' + id + '.png',
    storageRef: 'media-' + id, name: 'photo-' + id, sizeBytes: 100, contentType: 'image/png' }],
})

function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const request = vi.fn(async () => Response.json([]))
  const onOpen = vi.fn()
  const render = (conversationId = 42, channelId = 0) =>
    act(() => root.render(<ConversationSharedPreview conversationId={conversationId}
      channelId={channelId} request={request} onOpen={onOpen} />))
  unmounts.push(() => { act(() => root.unmount()); host.remove() })
  return { host, render, onOpen }
}

describe('conversation shared preview lifecycle', () => {
  it('does not show media from a previous conversation when switching scope', async () => {
    let resolveOld!: (result: { items: ReturnType<typeof attachment>[] }) => void
    const old = new Promise<{ items: ReturnType<typeof attachment>[] }>(resolve => { resolveOld = resolve })
    vi.mocked(loadSharedContent).mockImplementation(async ({ conversationId }) =>
      conversationId === 42 ? old : { items: [attachment(2)] })
    const page = mount()
    page.render(42)
    page.render(43)
    await act(async () => { await Promise.resolve() })
    expect(page.host.textContent).not.toContain('Đang tải phương tiện')
    expect(page.host.querySelector('img')?.getAttribute('src')).toContain('/2.png')
    await act(async () => { resolveOld({ items: [attachment(1)] }); await old })
    expect(page.host.querySelector('img')?.getAttribute('src')).toContain('/2.png')
  })

  it('retries loading after an error and renders recovered images', async () => {
    vi.mocked(loadSharedContent)
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValue({ items: [attachment(7)] })
    const page = mount()
    page.render()
    await act(async () => { await Promise.resolve() })
    const retry = [...page.host.querySelectorAll('button')].find(el => el.textContent?.includes('Nhấn để thử lại'))
    expect(retry).toBeDefined()
    act(() => retry?.click())
    await act(async () => { await Promise.resolve() })
    expect(page.host.querySelector('img')?.getAttribute('src')).toContain('/7.png')
    expect(vi.mocked(loadSharedContent)).toHaveBeenCalledTimes(2)
  })
})
