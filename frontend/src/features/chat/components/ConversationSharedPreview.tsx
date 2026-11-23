import { ChevronRight, Film, Images } from 'lucide-react'
import MediaViewer from '../../../shared/ui/MediaViewer'
import { useConversationSharedPreview } from '../hooks/useConversationSharedPreview'
import '../styles/conversation-shared-preview.css'

type Props = {
  conversationId: number
  channelId: number
  request: (path: string, init?: RequestInit) => Promise<Response>
  onOpen: (tab?: 'media' | 'files' | 'links') => void
}

export default function ConversationSharedPreview(props: Props) {
  return <ConversationSharedPreviewContent key={JSON.stringify([props.conversationId, props.channelId])} {...props} />
}

function ConversationSharedPreviewContent({ conversationId, channelId, request, onOpen }: Props) {
  const { items, mediaCount, loading, error, viewerIndex, setViewerIndex, retry } =
    useConversationSharedPreview({ conversationId, channelId, request })
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
        <button type="button" className="conversation-shared-preview-empty" onClick={() => { if (error) retry(); else onOpen('media') }}>
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