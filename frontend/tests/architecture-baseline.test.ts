import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const baselinePath = fileURLToPath(new URL('../scripts/architecture-baseline.json', import.meta.url))
const checkPath = fileURLToPath(new URL('../scripts/architecture-boundaries-check.mjs', import.meta.url))
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { violations: string[] }

describe('architecture baseline integrity', () => {
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
