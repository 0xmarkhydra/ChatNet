import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const baselinePath = fileURLToPath(new URL('../scripts/architecture-baseline.json', import.meta.url))
const checkPath = fileURLToPath(new URL('../scripts/architecture-boundaries-check.mjs', import.meta.url))
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { violations: string[] }

describe('architecture baseline integrity', () => {
  it('allows only the public index and types in the chat root', () => {
    const root = mkdtempSync(join(tmpdir(), 'chatnet-architecture-'))
    try {
      const chat = join(root, 'features', 'chat')
      mkdirSync(chat, { recursive: true })
      writeFileSync(join(chat, 'index.ts'), "export type { Message } from './types'\n")
      writeFileSync(join(chat, 'types.ts'), 'export type Message = { id: number }\n')
      writeFileSync(join(chat, 'AccidentalComponent.tsx'), 'export default function AccidentalComponent() { return null }\n')
      const report = execFileSync(process.execPath, [checkPath, '--report'], {
        encoding: 'utf8', env: { ...process.env, ARCHITECTURE_SRC_ROOT: root },
      })
      expect(report).toContain('chat-root: features/chat/AccidentalComponent.tsx')
      expect(report).not.toContain('chat-root: features/chat/index.ts')
      expect(report).not.toContain('chat-root: features/chat/types.ts')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('contains distinct, sorted architecture violations', () => {
    expect(baseline.violations).toEqual([...new Set(baseline.violations)].sort())
    expect(baseline.violations.every(value =>
      /^(api-ownership|chat-root|dependency-cycle|feature-entrypoint|reverse-import): /.test(value),
    )).toBe(true)
  })

  it('does not preserve legacy violations that have disappeared', () => {
    const report = execFileSync(process.execPath, [checkPath, '--report'], { encoding: 'utf8' })
    const current = new Set(report.split('\n').filter(line =>
      /^(api-ownership|chat-root|dependency-cycle|feature-entrypoint|reverse-import): /.test(line),
    ))
    expect(baseline.violations.filter(value => !current.has(value))).toEqual([])
  })
})
