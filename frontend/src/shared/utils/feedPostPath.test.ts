import { describe, expect, it } from 'vitest'
import { feedPostIdFromUrl } from './feedPostPath'

describe('feedPostIdFromUrl', () => {
  const origin = 'http://localhost:5173'
  it.each([
    'https://chat.codelocal.cloud/feed/posts/15/?post=20#comments',
    'https://chat.codelocal.cloud/feed?post=15&tab=feed',
    'https://chat.codelocal.cloud/?tab=feed&post=15',
    'http://localhost:5173/feed/posts/15',
    'http://localhost:5173/feed/posts/15?ref=share',
  ])('recognizes %s', url => expect(feedPostIdFromUrl(new URL(url), origin)).toBe(15))

  it.each([
    'https://chat.codelocal.cloud.example/feed/posts/15',
    'https://chat.codelocal.cloud:8443/feed/posts/15',
    'https://name@chat.codelocal.cloud/feed/posts/15',
    'https://chat.codelocal.cloud/feed/posts/0',
    'https://chat.codelocal.cloud/feed/posts/15/more',
    'https://chat.codelocal.cloud/feed?post=9007199254740992',
    'https://chat.codelocal.cloud/?tab=chat&post=15',
  ])('ignores %s', url => expect(feedPostIdFromUrl(new URL(url), origin)).toBeNull())
})
