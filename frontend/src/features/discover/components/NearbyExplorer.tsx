import { useUiTranslation } from '@/shared/i18n/locale'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Users, Search, RefreshCw, Navigation, List, Map as MapIcon, ShieldCheck } from 'lucide-react'
const NearbyMap = lazy(() => import('./NearbyMap'))
import { loadNearbyPlaces, type NearbyPlace, type NearbyPlaceCategory } from '../lib/nearbyPlaces'
import { getCurrentPositionSmart, geolocationErrorMessage } from '../lib/geolocation'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary'

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
  peopleError?: string
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
const noPlaces: NearbyPlace[] = []
function distance(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return 'Chưa rõ khoảng cách'
  return value < 1 ? `${Math.max(1, Math.round(value * 100)) * 10} m` : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`
}

export default function NearbyExplorer({
  query, onQueryChange, users, peopleBusy, peopleScanning, peopleError, peopleActive, peopleRadiusKm, resultRadiusKm,
  onPeopleRadiusChange, onScanPeople, onStopPeople, friendActionBusy, onFriendAction, getFriendActionLabel,
}: Props) {
  const trUi = useUiTranslation()

  const [mode, setMode] = useState<'people' | 'places'>('people')
  const [view, setView] = useState<'list' | 'map'>('map')
  const listViewButton = useRef<HTMLButtonElement>(null)
  const shouldFocusListView = useRef(false)
  useEffect(() => {
    if (view !== 'list' || !shouldFocusListView.current) return
    shouldFocusListView.current = false
    listViewButton.current?.focus()
  }, [view])
  const [category, setCategory] = useState<NearbyPlaceCategory>('all')
  const [radius, setRadius] = useState(1)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const locationRevision = useRef(0)
  const locatingFlight = useRef(false)
  useEffect(() => () => { ++locationRevision.current; locatingFlight.current = false }, [])
  const [locationError, setLocationError] = useState('')
  const [reload, setReload] = useState(0)
  // Results belong to one set of search criteria; a retry with the same criteria keeps them on screen.
  const criteria = location ? `${location.latitude}:${location.longitude}:${radius}:${category}` : null
  const [places, setPlaces] = useScopedState<NearbyPlace[]>(criteria, noPlaces)
  const [selected, setSelected] = useScopedState<string | null>(criteria, null)
  // null while the current request is in flight, then '' or its error message.
  const requestKey = mode === 'places' && location ? `${criteria}:${reload}` : null
  const [result, setResult] = useScopedState<string | null>(requestKey, null)
  const loading = requestKey !== null && result === null
  const error = result ?? ''
  const normalized = query.trim().replace(/^@/, '').toLocaleLowerCase('vi-VN')
  const visibleUsers = useMemo(() => users.filter((user) =>
    `${user.displayName} ${user.username}`.toLocaleLowerCase('vi-VN').includes(normalized))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)), [users, normalized])
  const visiblePlaces = useMemo(() => places.filter((place) =>
    `${place.name} ${place.address || ''}`.toLocaleLowerCase('vi-VN').includes(normalized)), [places, normalized])
  const visibleSelected = visiblePlaces.some(place => place.id === selected) ? selected : null
  const busy = mode === 'people' ? peopleBusy || peopleScanning : loading || locating
  const count = mode === 'people' ? visibleUsers.length : visiblePlaces.length

  useEffect(() => {
    if (mode !== 'places' || !location) return
    const controller = new AbortController()
    loadNearbyPlaces({ ...location, radiusKm: radius, category, signal: controller.signal })
      .then((items) => { if (!controller.signal.aborted) { setPlaces(items); setResult('') } })
      .catch((reason) => { if (!controller.signal.aborted) setResult(reason instanceof Error ? reason.message : 'Không tải được địa điểm.') })
    return () => controller.abort()
  }, [location, category, radius, reload, mode, setPlaces, setResult])

  async function locate() {
    if (locatingFlight.current) return
    locatingFlight.current = true
    const revision = ++locationRevision.current
    setLocating(true); setLocationError('')
    try {
      const position = await getCurrentPositionSmart()
      if (revision === locationRevision.current) setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
    } catch (error) {
      const message = await geolocationErrorMessage(error)
      if (revision === locationRevision.current) setLocationError(message)
    } finally {
      if (revision === locationRevision.current) {
        locatingFlight.current = false
        setLocating(false)
      }
    }
  }

  async function scan() {
    await onScanPeople()
  }

  function showListAfterMapFailure() {
    shouldFocusListView.current = true
    setView('list')
  }

  function directions(place: NearbyPlace) {
    const from = location ? `${location.latitude},${location.longitude};` : ''
    window.open(`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(`${from}${place.latitude},${place.longitude}`)}`, '_blank', 'noopener,noreferrer')
  }

  return <section className="nearby-explorer" aria-label={trUi("common.ui.exploreNearby")}>
    <header className="nearby-heading">
      <h1>Quanh đây</h1>
      {mode === 'people' && <label className="nearby-visibility">
        <span>{trUi("common.show")}</span><input type="checkbox" role="switch" aria-label={trUi("common.ui.showNearby")} checked={peopleActive} disabled={busy} onChange={() => void (peopleActive ? onStopPeople() : scan())} />
      </label>}
    </header>
    <div className="nearby-mode" aria-label={trUi("search.resultType")}>
      <button aria-pressed={mode === 'people'} onClick={() => { setMode('people'); onQueryChange('') }}><Users size={18} />Người ở gần</button>
      <button aria-pressed={mode === 'places'} onClick={() => { setMode('places'); onQueryChange('') }}><MapPin size={18} />Địa điểm</button>
    </div>
    <div className="nearby-toolbar">
      <label className="nearby-search"><Search size={18} /><input aria-label={mode === 'people' ? trUi("common.ui.findNearbyPeople") : trUi("common.ui.findPlaces")} placeholder={mode === 'people' ? trUi("common.ui.nameUsername") : trUi("common.ui.placeAddress")} value={query} onChange={(event) => onQueryChange(event.target.value)} /></label>
      <label className="nearby-radius-field"><select aria-label={trUi("discover.searchRadius")} title={trUi("discover.searchRadius")} value={mode === 'people' ? peopleRadiusKm : radius} disabled={mode === 'people' ? busy : locating} onChange={(event) => mode === 'people' ? onPeopleRadiusChange(Number(event.target.value)) : setRadius(Number(event.target.value))}>
        {(mode === 'people' ? [1, 5, 10, 25, 50] : [0.5, 1, 3, 5]).map((value) => <option key={value} value={value}>{value < 1 ? '500 m' : `${value} km`}</option>)}
      </select></label>
      <button className="nearby-refresh" disabled={busy} title={trUi("discover.searchAgain")} aria-label={trUi("discover.searchAgain")} onClick={() => void (mode === 'people' ? scan() : location ? setReload((value) => value + 1) : locate())}><RefreshCw size={19} /></button>
    </div>
    {mode === 'places' && <div className="nearby-categories" aria-label={trUi("common.ui.placeType")}>{categories.map((item) =>
      <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div>}
    {mode === 'people' && <p className="nearby-privacy"><ShieldCheck size={16} />Vị trí chính xác của bạn không được chia sẻ.</p>}
    {mode === 'people' && peopleScanning && <p role="status" aria-live="polite" aria-busy="true">Đang xác định vị trí và tìm người quanh đây…</p>}
    {mode === 'people' && peopleError && <div className="nearby-error" role="alert">{peopleError}<button type="button" disabled={busy} onClick={() => void scan()}>{trUi("common.retry")}</button></div>}
    {locating && mode === 'places' && <p role="status" aria-live="polite" aria-busy="true">{trUi("discover.locating")}</p>}
    {loading && mode === 'places' && <p role="status" aria-live="polite" aria-busy="true">Đang tải địa điểm…</p>}
    {locationError && mode === 'places' && <p className="nearby-error" role="alert">{locationError}</p>}
    {error && mode === 'places' && <div className="nearby-error" role="alert">{error}<button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)}>{trUi("common.retry")}</button></div>}
    <div className="nearby-results-heading">
      <strong>{count} {mode === 'people' ? 'người' : 'địa điểm'}</strong>
      {mode === 'people' ? <span>{users.length ? `Trong ${resultRadiusKm} km · gần nhất trước` : ''}</span> : <div className="nearby-view">
        <button ref={listViewButton} title={trUi("common.list")} aria-label={trUi("common.list")} aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={18} /></button>
        <button title={trUi("discover.map")} aria-label={trUi("discover.map")} aria-pressed={view === 'map'} onClick={() => setView('map')}><MapIcon size={18} /></button>
      </div>}
    </div>
    {mode === 'people' && users.length > 0 && resultRadiusKm !== peopleRadiusKm && <p className="nearby-privacy">Bán kính đã đổi. Kết quả vẫn thuộc lần tìm trước; nhấn Tìm lại để quét bán kính mới.</p>}
    {mode === 'people' ? <div className="nearby-people-list">
      {!count && !busy && !peopleError && <div className="nearby-empty">
        <Users size={36} /><h2>{normalized ? trUi("discover.noMatch") : peopleActive ? 'Chưa có ai ở gần' : 'Tìm người ở gần bạn'}</h2>
        <p>{normalized ? 'Thử tên khác hoặc xóa tìm kiếm.' : peopleActive ? 'Thử tăng bán kính hoặc tìm lại sau.' : 'Chỉ người từng bật Quanh đây và còn lưu vị trí mới xuất hiện. Bật tìm kiếm cũng cho phép người khác tìm thấy bạn.'}</p>
        <button className="nearby-primary" onClick={() => normalized ? onQueryChange('') : void scan()}>{normalized ? trUi("common.clearSearch") : peopleActive ? trUi("discover.searchAgain") : 'Bật và tìm người'}</button>
      </div>}
      {visibleUsers.map((user) => <article className="nearby-person" key={user.id}>
        <div className="nearby-avatar" aria-hidden="true">{(user.displayName || user.username).trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase()}</div>
        <div className="nearby-person-copy"><strong>{user.displayName || user.username}</strong><span>@{user.username}</span><small><MapPin size={13} />{distance(user.distanceKm)}<i className={user.online ? 'online' : ''} />{user.online ? trUi("profile.active") : trUi("common.offline")}</small></div>
        <button className="nearby-connect" disabled={friendActionBusy === user.id || getFriendActionLabel(user) === 'Đã gửi'} onClick={() => void onFriendAction(user)}>{getFriendActionLabel(user)}</button>
      </article>)}
    </div> : <>
      {!location && !busy && <div className="nearby-empty"><MapPin size={36} /><h2>Tìm địa điểm gần bạn</h2><button className="nearby-primary" onClick={() => void locate()}>Dùng vị trí hiện tại</button></div>}
      {location && <div className={`nearby-place-content${view === 'map' ? ' map-view' : ''}`}>
      {view === 'map' && <ErrorBoundary fallback={() => <div className="nearby-map nearby-map-fallback"><div className="nearby-map-error" role="alert">Không thể hiển thị bản đồ.<button type="button" onClick={showListAfterMapFailure}>{trUi("discover.listView")}</button></div></div>}><Suspense fallback={<p role="status" aria-live="polite" aria-busy="true">{trUi("discover.loadingMap")}</p>}><NearbyMap location={location} places={visiblePlaces} selected={visibleSelected} onSelect={setSelected} onShowList={showListAfterMapFailure} /></Suspense></ErrorBoundary>}
      <div className="nearby-place-list" aria-label={trUi("common.ui.placeResults")}>
      {location && !busy && !error && !count && <div className="nearby-empty"><Search size={30} /><h2>{normalized ? trUi("discover.noMatch") : 'Chưa tìm thấy địa điểm'}</h2><p>{normalized ? 'Thử từ khóa khác hoặc xóa tìm kiếm.' : 'Thử tăng bán kính hoặc tìm lại.'}</p>{normalized && <button type="button" className="nearby-primary" onClick={() => onQueryChange('')}>{trUi("common.clearSearch")}</button>}</div>}
      {visiblePlaces.map((place, index) => <article key={place.id} className={`nearby-place-row${place.id === visibleSelected ? ' selected' : ''}`}>
        <button className="nearby-place-number" aria-label={trUi("common.ui.viewOnMap", { v1: String(place.name) })} aria-pressed={place.id === visibleSelected} onClick={() => { setSelected(place.id); setView('map') }}>{index + 1}</button>
        <div><strong>{place.name}</strong><span>{categories.find((item) => item.id === place.category)?.label} · {distance(place.distanceKm)}</span>{place.address && <small>{place.address}</small>}{place.openingHours && <small>{place.openingHours}</small>}</div>
        <button className="nearby-route" title={trUi("common.ui.directionsTo", { v1: String(place.name) })} aria-label={trUi("common.ui.directionsTo", { v1: String(place.name) })} onClick={() => directions(place)}><Navigation size={19} /></button>
      </article>)}</div>
      </div>}
      {location && view === 'list' && <p className="nearby-source">Dữ liệu © OpenStreetMap</p>}
    </>}
  </section>
}