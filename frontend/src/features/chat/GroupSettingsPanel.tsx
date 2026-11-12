import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowLeft, Bell, Check, ChevronRight, Clock3, Copy, Crown, FileText, Files, Info, LogOut, MoreHorizontal, ScrollText, Search, ShieldCheck, ShieldOff, UserMinus, UserPlus, UserCheck, UsersRound, X } from 'lucide-react'
import type { GroupMember, Conversation } from './types'
import type { FriendConnection } from '../contacts/types'
import UserAvatar from '../../shared/ui/UserAvatar'
import GroupGovernancePanel from './GroupGovernancePanel'
import GroupManagementDetails from './GroupManagementDetails'
import './group-management-workspace.css'

export type GroupManagementSection = 'members' | 'details' | 'permissions' | 'requests' | 'rules' | 'notifications' | 'files' | 'activity'

type Props = {
  initialSection?: GroupManagementSection
  activeGroupMember: GroupMember | null
  setGroupSettingsOpen: (open: boolean) => void
  canManageActiveGroup: boolean
  canInviteActiveGroup: boolean
  canEditGroup: boolean
  onOpenShared: () => void
  onOpenMemberProfile: (username: string) => void
  memberFriendRelationship: (userId: number) => 'none' | 'accepted' | 'incoming' | 'outgoing'
  onMemberFriendAction: (member: GroupMember) => Promise<void>
  friendBusyIds: Set<number>
  memberViewOpen: boolean
  setMemberViewOpen: (open: boolean) => void
  groupBusy: boolean
  activeConversation: Conversation
  groupInviteSelection: number[]
  groupInviteSearch: string
  setGroupInviteSearch: (value: string) => void
  groupInviteCandidates: FriendConnection[]
  friends: FriendConnection[]
  setGroupInviteSelection: Dispatch<SetStateAction<number[]>>
  inviteGroupMembers: () => Promise<void>
  groupMembers: GroupMember[]
  userId: number
  changeGroupMemberRole: (member: GroupMember, role: GroupMember['role']) => Promise<void>
  removeGroupMember: (member: GroupMember) => Promise<void>
  request: (path: string, init?: RequestInit) => Promise<Response>
  notify: (message: string) => void
  onMembersChanged: () => Promise<void>
}

