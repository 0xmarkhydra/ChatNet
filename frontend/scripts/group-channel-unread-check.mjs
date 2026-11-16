import assert from 'node:assert/strict'
import { validGroupChannels, totalGroupChannelUnread } from '../src/features/chat/utils/groupChannels.ts'

const groupId = 42
const channels = validGroupChannels([
  { id: 0, name: 'Thảo luận chung', unreadCount: 3, lastMessage: '' },
  { id: 7, name: 'Hỏi đáp', unreadCount: 5, lastMessage: '' },
  { id: 8, name: 'Bài tập', unreadCount: 2, lastMessage: '' },
], groupId)
assert.equal(totalGroupChannelUnread(channels), 10, 'Group badge must sum channel badges')

const afterRead = channels.map(channel => channel.id === 7 ? { ...channel, unreadCount: 0 } : channel)
assert.equal(totalGroupChannelUnread(afterRead), 5, 'Reading one channel must not clear other channels')
assert.equal(afterRead.find(channel => channel.id === 0)?.unreadCount, 3)
assert.equal(afterRead.find(channel => channel.id === 8)?.unreadCount, 2)

const generalOnly = validGroupChannels([{ id: 0, name: 'General', unreadCount: 4 }], groupId)
assert.equal(generalOnly.length, 1, 'General channel must not be double counted')
assert.equal(totalGroupChannelUnread(generalOnly), 4)

console.log('Group-channel unread badge checks passed (sum, read isolation, general channel)')
