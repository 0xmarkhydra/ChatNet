import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Languages, MessageCircle, TrendingUp, UserPlus, UsersRound } from 'lucide-react'
import type { Post } from '../features/feed/types'
import type { FriendConnection, FriendSearchResult } from '../features/contacts/types'
import UserAvatar from '../shared/ui/UserAvatar'

type Props = {
  username: string
  sessionId: string
  posts: Post[]
  friends: FriendConnection[]
  friendRequests: FriendConnection[]
  friendBusyIds: Set<number>
  request: (path: string, init?: RequestInit) => Promise<Response>
  onFriend: (friend: FriendSearchResult) => void
  onViewUser: (username: string) => void
  onViewContacts: () => void
  onSearchTag: (tag: string) => void
  onOpenChat: () => void
}

export function extractFeedTopics(posts: Post[]) {
  const counts = new Map<string, { tag: string; count: number }>()
  for (const post of posts) {
    const seen = new Set<string>()
    for (const match of post.content.matchAll(/#[\p{L}\p{M}\p{N}_]{2,32}/gu)) {
      const tag = match[0], key = tag.toLocaleLowerCase('vi-VN')
      if (seen.has(key)) continue
      seen.add(key)
      const previous = counts.get(key)
      counts.set(key, { tag: previous?.tag || tag, count: (previous?.count || 0) + 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'vi')).slice(0, 3)
}

export default function SocialFeedSidebar({
  username, sessionId, posts, friends, friendRequests, friendBusyIds,
  request, onFriend, onViewUser, onViewContacts, onSearchTag, onOpenChat,
}: Props) {
  const requestRef = useRef(request)
  requestRef.current = request
  const [suggestions, setSuggestions] = useState<FriendSearchResult[]>([])
  const [suggestionsBusy, setSuggestionsBusy] = useState(true)
  const [suggestionsError, setSuggestionsError] = useState(false)
  const [revision, setRevision] = useState(0)
  const topics = useMemo(() => extractFeedTopics(posts), [posts])
  const connectedIds = useMemo(() => new Set([...friends, ...friendRequests].map(friend => friend.id)), [friends, friendRequests])
  const visible = suggestions.filter(user => user.id > 0 && user.username !== username && !connectedIds.has(user.id)).slice(0, 3)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setSuggestionsBusy(true)
    setSuggestionsError(false)
    void requestRef.current('/api/users/suggestions', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Không tải được gợi ý kết nối')
        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw new Error('Dữ liệu kết nối không hợp lệ')
        if (active) setSuggestions(data.filter(user => user && Number.isSafeInteger(user.id) && typeof user.username === 'string'))
      })
      .catch(() => { if (active) setSuggestionsError(true) })
      .finally(() => { if (active) setSuggestionsBusy(false) })
    return () => { active = false; controller.abort() }
  }, [sessionId, revision])

  return (
    <aside className="social-feed-side" aria-label="Khám phá và gợi ý trên bảng tin">
      <section className="social-feed-side-card social-feed-suggestions" aria-label="Gợi ý kết nối">
        <header><h2>Gợi ý kết nối</h2><button type="button" onClick={onViewContacts}>Xem tất cả <ArrowRight size={16} aria-hidden="true" /></button></header>
        {suggestionsBusy && <p className="social-feed-side-status" role="status">Đang tải gợi ý...</p>}
        {!suggestionsBusy && suggestionsError && <div className="social-feed-side-status" role="alert">Không tải được gợi ý.
          <button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button>
        </div>}
        {!suggestionsBusy && !suggestionsError && visible.length === 0 && (
          <div className="social-feed-side-empty"><UsersRound size={23} aria-hidden="true" />
            <p>Chưa có đề xuất kết nối phù hợp.</p>
            <button type="button" onClick={onViewContacts}>Tìm thêm bạn bè</button>
          </div>
        )}
        <div className="social-feed-suggestion-list">
          {visible.map(user => (
            <article key={user.id} className="social-feed-suggestion-row">
              <button type="button" className="social-feed-suggestion-person" onClick={() => onViewUser(user.username)}
                aria-label={`Xem hồ sơ ${user.displayName || user.username}`}>
                <UserAvatar username={user.username} name={user.displayName || user.username} className="social-feed-suggestion-avatar" online={user.online} />
                <span className="social-feed-suggestion-info">
                  <strong>{user.displayName || user.username}</strong>
                  <small>{typeof user.mutualGroups === 'number' && user.mutualGroups > 0
                    ? `${user.mutualGroups} nhóm chung`
                    : user.online ? 'Đang hoạt động' : '@' + user.username}</small>
                </span>
              </button>
              <button type="button" className="social-feed-connect"
                disabled={friendBusyIds.has(user.id)}
                onClick={() => onFriend(user)}><UserPlus size={15} aria-hidden="true" /> Kết bạn</button>
            </article>
          ))}
        </div>
      </section>

      <section className="social-feed-side-card social-feed-trending" aria-label="Chủ đề nổi bật">
        <header><h2>Chủ đề nổi bật</h2><TrendingUp size={20} aria-hidden="true" /></header>
        {topics.length ? <div className="social-feed-trend-list">
          {topics.map(topic => (
            <button key={topic.tag.toLocaleLowerCase('vi-VN')} type="button" onClick={() => onSearchTag(topic.tag)}
              className="social-feed-trend">
              <strong>{topic.tag}</strong>
              <span>{topic.count.toLocaleString('vi-VN')} bài viết đã tải</span>
            </button>
          ))}
        </div> : <div className="social-feed-side-empty social-feed-topic-empty">
          <TrendingUp size={22} aria-hidden="true" />
          <p>Chủ đề sẽ xuất hiện khi bài viết có hashtag.</p>
        </div>}
      </section>

      <section className="social-feed-translation" aria-label="Dịch AI, kết nối toàn cầu">
        <span className="social-feed-translation-icon"><Languages size={26} aria-hidden="true" /></span>
        <div className="social-feed-translation-copy">
          <h2>Dịch AI, kết nối toàn cầu</h2>
          <p>Trò chuyện không giới hạn ngôn ngữ.</p>
        </div>
        <button type="button" onClick={onOpenChat}><MessageCircle size={18} aria-hidden="true" /> Mở tin nhắn <ArrowRight size={16} aria-hidden="true" /></button>
      </section>
    </aside>
  )
}