// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GroupAvatarEditor, { photoFileError } from './GroupAvatarEditor'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const cleanup: Array<() => void> = []
afterEach(() => {
  while (cleanup.length) cleanup.pop()!()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mount(avatarUrl?: string) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onSave = vi.fn(async () => true)
  const onClose = vi.fn()
  const target = { name: 'Nhóm thử', kind: 'group' as const, avatarUrl }
  act(() => root.render(<GroupAvatarEditor target={target} busy={false} onSave={onSave} onClose={onClose} />))
  cleanup.push(() => { act(() => root.unmount()); host.remove() })
  function button(label: string) {
    const found = [...document.body.querySelectorAll('button')].find(node => (node.getAttribute('aria-label') ?? node.textContent?.trim())?.includes(label))
    if (!found) throw new Error('Missing button ' + label)
    return found
  }
  return { target, onSave, onClose, button }
}

describe('GroupAvatarEditor photo controller', () => {
  it('rejects non-image input and oversized photos before save', () => {
    expect(photoFileError(new File(['payload'], 'report.txt', { type: 'text/plain' }))).toContain('Vui lòng chọn ảnh')
    const oversized = new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'photo.png', { type: 'image/png' })
    expect(photoFileError(oversized)).toContain('vượt quá giới hạn')
    const page = mount()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['data'], 'report.txt', { type: 'text/plain' })] })
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })))
    expect(document.body.textContent).toContain('Vui lòng chọn ảnh')
    expect(page.button('Lưu ảnh').hasAttribute('disabled')).toBe(true)
  })

  it('revokes selected preview URLs and retains the original save callback', async () => {
    const createObjectURL = vi.fn(() => 'blob:preview-one')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const page = mount('https://example.test/original-avatar.png')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['ok'], 'picture.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })))
    expect(document.querySelector('.group-photo-preview img')?.getAttribute('src')).toBe('blob:preview-one')
    await act(async () => { page.button('Lưu ảnh').click(); await Promise.resolve() })
    expect(page.onSave).toHaveBeenCalledWith(page.target, file)
    expect(page.onClose).toHaveBeenCalledOnce()
    act(() => page.button('Hoàn tác').click())
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-one')
    act(() => page.button('Hủy đổi ảnh').click())
    expect(page.onClose).toHaveBeenCalledTimes(2)
  })

  it('allows removing an existing avatar and undoing the removal', async () => {
    const page = mount('https://example.test/old-avatar.png')
    act(() => page.button('Gỡ ảnh').click())
    expect(document.body.textContent).toContain('Ảnh sẽ được gỡ')
    act(() => page.button('Hoàn tác').click())
    expect(document.body.textContent).not.toContain('Ảnh sẽ được gỡ')
    act(() => page.button('Gỡ ảnh').click())
    await act(async () => { page.button('Lưu ảnh').click(); await Promise.resolve() })
    expect(page.onSave).toHaveBeenCalledWith(page.target, null)
  })
})
