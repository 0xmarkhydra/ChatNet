import { useMemo, useState } from 'react'
import { ChevronRight, Search, UsersRound } from 'lucide-react'
import type { Conversation } from '../../chat/types'
import UserAvatar from '../../../shared/ui/UserAvatar'

type Props = {
  groups: Conversation[]
  onOpen: (conversationId: number) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

/** Community discovery stays in the Feed layout; all chat and management lives in Messages. */
export default function FeedCommunitiesList({ groups, onOpen, hasMore, loadingMore, onLoadMore }: Props) {
  const [query, setQuery] = useState('')
  const communities = useMemo(() => groups
    .filter(group => group.type === 'group' && group.name.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi')), [groups, query])

  return (
    <section className="feed-community-list" aria-label="Danh sách cộng đồng">
      <header className="feed-community-list-heading">
        <div>
          <h2>Cộng đồng</h2>
          <p>Chọn một cộng đồng để mở cuộc trò chuyện trong Tin nhắn.</p>
        </div>
        <span className="feed-community-count">{communities.length} cộng đồng</span>
      </header>
      <label className="feed-community-search">
        <Search size={18} aria-hidden="true" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Tìm cộng đồng..." aria-label="Tìm cộng đồng" />
      </label>
      <div className="feed-community-rows">
        {communities.map(group => (
          <button type="button" key={group.id} className="feed-community-row"
            onClick={() => onOpen(group.id)} aria-label={`Mở cuộc trò chuyện ${group.name}`}>
            <UserAvatar name={group.name} className="feed-community-avatar" group />
            <span className="feed-community-row-copy">
              <strong>{group.name}</strong>
              <small><UsersRound size={13} aria-hidden="true" /> {group.memberCount} thành viên{group.unreadCount > 0 ? ` · ${group.unreadCount} tin chưa đọc` : ''}</small>
              <span className="feed-community-last-message">{group.lastMessage || 'Xem cuộc trò chuyện và các kênh của nhóm'}</span>
            </span>
            <ChevronRight size={20} className="feed-community-open-icon" aria-hidden="true" />
          </button>
        ))}
        {communities.length === 0 && (
          <p className="feed-community-empty">{query ? 'Không tìm thấy cộng đồng phù hợp.' : 'Bạn chưa tham gia cộng đồng nào.'}</p>
        )}
      </div>
      {hasMore && <button className="feed-community-load" type="button" disabled={loadingMore} onClick={onLoadMore}>
        {loadingMore ? 'Đang tải...' : 'Tải thêm cộng đồng'}
      </button>}
    </section>
  )
}
