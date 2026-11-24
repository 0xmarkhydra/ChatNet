// @vitest-environment jsdom
import { useState } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SearchField } from './search-field'

let root: Root
let host: HTMLDivElement

function Harness({ size }: { size?: 'default' | 'sm' }) {
  const [value, setValue] = useState('')
  return <SearchField aria-label="Tìm thử" placeholder="Tìm…" size={size} value={value} onValueChange={setValue} className="max-w-xs" />
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('SearchField', () => {
  it('shows the clear button only with text, and clearing empties the input', async () => {
    await act(async () => root.render(<Harness />))
    const input = host.querySelector('input') as HTMLInputElement
    expect(host.querySelector('button')).toBeNull()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(input, 'ghế')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(input.value).toBe('ghế')
    const clear = host.querySelector('button[aria-label="Xóa từ khóa"]') as HTMLButtonElement
    expect(clear).not.toBeNull()
    await act(async () => clear.click())
    expect(input.value).toBe('')
    expect(host.querySelector('button')).toBeNull()
  })

  it('applies the caller width class and the size token to the wrapper', async () => {
    await act(async () => root.render(<Harness size="sm" />))
    const field = host.querySelector('[data-slot="search-field"]') as HTMLElement
    expect(field.className).toContain('max-w-xs')
    expect(field.className).toContain('h-control-md')
    expect(host.querySelector('input')?.getAttribute('aria-label')).toBe('Tìm thử')
  })
})
