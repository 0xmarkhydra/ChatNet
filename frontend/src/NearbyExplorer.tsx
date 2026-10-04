import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
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

type DiscoveryCategory = 'people' | NearbyPlaceCategory
type ViewMode = 'map' | 'list'
type NoticeKind = 'success' | 'error' | 'warning' | 'info'

type Props = {
  query: string
  onQueryChange: (value: string) => void
  users: NearbyUser[]
  peopleBusy: boolean
  peopleScanning: boolean
  peopleActive: boolean
  peopleRadiusKm: number
  onPeopleRadiusChange: (radius: number) => void
  onScanPeople: () => Promise<void> | void
  onStopPeople: () => Promise<void> | void
  friendActionBusy: number | null
  onFriendAction: (user: NearbyUser) => Promise<void> | void
  getFriendActionLabel: (user: NearbyUser) => string
  onNotice: (message: string, kind?: NoticeKind) => void
}

const fallbackCenter: [number, number] = [105.8342, 21.0278]
const categoryStorageKey = 'chatnet-nearby-category'
const placeRadiusStorageKey = 'chatnet-nearby-place-radius'

const categories: Array<{ id: DiscoveryCategory; icon: string; label: string }> = [
  { id: 'all', icon: '⌖', label: 'Tất cả' },
  { id: 'people', icon: '👥', label: 'Người' },
  { id: 'food', icon: '🍜', label: 'Ăn uống' },
  { id: 'cafe', icon: '☕', label: 'Cafe' },
  { id: 'services', icon: '✂️', label: 'Dịch vụ' },
  { id: 'stay', icon: '🏨', label: 'Lưu trú' },
  { id: 'health', icon: '🏥', label: 'Y tế' },
  { id: 'education', icon: '🏫', label: 'Giáo dục' },
  { id: 'shopping', icon: '🛍️', label: 'Mua sắm' },
]

const categoryIcon: Record<NearbyPlaceCategory, string> = {
  all: '📍',
  food: '🍜',
  cafe: '☕',
  services: '✂️',
  stay: '🏨',
  health: '🏥',
  education: '🏫',
  shopping: '🛍️',
}

const peopleVisualPositions = [
  { left: 22, top: 34 },
  { left: 73, top: 29 },
  { left: 63, top: 61 },
  { left: 29, top: 68 },
  { left: 49, top: 43 },
]

function savedCategory(): DiscoveryCategory {
  if (typeof window === 'undefined') return 'all'
  const value = window.localStorage.getItem(categoryStorageKey) as DiscoveryCategory | null
  return categories.some((item) => item.id === value) ? value as DiscoveryCategory : 'all'
}

function savedPlaceRadius() {
  if (typeof window === 'undefined') return 1
  const value = Number(window.localStorage.getItem(placeRadiusStorageKey))
  return [0.5, 1, 3, 5].includes(value) ? value : 1
}

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

function distanceLabel(distanceKm?: number) {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return 'Gần bạn'
  if (distanceKm < 1) return `~${Math.max(10, Math.round(distanceKm * 1000 / 10) * 10)} m`
  return `~${distanceKm.toLocaleString('vi-VN', { maximumFractionDigits: distanceKm >= 10 ? 0 : 1 })} km`
}

function osmStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  }
}

