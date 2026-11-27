import { useUiTranslation } from '@/shared/i18n/locale'
import { useRef, type ReactNode } from "react"
import { Clock3 } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { Textarea } from "@/shared/ui/textarea"
import type { ApiRequest } from "@/shared/types/api"
import { useScheduledMessageQueue } from "../hooks/useScheduledMessageQueue"

type Props = { request: ApiRequest; conversationId: number; channelId: number; initialText: string; renderTrigger?: (open: () => void) => ReactNode }
const formatTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" })

export default function ScheduledMessageQueue(props: Props) {
  return <ScheduledMessageQueueView key={JSON.stringify([props.conversationId, props.channelId])} {...props} />
}

function ScheduledMessageQueueView({ request, conversationId, channelId, initialText, renderTrigger }: Props) {
  const trUi = useUiTranslation()

  const returnFocus = useRef<HTMLElement | null>(null)
  const { open, items, channelItems, text, setText, at, setAt, editing, busy,
    loadError, notice, error, reload, changeOpen, save, remove, edit, stopEditing,
  } = useScheduledMessageQueue({ request, conversationId, channelId, initialText })
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {renderTrigger ? renderTrigger(() => changeOpen(true)) : <DialogTrigger asChild>
        <button type="button" className="ghost-action attach-button" aria-label={trUi("chat.scheduled")} title={trUi("chat.scheduled")}>
          <Clock3 size={20} aria-hidden="true" />
        </button>
      </DialogTrigger>}
      <DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault() }}
        onOpenAutoFocus={renderTrigger ? () => {
          const active = document.activeElement
          returnFocus.current = active instanceof HTMLElement ? active : null
        } : undefined}
        onCloseAutoFocus={renderTrigger ? event => { event.preventDefault(); returnFocus.current?.focus({ preventScroll: true }) } : undefined}>
        <DialogTitle>{trUi("chat.scheduled")}</DialogTitle>
        <DialogDescription>Giờ hiển thị theo thiết bị này. Chỉ hỗ trợ tin văn bản trong cuộc trò chuyện không mã hóa đầu cuối.</DialogDescription>
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
        {loadError ? (
          <div className="grid gap-2"><p role="alert">{loadError}</p><Button type="button" variant="outline" onClick={reload}>Tải lại hàng chờ</Button></div>
        ) : channelItems === undefined ? <p role="status">Đang tải hàng chờ…</p> : channelItems.length === 0 ? (
          <p>Chưa có tin nhắn đang chờ.</p>
        ) : (
          <ul className="grid max-h-48 gap-2 overflow-auto" aria-label={trUi("common.ui.pendingMessages")}>
            {channelItems.map(item => (
              <li key={item.id} className="grid gap-1 rounded-lg border border-border p-2">
                <span className="wrap-anywhere">{item.text}</span>
                <time dateTime={item.sendAt}>{formatTime.format(new Date(item.sendAt))}</time>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => {
                    edit(item)
                  }}>Đổi giờ</Button>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove(item.id)}>Hủy lịch</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form className="grid gap-3" onSubmit={save}>
          {editing === null && <label className="grid gap-1">{trUi("common.content")}<Textarea value={text} onChange={event => setText(event.target.value)} maxLength={4000} required disabled={busy} /></label>}
          <label className="grid gap-1">Ngày giờ gửi<Input type="datetime-local" value={at} onChange={event => setAt(event.target.value)} required disabled={busy} /></label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || items === null}>{editing === null ? "Lên lịch gửi" : "Lưu giờ mới"}</Button>
            {editing !== null && <Button type="button" variant="outline" disabled={busy} onClick={stopEditing}>Thôi đổi giờ</Button>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}