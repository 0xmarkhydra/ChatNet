import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowLeft, Bell, Check, ChevronRight, Clock3, FileText, Files, Info, ScrollText, Search, ShieldCheck, UserPlus, UsersRound, X } from 'lucide-react'
import type { GroupMember, Conversation } from '../types'
import type { FriendConnection } from '../../contacts'
import UserAvatar from '../../../shared/ui/UserAvatar'
import GroupGovernancePanel from './GroupGovernancePanel'
import GroupManagementDetails from './GroupManagementDetails'
import GroupMemberDirectory from './GroupMemberDirectory'
import '../styles/group-management-workspace.css'

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

export default function GroupSettingsPanel(props: Props) {
  return <GroupSettingsPanelScope key={JSON.stringify([props.activeConversation.id, props.initialSection ?? 'members'])} {...props} />
}

function GroupSettingsPanelScope({
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
  const [activeSection, setActiveSection] = useState<GroupManagementSection>(initialSection)
  const [memberSearch, setMemberSearch] = useState('')
  const inviting = useRef(false)

  async function submitInvites() {
    if (inviting.current || groupBusy || groupInviteSelection.length === 0) return
    inviting.current = true
    try {
      await inviteGroupMembers()
    } finally {
      inviting.current = false
    }
  }
  const filteredMembers = groupMembers.filter(member => `${member.displayName} ${member.username}`.toLocaleLowerCase('vi-VN').includes(memberSearch.trim().toLocaleLowerCase('vi-VN')))
  const isOwner = activeGroupMember?.role === 'owner'
  const isManager = activeGroupMember?.role === 'owner' || activeGroupMember?.role === 'admin'


  return (
    <section className="group-settings-panel" role="region" aria-label="Quản lý nhóm">
      <div className="group-settings-heading">
        {memberViewOpen && <button type="button" className="group-member-back" autoFocus onClick={() => { setMemberViewOpen(false) }} aria-label="Quay lại quản lý nhóm"><ArrowLeft size={20} /></button>}
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
              onClick={() => { setActiveSection(id); setMemberSearch('') }}>
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
            onClick={() => setMemberViewOpen(true)}>
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
              onClick={() => void submitInvites()} disabled={groupBusy || !groupInviteSelection.length}>
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

      {memberViewOpen && <GroupMemberDirectory
        key={activeConversation.id}
        activeGroupMember={activeGroupMember} canManageActiveGroup={canManageActiveGroup}
        onOpenMemberProfile={onOpenMemberProfile} memberFriendRelationship={memberFriendRelationship}
        onMemberFriendAction={onMemberFriendAction} friendBusyIds={friendBusyIds}
        setMemberViewOpen={setMemberViewOpen} groupBusy={groupBusy}
        groupMembers={groupMembers} userId={userId}
        changeGroupMemberRole={changeGroupMemberRole} removeGroupMember={removeGroupMember}
        notify={notify}
      />}
    </section>
  )
}