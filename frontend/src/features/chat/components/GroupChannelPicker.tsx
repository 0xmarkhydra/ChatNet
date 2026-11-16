import { useEffect, useRef, type FormEvent } from 'react'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import { ChevronDown, Hash, Plus, X } from 'lucide-react'
import type { GroupChannel } from '../utils/groupChannels'
import '../styles/group-channel-picker.css'

type Props = {
  conversationId: number
  channels: GroupChannel[]
  selectedId: number
  canCreate: boolean
  busy: boolean
  onSelect: (id: number) => void
  onCreate: (name: string, description: string) => Promise<boolean>
}

export default function GroupChannelPicker({ conversationId, channels, selectedId, canCreate, busy, onSelect, onCreate }: Props) {
  const [open, setOpen] = useScopedState(conversationId, false)
  const [creating, setCreating] = useScopedState(conversationId, false)
  const [name, setName] = useScopedState(conversationId, '')
  const [description, setDescription] = useScopedState(conversationId, '')
  const root = useRef<HTMLDivElement>(null)
  const selected = channels.find(channel => channel.id === selectedId)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setCreating(false) } }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setCreating(false) } }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open, setOpen, setCreating])

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!canCreate || busy || !name.trim()) return
    if (await onCreate(name.trim(), description.trim())) {
      setName('')
      setDescription('')
      setCreating(false)
      setOpen(false)
    }
  }

  return (
    <div className="group-channel-picker" ref={root}>
      <div className="group-channel-current">
        <Hash size={14} className="group-channel-current-hash" aria-hidden="true" />
        <span className="group-channel-current-name" title={selected?.name || 'Thảo luận chung'}>
          {selected?.name || 'Thảo luận chung'}
        </span>
        <button type="button" className="group-channel-selector"
          aria-label={'Chọn kênh hội thoại: ' + (selected?.name || 'Thảo luận chung')}
          aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {open && <div className="group-channel-dropdown" role="menu" aria-label="Danh sách kênh hội thoại">
        <div className="group-channel-dropdown-heading">
          <strong className="group-channel-dropdown-title">Kênh hội thoại</strong>
          <small>Chọn kênh để chuyển cuộc trò chuyện</small>
        </div>
        {channels.map(channel => <button key={channel.id} type="button" role="menuitemradio"
          aria-checked={channel.id === selectedId} className={channel.id === selectedId ? 'selected' : ''}
          onClick={() => { onSelect(channel.id); setOpen(false); setCreating(false) }}>
          <Hash size={16} aria-hidden="true" /><span>{channel.name}</span>
          {channel.unreadCount > 0 && <b className="group-channel-menu-unread" aria-hidden="true">{channel.unreadCount > 99 ? '99+' : channel.unreadCount}</b>}
          {channel.id === selectedId && <span aria-hidden="true">✓</span>}
        </button>)}
        {canCreate && <div className="group-channel-creator">
          {!creating ? <button type="button" className="group-channel-create-trigger"
            onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" />Tạo kênh hội thoại</button> : (
            <form className="group-channel-create-form" onSubmit={event => void create(event)}>
              <div className="group-channel-create-heading">
                <div className="group-channel-create-intro">
                  <span className="group-channel-create-symbol"><Hash size={17} aria-hidden="true" /></span>
                  <div>
                    <strong>Tạo kênh hội thoại</strong>
                    <small>Chủ nhóm tạo kênh để thảo luận theo chủ đề.</small>
                  </div>
                </div>
                <button type="button" className="group-channel-create-close"
                  aria-label="Đóng tạo kênh" onClick={() => setCreating(false)}>
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
              <label className="group-channel-create-field">
                <span>Tên kênh <b aria-hidden="true">*</b></span>
                <input autoFocus required aria-label="Tên kênh mới" placeholder="Ví dụ: Thảo luận dự án"
                  maxLength={80} value={name} onChange={event => setName(event.target.value)} />
              </label>
              <label className="group-channel-create-field">
                <span>Mô tả <small>(không bắt buộc)</small></span>
                <textarea aria-label="Mô tả kênh mới" rows={3}
                  placeholder="Kênh này dành cho nội dung gì?"
                  maxLength={500} value={description}
                  onChange={event => setDescription(event.target.value)} />
              </label>
              <div className="group-channel-create-actions">
                <button type="button" className="group-channel-create-cancel"
                  onClick={() => setCreating(false)} disabled={busy}>Hủy</button>
                <button type="submit" className="group-channel-create-submit" disabled={busy || !name.trim()}>
                  <Plus size={15} aria-hidden="true" />
                  {busy ? 'Đang tạo...' : 'Tạo kênh'}
                </button>
              </div>
            </form>
          )}
        </div>}
      </div>}
    </div>
  )
}