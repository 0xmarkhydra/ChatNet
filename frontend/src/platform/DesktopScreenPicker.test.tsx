// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DesktopScreenPicker from './DesktopScreenPicker'
import type { DesktopScreenRequest } from './desktop'

const mock = vi.hoisted(() => ({
  onPicker: vi.fn(),
  select: vi.fn(async (_requestId: string, _index: number | null) => true),
}))

vi.mock('./desktop', () => ({
  desktopBridge: () => ({ screen: { onPicker: mock.onPicker, select: mock.select } }),
}))

afterEach(() => {
  mock.onPicker.mockReset()
  mock.select.mockReset()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  document.body.replaceChildren()
})

describe('DesktopScreenPicker lifecycle', () => {
  it('closes the native pending capture request when the picker unmounts', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const showModal = vi.fn()
    const close = vi.fn()
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: close })

    let emit!: (request: DesktopScreenRequest | null) => void
    const unsubscribe = vi.fn()
    mock.onPicker.mockImplementation((listener: typeof emit) => {
      emit = listener
      return unsubscribe
    })

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<DesktopScreenPicker />))
    await act(async () => emit({
      requestId: 'capture-1',
      sources: [{ index: 0, name: 'Window', thumbnail: 'data:image/png;base64,aA==' }],
    }))
    expect(showModal).toHaveBeenCalledOnce()

    await act(async () => root.unmount())
    expect(close).toHaveBeenCalledOnce()
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(mock.select).toHaveBeenCalledWith('capture-1', null)
    vi.restoreAllMocks()
  })
})
