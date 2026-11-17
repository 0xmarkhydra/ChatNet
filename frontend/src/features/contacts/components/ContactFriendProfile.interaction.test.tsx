// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ContactFriendProfile from './ContactFriendProfile'
import type { FriendConnection, FriendSearchResult } from '../types'

const friend = {
  id: 17, username: 'friend17', displayName: 'Bạn thử nghiệm', online: true,
  blockedByMe: false, blockedByOther: false,
} as FriendConnection
let host: HTMLDivElement
let root: Root

const changePersonalContact = vi.fn(async (_friend: FriendConnection, _field: 'nickname' | 'note' | 'favorite') => {})
const removeAcceptedFriend = vi.fn(async (_friend: FriendConnection) => {})
const blockContact = vi.fn(async (_friend: FriendConnection | FriendSearchResult) => {})
const unblockContact = vi.fn(async (_id: number) => {})
const reportContact = vi.fn(async (_friend: FriendConnection | FriendSearchResult) => {})
const openChat = vi.fn()
const startCall = vi.fn()
const setFriendPreview = vi.fn()

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  vi.clearAllMocks()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

async function renderProfile(contact = friend, busy = false, favorite = false, iconOnly = false) {
  await act(async () => root.render(
    <ContactFriendProfile
      friend={contact}
      contactMetadata={{ [contact.id]: { nickname: 'Bạn thân', note: 'Ghi chú riêng', favorite } }}
      friendBusyIds={busy ? new Set([contact.id]) : new Set()}
      friendMenuId={null} setFriendMenuId={vi.fn()}
      setFriendPreview={setFriendPreview}
      changePersonalContact={changePersonalContact}
      removeAcceptedFriend={removeAcceptedFriend}
      blockContact={blockContact}
      unblockContact={unblockContact}
      reportContact={reportContact}
      openChat={openChat} startCall={startCall}
      isBlocked={() => Boolean(contact.blockedByMe || contact.blockedByOther)}
      iconOnly={iconOnly}
    />
  ))
}

function button(label: string) {
  const element = [...host.querySelectorAll<HTMLButtonElement>('button')].find(el => el.textContent?.trim() === label)
  if (!element) throw new Error('Missing action: ' + label)
  return element
}

describe('ContactFriendProfile interactions', () => {
  it('routes chat, call and favorite actions to the supplied handlers', async () => {
    await renderProfile()
    await act(async () => button('Nhắn tin').click())
    await act(async () => button('Gọi thoại').click())
    await act(async () => button('Ghim').click())
    expect(openChat).toHaveBeenCalledWith(friend)
    expect(startCall).toHaveBeenCalledWith(friend)
    expect(changePersonalContact).toHaveBeenCalledWith(friend, 'favorite')
  })

  it('disables metadata and destructive actions while busy, but keeps navigation available', async () => {
    await renderProfile(friend, true)
    for (const name of ['Đặt biệt danh', 'Ghim', 'Chặn', 'Báo cáo', 'Hủy kết bạn']) {
      expect(button(name).disabled).toBe(true)
    }
    await act(async () => button('Xem trang cá nhân').click())
    expect(setFriendPreview).toHaveBeenCalledWith(friend)
  })

  it('disables calls for blocked contacts while keeping the conversation accessible', async () => {
    await renderProfile({ ...friend, blockedByMe: true }, false, true, true)
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Gọi thoại cho Bạn thử nghiệm"]')?.disabled).toBe(true)
    const chat = host.querySelector<HTMLButtonElement>('[aria-label="Xem hội thoại với Bạn thử nghiệm"]')
    expect(chat?.disabled).toBe(false)
    await act(async () => chat?.click())
    expect(openChat).toHaveBeenCalledTimes(1)
    expect(host.querySelector('[aria-pressed="true"]')).not.toBeNull()
  })
})
