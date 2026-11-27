import { useUiTranslation } from '@/shared/i18n/locale'
import { useState } from 'react'
import { CalendarClock, ClipboardList, FileText, Pencil, Pin, Users } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui/dialog'
import { SocoEmptyState } from '@/shared/ui/SocoUI'
import UserAvatar from '@/shared/ui/UserAvatar'
import { ConversationOptionRow } from './ConversationManagementSection'
import { listContactMetadata, updateContactMetadata, toContactMetadataIndex, type PersonalContactMetadata } from '../../contacts'
import type { Conversation } from '../types'
import type { GroupActivity } from '../types/groupActivities'

type Contact = PersonalContactMetadata & { id: number }
const activityIcons = { poll: ClipboardList, note: FileText, reminder: CalendarClock }
const activityLabels = { poll: 'Bình chọn', note: 'Ghi chú', reminder: 'Nhắc hẹn' }
type CommonGroup = { id: number; name: string; memberCount: number }
type Props = {
  conversation: Conversation
  request: (path: string, init?: RequestInit) => Promise<Response>
  activities?: GroupActivity[]
  onActivity?: (id: number) => void
  onRefresh?: () => Promise<void>
  onContactSaved?: (id: number, metadata: PersonalContactMetadata) => void
  notify: (message: string, kind?: 'success' | 'error' | 'warning') => void
}
export default function ConversationExtraTools({ conversation, request, activities = [], onActivity, onRefresh, onContactSaved, notify }: Props) {
  const trUi = useUiTranslation()

  const [view, setView] = useState<'nickname' | 'groups' | 'board' | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [nickname, setNickname] = useState('')
  const [groups, setGroups] = useState<CommonGroup[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'poll' | 'note' | 'reminder'>('all')
  const group = conversation.type === 'group'
  const id = conversation.otherUserId
  async function open(next: 'nickname' | 'groups') {
    if (busy || !id) return
    if (view === next) { setView(null); return }
    setView(next); setBusy(true); setError(''); setContact(null); setGroups([])
    try {
      const response = next === 'nickname' ? await listContactMetadata(request) : await request('/api/contacts/' + id + '/common-groups', { cache: 'no-store' })
      if (!response.ok) throw new Error('Không tải được dữ liệu. Vui lòng thử lại.')
      const data = await response.json()
      if (!Array.isArray(data)) throw new Error('Dữ liệu không hợp lệ.')
      if (next === 'nickname') {
        const item = toContactMetadataIndex(data)?.[id]
        if (!item) throw new Error('Chỉ có thể đặt tên gợi nhớ cho bạn bè.')
        setContact({ id, ...item }); setNickname(item.nickname)
      } else setGroups(data as CommonGroup[])
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được dữ liệu.') }
    finally { setBusy(false) }
  }
  async function save() {
    if (!contact || busy) return
    setBusy(true); setError('')
    try {
      const next = { nickname: nickname.trim(), note: contact.note, favorite: contact.favorite }
      const response = await updateContactMetadata(request, contact.id, next)
      if (!response.ok) throw new Error('Không lưu được tên gợi nhớ.')
      onContactSaved?.(contact.id, next)
      await onRefresh?.()
      setView(null); notify('Đã cập nhật tên gợi nhớ.', 'success')
    } catch (e) { setError(e instanceof Error ? e.message : 'Không lưu được tên gợi nhớ.') }
    finally { setBusy(false) }
  }
  if (!group && (!id || conversation.blockedByMe || conversation.blockedByOther)) return null
  const title = view === 'nickname' ? 'Đặt tên gợi nhớ' : view === 'groups' ? 'Nhóm chung' : 'Bảng tin nhóm'
  const visible = activities.filter(item => filter === 'all' || item.kind === filter)
  return <>
    {group ? <ConversationOptionRow icon={<ClipboardList size={18}/>} aria-haspopup="dialog" onClick={() => setView('board')}>{trUi("chat.groupFeed")}</ConversationOptionRow> : <>
      <ConversationOptionRow icon={<Pencil size={18}/>} disabled={busy} aria-haspopup="dialog" onClick={() => void open('nickname')}>{trUi("chat.setNickname")}</ConversationOptionRow>
      <ConversationOptionRow icon={<Users size={18}/>} disabled={busy} aria-haspopup="dialog" onClick={() => void open('groups')}>{trUi("chat.mutualGroups")}</ConversationOptionRow>
    </>}
    <Dialog open={view !== null} onOpenChange={open => { if (!open) setView(null) }}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{view === 'nickname' ? 'Tên này chỉ hiển thị với tài khoản của bạn.' : view === 'groups' ? 'Các nhóm mà cả hai đang tham gia.' : 'Bình chọn, ghi chú và nhắc hẹn của nhóm.'}</DialogDescription>
        {busy && <p role="status" className="text-sm text-muted-foreground">{trUi("common.loading")}</p>}
        {error && <p role="alert" className="text-sm text-destructive wrap-anywhere">{error}</p>}
        {view === 'nickname' && contact && <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void save() }}>
          <div className="flex justify-center"><UserAvatar username={conversation.otherUsername} name={conversation.name} className="group-rename-avatar"/></div>
          <label className="grid gap-1 text-sm">{trUi("chat.nickname")}<Input aria-label={trUi("chat.nickname")} maxLength={60} value={nickname} disabled={busy} onChange={e => setNickname(e.target.value)} placeholder={trUi("common.ui.nicknamePlaceholder")}/></label>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setView(null)}>{trUi("common.cancel")}</Button><Button type="submit" disabled={busy}>{trUi("common.save")}</Button></DialogFooter>
        </form>}
        {view === 'groups' && !busy && !error && (groups.length ? <div className="group-member-directory max-h-[50dvh] overflow-y-auto">{groups.map(item => <div className="group-member-directory-row" key={item.id}>
          <div className="group-member-profile"><UserAvatar group name={item.name} className="group-member-avatar"/><span className="group-member-copy"><strong>{item.name}</strong><span>{item.memberCount} thành viên</span></span></div>
        </div>)}</div> : <SocoEmptyState kind="friends" title={trUi("chat.noMutualGroups")}/>)}
        {view === 'board' && <>
          <div className="flex flex-wrap gap-2" aria-label={trUi("chat.activityType")}>{(['all', 'poll', 'note', 'reminder'] as const).map(kind => <Button key={kind} size="sm" variant={filter === kind ? 'default' : 'outline'} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === 'all' ? trUi("common.all") : activityLabels[kind]}</Button>)}</div>
          {visible.length ? <ul className="grid max-h-[50dvh] gap-2 overflow-y-auto">{visible.map(item => {
            const Icon = activityIcons[item.kind]
            return <li key={item.id}><button className="group-activity-marker w-full text-left" type="button" onClick={() => { setView(null); onActivity?.(item.id) }}><Icon size={18}/><span className="min-w-0 wrap-anywhere"><strong>{item.title || activityLabels[item.kind]}</strong> · {item.body || item.creatorName}{item.pinnedAt && <Pin size={14} aria-label={trUi("common.pinned")}/>}</span></button></li>
          })}</ul> : <SocoEmptyState kind="chat" title={trUi("chat.noActivity")}/>}
        </>}
      </DialogContent>
    </Dialog>
  </>
}