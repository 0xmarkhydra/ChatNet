import assert from 'node:assert/strict'
import { createSessionClient, parseSession } from '../src/session.ts'

const jwt = (seconds) => `header.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + seconds })).toString('base64url')}.signature`
const original = () => ({
  token: jwt(-60), refreshToken: 'r'.repeat(43), sessionId: 'login-1',
  user: { id: 1, email: 'test@example.com', username: 'tester', displayName: 'Test' },
})
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
let current, expired, refreshes, requests
const client = createSessionClient('https://local.test', {
  get: () => current,
  save: (next) => { current = next },
  expire: () => { expired++; current = null },
})
function reset() {
  current = original()
  expired = refreshes = requests = 0
}
const realFetch = globalThis.fetch
try {
  reset()
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/refresh')) {
      refreshes++
      assert.equal(JSON.parse(init.body).refreshToken, current.refreshToken)
      await new Promise((resolve) => setTimeout(resolve, 10))
      return json({ ...current, token: jwt(86400) })
    }
    requests++
    assert.equal(init.headers.get('Authorization'), `Bearer ${current.token}`)
    return json({ ok: true })
  }
  await Promise.all(Array.from({ length: 8 }, () => client.request('/api/posts', {}, 'login-1')))
  assert.equal(refreshes, 1, 'read-only calls share one renewal')
  assert.equal(requests, 8)
  assert.equal(current.sessionId, 'login-1')
  assert.equal(expired, 0)

  // Old access-only installs must sign in again: legacy renewal bypassed logout.
  reset()
  delete current.refreshToken
  current.token = jwt(3600)
  globalThis.fetch = async () => { throw new Error('legacy renew must never fetch') }
  assert.equal(await client.refresh(), null)
  assert.equal(expired, 1)
  assert.equal(current, null)

  // Offline, upstream errors and malformed responses must preserve the saved session.
  for (const failure of [new Error('offline'), json({}, 503), json({}, 429), json({})]) {
    reset()
    const before = current
    globalThis.fetch = async () => {
      if (failure instanceof Error) throw failure
      return failure
    }
    await assert.rejects(client.refresh())
    assert.equal(current, before)
    assert.equal(expired, 0)
  }

  reset()
  globalThis.fetch = async () => json({}, 401)
  await client.refresh()
  assert.equal(current, null)
  assert.equal(expired, 1)

  // Late responses must never resurrect logout or overwrite another login/profile update.
  for (const status of [200, 401]) {
    for (const change of ['logout', 'login', 'profile']) {
      reset()
      const previous = current
      let finish
      globalThis.fetch = () => new Promise((resolve) => { finish = resolve })
      const pending = client.refresh()
      current = change === 'logout' ? null : {
        ...previous, sessionId: change === 'login' ? 'login-2' : 'login-1', token: jwt(9000),
      }
      const expected = current
      finish(json({ ...previous, token: jwt(86400) }, status))
      await pending
      assert.equal(current, expected)
      assert.equal(expired, 0)
    }
  }

  reset()
  current.token = jwt(86400)
  globalThis.fetch = async (url) => {
    if (url.endsWith('/refresh')) {
      refreshes++
      return json({ ...current, token: jwt(80000) })
    }
    requests++
    return json({}, 401)
  }
  const response = await client.request('/api/posts', { method: 'POST', body: 'unchanged' }, 'login-1')
  assert.equal(response.status, 401)
  assert.equal(requests, 2, 'retry at most once')
  assert.equal(refreshes, 2, 'one preflight check and one retry refresh')
  assert.equal(expired, 0, 'only auth service can expire a session')
  await assert.rejects(client.request('/api/posts', {}, 'old-login'))
  assert.equal(requests, 2)

  // Even if Chat/Feed is running an outdated build, reject writes when
  // the Auth service no longer recognizes the refresh session.
  for (const path of ['/api/posts', '/api/conversations/42/messages']) {
    reset()
    current.token = jwt(86400)
    globalThis.fetch = async (url) => {
      if (url.endsWith('/refresh')) {
        refreshes++
        return json({}, 401)
      }
      requests++
      return json({ id: 1 }, 201)
    }
    await assert.rejects(client.request(path, { method: 'POST' }, 'login-1'))
    assert.equal(refreshes, 1)
    assert.equal(requests, 0, 'revoked credentials reached ' + path)
    assert.equal(expired, 1)
    assert.equal(current, null)
  }

  // Proactive checks work without changing the JWT or restarting EventSource.
  reset()
  current.token = jwt(86400)
  const stored = current
  globalThis.fetch = async (url) => {
    assert.ok(url.endsWith('/refresh'))
    return json({ token: jwt(86400) })
  }
  assert.equal(await client.check(), true)
  assert.equal(current, stored)
  assert.equal(expired, 0)

  // Temporary backend/network failures must not destroy the local session.
  reset()
  current.token = jwt(86400)
  globalThis.fetch = async () => json({}, 503)
  await assert.rejects(client.check())
  assert.ok(current)
  assert.equal(expired, 0)

  // A late revocation response must never sign out another newly logged-in session.
  reset()
  current.token = jwt(86400)
  let finishCheck
  globalThis.fetch = () => new Promise((resolve) => { finishCheck = resolve })
  const staleCheck = client.check()
  current = { ...original(), sessionId: 'login-2', token: jwt(86400) }
  finishCheck(json({}, 401))
  assert.equal(await staleCheck, false)
  assert.equal(current.sessionId, 'login-2')
  assert.equal(expired, 0)

  assert.equal(parseSession({ ...original(), refreshToken: 'bad' }), null)
  assert.equal(parseSession({ ...original(), refreshToken: ['r'.repeat(43)] }), null)
  assert.equal(parseSession({ ...original(), sessionId: {} }), null)
  assert.equal(parseSession({ ...original(), user: { id: -1 } }), null)
  console.log('Session checks passed: refresh, concurrency, revoked chat/feed mutation preflight, proactive revocation checks, legacy safety, offline, expiry, stale responses, bounded retry.')
} finally {
  globalThis.fetch = realFetch
}
