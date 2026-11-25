import type { Story } from '../types'

export type StoryGroup = {
  author: string
  displayName: string
  stories: Story[]
  /** Newest story, used for the preview and the "time ago" line. */
  latest: Story
  hasUnseen: boolean
  /** The story to open first: the oldest unseen one, else the oldest. */
  openId: number
  own: boolean
}

const time = (story: Story) => Date.parse(story.createdAt) || 0

/** One group per author. Own stories first, then unseen before seen, newest first. */
export function groupStories(stories: Story[], seen: ReadonlySet<number>, username: string): StoryGroup[] {
  const byAuthor = new Map<string, Story[]>()
  for (const story of stories) {
    const list = byAuthor.get(story.author)
    if (list) list.push(story)
    else byAuthor.set(story.author, [story])
  }
  const groups = Array.from(byAuthor, ([author, items]): StoryGroup => {
    const ordered = [...items].sort((a, b) => time(a) - time(b))
    const unseen = ordered.filter(story => !seen.has(story.id))
    return {
      author,
      displayName: ordered[0].authorDisplayName || author,
      stories: ordered,
      latest: ordered[ordered.length - 1],
      hasUnseen: unseen.length > 0,
      openId: (unseen[0] ?? ordered[0]).id,
      own: author === username,
    }
  })
  return groups.sort((a, b) =>
    Number(b.own) - Number(a.own) || Number(b.hasUnseen) - Number(a.hasUnseen) || time(b.latest) - time(a.latest))
}

export function relativeStoryTime(date: string, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - Date.parse(date)) / 60000)
  if (!Number.isFinite(minutes)) return ''
  if (minutes < 1) return 'Vừa đăng'
  if (minutes < 60) return minutes + ' phút trước'
  if (minutes < 1440) return Math.floor(minutes / 60) + ' giờ trước'
  return Math.floor(minutes / 1440) + ' ngày trước'
}
