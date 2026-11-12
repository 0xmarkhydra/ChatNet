import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { GroupMember } from '../types'
import '../styles/message-readers.css'

type Reader = Pick<GroupMember, 'id' | 'username' | 'displayName'>
type ApiRequest = (path: string, init?: RequestInit) => Promise<Response>

export function MessageReadersInline({
  readerIds,
  members,
  onOpen,
}: {
  readerIds: number[]
  members: Reader[]
  onOpen: () => void
}) {
  const [showNames, setShowNames] = useState(false)
  const memberById = new Map(members.map((member) => [member.id, member]))
  const uniqueReaderIds = [...new Set(readerIds)]
  const resolvedReaders = uniqueReaderIds.flatMap((id) => {
    const member = memberById.get(id)
    return member ? [member] : []
  })
  const resolvedReaderCount = resolvedReaders.length
  const preview = resolvedReaders.slice(0, 3)
  const remaining = Math.max(0, resolvedReaderCount - preview.length)

  return (
    <span className="message-readers-inline">
      {preview.length > 0 && (
        <button
          type="button"
          className="message-readers-preview"
          aria-label={showNames ? undefined : 'Hiện tên người đã xem'}
          aria-expanded={showNames}
          title="Di chuột hoặc nhấn để xem tên"
          onPointerEnter={(event) => { if (event.pointerType !== 'touch') setShowNames(true) }}
          onPointerLeave={(event) => { if (event.pointerType !== 'touch') setShowNames(false) }}
          onClick={(event) => {
            event.stopPropagation()
            const pointerType = 'pointerType' in event.nativeEvent ? event.nativeEvent.pointerType : ''
            if (pointerType === 'touch' || event.detail === 0) setShowNames((current) => !current)
            else setShowNames(true)
          }}
        >
          <span className="message-readers-avatars" aria-hidden="true">
            {preview.map((reader) => (
              <span className="message-readers-avatar" key={reader.id}>
                <UserAvatar name={reader.displayName || reader.username} username={reader.username} className="message-readers-avatar-image" />
              </span>
            ))}
            {remaining > 0 && <span className="message-readers-more">+{remaining}</span>}
          </span>
          <span className="message-readers-names" aria-hidden={!showNames}>
            {preview.map((reader) => (
              <span className="message-readers-name" key={reader.id}>
                {reader.displayName.trim() || reader.username}
              </span>
            ))}
            {remaining > 0 && <span className="message-readers-more">+{remaining}</span>}
          </span>
        </button>
      )}
      <button
        type="button"
        className="message-readers-open"
        aria-haspopup="dialog"
        aria-label={`Mở danh sách ${resolvedReaderCount} người đã xem`}
        title="Mở danh sách người đã xem"
        onClick={(event) => { event.stopPropagation(); onOpen() }}
      >
        …
      </button>
    </span>
  )
}

function isReader(value: unknown): value is Reader {
  if (typeof value !== 'object' || value === null) return false
  const member = value as Record<string, unknown>
  return typeof member.id === 'number' && Number.isSafeInteger(member.id) &&
    typeof member.username === 'string' && typeof member.displayName === 'string'
}

export default function MessageReadersDialog({
  conversationId,
  readerIds,
  request,
  onClose,
}: {
  conversationId: number
  readerIds: number[]
  request: ApiRequest
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const requestRef = useRef(request)
  const titleId = useId()
  const [readers, setReaders] = useState<Reader[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  const closeDialog = () => {
    const dialog = dialogRef.current
    if (dialog?.open) dialog.close()
    onClose()
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  useEffect(() => { requestRef.current = request }, [request])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30_000)
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError('')
      setReaders([])
    })

    void requestRef.current(`/api/conversations/${conversationId}/members`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 403) throw new Error('Bạn không còn quyền xem cuộc trò chuyện này.')
        if (!response.ok) throw new Error('Không tải được danh sách người đã xem.')
        const payload: unknown = await response.json()
        if (!Array.isArray(payload)) throw new Error('Không tải được danh sách người đã xem.')
        const allowedReaders = new Set(readerIds)
        const members = payload.filter(isReader)
        if (!cancelled) setReaders(members.filter((member) => allowedReaders.has(member.id)))
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không tải được danh sách người đã xem.')
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [conversationId, readerIds, retry])

  return (
    <dialog
      ref={dialogRef}
      className="message-readers-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); closeDialog() }}
    >
      <header className="message-readers-dialog__header">
        <div>
          <h2 id={titleId}>Người đã xem</h2>
          <p>Danh sách người đã xem tin nhắn này</p>
        </div>
        <button type="button" className="message-readers-dialog__close" aria-label="Đóng danh sách người đã xem" onClick={closeDialog}>
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <div className="message-readers-dialog__body" aria-busy={loading}>
        {loading && <p className="message-readers-dialog__state" role="status" aria-live="polite">Đang tải danh sách…</p>}
        {!loading && error && (
          <div className="message-readers-dialog__state" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetry((current) => current + 1)}>Thử lại</button>
          </div>
        )}
        {!loading && !error && readers.length === 0 && (
          <p className="message-readers-dialog__state">Không tìm thấy người xem trong thành viên cuộc trò chuyện hiện tại.</p>
        )}
        {!loading && !error && readers.length > 0 && (
          <ul className="message-readers-dialog__list">
            {readers.map((reader) => {
              const label = reader.displayName.trim() || reader.username
              return (
                <li key={reader.id} className="message-readers-dialog__item">
                  <span className="message-readers-dialog__avatar" aria-hidden="true">
                    <UserAvatar name={label} username={reader.username} className="message-readers-dialog__avatar-image" />
                  </span>
                  <span className="message-readers-dialog__identity">
                    <strong>{label}</strong>
                    <small>@{reader.username}</small>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </dialog>
  )
}
