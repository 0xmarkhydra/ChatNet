import { userLabel } from '../../shared/lib/userLabel'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Images, Link2, LoaderCircle, Play, X } from 'lucide-react'

type MediaAttachment = {
  id?: number
  storageRef: string
  name: string
  sizeBytes: number
  contentType: string
  kind: 'image' | 'video' | 'audio' | 'file'
  url?: string
}

type SharedMessage = {
  id: number
  sender: string
  senderDisplayName?: string
  text: string
  attachments?: MediaAttachment[]
  createdAt: string
}

type SharedPage = {
  items: SharedMessage[]
  nextBefore?: number
}

type RequestFn = (path: string, init?: RequestInit) => Promise<Response>
type Tab = 'media' | 'files' | 'links'
const PAGE_SIZE = 24

const tabs: { id: Tab; label: string; icon: typeof Images }[] = [
  { id: 'media', label: 'Ảnh & video', icon: Images },
  { id: 'files', label: 'Tệp', icon: FileText },
  { id: 'links', label: 'Liên kết', icon: Link2 },
]

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

function extractLinks(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) || []
  return matches
    .map((value) => value.replace(/[),.!?;:]+$/g, ''))
    .filter((value, index, items) => items.indexOf(value) === index)
}

// Attach URLs only while a tile is near the scroll viewport; long conversations
// do not request dozens of media objects just because a page was fetched.
function SharedMediaTile({ message, attachment }: { message: SharedMessage; attachment: MediaAttachment }) {
  const anchorRef = useRef<HTMLAnchorElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (visible) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '180px 0px' })
    if (anchorRef.current) observer.observe(anchorRef.current)
    return () => observer.disconnect()
  }, [visible])

  return (
    <a
      ref={anchorRef}
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="shared-media-card"
      title={attachment.name}
      aria-label={`${attachment.kind === 'video' ? 'Video' : 'Ảnh'}: ${attachment.name}`}
    >
      {visible && attachment.url && (attachment.kind === 'video'
        ? <video src={attachment.url} muted playsInline preload="metadata" />
        : <img src={attachment.url} alt={attachment.name || 'Ảnh đã chia sẻ'} loading="lazy" decoding="async" />)}
      {attachment.kind === 'video' && <Play className="shared-media-play" size={24} aria-hidden />}
      <span>{userLabel(message.senderDisplayName, message.sender)}</span>
    </a>
  )
}

