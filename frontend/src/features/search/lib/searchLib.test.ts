// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Post } from '../../feed'
import { activeFilters, effectiveFilters, filterPosts, filterProducts, parseFilters, parsePrice } from './searchFilters'
import { addOpened, addRecent, emptyHistory, getHistory, isSaved, markSeen, readHistory, toggleSaved, updateHistory } from './searchHistory'

const stored = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => { stored.set(key, value) },
  clear: () => stored.clear(),
})

const post = (id: number, createdAt: string, extra: Partial<Post> = {}): Post => ({
  id, author: 'a', content: 'x', likes: 0, liked: false, comments: [], createdAt, visibility: 'public', ...extra,
})

describe('searchFilters', () => {
  it('falls back to defaults for unknown values and maps the legacy 30-day range', () => {
    const values = parseFilters(new URLSearchParams('sort=bogus&range=30d&has=image'))
    expect(values.sort).toBe('relevant')
    expect(values.time).toBe('month')
    expect(values.has).toBe('image')
  })

  it('ignores filters that do not belong to the current type', () => {
    const values = effectiveFilters('all', parseFilters(new URLSearchParams('has=image&time=week&status=online')))
    expect(values.has).toBe('any')
    expect(values.status).toBe('any')
    expect(activeFilters('all', values)).toEqual([{ id: 'time', label: '7 ngày qua' }])
  })

  it('filters posts by time, attachment and public visibility, and sorts newest first', () => {
    const now = Date.parse('2026-11-23T12:00:00Z')
    const posts = [
      post(1, '2026-11-01T00:00:00Z'),
      post(2, '2026-11-22T00:00:00Z', { attachments: [{ storageRef: 'r', name: 'a.png', sizeBytes: 1, contentType: 'image/png', kind: 'image' }] }),
      post(3, '2026-11-23T00:00:00Z', { visibility: 'friends' }),
      post(4, '2026-11-23T06:00:00Z'),
    ]
    const week = effectiveFilters('posts', parseFilters(new URLSearchParams('time=week&sort=newest')))
    expect(filterPosts(posts, week, now).map(item => item.id)).toEqual([4, 2])
    const images = effectiveFilters('posts', parseFilters(new URLSearchParams('has=image')))
    expect(filterPosts(posts, images, now).map(item => item.id)).toEqual([2])
    const following = effectiveFilters('posts', parseFilters(new URLSearchParams('in=following')))
    expect(filterPosts(posts, following, now).map(item => item.id)).toEqual([1, 2, 3, 4])
  })

  it('matches products accent-insensitively with stock and price filters', () => {
    const products = [
      { id: 1, sellerId: 1, title: 'Bàn phím cơ', description: '', priceAmount: 900, priceUnit: 'VND', stock: 0 },
      { id: 2, sellerId: 1, title: 'Ban phim gaming', description: '', priceAmount: 500, priceUnit: 'VND', stock: 3 },
      { id: 3, sellerId: 1, title: 'Chuột', description: 'không phải bàn phím', priceAmount: 100, priceUnit: 'VND', stock: 1 },
    ]
    const values = effectiveFilters('products', parseFilters(new URLSearchParams('psort=price-asc')))
    expect(filterProducts(products, 'bàn phím', values, null, null).map(item => item.id)).toEqual([3, 2, 1])
    const inStock = effectiveFilters('products', parseFilters(new URLSearchParams('stock=in')))
    expect(filterProducts(products, 'ban phim', inStock, 200, null).map(item => item.id)).toEqual([2])
    expect(parsePrice('-5')).toBeNull()
    expect(parsePrice('')).toBeNull()
    expect(parsePrice('20')).toBe(20)
  })
})

describe('searchHistory', () => {
  afterEach(() => localStorage.clear())

  it('deduplicates recent queries case-insensitively and caps the list', () => {
    let history = emptyHistory
    for (let index = 0; index < 10; index += 1) history = addRecent(history, 'q' + index)
    history = addRecent(history, 'Q3')
    expect(history.recent).toHaveLength(8)
    expect(history.recent[0]).toBe('Q3')
    expect(history.recent.filter(item => item.toLowerCase() === 'q3')).toHaveLength(1)
  })

  it('toggles saved searches, marks them seen and keeps opened results unique', () => {
    let history = toggleSaved(emptyHistory, 'designer', 1)
    expect(isSaved(history, 'Designer')).toBe(true)
    history = markSeen(history, 'designer', 5)
    expect(history.saved[0].seenAt).toBe(5)
    history = addOpened(addOpened(history, { kind: 'person', username: 'alice', title: 'Alice' }), { kind: 'person', username: 'alice', title: 'Alice 2' })
    expect(history.opened).toEqual([{ kind: 'person', username: 'alice', title: 'Alice 2' }])
    expect(isSaved(toggleSaved(history, 'DESIGNER', 9), 'designer')).toBe(false)
  })

  it('persists per session scope and ignores malformed storage', () => {
    updateHistory('session-x', history => addRecent(history, 'hello'))
    expect(readHistory('session-x').recent).toEqual(['hello'])
    expect(getHistory('session-y').recent).toEqual([])
    localStorage.setItem('socco.search.v1:session-z', '{bad json')
    expect(readHistory('session-z')).toEqual(emptyHistory)
    localStorage.setItem('socco.search.v1:session-w', JSON.stringify({ recent: [1, 'ok'], opened: [{ kind: 'post', id: 'x' }] }))
    expect(readHistory('session-w')).toEqual({ recent: ['ok'], saved: [], opened: [] })
  })
})
