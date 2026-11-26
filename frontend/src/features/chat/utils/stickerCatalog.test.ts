import { describe, expect, it } from 'vitest'
import { searchStickers, stickers } from './stickerCatalog'

describe('sticker catalog', () => {
  it('finds Vietnamese labels without accents', () => {
    expect(searchStickers('meo').some(item => item.emoji === '🐱')).toBe(true)
    expect(searchStickers('khong-co-123')).toEqual([])
  })
  it('has unique sticker ids and returns all items for an empty search', () => {
    expect(new Set(stickers.map(item => item.id)).size).toBe(stickers.length)
    expect(searchStickers(' ')).toEqual(stickers)
  })
})
