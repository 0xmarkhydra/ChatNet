import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Copy, Crown, LogOut, MoreHorizontal, ShieldCheck, ShieldOff, UserMinus, UserPlus, UserCheck } from 'lucide-react'
import type { GroupMember } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'

export type GroupMemberDirectoryProps = {
  activeGroupMember: GroupMember | null
  canManageActiveGroup: boolean
  onOpenMemberProfile: (username: string) => void
  memberFriendRelationship: (userId: number) => 'none' | 'accepted' | 'incoming' | 'outgoing'
  onMemberFriendAction: (member: GroupMember) => Promise<void>
  friendBusyIds: Set<number>
  setMemberViewOpen: (open: boolean) => void
  groupBusy: boolean
  groupMembers: GroupMember[]
  userId: number
  changeGroupMemberRole: (member: GroupMember, role: GroupMember['role']) => Promise<void>
  removeGroupMember: (member: GroupMember) => Promise<void>
  notify: (message: string) => void
}

export default function GroupMemberDirectory({
  activeGroupMember, canManageActiveGroup, onOpenMemberProfile, memberFriendRelationship, onMemberFriendAction, friendBusyIds, setMemberViewOpen, groupBusy, groupMembers, userId, changeGroupMemberRole, removeGroupMember, notify
}: GroupMemberDirectoryProps) {
  const trUi = useUiTranslation()

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
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation() // Escape navigates this sidebar view before closing the whole sidebar.
      if (openMemberMenu !== null) setOpenMemberMenu(null)
      else setMemberViewOpen(false)
    }
    document.addEventListener('keydown', onEscape, true)
    return () => document.removeEventListener('keydown', onEscape, true)
  }, [openMemberMenu, setMemberViewOpen])

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
      <div className="group-member-directory" aria-label={trUi("common.ui.groupMemberList")}>
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
              aria-label={trUi("common.ui.profileNamed", { v1: String(member.displayName || member.username) })}>
              <UserAvatar username={member.username} name={member.displayName || member.username}
                className="group-member-avatar" online={member.online} />
              <span className="group-member-copy">
                <strong>{member.displayName || member.username}{isSelf ? ' · Bạn' : ''}</strong>
                <span>{member.role === 'owner' ? trUi("chat.owner") : member.role === 'admin' ? trUi("chat.admin") : trUi("chat.members")}
                  {member.online ? ' · online' : ''}</span>
              </span>
            </button>
            <div className="group-member-menu-anchor" ref={menuOpen ? menuRef : null}>
              <button type="button" className="group-member-more"
                aria-label={trUi("common.ui.optionsNamed", { v1: String(member.displayName || member.username) })}
                aria-expanded={menuOpen} aria-haspopup="menu"
                onClick={() => {
                  if (!menuOpen) setMenuDirection('down')
                  setOpenMemberMenu(menuOpen ? null : member.id)
                }}>
                <MoreHorizontal size={20} aria-hidden="true" />
              </button>
              {menuOpen && <div className={menuDirection === 'up' ? 'group-member-menu open-up' : 'group-member-menu'} role="menu" aria-label={trUi("common.ui.optionsNamed", { v1: String(member.displayName || member.username) })}>
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
                        : trUi("contacts.addFriend")}
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
                    <Crown size={16} aria-hidden="true" />{trUi("chat.transferOwner")}</button>
                </>}
                {canRemove && <button type="button" role="menuitem" className="danger" disabled={groupBusy}
                  onClick={() => { setOpenMemberMenu(null); void removeGroupMember(member) }}>
                  <UserMinus size={16} aria-hidden="true" />{trUi("chat.removeMember")}</button>}
                {canLeave && <button type="button" role="menuitem" className="danger" disabled={groupBusy}
                  onClick={() => { setOpenMemberMenu(null); void removeGroupMember(member) }}>
                  <LogOut size={16} aria-hidden="true" />{trUi("chat.leaveGroup")}</button>}
              </div>}
            </div>
          </div>
        })}
      </div>
  )
}
