const MAX_LEAD_MS = 365 * 24 * 60 * 60 * 1000

export function scheduledLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function scheduledInstant(value: string, now = Date.now()) {
  const date = new Date(value)
  const time = date.getTime()
  if (!Number.isFinite(time) || scheduledLocalValue(date) !== value || time <= now || time > now + MAX_LEAD_MS) return null
  return date.toISOString()
}
