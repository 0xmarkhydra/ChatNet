// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GroupChannelCreateForm from './GroupChannelCreateForm'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const unmounts: Array<() => void> = []
afterEach(() => {
  while (unmounts.length) unmounts.pop()!()
  vi.restoreAllMocks()
})

function mount(onCreate: (name: string, description: string) => Promise<boolean>) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onCancel = vi.fn()
  act(() => root.render(<GroupChannelCreateForm busy={false} onCreate={onCreate} onCancel={onCancel} />))
  unmounts.push(() => { act(() => root.unmount()); host.remove() })
  const name = host.querySelector('input[aria-label="Tên kênh mới"]') as HTMLInputElement
  const description = host.querySelector('textarea') as HTMLTextAreaElement
  const setValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    act(() => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  const submit = () => act(() => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  return { host, name, description, setValue, submit, onCancel }
}

describe('GroupChannelCreateForm submit lifecycle', () => {
  it('prevents concurrent duplicate creates even while parent busy is false', async () => {
    let resolve!: (result: boolean) => void
    const inFlight = new Promise<boolean>(r => { resolve = r })
    const onCreate = vi.fn(async () => inFlight)
    const page = mount(onCreate)
    page.setValue(page.name, '  Thông báo  ')
    page.setValue(page.description, '  Mô tả  ')
    page.submit()
    page.submit()
    expect(onCreate).toHaveBeenCalledOnce()
    expect(onCreate).toHaveBeenCalledWith('Thông báo', 'Mô tả')
    await act(async () => { resolve(true); await inFlight })
    expect(page.onCancel).toHaveBeenCalledOnce()
  })

  it('allows a new submit after the previous attempt reports failure', async () => {
    const onCreate = vi.fn(async () => false)
    const page = mount(onCreate)
    page.setValue(page.name, 'Kênh mới')
    page.submit()
    await act(async () => { await Promise.resolve() })
    expect(page.onCancel).not.toHaveBeenCalled()
    page.submit()
    expect(onCreate).toHaveBeenCalledTimes(2)
  })

  it('does not create a channel from whitespace-only input', () => {
    const onCreate = vi.fn(async () => true)
    const page = mount(onCreate)
    page.setValue(page.name, '   ')
    page.submit()
    expect(onCreate).not.toHaveBeenCalled()
  })
})
