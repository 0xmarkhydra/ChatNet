import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { collectViolations, compareBaseline } from './architecture-boundaries-check.mjs'

function fixture(files, check) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chatnet-architecture-'))
  try {
    for (const [name, body] of Object.entries(files)) {
      const file = path.join(directory, name)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, body)
    }
    return check(collectViolations(directory).violations)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

test('catches reverse dependencies and foreign feature API access', () => {
  fixture({
    'shared/thing.ts': "import '../features/chat/api/request'\n",
    'features/chat/api/request.ts': 'export const ok = true\n',
    'features/feed/widget.ts': "export { ok } from '../chat/api/request'\n",
    'features/feed/other.ts': "import { ok } from '../chat/api/request'\n",
  }, violations => {
    assert.ok(violations.some(item => item.startsWith('reverse-import: shared/thing.ts')))
    assert.ok(violations.some(item => item.startsWith('api-ownership: features/feed/widget.ts')))
    assert.ok(violations.some(item => item.startsWith('api-ownership: features/feed/other.ts')))
  })
})

test('enforces public entrypoints but accepts published feature index', () => {
  fixture({
    'features/chat/index.ts': "export const chat = 1\n",
    'features/chat/hooks/private.ts': 'export const privateChat = 1\n',
    'features/feed/ok.ts': "import { chat } from '../chat'\n",
    'features/feed/bad.ts': "import { privateChat } from '../chat/hooks/private'\n",
  }, violations => {
    assert.deepEqual(violations.filter(item => item.startsWith('feature-entrypoint:')),
      ['feature-entrypoint: features/feed/bad.ts -> features/chat/hooks/private.ts'])
  })
})

test('reports dependency cycles and dynamic imports', () => {
  fixture({
    'features/chat/a.ts': "import './b'\n",
    'features/chat/b.ts': "export * from './a'\n",
    'features/feed/load.ts': "const load = () => import('../chat/a')\n",
  }, violations => {
    assert.ok(violations.some(item => item.startsWith('dependency-cycle:')))
    assert.ok(violations.some(item => item.startsWith('feature-entrypoint: features/feed/load.ts')))
  })
})



test('detects aliased deep imports, even when a feature exposes a public index', () => {
  fixture({
    'features/auth/index.ts': "export type { Session } from './types'\\n",
    'features/auth/types.ts': 'export type Session = { id: string }\\n',
    'features/chat/useSession.ts': "import type { Session } from '@/features/auth/types'\\n",
    'features/chat/usePublicSession.ts': "import type { Session } from '@/features/auth'\\n",
  }, violations => {
    assert.deepEqual(violations.filter(item => item.startsWith('feature-entrypoint:')),
      ['feature-entrypoint: features/chat/useSession.ts -> features/auth/types.ts'])
  })
})

test('does not allow a public index to bypass foreign feature API ownership', () => {
  fixture({
    'features/chat/api/request.ts': 'export const request = () => 1\\n',
    'features/chat/index.ts': "export { request } from './api/request'\\n",
    'features/feed/fromApi.ts': "import { request } from '../chat/api/request'\\n",
    'features/feed/fromPublic.ts': "import { request } from '../chat'\\n",
  }, violations => {
    assert.deepEqual(violations.filter(item => item.startsWith('api-ownership:')),
      ['api-ownership: features/feed/fromApi.ts -> features/chat/api/request.ts'])
  })
})

test('legacy baseline permits old violations but rejects newly introduced ones', () => {
  assert.deepEqual(compareBaseline(['old', 'new'], ['old']), ['new'])
  assert.deepEqual(compareBaseline(['old'], ['old', 'removed']), [])
})
