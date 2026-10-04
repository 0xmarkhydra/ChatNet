import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
const categories: Array<{ id: DiscoveryCategory; icon: string; label: string }> = [
  { id: 'people', icon: '◉', label: 'Người' },
  { id: 'all', icon: '⌖', label: 'Tiện ích' },
  { id: 'food', icon: '◌', label: 'Ăn uống' },
  { id: 'cafe', icon: '◒', label: 'Cafe' },
  { id: 'services', icon: '✣', label: 'Dịch vụ' },
  { id: 'stay', icon: '⌂', label: 'Lưu trú' },
  { id: 'health', icon: '✚', label: 'Y tế' },
  { id: 'education', icon: '▱', label: 'Giáo dục' },
  { id: 'shopping', icon: '□', label: 'Mua sắm' },
]
const categoryIcon: Record<NearbyPlaceCategory, string> = {
  all: '⌖', food: '◌', cafe: '◒', services: '✣',
  stay: '⌂', health: '✚', education: '▱', shopping: '□',
}

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

function distanceLabel(distanceKm?: number) {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return 'Quanh bạn'
  if (distanceKm < 1) return `${Math.max(10, Math.round(distanceKm * 1000 / 10) * 10)} m`
  return `${distanceKm.toLocaleString('vi-VN', { maximumFractionDigits: distanceKm >= 10 ? 0 : 1 })} km`
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
    layers: [
      { id: 'base', type: 'background', paint: { 'background-color': '#edf0ea' } },
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        paint: {
          'raster-saturation': -0.55,
          'raster-contrast': -0.08,
          'raster-brightness-min': 0.84,
          'raster-brightness-max': 1,
        },
      },
    ],
  }
}