export default function NearbyExplorer({
  query,
  onQueryChange,
  users,
  peopleBusy,
  peopleScanning,
  peopleActive,
  peopleRadiusKm,
  onPeopleRadiusChange,
  onScanPeople,
  onStopPeople,
  friendActionBusy,
  onFriendAction,
  getFriendActionLabel,
  onNotice,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const placeMarkersRef = useRef<maplibregl.Marker[]>([])
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const placesAbortRef = useRef<AbortController | null>(null)
  const previousPeopleCountRef = useRef(users.length)

  const [category, setCategory] = useState<DiscoveryCategory>(savedCategory)
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationBusy, setLocationBusy] = useState(false)
  const [placeRadiusKm, setPlaceRadiusKmState] = useState(savedPlaceRadius)
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [placesBusy, setPlacesBusy] = useState(false)
  const [placesError, setPlacesError] = useState('')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [peopleSheetExpanded, setPeopleSheetExpanded] = useState(category === 'people' && users.length > 0)
  const [peopleRadiusOpen, setPeopleRadiusOpen] = useState(false)

  const selectedPlace = places.find((place) => place.id === selectedPlaceId) || null
  const selectedUser = users.find((user) => user.id === selectedUserId) || null
  const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN')

  const visiblePlaces = useMemo(() => !normalizedQuery
    ? places
    : places.filter((place) =>
        [place.name, place.kind, place.address || ''].some((value) =>
          value.toLocaleLowerCase('vi-VN').includes(normalizedQuery))),
    [normalizedQuery, places])

  const visibleUsers = useMemo(() => {
    const normalized = normalizedQuery.replace(/^@/, '')
    const filtered = !normalized
      ? users
      : users.filter((user) =>
          user.username.toLocaleLowerCase('vi-VN').includes(normalized) ||
          user.displayName.toLocaleLowerCase('vi-VN').includes(normalized))
    return filtered.slice().sort(
      (left, right) => (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY),
    )
  }, [normalizedQuery, users])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: osmStyle(),
      center: fallbackCenter,
      zoom: 13,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    mapRef.current = map
    return () => {
      placeMarkersRef.current.forEach((marker) => marker.remove())
      placeMarkersRef.current = []
      locationMarkerRef.current?.remove()
      locationMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !location) return
    const element = document.createElement('div')
    element.className = 'nearby-map-location'
    element.setAttribute('aria-label', 'Vị trí của bạn')
    element.innerHTML = '<span></span>'
    locationMarkerRef.current?.remove()
    locationMarkerRef.current = new maplibregl.Marker({ element })
      .setLngLat([location.longitude, location.latitude])
      .addTo(map)
    map.easeTo({
      center: [location.longitude, location.latitude],
      zoom: Math.max(map.getZoom(), 14),
      duration: 650,
    })
  }, [location])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    placeMarkersRef.current.forEach((marker) => marker.remove())
    placeMarkersRef.current = []
    if (category === 'people') return

    visiblePlaces.slice(0, 42).forEach((place) => {
      const element = document.createElement('button')
      element.type = 'button'
      element.className = `nearby-map-pin${selectedPlaceId === place.id ? ' active' : ''}`
      element.title = place.name
      element.setAttribute('aria-label', place.name)
      const icon = document.createElement('span')
      icon.textContent = categoryIcon[place.category]
      element.appendChild(icon)
      element.addEventListener('click', (event) => {
        event.stopPropagation()
        setSelectedPlaceId(place.id)
        map.easeTo({ center: [place.longitude, place.latitude], duration: 380 })
      })
      placeMarkersRef.current.push(
        new maplibregl.Marker({ element, anchor: 'bottom' })
          .setLngLat([place.longitude, place.latitude])
          .addTo(map),
      )
    })

    return () => {
      placeMarkersRef.current.forEach((marker) => marker.remove())
      placeMarkersRef.current = []
    }
  }, [category, selectedPlaceId, visiblePlaces])

  useEffect(() => {
    if (!location || category === 'people') return
    const controller = new AbortController()
    placesAbortRef.current?.abort()
    placesAbortRef.current = controller
    setPlacesBusy(true)
    setPlacesError('')

    void loadNearbyPlaces({
      latitude: location.latitude,
      longitude: location.longitude,
      radiusKm: placeRadiusKm,
      category,
      signal: controller.signal,
    })
      .then((items) => {
        if (controller.signal.aborted) return
        setPlaces(items)
        setSelectedPlaceId((current) => current && items.some((item) => item.id === current) ? current : null)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setPlaces([])
        setPlacesError(error instanceof Error ? error.message : 'Chưa tải được địa điểm quanh đây.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlacesBusy(false)
      })

    return () => controller.abort()
  }, [category, location, placeRadiusKm])

  useEffect(() => {
    if (category === 'people' && !peopleScanning && users.length > 0) {
      const countChanged = users.length !== previousPeopleCountRef.current
      if (countChanged || !peopleSheetExpanded) setPeopleSheetExpanded(true)
    }
    previousPeopleCountRef.current = users.length
  }, [category, peopleScanning, peopleSheetExpanded, users.length])

  useEffect(() => {
    if (selectedUserId !== null && !users.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(null)
    }
  }, [selectedUserId, users])

  async function locate() {
    if (locationBusy) return location
    if (!navigator.geolocation) {
      onNotice('Thiết bị này không hỗ trợ định vị.', 'error')
      return null
    }

    setLocationBusy(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        }))
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }
      setLocation(next)
      return next
    } catch (error) {
      const code = (error as GeolocationPositionError | undefined)?.code
      onNotice(
        code === 1
          ? 'ChatNet cần quyền vị trí để khám phá quanh bạn. Hãy cho phép Location rồi thử lại.'
          : 'Chưa lấy được vị trí hiện tại. Hãy kiểm tra GPS/Wi‑Fi và thử lại.',
        'error',
      )
      return null
    } finally {
      setLocationBusy(false)
    }
  }

  async function handlePeopleScan() {
    setSelectedUserId(null)
    setPeopleRadiusOpen(false)
    if (!location) await locate()
    await onScanPeople()
  }

  function chooseCategory(nextCategory: DiscoveryCategory) {
    setCategory(nextCategory)
    window.localStorage.setItem(categoryStorageKey, nextCategory)
    setSelectedPlaceId(null)
    setSelectedUserId(null)
    setPeopleRadiusOpen(false)
    setViewMode('map')

    if (nextCategory === 'people') {
      setPeopleSheetExpanded(users.length > 0)
      return
    }

    setPeopleSheetExpanded(false)
    if (location) {
      mapRef.current?.easeTo({ center: [location.longitude, location.latitude], duration: 320 })
    }
  }

  function setPlaceRadius(radius: number) {
    setPlaceRadiusKmState(radius)
    window.localStorage.setItem(placeRadiusStorageKey, String(radius))
  }

  function openDirections(place: NearbyPlace) {
    const from = location ? `${location.latitude},${location.longitude}` : ''
    const to = `${place.latitude},${place.longitude}`
    const route = from ? `${from};${to}` : to
    window.open(
      `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(route)}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  async function sharePlace(place: NearbyPlace) {
    const url = `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=18/${place.latitude}/${place.longitude}`
    const text = `${place.name} · ${distanceLabel(place.distanceKm)}`
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} — ${url}`)
      onNotice('Đã sao chép địa điểm để chia sẻ.', 'success')
    } catch {
      // Native share cancellation is not an error.
    }
  }

  function openPerson(user: NearbyUser) {
    setSelectedUserId(user.id)
    setPeopleSheetExpanded(true)
  }

  function handlePersonKeyDown(event: React.KeyboardEvent<HTMLElement>, user: NearbyUser) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openPerson(user)
  }

  const searchPlaceholder = category === 'people'
    ? 'Tìm người quanh đây'
    : category === 'all'
      ? 'Tìm người, quán ăn, cafe…'
      : 'Tìm địa điểm quanh đây'

  const placeSummary = placesBusy
    ? 'Đang tìm địa điểm gần bạn…'
    : `${visiblePlaces.length} địa điểm · trong ${placeRadiusKm < 1 ? '500 m' : `${placeRadiusKm} km`}`

  const peopleSummary = peopleScanning
    ? 'Đang tìm người gần bạn…'
    : visibleUsers.length
      ? `${visibleUsers.length} người · trong ${peopleRadiusKm} km`
      : peopleActive
        ? `Chưa có người phù hợp trong ${peopleRadiusKm} km`
        : `Sẵn sàng tìm trong ${peopleRadiusKm} km`

  const showLocationPrompt = !location && category !== 'people' && !peopleActive

  return (
    <section className={`nearby-explorer category-${category}`} aria-label="Khám phá quanh đây">
      <div className="nearby-map-stage">
        <div ref={mapContainerRef} className="nearby-map-canvas" />
        <div className="nearby-map-soft-wash" aria-hidden="true" />

        <div className="nearby-floating-top">
          <div className="nearby-title-row">
            <strong>Quanh đây</strong>
            <button
              type="button"
              className={`nearby-location-chip${location ? ' active' : ''}`}
              onClick={() => void locate()}
              disabled={locationBusy}
            >
              <span className="nearby-location-chip-dot" />
              {locationBusy ? 'Đang định vị…' : location ? 'Vị trí của bạn' : 'Bật vị trí'}
            </button>
          </div>

          <label className="nearby-smart-search">
            <span className="nearby-search-icon" aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
              inputMode="search"
            />
            {query && (
              <button type="button" onClick={() => onQueryChange('')} aria-label="Xóa tìm kiếm">×</button>
            )}
          </label>

          <div className="nearby-category-strip" role="tablist" aria-label="Loại khám phá">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={category === item.id ? 'active' : ''}
                onClick={() => chooseCategory(item.id)}
                role="tab"
                aria-selected={category === item.id}
              >
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </div>

        {showLocationPrompt && (
          <div className="nearby-location-empty">
            <span className="nearby-location-empty-icon">⌖</span>
            <div>
              <strong>Bật vị trí để bắt đầu</strong>
              <small>Tìm người và địa điểm gần bạn mà không cần nhập địa chỉ.</small>
            </div>
            <button type="button" onClick={() => void locate()} disabled={locationBusy}>
              {locationBusy ? 'Đang bật…' : 'Cho phép vị trí'}
            </button>
          </div>
        )}

        {category === 'people' && (
          <div className="nearby-people-field" aria-label="Người dùng gần bạn, vị trí hiển thị chỉ mang tính tương đối">
            {peopleScanning ? (
              <div className="nearby-social-radar" aria-hidden="true">
                <span /><span /><span />
                <b>⌖</b>
              </div>
            ) : visibleUsers.length > 0 ? (
              visibleUsers.slice(0, peopleVisualPositions.length).map((user, index) => {
                const position = peopleVisualPositions[index]
                return (
                  <button
                    key={user.id}
                    type="button"
                    className="nearby-person-map-bubble"
                    style={{ left: `${position.left}%`, top: `${position.top}%` }}
                    onClick={() => openPerson(user)}
                    aria-label={`Mở hồ sơ nhanh của ${user.displayName || user.username}`}
                  >
                    <span>{initials(user.displayName || user.username)}</span>
                    {user.nearbyActive && <i />}
                  </button>
                )
              })
            ) : (
              <div className="nearby-people-map-empty" aria-hidden="true">
                <span>👥</span>
                <small>Người gần bạn sẽ xuất hiện ở đây</small>
              </div>
            )}
          </div>
        )}

        <div className="nearby-map-actions">
          <button type="button" onClick={() => void locate()} disabled={locationBusy} aria-label="Về vị trí của tôi">⌖</button>
          {category !== 'people' && (
            <button type="button" onClick={() => setViewMode('list')} aria-label="Mở danh sách">☰</button>
          )}
        </div>

        {viewMode === 'map' && category === 'people' && (
          <section className={`nearby-people-sheet${peopleSheetExpanded ? ' expanded' : ''}`}>
            <button
              type="button"
              className="nearby-sheet-grabber"
              onClick={() => setPeopleSheetExpanded((current) => !current)}
              aria-label={peopleSheetExpanded ? 'Thu gọn kết quả' : 'Mở rộng kết quả'}
            >
              <span />
            </button>

            <div className="nearby-people-sheet-head">
              <div>
                <div className="nearby-heading-line">
                  <strong>Người quanh đây</strong>
                  {visibleUsers.length > 0 && <b>{visibleUsers.length}</b>}
                </div>
                <small>{peopleSummary}</small>
              </div>
              <button
                type="button"
                className="nearby-refresh-button"
                onClick={() => void handlePeopleScan()}
                disabled={peopleBusy}
                aria-label="Quét lại người quanh đây"
              >
                {peopleScanning ? '•••' : '↻'}
              </button>
            </div>

            <div className="nearby-people-toolbar">
              <button
                type="button"
                className="nearby-scope-button"
                onClick={() => setPeopleRadiusOpen((current) => !current)}
                aria-expanded={peopleRadiusOpen}
              >
                <span>⌖</span> Trong {peopleRadiusKm} km <b>⌄</b>
              </button>
              <span className="nearby-private-note">Vị trí chính xác luôn được ẩn</span>
            </div>

            {peopleRadiusOpen && (
              <div className="nearby-radius-menu">
                <small>Phạm vi tìm người</small>
                <div>
                  {[1, 5, 10, 25, 50].map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      className={peopleRadiusKm === radius ? 'active' : ''}
                      onClick={() => {
                        onPeopleRadiusChange(radius)
                        setPeopleRadiusOpen(false)
                      }}
                      disabled={peopleBusy}
                    >
                      {radius} km
                    </button>
                  ))}
                </div>
                {(peopleActive || users.length > 0) && (
                  <button
                    type="button"
                    className="nearby-stop-sharing"
                    onClick={() => {
                      setPeopleRadiusOpen(false)
                      void onStopPeople()
                    }}
                    disabled={peopleBusy}
                  >
                    Tắt Quanh đây và xóa vị trí đã lưu
                  </button>
                )}
              </div>
            )}

            {peopleScanning ? (
              <div className="nearby-people-loading">
                <span className="nearby-loading-orbit"><i /></span>
                <div>
                  <strong>Đang tìm người gần bạn</strong>
                  <small>ChatNet đang xếp kết quả từ gần đến xa…</small>
                </div>
              </div>
            ) : visibleUsers.length > 0 ? (
              <div className="nearby-people-results" aria-live="polite">
                {visibleUsers.map((user) => (
                  <article
                    key={user.id}
                    className="nearby-person-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openPerson(user)}
                    onKeyDown={(event) => handlePersonKeyDown(event, user)}
                  >
                    <div className="nearby-person-avatar">
                      {initials(user.displayName || user.username)}
                      {user.nearbyActive && <i />}
                    </div>
                    <div className="nearby-person-copy">
                      <strong>{user.displayName || `@${user.username}`}</strong>
                      <span>@{user.username} · {distanceLabel(user.distanceKm)}</span>
                    </div>
                    <button
                      type="button"
                      className="nearby-person-action"
                      onClick={(event) => {
                        event.stopPropagation()
                        void onFriendAction(user)
                      }}
                      disabled={friendActionBusy === user.id}
                    >
                      {friendActionBusy === user.id ? '…' : getFriendActionLabel(user)}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="nearby-people-ready">
                <div className="nearby-people-ready-icon">👥</div>
                <div>
                  <strong>{peopleActive ? 'Chưa thấy ai phù hợp' : 'Tìm người gần bạn'}</strong>
                  <small>{peopleActive ? 'Thử tăng phạm vi hoặc quét lại sau.' : 'Chỉ hiển thị khoảng cách gần đúng, không lộ tọa độ.'}</small>
                </div>
                <button type="button" onClick={() => void handlePeopleScan()} disabled={peopleBusy}>
                  {peopleActive ? 'Quét lại' : 'Bắt đầu quét'}
                </button>
              </div>
            )}
          </section>
        )}

        {viewMode === 'map' && category !== 'people' && (
          <section className="nearby-place-sheet">
            <div className="nearby-sheet-grabber static"><span /></div>
            {selectedPlace ? (
              <article className="nearby-place-detail">
                <div className="nearby-place-icon large">{categoryIcon[selectedPlace.category]}</div>
                <div className="nearby-place-copy">
                  <small>{selectedPlace.kind} · {distanceLabel(selectedPlace.distanceKm)}</small>
                  <strong>{selectedPlace.name}</strong>
                  <span>{selectedPlace.address || selectedPlace.openingHours || 'Dữ liệu cộng đồng OpenStreetMap'}</span>
                </div>
                <button type="button" className="nearby-place-close" onClick={() => setSelectedPlaceId(null)} aria-label="Đóng">×</button>
                <div className="nearby-place-actions">
                  <button type="button" className="primary" onClick={() => openDirections(selectedPlace)}>↗ Chỉ đường</button>
                  <button type="button" onClick={() => void sharePlace(selectedPlace)}>⌁ Chia sẻ</button>
                </div>
              </article>
            ) : (
              <>
                <div className="nearby-place-sheet-head">
                  <div>
                    <strong>{category === 'all' ? 'Khám phá gần bạn' : categories.find((item) => item.id === category)?.label}</strong>
                    <small>{location ? placeSummary : 'Bật vị trí để xem địa điểm gần bạn'}</small>
                  </div>
                  {location && (
                    <button type="button" className="nearby-list-button" onClick={() => setViewMode('list')}>Danh sách</button>
                  )}
                </div>

                {category === 'all' && (peopleActive || users.length > 0) && (
                  <button type="button" className="nearby-smart-people-card" onClick={() => chooseCategory('people')}>
                    <span className="nearby-smart-people-icon">👥</span>
                    <span>
                      <strong>{users.length ? `${users.length} người ChatNet gần bạn` : 'Người ChatNet quanh đây'}</strong>
                      <small>{users.length ? 'Chạm để xem ngay' : 'Mở chế độ tìm người'}</small>
                    </span>
                    <b>›</b>
                  </button>
                )}

                <div className="nearby-place-radius-row">
                  {[0.5, 1, 3, 5].map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      className={placeRadiusKm === radius ? 'active' : ''}
                      onClick={() => setPlaceRadius(radius)}
                    >
                      {radius < 1 ? '500 m' : `${radius} km`}
                    </button>
                  ))}
                </div>

                {placesError && <div className="nearby-inline-error">{placesError}</div>}

                {location && placesBusy && (
                  <div className="nearby-place-mini-loading">
                    <span /><span /><span />
                  </div>
                )}

                {location && !placesBusy && (
                  <div className="nearby-place-preview-list">
                    {visiblePlaces.slice(0, category === 'all' ? 2 : 3).map((place) => (
                      <button
                        className="nearby-place-preview"
                        type="button"
                        key={place.id}
                        onClick={() => {
                          setSelectedPlaceId(place.id)
                          mapRef.current?.easeTo({ center: [place.longitude, place.latitude], duration: 360 })
                        }}
                      >
                        <span className="nearby-place-icon">{categoryIcon[place.category]}</span>
                        <span className="nearby-place-preview-copy">
                          <strong>{place.name}</strong>
                          <small>{place.kind} · {distanceLabel(place.distanceKm)}</small>
                        </span>
                        <b>›</b>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {viewMode === 'list' && category !== 'people' && (
        <div className="nearby-list-view">
          <div className="nearby-list-head">
            <div>
              <small>QUANH ĐÂY</small>
              <strong>{category === 'all' ? 'Địa điểm gần bạn' : categories.find((item) => item.id === category)?.label}</strong>
              <span>{location ? placeSummary : 'Chưa có vị trí'}</span>
            </div>
            <button type="button" onClick={() => setViewMode('map')}>⌖ Bản đồ</button>
          </div>

          <div className="nearby-list-stack">
            {!location && (
              <div className="nearby-empty-state">
                <span>⌖</span>
                <strong>Bật vị trí để bắt đầu</strong>
                <small>ChatNet dùng vị trí thiết bị để tìm POI quanh bạn.</small>
                <button type="button" onClick={() => void locate()} disabled={locationBusy}>Bật vị trí</button>
              </div>
            )}

            {location && !placesBusy && !visiblePlaces.length && (
              <div className="nearby-empty-state">
                <span>⌕</span>
                <strong>Chưa tìm thấy địa điểm phù hợp</strong>
                <small>Thử tăng bán kính hoặc đổi nhóm địa điểm.</small>
              </div>
            )}

            {placesBusy && Array.from({ length: 5 }).map((_, index) => (
              <div className="nearby-place-skeleton" key={index}><span /><div><b /><i /></div></div>
            ))}

            {!placesBusy && visiblePlaces.map((place) => (
              <article className="nearby-place-list-card" key={place.id}>
                <button
                  type="button"
                  className="nearby-place-icon"
                  onClick={() => {
                    setSelectedPlaceId(place.id)
                    setViewMode('map')
                  }}
                  aria-label={`Xem ${place.name} trên bản đồ`}
                >
                  {categoryIcon[place.category]}
                </button>
                <div>
                  <strong>{place.name}</strong>
                  <span>{place.kind} · {distanceLabel(place.distanceKm)}</span>
                  <small>{place.address || place.openingHours || 'OpenStreetMap'}</small>
                </div>
                <button type="button" className="nearby-card-route" onClick={() => openDirections(place)}>↗</button>
              </article>
            ))}
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="nearby-profile-backdrop" role="presentation" onClick={() => setSelectedUserId(null)}>
          <section
            className="nearby-profile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Hồ sơ nhanh của ${selectedUser.displayName || selectedUser.username}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="nearby-sheet-grabber static"><span /></div>
            <button type="button" className="nearby-profile-close" onClick={() => setSelectedUserId(null)} aria-label="Đóng">×</button>

            <div className="nearby-profile-avatar">
              {initials(selectedUser.displayName || selectedUser.username)}
              {selectedUser.nearbyActive && <i />}
            </div>
            <div className="nearby-profile-identity">
              <strong>{selectedUser.displayName || `@${selectedUser.username}`}</strong>
              <span>@{selectedUser.username}</span>
            </div>

            <div className="nearby-profile-meta">
              <span>{selectedUser.nearbyActive ? '● Vừa hoạt động' : '○ Vị trí gần nhất'}</span>
              <span>⌖ {distanceLabel(selectedUser.distanceKm)}</span>
            </div>

            <button
              type="button"
              className="nearby-profile-primary"
              onClick={() => void onFriendAction(selectedUser)}
              disabled={friendActionBusy === selectedUser.id}
            >
              {friendActionBusy === selectedUser.id ? 'Đang xử lý…' : getFriendActionLabel(selectedUser)}
            </button>

            <div className="nearby-profile-privacy">
              <span>⌾</span>
              <p>ChatNet chỉ hiển thị khoảng cách gần đúng. Tọa độ chính xác của người dùng không được chia sẻ.</p>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
