import { useEffect, useRef, useState } from 'react'
import { LocateFixed, Plus, Minus } from 'lucide-react'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { NearbyPlace } from '../lib/nearbyPlaces'

maplibregl.setWorkerUrl(maplibreWorkerUrl)

export default function NearbyMap({ location, places, selected, onSelect }: {
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
    {failed && <div className="nearby-map-error" role="status">Không tải được bản đồ. Danh sách vẫn dùng được.<button onClick={() => { setFailed(false); setAttempt((value) => value + 1) }}>Thử lại</button></div>}
    <div className="nearby-map-controls">
      <button title="Về vị trí của tôi" aria-label="Về vị trí của tôi" onClick={() => map.current?.easeTo({ center: [location.longitude, location.latitude], zoom: 14 })}><LocateFixed size={20} /></button>
      <button title="Phóng to" aria-label="Phóng to" onClick={() => map.current?.zoomIn()}><Plus size={20} /></button>
      <button title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => map.current?.zoomOut()}><Minus size={20} /></button>
    </div>
  </div>
}
