import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, Search, UserPlus, UsersRound } from 'lucide-react'
import type { FriendConnection, FriendSearchResult } from '../../contacts'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { useLatest } from '../../../shared/hooks/useLatest'

type Props = {
  username: string
  sessionId: string
  friends: FriendConnection[]
  friendRequests: FriendConnection[]
  friendBusyIds: Set<number>
  request: (path: string, init?: RequestInit) => Promise<Response>
  onFriend: (friend: FriendSearchResult) => void
  onViewUser: (username: string) => void
  onViewContacts: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  communityCard: ReactNode
}

export default function SocialFeedSidebar({
  username, sessionId, friends, friendRequests, friendBusyIds,
  request, onFriend, onViewUser, onViewContacts,
  searchQuery, onSearchChange, communityCard,
}: Props) {
  const requestRef = useLatest(request)
  const [revision, setRevision] = useState(0)
  const [suggestionsResult, setSuggestionsResult] = useState<{
    sessionId: string
    revision: number
    users: FriendSearchResult[]
    error: boolean
  } | null>(null)
  // A new session or retry is loading immediately, before its request effect
  // runs. Responses from the previous identity are never displayed.
  const currentResult = suggestionsResult?.sessionId === sessionId
    && suggestionsResult.revision === revision ? suggestionsResult : null
  const suggestions = currentResult?.users ?? []
  const suggestionsBusy = currentResult === null
  const suggestionsError = currentResult?.error ?? false
  const connectedIds = useMemo(() => new Set([...friends, ...friendRequests].map(friend => friend.id)), [friends, friendRequests])
  const visible = suggestions.filter(user => user.id > 0 && user.username !== username && !connectedIds.has(user.id)).slice(0, 3)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void requestRef.current('/api/users/suggestions', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Không tải được gợi ý kết nối')
        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw new Error('Dữ liệu kết nối không hợp lệ')
        if (active) {
          setSuggestionsResult({
            sessionId, revision, error: false,
            users: data.filter(user => user && Number.isSafeInteger(user.id) && typeof user.username === 'string'),
          })
        }
      })
      .catch(() => {
        if (active) setSuggestionsResult({ sessionId, revision, error: true, users: [] })
      })
    return () => { active = false; controller.abort() }
  }, [sessionId, revision, requestRef])

  return (
    <aside className="social-feed-side box-border hidden min-w-0 app-desktop:grid app-desktop:grid-cols-[minmax(0,1fr)] app-desktop:content-start app-desktop:gap-4 app-desktop:[&>*]:box-border app-desktop:[&>*]:w-full app-desktop:[&>*]:min-w-0 app-wide:sticky app-wide:top-4 app-wide:flex app-wide:max-h-[calc(100dvh-126px)] app-wide:min-h-0 app-wide:flex-col app-wide:self-start app-wide:gap-[14px] app-wide:overflow-x-hidden app-wide:overflow-y-auto app-wide:overscroll-y-contain app-wide:pr-[5px] app-wide:pb-px app-wide:[scrollbar-width:thin] app-wide:[scrollbar-color:#c5d2e7_transparent] app-wide:[&>*]:flex-none" aria-label="Gợi ý trên bảng tin">
      <section className="social-feed-side-card social-feed-search-card" aria-label="Tìm kiếm trên Bảng tin">
        <label className="social-feed-search-field">
          <Search size={19} aria-hidden="true" />
          <input type="search" value={searchQuery} maxLength={120}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Tìm kiếm trên SocCo" aria-label="Tìm bài viết hoặc tác giả" />
          <kbd aria-label="Phím tắt tìm kiếm toàn cục">Ctrl K</kbd>
        </label>
      </section>
      <section className="social-feed-side-card social-feed-suggestions" aria-label="Gợi ý kết nối">
        <header><h2>Gợi ý kết nối</h2><button type="button" onClick={onViewContacts}>Xem tất cả <ArrowRight size={16} aria-hidden="true" /></button></header>

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
      {communityCard}
    </aside>
  )
}
