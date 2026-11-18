import { useEffect, useRef, useState } from 'react'
import { LocateFixed, Plus, Minus } from 'lucide-react'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { NearbyPlace } from '../lib/nearbyPlaces'

maplibregl.setWorkerUrl(maplibreWorkerUrl)

export default function NearbyMap({ location, places, selected, onSelect, onShowList }: {
  location: { latitude: number; longitude: number }
  places: NearbyPlace[]
  selected: string | null
  onSelect: (id: string) => void
  onShowList: () => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markerButtons = useRef<Map<string, HTMLButtonElement>>(new Map())
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!container.current) return
    setReady(false)
    let instance: maplibregl.Map
    try {
      instance = new maplibregl.Map({
        container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [location.longitude, location.latitude], zoom: 14,
      })
    } catch {
      const timer = window.setTimeout(() => setFailed(true), 0)
      return () => window.clearTimeout(timer)
    }
    map.current = instance
    let disposed = false
    const resize = new ResizeObserver(() => instance.resize())
    resize.observe(container.current)
    instance.on('error', () => { if (!disposed && !instance.isStyleLoaded()) { setFailed(true); setReady(false) } })
    instance.on('load', () => { if (!disposed) { setFailed(false); setReady(true) } })
    new maplibregl.Marker({ color: '#2464ba' }).setLngLat([location.longitude, location.latitude]).addTo(instance)
    return () => { disposed = true; resize.disconnect(); instance.remove(); map.current = null }
  }, [location.latitude, location.longitude, attempt])

  useEffect(() => {
    if (!map.current) return
    const instance = map.current
    const buttons = markerButtons.current
    const markers = places.map((place, index) => {
      const button = document.createElement('button')
      button.className = 'nearby-place-marker'
      button.type = 'button'
      button.textContent = String(index + 1)
      button.title = place.name
      button.setAttribute('aria-label', place.name)
      button.setAttribute('aria-pressed', 'false')
      buttons.set(place.id, button)
      button.onclick = () => onSelectRef.current(place.id)
      return new maplibregl.Marker({ element: button }).setLngLat([place.longitude, place.latitude]).addTo(instance)
    })
    return () => {
      markers.forEach((marker) => marker.remove())
      buttons.clear()
    }
  }, [places, location.latitude, location.longitude, attempt])

  useEffect(() => {
    for (const [id, button] of markerButtons.current) {
      const isSelected = id === selected
      button.classList.toggle('selected', isSelected)
      button.setAttribute('aria-pressed', String(isSelected))
    }
    const place = places.find((item) => item.id === selected)
    if (place) map.current?.easeTo({ center: [place.longitude, place.latitude], duration: 300 })
  }, [places, selected, attempt])

  return <div className="nearby-map">
    <div ref={container} className="nearby-map-canvas" />
    {failed && <div className="nearby-map-error" role="alert">Không tải được bản đồ. Bạn có thể xem danh sách địa điểm.<button type="button" onClick={onShowList}>Xem danh sách</button><button type="button" onClick={() => { setFailed(false); setAttempt((value) => value + 1) }}>Thử lại</button></div>}
    <div className="nearby-map-controls">
      <button type="button" disabled={failed || !ready} title="Về vị trí của tôi" aria-label="Về vị trí của tôi" onClick={() => map.current?.easeTo({ center: [location.longitude, location.latitude], zoom: 14 })}><LocateFixed size={20} /></button>
      <button type="button" disabled={failed || !ready} title="Phóng to" aria-label="Phóng to" onClick={() => map.current?.zoomIn()}><Plus size={20} /></button>
      <button type="button" disabled={failed || !ready} title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => map.current?.zoomOut()}><Minus size={20} /></button>
    </div>
  </div>
}
