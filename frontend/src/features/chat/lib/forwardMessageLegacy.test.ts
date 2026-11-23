// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { forwardMessageLegacy } from './forwardMessageLegacy'
import type { Conversation, Message } from '../types'
import type { MediaAttachment } from '../../../shared/utils/media'
import { API } from '../../../shared/lib/config'

const destination = {
  id: 41, name: 'Nhóm Đích', type: 'group', memberCount: 5,
  unreadCount: 0, lastMessage: '', online: false, createdAt: '',
} as Conversation
const message = {
  id: 7, conversationId: 3, senderId: 5, sender: 'User', createdAt: '',
  text: 'Thông báo', attachments: [], deleted: false,
} as Message
const clientId = 'stable-forward-id'
const uploadFiles = vi.fn(async (): Promise<MediaAttachment[]> => [])
function send(request: (path: string, init?: RequestInit) => Promise<Response>,
  overrides: { destination?: Conversation; message?: Message; isCurrent?: () => boolean } = {}) {
  return forwardMessageLegacy({
    destination: overrides.destination ?? destination,
    message: overrides.message ?? message, clientId, request, uploadFiles,
    isCurrent: overrides.isCurrent ?? (() => true),
  })
}

describe('forwardMessageLegacy security and idempotency', () => {
  beforeEach(() => uploadFiles.mockReset().mockResolvedValue([]))

  it('preserves legacy forwarded payload and supplied clientId', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ mode: 'legacy' }))
      .mockResolvedValueOnce(Response.json({ id: 1 }))
    await send(request)
    expect(request).toHaveBeenNthCalledWith(1, '/api/conversations/41/e2ee/status', { cache: 'no-store' })
    expect(request).toHaveBeenNthCalledWith(2, '/api/conversations/41/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, text: 'Thông báo', forwarded: true, attachments: [] }),
    })
  })

  it('never uploads or sends plaintext into E2EE or pending conversations', async () => {
    for (const status of [{ mode: 'e2ee' }, { mode: 'legacy', autoEnabled: true }]) {
      const request = vi.fn(async () => Response.json(status))
      await expect(send(request)).rejects.toThrow('mã hóa')
      expect(request).toHaveBeenCalledTimes(1)
      expect(uploadFiles).not.toHaveBeenCalled()
    }
  })

  it('fails closed when encryption mode is unknown or cannot be verified', async () => {
    const request = vi.fn(async () => new Response(null, { status: 502 }))
    await expect(send(request)).rejects.toThrow('Không xác minh')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not upload or send when session changes after encryption verification', async () => {
    let current = true
    const request = vi.fn(async () => {
      current = false
      return Response.json({ mode: 'legacy' })
    })
    await expect(send(request, { isCurrent: () => current })).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(1)
    expect(uploadFiles).not.toHaveBeenCalled()
  })

  it('never sends if session changes while uploading attachments', async () => {
    let current = true
    const request = vi.fn(async () => Response.json({ mode: 'legacy' }))
    const attachment = { id: 2, url: new URL('/api/media/example', API).toString(), name: 'a.png', contentType: 'image/png' }
    const withFile = { ...message, attachments: [attachment] } as Message
    request.mockResolvedValueOnce(Response.json({ mode: 'legacy' }))
      .mockResolvedValueOnce(new Response(new Blob(['a'], { type: 'image/png' })))
    uploadFiles.mockImplementationOnce(async () => {
      current = false
      return []
    })
    await expect(send(request, { message: withFile, isCurrent: () => current })).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not touch the network for deleted messages or blocked destinations', async () => {
    const request = vi.fn()
    await expect(send(request, { message: { ...message, deleted: true } })).rejects.toThrow()
    await expect(send(request, { destination: { ...destination, blockedByOther: true } })).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
})