export default function NearbyExplorer({
  query, onQueryChange, users, peopleBusy, peopleScanning, peopleActive,
  peopleRadiusKm, onPeopleRadiusChange, onScanPeople, onStopPeople,
  friendActionBusy, onFriendAction, getFriendActionLabel, onNotice,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const placeMarkersRef = useRef<maplibregl.Marker[]>([])
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const placesAbortRef = useRef<AbortController | null>(null)

  const [category, setCategory] = useState<DiscoveryCategory>('people')
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationBusy, setLocationBusy] = useState(false)
  const [placeRadiusKm, setPlaceRadiusKm] = useState(1)
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [placesBusy, setPlacesBusy] = useState(false)
  const [placesError, setPlacesError] = useState('')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [peopleResultsOpen, setPeopleResultsOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null)

  const selectedPlace = places.find((place) => place.id === selectedPlaceId) || null
  const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN')
  const visiblePlaces = useMemo(() => !normalizedQuery
    ? places
    : places.filter((place) =>
        [place.name, place.kind, place.address || ''].some((value) =>
          value.toLocaleLowerCase('vi-VN').includes(normalizedQuery))),
    [normalizedQuery, places])

  const visibleUsers = useMemo(() => {
    const normalized = normalizedQuery.replace(/^@/, '')
    const filtered = !normalized ? users : users.filter((user) =>
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
      dragPan: true,
      scrollZoom: true,
      doubleClickZoom: true,
      touchZoomRotate: true,
      keyboard: true,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.touchZoomRotate.enable()
    map.touchZoomRotate.disableRotation()
    map.once('load', () => map.resize())
    requestAnimationFrame(() => map.resize())
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
      duration: 700,
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
        setSheetExpanded(true)
        map.easeTo({ center: [place.longitude, place.latitude], duration: 420 })
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
        setSelectedPlaceId((current) =>
          current && items.some((item) => item.id === current) ? current : null)
        setSheetExpanded(true)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        const rawMessage = error instanceof Error ? error.message : 'Chưa tải được địa điểm quanh đây.'
        const friendlyMessage = /abort|aborted/i.test(rawMessage)
          ? 'Dữ liệu địa điểm phản hồi chậm. Hãy thử lại sau ít giây.'
          : rawMessage
        setPlaces([])
        setPlacesError(friendlyMessage)
        setSheetExpanded(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlacesBusy(false)
      })
    return () => controller.abort()
  }, [category, location, placeRadiusKm])

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
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude }
      setLocation(next)
      return next
    } catch (error) {
      const code = (error as GeolocationPositionError | undefined)?.code
      onNotice(
        code === 1
          ? 'ChatNet cần quyền vị trí để khám phá địa điểm quanh bạn. Hãy cho phép Location rồi thử lại.'
          : 'Chưa lấy được vị trí hiện tại. Hãy kiểm tra GPS/Wi‑Fi và thử lại.',
        'error',
      )
      return null
    } finally {
      setLocationBusy(false)
    }
  }

  async function handlePeopleScan() {
    const currentLocation = await locate()
    if (!currentLocation) return
    setPeopleResultsOpen(false)
    setSelectedUser(null)
    await onScanPeople()
    setPeopleResultsOpen(true)
  }

  async function handleStopPeople() {
    setPeopleResultsOpen(false)
    setSelectedUser(null)
    await onStopPeople()
  }

  function chooseCategory(nextCategory: DiscoveryCategory) {
    const switchingPeopleMode = (category === 'people') !== (nextCategory === 'people')
    if (switchingPeopleMode) onQueryChange('')
    setCategory(nextCategory)
    setSelectedPlaceId(null)
    setSheetExpanded(false)
    setPeopleResultsOpen(false)
    setSelectedUser(null)
    if (nextCategory !== 'people' && location) {
      mapRef.current?.easeTo({ center: [location.longitude, location.latitude], duration: 350 })
    }
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
      // Ignore native share cancellation.
    }
  }

  const summaryText = location
    ? category === 'people'
      ? users.length
        ? `${users.length} người được tìm thấy trong ${peopleRadiusKm} km`
        : 'Quét để tìm người dùng ChatNet quanh bạn'
      : placesBusy
        ? 'Đang tìm địa điểm gần bạn…'
        : placesError
          ? 'Chưa tải được dữ liệu địa điểm'
          : `${visiblePlaces.length} địa điểm · trong ${placeRadiusKm < 1 ? '500 m' : `${placeRadiusKm} km`}`
    : 'Bật vị trí để xem những gì ở gần bạn'

  const loadingNearby = locationBusy || (category === 'people' ? peopleScanning : placesBusy)
  const activeCategoryLabel = categories.find((item) => item.id === category)?.label || 'địa điểm'
  const loadingTitle = locationBusy
    ? 'Đang xác định vị trí của bạn'
    : category === 'people'
      ? 'Đang tìm người quanh bạn'
      : category === 'all'
        ? 'Đang tìm tiện ích quanh bạn'
        : `Đang tìm ${activeCategoryLabel.toLocaleLowerCase('vi-VN')} quanh bạn`
  const loadingRange = locationBusy
    ? 'Đang kết nối GPS…'
    : category === 'people'
      ? `Trong phạm vi ${peopleRadiusKm} km`
      : `Trong phạm vi ${placeRadiusKm < 1 ? '500 m' : `${placeRadiusKm} km`}`
  const loadingHint = category === 'people'
    ? 'Vị trí chính xác của mọi người luôn được ẩn'
    : 'Kết quả sẽ tự mở rộng ngay khi tải xong'

  return (
    <section className="nearby-explorer" aria-label="Khám phá quanh đây">
      <div className="nearby-map-stage">
        <div ref={mapContainerRef} className="nearby-map-canvas" />

        <div className="nearby-floating-top">
          <div className="nearby-title-row">
            <strong>Quanh đây</strong>
            <button
              type="button"
              className="nearby-live-chip"
              onClick={() => void locate()}
              disabled={locationBusy}
            >
              <span />
              {locationBusy ? 'Đang định vị…' : location ? 'Vị trí của bạn' : 'Bật vị trí'}
            </button>
          </div>

          <label className="nearby-smart-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={category === 'people' ? 'Tìm người theo tên hoặc @username' : 'Tìm quán, cafe, dịch vụ...'}
              inputMode="search"
            />
            {query && <button type="button" onClick={() => onQueryChange('')} aria-label="Xóa tìm kiếm">×</button>}
          </label>

          <div className="nearby-category-strip" role="tablist" aria-label="Khám phá quanh đây">
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

        {!location && (
          <button className="nearby-location-prompt" type="button" onClick={() => void locate()} disabled={locationBusy}>
            <span className="nearby-location-prompt-icon">◎</span>
            <span>
              <strong>{locationBusy ? 'Đang xác định vị trí...' : category === 'people' ? 'Bật vị trí để tìm bạn bè' : 'Khám phá tiện ích quanh tôi'}</strong>
              <small>Dùng GPS trên thiết bị · không cần API key</small>
            </span>
            <b>→</b>
          </button>
        )}

        {category === 'people' && location && (
          <div className="nearby-privacy-radar" aria-hidden="true">
            <span className="ring ring-a" /><span className="ring ring-b" /><span className="ring ring-c" />
            <div>
              <strong>{peopleScanning ? '•••' : visibleUsers.length}</strong>
              <small>{peopleScanning ? 'Đang quét' : 'người gần bạn'}</small>
            </div>
          </div>
        )}

        <div className="nearby-map-actions">
          <button type="button" onClick={() => void locate()} disabled={locationBusy} aria-label="Về vị trí của tôi">◎</button>
          <button type="button" className="nearby-map-zoom" onClick={() => mapRef.current?.zoomIn({ duration: 220 })} aria-label="Phóng to bản đồ">+</button>
          <button type="button" className="nearby-map-zoom" onClick={() => mapRef.current?.zoomOut({ duration: 220 })} aria-label="Thu nhỏ bản đồ">−</button>
          <button
            type="button"
            className={`nearby-map-list-toggle${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setViewMode((current) => current === 'map' ? 'list' : 'map')}
            aria-label="Chuyển bản đồ và danh sách"
          >
            {viewMode === 'map' ? '☰' : '⌖'}
          </button>
        </div>

        {viewMode === 'map' && (
          <div className={`nearby-bottom-sheet${category === 'people' ? ' is-people' : ''}${placesBusy ? ' is-loading' : ''}${visiblePlaces.length ? ' has-results' : ''}${selectedPlace ? ' has-selection' : ''}${sheetExpanded ? ' is-expanded' : ' is-collapsed'}`}>
            {category !== 'people' ? (
              <button
                type="button"
                className="nearby-sheet-handle-button"
                onClick={() => setSheetExpanded((value) => !value)}
                aria-label={sheetExpanded ? 'Thu gọn kết quả' : 'Mở rộng kết quả'}
                aria-expanded={sheetExpanded}
              >
                <span className="nearby-sheet-handle" />
              </button>
            ) : (
              <div className="nearby-sheet-handle" />
            )}
            {category === 'people' ? (
              <div className="nearby-people-launcher">
                <div className="nearby-sheet-heading">
                  <div>
                    <strong>Tìm người quanh đây</strong>
                    <small>Chọn phạm vi rồi bắt đầu quét</small>
                  </div>
                  <span className="nearby-privacy-badge">Ẩn vị trí chính xác</span>
                </div>
                <div className="nearby-radius-row" aria-label="Bán kính tìm người">
                  {[1, 5, 10, 25, 50].map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      className={peopleRadiusKm === radius ? 'active' : ''}
                      onClick={() => onPeopleRadiusChange(radius)}
                      disabled={peopleBusy}
                    >{radius} km</button>
                  ))}
                </div>
                <div className="nearby-primary-actions">
                  <button type="button" className="primary" onClick={() => void handlePeopleScan()} disabled={peopleBusy}>
                    <span>⌖</span>{peopleBusy ? 'Đang chuẩn bị...' : 'Quét người quanh đây'}
                  </button>
                  {(peopleActive || users.length > 0) && (
                    <button type="button" className="ghost" onClick={() => void handleStopPeople()} disabled={peopleBusy}>Tắt</button>
                  )}
                </div>
                {!!visibleUsers.length && !peopleScanning && (
                  <button type="button" className="nearby-last-results" onClick={() => setPeopleResultsOpen(true)}>
                    <span>👥</span>
                    <span><strong>{visibleUsers.length} người gần đây</strong><small>Chạm để xem lại kết quả</small></span>
                    <b>›</b>
                  </button>
                )}
              </div>
            ) : selectedPlace ? (
              <article className="nearby-place-detail">
                <div className="nearby-place-icon">{categoryIcon[selectedPlace.category]}</div>
                <div className="nearby-place-copy">
                  <small>{selectedPlace.kind} · {distanceLabel(selectedPlace.distanceKm)}</small>
                  <strong>{selectedPlace.name}</strong>
                  <span>{selectedPlace.address || selectedPlace.openingHours || 'Dữ liệu cộng đồng OpenStreetMap'}</span>
                </div>
                <div className="nearby-place-actions">
                  <button type="button" onClick={() => openDirections(selectedPlace)}>↗ <span>Chỉ đường</span></button>
                  <button type="button" onClick={() => void sharePlace(selectedPlace)}>⌁ <span>Chia sẻ</span></button>
                </div>
              </article>
            ) : (
              <>
                <div className="nearby-sheet-heading">
                  <div>
                    <strong>Gần bạn</strong>
                    <small>{summaryText}</small>
                  </div>
                  <button
                    type="button"
                    className="nearby-sheet-list-toggle"
                    onClick={() => setSheetExpanded((value) => !value)}
                    aria-expanded={sheetExpanded}
                  >
                    {sheetExpanded ? 'Thu gọn' : 'Mở rộng'}
                    <span aria-hidden="true">{sheetExpanded ? '⌄' : '⌃'}</span>
                  </button>
                </div>
                <div className="nearby-radius-row" aria-label="Bán kính địa điểm">
                  {[0.5, 1, 3, 5].map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      className={placeRadiusKm === radius ? 'active' : ''}
                      onClick={() => setPlaceRadiusKm(radius)}
                    >{radius < 1 ? '500 m' : `${radius} km`}</button>
                  ))}
                </div>
                {placesError && <div className="nearby-inline-error">{placesError}</div>}
                <div className="nearby-preview-list">
                  {visiblePlaces.slice(0, sheetExpanded ? 12 : 2).map((place) => (
                    <button
                      className="nearby-place-preview"
                      type="button"
                      key={place.id}
                      onClick={() => {
                        setSelectedPlaceId(place.id)
                        setSheetExpanded(true)
                        mapRef.current?.easeTo({ center: [place.longitude, place.latitude], duration: 420 })
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
              </>
            )}
          </div>
        )}
      </div>

      {loadingNearby && createPortal(
        <div className="nearby-radar-overlay" role="dialog" aria-modal="true" aria-label={loadingTitle}>
          <div className="nearby-radar-modal">
            <div className="nearby-radar-visual" aria-hidden="true">
              <span className="nearby-radar-ring ring-1" />
              <span className="nearby-radar-ring ring-2" />
              <span className="nearby-radar-ring ring-3" />
              <span className="nearby-radar-sweep" />
              <span className="nearby-radar-dot dot-1" />
              <span className="nearby-radar-dot dot-2" />
              <span className="nearby-radar-dot dot-3" />
              <span className="nearby-radar-center" />
            </div>
            <strong>{loadingTitle}</strong>
            <span>{loadingRange}</span>
            <small>{loadingHint}</small>
          </div>
        </div>,
        document.body,
      )}

      {category === 'people' && peopleResultsOpen && !peopleScanning && createPortal(
        <div className="nearby-results-overlay" role="dialog" aria-modal="true" aria-labelledby="nearby-results-title">
          <button className="nearby-results-backdrop" type="button" aria-label="Đóng kết quả" onClick={() => setPeopleResultsOpen(false)} />
          <section className="nearby-results-modal">
            <div className="nearby-results-handle" />
            <header className="nearby-results-header">
              <div>
                <small>KẾT QUẢ QUANH ĐÂY</small>
                <strong id="nearby-results-title">{visibleUsers.length ? `${visibleUsers.length} người gần bạn` : 'Chưa tìm thấy ai'}</strong>
                <span>Trong phạm vi {peopleRadiusKm} km · gần đến xa</span>
              </div>
              <button type="button" className="nearby-results-close" onClick={() => setPeopleResultsOpen(false)} aria-label="Đóng">×</button>
            </header>

            <div className="nearby-results-toolbar">
              <button type="button" onClick={() => void handlePeopleScan()} disabled={peopleBusy}>↻ Quét lại</button>
              <span>Vị trí chính xác luôn được ẩn</span>
            </div>

            <div className="nearby-results-list">
              {!visibleUsers.length && (
                <div className="nearby-results-empty">
                  <span aria-hidden="true">○</span>
                  <strong>Chưa có người trong phạm vi này</strong>
                  <small>Thử tăng bán kính rồi quét lại.</small>
                </div>
              )}
              {visibleUsers.map((user) => (
                <article key={user.id} className="nearby-result-user" onClick={() => setSelectedUser(user)}>
                  <div className="nearby-result-avatar">{initials(user.displayName || user.username)}</div>
                  <div className="nearby-result-copy">
                    <strong>{user.displayName || `@${user.username}`}</strong>
                    <span>@{user.username} · {distanceLabel(user.distanceKm)}</span>
                    <small>{user.nearbyActive ? '● Vừa hoạt động' : 'Vị trí gần nhất'}</small>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void onFriendAction(user)
                    }}
                    disabled={friendActionBusy === user.id}
                  >
                    {getFriendActionLabel(user)}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}

      {category === 'people' && selectedUser && createPortal(
        <div className="nearby-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="nearby-profile-title">
          <button className="nearby-results-backdrop" type="button" aria-label="Đóng hồ sơ" onClick={() => setSelectedUser(null)} />
          <section className="nearby-profile-modal">
            <button type="button" className="nearby-results-close" onClick={() => setSelectedUser(null)} aria-label="Đóng">×</button>
            <div className="nearby-profile-avatar">{initials(selectedUser.displayName || selectedUser.username)}</div>
            <strong id="nearby-profile-title">{selectedUser.displayName || `@${selectedUser.username}`}</strong>
            <span>@{selectedUser.username}</span>
            <div className="nearby-profile-meta">
              <span>{selectedUser.nearbyActive ? '● Vừa hoạt động' : 'Vị trí gần nhất'}</span>
              <span>⌖ {distanceLabel(selectedUser.distanceKm)}</span>
            </div>
            <button
              type="button"
              className="nearby-profile-primary"
              onClick={() => void onFriendAction(selectedUser)}
              disabled={friendActionBusy === selectedUser.id}
            >
              {getFriendActionLabel(selectedUser)}
            </button>
            <small>ChatNet không chia sẻ tọa độ chính xác của người dùng.</small>
          </section>
        </div>,
        document.body,
      )}

      {viewMode === 'list' && (
        <div className="nearby-list-view">
          <div className="nearby-list-head">
            <div>
              <small>{category === 'people' ? 'CHATNET SOCIAL' : 'LOCAL DISCOVERY'}</small>
              <strong>{summaryText}</strong>
            </div>
            <button type="button" onClick={() => setViewMode('map')}>⌖ Bản đồ</button>
          </div>

          {category === 'people' ? (
            <div className="nearby-list-stack">
              {!visibleUsers.length && (
                <div className="nearby-empty-state">
                  <span>👥</span><strong>Chưa có người dùng trong kết quả</strong>
                  <small>Quét vị trí để tìm người ChatNet gần bạn mà không lộ tọa độ chính xác.</small>
                  <button type="button" onClick={() => void handlePeopleScan()} disabled={peopleBusy}>Quét ngay</button>
                </div>
              )}
              {visibleUsers.map((user) => (
                <article className="nearby-person-card full" key={user.id}>
                  <div className="nearby-person-avatar">{initials(user.displayName || user.username)}</div>
                  <div>
                    <strong>{user.displayName || `@${user.username}`}</strong>
                    <span>@{user.username} · {distanceLabel(user.distanceKm)} · {user.nearbyActive ? 'vừa hoạt động' : 'vị trí gần nhất'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onFriendAction(user)}
                    disabled={friendActionBusy === user.id}
                  >{getFriendActionLabel(user)}</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="nearby-list-stack">
              {!location && (
                <div className="nearby-empty-state">
                  <span>📍</span><strong>Bật vị trí để bắt đầu</strong>
                  <small>ChatNet chỉ dùng GPS trên thiết bị để tìm POI quanh bạn.</small>
                  <button type="button" onClick={() => void locate()} disabled={locationBusy}>Dùng vị trí của tôi</button>
                </div>
              )}
              {location && !placesBusy && !visiblePlaces.length && (
                <div className="nearby-empty-state">
                  <span>⌕</span><strong>Chưa tìm thấy địa điểm phù hợp</strong>
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
                    onClick={() => { setSelectedPlaceId(place.id); setViewMode('map') }}
                    aria-label={`Xem ${place.name} trên bản đồ`}
                  >{categoryIcon[place.category]}</button>
                  <div>
                    <strong>{place.name}</strong>
                    <span>{place.kind} · {distanceLabel(place.distanceKm)}</span>
                    <small>{place.address || place.openingHours || 'OpenStreetMap'}</small>
                  </div>
                  <button type="button" className="nearby-card-route" onClick={() => openDirections(place)}>↗</button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
