import { useEffect, useState } from 'react'
import type { Message } from '../types'
import { getCommunity, getNotificationSettings, saveNotificationSettings, updateCommunity } from '../api/community'
import { listSharedFiles } from '../api/search'
import { useLatest } from '../../../shared/hooks/useLatest'

export type GroupManagementSection = 'details' | 'rules' | 'notifications' | 'files'
export type Community = {
  id: number
  name: string
  description: string
  topic: string
  rules: string
  visibility: 'public' | 'private'
  memberCount: number
}
export type Preferences = { messageNotifications: boolean; mentionNotifications: boolean }
export type GroupManagementDetailsProps = {
  conversationId: number
  section: GroupManagementSection
  canEdit: boolean
  request: (path: string, init?: RequestInit) => Promise<Response>
  notify: (text: string) => void
  onOpenShared: () => void
}
const initialCommunity: Community = {
  id: 0, name: '', description: '', topic: '', rules: '', visibility: 'private', memberCount: 0,
}
const initialPreferences: Preferences = { messageNotifications: true, mentionNotifications: true }


export function useGroupManagementDetails({ conversationId, section, canEdit, request, notify }: Omit<GroupManagementDetailsProps, 'onOpenShared'>) {
  const requestRef = useLatest(request)
  const [community, setCommunity] = useState<Community>(initialCommunity)
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences)
  const [files, setFiles] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    // GroupSettingsPanel keys this component by conversation and section.
    // Initial loading/error state already applies to each new mount.
    const load = section === 'details' || section === 'rules'
      ? getCommunity
      : section === 'notifications'
        ? getNotificationSettings
        : listSharedFiles
    void load(requestRef.current, conversationId, ctrl.signal).then(async response => {
      if (!response.ok) throw new Error('Không thể tải dữ liệu của mục này.')
      const data = await response.json() as unknown
      if (ctrl.signal.aborted) return
      if (section === 'details' || section === 'rules') {
        const entry = data as Community
        setCommunity({
          ...initialCommunity,
          ...entry,
          description: entry.description || '',
          topic: entry.topic || '',
          rules: entry.rules || '',
        })
      } else if (section === 'notifications') {
        setPreferences({ ...initialPreferences, ...(data as Preferences) })
      } else {
        const entries = (data as { items?: Message[] }).items
        setFiles(Array.isArray(entries) ? entries : [])
      }
    }).catch(() => {
      if (!ctrl.signal.aborted) setError('Không tải được dữ liệu. Hãy thử mở lại mục này.')
    }).finally(() => {
      if (!ctrl.signal.aborted) setLoading(false)
    })
    return () => ctrl.abort()
  }, [conversationId, requestRef, section])

  async function saveCommunity() {
    if (busy || !canEdit) return
    setBusy(true)
    setError('')
    try {
      const response = await updateCommunity(requestRef.current, conversationId, {
        description: community.description,
        topic: community.topic,
        rules: community.rules,
        visibility: community.visibility,
      })
      if (!response.ok) throw new Error('Không lưu được thông tin cộng đồng.')
      setCommunity({ ...community, ...(await response.json() as Community) })
      notify(section === 'rules' ? 'Đã lưu nội quy nhóm.' : 'Đã lưu thông tin cộng đồng.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Thao tác không thành công.')
    } finally {
      setBusy(false)
    }
  }

  async function saveNotifications() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await saveNotificationSettings(requestRef.current, conversationId, preferences)
      if (!response.ok) throw new Error('Không lưu được tùy chọn thông báo.')
      setPreferences(await response.json() as Preferences)
      notify('Đã cập nhật thông báo nhóm.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Thao tác không thành công.')
    } finally {
      setBusy(false)
    }
  }

  return { community, setCommunity, preferences, setPreferences, files, loading, busy, error, saveCommunity, saveNotifications }
}
