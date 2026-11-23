import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button } from './button'
import { Input } from './input'

const theme = readFileSync(new URL('../../styles/soco-theme.css', import.meta.url), 'utf8')
const tailwind = readFileSync(new URL('../../styles/tailwind.css', import.meta.url), 'utf8')

describe('shared UI design token contract', () => {
  it.each([
    ['input', '#f8fafe'],
    ['page', '#f7f9fd'],
  ])('maps existing %s surface without changing its approved value', (name, value) => {
    expect(theme).toContain(`--soco-surface-${name}: ${value};`)
    expect(tailwind).toContain(`--color-surface-${name}: var(--soco-surface-${name});`)
  })

  it.each([
    ['like', '#ee416a'],
    ['like-hover', '#fff2f6'],
  ])('keeps the approved reaction %s color separate from primary', (name, value) => {
    expect(theme).toContain(`--soco-reaction-${name}: ${value};`)
    expect(tailwind).toContain(`--color-reaction-${name}: var(--soco-reaction-${name});`)
  })

  it('preserves the subtle border value and mapping', () => {
    expect(theme).toContain('--soco-border-subtle: #e8ecf5;')
    expect(tailwind).toContain('--color-border-subtle: var(--soco-border-subtle);')
  })

  it.each([
    ['sm', '36px'],
    ['md', '40px'],
    ['touch', '44px'],
  ])('maps control-%s to its existing pixel size', (name, value) => {
    expect(theme).toContain(`--soco-control-${name}: ${value};`)
    expect(tailwind).toContain(`--spacing-control-${name}: var(--soco-control-${name});`)
  })

  it('uses named control sizes on shared Button and Input', () => {
    expect(renderToStaticMarkup(<Button>Default</Button>)).toContain('h-control-md')
    expect(renderToStaticMarkup(<Button size="sm">Small</Button>)).toContain('h-control-sm')
    expect(renderToStaticMarkup(<Button size="lg">Large</Button>)).toContain('h-control-touch')
    expect(renderToStaticMarkup(<Button size="icon">Icon</Button>)).toContain('size-control-md')
    expect(renderToStaticMarkup(<Input aria-label="Search" />)).toContain('h-control-md')
  })
})