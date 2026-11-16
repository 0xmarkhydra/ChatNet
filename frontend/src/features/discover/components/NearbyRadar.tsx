export function formatEstimatedDistance(distanceKm?: number) {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return 'Trong phạm vi 5 km'
  return `Khoảng ${distanceKm.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}

export default function NearbyRadar({ scanning = false, large = false }: { scanning?: boolean; large?: boolean }) {
  return (
    <div className={`nearby-radar ${scanning ? 'is-scanning' : ''} ${large ? 'is-large' : ''}`} aria-hidden="true">
      <span className="nearby-radar-ring ring-one" />
      <span className="nearby-radar-ring ring-two" />
      <span className="nearby-radar-axis axis-x" />
      <span className="nearby-radar-axis axis-y" />
      <span className="nearby-radar-sweep" />
      <span className="nearby-radar-blip blip-one" />
      <span className="nearby-radar-blip blip-two" />
      <span className="nearby-radar-blip blip-three" />
      <span className="nearby-radar-center" />
    </div>
  )
}
