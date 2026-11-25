import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps, ReactElement } from 'react'
import { FeedDiscussion, type DiscussionDraft } from './FeedDiscussion'
import { createFeedDiscussionPresenter } from './createFeedDiscussionPresenter'
import type { Post } from '../types'

const post: Post = { id: 18, comments: [], author: 'demo', content: '', createdAt: '', likes: 0, liked: false }
const editor: DiscussionDraft = { replyTo: null, drafts: { 0: 'draft' } }

function setup(getCurrentSessionId = () => 'A') {
  const setCommentEditors = vi.fn()
  const addComment = vi.fn(async () => {})
  const manageFeedComment = vi.fn(async () => {})
  const reportFeedComment = vi.fn(async () => {})
  const setCommentLike = vi.fn(async () => {})
  const onAuthorOpen = vi.fn()
  const render = createFeedDiscussionPresenter({
    sessionId: 'A',
    getCurrentSessionId,
    sortOrder: 'newest',
    pendingComments: {},
    commentEditors: { 18: editor },
    setCommentEditors,
    api: '/api',
    token: 'session-token',
    targetLanguage: 'vi',
    translationPreferencesLoaded: true,
    currentUser: 'demo',
    addComment,
    manageFeedComment,
    reportFeedComment,
    setCommentLike,
  })
  const view = render(post, onAuthorOpen) as ReactElement<ComponentProps<typeof FeedDiscussion>>
  return { view, setCommentEditors, addComment, manageFeedComment, reportFeedComment, setCommentLike, onAuthorOpen }
}

describe('Feed discussion presenter', () => {
  it('preserves thread props, translation state, and action contracts', async () => {
    const t = setup()
    expect(t.view.type).toBe(FeedDiscussion)
    expect(t.view.key).toBe('18')
    expect(t.view.props.sortOrder).toBe('newest')
    expect(t.view.props.editor).toEqual(editor)
    expect(t.view.props.target).toBe('vi')
    expect(t.view.props.token).toBe('session-token')
    await t.view.props.submit('new comment', 2)
    expect(t.addComment).toHaveBeenCalledWith(post, 'new comment', 2)
    await t.view.props.onEdit(3, 'edited')
    await t.view.props.onDelete(4)
    expect(t.manageFeedComment).toHaveBeenNthCalledWith(1, post, 3, 'PATCH', 'edited')
    expect(t.manageFeedComment).toHaveBeenNthCalledWith(2, post, 4, 'DELETE')
    await t.view.props.onLike?.(3, true)
    expect(t.setCommentLike).toHaveBeenCalledWith(post, 3, true)
  })

  it('ignores stale editor updates from a previous account', () => {
    let current = 'A'
    const t = setup(() => current)
    const next: DiscussionDraft = { replyTo: null, drafts: { 0: 'next' } }
    current = 'B'
    t.view.props.updateEditor(next)
    expect(t.setCommentEditors).not.toHaveBeenCalled()
    current = 'A'
    t.view.props.updateEditor(next)
    expect(t.setCommentEditors).toHaveBeenCalledOnce()
    const update = t.setCommentEditors.mock.calls[0][0] as (prev: Record<number, DiscussionDraft>) => Record<number, DiscussionDraft>
    expect(update({ 9: editor })).toEqual({ 9: editor, 18: next })
  })

  it('falls back to an empty reply draft for a post with no editor', () => {
    const t = setup()
    const render = createFeedDiscussionPresenter({
      sessionId: 'A', getCurrentSessionId: () => 'A',
      sortOrder: 'oldest', pendingComments: {}, commentEditors: {},
      setCommentEditors: vi.fn(), api: '/api', token: 'token',
      targetLanguage: '', translationPreferencesLoaded: false, currentUser: 'demo',
      addComment: vi.fn(async () => {}), manageFeedComment: vi.fn(async () => {}),
      reportFeedComment: vi.fn(async () => {}), setCommentLike: vi.fn(async () => {}),
    })
    const view = render(post, t.onAuthorOpen) as ReactElement<ComponentProps<typeof FeedDiscussion>>
    expect(view.props.editor).toEqual({ replyTo: null, drafts: {} })
    expect(view.props.target).toBe('')
  })
})