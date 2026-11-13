import type { CallHistoryEntry } from '../lib/calls'

export function formatCallDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function callOutcome(entry: CallHistoryEntry, userId: number): string {
  if (entry.createdBy !== userId && !entry.joined && !entry.declined) return 'Gọi nhỡ'
  if (entry.declined) return 'Đã từ chối'
  if (entry.joined && entry.startedAt) return entry.createdBy === userId ? 'Đã gọi' : 'Đã nhận'
  return 'Không kết nối'
}

function durationSeconds(entry: CallHistoryEntry): number | null {
  if (!entry.joined || entry.status !== 'ended' || !entry.startedAt || !entry.endedAt) return null
  const start = Date.parse(entry.startedAt)
  const end = Date.parse(entry.endedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return Math.floor((end - start) / 1000)
}

function formatSeconds(seconds: number): string {
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
}

export function formatDuration(entry: CallHistoryEntry): string {
  const seconds = durationSeconds(entry)
  return seconds === null ? '00:00' : formatSeconds(seconds)
}

// The history API returns newest first. Unanswered calls have zero duration.
export function latestCallDuration(entries: readonly CallHistoryEntry[]): string {
  return entries[0] ? formatDuration(entries[0]) : '00:00'
}
