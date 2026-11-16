import { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ModalPortalContext } from './modalPortalContext'
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import type { MediaAttachment } from '../utils/media'
import './media-viewer.css'

type PreviewMedia = MediaAttachment & { url: string }

function MediaViewerDisplay({ item }: { item: PreviewMedia }) {
  const [failed, setFailed] = useState(false)
  return failed ? (
    <p role="alert" className="media-viewer-error">Không thể tải nội dung này. Liên kết có thể đã hết hạn.</p>
  ) : item.kind === 'video' ? (
    <video src={item.url} controls playsInline autoPlay aria-label={`Video: ${item.name || 'Tệp đính kèm'}`} onError={() => setFailed(true)} />
  ) : (
    <img src={item.url} alt={item.name || 'Ảnh đính kèm'} onError={() => setFailed(true)} />
  )
}

export default function MediaViewer({
  items, activeIndex, onChange, onClose,
}: {
  items: PreviewMedia[]
  activeIndex: number
  onChange: (index: number) => void
  onClose: () => void
}) {
  const portalContainer = useContext(ModalPortalContext)
  const item = items[activeIndex]
  const hasActiveItem = Boolean(item)
  const closeButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!hasActiveItem) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    return () => {
      document.body.style.overflow = oldOverflow
      previousFocus?.focus()
    }
  }, [hasActiveItem])

  useEffect(() => {
    if (!hasActiveItem) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), video[controls], audio[controls]')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
          event.preventDefault()
          first.focus()
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onClose()
      } else if (event.target instanceof HTMLMediaElement) {
        // Let native video/audio controls use arrow keys for seeking and volume.
        return
      } else if (event.key === 'ArrowLeft' && activeIndex > 0) {
        event.preventDefault()
        event.stopImmediatePropagation()
        onChange(activeIndex - 1)
      } else if (event.key === 'ArrowRight' && activeIndex + 1 < items.length) {
        event.preventDefault()
        event.stopImmediatePropagation()
        onChange(activeIndex + 1)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [activeIndex, hasActiveItem, items.length, onChange, onClose])

  if (!item) return null

  return createPortal(
    <div
      className="media-viewer-backdrop"
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh và video"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="media-viewer-panel">
        <header className="media-viewer-header">
          <div className="media-viewer-heading">
            <strong title={item.name}>{item.name || (item.kind === 'video' ? 'Video' : 'Ảnh')}</strong>
            {items.length > 1 && <span>{activeIndex + 1} / {items.length}</span>}
          </div>
          <div className="media-viewer-actions">
            <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Mở tệp gốc trong tab mới">
              <ExternalLink size={18} aria-hidden="true" />
              <span>Mở bản gốc</span>
            </a>
            <button ref={closeButton} type="button" onClick={onClose} aria-label="Đóng trình xem ảnh hoặc video">
              <X size={22} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="media-viewer-content">
          {items.length > 1 && activeIndex > 0 && (
            <button type="button" className="media-viewer-nav previous"
              aria-label="Ảnh trước" onClick={() => onChange(activeIndex - 1)}>
              <ChevronLeft size={27} aria-hidden="true" />
            </button>
          )}
          <MediaViewerDisplay key={`${activeIndex}:${item.url}`} item={item} />
          {items.length > 1 && activeIndex < items.length - 1 && (
            <button type="button" className="media-viewer-nav next"
              aria-label="Ảnh tiếp theo" onClick={() => onChange(activeIndex + 1)}>
              <ChevronRight size={27} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>,
    portalContainer ?? document.body,
  )
}
