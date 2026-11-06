import { useMemo, useState } from 'react'
import { ArrowRight, MessageCircle, Phone, Plus, Search, Users, Video } from 'lucide-react'
import type { Conversation } from '../features/chat/types'
import { CallHeaderActions } from '../features/calls/CallManager'
import UserAvatar from '../shared/ui/UserAvatar'

type Props = {
  kind: 'groups' | 'calls'
  conversations: Conversation[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onOpenChat: (conversationId?: number) => void
  onCreateGroup: () => void
}

export default function CommunicationHub({
  kind, conversations, hasMore, loadingMore, onLoadMore, onOpenChat, onCreateGroup,
}: Props) {
  const [query, setQuery] = useState('')
  const groups = kind === 'groups'
  const items = useMemo(() => conversations.filter((conversation) =>
    (!groups || conversation.type === 'group')
    && conversation.name.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN'))
  ), [conversations, groups, query])

  return (
    <section className="communication-hub" aria-label={groups ? 'Nhóm và cộng đồng' : 'Cuộc gọi'}>
      <header className="communication-hub-heading">
        <div>
          <span className="communication-hub-eyebrow">{groups ? 'CỘNG ĐỒNG SOC​​CO' : 'KẾT NỐI TRỰC TIẾP'}</span>
          <h1>{groups ? 'Nhóm & cộng đồng' : 'Cuộc gọi & Dịch AI'}</h1>
          <p>{groups
            ? 'Quản lý các nhóm bạn đang tham gia và tiếp tục cuộc trò chuyện.'
            : 'Bắt đầu cuộc gọi thoại hoặc video từ các cuộc trò chuyện của bạn.'}</p>
        </div>
        <button type="button" className="communication-hub-primary" onClick={groups ? onCreateGroup : () => onOpenChat()}>
          {groups ? <Plus size={18} /> : <MessageCircle size={18} />}
          {groups ? 'Tạo nhóm mới' : 'Mở tin nhắn'}
        </button>
      </header>
      <div className="communication-hub-content">
        <section className="communication-hub-list" aria-label={groups ? 'Danh sách nhóm' : 'Liên hệ có thể gọi'}>
          <div className="communication-hub-section-title">
            <div>
              <h2>{groups ? 'Nhóm của bạn' : 'Bắt đầu cuộc gọi'}</h2>
              <p>{groups ? 'Chọn nhóm để xem tin nhắn và quản lý thành viên.' : 'Cuộc gọi bảo mật được xử lý qua dịch vụ gọi hiện tại.'}</p>
            </div>
            <span>{items.length} đang hiển thị</span>
          </div>
          <label className="communication-hub-search">
            <Search size={18} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={groups ? 'Tìm tên nhóm...' : 'Tìm tên cuộc trò chuyện...'}
              aria-label={groups ? 'Tìm nhóm đã tải' : 'Tìm cuộc trò chuyện đã tải'} />
          </label>
          <div className="communication-hub-rows">
            {items.map((conversation) => (
              <article key={conversation.id} className="communication-hub-row">
                <UserAvatar
                  username={conversation.otherUsername}
                  name={conversation.name}
                  group={conversation.type === 'group'}
                  className="communication-hub-avatar"
                  online={conversation.type === 'direct' && conversation.online}
                />
                <div className="communication-hub-row-copy">
                  <strong>{conversation.name}</strong>
                  <span>{conversation.type === 'group'
                    ? `${conversation.memberCount} thành viên`
                    : conversation.online ? 'Đang hoạt động' : 'Chat riêng'}</span>
                  {groups && conversation.lastMessage && <small>{conversation.lastMessage}</small>}
                </div>
                {groups ? (
                  <button type="button" className="communication-hub-open" onClick={() => onOpenChat(conversation.id)}>
                    <span>Mở nhóm</span><ArrowRight size={16} />
                  </button>
                ) : (
                  <div className="communication-hub-call-actions">
                    <CallHeaderActions conversationId={conversation.id} />
                    <button type="button" className="communication-hub-message" onClick={() => onOpenChat(conversation.id)} aria-label={`Nhắn tin với ${conversation.name}`} title="Nhắn tin"><MessageCircle size={18} /></button>
                  </div>
                )}
              </article>
            ))}
            {items.length === 0 && (
              <div className="communication-hub-empty">
                {groups ? <Users size={34} /> : <Phone size={34} />}
                <strong>{query.trim() ? 'Không có kết quả phù hợp' : groups ? 'Chưa có nhóm trong danh sách đã tải' : 'Chưa có cuộc trò chuyện để gọi'}</strong>
                <p>{query.trim() ? 'Thử từ khóa khác hoặc tải thêm hội thoại.' : groups ? 'Tạo nhóm mới hoặc tải thêm hội thoại để xem các nhóm khác.' : 'Bắt đầu kết nối với bạn bè trong mục Tin nhắn.'}</p>
              </div>
            )}
          </div>
          {hasMore && (
            <button type="button" className="communication-hub-load" disabled={loadingMore} onClick={onLoadMore} aria-busy={loadingMore}>
              {loadingMore ? 'Đang tải...' : 'Tải thêm hội thoại'}
            </button>
          )}
        </section>
        <aside className="communication-hub-aside">
          <div className="communication-hub-aside-icon">{groups ? <Users size={28} /> : <Video size={28} />}</div>
          <h2>{groups ? 'Cộng tác trong nhóm' : 'Gọi và trò chuyện'}</h2>
          <p>{groups
            ? 'Mở một nhóm để xem thành viên, lời mời, quyền quản trị và các nội dung đã chia sẻ.'
            : 'Chọn biểu tượng gọi thoại hoặc video ở một hội thoại. Bạn có thể thiết lập dịch AI trong phiên gọi khi tính năng khả dụng.'}</p>
          <button type="button" onClick={groups ? onCreateGroup : () => onOpenChat()}>
            {groups ? 'Tạo nhóm' : 'Xem các cuộc trò chuyện'} <ArrowRight size={15} />
          </button>
        </aside>
      </div>
    </section>
  )
}