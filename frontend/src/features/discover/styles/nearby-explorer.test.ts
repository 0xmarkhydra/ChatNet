import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./nearby-explorer.css', import.meta.url)), 'utf8')

describe('nearby mobile list accessibility', () => {
  it('keeps non-selected place rows visible on narrow map layouts', () => {
    const mobile = css.split('@media (max-width: 760px)')[1]
    expect(mobile).toBeTruthy()
    expect(mobile).not.toMatch(/\.map-view\s+\.nearby-place-list\s*>\s*:not\(\.selected\)\s*\{\s*display:\s*none/)
    expect(mobile).toContain('overscroll-behavior: contain')
    expect(mobile).toContain('.nearby-place-row { min-height: 56px; }')
  })
})
