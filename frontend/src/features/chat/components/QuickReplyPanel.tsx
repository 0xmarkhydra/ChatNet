import { useEffect, useRef, useState } from 'react'
import { ClipboardList, Pencil, Trash2, X } from 'lucide-react'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import '../styles/chat-mentions.css'
import type { ApiRequest } from '@/shared/types/api'

type Reply = { key: string; text: string }
export default function QuickReplyPanel({ request, query, managing, onClose, onSelect }: {
  request: ApiRequest; query: string | null; managing: boolean; onClose: () => void; onSelect: (text: string) => void
}) {
  const [items, setItems] = useState<Reply[]>([])
  const [key, setKey] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const opened = managing || query !== null
  // Both reset on every opening. loadError is null while loading, then '' or the message.
  const opening = opened ? 'open' : null
  const [loadError, setLoadError] = useScopedState<string | null>(opening, null)
  const [saveError, setSaveError] = useScopedState(opening, '')
  const busy = saving || (opened && loadError === null)
  const error = saveError || loadError || ''
  useEffect(() => {
    if (!opened) return
    let cancelled = false
    void request('/api/chat/quick-replies', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Không tải được tin nhắn nhanh. Backend cần được cập nhật.')
      const data = await response.json()
      if (!Array.isArray(data)) throw new Error('Dữ liệu không hợp lệ.')
      if (!cancelled) { setItems(data); setLoadError('') }
    }).catch(e => { if (!cancelled) setLoadError(e.message) })
    return () => { cancelled = true }
  }, [opened, request, setLoadError])
  async function mutate(remove: boolean, shortcut: string) {
    if (busy || !/^[a-z0-9_-]{1,32}$/.test(shortcut) || (!remove && !text.trim())) return
    setSaving(true); setSaveError(''); setLoadError('')
    try {
      const response = await request('/api/chat/quick-replies/' + shortcut, {
        method: remove ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' }, ...(!remove ? { body: JSON.stringify({ text }) } : {})
      })
      if (!response.ok) throw new Error('Không cập nhật được tin nhắn nhanh.')
      setItems(previous => [...previous.filter(item => item.key !== shortcut), ...(!remove ? [{ key: shortcut, text: text.trim() }] : [])].sort((a,b) => a.key.localeCompare(b.key)))
      setKey(''); setText('')
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Không cập nhật được tin nhắn nhanh.') }
    finally { setSaving(false) }
  }
  const matches = items.filter(item => managing || item.key.startsWith(query?.toLowerCase() ?? ''))
  const status = <>
    {busy && <p className="text-sm text-muted-foreground" role="status">Đang tải…</p>}
    {error && <p className="text-sm text-destructive wrap-anywhere" role="alert">{error}</p>}
    {!busy && !error && matches.length === 0 && <p className="text-sm text-muted-foreground">Chưa có mẫu phù hợp. Tạo mẫu trong menu +.</p>}
  </>
  const select = (item: Reply) => { onSelect(item.text); onClose() }
  return <>
    <Dialog open={managing} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent showCloseButton={false} onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus({ preventScroll: true }) }}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>Tin nhắn nhanh</DialogTitle>
            <DialogClose asChild><Button variant="ghost" size="icon" aria-label="Đóng tin nhắn nhanh" title="Đóng"><X size={18}/></Button></DialogClose>
          </div>
          <DialogDescription>Tạo mẫu nội dung để chèn vào ô soạn tin bằng /từ khóa.</DialogDescription>
        </DialogHeader>
        {status}
        <ul className="grid max-h-48 min-w-0 gap-2 overflow-auto" aria-label="Mẫu tin nhắn nhanh">
          {matches.map(item => <li key={item.key} className="grid min-w-0 gap-2 rounded-ui-md border border-border p-3">
            <button type="button" className="grid min-w-0 gap-1 text-left" disabled={busy} onClick={() => select(item)}>
              <strong className="text-sm text-primary">/{item.key}</strong><span className="wrap-anywhere text-sm">{item.text}</span>
            </button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => { setKey(item.key); setText(item.text) }}><Pencil size={14}/>Sửa</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void mutate(true, item.key)}><Trash2 size={14}/>Xóa</Button>
            </div>
          </li>)}
        </ul>
        <div className="grid gap-3" onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault() }}>
          <label className="grid gap-1 text-sm">Từ khóa<Input aria-label="Từ khóa" value={key} placeholder="Ví dụ: camon" maxLength={32} disabled={busy} onChange={e => setKey(e.target.value.toLowerCase())}/></label>
          <label className="grid gap-1 text-sm">Nội dung<Textarea aria-label="Nội dung tin nhắn nhanh" rows={2} value={text} maxLength={4000} disabled={busy} onChange={e => setText(e.target.value)}/></label>
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">Đóng</Button></DialogClose>
            <Button disabled={busy || !/^[a-z0-9_-]{1,32}$/.test(key) || !text.trim()} onClick={() => void mutate(false, key)}>Lưu mẫu</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  {!managing && query !== null && <div className="composer-pending grid max-h-[min(240px,35dvh)] min-w-0 gap-1 overflow-y-auto p-2" aria-label="Gợi ý tin nhắn nhanh">
    <div className="flex items-center justify-between gap-2">
      <strong className="text-sm">Tin nhắn nhanh</strong>
      <Button variant="ghost" size="icon" aria-label="Đóng tin nhắn nhanh" title="Đóng" onClick={onClose}><X size={18}/></Button>
    </div>
    {status}
    {matches.slice(0, 6).map(item => <button key={item.key} type="button" className="chat-mention-option" disabled={busy} onClick={() => select(item)}>
      <span className="chat-mention-avatar" aria-hidden="true"><ClipboardList size={18}/></span>
      <span className="chat-mention-name"><strong>/{item.key}</strong><small className="truncate">{item.text}</small></span>
    </button>)}
  </div>}
  </>
}