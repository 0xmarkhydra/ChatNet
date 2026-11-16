// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import MediaViewer from './MediaViewer'

const mounted: Array<() => void> = []

afterEach(() => {
  for (const cleanup of mounted.splice(0)) cleanup()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

it('keeps keyboard focus inside the media dialog and restores it on close', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  mounted.push(() => { act(() => root.unmount()); host.remove() })
  const onClose = vi.fn()
  await act(async () => {
    root.render(<MediaViewer
      items={[{ storageRef: 'test', name: 'Ảnh thử', sizeBytes: 10, contentType: 'image/png', kind: 'image', url: '/test.png' }]}
      activeIndex={0}
      onChange={vi.fn()}
      onClose={onClose}
    />)
  })
  const dialog = document.querySelector('[role="dialog"]') as HTMLElement
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button'))
  expect(document.activeElement).toBe(controls[1])

  controls[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(controls[0])
  controls[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(controls[1])

  await act(async () => root.unmount())
  mounted.pop()
  expect(document.activeElement).toBe(opener)
})

it('preserves video keyboard shortcuts while keeping video focus inside the modal', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  mounted.push(() => { act(() => root.unmount()); host.remove() })
  const onChange = vi.fn()
  await act(async () => {
    root.render(<MediaViewer
      items={[
        { storageRef: 'first', name: 'First.mp4', sizeBytes: 10, contentType: 'video/mp4', kind: 'video', url: '/first.mp4' },
        { storageRef: 'second', name: 'Second.mp4', sizeBytes: 10, contentType: 'video/mp4', kind: 'video', url: '/second.mp4' },
      ]}
      activeIndex={1}
      onChange={onChange}
      onClose={vi.fn()}
    />)
  })
  const dialog = document.querySelector('[role="dialog"]') as HTMLElement
  const player = dialog.querySelector('video') as HTMLVideoElement
  const original = dialog.querySelector('a') as HTMLAnchorElement
  player.tabIndex = 0 // jsdom does not expose native media-control tab stops
  player.focus()
  expect(player.getAttribute('aria-label')).toBe('Video: Second.mp4')
  const arrow = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
  player.dispatchEvent(arrow)
  expect(arrow.defaultPrevented).toBe(false)
  expect(onChange).not.toHaveBeenCalled()

  player.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(original)
  original.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))
  expect(onChange).toHaveBeenCalledWith(0)

  await act(async () => root.unmount())
  mounted.pop()
})
