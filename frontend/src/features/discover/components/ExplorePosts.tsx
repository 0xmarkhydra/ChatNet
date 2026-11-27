import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import type { ApiRequest } from '../../../shared/types/api'
import { useLatest } from '../../../shared/hooks/useLatest'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { Button } from '../../../shared/ui/button'
import { listExplorePosts, type ExplorePost, type ExplorePostCursor, type ExplorePostLocation } from '../api/explore'
import { getCurrentPositionSmart, geolocationErrorMessage } from '../lib/geolocation'

function distanceLabel(meters: number) {
  if (meters < 100) return 'Dưới 100 m'
  return 'Khoảng ' + (meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' km'
}

export default function ExplorePosts({ request, preview, onViewAll }: { request: ApiRequest; preview: boolean; onViewAll: () => void }) {
  const [radiusKm, setRadiusKm] = useState(5)
  const [location, setLocation] = useState<ExplorePostLocation | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [revision, setRevision] = useState(0)
  const locationFlight = useRef(false)
  const locationRevision = useRef(0)
  useEffect(() => () => { ++locationRevision.current; locationFlight.current = false }, [])

  async function locate() {
    if (locationFlight.current) return
    locationFlight.current = true
    const attempt = ++locationRevision.current
    setLocating(true)
    setLocationError('')
    setLocation(null)
    try {
      const { coords } = await getCurrentPositionSmart()
      if (attempt !== locationRevision.current) return
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) ||
        Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) throw new Error('Tọa độ không hợp lệ.')
      setLocation({ latitude: coords.latitude, longitude: coords.longitude })
      setRevision(value => value + 1)
    } catch (error) {
      const message = await geolocationErrorMessage(error)
      if (attempt === locationRevision.current) setLocationError(message)
    } finally {
      if (attempt === locationRevision.current) {
        locationFlight.current = false
        setLocating(false)
      }
    }
  }

  return <section className="grid gap-ui-3 rounded-ui-md border border-border bg-card p-ui-4" aria-labelledby="explore-posts-title">
    <div className="flex flex-wrap items-center justify-between gap-ui-2">
      <h2 id="explore-posts-title" className="m-0 font-semibold">Bài viết công khai quanh bạn</h2>
      {preview && location && <Button variant="ghost" size="sm" onClick={onViewAll}>Xem tất cả bài viết</Button>}
    </div>
    <p className="m-0 text-sm text-muted-foreground">Tìm theo vị trí đăng bài, gần nhất trước. Vị trí của bạn chỉ được dùng để tìm kiếm, không bật hiển thị Quanh đây.</p>
    <div className="flex flex-wrap items-center gap-ui-2">
      <label className="flex items-center gap-ui-2 text-sm">Bán kính
        <select aria-label="Bán kính bài viết" className="min-h-10 rounded-ui-sm border border-border bg-card px-ui-2 text-foreground" value={radiusKm} onChange={event => setRadiusKm(Number(event.target.value))} disabled={locating}>
          {[1, 5, 10, 25, 50].map(radius => <option key={radius} value={radius}>{radius} km</option>)}
        </select>
      </label>
      <Button disabled={locating} onClick={() => void locate()}><MapPin size={16} />{location ? 'Cập nhật vị trí' : 'Tìm bài viết gần tôi'}</Button>
    </div>
    {locating && <p role="status" className="text-muted-foreground">Đang xác định vị trí…</p>}
    {locationError && <div role="alert" className="rounded-ui-sm border border-destructive/30 bg-destructive/5 p-ui-3 text-destructive">{locationError} <Button variant="secondary" size="sm" onClick={() => void locate()}>Thử lại</Button></div>}
    {location && <NearbyPostResults key={revision + ':' + radiusKm} request={request} location={location} radiusKm={radiusKm} preview={preview} />}
  </section>
}

function NearbyPostResults({ request, location, radiusKm, preview }: { request: ApiRequest; location: ExplorePostLocation; radiusKm: number; preview: boolean }) {
  const requestRef = useLatest(request)
  const [page, setPage] = useState<{ cursor: ExplorePostCursor | null; attempt: number }>({ cursor: null, attempt: 0 })
  const [result, setResult] = useState<{ posts: ExplorePost[]; attempt: number; error: string; nextCursor: ExplorePostCursor | null }>({ posts: [], attempt: -1, error: '', nextCursor: null })
  const { cursor, attempt } = page
  const loading = result.attempt !== attempt
  useEffect(() => {
    const controller = new AbortController()
    void listExplorePosts(requestRef.current, controller.signal, location, radiusKm, cursor).then(
      data => {
        if (controller.signal.aborted) return
        setResult(current => ({
          posts: cursor ? [...current.posts, ...data.posts.filter(post => !current.posts.some(existing => existing.id === post.id))] : data.posts,
          attempt, error: '', nextCursor: data.nextCursor,
        }))
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult(current => ({ ...current, attempt, error: error instanceof Error && error.message ? error.message : 'Không tải được bài viết công khai. Hãy kiểm tra kết nối mạng.' }))
      },
    )
    return () => controller.abort()
  }, [cursor, attempt, requestRef, location, radiusKm])

  const posts = preview ? result.posts.slice(0, 3) : result.posts
  return <>
    {posts.map(post => <article key={post.id} className="grid gap-ui-2 border-b border-border pb-ui-3">
      <div className="flex min-w-0 items-center gap-ui-2">
        <UserAvatar name={post.authorDisplayName || post.author} username={post.author} className="avatar size-10 shrink-0" />
        <div className="grid min-w-0 flex-1">
          <Link className="truncate font-semibold text-foreground no-underline hover:underline" to={'/users/' + encodeURIComponent(post.author)}>{post.authorDisplayName || post.author}</Link>
          <span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin size={14} aria-hidden="true" />{distanceLabel(post.distanceMeters)}</span>
        </div>
      </div>
      <p className="m-0 line-clamp-3 whitespace-pre-wrap break-words text-foreground">{post.content || 'Bài viết có tệp đính kèm'}</p>
      {post.attachments?.some(attachment => attachment.kind === 'image') && <Link to={'/feed/posts/' + post.id} aria-label="Xem ảnh bài viết">
        <img className="max-h-64 w-full rounded-ui-sm object-contain" src={post.attachments.find(attachment => attachment.kind === 'image')?.url} alt="" loading="lazy" />
      </Link>}
      <Link className="w-fit font-medium text-primary hover:underline" to={'/feed/posts/' + post.id}>Xem bài viết chi tiết</Link>
    </article>)}
    {loading ? <p role="status" className="m-0 text-muted-foreground">Đang tìm bài viết trong {radiusKm} km…</p>
      : result.error ? <div role="alert" className="flex flex-wrap items-center gap-ui-2 rounded-ui-sm border border-destructive/30 bg-destructive/5 p-ui-3 text-destructive">{result.error} <Button variant="secondary" size="sm" onClick={() => setPage(current => ({ ...current, attempt: current.attempt + 1 }))}>Thử lại</Button></div>
      : posts.length === 0 ? <p className="m-0 text-muted-foreground">Chưa có bài viết công khai trong {radiusKm} km. Hãy thử tăng bán kính.</p>
      : !preview && result.nextCursor ? <Button variant="secondary" onClick={() => setPage(current => ({ cursor: result.nextCursor, attempt: current.attempt + 1 }))}>Tải thêm bài viết</Button> : null}
  </>
}
