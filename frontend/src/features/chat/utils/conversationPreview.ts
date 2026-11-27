import { isGiphyMedia } from '../api/giphy'

export function stickerPreviewUrl(text: string): string {
  const value = text.trim()
  return !/\s/.test(value) && isGiphyMedia(value) ? value : ''
}

/** Conversation summaries contain plain text, not the original message type. */
export function conversationPreview(text: string): string {
  return stickerPreviewUrl(text) ? 'Đã gửi một sticker' : text
}

export function replyPreview(text: string): string {
  return stickerPreviewUrl(text) ? '[Sticker]' : text
}
