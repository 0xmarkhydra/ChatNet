// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Story } from '../types'
import { groupStories } from './storyGroups'
import { markStorySeen, resetStorySeenCache } from './storySeen'

const story = (id: number, author: string, createdAt: string): Story => ({
  id, author, authorDisplayName: author.toUpperCase(), createdAt, expiresAt: '2099-01-01T00:00:00Z', text: 'x', background: 'berry',
})

describe('groupStories', () => {
  const stories = [
    story(1, 'an', '2026-11-24T08:00:00Z'),
    story(2, 'an', '2026-11-24T09:00:00Z'),
    story(3, 'binh', '2026-11-24T10:00:00Z'),
    story(4, 'me', '2026-11-24T07:00:00Z'),
    story(5, 'chi', '2026-11-24T06:00:00Z'),
  ]

  it('groups by author: own first, unseen before seen, newest first', () => {
    const groups = groupStories(stories, new Set([5]), 'me')
    expect(groups.map(group => group.author)).toEqual(['me', 'binh', 'an', 'chi'])
    expect(groups[0].own).toBe(true)
    expect(groups.find(group => group.author === 'chi')?.hasUnseen).toBe(false)
  })

  it('opens the oldest unseen story, or the oldest when everything is seen', () => {
    expect(groupStories(stories, new Set([1]), 'me').find(group => group.author === 'an')?.openId).toBe(2)
    expect(groupStories(stories, new Set([1, 2]), 'me').find(group => group.author === 'an')?.openId).toBe(1)
  })

  it('uses the newest story as the preview and the display name', () => {
    const group = groupStories(stories, new Set(), 'me').find(item => item.author === 'an')
    expect(group?.latest.id).toBe(2)
    expect(group?.displayName).toBe('AN')
  })
})
