import { describe, expect, it, vi } from 'vitest'
import { createOpenMentionPost } from './createOpenMentionPost'
import type { Post } from '../types'
import type { PostMentionNotification } from './postMentionNotifications'

const mention = { id: 3, postId: 18 } as PostMentionNotification
const post: Post = { id: 18, author: 'demo', content: '', comments: [], createdAt: '', likes: 0, liked: false }

function createCase(apiFetch: (url: string, init?: RequestInit) => Promise<Response>, current = () => true) {
  const calls: string[] = []
  let posts = [{ ...post, id: 1 }]
  const navigate = vi.fn()
  const read = vi.fn(async () => {})
  const notices: string[] = []
  const open = createOpenMentionPost({
    isCurrentMentionVisit: current,
    apiFetch,
    setPosts: action => {
      posts = typeof action === 'function' ? action(posts) : action
      calls.push('setPosts')
    },
    setFeedCommunitiesOpen: value => calls.push('communities:' + value),
    setTab: value => calls.push('tab:' + value),
    navigate,
    feedPostPath: id => '/feed/post/' + id,
    readPostMention: read,
    setNotice: message => notices.push(message),
  })
  return { open, calls, navigate, read, notices, getPosts: () => posts }
}

describe('open mention post navigation', () => {
  it('preloads post before navigation and marks the notification as read', async () => {
    const t = createCase(async () => Response.json(post))
    await t.open(mention)
    expect(t.getPosts().map(p => p.id)).toEqual([18, 1])
    expect(t.calls).toEqual(['setPosts', 'communities:false', 'tab:feed'])
    expect(t.navigate).toHaveBeenCalledWith('/feed/post/18', { state: { postId: 18 } })
    expect(t.read).toHaveBeenCalledWith(3)
  })

  it('discards a response after session change without showing a notice', async () => {
    let active = true
    const t = createCase(async () => { active = false; return Response.json(post) }, () => active)
    await t.open(mention)
    expect(t.calls).toEqual([])
    expect(t.navigate).not.toHaveBeenCalled()
    expect(t.read).not.toHaveBeenCalled()
  })

  it('reports missing post without changing route', async () => {
    const t = createCase(async () => new Response(null, { status: 404 }))
    await t.open(mention)
    expect(t.notices).toEqual(['Bài viết không tồn tại hoặc bạn không còn quyền xem.'])
    expect(t.navigate).not.toHaveBeenCalled()
  })
})