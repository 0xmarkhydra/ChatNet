import { POST_FEELINGS, feelingPostLine } from './feelings'

export type PostExtras = {
  caption: string
  location: string
  taggedUsernames: string[]
  feelingId: string
}

/**
 * Compatibility with posts already stored on the cloud API: extras are serialized
 * as readable lines at the beginning of content. This parser keeps them separate
 * from the caption so the UI can render actual profile/location actions.
 */
export function parsePostExtras(content: string): PostExtras {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const parsed: PostExtras = { caption: '', location: '', taggedUsernames: [], feelingId: '' }
  let index = 0
  while (index < lines.length) {
    const line = lines[index].trim()
    if (line.startsWith('📍 ') && !parsed.location) {
      parsed.location = line.slice('📍 '.length).trim()
    } else if (line.startsWith('👥 Cùng với ') && parsed.taggedUsernames.length === 0) {
      const usernames = line.slice('👥 Cùng với '.length)
        .split(',').map(value => value.trim()).filter(value => /^@[\p{L}\p{N}_.-]+$/u.test(value))
        .map(value => value.slice(1))
      if (!usernames.length) break
      parsed.taggedUsernames = usernames
    } else {
      const feeling = POST_FEELINGS.find(item => line === feelingPostLine(item.id))
      if (!feeling || parsed.feelingId) break
      parsed.feelingId = feeling.id
    }
    index++
  }
  parsed.caption = lines.slice(index).join('\n').trim()
  return parsed
}

export function composePostContent({ caption, location, taggedUsernames, feelingId }: PostExtras): string {
  return [
    location.trim() ? `📍 ${location.trim()}` : '',
    taggedUsernames.length ? `👥 Cùng với ${taggedUsernames.map(user => `@${user}`).join(', ')}` : '',
    feelingPostLine(feelingId),
    caption.trim(),
  ].filter(Boolean).join('\n')
}
