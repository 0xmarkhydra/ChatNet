// @vitest-environment jsdom
import { act, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { Session } from '../../../shared/types/session'
import { useProfileIdentityActions } from './useProfileIdentityActions'

describe('useProfileIdentityActions', () => {
  it('loads and saves profile identity without changing the API contract or session isolation', async () => {
    const previous = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const session = {
      sessionId: 'A', token: 'before', user: { id: 7, username: 'before', displayName: 'Before' },
    } as Session
    const sessionRef = { current: session }
    const saved = vi.fn()
    const notice = vi.fn()
    const mediaSetter = vi.fn()
    const editorSetter = vi.fn()
    const calls: Array<{ path: string; init?: RequestInit }> = []
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init })
      if (init?.method === 'PUT') return Response.json({
        token: 'after', username: 'after', displayName: 'After',
        bio: 'Bio', city: 'Hanoi', workplace: 'Office', school: 'School',
        updatedAt: 44, avatarSet: true, coverSet: false,
      })
      return Response.json({
        username: 'before', displayName: 'Before', bio: 'Bio', city: 'Hanoi',
        workplace: 'Office', school: 'School', updatedAt: 43, avatarSet: true, coverSet: false,
      })
    })
    const opts = {
      session, sessionRef, apiFetch: request, saveSession: saved, setNotice: notice,
      uploadMediaFiles: vi.fn(),
      isProfileDesktop: true, profileSaving: false, profileBusy: null,
      profileDisplayNameDraft: 'After', profileUsernameDraft: 'after',
      profileBioDraft: 'Bio', profileCityDraft: 'Hanoi',
      profilePublicDetailsDraft: { workplace: 'Office', school: 'School' },
      setProfileMedia: mediaSetter,
      setProfileDisplayNameDraft: vi.fn(), setProfileUsernameDraft: vi.fn(),
      setProfileBioDraft: vi.fn(), setProfileCityDraft: vi.fn(),
      setProfilePublicDetailsDraft: vi.fn(), setProfileSaving: vi.fn(),
      setProfileBusy: vi.fn(), setProfileEditorOpen: editorSetter,
    } as unknown as Parameters<typeof useProfileIdentityActions>[0]
    let actions!: ReturnType<typeof useProfileIdentityActions>
    function Probe() {
      actions = useProfileIdentityActions(opts)
      return null
    }
    try {
      await act(async () => root.render(<Probe />))
      await act(async () => actions.loadProfileMedia())
      expect(calls[0].path).toBe('/api/profile')
      expect(mediaSetter).toHaveBeenCalledWith(expect.objectContaining({ username: 'before' }))
      await act(async () => actions.saveProfileIdentity({ preventDefault: vi.fn() } as unknown as FormEvent))
      expect(calls[1].path).toBe('/api/profile')
      expect(calls[1].init?.method).toBe('PUT')
      expect(JSON.parse(calls[1].init?.body as string)).toEqual({
        displayName: 'After', username: 'after', bio: 'Bio', city: 'Hanoi',
        workplace: 'Office', school: 'School',
      })
      expect(saved).toHaveBeenCalledWith(expect.objectContaining({
        token: 'after', user: expect.objectContaining({ username: 'after' }),
      }))
      expect(editorSetter).toHaveBeenCalledWith(false)
      expect(notice).toHaveBeenCalledWith('Đã lưu thông tin hồ sơ.', 'success')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previous
    }
  })
})
