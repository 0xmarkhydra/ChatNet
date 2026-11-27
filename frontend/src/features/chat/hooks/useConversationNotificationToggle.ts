import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Conversation } from '../types'
import type { ToastKind } from '../../../shared/utils/toast'

/** Owns the single in-flight notification mutation used by the conversation rail. */
export function useConversationNotificationToggle({
  apiFetch,
  setConversations,
  setNotice,
}: {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
  setConversations: Dispatch<SetStateAction<Conversation[]>>
  setNotice: (message: string, kind?: ToastKind) => void
}) {
  const [notificationBusyId, setNotificationBusyId] = useState<number | null>(null)
  const busyRef = useRef(false)

  async function toggleConversationNotifications(conversation: Conversation, muteMinutes?: number) {
    if (busyRef.current) return
    busyRef.current = true
    setNotificationBusyId(conversation.id)
    try {
      const muted = Boolean(muteMinutes) || !conversation.muted
      const isGroup = conversation.type === 'group'
      let mentionNotifications = Boolean(muteMinutes) || !muted
      if (isGroup) {
        // Muting a group silences ordinary messages, not explicit @mentions.
        // Preserve an independently disabled mention preference.
        const currentResponse = await apiFetch('/api/conversations/' + conversation.id + '/notification-settings', { cache: 'no-store' })
        const current = await currentResponse.json().catch(() => null) as
          { mentionNotifications?: boolean; error?: string } | null
        if (!currentResponse.ok || typeof current?.mentionNotifications !== 'boolean') {
          throw new Error(current?.error || 'Không đọc được tùy chọn nhắc tên của nhóm.')
        }
        mentionNotifications = current.mentionNotifications
      }
      const response = await apiFetch('/api/conversations/' + conversation.id + '/notification-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageNotifications: muteMinutes ? true : !muted, mentionNotifications, ...(muteMinutes ? { muteMinutes } : {}) }),
      })
      const result = await response.json().catch(() => null) as
        { messageNotifications?: boolean; mentionNotifications?: boolean; error?: string } | null
      if (!response.ok || typeof result?.messageNotifications !== 'boolean') {
        throw new Error(result?.error || 'Không cập nhật được thông báo. Backend cần hỗ trợ thiết lập theo hội thoại.')
      }
      if (muteMinutes && result.messageNotifications) throw new Error('Backend chưa hỗ trợ tắt thông báo theo thời hạn.')
      const nextMuted = isGroup || muteMinutes ? !result.messageNotifications : !result.messageNotifications && !result.mentionNotifications
      setConversations(current => current.map(item =>
        item.id === conversation.id ? { ...item, muted: nextMuted } : item))
      setNotice(nextMuted ? 'Đã tắt thông báo hội thoại.' : 'Đã bật thông báo hội thoại.', 'success')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không cập nhật được thông báo.', 'error')
    } finally {
      busyRef.current = false
      setNotificationBusyId(null)
    }
  }

  return { notificationBusyId, toggleConversationNotifications }
}