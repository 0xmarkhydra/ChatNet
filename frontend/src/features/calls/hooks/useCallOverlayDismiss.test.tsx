// @vitest-environment jsdom
import { act, useRef, type Dispatch, type SetStateAction } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { useCallOverlayDismiss } from './useCallOverlayDismiss'

describe('call overlay event lifecycle', () => {
  it('uses updated callbacks without leaving old Escape listeners attached', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const closeOld = vi.fn()
    const closeNew = vi.fn()
    const closeSheet = vi.fn()

    function Probe({ close }: { close: Dispatch<SetStateAction<boolean>> }) {
      const menuRef = useRef<HTMLDivElement>(null)
      useCallOverlayDismiss(true, false, menuRef, close, closeSheet)
      return <div ref={menuRef}>Menu</div>
    }

    try {
      await act(async () => root.render(<Probe close={closeOld} />))
      await act(async () => root.render(<Probe close={closeNew} />))
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })
      expect(closeOld).not.toHaveBeenCalled()
      expect(closeNew).toHaveBeenCalledExactlyOnceWith(false)
      expect(closeSheet).not.toHaveBeenCalled()

      await act(async () => root.unmount())
      await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
      expect(closeNew).toHaveBeenCalledTimes(1)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })

  it('does not close an open menu for pointer events inside its ref', async () => {
    const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const close = vi.fn()
    const closeSheet = vi.fn()

    function Probe() {
      const menuRef = useRef<HTMLDivElement>(null)
      useCallOverlayDismiss(true, false, menuRef, close, closeSheet)
      return <div ref={menuRef}><button id="call-more-inside">Inside</button></div>
    }

    try {
      await act(async () => root.render(<Probe />))
      await act(async () => document.getElementById('call-more-inside')?.dispatchEvent(new Event('pointerdown', { bubbles: true })))
      expect(close).not.toHaveBeenCalled()
      await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))
      expect(close).toHaveBeenCalledExactlyOnceWith(false)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})
