// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ContactInvitations from './ContactInvitations'
import type { FriendConnection, FriendSearchResult } from '../types'

vi.mock('./ContactQrPanel', () => ({ default: () => <div data-testid="qr-panel">QR</div> }))

const incoming = { id: 1, username: 'incoming', displayName: 'Bạn đến', direction: 'incoming' } as FriendConnection
const outgoing = { id: 2, username: 'outgoing', displayName: 'Bạn gửi', direction: 'outgoing' } as FriendConnection
let container: HTMLDivElement
let root: Root
let accept = vi.fn(async (_friend: FriendConnection | FriendSearchResult) => {})
let decline = vi.fn(async (_friend: FriendConnection) => {})

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  accept = vi.fn(async (_friend: FriendConnection | FriendSearchResult) => {})
  decline = vi.fn(async (_friend: FriendConnection) => {})
  await renderInvitations()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderInvitations(busy = new Set<number>()) {
  await act(async () => {
    root.render(<ContactInvitations
      friendRequests={[incoming, outgoing]} friendBusyIds={busy}
      actOnFriend={accept} declineFriendRequest={decline}
      connectionUrl="https://example.com/connect" onScanQr={vi.fn()}
      onBack={vi.fn()} onSearch={vi.fn()}
    />)
  })
}

function tab(label: string) {
  const result = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(el => el.textContent === label)
  if (!result) throw new Error('Missing tab: ' + label)
  return result
}

describe('ContactInvitations interactions', () => {
  it('navigates tabs using ArrowRight, End and Home while preserving focus', async () => {
    tab('Lời mời đến').focus()
    await act(async () => {
      tab('Lời mời đến').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(tab('Đã gửi').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tab('Đã gửi'))
    expect(container.textContent).toContain('Bạn gửi')
    await act(async () => {
      tab('Đã gửi').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    })
    expect(tab('Quét QR').getAttribute('aria-selected')).toBe('true')
    await act(async () => {
      tab('Quét QR').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    })
    expect(tab('Lời mời đến').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tab('Lời mời đến'))
  })

  it('keeps accept and decline wired to the existing callbacks', async () => {
    const acceptButton = container.querySelector<HTMLButtonElement>('[aria-label="Chấp nhận lời mời của Bạn đến"]')
    const declineButton = container.querySelector<HTMLButtonElement>('[aria-label="Từ chối lời mời của Bạn đến"]')
    await act(async () => acceptButton?.click())
    await act(async () => declineButton?.click())
    expect(accept).toHaveBeenCalledWith(incoming)
    expect(decline).toHaveBeenCalledWith(incoming)
  })

  it('disables both actions while a request is being processed', async () => {
    await renderInvitations(new Set([1]))
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Chấp nhận lời mời của Bạn đến"]')?.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Từ chối lời mời của Bạn đến"]')?.disabled).toBe(true)
  })
})
