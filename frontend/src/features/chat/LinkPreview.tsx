import { useEffect, useRef, useState } from 'react'
import { messageLinkHref, messageTextParts } from './messageClipboard'
import './link-preview.css'

type LinkPreviewData = {
  url: string
  title: string
  description?: string
  image?: string
  siteName?: string
  domain: string
}

type RequestPreview = (path: string, init?: RequestInit) => Promise<Response>
type CacheEntry = { expires: number; promise: Promise<LinkPreviewData | null> }
const previewCache = new Map<string, CacheEntry>()

function loadPreview(url: string, scope: string, request: RequestPreview): Promise<LinkPreviewData | null> {
  const key = `${scope}:${url}`
  const existing = previewCache.get(key)
  if (existing && existing.expires > Date.now()) return existing.promise

  const entry: CacheEntry = {
    expires: Date.now() + 5 * 60_000,
    promise: request(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then(async (response) => {
        if (!response.ok || response.status === 204) return null
        const data: LinkPreviewData = await response.json()
        return typeof data.title === 'string' && typeof data.url === 'string' && typeof data.domain === 'string'
          ? data : null
      })
      .catch(() => null)
      .then((preview) => {
        if (!preview) entry.expires = Date.now() + 60_000
        return preview
      }),
  }
  previewCache.delete(key)
  previewCache.set(key, entry)
  if (previewCache.size > 150) previewCache.delete(previewCache.keys().next().value!)
  return entry.promise
}

function firstPreviewURL(text: string): string | null {
  const part = messageTextParts(text).find((value) => value.kind === 'link')
  if (!part) return null
  try {
    const url = new URL(messageLinkHref(part.text))
    return ['http:', 'https:'].includes(url.protocol) && url.href.length <= 2048 ? url.href : null
  } catch {
    return null
  }
}

/** Only request metadata for links near the viewport; never block normal message rendering. */
export default function LinkPreview({
  text,
  cacheScope,
  request,
}: {
  text: string
  cacheScope: string
  request: RequestPreview
}) {
  const url = firstPreviewURL(text)
  const holder = useRef<HTMLSpanElement>(null)
  const requestRef = useRef(request)
  requestRef.current = request
  const [visible, setVisible] = useState(false)
  const [preview, setPreview] = useState<LinkPreviewData | null>(null)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setVisible(false)
    setPreview(null)
    setImageFailed(false)
    if (!url) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '240px' })
    if (holder.current) observer.observe(holder.current)
    return () => observer.disconnect()
  }, [url])

  useEffect(() => {
    if (!visible || !url) return
    let mounted = true
    setPreview(null)
    void loadPreview(url, cacheScope, (path, init) => requestRef.current(path, init))
      .then((data) => { if (mounted) setPreview(data) })
    return () => { mounted = false }
  }, [url, cacheScope, visible])

  if (!url) return null
  const domain = new URL(url).hostname
  const card: LinkPreviewData = preview || { url, title: domain, domain }
  return (
    <span ref={holder} className="message-link-preview-holder">
      <a className={`message-link-preview${preview ? '' : ' message-link-preview-fallback'}`} href={url} target="_blank" rel="noopener noreferrer"
        aria-label={`Mở liên kết: ${card.title}`}>
          {card.image && !imageFailed && (
            <span className="message-link-preview-image">
              <img src={card.image} alt="" loading="lazy" referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)} />
            </span>
          )}
          <span className="message-link-preview-details">
            <strong className="message-link-preview-title">{card.title}</strong>
            {card.description && <span className="message-link-preview-description">{card.description}</span>}
            <span className="message-link-preview-domain">{preview ? (card.siteName && card.siteName.toLowerCase() !== card.domain.toLowerCase() ? `${card.siteName} · ${card.domain}` : card.domain) : "Mở liên kết"}</span>
          </span>
      </a>
    </span>
  )
}
