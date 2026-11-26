export function relativeStoryTime(date: string, justNow: string, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - Date.parse(date)) / 60000)
  if (!Number.isFinite(minutes)) return ''
  if (minutes < 1) return justNow
  if (minutes < 60) return minutes + ' phút trước'
  if (minutes < 1440) return Math.floor(minutes / 60) + ' giờ trước'
  return Math.floor(minutes / 1440) + ' ngày trước'
}
