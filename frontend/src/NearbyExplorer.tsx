import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Users, Search, RefreshCw, Navigation, List, Map as MapIcon, LocateFixed, Plus, Minus, ShieldCheck } from 'lucide-react'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadNearbyPlaces, type NearbyPlace, type NearbyPlaceCategory } from './nearbyPlaces'

export type NearbyUser = {
  id: number
  username: string
  displayName: string
  online: boolean
  distanceKm?: number
  nearbyActive?: boolean
  locationUpdatedAt?: string
}

type Props = {
  query: string
  onQueryChange: (value: string) => void
  users: NearbyUser[]
  peopleBusy: boolean
  peopleScanning: boolean
  peopleActive: boolean
  peopleRadiusKm: number
  resultRadiusKm: number
  onPeopleRadiusChange: (radius: number) => void
  onScanPeople: () => Promise<void> | void
  onStopPeople: () => Promise<void> | void
  friendActionBusy: number | null
  onFriendAction: (user: NearbyUser) => Promise<void> | void
  getFriendActionLabel: (user: NearbyUser) => string
}

const categories: { id: NearbyPlaceCategory; label: string }[] = [
  { id: 'all', label: 'Tất cả' }, { id: 'food', label: 'Ăn uống' }, { id: 'cafe', label: 'Cà phê' },
  { id: 'services', label: 'Dịch vụ' }, { id: 'stay', label: 'Lưu trú' }, { id: 'health', label: 'Y tế' },
  { id: 'education', label: 'Giáo dục' }, { id: 'shopping', label: 'Mua sắm' },
]
maplibregl.setWorkerUrl(maplibreWorkerUrl)

