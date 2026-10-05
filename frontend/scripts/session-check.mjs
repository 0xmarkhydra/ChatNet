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
  assert.equal(refreshes, 1)
  assert.equal(requests, 8)
  assert.equal(current.sessionId, 'login-1')
  assert.equal(expired, 0)

  // Upgrade existing installs while their access credential is still valid.
  reset()
  delete current.refreshToken
  current.token = jwt(3600)
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.Authorization, `Bearer ${current.token}`)
    return json({ ...current, refreshToken: 'n'.repeat(43) })
  }
  await client.refresh()
  assert.equal(current.refreshToken, 'n'.repeat(43))
  assert.equal(current.sessionId, 'login-1')

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
  assert.equal(refreshes, 1)
  assert.equal(expired, 0, 'only auth service can expire a session')
  await assert.rejects(client.request('/api/posts', {}, 'old-login'))
  assert.equal(requests, 2)

  assert.equal(parseSession({ ...original(), refreshToken: 'bad' }), null)
  assert.equal(parseSession({ ...original(), refreshToken: ['r'.repeat(43)] }), null)
  assert.equal(parseSession({ ...original(), sessionId: {} }), null)
  assert.equal(parseSession({ ...original(), user: { id: -1 } }), null)
  console.log('Session checks passed: refresh, concurrency, legacy migration, offline, expiry, stale responses, bounded retry.')
} finally {
  globalThis.fetch = realFetch
}
