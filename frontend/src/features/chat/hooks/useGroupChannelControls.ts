import { useEffect, useState } from 'react'
import type { GroupChannel } from '../utils/groupChannels'

export type GroupChannelControlsProps = {
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


export function useGroupChannelControls({
  groupId, groupName, channel, userId, canLeave, request, notify,
  onGroupRenamed, onChannelsChanged, onChannelDeleted, onLeftGroup,
  scope = 'all', onGroupNotificationChanged, hideGroupNotification = false,
}: GroupChannelControlsProps) {
  const [groupNotifications, setGroupNotifications] = useState<GroupNotifications | null>(null)
  const [channelMuted, setChannelMuted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
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
    const mute = groupNotifications.messageNotifications
    void perform(async () => {
      const result = await readResponse(await request('/api/conversations/' + groupId + '/notification-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageNotifications: !mute, mentionNotifications: groupNotifications.mentionNotifications }),
      }), 'Không cập nhật được thông báo nhóm.') as GroupNotifications
      setGroupNotifications(result)
      onGroupNotificationChanged?.(!result.messageNotifications)
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

  const groupMuted = groupNotifications !== null && !groupNotifications.messageNotifications


  return { groupNotifications, channelMuted, busy, error, groupMuted, renameGroup, renameChannel,
    editChannelTopic, toggleGroupNotifications, toggleChannelNotifications, deleteChannel, leaveGroup }
}
