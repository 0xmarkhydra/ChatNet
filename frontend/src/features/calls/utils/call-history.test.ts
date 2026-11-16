import { describe, expect, it } from 'vitest'
import type { CallHistoryEntry } from '../lib/calls'
import { callOutcome } from './call-history'

const entry = (changes: Partial<CallHistoryEntry>): CallHistoryEntry => ({
  createdBy: 7, joined: false, declined: false, ...changes,
} as CallHistoryEntry)

describe('callOutcome', () => {
  it('preserves missed and declined incoming call labels', () => {
    expect(callOutcome(entry({}), 8)).toBe('Gọi nhỡ')
    expect(callOutcome(entry({ declined: true }), 8)).toBe('Đã từ chối')
  })

  it('distinguishes outgoing from answered incoming calls', () => {
    expect(callOutcome(entry({ joined: true, startedAt: '2026-11-13T03:00:00Z' }), 7)).toBe('Đã gọi')
    expect(callOutcome(entry({ joined: true, startedAt: '2026-11-13T03:00:00Z' }), 8)).toBe('Đã nhận')
    expect(callOutcome(entry({}), 7)).toBe('Không kết nối')
  })
})
