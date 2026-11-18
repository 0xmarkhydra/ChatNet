import type { GroupMember } from '../types'

export type MentionQuery = { start: number; end: number; query: string }

// Only treat an @ after whitespace/start as a trigger; email addresses stay plain text.
export function findMentionQuery(text: string, cursor: number): MentionQuery | null {
  const before = text.slice(0, cursor)
  const match = /(^|\s)@([^\s@]*)$/.exec(before)
  if (!match) return null
  // Replace the whole existing username when editing a mention from its middle.
  // Otherwise choosing a suggestion could leave a duplicate suffix behind.
  const suffix = /^[a-zA-Z0-9_.-]*/.exec(text.slice(cursor))?.[0] ?? ''
  return { start: cursor - match[2].length - 1, end: cursor + suffix.length, query: match[2] }
}

const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi-VN')
const MENTION_PATTERN = /(^|\s)@([a-zA-Z0-9_.-]+)(?![a-zA-Z0-9_.-])/g

export function mentionedUsernames(text: string): Set<string> {
  const mentioned = new Set<string>()
  for (const match of text.matchAll(MENTION_PATTERN)) mentioned.add(match[2].toLocaleLowerCase())
  return mentioned
}

export function matchMentionMembers(members: GroupMember[], query: string, text = '', activeMention?: MentionQuery): GroupMember[] {
  const term = fold(query)
  // Do not count the mention currently being typed as already selected.
  const otherMentions = activeMention
    ? text.slice(0, activeMention.start) + ' '.repeat(activeMention.end - activeMention.start) + text.slice(activeMention.end)
    : text
  const used = mentionedUsernames(otherMentions)
  return members
    .filter(member => !used.has(member.username.toLocaleLowerCase()) && (fold(member.username).includes(term) || fold(member.displayName || '').includes(term)))
    .sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username, 'vi'))
}

export function insertMention(text: string, mention: MentionQuery, username: string): { text: string; cursor: number } {
  const separator = /^\s/.test(text.slice(mention.end)) ? '' : ' '
  const inserted = '@' + username + separator
  const next = text.slice(0, mention.start) + inserted + text.slice(mention.end)
  return { text: next, cursor: mention.start + inserted.length }
}

export type MentionPart = { text: string; username?: string; all?: boolean }

export function splitMessageMentions(text: string, members: GroupMember[]): MentionPart[] {
  const known = new Set(members.map(member => member.username.toLocaleLowerCase()))
  const parts: MentionPart[] = []
  let cursor = 0
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const username = match[2]
    const isAll = username.toLocaleLowerCase() === 'all'
    if (!isAll && !known.has(username.toLocaleLowerCase())) continue
    const at = (match.index || 0) + match[1].length
    if (at > cursor) parts.push({ text: text.slice(cursor, at) })
    parts.push(isAll ? { text: '@' + username, all: true } : { text: '@' + username, username })
    cursor = at + username.length + 1
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) })
  return parts
}