export default function GroupSettingsPanel({
  activeGroupMember,
  initialSection = 'members',
  setGroupSettingsOpen,
  canManageActiveGroup,
  canInviteActiveGroup,
  canEditGroup,
  onOpenShared,
  onOpenMemberProfile,
  memberFriendRelationship,
  onMemberFriendAction,
  friendBusyIds,
  memberViewOpen,
  setMemberViewOpen,
  groupBusy,
  activeConversation,
  groupInviteSelection,
  groupInviteSearch,
  setGroupInviteSearch,
  groupInviteCandidates,
  friends,
  setGroupInviteSelection,
  inviteGroupMembers,
  groupMembers,
  userId,
  changeGroupMemberRole,
  removeGroupMember,
  request,
  notify,
  onMembersChanged,
}: Props) {
  const [openMemberMenu, setOpenMemberMenu] = useState<number | null>(null)
  const [menuDirection, setMenuDirection] = useState<'down' | 'up'>('down')
  const [activeSection, setActiveSection] = useState<GroupManagementSection>(initialSection)
  const [memberSearch, setMemberSearch] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setActiveSection(initialSection); setMemberSearch(''); setOpenMemberMenu(null) }, [activeConversation.id, initialSection])
  const filteredMembers = groupMembers.filter(member => `${member.displayName} ${member.username}`.toLocaleLowerCase('vi-VN').includes(memberSearch.trim().toLocaleLowerCase('vi-VN')))
  const isOwner = activeGroupMember?.role === 'owner'
  const isManager = activeGroupMember?.role === 'owner' || activeGroupMember?.role === 'admin'

  useEffect(() => {
    if (openMemberMenu === null) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpenMemberMenu(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [openMemberMenu])

  useLayoutEffect(() => {
    if (openMemberMenu === null) return
    const anchor = menuRef.current
    const menu = anchor?.querySelector<HTMLElement>('.group-member-menu')
    const scrollArea = anchor?.closest<HTMLElement>('.group-settings-panel')
    if (!anchor || !menu || !scrollArea) return

    // Prefer the original downward floating menu. Only flip it above the
    // three-dot trigger when there is not enough visible room underneath.
    const anchorBounds = anchor.getBoundingClientRect()
    const scrollBounds = scrollArea.getBoundingClientRect()
    const menuHeight = menu.getBoundingClientRect().height
    const availableBelow = scrollBounds.bottom - anchorBounds.bottom
    const availableAbove = anchorBounds.top - scrollBounds.top
    const shouldOpenUp = availableBelow < menuHeight + 4 && availableAbove > availableBelow
    setMenuDirection(shouldOpenUp ? 'up' : 'down')
  }, [openMemberMenu])

  useEffect(() => {
    if (!memberViewOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation() // Escape navigates this sidebar view before closing the whole sidebar.
      if (openMemberMenu !== null) setOpenMemberMenu(null)
      else setMemberViewOpen(false)
    }
    document.addEventListener('keydown', onEscape, true)
    return () => document.removeEventListener('keydown', onEscape, true)
  }, [memberViewOpen, openMemberMenu])

  async function copyMemberUsername(username: string) {
    setOpenMemberMenu(null)
    try {
      await navigator.clipboard.writeText('@' + username)
      notify('Đã sao chép @' + username)
    } catch {
      notify('Không sao chép được tên người dùng.')
    }
  }

  return (
    <section className="group-settings-panel" role="region" aria-label="Quản lý nhóm">
      <div className="group-settings-heading">
        {memberViewOpen && <button type="button" className="group-member-back" autoFocus onClick={() => { setMemberViewOpen(false); setOpenMemberMenu(null) }} aria-label="Quay lại quản lý nhóm"><ArrowLeft size={20} /></button>}
        <div>
          <strong>{memberViewOpen ? 'Thành viên nhóm' : 'Quản lý nhóm'}</strong>
          <small>{memberViewOpen ? `${groupMembers.length} thành viên` :
            activeGroupMember
              ? activeGroupMember.role === 'owner'
                ? 'Bạn là chủ nhóm'
                : activeGroupMember.role === 'admin'
                  ? 'Bạn là quản trị viên'
                  : 'Bạn là thành viên'
              : ''}
          </small>
        </div>
        <button type="button" className="sidebar-panel-close" autoFocus onClick={() => setGroupSettingsOpen(false)} aria-label="Đóng thanh quản lý nhóm">
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      {!memberViewOpen && <>
        <nav className="group-management-navigation" aria-label="Danh mục quản lý nhóm">
          {([
            ['members', 'Thành viên', UsersRound],
            ['details', 'Thông tin cộng đồng', Info],
            ['permissions', 'Quyền quản trị', ShieldCheck],
            ['requests', 'Yêu cầu tham gia', Clock3],
            ['rules', 'Nội quy nhóm', ScrollText],
            ['notifications', 'Thông báo', Bell],
            ['files', 'Tệp đã chia sẻ', Files],
            ['activity', 'Nhật ký hoạt động', FileText],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" className={activeSection === id ? 'active' : ''}
              aria-current={activeSection === id ? 'page' : undefined}
              onClick={() => { setActiveSection(id); setOpenMemberMenu(null); setMemberSearch('') }}>
              <Icon size={16} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>

        {activeSection === 'members' && <>
          <div className="group-management-section-title">
            <h3>Thành viên</h3>
            <p>{groupMembers.length} người · {groupMembers.filter(member => member.role !== 'member').length} quản trị viên</p>
          </div>
          <label className="group-management-search"><Search size={16} aria-hidden="true" />
            <input type="search" aria-label="Tìm thành viên trong nhóm" value={memberSearch}
              onChange={event => setMemberSearch(event.target.value)} placeholder="Tìm thành viên..." />
          </label>
          <div className="group-management-member-preview">
            {filteredMembers.slice(0, 5).map(member => (
              <button type="button" key={member.id} className="group-management-member-preview-row"
                onClick={() => onOpenMemberProfile(member.username)} aria-label={`Xem trang cá nhân ${member.displayName || member.username}`}>
                <UserAvatar username={member.username} name={member.displayName || member.username} className="group-member-avatar" online={member.online} />
                <span className="group-management-preview-copy">
                  <strong>{member.displayName || member.username}{member.id === userId ? ' · Bạn' : ''}</strong>
                  <small>{member.role === 'owner' ? 'Chủ nhóm' : member.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</small>
                </span>
                {member.role === 'owner' && <span className="group-management-owner-tag">Chủ nhóm</span>}
              </button>
            ))}
            {filteredMembers.length === 0 && <p className="group-management-empty">Không tìm thấy thành viên phù hợp.</p>}
          </div>
          <button type="button" className="group-members-preview" aria-label={`Xem danh sách ${groupMembers.length} thành viên nhóm`}
            onClick={() => { setMemberViewOpen(true); setOpenMemberMenu(null) }}>
            <span className="group-members-preview-icon"><UsersRound size={20} aria-hidden="true" /></span>
            <span className="group-members-preview-copy">
              <strong>Quản lý thành viên</strong><small>Xem tất cả và thao tác với từng người</small>
            </span>
            <span className="group-members-preview-open">Xem <ChevronRight size={17} aria-hidden="true" /></span>
          </button>

          {canInviteActiveGroup && <div className="group-admin-tools">
            <div className="group-invite-friends">
              <div className="group-invite-title"><strong>Mời bạn bè</strong>
                <span>{groupInviteSelection.length ? `${groupInviteSelection.length} đã chọn` : 'Chọn từ danh bạ'}</span>
              </div>
              <input className="group-invite-search" type="search" value={groupInviteSearch}
                onChange={event => setGroupInviteSearch(event.target.value)}
                placeholder="Tìm bạn theo tên hoặc @username" autoComplete="off" />
              <div className="group-invite-list">
                {groupInviteCandidates.length === 0 && <p className="group-invite-empty">Không còn bạn phù hợp để mời.</p>}
                {groupInviteCandidates.map(friend => {
                  const selected = groupInviteSelection.includes(friend.id)
                  return <button type="button" key={friend.id}
                    className={selected ? 'group-invite-friend selected' : 'group-invite-friend'}
                    aria-pressed={selected}
                    onClick={() => setGroupInviteSelection(current => current.includes(friend.id)
                      ? current.filter(id => id !== friend.id) : [...current, friend.id])}>
                    <UserAvatar username={friend.username} name={friend.displayName || friend.username}
                      className="group-member-avatar" online={friend.online} />
                    <span><strong>{friend.displayName || friend.username}</strong><small>@{friend.username}</small></span>
                    <span className="group-invite-check" aria-hidden="true">✓</span>
                  </button>
                })}
              </div>
            </div>
            <button type="button" className="group-invite-submit"
              onClick={() => void inviteGroupMembers()} disabled={groupBusy || !groupInviteSelection.length}>
              <UserPlus size={16} aria-hidden="true" /> Mời {groupInviteSelection.length} thành viên
            </button>
          </div>}

          <div className="group-management-permission-summary" aria-label="Quyền quản trị hiện tại">
            <h4><ShieldCheck size={17} aria-hidden="true" /> Quyền quản trị</h4>
            <p>Vai trò hiện tại: <strong>{isOwner ? 'Chủ nhóm' : activeGroupMember?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</strong></p>
            {([
              ['Duyệt thành viên mới', isManager],
              ['Mời thành viên', canInviteActiveGroup],
              ['Ghim tin nhắn', true],
              ['Quản lý kênh riêng', isOwner],
              ['Sửa thông tin cộng đồng', canEditGroup],
            ] as const).map(([label, allowed]) => <div className="group-management-permission-row" key={label}>
              <span className={allowed ? 'allowed' : ''} aria-label={allowed ? 'Có quyền' : 'Không có quyền'}>
                {allowed ? <Check size={13} /> : <X size={13} />}
              </span><span>{label}</span>
            </div>)}
          </div>
        </>}

        {(['permissions', 'requests', 'activity'] as const).includes(activeSection as 'permissions' | 'requests' | 'activity') && (
          <div className="group-management-section-body">
            {isManager && activeGroupMember
              ? <GroupGovernancePanel key={`${activeConversation.id}:${activeSection}`}
                  conversationId={activeConversation.id} role={activeGroupMember.role}
                  section={activeSection as 'permissions' | 'requests' | 'activity'}
                  request={request} notify={notify} onMembersChanged={onMembersChanged} />
              : <p className="group-management-empty"><ShieldCheck size={18} aria-hidden="true" />
                  Chỉ chủ nhóm hoặc quản trị viên mới có thể quản lý mục này.</p>}
          </div>
        )}

        {(['details', 'rules', 'notifications', 'files'] as const).includes(activeSection as 'details' | 'rules' | 'notifications' | 'files') && (
          <div className="group-management-section-body">
            <div className="group-management-section-title">
              <h3>{activeSection === 'details' ? 'Thông tin cộng đồng' : activeSection === 'rules' ? 'Nội quy nhóm' : activeSection === 'notifications' ? 'Thông báo' : 'Tệp đã chia sẻ'}</h3>
            </div>
            <GroupManagementDetails key={`${activeConversation.id}:${activeSection}`}
              conversationId={activeConversation.id}
              section={activeSection as 'details' | 'rules' | 'notifications' | 'files'}
              canEdit={canEditGroup} request={request} notify={notify} onOpenShared={onOpenShared} />
          </div>
        )}
      </>}

      {memberViewOpen && <div className="group-member-directory" aria-label="Danh sách thành viên nhóm">
        {groupMembers.map((member) => {
          const isSelf = member.id === userId
          const canSetRole = activeGroupMember?.role === 'owner' && !isSelf && member.role !== 'owner'
          const canRemove = canManageActiveGroup && !isSelf && member.role !== 'owner' &&
            !(activeGroupMember?.role === 'admin' && member.role === 'admin')
          const canLeave = isSelf && member.role !== 'owner'
          const menuOpen = openMemberMenu === member.id
          const relationship = memberFriendRelationship(member.id)
          const friendActionBusy = friendBusyIds.has(member.id)
          return <div className={menuOpen ? 'group-member-directory-row menu-open' : 'group-member-directory-row'} key={member.id}>
            <button type="button" className="group-member-profile"
              onClick={() => onOpenMemberProfile(member.username)}
              aria-label={`Xem trang cá nhân ${member.displayName || member.username}`}>
              <UserAvatar username={member.username} name={member.displayName || member.username}
                className="group-member-avatar" online={member.online} />
              <span className="group-member-copy">
                <strong>{member.displayName || member.username}{isSelf ? ' · Bạn' : ''}</strong>
                <span>{member.role === 'owner' ? 'Chủ nhóm' : member.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                  {member.online ? ' · online' : ''}</span>
              </span>
            </button>
            <div className="group-member-menu-anchor" ref={menuOpen ? menuRef : null}>
              <button type="button" className="group-member-more"
                aria-label={`Tùy chọn của ${member.displayName || member.username}`}
                aria-expanded={menuOpen} aria-haspopup="menu"
                onClick={() => {
                  if (!menuOpen) setMenuDirection('down')
                  setOpenMemberMenu(menuOpen ? null : member.id)
                }}>
                <MoreHorizontal size={20} aria-hidden="true" />
              </button>
              {menuOpen && <div className={menuDirection === 'up' ? 'group-member-menu open-up' : 'group-member-menu'} role="menu" aria-label={`Tùy chọn của ${member.displayName || member.username}`}>
                <button type="button" role="menuitem" onClick={() => void copyMemberUsername(member.username)}>
                  <Copy size={16} aria-hidden="true" /> Sao chép @username
                </button>
                {!isSelf && relationship !== 'accepted' && (
                  <button type="button" role="menuitem"
                    disabled={friendActionBusy || relationship === 'outgoing'}
                    onClick={() => {
                      setOpenMemberMenu(null)
                      void onMemberFriendAction(member)
                    }}>
                    {relationship === 'incoming'
                      ? <UserCheck size={16} aria-hidden="true" />
                      : <UserPlus size={16} aria-hidden="true" />}
                    {relationship === 'incoming'
                      ? 'Chấp nhận kết bạn'
                      : relationship === 'outgoing'
                        ? 'Đã gửi lời mời'
                        : 'Kết bạn'}
                  </button>
                )}
                {canSetRole && <>
                  <button type="button" role="menuitem" disabled={groupBusy}
                    onClick={() => { setOpenMemberMenu(null); void changeGroupMemberRole(member, member.role === 'admin' ? 'member' : 'admin') }}>
                    {member.role === 'admin' ? <ShieldOff size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
                    {member.role === 'admin' ? 'Gỡ quyền admin' : 'Đặt làm admin'}
                  </button>
                  <button type="button" role="menuitem" disabled={groupBusy}
                    onClick={() => { setOpenMemberMenu(null); void changeGroupMemberRole(member, 'owner') }}>
                    <Crown size={16} aria-hidden="true" /> Chuyển quyền chủ nhóm
                  </button>
                </>}
                {canRemove && <button type="button" role="menuitem" className="danger" disabled={groupBusy}
                  onClick={() => { setOpenMemberMenu(null); void removeGroupMember(member) }}>
                  <UserMinus size={16} aria-hidden="true" /> Xóa khỏi nhóm
                </button>}
                {canLeave && <button type="button" role="menuitem" className="danger" disabled={groupBusy}
                  onClick={() => { setOpenMemberMenu(null); void removeGroupMember(member) }}>
                  <LogOut size={16} aria-hidden="true" /> Rời nhóm
                </button>}
              </div>}
            </div>
          </div>
        })}
      </div>}
    </section>
  )
}