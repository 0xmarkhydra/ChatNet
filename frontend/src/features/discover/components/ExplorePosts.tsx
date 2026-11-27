import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, FileText, Globe, LocateFixed, MapPin, SlidersHorizontal } from 'lucide-react'
import type { ApiRequest } from '../../../shared/types/api'
import { useLatest } from '../../../shared/hooks/useLatest'
import UserAvatar from '../../../shared/ui/UserAvatar'
import MediaAttachmentsView from '../../../shared/ui/MediaAttachmentsView'
import { feedPostPath } from '../../../shared/utils/feedPostPath'
import { parsePostExtras, PostExtrasView } from '../../feed'
import { Button } from '../../../shared/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '../../../shared/ui/dropdown-menu'
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

  return <section className="mx-auto grid w-full max-w-[640px] min-w-0 gap-ui-3" aria-labelledby="explore-posts-title">
    <div className="grid gap-ui-3 rounded-ui-lg border border-border bg-card p-ui-4 shadow-ui-sm">
      <div className="flex flex-wrap items-center justify-between gap-ui-2">
        <div className="flex min-w-0 items-center gap-ui-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-ui-md bg-secondary text-primary"><MapPin size={20} aria-hidden="true" /></span>
          <div className="grid min-w-0 gap-1">
            <h2 id="explore-posts-title" className="text-ui-section!">Bài viết quanh bạn</h2>
            <span className="text-ui-caption text-muted-foreground">Công khai · Gần nhất trước</span>
          </div>
        </div>
        {preview && location && <Button variant="ghost" size="sm" onClick={onViewAll}>Xem tất cả bài viết <ArrowRight size={16} aria-hidden="true" /></Button>}
      </div>
      <div className="flex flex-wrap items-center gap-ui-2">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={locating} aria-label="Bán kính bài viết" className="group min-h-control-touch gap-ui-2 rounded-ui-md bg-muted px-ui-3 font-normal data-[state=open]:border-primary data-[state=open]:bg-secondary">
              <SlidersHorizontal size={16} className="text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">Bán kính</span>
              <span className="font-semibold tabular-nums">{radiusKm} km</span>
              <ChevronDown size={16} className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} collisionPadding={12} className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-44 rounded-ui-lg p-ui-1 shadow-ui-overlay">
            <DropdownMenuLabel>Khoảng cách tìm kiếm</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={String(radiusKm)} onValueChange={value => setRadiusKm(Number(value))}>
              {[1, 5, 10, 25, 50].map(radius => <DropdownMenuRadioItem key={radius} value={String(radius)}>{radius} km</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button className="min-h-control-touch flex-1" disabled={locating} onClick={() => void locate()}><LocateFixed size={17} />{location ? 'Cập nhật vị trí' : 'Tìm bài viết gần tôi'}</Button>
      </div>
      <p className="text-ui-caption leading-relaxed">Vị trí chỉ dùng để tìm bài viết gần bạn, không bật hiển thị Quanh đây.</p>
      {locating && <p role="status" className="text-ui-label">Đang xác định vị trí…</p>}
      {locationError && <div role="alert" className="grid gap-ui-2 rounded-ui-sm border border-destructive/30 bg-destructive/5 p-ui-3 text-destructive">{locationError} <Button variant="secondary" size="sm" onClick={() => void locate()}>Thử lại</Button></div>}
    </div>
    {!location && !locating && !locationError && <div className="grid justify-items-center gap-ui-2 rounded-ui-lg border border-border bg-card p-ui-6 text-center">
      <span className="grid size-12 place-items-center rounded-ui-lg bg-muted text-muted-foreground"><FileText size={23} aria-hidden="true" /></span>
      <strong className="text-ui-body">Khám phá những chia sẻ ở gần bạn</strong>
      <p className="text-ui-label leading-relaxed">Chọn bán kính và dùng vị trí hiện tại để bắt đầu.</p>
    </div>}
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
    <div className="grid min-w-0 gap-ui-3" aria-busy={loading}>
      {posts.map(post => <NearbyPostCard key={post.id} post={post} />)}
    </div>
    {loading ? <p role="status" className="rounded-ui-lg border border-border bg-card p-ui-4 text-center text-ui-label">Đang tìm bài viết trong {radiusKm} km…</p>
      : result.error ? <div role="alert" className="flex flex-wrap items-center gap-ui-2 rounded-ui-sm border border-destructive/30 bg-destructive/5 p-ui-3 text-destructive">{result.error} <Button variant="secondary" size="sm" onClick={() => setPage(current => ({ ...current, attempt: current.attempt + 1 }))}>Thử lại</Button></div>
      : posts.length === 0 ? <p className="rounded-ui-lg border border-border bg-card p-ui-4 text-center text-ui-label leading-relaxed">Chưa có bài viết công khai trong {radiusKm} km. Hãy thử tăng bán kính.</p>
      : !preview && result.nextCursor ? <Button variant="outline" className="min-h-control-touch w-full" onClick={() => setPage(current => ({ cursor: result.nextCursor, attempt: current.attempt + 1 }))}>Tải thêm bài viết</Button> : null}
  </>
}

function NearbyPostCard({ post }: { post: ExplorePost }) {
  const navigate = useNavigate()
  const extras = parsePostExtras(post.content)
  const postPath = feedPostPath(post.id)
  const profilePath = (username: string) => '/users/' + encodeURIComponent(username)

  return <article className="grid min-w-0 gap-ui-3 overflow-hidden rounded-ui-lg border border-border bg-card p-ui-4 shadow-ui-sm">
    <header className="flex min-w-0 items-center gap-ui-3">
      <Link to={profilePath(post.author)} aria-label={'Xem hồ sơ ' + (post.authorDisplayName || post.author)} className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring">
        <UserAvatar name={post.authorDisplayName || post.author} username={post.author} className="avatar size-10 shrink-0" />
      </Link>
      <div className="grid min-w-0 flex-1 gap-1">
        <Link className="truncate text-ui-body font-semibold text-foreground no-underline hover:underline" to={profilePath(post.author)}>{post.authorDisplayName || post.author}</Link>
        <span className="flex items-center gap-1 text-ui-caption text-muted-foreground"><Globe size={13} aria-hidden="true" /> Công khai</span>
      </div>
      <span className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full bg-secondary px-ui-2 py-1 text-ui-caption font-semibold text-primary"><MapPin size={14} aria-hidden="true" />{distanceLabel(post.distanceMeters)}</span>
    </header>
    <div className="grid min-w-0 gap-ui-2">
      <PostExtrasView extras={extras} onAuthorOpen={username => navigate(profilePath(username))} />
      {extras.caption && <div className="line-clamp-5 whitespace-pre-wrap wrap-anywhere text-ui-body leading-relaxed text-foreground">{extras.caption}</div>}
    </div>
    {!!post.attachments?.length && <div className="min-w-0 overflow-hidden rounded-ui-md bg-muted [&_.media-attachments]:m-0! [&_.media-attachments]:w-full! [&_.media-attachments]:max-w-none! [&_.media-count-1_.media-item_img]:max-h-[360px]! [&_.media-count-1_.media-item_img]:w-full! [&_.media-count-1_.media-item_img]:h-auto! [&_.media-count-1_.media-item_img]:object-contain! [&_.media-count-1_.media-item_video]:max-h-[360px]!">
      <MediaAttachmentsView items={post.attachments} onImageClick={() => navigate(postPath)} />
    </div>}
    <div className="border-t border-border-subtle pt-ui-2">
      <Button asChild variant="ghost" className="min-h-control-touch w-full justify-between text-muted-foreground hover:text-primary">
        <Link to={postPath} className="no-underline">Xem bài viết chi tiết <ArrowRight size={17} aria-hidden="true" /></Link>
      </Button>
    </div>
  </article>
}