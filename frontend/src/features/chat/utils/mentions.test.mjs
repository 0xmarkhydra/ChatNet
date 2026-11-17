import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { findMentionQuery, insertMention, matchMentionMembers, mentionedUsernames, splitMessageMentions } from './mentions.ts'

const members = [
  { id: 1, username: 'minhanh', displayName: 'Minh Anh', role: 'member', online: true },
  { id: 2, username: 'trung', displayName: 'Trung Nguyễn', role: 'member', online: false },
]

describe('chat mentions', () => {
  it('finds mentions at the cursor and ignores email and completed mentions', () => {
    assert.deepEqual(findMentionQuery('Chào @min', 9), { start: 5, end: 9, query: 'min' })
    assert.equal(findMentionQuery('email@example.com', 17), null)
    assert.equal(findMentionQuery('Chào @minh bạn', 14), null)
    assert.deepEqual(findMentionQuery('Chào @minhanh bạn', 9), { start: 5, end: 13, query: 'min' })
    assert.deepEqual(findMentionQuery('Hi @trung', 4), { start: 3, end: 9, query: '' })
  })

  it('replaces an unfinished mention', () => {
    assert.deepEqual(insertMention('Chào @minhanh bạn', { start: 5, end: 13, query: 'min' }, 'trung'), { text: 'Chào @trung bạn', cursor: 11 })
  })

  it('matches members and filters out duplicate mentions', () => {
    assert.deepEqual(matchMentionMembers(members, 'nguyen').map(x => x.id), [2])
    assert.deepEqual(matchMentionMembers(members, '', 'Hi @minhanh và @').map(x => x.id), [2])
    assert.deepEqual([...mentionedUsernames('Hello @minhanh và @all')].sort(), ['all', 'minhanh'])
    assert.deepEqual(matchMentionMembers(members, '', 'Bỏ @minhanh'), [members[1]])
    assert.deepEqual(matchMentionMembers(members, 'minhanh', '@minhanh', { start: 0, end: 8, query: 'minhanh' }), [members[0]])
    assert.deepEqual(matchMentionMembers(members, 'minhanh', '@minhanh @minhanh', { start: 9, end: 17, query: 'minhanh' }), [])
    assert.deepEqual(matchMentionMembers(members, 'trung', 'Chào @trung', { start: 5, end: 11, query: 'trung' }), [members[1]])
  })

  it('inserts named and @all mentions without adding extra spaces', () => {
    assert.deepEqual(insertMention('Chào @min nhé', { start: 5, end: 9, query: 'min' }, 'minhanh'), { text: 'Chào @minhanh nhé', cursor: 13 })
    assert.deepEqual(insertMention('@a', { start: 0, end: 2, query: 'a' }, 'all'), { text: '@all ', cursor: 5 })
  })

  it('highlights known users and @all while preserving ordinary text', () => {
    assert.deepEqual(splitMessageMentions('Chào @minhanh và @unknown', members), [
      { text: 'Chào ' },
      { text: '@minhanh', username: 'minhanh' },
      { text: ' và @unknown' },
    ])
    assert.deepEqual(splitMessageMentions('Xin @all và @trung!', members), [
      { text: 'Xin ' },
      { text: '@all', all: true },
      { text: ' và ' },
      { text: '@trung', username: 'trung' },
      { text: '!' },
    ])
  })
})
