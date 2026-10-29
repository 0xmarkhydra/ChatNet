import type { Dispatch, SetStateAction } from 'react'
import { X } from 'lucide-react'
import type { GroupMember, Conversation } from './types'
import type { FriendConnection } from '../contacts/types'
import UserAvatar from '../../shared/ui/UserAvatar'

type Props = {
  activeGroupMember: GroupMember | null
  setGroupSettingsOpen: (open: boolean) => void
  canManageActiveGroup: boolean
  groupNameDraft: string
  setGroupNameDraft: (value: string) => void
  renameActiveGroup: () => Promise<void>
  groupBusy: boolean
  activeConversation: Conversation
  groupInviteSelection: number[]
  groupInviteSearch: string
  setGroupInviteSearch: (value: string) => void
  groupInviteCandidates: FriendConnection[]
  friends: FriendConnection[]
  setGroupInviteSelection: Dispatch<SetStateAction<number[]>>
  groupInviteDraft: string
  setGroupInviteDraft: (value: string) => void
  inviteGroupMembers: () => Promise<void>
  groupMembers: GroupMember[]
  userId: number
  changeGroupMemberRole: (member: GroupMember, role: GroupMember['role']) => Promise<void>
  removeGroupMember: (member: GroupMember) => Promise<void>
}

export default function GroupSettingsPanel({
  activeGroupMember,
  setGroupSettingsOpen,
  canManageActiveGroup,
  groupNameDraft,
  setGroupNameDraft,
  renameActiveGroup,
  groupBusy,
  activeConversation,
  groupInviteSelection,
  groupInviteSearch,
  setGroupInviteSearch,
  groupInviteCandidates,
  friends,
  setGroupInviteSelection,
  groupInviteDraft,
  setGroupInviteDraft,
  inviteGroupMembers,
  groupMembers,
  userId,
  changeGroupMemberRole,
  removeGroupMember,
}: Props) {
  return (
    <section className="group-settings-panel" role="region" aria-label="Quản lý nhóm">
      <div className="group-settings-heading">
        <div>
          <strong>Quản lý nhóm</strong>
          <small>
            {activeGroupMember
              ? activeGroupMember.role === 'owner'
                ? 'Bạn là chủ nhóm'
                : activeGroupMember.role === 'admin'
                  ? 'Bạn là quản trị viên'
                  : 'Bạn là thành viên'
              : 'Đang tải quyền...'}
          </small>
        </div>
        <button type="button" onClick={() => setGroupSettingsOpen(false)} aria-label="Quay lại cuộc trò chuyện">
          <X size={21} aria-hidden="true" />
        </button>
      </div>

      {canManageActiveGroup && (
        <div className="group-admin-tools">
          <div className="group-tool-row">
            <input
              value={groupNameDraft}
              onChange={(event) => setGroupNameDraft(event.target.value)}
              placeholder="Tên nhóm"
              maxLength={120}
            />
            <button
              type="button"
              onClick={() => void renameActiveGroup()}
              disabled={groupBusy || !groupNameDraft.trim() || groupNameDraft.trim() === activeConversation.name}
            >
              Đổi tên
            </button>
          </div>

          <div className="group-invite-friends">
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
          </div>

          <div className="group-tool-row">
            <input
              value={groupInviteDraft}
              onChange={(event) => setGroupInviteDraft(event.target.value)}
              placeholder="Hoặc nhập @username"
            />
            <button
              type="button"
              onClick={() => void inviteGroupMembers()}
              disabled={groupBusy || (!groupInviteDraft.trim() && groupInviteSelection.length === 0)}
            >
              {groupInviteSelection.length > 0 ? `Thêm ${groupInviteSelection.length}` : 'Thêm'}
            </button>
          </div>
        </div>
      )}

      <div className="group-members-heading">
        <strong>Thành viên nhóm</strong>
        <span>{groupMembers.length} thành viên</span>
      </div>
      <div className="group-member-list">
        {groupMembers.map((member) => (
          <div className="group-member-row" key={member.id}>
            <UserAvatar username={member.username} name={member.displayName || member.username} className="group-member-avatar" online={member.online} />
            <div className="group-member-copy">
              <strong>{member.displayName || member.username}{member.id === userId ? ' · Bạn' : ''}</strong>
              <span>
                {member.role === 'owner' ? 'Chủ nhóm' : member.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                {member.online ? ' · online' : ''}
              </span>
            </div>
            <div className="group-member-actions">
              {activeGroupMember?.role === 'owner' && member.id !== userId && member.role !== 'owner' && (
                <>
                  <button
                    type="button"
                    onClick={() => void changeGroupMemberRole(member, member.role === 'admin' ? 'member' : 'admin')}
                    disabled={groupBusy}
                  >
                    {member.role === 'admin' ? 'Gỡ admin' : 'Đặt admin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void changeGroupMemberRole(member, 'owner')}
                    disabled={groupBusy}
                  >
                    Chuyển chủ
                  </button>
                </>
              )}
              {canManageActiveGroup &&
                member.id !== userId &&
                member.role !== 'owner' &&
                !(activeGroupMember?.role === 'admin' && member.role === 'admin') && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void removeGroupMember(member)}
                    disabled={groupBusy}
                  >
                    Xóa
                  </button>
                )}
              {member.id === userId && member.role !== 'owner' && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => void removeGroupMember(member)}
                  disabled={groupBusy}
                >
                  Rời nhóm
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}