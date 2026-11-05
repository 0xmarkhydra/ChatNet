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

export default function DesktopCommunicationHub({
  kind, conversations, hasMore, loadingMore, onLoadMore, onOpenChat, onCreateGroup,
}: Props) {
  const [query, setQuery] = useState('')
  const groups = kind === 'groups'
  const items = useMemo(() => conversations.filter((conversation) =>
    (!groups || conversation.type === 'group')
    && conversation.name.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN'))
  ), [conversations, groups, query])

  return (
    <section className="penpot-hub" aria-label={groups ? 'Nhóm và cộng đồng' : 'Cuộc gọi'}>
      <header className="penpot-hub-heading">
        <div>
          <span className="penpot-hub-eyebrow">{groups ? 'CỘNG ĐỒNG SOC​​CO' : 'KẾT NỐI TRỰC TIẾP'}</span>
          <h1>{groups ? 'Nhóm & cộng đồng' : 'Cuộc gọi & Dịch AI'}</h1>
          <p>{groups
            ? 'Quản lý các nhóm bạn đang tham gia và tiếp tục cuộc trò chuyện.'
            : 'Bắt đầu cuộc gọi thoại hoặc video từ các cuộc trò chuyện của bạn.'}</p>
        </div>
        <button type="button" className="penpot-hub-primary" onClick={groups ? onCreateGroup : () => onOpenChat()}>
          {groups ? <Plus size={18} /> : <MessageCircle size={18} />}
          {groups ? 'Tạo nhóm mới' : 'Mở tin nhắn'}
        </button>
      </header>
      <div className="penpot-hub-content">
        <section className="penpot-hub-list" aria-label={groups ? 'Danh sách nhóm' : 'Liên hệ có thể gọi'}>
          <div className="penpot-hub-section-title">
            <div>
              <h2>{groups ? 'Nhóm của bạn' : 'Bắt đầu cuộc gọi'}</h2>
              <p>{groups ? 'Chọn nhóm để xem tin nhắn và quản lý thành viên.' : 'Cuộc gọi bảo mật được xử lý qua dịch vụ gọi hiện tại.'}</p>
            </div>
            <span>{items.length} đang hiển thị</span>
          </div>
          <label className="penpot-hub-search">
            <Search size={18} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={groups ? 'Tìm tên nhóm...' : 'Tìm tên cuộc trò chuyện...'}
              aria-label={groups ? 'Tìm nhóm đã tải' : 'Tìm cuộc trò chuyện đã tải'} />
          </label>
          <div className="penpot-hub-rows">
            {items.map((conversation) => (
              <article key={conversation.id} className="penpot-hub-row">
                <UserAvatar
                  username={conversation.otherUsername}
                  name={conversation.name}
                  group={conversation.type === 'group'}
                  className="penpot-hub-avatar"
                  online={conversation.type === 'direct' && conversation.online}
                />
                <div className="penpot-hub-row-copy">
                  <strong>{conversation.name}</strong>
                  <span>{conversation.type === 'group'
                    ? `${conversation.memberCount} thành viên`
                    : conversation.online ? 'Đang hoạt động' : 'Chat riêng'}</span>
                  {groups && conversation.lastMessage && <small>{conversation.lastMessage}</small>}
                </div>
                {groups ? (
                  <button type="button" className="penpot-hub-open" onClick={() => onOpenChat(conversation.id)}>
                    <span>Mở nhóm</span><ArrowRight size={16} />
                  </button>
                ) : (
                  <div className="penpot-hub-call-actions">
                    <CallHeaderActions conversationId={conversation.id} />
                    <button type="button" className="penpot-hub-message" onClick={() => onOpenChat(conversation.id)} aria-label={`Nhắn tin với ${conversation.name}`} title="Nhắn tin"><MessageCircle size={18} /></button>
                  </div>
                )}
              </article>
            ))}
            {items.length === 0 && (
              <div className="penpot-hub-empty">
                {groups ? <Users size={34} /> : <Phone size={34} />}
                <strong>{query.trim() ? 'Không có kết quả phù hợp' : groups ? 'Chưa có nhóm trong danh sách đã tải' : 'Chưa có cuộc trò chuyện để gọi'}</strong>
                <p>{query.trim() ? 'Thử từ khóa khác hoặc tải thêm hội thoại.' : groups ? 'Tạo nhóm mới hoặc tải thêm hội thoại để xem các nhóm khác.' : 'Bắt đầu kết nối với bạn bè trong mục Tin nhắn.'}</p>
              </div>
            )}
          </div>
          {hasMore && (
            <button type="button" className="penpot-hub-load" disabled={loadingMore} onClick={onLoadMore} aria-busy={loadingMore}>
              {loadingMore ? 'Đang tải...' : 'Tải thêm hội thoại'}
            </button>
          )}
        </section>
        <aside className="penpot-hub-aside">
          <div className="penpot-hub-aside-icon">{groups ? <Users size={28} /> : <Video size={28} />}</div>
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
