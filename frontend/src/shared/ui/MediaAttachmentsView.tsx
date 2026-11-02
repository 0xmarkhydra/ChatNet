import type { MediaAttachment } from '../lib/media'
import { formatBytes } from '../lib/format'

export default function MediaAttachmentsView({
  items,
  pending = false,
  onRemove,
}: {
  items?: MediaAttachment[]
  pending?: boolean
  onRemove?: (index: number) => void
}) {
  if (!items?.length) return null

  return (
    <div className={`media-attachments ${pending ? 'pending-media' : ''} ${items.length > 1 ? 'media-grid' : ''} media-count-${Math.min(items.length, 4)}`}>
      {items.map((item, index) => (
        <div className={`media-item media-${item.kind}`} key={`${item.storageRef}:${index}`}>
          {item.kind === 'image' && item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              <img
                src={item.url}
                alt={item.name}
                loading="lazy"
                onLoad={(event) => {
                  const image = event.currentTarget
                  image.classList.toggle(
                    'media-extra-tall',
                    image.naturalWidth > 0 && image.naturalHeight / image.naturalWidth >= 1.8,
                  )
                }}
              />
            </a>
          ) : item.kind === 'video' && item.url ? (
            <video src={item.url} controls playsInline preload="metadata" />
          ) : item.kind === 'audio' && item.url ? (
            <div className="media-file-card">
              <span>🎙️</span>
              <div><strong>{item.name}</strong><small>{formatBytes(item.sizeBytes)}</small></div>
              <audio src={item.url} controls preload="none" />
            </div>
          ) : (
            <a className="media-file-card" href={item.url || '#'} target="_blank" rel="noreferrer">
              <span>📎</span>
              <div><strong>{item.name}</strong><small>{formatBytes(item.sizeBytes)}</small></div>
            </a>
          )}
          {pending && onRemove && (
            <button type="button" className="media-remove" onClick={() => onRemove(index)} aria-label={`Bỏ ${item.name}`}>×</button>
          )}
        </div>
      ))}
    </div>
  )
}