function distance(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return 'Chưa rõ khoảng cách'
  return value < 1 ? `${Math.max(1, Math.round(value * 100)) * 10} m` : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`
}

function NearbyMap({ location, places, selected, onSelect }: {
  location: { latitude: number; longitude: number }
  places: NearbyPlace[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!container.current) return
    setFailed(false)
    let instance: maplibregl.Map
    try {
      instance = new maplibregl.Map({
        container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [location.longitude, location.latitude], zoom: 14,
      })
    } catch { setFailed(true); return }
    map.current = instance
    const resize = new ResizeObserver(() => instance.resize())
    resize.observe(container.current)
    instance.on('error', () => { if (!instance.isStyleLoaded()) setFailed(true) })
    instance.on('load', () => setFailed(false))
    new maplibregl.Marker({ color: '#2464ba' }).setLngLat([location.longitude, location.latitude]).addTo(instance)
    return () => { resize.disconnect(); instance.remove(); map.current = null }
  }, [location, attempt])

  useEffect(() => {
    if (!map.current) return
    const instance = map.current
    const markers = places.map((place, index) => {
      const button = document.createElement('button')
      button.className = `nearby-place-marker${selected === place.id ? ' selected' : ''}`
      button.type = 'button'
      button.textContent = String(index + 1)
      button.title = place.name
      button.setAttribute('aria-label', place.name)
      button.onclick = () => onSelect(place.id)
      return new maplibregl.Marker({ element: button }).setLngLat([place.longitude, place.latitude]).addTo(instance)
    })
    const place = places.find((item) => item.id === selected)
    if (place) instance.easeTo({ center: [place.longitude, place.latitude], duration: 300 })
    return () => markers.forEach((marker) => marker.remove())
  }, [places, selected, onSelect, location, attempt])

  return <div className="nearby-map">
    <div ref={container} className="nearby-map-canvas" />
    {failed && <div className="nearby-map-error" role="status">Không tải được bản đồ. Danh sách vẫn dùng được.<button onClick={() => setAttempt((value) => value + 1)}>Thử lại</button></div>}
    <div className="nearby-map-controls">
      <button title="Về vị trí của tôi" aria-label="Về vị trí của tôi" onClick={() => map.current?.easeTo({ center: [location.longitude, location.latitude], zoom: 14 })}><LocateFixed size={20} /></button>
      <button title="Phóng to" aria-label="Phóng to" onClick={() => map.current?.zoomIn()}><Plus size={20} /></button>
      <button title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => map.current?.zoomOut()}><Minus size={20} /></button>
    </div>
  </div>
}

export default function NearbyExplorer({
  query, onQueryChange, users, peopleBusy, peopleScanning, peopleActive, peopleRadiusKm, resultRadiusKm,
  onPeopleRadiusChange, onScanPeople, onStopPeople, friendActionBusy, onFriendAction, getFriendActionLabel,
}: Props) {
  const [mode, setMode] = useState<'people' | 'places'>('people')
  const [view, setView] = useState<'list' | 'map'>('map')
  const [category, setCategory] = useState<NearbyPlaceCategory>('all')
  const [radius, setRadius] = useState(1)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const normalized = query.trim().replace(/^@/, '').toLocaleLowerCase('vi-VN')
  const visibleUsers = useMemo(() => users.filter((user) =>
    `${user.displayName} ${user.username}`.toLocaleLowerCase('vi-VN').includes(normalized))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)), [users, normalized])
  const visiblePlaces = useMemo(() => places.filter((place) =>
    `${place.name} ${place.address || ''}`.toLocaleLowerCase('vi-VN').includes(normalized)), [places, normalized])
  const busy = mode === 'people' ? peopleBusy || peopleScanning : loading || locating
  const count = mode === 'people' ? visibleUsers.length : visiblePlaces.length

  useEffect(() => {
    if (mode !== 'places' || !location) return
    const controller = new AbortController()
    setLoading(true); setError(''); setPlaces([]); setSelected(null)
    loadNearbyPlaces({ ...location, radiusKm: radius, category, signal: controller.signal })
      .then((items) => { if (!controller.signal.aborted) setPlaces(items) })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được địa điểm.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [location, category, radius, reload, mode])

  async function locate() {
    if (locating) return
    setLocating(true); setLocationError('')
    try {
      if (!navigator.geolocation) throw new Error('Thiết bị không hỗ trợ định vị.')
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }))
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
    } catch {
      setLocationError('Chưa lấy được vị trí. Kiểm tra quyền vị trí và GPS rồi thử lại.')
    } finally { setLocating(false) }
  }

  async function scan() {
    await onScanPeople()
  }

  function directions(place: NearbyPlace) {
    const from = location ? `${location.latitude},${location.longitude};` : ''
    window.open(`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(`${from}${place.latitude},${place.longitude}`)}`, '_blank', 'noopener,noreferrer')
  }

  return <section className="nearby-explorer" aria-label="Khám phá quanh đây">
    <header className="nearby-heading">
      <h1>Quanh đây</h1>
      {mode === 'people' && <label className="nearby-visibility">
        <span>Hiển thị</span><input type="checkbox" role="switch" aria-label="Hiển thị quanh đây" checked={peopleActive} disabled={busy} onChange={() => void (peopleActive ? onStopPeople() : scan())} />
      </label>}
    </header>
    <div className="nearby-mode" aria-label="Loại kết quả">
      <button aria-pressed={mode === 'people'} onClick={() => { setMode('people'); onQueryChange('') }}><Users size={18} />Người ở gần</button>
      <button aria-pressed={mode === 'places'} onClick={() => { setMode('places'); onQueryChange('') }}><MapPin size={18} />Địa điểm</button>
    </div>
    <div className="nearby-toolbar">
      <label className="nearby-search"><Search size={18} /><input aria-label={mode === 'people' ? 'Tìm người quanh đây' : 'Tìm địa điểm'} placeholder={mode === 'people' ? 'Tên hoặc @username' : 'Tên địa điểm hoặc địa chỉ'} value={query} onChange={(event) => onQueryChange(event.target.value)} /></label>
      <label className="nearby-radius-field"><select aria-label="Bán kính tìm kiếm" title="Bán kính tìm kiếm" value={mode === 'people' ? peopleRadiusKm : radius} disabled={busy} onChange={(event) => mode === 'people' ? onPeopleRadiusChange(Number(event.target.value)) : setRadius(Number(event.target.value))}>
        {(mode === 'people' ? [1, 5, 10, 25, 50] : [0.5, 1, 3, 5]).map((value) => <option key={value} value={value}>{value < 1 ? '500 m' : `${value} km`}</option>)}
      </select></label>
      <button className="nearby-refresh" disabled={busy} title="Tìm lại" aria-label="Tìm lại" onClick={() => void (mode === 'people' ? scan() : location ? setReload((value) => value + 1) : locate())}><RefreshCw size={19} className={busy ? 'spinning' : ''} /></button>
    </div>
    {mode === 'places' && <div className="nearby-categories" aria-label="Loại địa điểm">{categories.map((item) =>
      <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div>}
    {mode === 'people' && <p className="nearby-privacy"><ShieldCheck size={16} />Vị trí chính xác của bạn không được chia sẻ.</p>}
    {locationError && mode === 'places' && <p className="nearby-error" role="alert">{locationError}</p>}
    {error && mode === 'places' && <div className="nearby-error" role="alert">{error}<button onClick={() => setReload((value) => value + 1)}>Thử lại</button></div>}
    <div className="nearby-results-heading">
      <strong role="status">{busy ? locating ? 'Đang lấy vị trí...' : 'Đang cập nhật...' : `${count} ${mode === 'people' ? 'người' : 'địa điểm'}`}</strong>
      {mode === 'people' ? <span>{users.length ? `Trong ${resultRadiusKm} km · gần nhất trước` : ''}</span> : <div className="nearby-view">
        <button title="Danh sách" aria-label="Danh sách" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={18} /></button>
        <button title="Bản đồ" aria-label="Bản đồ" aria-pressed={view === 'map'} onClick={() => setView('map')}><MapIcon size={18} /></button>
      </div>}
    </div>
    {mode === 'people' && users.length > 0 && resultRadiusKm !== peopleRadiusKm && <p className="nearby-privacy">Bán kính đã đổi. Kết quả vẫn thuộc lần tìm trước.</p>}
    {mode === 'people' ? <div className="nearby-people-list">
      {!count && !busy && <div className="nearby-empty">
        <Users size={36} /><h2>{normalized ? 'Không khớp tìm kiếm' : peopleActive ? 'Chưa có ai ở gần' : 'Tìm người ở gần bạn'}</h2>
        <p>{normalized ? 'Thử tên khác hoặc xóa tìm kiếm.' : peopleActive ? 'Thử tăng bán kính hoặc tìm lại sau.' : 'Chỉ người bật Quanh đây mới xuất hiện trong kết quả.'}</p>
        <button className="nearby-primary" onClick={() => normalized ? onQueryChange('') : void scan()}>{normalized ? 'Xóa tìm kiếm' : peopleActive ? 'Tìm lại' : 'Bật và tìm người'}</button>
      </div>}
      {visibleUsers.map((user) => <article className="nearby-person" key={user.id}>
        <div className="nearby-avatar" aria-hidden="true">{(user.displayName || user.username).trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase()}</div>
        <div className="nearby-person-copy"><strong>{user.displayName || user.username}</strong><span>@{user.username}</span><small><MapPin size={13} />{distance(user.distanceKm)}<i className={user.online ? 'online' : ''} />{user.online ? 'Đang hoạt động' : 'Ngoại tuyến'}</small></div>
        <button className="nearby-connect" disabled={friendActionBusy === user.id || getFriendActionLabel(user) === 'Đã gửi'} onClick={() => void onFriendAction(user)}>{getFriendActionLabel(user)}</button>
      </article>)}
    </div> : <>
      {!location && !busy && <div className="nearby-empty"><MapPin size={36} /><h2>Tìm địa điểm gần bạn</h2><button className="nearby-primary" onClick={() => void locate()}>Dùng vị trí hiện tại</button></div>}
      {location && <div className={`nearby-place-content${view === 'map' ? ' map-view' : ''}`}>
      {view === 'map' && <NearbyMap location={location} places={visiblePlaces} selected={selected} onSelect={setSelected} />}
      <div className="nearby-place-list" aria-label="Kết quả địa điểm">
      {location && !busy && !error && !count && <div className="nearby-empty"><Search size={30} /><h2>Chưa tìm thấy địa điểm</h2><p>Thử từ khóa khác hoặc tăng bán kính.</p></div>}
      {visiblePlaces.map((place, index) => <article key={place.id} className={`nearby-place-row${place.id === selected ? ' selected' : ''}`}>
        <button className="nearby-place-number" aria-label={`Xem ${place.name} trên bản đồ`} onClick={() => { setSelected(place.id); setView('map') }}>{index + 1}</button>
        <div><strong>{place.name}</strong><span>{categories.find((item) => item.id === place.category)?.label} · {distance(place.distanceKm)}</span>{place.address && <small>{place.address}</small>}{place.openingHours && <small>{place.openingHours}</small>}</div>
        <button className="nearby-route" title={`Chỉ đường đến ${place.name}`} aria-label={`Chỉ đường đến ${place.name}`} onClick={() => directions(place)}><Navigation size={19} /></button>
      </article>)}</div>
      </div>}
      {location && view === 'list' && <p className="nearby-source">Dữ liệu © OpenStreetMap</p>}
    </>}
  </section>
}
