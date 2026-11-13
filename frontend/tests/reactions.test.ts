import { describe, expect, it } from 'vitest'
import { reactionLabel, reactionOptions } from '../src/shared/utils/reactions'
import { messageReactionLabel, messageReactions } from '../src/features/chat/utils/messageReactions'

describe('shared reaction public contract', () => {
  it('keeps the existing Chat-compatible exports and labels', () => {
    expect(messageReactions).toBe(reactionOptions)
    expect(messageReactionLabel).toBe(reactionLabel)
    expect(reactionOptions.map(item => item.emoji)).toEqual(['👍', '❤️', '😂', '😮', '😢', '😡'])
    expect(reactionLabel('❤️')).toBe('Love')
    expect(reactionLabel('👍')).toBe('Like')
    expect(reactionLabel('✨')).toBe('✨')
  })
})
