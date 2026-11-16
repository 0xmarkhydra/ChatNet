import type { FeedComment } from './components/FeedDiscussion'
import type { MediaAttachment } from '../../shared/utils/media'

export const FEED_PAGE_SIZE = 15

export type Post = {
  id: number
  author: string
  authorDisplayName?: string
  content: string
  likes: number
  liked: boolean
  myReaction?: string
  reactions?: { emoji: string; count: number }[]
  comments: FeedComment[]
  attachments?: MediaAttachment[]
  visibility?: 'public' | 'friends' | 'private'
  background?: string
  updatedAt?: string
  saved?: boolean
  createdAt: string
}

export type StoryBackground = 'berry' | 'indigo' | 'teal' | 'sunset'

export type TextStoryInput = { text: string; background: StoryBackground }

export type StoryDraft = { kind: 'choose' } | { kind: 'media'; file: File } | { kind: 'text' }

export type Story = {
  id: number
  author: string
  authorDisplayName?: string
  createdAt: string
  expiresAt: string
} & (
  | { attachment: MediaAttachment; text?: never; background?: never }
  | (TextStoryInput & { attachment?: never })
)