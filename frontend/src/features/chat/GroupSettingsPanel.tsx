import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowLeft, ChevronRight, Copy, Crown, LogOut, MoreHorizontal, PencilLine, ShieldCheck, ShieldOff, UserMinus, UserPlus, UserCheck, UsersRound, X } from 'lucide-react'
import type { GroupMember, Conversation } from './types'
import type { FriendConnection } from '../contacts/types'
import UserAvatar from '../../shared/ui/UserAvatar'
import GroupGovernancePanel from './GroupGovernancePanel'

type Props = {
  activeGroupMember: GroupMember | null
  setGroupSettingsOpen: (open: boolean) => void
  canManageActiveGroup: boolean
  canInviteActiveGroup: boolean
  canEditActiveGroup: boolean
  onRenameRequest: () => void
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
  setGroupSettingsOpen,
  canManageActiveGroup,
  canInviteActiveGroup,
  canEditActiveGroup,
  onRenameRequest,
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
  const menuRef = useRef<HTMLDivElement>(null)

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
      {canManageActiveGroup && (
        <div className="group-admin-tools">
          {canEditActiveGroup && <button type="button" className="group-rename-trigger"
            onClick={onRenameRequest} disabled={groupBusy}>
            <PencilLine size={17} aria-hidden="true" /> Đổi tên nhóm
          </button>}

          {canInviteActiveGroup && <div className="group-invite-friends">
            <div className="group-invite-title">
              <strong>Mời bạn bè</strong>
              <span>{groupInviteSelection.length ? `${groupInviteSelection.length} đã chọn` : 'Chọn trực tiếp từ danh bạ'}</span>
            </div>
            <input
              className="group-invite-search"
              type="search"
              value={groupInviteSearch}
              onChange={(event) => setGroupInviteSearch(event.target.value)}
              placeholder="Tìm bạn theo tên hoặc @username"
              autoComplete="off"
            />
            <div className="group-invite-list">
              {groupInviteCandidates.length === 0 && (
                <div className="group-invite-empty">
                  {friends.some((friend) => friend.status === 'accepted')
                    ? 'Không còn bạn phù hợp để thêm vào nhóm.'
                    : 'Chưa có bạn bè trong danh bạ để mời.'}
                </div>
              )}
              {groupInviteCandidates.map((friend) => {
                const selected = groupInviteSelection.includes(friend.id)
                return (
                  <button
                    key={friend.id}
                    type="button"
                    className={selected ? 'group-invite-friend selected' : 'group-invite-friend'}
                    aria-pressed={selected}
                    onClick={() => setGroupInviteSelection((current) =>
                      current.includes(friend.id)
                        ? current.filter((id) => id !== friend.id)
                        : [...current, friend.id])}
                  >
                    <UserAvatar
                      username={friend.username} name={friend.displayName || friend.username}
                      className="group-member-avatar"
                      online={friend.online}
                    />
                    <span>
                      <strong>{friend.displayName || friend.username}</strong>
                      <small>@{friend.username}</small>
                    </span>
                    <span className="group-invite-check" aria-hidden="true">✓</span>
                  </button>
                )
              })}
            </div>
          </div>}

          {canInviteActiveGroup && <button
            type="button"
            className="group-invite-submit"
            onClick={() => void inviteGroupMembers()}
            disabled={groupBusy || groupInviteSelection.length === 0}
          >
            {`Thêm ${groupInviteSelection.length} bạn vào nhóm`}
          </button>}
        </div>
      )}

      <button type="button" className="group-members-preview"
        aria-label={`Xem danh sách ${groupMembers.length} thành viên nhóm`}
        onClick={() => setMemberViewOpen(true)}>
        <span className="group-members-preview-icon"><UsersRound size={21} aria-hidden="true" /></span>
        <span className="group-members-preview-copy">
          <strong>Thành viên nhóm</strong>
          <small>{groupMembers.length} thành viên</small>
        </span>
        <span className="group-members-preview-open">Xem <ChevronRight size={17} aria-hidden="true" /></span>
      </button>
      {activeGroupMember && <GroupGovernancePanel
        conversationId={activeConversation.id}
        role={activeGroupMember.role}
        request={request}
        notify={notify}
        onMembersChanged={onMembersChanged}
      />}
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