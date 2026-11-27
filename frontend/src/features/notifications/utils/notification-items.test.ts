import { describe, expect, it } from 'vitest'
import { countUnreadNotificationItems, filterNotificationItems, type NotificationItem } from './notification-items'

const items: NotificationItem[] = [
  { key: 'friend:1', kind: 'friend', name: 'An', subtitle: 'đã gửi lời mời kết bạn', date: '' },
  { key: 'chat:2', kind: 'message', name: 'Nhóm', subtitle: 'có 2 tin nhắn chưa đọc', date: '' },
  { key: 'mention:3', kind: 'mention', name: 'Bình', subtitle: 'đã gắn thẻ bạn', date: '', mention: { id: 3, readAt: '2026-11-13' } as NonNullable<NotificationItem['mention']> },
]

describe('notification presentation helpers', () => {
  it('filters unread items without treating read mentions as unread', () => {
    expect(filterNotificationItems(items, 'unread', '').map(item => item.key)).toEqual(['friend:1', 'chat:2'])
    expect(countUnreadNotificationItems(items)).toBe(2)
  })

  it('applies mention and Vietnamese text filters independently of read state', () => {
    expect(filterNotificationItems(items, 'mentions', '').map(item => item.key)).toEqual(['mention:3'])
    expect(filterNotificationItems(items, 'all', 'nhÓm').map(item => item.key)).toEqual(['chat:2'])
  })
})