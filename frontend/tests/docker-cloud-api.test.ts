import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const compose = readFileSync(new URL('../../docker-compose.yml', import.meta.url), 'utf8')

describe('Docker frontend preview API origin', () => {
  it('defaults to cloud data and does not proxy authentication to local backend', () => {
    expect(compose).toMatch(/VITE_API_URL:\s*\$\{VITE_API_URL:-https:\/\/api-chat\.codelocal\.cloud\}/)
    expect(compose).toMatch(/VITE_API_PROXY:\s*["']?0["']?/)
  })
})
