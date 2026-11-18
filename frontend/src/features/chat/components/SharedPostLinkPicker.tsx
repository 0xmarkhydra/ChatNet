import { useEffect, useId, useRef, useState } from 'react'
import { MessageCircle, Search, Send, Users } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { useSession } from '../../../shared/context/SessionContext'
import type { ApiRequest } from '../../../shared/types/api'
import { useConversationListSearch } from '../hooks/useConversationListSearch'
import { sendSharedPostLink, SharedPostDeliveryError } from '../lib/sendSharedPostLink'
import type { Conversation } from '../types'

export default function SharedPostLinkPicker({
  url, conversations, hasMore, loadingMore, onLoadMore, request, onClose, onOpenChat, onSent,
}: {
  url: string
  conversations: Conversation[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  request: ApiRequest
  onClose: () => void
  onOpenChat: (id: number) => void
  onSent: (name: string) => void
}) {
  const { session, sessionRef } = useSession()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [error, setError] = useState('')
  const [openInstead, setOpenInstead] = useState(false)
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const encryptedFailures = useRef(new Map<number, string>())
  const clientIds = useRef(new Map<number, string>())
  const title = useId()
  const search = useConversationListSearch({
    query, filter: 'all', categoryId: null, sessionId: session.sessionId, enabled: true, request,
  })
  const options = (search.active ? search.items : conversations).filter(c => !c.blockedByMe && !c.blockedByOther)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function submit() {
    if (!selected || inFlight.current || openInstead) return
    const destination = options.find(item => item.id === selected.id)
    if (!destination) return
    const isCurrent = () => sessionRef.current?.sessionId === session.sessionId && Boolean(dialog.current?.isConnected)
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const clientId = clientIds.current.get(destination.id) ?? crypto.randomUUID()
      clientIds.current.set(destination.id, clientId)
      await sendSharedPostLink({ destination, url, userId: session.user.id, clientId, request, isCurrent })
      if (!isCurrent()) return
      onSent(destination.name)
      onClose()
    } catch (cause) {
      if (!isCurrent()) return
      const message = cause instanceof Error ? cause.message : 'Không gửi được liên kết.'
      const requiresChat = cause instanceof SharedPostDeliveryError && cause.openChat
      if (requiresChat) encryptedFailures.current.set(destination.id, message)
      setOpenInstead(requiresChat)
      setError(message)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return <dialog ref={dialog} aria-labelledby={title}
    className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-black/50"
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="grid gap-3">
      <h2 id={title} className="text-lg font-semibold">Gửi bài viết qua chat</h2>
      <p className="text-sm text-muted-foreground">Chỉ gửi liên kết. Người nhận cần có quyền xem bài viết.</p>
      <label className="flex items-center gap-2 rounded-lg border border-border px-3">
        <Search size={18} aria-hidden="true" />
        <input type="search" autoFocus className="min-w-0 flex-1 bg-transparent py-2 outline-none"
          aria-label="Tìm người hoặc nhóm" placeholder="Tìm người hoặc nhóm" value={query} disabled={busy}
          onChange={event => { setQuery(event.target.value); setSelected(null); setOpenInstead(false); setError('') }} />
      </label>
      <div className="grid max-h-64 gap-1 overflow-auto" aria-label="Cuộc trò chuyện">
        {options.map(item => {
          const Icon = item.type === 'group' ? Users : MessageCircle
          return <Button key={item.id} type="button" variant={selected?.id === item.id ? 'secondary' : 'ghost'}
            aria-pressed={selected?.id === item.id} className="w-full justify-start overflow-hidden" disabled={busy}
            onClick={() => {
              if (selected?.id !== item.id) {
                const warning = encryptedFailures.current.get(item.id)
                setOpenInstead(Boolean(warning))
                setError(warning ?? '')
              }
              setSelected(item)
            }}>
            <Icon size={18} aria-hidden="true" /><span className="truncate">{item.name}</span>
          </Button>
        })}
        {search.loading && <p role="status" className="text-sm text-muted-foreground">Đang tìm cuộc trò chuyện…</p>}
        {search.error && <Button type="button" variant="outline" disabled={busy} onClick={search.retry}>Thử tìm lại</Button>}
        {!search.loading && !search.error && !options.length && <p className="text-sm text-muted-foreground">Không có cuộc trò chuyện phù hợp.</p>}
        {(search.active ? search.hasMore : hasMore) && <Button type="button" variant="ghost"
          disabled={busy || (search.active ? search.loadingMore : loadingMore)}
          onClick={search.active ? () => void search.loadMore() : onLoadMore}>Xem thêm</Button>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Hủy</Button>
        {openInstead && selected
          ? <Button type="button" onClick={() => onOpenChat(selected.id)}>Mở hội thoại</Button>
          : <Button type="button" disabled={busy || !options.some(item => item.id === selected?.id)} onClick={() => void submit()}>
              <Send size={16} aria-hidden="true" />{busy ? 'Đang gửi…' : 'Gửi'}
            </Button>}
      </div>
    </div>
  </dialog>
}
