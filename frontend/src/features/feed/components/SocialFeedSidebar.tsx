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
    <aside className="social-feed-side box-border hidden min-w-0 min-[761px]:grid min-[761px]:grid-cols-[minmax(0,1fr)] min-[761px]:content-start min-[761px]:gap-4 min-[761px]:[&>*]:box-border min-[761px]:[&>*]:w-full min-[761px]:[&>*]:min-w-0 min-[1121px]:sticky min-[1121px]:top-[17px] min-[1331px]:top-5 min-[1121px]:flex min-[1121px]:max-h-[calc(100dvh-96px)] min-[1121px]:min-h-0 min-[1121px]:flex-col min-[1121px]:self-start min-[1121px]:gap-[14px] min-[1121px]:overflow-x-hidden min-[1121px]:overflow-y-auto min-[1121px]:overscroll-y-contain min-[1121px]:pr-[5px] min-[1121px]:pb-px min-[1121px]:[scrollbar-width:thin] min-[1121px]:[scrollbar-color:#c5d2e7_transparent] min-[1121px]:[&>*]:flex-none" aria-label="Gợi ý trên bảng tin">
      <section className="social-feed-side-card social-feed-search-card rounded-none! border-0! bg-transparent! p-0! shadow-none!" aria-label="Tìm kiếm trên Bảng tin">
        <label className="social-feed-search-field flex h-11 min-w-0 items-center gap-[9px] rounded-[22px] bg-[#eef1fb] px-3 text-[#697894] focus-within:outline-none! focus-within:ring-2 focus-within:ring-primary/40 [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-0! [&_input]:bg-transparent! [&_input]:text-ui-caption [&_input]:text-foreground [&_input]:outline-none! [&_input:focus-visible]:border-0! [&_input:focus-visible]:outline-none! [&_input:focus-visible]:shadow-none! [&_input:focus-visible]:ring-0! [&_kbd]:shrink-0 [&_kbd]:rounded-[5px] [&_kbd]:border [&_kbd]:border-[#dce3f5] [&_kbd]:bg-white [&_kbd]:px-[5px] [&_kbd]:py-[3px] [&_kbd]:text-[10px]">
          <Search size={19} aria-hidden="true" />
          <input type="search" value={searchQuery} maxLength={120}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Tìm kiếm trên SocCo" aria-label="Tìm bài viết hoặc tác giả" />
          <kbd aria-label="Phím tắt tìm kiếm toàn cục">Ctrl K</kbd>
        </label>
      </section>
      <section className="social-feed-side-card social-feed-suggestions min-h-[300px] rounded-2xl border border-[#e8ecf5] bg-white p-[17px_19px_19px] shadow-[0_3px_16px_rgba(30,51,96,0.035)]" aria-label="Gợi ý kết nối">
        <header className="flex items-center justify-between gap-3 [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:leading-[26px] [&_h2]:text-[#1b2d4b]"><h2>Gợi ý kết nối</h2><button className="inline-flex cursor-pointer items-center gap-[3px] whitespace-nowrap border-0! bg-transparent! px-0! py-[5px]! text-ui-caption! font-semibold text-primary hover:text-[#154dbb]" type="button" onClick={onViewContacts}>Xem tất cả <ArrowRight size={16} aria-hidden="true" /></button></header>

        {!suggestionsBusy && suggestionsError && <div className="social-feed-side-status mx-[2px] my-5 text-xs leading-normal text-[#75849f] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[#3165cf] [&_button]:font-bold" role="alert">Không tải được gợi ý.
          <button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button>
        </div>}
        {!suggestionsBusy && !suggestionsError && visible.length === 0 && (
          <div className="social-feed-side-empty flex min-h-[180px] flex-col items-center justify-center gap-[10px] text-center text-[#a0abc0] [&_p]:m-0 [&_p]:text-xs [&_p]:leading-normal [&_p]:text-[#8595ae] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-ui-caption! [&_button]:font-bold [&_button]:text-[#3165cf]"><UsersRound size={23} aria-hidden="true" />
            <p>Chưa có đề xuất kết nối phù hợp.</p>
            <button type="button" onClick={onViewContacts}>Tìm thêm bạn bè</button>
          </div>
        )}
        <div className="social-feed-suggestion-list mt-[13px] grid grid-cols-[minmax(0,1fr)] gap-2">
          {visible.map(user => (
            <article key={user.id} className="social-feed-suggestion-row flex min-h-16 min-w-0 items-center justify-between gap-2">
              <button type="button" className="social-feed-suggestion-person flex min-w-0 flex-1 cursor-pointer items-center gap-[14px] border-0 bg-transparent text-left" onClick={() => onViewUser(user.username)}
                aria-label={`Xem hồ sơ ${user.displayName || user.username}`}>
                <UserAvatar username={user.username} name={user.displayName || user.username} className="social-feed-suggestion-avatar size-[49px] shrink-0 rounded-full" online={user.online} />
                <span className="social-feed-suggestion-info flex min-w-0 flex-col gap-1 [&_strong]:truncate [&_strong]:text-[13px] [&_strong]:font-semibold [&_strong]:text-[#344761] [&_small]:truncate [&_small]:text-[11px] [&_small]:text-[#8b9ab0]">
                  <strong>{user.displayName || user.username}</strong>
                  <small>{typeof user.mutualGroups === 'number' && user.mutualGroups > 0
                    ? `${user.mutualGroups} nhóm chung`
                    : user.online ? 'Đang hoạt động' : '@' + user.username}</small>
                </span>
              </button>
              <button type="button" className="social-feed-connect flex min-h-8 min-w-[104px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border-0 bg-[#eff3ff] px-2 text-ui-caption! font-semibold text-[#2563eb] hover:bg-[#e3ebff]"
                disabled={friendBusyIds.has(user.id)}
                onClick={() => onFriend(user)}><UserPlus size={15} aria-hidden="true" /> Kết bạn</button>
            </article>
          ))}
        </div>
      </section>
      <div className="social-feed-community-shell rounded-2xl border border-[#e8ecf5] bg-white p-[17px_19px_19px] shadow-[0_3px_16px_rgba(30,51,96,0.035)] [&_header]:flex [&_header]:items-center [&_header]:justify-between [&_header]:gap-3 [&_header_h2]:m-0 [&_header_h2]:text-lg [&_header_h2]:leading-[26px] [&_header_h2]:font-bold [&_header_h2]:text-[#1b2d4b] [&_header_button]:cursor-pointer [&_header_button]:whitespace-nowrap [&_header_button]:border-0! [&_header_button]:bg-transparent! [&_header_button]:px-0! [&_header_button]:py-[5px]! [&_header_button]:text-ui-caption! [&_header_button]:font-semibold [&_header_button]:text-[#3165cb] [&_header_button:hover]:text-[#154dbb]">
        {communityCard}
      </div>
    </aside>
  )
}