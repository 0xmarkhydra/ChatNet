import { memo, useState } from 'react'
import type { MediaAttachment } from '../utils/media'
import { formatBytes } from '../utils/format'
import MediaViewer from './MediaViewer'

const previewable = (item: MediaAttachment): item is MediaAttachment & { url: string } =>
  Boolean(item.url) && (item.kind === 'image' || item.kind === 'video')

function MediaAttachmentsView({
  items,
  pending = false,
  deferVideo = false,
  onRemove,
  onImageClick,
}: {
  items?: MediaAttachment[]
  pending?: boolean
  deferVideo?: boolean
  onRemove?: (index: number) => void
  onImageClick?: (index: number) => void
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  if (!items?.length) return null
  const previews = items.filter(previewable)

  return (
    <>
      <div className={`media-attachments ${pending ? 'pending-media' : ''} ${items.length > 1 ? 'media-grid' : ''} media-count-${Math.min(items.length, 4)}`}>
        {items.map((item, index) => (
          <div className={`media-item media-${item.kind}`} data-attachment-index={index} key={`${item.storageRef}:${index}`}>
            {item.kind === 'image' && item.url ? (
              <button
                type="button"
                className={onImageClick ? 'media-image-button open-post' : 'media-image-button'}
                aria-label={onImageClick ? `Xem bài viết có ảnh ${item.name}` : `Xem ảnh ${item.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  if (onImageClick) onImageClick(index)
                  else setPreviewIndex(items.slice(0, index).filter(previewable).length)
                }}
              >
                <img
                  src={item.url}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  onLoad={(event) => {
                    const image = event.currentTarget
                    image.classList.toggle(
                      'media-extra-tall',
                      image.naturalWidth > 0 && image.naturalHeight / image.naturalWidth >= 1.8,
                    )
                  }}
                />
              </button>
            ) : item.kind === 'video' && item.url ? (
              <video src={item.url} controls playsInline preload={deferVideo ? 'none' : 'metadata'} aria-label={`Video: ${item.name}`} />
            ) : item.kind === 'audio' && item.url ? (
              <div className="media-file-card">
                <span>🎙️</span>
                <div><strong>{item.name}</strong><small>{formatBytes(item.sizeBytes)}</small></div>
                <audio src={item.url} controls preload="none" aria-label={`Âm thanh: ${item.name}`} />
              </div>
            ) : item.url ? (
              <a className="media-file-card" href={item.url} target="_blank" rel="noopener noreferrer">
                <span aria-hidden="true">📎</span>
                <div><strong>{item.name}</strong><small>{formatBytes(item.sizeBytes)}</small></div>
              </a>
            ) : (
              <div className="media-file-card">
                <span aria-hidden="true">📎</span>
                <div><strong>{item.name}</strong><small>{formatBytes(item.sizeBytes)}</small></div>
              </div>
            )}
            {pending && onRemove && (
              <button type="button" className="media-remove" onClick={() => onRemove(index)} aria-label={`Bỏ ${item.name}`}>×</button>
            )}
          </div>
        ))}
      </div>
      {previewIndex !== null && previews[previewIndex] && (
        <MediaViewer
          items={previews}
          activeIndex={previewIndex}
          onChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  )
}
export default memo(MediaAttachmentsView)
