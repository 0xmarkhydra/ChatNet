import { describe, expect, it } from 'vitest'
import { conversationPreview, replyPreview, stickerPreviewUrl } from './conversationPreview'

describe('conversationPreview', () => {
  it('replaces a standalone GIPHY media URL with a sticker summary', () => {
    expect(conversationPreview('https://media3.giphy.com/media/abc/giphy.gif?cid=123')).toBe('Đã gửi một sticker')
  })
  it('preserves normal messages, unrelated URLs and empty previews', () => {
    for (const text of ['', 'Xin chào', 'https://example.com/giphy.gif', 'https://media3.giphy.com.example.com/giphy.gif', 'Xem https://media3.giphy.com/media/abc/giphy.gif']) {
      expect(conversationPreview(text)).toBe(text)
    }
  })
})
describe('replyPreview', () => {
  const sticker = 'https://media4.giphy.com/media/abc/giphy.gif?cid=123'
  it('uses a sticker label and thumbnail URL for GIPHY media', () => {
    expect(replyPreview(sticker)).toBe('[Sticker]')
    expect(stickerPreviewUrl(sticker)).toBe(sticker)
  })
  it('preserves ordinary replies and does not use external links as thumbnails', () => {
    for (const text of ['', 'Xin chào', 'https://example.com/giphy.gif', 'Xem ' + sticker]) {
      expect(replyPreview(text)).toBe(text)
      expect(stickerPreviewUrl(text)).toBe('')
    }
  })
})
