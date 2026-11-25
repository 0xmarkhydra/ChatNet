import type { Dispatch, SetStateAction } from 'react'
import { FeedDiscussion, type DiscussionDraft, type FeedComment } from '../components/FeedDiscussion'
import type { Post } from '../types'

type Options = {
  sessionId: string
  getCurrentSessionId: () => string | undefined
  sortOrder: 'oldest' | 'newest'
  pendingComments: Record<number, FeedComment>
  commentEditors: Record<number, DiscussionDraft>
  setCommentEditors: Dispatch<SetStateAction<Record<number, DiscussionDraft>>>
  api: string
  token: string
  targetLanguage: string
  translationPreferencesLoaded: boolean
  currentUser: string
  addComment: (post: Post, content: string, parentId?: number) => Promise<void>
  manageFeedComment: (post: Post, commentId: number, method: 'PATCH' | 'DELETE', content?: string) => Promise<void>
  reportFeedComment: (commentId: number, reason: string) => Promise<void>
  setCommentLike: (post: Post, commentId: number, liked: boolean) => Promise<void>
}

/**
 * Produces FeedDiscussion nodes while keeping editor writes isolated to
 * the session that mounted the presenter. Preserves the original key and callbacks.
 */
export function createFeedDiscussionPresenter({
  sessionId, getCurrentSessionId, sortOrder, pendingComments,
  commentEditors, setCommentEditors, api, token,
  targetLanguage, translationPreferencesLoaded, currentUser,
  addComment, manageFeedComment, reportFeedComment, setCommentLike,
}: Options) {
  return (discussionPost: Post, onAuthorOpen: (username: string) => void) => (
    <FeedDiscussion
      key={discussionPost.id}
      variant="post-page"
      sortOrder={sortOrder}
      pending={pendingComments[discussionPost.id]}
      comments={discussionPost.comments || []}
      editor={commentEditors[discussionPost.id] || { replyTo: null, drafts: {} }}
      updateEditor={(editor) => {
        if (getCurrentSessionId() === sessionId) {
          setCommentEditors(current => ({ ...current, [discussionPost.id]: editor }))
        }
      }}
      api={api}
      token={token}
      target={translationPreferencesLoaded ? targetLanguage : ''}
      submit={(content, parentId) => addComment(discussionPost, content, parentId)}
      currentUser={currentUser}
      onEdit={(commentId, content) => manageFeedComment(discussionPost, commentId, 'PATCH', content)}
      onDelete={(commentId) => manageFeedComment(discussionPost, commentId, 'DELETE')}
      onReport={reportFeedComment}
      onLike={(commentId, liked) => setCommentLike(discussionPost, commentId, liked)}
      onAuthorOpen={onAuthorOpen}
    />
  )
}
