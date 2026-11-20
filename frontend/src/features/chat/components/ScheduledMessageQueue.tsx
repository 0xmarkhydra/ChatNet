import { useEffect, useRef, useState, type FormEvent } from "react"
import { Clock3 } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { Textarea } from "@/shared/ui/textarea"
import type { ApiRequest } from "@/shared/types/api"
import { cancelScheduledMessage, createScheduledMessage, listScheduledMessages, moveScheduledMessage, type ScheduledMessage } from "../api/scheduledMessages"
import { scheduledInstant, scheduledLocalValue } from "../utils/scheduledMessageTime"

type Props = { request: ApiRequest; conversationId: number; channelId: number; initialText: string }
const formatTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" })
const initialTime = () => scheduledLocalValue(new Date(Date.now() + 15 * 60 * 1000))

export default function ScheduledMessageQueue({ request, conversationId, channelId, initialText }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ScheduledMessage[] | null>(null)
  const [revision, setRevision] = useState(0)
  const [text, setText] = useState("")
  const [at, setAt] = useState("")
  const [editing, setEditing] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const pendingCreates = useRef(new Map<string, string>())
  const channelItems = items?.filter(item => (item.channelId || 0) === (channelId || 0))

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void listScheduledMessages(request, conversationId, controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setItems(result)
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setLoadError(err instanceof Error ? err.message : "Không thể tải hàng chờ.")
      })
    return () => controller.abort()
  }, [open, conversationId, request, revision])

  function reload() {
    setItems(null)
    setLoadError("")
    setRevision(current => current + 1)
  }

  function changeOpen(next: boolean) {
    if (!next && busy) return
    if (next) {
      setItems(null)
      setLoadError("")
      setNotice("")
      setError("")
      setEditing(null)
      setText(initialText)
      setAt(initialTime())
    }
    setOpen(next)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (busy || items === null) return
    const sendAt = scheduledInstant(at)
    const body = text.trim()
    if (!sendAt) {
      setError("Chọn thời gian trong tương lai, không quá 365 ngày.")
      return
    }
    if (editing === null && (!body || new TextEncoder().encode(body).length > 4000 || body.includes("\0"))) {
      setError("Nhập tin nhắn văn bản không quá 4.000 byte.")
      return
    }
    setBusy(true)
    setError("")
    setNotice("")
    try {
      if (editing !== null) {
        await moveScheduledMessage(request, conversationId, editing, sendAt)
        setNotice("Đã đổi giờ gửi.")
      } else {
        const key = JSON.stringify([channelId, body, sendAt])
        const clientId = pendingCreates.current.get(key) ?? window.crypto.randomUUID()
        pendingCreates.current.set(key, clientId)
        const result = await createScheduledMessage(request, conversationId, { text: body, sendAt, channelId: channelId || undefined, clientId })
        pendingCreates.current.delete(key)
        setText("")
        setNotice(result.state === "pending" ? "Đã lên lịch gửi." : "Lịch này đã được xử lý.")
      }
      setEditing(null)
      setAt(initialTime())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu lịch gửi.")
    } finally {
      reload()
      setBusy(false)
    }
  }

  async function remove(id: number) {
    if (busy) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await cancelScheduledMessage(request, conversationId, id)
      if (editing === id) {
        setEditing(null)
        setAt(initialTime())
      }
      setNotice("Đã hủy lịch gửi.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể hủy lịch gửi.")
    } finally {
      reload()
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button type="button" className="ghost-action attach-button" aria-label="Tin nhắn hẹn giờ" title="Tin nhắn hẹn giờ">
          <Clock3 size={20} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault() }}>
        <DialogTitle>Tin nhắn hẹn giờ</DialogTitle>
        <DialogDescription>Giờ hiển thị theo thiết bị này. Chỉ hỗ trợ tin văn bản trong cuộc trò chuyện không mã hóa đầu cuối.</DialogDescription>
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
        {loadError ? (
          <div className="grid gap-2"><p role="alert">{loadError}</p><Button type="button" variant="outline" onClick={reload}>Tải lại hàng chờ</Button></div>
        ) : channelItems === undefined ? <p role="status">Đang tải hàng chờ…</p> : channelItems.length === 0 ? (
          <p>Chưa có tin nhắn đang chờ.</p>
        ) : (
          <ul className="grid max-h-48 gap-2 overflow-auto" aria-label="Tin nhắn đang chờ">
            {channelItems.map(item => (
              <li key={item.id} className="grid gap-1 rounded-lg border border-border p-2">
                <span className="wrap-anywhere">{item.text}</span>
                <time dateTime={item.sendAt}>{formatTime.format(new Date(item.sendAt))}</time>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => {
                    setEditing(item.id)
                    setAt(scheduledLocalValue(new Date(item.sendAt)))
                  }}>Đổi giờ</Button>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove(item.id)}>Hủy lịch</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form className="grid gap-3" onSubmit={save}>
          {editing === null && <label className="grid gap-1">Nội dung<Textarea value={text} onChange={event => setText(event.target.value)} maxLength={4000} required disabled={busy} /></label>}
          <label className="grid gap-1">Ngày giờ gửi<Input type="datetime-local" value={at} onChange={event => setAt(event.target.value)} required disabled={busy} /></label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || items === null}>{editing === null ? "Lên lịch gửi" : "Lưu giờ mới"}</Button>
            {editing !== null && <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing(null); setAt(initialTime()) }}>Thôi đổi giờ</Button>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
