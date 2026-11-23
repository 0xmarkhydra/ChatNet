import { useEffect, useRef, useState, type FormEvent } from "react"
import type { ApiRequest } from "@/shared/types/api"
import { cancelScheduledMessage, createScheduledMessage, listScheduledMessages, moveScheduledMessage, type ScheduledMessage } from "../api/scheduledMessages"
import { scheduledInstant, scheduledLocalValue } from "../utils/scheduledMessageTime"
const initialTime = () => scheduledLocalValue(new Date(Date.now() + 15 * 60 * 1000))

type Params = { request: ApiRequest; conversationId: number; channelId: number; initialText: string }

export function useScheduledMessageQueue({ request, conversationId, channelId, initialText }: Params) {
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


  function edit(item: ScheduledMessage) {
    setEditing(item.id)
    setAt(scheduledLocalValue(new Date(item.sendAt)))
  }

  function stopEditing() {
    setEditing(null)
    setAt(initialTime())
  }

  return {
    open, items, channelItems, text, setText, at, setAt, editing,
    busy, loadError, notice, error, reload, changeOpen, save, remove, edit, stopEditing,
  }
}
