import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { reactionLabel as messageReactionLabel } from '../utils/reactions'
import UserAvatar from './UserAvatar'
import { useScopedState } from '../hooks/useScopedState'
import { userLabel } from '../utils/userLabel'
import './reaction-participants.css'

type ReactionUser = {
  userId: number
  username: string
  displayName: string
  emoji: string
}

type ReactionPage = {
  items: ReactionUser[]
  hasMore: boolean
}

type ReactionOption = { emoji: string; count: number }

export default function ReactionParticipantsDialog({
  kind,
  id,
  initialEmoji = '',
  reactions = [],
  request,
  onClose,
}: {
  kind: 'message' | 'post'
  id: number
  initialEmoji?: string
  reactions?: ReactionOption[]
  request: (path: string, init?: RequestInit) => Promise<Response>
  onClose: () => void
}) {
  const [selectedEmoji, setSelectedEmoji] = useState(initialEmoji)
  const reactionScope = `${kind}:${id}:${selectedEmoji}`
  const [users, setUsers] = useScopedState<ReactionUser[]>(reactionScope, [])
  const [hasMore, setHasMore] = useScopedState(reactionScope, false)
  const [loading, setLoading] = useScopedState(reactionScope, true)
  const [error, setError] = useScopedState(reactionScope, '')
  const pending = useRef<AbortController | null>(null)
  const requestRef = useRef(request)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { requestRef.current = request }, [request])

  const loadPage = useCallback(async (offset: number) => {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setLoading(true)
    setError('')
    try {
      const path = kind === 'message' ? 'messages' : 'posts'
      const params = new URLSearchParams({ offset: String(offset) })
      if (selectedEmoji) params.set('emoji', selectedEmoji)
      const response = await requestRef.current(`/api/${path}/${id}/reactions?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(response.status === 405 || response.status === 501
          ? 'Backend hiện tại chưa hỗ trợ xem danh sách người thả cảm xúc. Cần cập nhật backend cloud.'
          : response.status === 403 || response.status === 404
            ? 'Bạn không còn quyền xem danh sách cảm xúc này.'
            : 'Không tải được danh sách cảm xúc.')
      }
      const page = await response.json() as ReactionPage
      if (!Array.isArray(page.items)) throw new Error('Dữ liệu cảm xúc không hợp lệ.')
      if (controller.signal.aborted) return
      setUsers(current => offset === 0 ? page.items : [...current, ...page.items])
      setHasMore(Boolean(page.hasMore))
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Không tải được danh sách cảm xúc.')
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setLoading(false)
      }
    }
  }, [kind, id, selectedEmoji, setLoading, setError, setUsers, setHasMore])

  useEffect(() => {
    const previousFocus = document.activeElement
    closeRef.current?.focus()
    return () => {
      pending.current?.abort()
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    pending.current?.abort()
    pending.current = null
    void loadPage(0)
    return () => { pending.current?.abort() }
  }, [loadPage])

  const total = reactions.reduce((sum, item) => sum + item.count, 0)

  return createPortal(
    <div
      className="reaction-users-backdrop"
      role="presentation"
      onMouseDown={event => { if (event.currentTarget === event.target) onClose() }}
    >
      <section
        className="reaction-users-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reaction-users-title"
        onKeyDown={event => {
          if (event.key === 'Escape') { event.stopPropagation(); onClose() }
          if (event.key !== 'Tab') return
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
          if (buttons.length === 0) return
          if (event.shiftKey && document.activeElement === buttons[0]) {
            event.preventDefault()
            buttons[buttons.length - 1].focus()
          } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
            event.preventDefault()
            buttons[0].focus()
          }
        }}
      >
        <header className="reaction-users-header">
          <div>
            <h2 id="reaction-users-title">{kind === 'message' ? 'Cảm xúc tin nhắn' : 'Cảm xúc bài viết'}</h2>
            <span>{users.length > 0 ? `${users.length}${hasMore ? '+' : ''} người đã bày tỏ cảm xúc` : 'Danh sách người đã bày tỏ cảm xúc'}</span>
          </div>
          <button ref={closeRef} type="button" className="reaction-users-close" aria-label="Đóng danh sách cảm xúc" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {reactions.length > 0 && (
          <div className="reaction-users-tabs" role="group" aria-label="Lọc theo cảm xúc">
            <button type="button" className={!selectedEmoji ? 'is-active' : ''}
              aria-pressed={!selectedEmoji} onClick={() => setSelectedEmoji('')}>
              Tất cả <span>{total}</span>
            </button>
            {reactions.filter(item => item.count > 0).map(item => (
              <button type="button" key={item.emoji}
                className={selectedEmoji === item.emoji ? 'is-active' : ''}
                aria-pressed={selectedEmoji === item.emoji}
                aria-label={`${messageReactionLabel(item.emoji)}: ${item.count} người`}
                onClick={() => setSelectedEmoji(item.emoji)}>
                {item.emoji} <span>{item.count}</span>
              </button>
            ))}
          </div>
        )}
        <div className="reaction-users-list" aria-live="polite">
          {users.map((user, index) => (
            <div className="reaction-users-person" key={`${user.userId}-${index}`}>
              <UserAvatar username={user.username} name={userLabel(user.displayName, user.username)} className="reaction-users-avatar" />
              <div className="reaction-users-person-name">
                <strong>{userLabel(user.displayName, user.username)}</strong>
                <small>@{user.username}</small>
              </div>
              <span className="reaction-users-emoji" title={messageReactionLabel(user.emoji)} aria-label={messageReactionLabel(user.emoji)}>
                {user.emoji}
              </span>
            </div>
          ))}
          {!loading && users.length === 0 && !error && <p className="reaction-users-message">Chưa có ai bày tỏ cảm xúc.</p>}
          {error && <p className="reaction-users-message reaction-users-error" role="alert">{error}</p>}
          {loading && <p className="reaction-users-message">Đang tải danh sách...</p>}
          {!loading && (hasMore || Boolean(error)) && (
            <button type="button" className="reaction-users-more" onClick={() => void loadPage(users.length)}>
              {error ? 'Thử lại' : 'Xem thêm'}
            </button>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}