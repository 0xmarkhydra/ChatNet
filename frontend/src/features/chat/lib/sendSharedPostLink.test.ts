import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendSharedPostLink } from './sendSharedPostLink'
import type { Conversation } from '../types'
import type { ApiRequest } from '../../../shared/types/api'

const { sendEncrypted } = vi.hoisted(() => ({ sendEncrypted: vi.fn() }))
vi.mock('./mlsPilotService', () => ({
  MLSPilotService: class {
    send = sendEncrypted
  },
}))
const conversation: Conversation = {
  id: 8, type: 'direct', otherUserId: 20, name: 'Lan', memberCount: 2,
  unreadCount: 0, lastMessage: '', online: false, createdAt: '',
}
const url = 'https://chat.codelocal.cloud/feed/posts/7?ref=share'

function submit(request: ApiRequest, destination = conversation, isCurrent = () => true) {
  return sendSharedPostLink({ request, destination, url, isCurrent, userId: 5, clientId: 'reuse-client-id' })
}

describe('sharing a post link through chat', () => {
  beforeEach(() => { sendEncrypted.mockReset() })

  it('sends a permalink with no caption, media or extra permissions', async () => {
    const request = vi.fn().mockResolvedValueOnce(Response.json({ mode: 'legacy' })).mockResolvedValueOnce(new Response())
    await submit(request)
    expect(request).toHaveBeenNthCalledWith(1, '/api/conversations/8/e2ee/status', { cache: 'no-store' })
    expect(request).toHaveBeenNthCalledWith(2, '/api/conversations/8/messages', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ text: url, attachments: [], clientId: 'reuse-client-id' }),
    }))
  })

  it('never falls back to plaintext for a ready encrypted conversation', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ mode: 'e2ee' }))
    await submit(request)
    expect(sendEncrypted).toHaveBeenCalledOnce()
    expect(sendEncrypted).toHaveBeenCalledWith(url)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('requires opening chat when the encrypted delivery result is uncertain', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ mode: 'e2ee' }))
    sendEncrypted.mockRejectedValue(new Error('ack lost'))
    await expect(submit(request)).rejects.toMatchObject({ openChat: true })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not send to blocked, pending or unverified conversations', async () => {
    const blocked = vi.fn()
    await expect(submit(blocked, { ...conversation, blockedByOther: true })).rejects.toThrow('Không thể gửi')
    expect(blocked).not.toHaveBeenCalled()
    const pending = vi.fn().mockResolvedValue(Response.json({ mode: 'legacy', autoEnabled: true }))
    await expect(submit(pending)).rejects.toMatchObject({ openChat: true })
    expect(pending).toHaveBeenCalledTimes(1)
    const unknown = vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    await expect(submit(unknown)).rejects.toThrow('chưa được gửi')
    expect(unknown).toHaveBeenCalledTimes(1)
  })

  it('does not send when the signed-in account changes during permission verification', async () => {
    let current = true
    const request = vi.fn().mockImplementation(async () => {
      current = false
      return Response.json({ mode: 'legacy' })
    })
    await expect(submit(request, conversation, () => current)).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('never falls back to plaintext when an encrypted group cannot be sent directly', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ mode: 'e2ee' }))
    const group = { ...conversation, type: 'group' as const, otherUserId: undefined }
    await expect(submit(request, group)).rejects.toMatchObject({ openChat: true })
    expect(request).toHaveBeenCalledTimes(1)
    expect(sendEncrypted).not.toHaveBeenCalled()
  })

  it('does not send after the signed-in session changes before encrypted delivery', async () => {
    let current = true
    const request = vi.fn().mockImplementation(async () => {
      current = false
      return Response.json({ mode: 'e2ee' })
    })
    await expect(submit(request, conversation, () => current)).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(1)
    expect(sendEncrypted).not.toHaveBeenCalled()
  })

})