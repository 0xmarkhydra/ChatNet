export type NearbyPlaceCategory =
  | 'all'
  | 'food'
  | 'cafe'
  | 'services'
  | 'stay'
  | 'health'
  | 'education'
  | 'shopping'

export type NearbyPlace = {
  id: string
  name: string
  category: NearbyPlaceCategory
  latitude: number
  longitude: number
  distanceKm: number
  kind: string
  address?: string
  openingHours?: string
  phone?: string
  website?: string
}

type OverpassElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  tags?: Record<string, string>
}

type OverpassPayload = { elements?: OverpassElement[] }

const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const categorySelectors: Record<NearbyPlaceCategory, string[]> = {
  all: [
    '["amenity"~"restaurant|fast_food|food_court|cafe|hospital|clinic|pharmacy|doctors|dentist|school|kindergarten|college|university|library|marketplace"]',
    '["shop"]',
    '["tourism"~"hotel|hostel|guest_house|motel|apartment"]',
  ],
  food: ['["amenity"~"restaurant|fast_food|food_court"]'],
  cafe: ['["amenity"="cafe"]'],
  services: [
    '["shop"~"hairdresser|beauty|laundry|dry_cleaning|car_repair|mobile_phone|computer|tailor"]',
    '["amenity"~"car_wash|bank|post_office"]',
  ],
  stay: ['["tourism"~"hotel|hostel|guest_house|motel|apartment"]'],
  health: ['["amenity"~"hospital|clinic|pharmacy|doctors|dentist"]'],
  education: ['["amenity"~"school|kindergarten|college|university|library"]'],
  shopping: ['["shop"]', '["amenity"="marketplace"]'],
}

const categoryLabels: Record<NearbyPlaceCategory, string> = {
  all: 'Địa điểm',
  food: 'Ăn uống',
  cafe: 'Cafe',
  services: 'Dịch vụ',
  stay: 'Lưu trú',
  health: 'Y tế',
  education: 'Giáo dục',
  shopping: 'Mua sắm',
}

function classify(tags: Record<string, string>): NearbyPlaceCategory {
  const amenity = tags.amenity || ''
  const tourism = tags.tourism || ''
  const shop = tags.shop || ''
  if (/restaurant|fast_food|food_court/.test(amenity)) return 'food'
  if (amenity === 'cafe') return 'cafe'
  if (/hospital|clinic|pharmacy|doctors|dentist/.test(amenity)) return 'health'
  if (/school|kindergarten|college|university|library/.test(amenity)) return 'education'
  if (/hotel|hostel|guest_house|motel|apartment/.test(tourism)) return 'stay'
  if (shop) {
    if (/hairdresser|beauty|laundry|dry_cleaning|car_repair|mobile_phone|computer|tailor/.test(shop)) return 'services'
    return 'shopping'
  }
  if (/car_wash|bank|post_office/.test(amenity)) return 'services'
  if (amenity === 'marketplace') return 'shopping'
  return 'all'
}

function kindLabel(tags: Record<string, string>, category: NearbyPlaceCategory) {
  const raw = tags.amenity || tags.shop || tags.tourism || categoryLabels[category]
  return raw.split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(' ')
}

function addressLabel(tags: Record<string, string>) {
  const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean)
  return parts.length ? parts.join(', ') : undefined
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (value: number) => value * Math.PI / 180
  const earthRadiusKm = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildQuery(latitude: number, longitude: number, radiusMeters: number, category: NearbyPlaceCategory) {
  const selectors = categorySelectors[category]
    .map((selector) => `nwr(around:${radiusMeters},${latitude},${longitude})${selector};`)
    .join('\n')
  return `[out:json][timeout:18];
(
${selectors}
);
out center tags;`
}

async function fetchEndpoint(endpoint: string, query: string, signal: AbortSignal) {
  const body = new URLSearchParams({ data: query })
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
    signal,
  })
  if (!response.ok) throw new Error(`OSM provider trả về HTTP ${response.status}`)
  return response.json() as Promise<OverpassPayload>
}

export async function loadNearbyPlaces({
  latitude,
  longitude,
  radiusKm,
  category,
  signal,
}: {
  latitude: number
  longitude: number
  radiusKm: number
  category: NearbyPlaceCategory
  signal?: AbortSignal
}) {
  const radiusMeters = Math.max(250, Math.min(5000, Math.round(radiusKm * 1000)))
  const query = buildQuery(latitude, longitude, radiusMeters, category)
  let lastError: unknown

  for (const endpoint of endpoints) {
    const timeoutController = new AbortController()
    const timer = window.setTimeout(() => timeoutController.abort(), 14000)
    const abort = () => timeoutController.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const payload = await fetchEndpoint(endpoint, query, timeoutController.signal)
      const seen = new Set<string>()
      return (payload.elements || [])
        .map((element): NearbyPlace | null => {
          const tags = element.tags || {}
          const lat = element.lat ?? element.center?.lat
          const lon = element.lon ?? element.center?.lon
          if (typeof lat !== 'number' || typeof lon !== 'number') return null
          const name = tags.name || tags['name:vi'] || tags.brand || tags.operator
          if (!name) return null
          const id = `${element.type}:${element.id}`
          if (seen.has(id)) return null
          seen.add(id)
          const resolvedCategory = classify(tags)
          return {
            id,
            name,
            category: resolvedCategory,
            latitude: lat,
            longitude: lon,
            distanceKm: distanceKm(latitude, longitude, lat, lon),
            kind: kindLabel(tags, resolvedCategory),
            address: addressLabel(tags),
            openingHours: tags.opening_hours,
            phone: tags.phone || tags['contact:phone'],
            website: tags.website || tags['contact:website'],
          }
        })
        .filter((place): place is NearbyPlace => place !== null)
        .sort((left, right) => left.distanceKm - right.distanceKm)
        .slice(0, 80)
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      lastError = error
    } finally {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Chưa tải được dữ liệu địa điểm OpenStreetMap.')
}
