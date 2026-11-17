import { useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookUser, Clock3, Languages, PhoneCall, Search, UserRoundPlus, Users, UsersRound, X } from 'lucide-react'
import type { Conversation } from '../../chat'
import type { FriendConnection } from '../types'
import { CallCenter } from '../../calls'
import ContactCallConversationSection from './ContactCallConversationSection'
import '../styles/unified-contacts.css'

type Section = 'directory' | 'groups' | 'invitations' | 'overview' | 'calls' | 'translation'

type Props = {
  contactsContent: ReactNode
  conversations: Conversation[]
  friends: FriendConnection[]
  incomingRequests: number
  request: (path: string, init?: RequestInit) => Promise<Response>
  userId: number
  token: string
  targetLanguage: string
  friendQuery: string
  setFriendQuery: (value: string) => void
  onOpenChat: (id: number) => void
  onNavigate: (tab: 'feed' | 'chat' | 'contacts') => void
}

const navItems = [
  { id: 'directory', title: 'Danh sách bạn bè', Icon: BookUser },
  { id: 'groups', title: 'Danh sách nhóm', Icon: UsersRound },
  { id: 'invitations', title: 'Lời mời kết bạn', Icon: UserRoundPlus },
  { id: 'calls', title: 'Lịch sử cuộc gọi', Icon: PhoneCall },
  { id: 'overview', title: 'Khám phá bạn bè', Icon: Users },
  { id: 'translation', title: 'Dịch AI cuộc gọi', Icon: Languages },
] as const

const paths: Record<Section, string> = {
  directory: '/contacts',
  groups: '/contacts/groups',
  invitations: '/contacts/requests',
  calls: '/contacts/calls',
  overview: '/contacts/overview',
  translation: '/contacts/translation',
}

export function contactsSectionFromPath(pathname: string): Section {
  if (pathname === '/contacts/groups') return 'groups'
  if (pathname === '/contacts/requests') return 'invitations'
  if (pathname === '/contacts/overview') return 'overview'
  if (pathname === '/contacts/calls') return 'calls'
  if (pathname === '/contacts/translation') return 'translation'
  return 'directory'
}

export default function UnifiedContactsPage({
  contactsContent, conversations, friends, incomingRequests, request, userId, token,
  targetLanguage, friendQuery, setFriendQuery, onOpenChat, onNavigate,
}: Props) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const section = contactsSectionFromPath(pathname)
  const [groupQuery, setGroupQuery] = useState('')
  const normalizedGroupQuery = groupQuery.trim().toLocaleLowerCase('vi-VN')
  const navigateTo = (next: Section) => {
    if (next !== section) {
      setFriendQuery('')
      setGroupQuery('')
      navigate(paths[next])
    }
  }
  const groups = useMemo(() => conversations.filter(conversation => conversation.type === 'group' && conversation.name.toLocaleLowerCase('vi-VN').includes(normalizedGroupQuery)), [conversations, normalizedGroupQuery])
  const otherContacts = useMemo(() => {
    const usernames = new Set(friends.map(friend => friend.username.toLocaleLowerCase('vi-VN')))
    const userIds = new Set(friends.map(friend => friend.id))
    return conversations.filter(conversation => conversation.type === 'direct'
      && conversation.name.toLocaleLowerCase('vi-VN').includes(normalizedGroupQuery)
      && !(conversation.otherUsername && usernames.has(conversation.otherUsername.toLocaleLowerCase('vi-VN')))
      && !(conversation.otherUserId && userIds.has(conversation.otherUserId)))
  }, [conversations, friends, normalizedGroupQuery])
  const active = navItems.find(item => item.id === section)!
  const isCallSection = section === 'calls' || section === 'translation'

  return <section className="unified-contacts" aria-label="Danh bạ và cuộc gọi">
    <aside className="unified-contacts-nav" aria-label="Danh mục danh bạ">
      <div className="unified-contacts-nav-title"><BookUser size={21} aria-hidden="true" /><span>Danh bạ</span></div>
      <nav aria-label="Danh mục">
        {navItems.map(({ id, title, Icon }, index) => <button
          type="button" key={id}
          className={'unified-contacts-nav-item' + (section === id ? ' active' : '') + (index === 3 ? ' separated' : '')}
          aria-current={section === id ? 'page' : undefined}
          onClick={() => navigateTo(id)}
        >
          <Icon size={19} strokeWidth={1.85} aria-hidden="true" />
          <span>{title}</span>
          {id === 'invitations' && incomingRequests > 0 && <small className="unified-contacts-count">{incomingRequests > 99 ? '99+' : incomingRequests}</small>}
        </button>)}
      </nav>
    </aside>
    <div className="unified-contacts-main">
      <header className="unified-contacts-heading">
        <div><h1>{active.title}</h1><p>{isCallSection ? 'Xem và quản lý cuộc gọi ngay trong danh bạ' : section === 'groups' ? 'Nhóm và các liên hệ từ hội thoại' : 'Kết nối, trò chuyện và gọi cho mọi người'}</p></div>
        {section === 'calls' && <span className="unified-contacts-heading-note"><Clock3 size={15} /> Gần đây</span>}
      </header>
      <div className={'unified-contacts-content' + (isCallSection ? ' is-calls' : '')}>
        {isCallSection ? <CallCenter
          embedded
          contactMode={section === 'calls' ? 'history' : 'settings'}
          onContactModeChange={next => navigateTo(next === 'history' ? 'calls' : next === 'directory' ? 'directory' : 'translation')}
          request={request}
          userId={userId}
          token={token}
          conversations={conversations}
          targetLanguage={targetLanguage}
          directoryContent={contactsContent}
          directoryQuery={friendQuery}
          onDirectoryQueryChange={setFriendQuery}
          onDirectoryOpen={() => navigateTo('directory')}
          onNavigate={onNavigate}
          onOpenChat={onOpenChat}
        /> : section === 'groups' ? <div className="unified-contacts-groups">
          <label className="unified-contacts-group-search">
            <Search size={18} aria-hidden="true" />
            <input value={groupQuery} onChange={event => setGroupQuery(event.target.value)}
              placeholder="Tìm nhóm hoặc liên hệ..." aria-label="Tìm nhóm và liên hệ" />
            {groupQuery && <button type="button" aria-label="Xóa tìm kiếm nhóm"
              onClick={() => setGroupQuery('')}><X size={16} /></button>}
          </label>
          <ContactCallConversationSection label="Nhóm của bạn" items={groups} onOpenCallChat={onOpenChat} />
          <ContactCallConversationSection label="Liên hệ khác" items={otherContacts} onOpenCallChat={onOpenChat} />
          {groups.length === 0 && otherContacts.length === 0 && <div className="unified-contacts-empty">
            <UsersRound size={32} aria-hidden="true" />
            <strong>{groupQuery ? 'Không có kết quả phù hợp' : 'Chưa có nhóm hoặc liên hệ khác'}</strong>
            <p>{groupQuery ? 'Hãy thử từ khóa khác.' : 'Nhóm và người bạn từng trò chuyện sẽ hiển thị tại đây.'}</p>
          </div>}
        </div> : contactsContent}
      </div>
    </div>
  </section>
}
