// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Story } from '../types'
import StoryTray from './StoryTray'

let root: Root
let host: HTMLDivElement

const story = (id: number, author: string, createdAt: string): Story => ({
  id, author, authorDisplayName: author, createdAt, expiresAt: '2099-01-01T00:00:00Z', text: 'Xin chào', background: 'indigo',
})
const stories = [story(1, 'an', '2026-11-24T08:00:00Z'), story(2, 'binh', '2026-11-24T09:00:00Z'), story(3, 'me', '2026-11-24T07:00:00Z')]

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

function render(seen: Set<number>, handlers: { onOpen?: (id: number) => void; onSeeAll?: () => void; onCreate?: () => void } = {}) {
  return act(async () => root.render(
    <StoryTray username="me" displayName="Tôi" stories={stories} seen={seen} busy={false}
      onCreate={handlers.onCreate ?? (() => {})} onOpen={handlers.onOpen ?? (() => {})} onSeeAll={handlers.onSeeAll ?? (() => {})} />,
  ))
}

describe('StoryTray', () => {
  it('shows one card per friend, not the own story, and labels seen state', async () => {
    await render(new Set([1]))
    const labels = [...host.querySelectorAll('button')].map(button => button.getAttribute('aria-label'))
    expect(labels).toContain('Xem Story của binh, chưa xem')
    expect(labels).toContain('Xem Story của an, đã xem')
    expect(labels.some(label => label?.includes('me'))).toBe(false)
  })

  it('opens the first unseen story of a person and wires the other actions', async () => {
    const onOpen = vi.fn(), onSeeAll = vi.fn(), onCreate = vi.fn()
    await render(new Set(), { onOpen, onSeeAll, onCreate })
    const byLabel = (label: string) => host.querySelector(`button[aria-label^="${label}"]`) as HTMLButtonElement
    await act(async () => byLabel('Xem Story của binh').click())
    expect(onOpen).toHaveBeenCalledWith(2)
    await act(async () => byLabel('Tạo Story mới').click())
    expect(onCreate).toHaveBeenCalled()
    await act(async () => ([...host.querySelectorAll('button')].find(b => b.textContent === 'Xem tất cả') as HTMLButtonElement).click())
    expect(onSeeAll).toHaveBeenCalled()
  })
})
