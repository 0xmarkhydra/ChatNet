import { describe, expect, it } from 'vitest'
import { chatEmojiGroups, searchChatEmojis } from './chatEmojiCatalog'

describe('chat emoji catalog', () => {
  it('has distinct emojis and includes the existing quick reactions', () => {
    const all = chatEmojiGroups.flatMap(group => group.emojis.map(item => item.emoji))
    expect(all.length).toBeGreaterThan(100)
    expect(new Set(all).size).toBe(all.length)
    for (const reaction of ['👍', '❤️', '😂', '😮', '😢', '😡']) {
      expect(all).toContain(reaction)
    }
  })

  it('filters by category when the search is empty', () => {
    const gestures = searchChatEmojis('', 'gestures')
    expect(gestures.some(item => item.emoji === '👍')).toBe(true)
    expect(gestures.some(item => item.emoji === '🐱')).toBe(false)
  })

  it('finds Vietnamese labels without diacritics across categories', () => {
    expect(searchChatEmojis('meo').map(item => item.emoji)).toContain('🐱')
    expect(searchChatEmojis('ky lan').map(item => item.emoji)).toContain('🦄')
    expect(searchChatEmojis('tim').map(item => item.emoji)).toContain('❤️')
    expect(searchChatEmojis('khong ton tai')).toEqual([])
  })
})
