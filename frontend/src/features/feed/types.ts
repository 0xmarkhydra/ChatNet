import type { FeedComment } from './components/FeedDiscussion'
import type { MediaAttachment } from '../../shared/utils/media'

export const FEED_PAGE_SIZE = 15

export type PublishLocation = { latitude: number; longitude: number; accuracy: number; capturedAt: string; placeName?: string }

export type Post = {
  publishLocation?: PublishLocation
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
  repostKind?: 'quick' | 'quote'
  originalPost?: Pick<Post, 'id' | 'author' | 'authorDisplayName' | 'content' | 'attachments'>
  repostCount?: number
  myRepostId?: number
  createdAt: string
}

export type StoryBackground = 'berry' | 'indigo' | 'teal' | 'sunset'

export type TextStoryInput = { text: string; background: StoryBackground }

export type StoryDraft = { kind: 'choose' } | { kind: 'media'; file: File } | { kind: 'text' }

export type PendingStoryView = { status: "posting" | "failed"; percent: number | null; kind: "Ảnh" | "Video" | "Chữ" }

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