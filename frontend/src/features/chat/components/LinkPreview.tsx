import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import { Button } from '../../../shared/ui/button'
import { feedPostIdFromUrl, feedPostPath } from '../../../shared/utils/feedPostPath'
import { getSharedPostPreview, SharedPostPreviewError, type SharedPostPreview } from '../../feed'
import ChatSharedPostCard from './ChatSharedPostCard'
import { messageLinkHref, messageTextParts } from '../lib/messageClipboard'
import '../styles/link-preview.css'
import { fetchLinkPreview } from '../api/linkPreview'
import { useLatest } from '../../../shared/hooks/useLatest'

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
type PostPreviewState = { status: 'loading' | 'unavailable' }
  | { status: 'error'; reason: SharedPostPreviewError['kind']; retryAt?: number }
  | { status: 'ready'; post: SharedPostPreview }
const loadingPost: PostPreviewState = { status: 'loading' }

function loadPreview(url: string, scope: string, request: RequestPreview): Promise<LinkPreviewData | null> {
  const key = `${scope}:${url}`
  const existing = previewCache.get(key)
  if (existing && existing.expires > Date.now()) return existing.promise

  const entry: CacheEntry = {
    expires: Date.now() + 5 * 60_000,
    promise: fetchLinkPreview(request, url)
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
  const parsed = url ? new URL(url) : null
  const postId = parsed ? feedPostIdFromUrl(parsed, window.location.origin) : null
  const holder = useRef<HTMLSpanElement>(null)
  const requestRef = useLatest(request)
  const [observedVisible, setObservedVisible] = useScopedState(url, false)
  const visible = typeof IntersectionObserver === 'undefined' || observedVisible
  const previewScope = `${cacheScope}:${url ?? ''}`
  const [preview, setPreview] = useScopedState<LinkPreviewData | null>(previewScope, null)
  const [postPreview, setPostPreview] = useScopedState<PostPreviewState>(previewScope, loadingPost)
  const [imageFailed, setImageFailed] = useScopedState(previewScope, false)
  const [retryRevision, setRetryRevision] = useScopedState(previewScope, 0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (postPreview.status !== 'error' || postPreview.retryAt === undefined || postPreview.retryAt <= now) return
    const timeout = window.setTimeout(() => setNow(Date.now()), postPreview.retryAt - now)
    return () => window.clearTimeout(timeout)
  }, [now, postPreview])

  useEffect(() => {
    if (!url || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setObservedVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '240px' })
    if (holder.current) observer.observe(holder.current)
    return () => observer.disconnect()
  }, [url, setObservedVisible])

  useEffect(() => {
    if (!visible || !url || postId !== null) return
    let mounted = true
    void loadPreview(url, cacheScope, (path, init) => requestRef.current(path, init))
      .then((data) => { if (mounted) setPreview(data) })
    return () => { mounted = false }
  }, [url, cacheScope, visible, postId, requestRef, setPreview])

  useEffect(() => {
    if (!visible || postId === null || !cacheScope) return
    const id = postId
    let revision = 0
    function load() {
      const current = ++revision
      void getSharedPostPreview(requestRef.current, id)
        .then(post => {
          if (current !== revision) return
          setPostPreview(post ? { status: 'ready', post } : { status: 'unavailable' })
        })
        .catch(error => {
          if (current !== revision) return
          const failure = error instanceof SharedPostPreviewError ? error : null
          setPostPreview({
            status: 'error',
            reason: failure?.kind ?? 'retryable',
            retryAt: failure?.retryAt,
          })
        })
    }
    function refresh() {
      setPostPreview(loadingPost)
      setImageFailed(false)
      load()
    }
    load()
    window.addEventListener('chatnet:privacy-updated', refresh)
    return () => {
      revision++
      window.removeEventListener('chatnet:privacy-updated', refresh)
    }
  }, [cacheScope, postId, requestRef, retryRevision, setImageFailed, setPostPreview, visible])

  if (!url || !parsed) return null
  if (postId !== null) {
    const post = postPreview.status === 'ready' ? postPreview.post : null
    const errorText = postPreview.status !== 'error' ? null
      : postPreview.reason === 'session' ? 'Phiên đăng nhập hết hạn. Đăng nhập lại rồi thử lại.'
        : postPreview.reason === 'rate-limited' ? 'Máy chủ giới hạn yêu cầu. Hãy chờ trước khi thử lại.'
          : postPreview.reason === 'request' ? 'Không thể tải bài viết lúc này.'
            : 'Không tải được bài viết. Hãy thử lại.'
    const retryDisabled = postPreview.status === 'error' && postPreview.retryAt !== undefined && now < postPreview.retryAt
    const postHref = feedPostPath(postId, {
      ref: parsed.searchParams.get('ref') === 'share' ? 'share' : undefined,
      source: parsed.searchParams.get('source') === 'chat' ? 'chat' : undefined,
    })
    return (
      <span ref={holder} className="message-link-preview-holder">
        {post ? <ChatSharedPostCard post={post} postHref={postHref} /> : (
          <Link className="message-link-preview message-link-preview-fallback" to={postHref} aria-label="Mở bài viết ChatNet">
            <span className="message-link-preview-details">
              <span className="message-link-preview-domain">Bài viết · ChatNet</span>
              <strong className="message-link-preview-title">Bài viết ChatNet</strong>
              <span className="message-link-preview-description">
                {postPreview.status === 'unavailable' ? 'Bài viết không còn hoặc bạn không có quyền xem.'
                  : postPreview.status === 'error' ? errorText : 'Đang tải bài viết…'}
              </span>
            </span>
          </Link>
        )}
        {!post && postPreview.status === 'error' && postPreview.reason !== 'request' && (
          <Button variant="outline" size="sm" className="mt-ui-2 min-h-11"
            disabled={retryDisabled}
            onClick={() => { setPostPreview(loadingPost); setRetryRevision(value => value + 1) }}>
            Thử lại
          </Button>
        )}
      </span>
    )
  }
  const domain = parsed.hostname
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
