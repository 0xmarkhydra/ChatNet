import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Images, Link2, LoaderCircle, X } from 'lucide-react'

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
  const [tab, setTab] = useState<Tab>('media')
  const [items, setItems] = useState<SharedMessage[]>([])
  const [nextBefore, setNextBefore] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  async function load(reset: boolean) {
    if (reset) setLoading(true)
    else setLoadingMore(true)
    setError('')
    try {
      const before = reset ? '' : nextBefore ? `&before=${nextBefore}` : ''
      const response = await requestRef.current(
        `/api/conversations/${conversationId}/shared?kind=${tab}&limit=48${before}`,
      )
      const page = await response.json().catch(() => null) as (SharedPage & { error?: string }) | null
      if (!response.ok || !page) throw new Error(page?.error || 'Không tải được nội dung dùng chung')
      setItems((current) => reset ? page.items : [...current, ...page.items])
      setNextBefore(page.nextBefore)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được nội dung dùng chung')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    setItems([])
    setNextBefore(undefined)
    void load(true)
  }, [conversationId, tab])

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

  const empty = !loading && !error && (
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
            <strong>Nội dung đã chia sẻ</strong>
            <small>Ảnh, video, tệp và liên kết trong cuộc trò chuyện</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </header>

        <nav className="shared-content-tabs" aria-label="Loại nội dung">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              <Icon size={17} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="shared-content-body">
          {loading && <div className="shared-content-state"><LoaderCircle className="spinning" size={24} />Đang tải…</div>}
          {error && <div className="shared-content-state error"><span>{error}</span><button type="button" onClick={() => void load(true)}>Thử lại</button></div>}
          {empty && <div className="shared-content-state">Chưa có nội dung thuộc mục này.</div>}

          {!loading && !error && tab === 'media' && (
            <div className="shared-media-grid">
              {media.map(({ message, attachment }) => (
                <a
                  key={`${message.id}-${attachment.id || attachment.storageRef}`}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shared-media-card"
                  title={attachment.name}
                >
                  {attachment.kind === 'video'
                    ? <video src={attachment.url} muted playsInline preload="metadata" />
                    : <img src={attachment.url} alt={attachment.name || 'Ảnh đã chia sẻ'} loading="lazy" />}
                  <span>@{message.sender}</span>
                </a>
              ))}
            </div>
          )}

          {!loading && !error && tab === 'files' && (
            <div className="shared-file-list">
              {files.map(({ message, attachment }) => (
                <a
                  key={`${message.id}-${attachment.id || attachment.storageRef}`}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shared-file-row"
                >
                  <span className="shared-file-icon"><FileText size={20} /></span>
                  <span className="shared-file-copy">
                    <strong>{attachment.name || 'Tệp đính kèm'}</strong>
                    <small>@{message.sender} · {formatBytes(attachment.sizeBytes)}</small>
                  </span>
                  <b>↗</b>
                </a>
              ))}
            </div>
          )}

          {!loading && !error && tab === 'links' && (
            <div className="shared-link-list">
              {links.map(({ message, url }) => (
                <a key={`${message.id}-${url}`} href={url} target="_blank" rel="noreferrer" className="shared-link-row">
                  <span className="shared-link-icon"><Link2 size={19} /></span>
                  <span>
                    <strong>{url}</strong>
                    <small>@{message.sender} · {new Date(message.createdAt).toLocaleDateString('vi-VN')}</small>
                  </span>
                  <b>↗</b>
                </a>
              ))}
            </div>
          )}

          {!loading && !error && nextBefore && (
            <button className="shared-content-more" type="button" disabled={loadingMore} onClick={() => void load(false)}>
              {loadingMore ? 'Đang tải…' : 'Xem thêm'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
