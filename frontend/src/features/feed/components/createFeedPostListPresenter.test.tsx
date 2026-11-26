import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps, ReactElement } from 'react'
import FeedPostCard from './FeedPostCard'
import { createFeedPostListPresenter } from './createFeedPostListPresenter'
import type { Post } from '../types'

const posts: Post[] = [
  { id: 12, author: 'a', comments: [], content: '', createdAt: '', likes: 0, liked: false },
  { id: 14, author: 'b', comments: [], content: '', createdAt: '', likes: 0, liked: false },
]

function setup() {
  const open = vi.fn()
  const discussion = vi.fn(post => <span>Discussion {post.id}</span>)
  const reaction = vi.fn()
  const card = {
    name: 'demo',
    ownDisplayName: 'Demo',
    onAuthorOpen: vi.fn(),
    apiFetch: vi.fn(),
    syncFeedPost: vi.fn(),
    removeFeedPost: vi.fn(),
    setNotice: vi.fn(),
    token: 'token',
    translationPreferencesLoaded: false,
    targetLanguage: '',
    likePreviews: {},
    like: vi.fn(),
    onEditPost: vi.fn(),
    onRepostChanged: vi.fn(),
    onShareToChat: vi.fn(),
    taggedNames: {},
  } as unknown as Omit<ComponentProps<typeof FeedPostCard>,
    'post' | 'setActivePostId' | 'discussion' | 'showSave' | 'onReactionUsers'>
  const render = createFeedPostListPresenter({
    card,
    onOpenPost: open,
    renderDiscussion: discussion,
    onReactionUsers: reaction,
  })
  return { render, open, discussion, reaction }
}

describe('FeedPostCard list presenter', () => {
  it('keeps original card elements, IDs, and open callbacks', () => {
    const t = setup()
    const rendered = t.render(posts) as ReactElement<ComponentProps<typeof FeedPostCard>>[]
    expect(rendered.map(element => element.key)).toEqual(['12', '14'])
    expect(rendered.every(element => element.type === FeedPostCard)).toBe(true)
    expect(rendered.map(element => element.props.post.id)).toEqual([12, 14])
    expect(rendered.every(element => element.props.discussion != null)).toBe(true)
    rendered[0].props.setActivePostId(12)
    expect(t.open).toHaveBeenCalledWith(12)
    expect(t.discussion).toHaveBeenCalledTimes(2)
  })

  it('renders an inline composer for each post and supports custom detail open handlers', () => {
    const t = setup()
    const customOpen = vi.fn()
    const rendered = t.render(posts, true, customOpen) as ReactElement<ComponentProps<typeof FeedPostCard>>[]
    expect(t.discussion).toHaveBeenCalledTimes(2)
    expect(t.discussion).toHaveBeenNthCalledWith(1, posts[0])
    expect(t.discussion).toHaveBeenNthCalledWith(2, posts[1])
    expect(rendered.every(element => element.props.discussion != null)).toBe(true)
    expect(rendered.every(element => element.props.showSave === true)).toBe(true)
    rendered[0].props.setActivePostId(12)
    expect(customOpen).toHaveBeenCalledWith(12)
    expect(t.open).not.toHaveBeenCalled()
  })
})