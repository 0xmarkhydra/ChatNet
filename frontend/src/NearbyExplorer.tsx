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
const categories: Array<{ id: DiscoveryCategory; icon: string; label: string }> = [
  { id: 'all', icon: '✨', label: 'Gợi ý' },
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
  all: '📍', food: '🍜', cafe: '☕', services: '✂️',
  stay: '🏨', health: '🏥', education: '🏫', shopping: '🛍️',
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

function smartContext() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 10) return 'Buổi sáng · cafe, ăn sáng và dịch vụ gần bạn'
  if (hour >= 10 && hour < 14) return 'Buổi trưa · ưu tiên địa điểm ăn uống gần bạn'
  if (hour >= 14 && hour < 18) return 'Buổi chiều · cafe, mua sắm và dịch vụ'
  if (hour >= 18 && hour < 23) return 'Buổi tối · ăn uống, cafe và lưu trú'
  return 'Khám phá những gì đang ở gần bạn'
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
  query, onQueryChange, users, peopleBusy, peopleScanning, peopleActive,
  peopleRadiusKm, onPeopleRadiusChange, onScanPeople, onStopPeople,
  friendActionBusy, onFriendAction, getFriendActionLabel, onNotice,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const placeMarkersRef = useRef<maplibregl.Marker[]>([])
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const placesAbortRef = useRef<AbortController | null>(null)

  const [category, setCategory] = useState<DiscoveryCategory>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationBusy, setLocationBusy] = useState(false)
  const [placeRadiusKm, setPlaceRadiusKm] = useState(1)
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [placesBusy, setPlacesBusy] = useState(false)
  const [placesError, setPlacesError] = useState('')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)

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
    await locate()
    await onScanPeople()
  }

  function chooseCategory(nextCategory: DiscoveryCategory) {
    setCategory(nextCategory)
    setSelectedPlaceId(null)
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
        ? 'Đang đọc dữ liệu địa điểm quanh khu vực này...'
        : `${visiblePlaces.length} địa điểm trong bán kính ${placeRadiusKm} km`
    : 'Bật vị trí để ChatNet hiểu khu vực quanh bạn'

  return (
    <section className="nearby-explorer" aria-label="Khám phá quanh đây">
      <div className="nearby-map-stage">
        <div ref={mapContainerRef} className="nearby-map-canvas" />

        <div className="nearby-floating-top">
          <div className="nearby-title-row">
            <div><small>CHATNET NEARBY</small><strong>Quanh đây</strong></div>
            <div className="nearby-live-chip"><span />{location ? 'Đã định vị' : 'Riêng tư'}</div>
          </div>

          <label className="nearby-smart-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Tìm quán ăn, cafe, dịch vụ..."
              inputMode="search"
            />
            {query && <button type="button" onClick={() => onQueryChange('')} aria-label="Xóa tìm kiếm">×</button>}
          </label>

          <div className="nearby-smart-context"><span>✦</span><p>{smartContext()}</p></div>

          <div className="nearby-category-strip" role="tablist" aria-label="Loại địa điểm">
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
              <strong>{locationBusy ? 'Đang xác định vị trí...' : 'Khám phá quanh tôi'}</strong>
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
          <button
            type="button"
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode((current) => current === 'map' ? 'list' : 'map')}
            aria-label="Chuyển bản đồ và danh sách"
          >
            {viewMode === 'map' ? '☰' : '⌖'}
          </button>
        </div>

        {viewMode === 'map' && (
          <div className="nearby-bottom-sheet">
            <div className="nearby-sheet-handle" />
            {category === 'people' ? (
              <>
                <div className="nearby-sheet-heading">
                  <div><small>NGƯỜI QUANH ĐÂY</small><strong>{summaryText}</strong></div>
                  <span className="nearby-privacy-badge">Ẩn tọa độ chính xác</span>
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
                    <span>⌖</span>{peopleScanning ? 'Đang quét...' : users.length ? 'Quét lại' : 'Quét người quanh đây'}
                  </button>
                  {(peopleActive || users.length > 0) && (
                    <button type="button" className="ghost" onClick={() => void onStopPeople()} disabled={peopleBusy}>Tắt</button>
                  )}
                </div>
                {!!visibleUsers.length && (
                  <div className="nearby-preview-list">
                    {visibleUsers.slice(0, 3).map((user) => (
                      <article className="nearby-person-card" key={user.id}>
                        <div className="nearby-person-avatar">{initials(user.displayName || user.username)}</div>
                        <div>
                          <strong>{user.displayName || `@${user.username}`}</strong>
                          <span>@{user.username} · {distanceLabel(user.distanceKm)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onFriendAction(user)}
                          disabled={friendActionBusy === user.id}
                        >{getFriendActionLabel(user)}</button>
                      </article>
                    ))}
                  </div>
                )}
              </>
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
                  <div><small>KHÁM PHÁ KHU VỰC</small><strong>{summaryText}</strong></div>
                  {location && <span className="nearby-area-pill">OSM · Free</span>}
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
                  {visiblePlaces.slice(0, 3).map((place) => (
                    <button
                      className="nearby-place-preview"
                      type="button"
                      key={place.id}
                      onClick={() => {
                        setSelectedPlaceId(place.id)
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
