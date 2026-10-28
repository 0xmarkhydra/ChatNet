import type { FeedComment } from './FeedDiscussion'
import type { MediaAttachment } from '../../shared/lib/media'

export const FEED_PAGE_SIZE = 15

export type Post = {
  id: number
  author: string
  content: string
  likes: number
  liked: boolean
  comments: FeedComment[]
  attachments?: MediaAttachment[]
  visibility?: 'public' | 'friends' | 'private'
  background?: string
  updatedAt?: string
  saved?: boolean
  createdAt: string
}

export type Story = {
  id: number
  author: string
  attachment: MediaAttachment
  createdAt: string
  expiresAt: string
}
