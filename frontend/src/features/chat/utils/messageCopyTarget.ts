import type { MediaAttachment } from '../../../shared/utils/media'
import type { Message } from '../types'
import { copyableMessageLinks, messageLinkHref } from '../lib/messageClipboard'

export type MessageCopyTarget =
  | { kind: 'text' }
  | { kind: 'image'; attachment: MediaAttachment }
  | { kind: 'link'; url: string; temporary?: boolean }
  | { kind: 'file-name'; name: string }
  | { kind: 'unavailable-link'; name: string }

/**
 * Pick the content the user right-clicked/long-pressed. Without an explicit
 * target, copy the text, a standalone URL, or the first image in that order.
 */
export function resolveMessageCopyTarget(message: Message, target: Element | null): MessageCopyTarget | null {
  const inlineLink = target?.closest<HTMLAnchorElement>('a.message-inline-link')
  if (inlineLink?.href) return { kind: 'link', url: inlineLink.href }

  const mediaElement = target?.closest<HTMLElement>('.media-item')
  if (mediaElement) {
    const index = Number(mediaElement.dataset.attachmentIndex)
    const attachment = message.attachments?.[index]
    if (Number.isInteger(index) && attachment) {
      if (attachment.kind === 'image' && attachment.url) return { kind: 'image', attachment }
      if (attachment.url) return { kind: 'link', url: attachment.url, temporary: true }
      return { kind: 'file-name', name: attachment.name }
    }
  }

  const text = message.text.trim()
  if (text) {
    const links = copyableMessageLinks(text)
    if (links.length === 1 && links[0] === text) return { kind: 'link', url: messageLinkHref(links[0]) }
    return { kind: 'text' }
  }
  const first = message.attachments?.[0]
  if (!first) return null
  if (first.kind === 'image' && first.url) return { kind: 'image', attachment: first }
  if (first.url) return { kind: 'link', url: first.url, temporary: true }
  return { kind: 'file-name', name: first.name }
}
