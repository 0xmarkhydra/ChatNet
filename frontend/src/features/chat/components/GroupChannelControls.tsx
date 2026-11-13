import { useEffect, useState } from 'react'
import { Bell, BellOff, ChevronRight, FileText, LogOut, Pencil, Trash2 } from 'lucide-react'
import type { GroupChannel } from '../utils/groupChannels'

type Props = {
  groupId: number
  groupName: string
  channel: GroupChannel
  userId: number
  canEdit: boolean
  canLeave: boolean
  request: (path: string, init?: RequestInit) => Promise<Response>
  notify: (message: string, kind?: 'success' | 'error' | 'warning') => void
  onGroupRenamed: (name: string) => void
  onChannelsChanged: () => Promise<void>
  onChannelDeleted: () => Promise<void>
  onLeftGroup: () => void
  scope?: 'all' | 'group' | 'channel'
  onGroupNotificationChanged?: (muted: boolean) => void
  hideGroupNotification?: boolean
}

type GroupNotifications = { messageNotifications: boolean; mentionNotifications: boolean }

async function readResponse(response: Response, fallback: string) {
  const json = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(json?.error || fallback)
  return json
}

export default function GroupChannelControls({
  groupId, groupName, channel, userId, canEdit, canLeave, request, notify,
  onGroupRenamed, onChannelsChanged, onChannelDeleted, onLeftGroup,
  scope = 'all', onGroupNotificationChanged, hideGroupNotification = false,
}: Props) {
  const [groupNotifications, setGroupNotifications] = useState<GroupNotifications | null>(null)
  const [channelMuted, setChannelMuted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    setGroupNotifications(null)
    setChannelMuted(null)
    setError('')
    const base = '/api/conversations/' + groupId
    async function load(path: string) {
      const response = await request(path, { signal: ctrl.signal, cache: 'no-store' })
      if (!response.ok) throw new Error('Không đọc được tùy chọn thông báo. Cần cập nhật backend.')
      return response.json()
    }
    const groupRequest = scope === 'channel' || hideGroupNotification ? Promise.resolve(null) :
      load(base + '/notification-settings') as Promise<GroupNotifications>
    const channelRequest = scope === 'group' ? Promise.resolve(null) :
      load(base + '/channels/' + channel.id + '/notifications') as Promise<{ muted: boolean }>
    void Promise.all([groupRequest, channelRequest]).then(([group, selected]) => {
      if (!ctrl.signal.aborted) {
        if (group) setGroupNotifications(group)
        if (selected) setChannelMuted(selected.muted)
      }
    }).catch(() => { if (!ctrl.signal.aborted) setError('Không tải được trạng thái thông báo. Hãy mở lại bảng thông tin.') })
    return () => ctrl.abort()
  }, [groupId, channel.id, request, scope, hideGroupNotification])

  async function perform(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await action() }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Thao tác không thành công.'
      setError(message)
      notify(message, 'error')
    } finally { setBusy(false) }
  }

  function renameGroup() {
    const name = window.prompt('Đổi tên nhóm', groupName)?.trim()
    if (!name || name === groupName) return
    if (new TextEncoder().encode(name).length > 120) { setError('Tên nhóm tối đa 120 byte.'); return }
    void perform(async () => {
      await readResponse(await request('/api/conversations/' + groupId, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      }), 'Không đổi được tên nhóm.')
      onGroupRenamed(name)
      notify('Đã đổi tên nhóm.', 'success')
    })
  }

  function renameChannel() {
    if (channel.id === 0) return
    const name = window.prompt('Đổi tên kênh', channel.name)?.trim()
    if (!name || name === channel.name) return
    if (Array.from(name).length > 80) { setError('Tên kênh tối đa 80 ký tự.'); return }
    void perform(async () => {
      await readResponse(await request('/api/conversations/' + groupId + '/channels/' + channel.id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: channel.description }),
      }), 'Không đổi được tên kênh.')
      await onChannelsChanged()
      notify('Đã đổi tên kênh.', 'success')
    })
  }

  function editChannelTopic() {
    if (channel.id === 0) return
    const value = window.prompt('Sửa chủ đề kênh', channel.description || '')
    if (value === null) return
    const description = value.trim()
    if (description === channel.description) return
    if (Array.from(description).length > 500) {
      setError('Chủ đề kênh tối đa 500 ký tự.')
      return
    }
    void perform(async () => {
      await readResponse(await request('/api/conversations/' + groupId + '/channels/' + channel.id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: channel.name, description }),
      }), 'Không sửa được chủ đề kênh.')
      await onChannelsChanged()
      notify('Đã sửa chủ đề kênh.', 'success')
    })
  }

  function toggleGroupNotifications() {
    if (groupNotifications === null) return
    const mute = groupNotifications.messageNotifications || groupNotifications.mentionNotifications
    void perform(async () => {
      const result = await readResponse(await request('/api/conversations/' + groupId + '/notification-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageNotifications: !mute, mentionNotifications: !mute }),
      }), 'Không cập nhật được thông báo nhóm.') as GroupNotifications
      setGroupNotifications(result)
      onGroupNotificationChanged?.(!result.messageNotifications && !result.mentionNotifications)
      notify(mute ? 'Đã tắt thông báo nhóm.' : 'Đã bật thông báo nhóm.', 'success')
    })
  }

  function toggleChannelNotifications() {
    if (channelMuted === null) return
    const muted = !channelMuted
    void perform(async () => {
      await readResponse(await request('/api/conversations/' + groupId + '/channels/' + channel.id + '/notifications', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted }),
      }), 'Không cập nhật được thông báo kênh.')
      setChannelMuted(muted)
      await onChannelsChanged()
      notify(muted ? 'Đã tắt thông báo kênh.' : 'Đã bật thông báo kênh.', 'success')
    })
  }

  function deleteChannel() {
    if (channel.id === 0 || !window.confirm('Xóa kênh "' + channel.name + '"? Các thành viên sẽ không còn thấy kênh này.')) return
    void perform(async () => {
      await readResponse(await request('/api/conversations/' + groupId + '/channels/' + channel.id, {
        method: 'DELETE',
      }), 'Không xóa được kênh.')
      await onChannelDeleted()
      notify('Đã xóa kênh.', 'success')
    })
  }

  function leaveGroup() {
    if (!canLeave || !window.confirm('Bạn có chắc chắn muốn rời nhóm "' + groupName + '"?')) return
    void perform(async () => {
      await readResponse(await request('/api/conversations/' + groupId + '/members/' + userId, {
        method: 'DELETE',
      }), 'Không thể rời nhóm.')
      onLeftGroup()
      notify('Đã rời nhóm.', 'success')
    })
  }

  const groupMuted = groupNotifications !== null && !groupNotifications.messageNotifications && !groupNotifications.mentionNotifications

  return <>
    {error && <p role="alert" className="group-channel-controls-error">{error}</p>}
    {scope !== 'channel' && (scope === 'group' || channel.id === 0) && <>
      {canEdit && <button type="button" disabled={busy} onClick={renameGroup}>
        <Pencil size={19} aria-hidden="true" /><span>Đổi tên nhóm</span><ChevronRight size={16} aria-hidden="true" />
      </button>}
      {!hideGroupNotification && <button type="button" disabled={busy || groupNotifications === null} aria-pressed={groupMuted} onClick={toggleGroupNotifications}>
        {groupMuted ? <Bell size={19} aria-hidden="true" /> : <BellOff size={19} aria-hidden="true" />}
        <span>{groupMuted ? 'Bật thông báo nhóm' : 'Tắt thông báo nhóm'}</span><ChevronRight size={16} aria-hidden="true" />
      </button>}
    </>}
    {scope !== 'group' && <button type="button" disabled={busy || channelMuted === null} aria-pressed={channelMuted === true} onClick={toggleChannelNotifications}>
      {channelMuted ? <Bell size={19} aria-hidden="true" /> : <BellOff size={19} aria-hidden="true" />}
      <span>{channelMuted ? 'Bật thông báo kênh' : 'Tắt thông báo kênh'}</span><ChevronRight size={16} aria-hidden="true" />
    </button>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <button type="button" disabled={busy} onClick={renameChannel}>
      <Pencil size={19} aria-hidden="true" /><span>Đổi tên kênh</span><ChevronRight size={16} aria-hidden="true" />
    </button>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <button type="button" disabled={busy} onClick={editChannelTopic}>
      <FileText size={19} aria-hidden="true" /><span>Sửa chủ đề kênh</span><ChevronRight size={16} aria-hidden="true" />
    </button>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <button type="button" className="conversation-options-danger" disabled={busy} onClick={deleteChannel}>
      <Trash2 size={19} aria-hidden="true" /><span>Xóa kênh</span><ChevronRight size={16} aria-hidden="true" />
    </button>}
    {scope !== 'channel' && (scope === 'group' || channel.id === 0) && <button type="button" className="conversation-options-danger" disabled={busy || !canLeave}
      title={!canLeave ? 'Chủ nhóm cần chuyển quyền sở hữu trước khi rời.' : undefined} onClick={leaveGroup}>
      <LogOut size={19} aria-hidden="true" /><span>{canLeave ? 'Rời nhóm' : 'Rời nhóm (chuyển quyền chủ nhóm trước)'}</span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>}
  </>
}