export default function SharedContent({
  conversationId,
  request,
  onClose,
}: {
  conversationId: number
  request: RequestFn
  onClose: () => void
}) {
  const requestRef = useRef(request)
  requestRef.current = request
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose() }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])
  const [tab, setTab] = useState<Tab>('media')
  const [items, setItems] = useState<SharedMessage[]>([])
  const [nextBefore, setNextBefore] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const inFlightRef = useRef(false)
  const requestSeqRef = useRef(0)
  const key = `${conversationId}:${tab}`
  const activeKeyRef = useRef(key)
  activeKeyRef.current = key

  const loadPage = useCallback(async (before?: number, signal?: AbortSignal) => {
    const reset = before === undefined
    const requestKey = `${conversationId}:${tab}`
    if (!reset && inFlightRef.current) return
    inFlightRef.current = true
    const sequence = ++requestSeqRef.current
    if (reset) {
      setLoadingMore(false)
      setLoading(true)
      setNextBefore(undefined)
      setItems([])
    } else {
      setLoadingMore(true)
    }
    setError('')
    try {
      const cursor = before === undefined ? '' : `&before=${before}`
      const response = await requestRef.current(
        `/api/conversations/${conversationId}/shared?kind=${tab}&limit=${PAGE_SIZE}${cursor}`,
        { cache: 'no-store', signal },
      )
      const page = await response.json().catch(() => null) as (SharedPage & { error?: string }) | null
      if (!response.ok || !page || !Array.isArray(page.items)) {
        throw new Error(page?.error || 'Không tải được nội dung dùng chung')
      }
      if (activeKeyRef.current !== requestKey || sequence !== requestSeqRef.current || signal?.aborted) return
      setItems((current) => reset ? page.items : [
        ...current,
        ...page.items.filter((item) => !current.some((existing) => existing.id === item.id)),
      ])
      setNextBefore(page.nextBefore)
    } catch (reason) {
      if (activeKeyRef.current === requestKey && sequence === requestSeqRef.current && !signal?.aborted) {
        setError(reason instanceof Error ? reason.message : 'Không tải được nội dung dùng chung')
      }
    } finally {
      if (activeKeyRef.current === requestKey && sequence === requestSeqRef.current) {
        inFlightRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [conversationId, tab])

  useEffect(() => {
    const controller = new AbortController()
    inFlightRef.current = false
    bodyRef.current?.scrollTo(0, 0)
    void loadPage(undefined, controller.signal)
    return () => controller.abort()
  }, [loadPage, retry])

  // Observe a sentinel inside the scrollable sheet, not the browser viewport.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !bodyRef.current || !nextBefore || loading || loadingMore || error) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect()
        void loadPage(nextBefore)
      }
    }, { root: bodyRef.current, rootMargin: '180px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [nextBefore, loading, loadingMore, error, loadPage])

  const media = useMemo(() => items.flatMap((message) =>
    (message.attachments || [])
      .filter((attachment) => attachment.kind === 'image' || attachment.kind === 'video')
      .map((attachment) => ({ message, attachment })),
  ), [items])

  const files = useMemo(() => items.flatMap((message) =>
    (message.attachments || [])
      .filter((attachment) => attachment.kind === 'file' || attachment.kind === 'audio')
      .map((attachment) => ({ message, attachment })),
  ), [items])

  const links = useMemo(() => items.flatMap((message) =>
    extractLinks(message.text).map((url) => ({ message, url })),
  ), [items])

  const empty = !loading && !error && !nextBefore && (
    (tab === 'media' && media.length === 0) ||
    (tab === 'files' && files.length === 0) ||
    (tab === 'links' && links.length === 0)
  )

  return (
    <div className="shared-content-layer" role="dialog" aria-modal="true" aria-label="Nội dung đã chia sẻ">
      <button className="shared-content-scrim" type="button" aria-label="Đóng nội dung dùng chung" onClick={onClose} />
      <section className="shared-content-sheet">
        <header className="shared-content-header">
          <div>
            <strong>Kho nội dung cuộc trò chuyện</strong>
            <small>Ảnh, video, tệp và liên kết đã chia sẻ</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </header>

        <nav className="shared-content-tabs" aria-label="Lọc loại nội dung">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={tab === id ? 'active' : ''} aria-pressed={tab === id} onClick={() => {
              if (tab === id) return
              setLoading(true)
              setLoadingMore(false)
              setItems([])
              setNextBefore(undefined)
              setError('')
              setTab(id)
            }}>
              <Icon size={17} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="shared-content-body" ref={bodyRef}>
          {loading && <div className="shared-content-state"><LoaderCircle className="spinning" size={24} />Đang tải…</div>}
          {!loading && tab === 'media' && (
            <div className="shared-media-grid">
              {media.map(({ message, attachment }) => (
                <SharedMediaTile key={`${message.id}-${attachment.id || attachment.storageRef}`} message={message} attachment={attachment} />
              ))}
            </div>
          )}
          {!loading && tab === 'files' && (
            <div className="shared-file-list">
              {files.map(({ message, attachment }) => (
                <a key={`${message.id}-${attachment.id || attachment.storageRef}`} href={attachment.url} target="_blank" rel="noreferrer" className="shared-file-row">
                  <span className="shared-file-icon"><FileText size={20} /></span>
                  <span className="shared-file-copy">
                    <strong>{attachment.name || 'Tệp đính kèm'}</strong>
                    <small>{userLabel(message.senderDisplayName, message.sender)} · {formatBytes(attachment.sizeBytes)}</small>
                  </span>
                  <b>↗</b>
                </a>
              ))}
            </div>
          )}
          {!loading && tab === 'links' && (
            <div className="shared-link-list">
              {links.map(({ message, url }) => (
                <a key={`${message.id}-${url}`} href={url} target="_blank" rel="noreferrer" className="shared-link-row">
                  <span className="shared-link-icon"><Link2 size={19} /></span>
                  <span>
                    <strong>{url}</strong>
                    <small>{userLabel(message.senderDisplayName, message.sender)} · {new Date(message.createdAt).toLocaleDateString('vi-VN')}</small>
                  </span>
                  <b>↗</b>
                </a>
              ))}
            </div>
          )}

          {empty && <div className="shared-content-state">Chưa có nội dung thuộc mục này.</div>}
          {error && <div className="shared-content-state error">
            <span>{error}</span>
            <button type="button" onClick={() => nextBefore && !loading ? void loadPage(nextBefore) : setRetry((n) => n + 1)}>Thử lại</button>
          </div>}
          {!loading && nextBefore && !error && (
            <>
              <div ref={sentinelRef} className="shared-content-sentinel" aria-hidden="true" />
              <button className="shared-content-more" type="button" disabled={loadingMore} onClick={() => void loadPage(nextBefore)}>
                {loadingMore ? 'Đang tải thêm…' : 'Xem thêm'}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
