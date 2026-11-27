import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, useRef, useState } from 'react'
import { LocateFixed, MapPin } from 'lucide-react'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { parseMapCheckIn, type MapCheckIn } from '../utils/publicPostLocation'

maplibregl.setWorkerUrl(workerUrl)
export default function PostMapPicker({ value, disabled, onConfirm }: {
  value: string; disabled: boolean; onConfirm: (pin: MapCheckIn) => void
}) {
  const trUi = useUiTranslation()

  const [initial] = useState(() => parseMapCheckIn(value))
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [point, setPoint] = useState<MapCheckIn | null>(initial)
  const [name, setName] = useState(initial?.name ?? '')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [locating, setLocating] = useState(false)
  useEffect(() => {
    const hostNode = host.current
    if (!hostNode) return
    let active = true
    let instance: maplibregl.Map
    try {
      const start = initial
      instance = new maplibregl.Map({ container: hostNode, style: 'https://tiles.openfreemap.org/styles/liberty',
        center: start ? [start.longitude, start.latitude] : [105.85, 21.03], zoom: 13 })
    } catch {
      queueMicrotask(() => { if (active) setError('Không mở được bản đồ trên thiết bị này.') })
      return () => { active = false }
    }
    map.current = instance
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(hostNode)
    instance.on('load', () => { if (active) { setReady(true); setError('') } })
    instance.on('error', () => { if (active && !instance.isStyleLoaded()) setError('Không tải được bản đồ. Hãy thử lại.') })
    instance.on('click', event => {
      if (!active) return
      const coordinates = event.lngLat.wrap()
      const featureName = instance.queryRenderedFeatures(event.point).map(f => f.properties?.['name:vi'] || f.properties?.name).find(n => typeof n === 'string' && n.trim())
      setPoint({ latitude: coordinates.lat, longitude: coordinates.lng, name: '' })
      setName(typeof featureName === 'string' ? featureName.slice(0, 120) : '')
    })
    return () => { active = false; observer.disconnect(); instance.remove(); map.current = null }
  }, [attempt, initial])
  useEffect(() => {
    if (!ready || !map.current || !point) return
    const marker = new maplibregl.Marker({ color: '#2464ba' })
      .setLngLat([point.longitude, point.latitude]).addTo(map.current)
    return () => { marker.remove() }
  }, [point, ready, attempt])
  const locate = () => {
    if (!navigator.geolocation) { setError('Thiết bị không hỗ trợ định vị. Bạn vẫn có thể chọn điểm trên bản đồ.'); return }
    setLocating(true)
    const instance = map.current
    navigator.geolocation.getCurrentPosition(position => {
      if (map.current !== instance) return
      setLocating(false)
      map.current?.easeTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 15 })
    }, () => { if (map.current === instance) { setLocating(false); setError('Không lấy được vị trí hiện tại. Bạn vẫn có thể chọn trên bản đồ.') } }, { timeout: 8000 })
  }
  return <div className="grid min-w-0 gap-2">
    <small>Di chuyển bản đồ và chạm vào một điểm để ghim. Bạn không cần bật GPS.</small>
    <div className="relative overflow-hidden rounded-xl border border-border-subtle">
      <div ref={host} aria-label={trUi("common.ui.locationMap")} style={{ width: '100%', height: 'min(42vh, 300px)' }} />
      <button type="button" aria-label={trUi("discover.myLocation")} disabled={!ready || disabled || locating} onClick={locate} className="absolute left-2 top-2 rounded-lg bg-white p-2 shadow"><LocateFixed size={18} /></button>
    </div>
    {error && <small role="status">{error} {!ready && <button type="button" onClick={() => { setReady(false); setError(''); setAttempt(v => v + 1) }}>{trUi("common.retry")}</button>}</small>}
    {point && <small className="text-muted-foreground"><MapPin size={14} aria-hidden="true" /> {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</small>}
    <input type="text" aria-label={trUi("common.ui.selectedLocation")} placeholder={trUi("common.ui.optionalPlaceName")} value={name} maxLength={120} disabled={disabled || !point} onChange={e => setName(e.target.value)} />
    <button type="button" className="rounded-lg bg-primary px-3 py-2 font-medium text-white disabled:opacity-50" disabled={disabled || !point || !ready} onClick={() => point && onConfirm({ ...point, name })}>Xác nhận vị trí</button>
  </div>
}
