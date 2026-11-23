import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import PostComposer from './PostComposer'
import { createPostComposerPresenter } from './createPostComposerPresenter'

type Composer = ComponentProps<typeof PostComposer>

function setup(overrides: Partial<Parameters<typeof createPostComposerPresenter>[0]> = {}) {
  const cancelUpload = vi.fn()
  const props = { name: 'original-name' } as Composer
  const element = createPostComposerPresenter({
    props,
    friends: [
      { id: 1, displayName: 'Accepted', username: 'accepted', status: 'accepted' },
      { id: 2, displayName: 'Blocked', username: 'blocked', status: 'accepted', blockedByMe: true },
      { id: 3, displayName: 'Request', username: 'request', status: 'outgoing' },
      { id: 4, displayName: 'Restricted', username: 'restricted', status: 'accepted', blockedByOther: true },
    ],
    profileDisplayName: 'Profile name',
    sessionDisplayName: 'Session name',
    profileComposerOpen: false,
    feedComposerOpen: true,
    cancelUpload,
    ...overrides,
  })
  return { element, cancelUpload }
}

describe('post composer presenter', () => {
  it('keeps the PostComposer component and restricts tagging to eligible friends', () => {
    const { element, cancelUpload } = setup()
    expect(element.type).toBe(PostComposer)
    expect(element.props.taggableFriends.map((friend: { username: string }) => friend.username)).toEqual(['accepted'])
    expect(element.props.popup).toBe(true)
    expect(element.props.displayName).toBe('Profile name')
    element.props.cancelUpload?.()
    expect(cancelUpload).toHaveBeenCalledOnce()
  })

  it('resolves display name and popup consistently when profile identity is absent', () => {
    const { element } = setup({
      profileDisplayName: undefined,
      sessionDisplayName: undefined,
      profileComposerOpen: false,
      feedComposerOpen: false,
    })
    expect(element.props.displayName).toBe('original-name')
    expect(element.props.popup).toBe(false)
  })
})