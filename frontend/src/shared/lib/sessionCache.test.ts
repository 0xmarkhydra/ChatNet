import { describe, expect, it } from 'vitest'
import { SessionCacheInvalidatedError, SessionResponseCache } from './sessionCache'

describe('typed cache invalidation', () => {
 it('rejects invalidated in-flight reads without changing the displayed message', async () => {
  const cache = new SessionResponseCache()
  let finish!: (response: Response) => void
  const pending = cache.read('user:session', '/api/profile', () => new Promise(resolve => { finish = resolve }))
  cache.invalidate(['profiles'])
  finish(Response.json({ private: true }))
  await expect(pending).rejects.toMatchObject({
   name: 'SessionCacheInvalidatedError',
   message: 'Dữ liệu đã thay đổi. Hãy thử lại.',
  })
 })

 it('invalidates pending reads when the session changes', async () => {
  const cache = new SessionResponseCache()
  let finish!: (response: Response) => void
  const pending = cache.read('first', '/api/posts', () => new Promise(resolve => { finish = resolve }))
  cache.setScope('second')
  finish(Response.json({ private: true }))
  await expect(pending).rejects.toBeInstanceOf(SessionCacheInvalidatedError)
 })
})
