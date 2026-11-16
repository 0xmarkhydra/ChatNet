import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Film, Images } from 'lucide-react'
import MediaViewer from '../../../shared/ui/MediaViewer'
import { loadSharedContent, type SharedAttachment } from '../lib/sharedContentLoader'
import '../styles/conversation-shared-preview.css'

type PreviewItem = { id: string; kind: 'image' | 'video'; url: string; name: string }

export default function ConversationSharedPreview({
  conversationId, channelId, request, onOpen,
}: {
  conversationId: number
  channelId: number
  request: (path: string, init?: RequestInit) => Promise<Response>
  onOpen: (tab?: 'media' | 'files' | 'links') => void
}) {
  const requestRef = useRef(request)
  useEffect(() => { requestRef.current = request }, [request])
  const [items, setItems] = useState<PreviewItem[]>([])
  const [mediaCount, setMediaCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void loadSharedContent({
      conversationId, channelId, kind: 'media', limit: 24,
      request: requestRef.current, signal: controller.signal,
    })
      .then(data => {
        if (controller.signal.aborted) return
        const media = (data.items || []).flatMap(message => (message.attachments || [])
          .filter((item): item is SharedAttachment & { kind: 'image' | 'video'; url: string } =>
            (item.kind === 'image' || item.kind === 'video') && Boolean(item.url))
          .map(item => ({
            id: `${message.id}-${item.id || item.url}`,
            kind: item.kind,
            name: item.name || 'Phương tiện đã chia sẻ',
            url: item.url,
          })))
        setItems(media.slice(0, 4))
        setMediaCount(media.length)
      })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [conversationId, channelId, retryKey])

  return (
    <section className="conversation-shared-preview" aria-label="File phương tiện, liên kết">
      {items.length > 0 ? (
        <div className="conversation-shared-preview-grid">
          {items.map((item, index) => (
            <button type="button" key={item.id} onClick={() => setViewerIndex(index)}
              aria-label={`Xem ${item.kind === 'video' ? 'video' : 'ảnh'} ${item.name}`}
              title={item.name}>
              {item.kind === 'video'
                ? <><video muted playsInline preload="metadata" src={item.url} />
                    <Film size={20} className="conversation-shared-preview-video" aria-hidden="true" /></>
                : <img src={item.url} alt={item.name} loading="lazy" />}
              {index === 3 && mediaCount > 4 && (
                <span className="conversation-shared-preview-overflow" aria-hidden="true">+{mediaCount - 4}</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="conversation-shared-preview-empty" onClick={() => { if (error) { setItems([]); setViewerIndex(null); setMediaCount(0); setLoading(true); setError(false); setRetryKey(key => key + 1) } else onOpen('media') }}>
          {loading ? 'Đang tải phương tiện...' : error
            ? 'Không tải được ảnh xem trước. Nhấn để thử lại.'
            : 'Chưa có ảnh hoặc video được chia sẻ'}
        </button>
      )}

      <button type="button" className="conversation-shared-preview-title" onClick={() => onOpen('media')}>
        <span className="conversation-shared-preview-title-icon"><Images size={18} aria-hidden="true" /></span>
        <strong>File phương tiện, liên kết</strong>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      {viewerIndex !== null && items[viewerIndex] && (
        <MediaViewer
          items={items.map(({ id, ...item }) => ({ ...item, storageRef: id, sizeBytes: 0,
            contentType: item.kind === 'video' ? 'video/mp4' : 'image/jpeg' }))}
          activeIndex={viewerIndex}
          onChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </section>
  )
}
