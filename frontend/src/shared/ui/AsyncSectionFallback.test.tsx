// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { AsyncSectionFallback } from './AsyncSectionFallback'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

it('announces loading without exposing recovery controls before loading finishes', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const retry = vi.fn()
  await act(async () => {
    root.render(<AsyncSectionFallback title="bảng tin" loading onRetry={retry} />)
  })

  const status = host.querySelector('[role="status"]')
  expect(status?.getAttribute('aria-busy')).toBe('true')
  expect(status?.textContent).toContain('Đang tải bảng tin')
  expect(host.querySelector('button')).toBeNull()
  const skeleton = status?.querySelector('[data-slot="loading-skeleton"]')
  expect(skeleton?.getAttribute('aria-hidden')).toBe('true')
  expect(skeleton?.querySelectorAll('.motion-reduce\\:animate-none')).toHaveLength(3)
  await act(async () => root.unmount())
})

it('renders accessible recovery controls with mobile-friendly targets', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const retry = vi.fn()
  const reload = vi.fn()
  await act(async () => {
    root.render(<AsyncSectionFallback title="thông báo" onRetry={retry} onReload={reload} />)
  })

  const alert = host.querySelector('[role="alert"]')
  expect(alert?.getAttribute('aria-busy')).toBe('false')
  expect(alert?.textContent).toContain('Không thể hiển thị thông báo')
  expect(host.querySelector('[data-slot="loading-skeleton"]')).toBeNull()
  const controls = Array.from(host.querySelectorAll('button'))
  expect(controls.map(button => button.textContent)).toEqual(['Thử lại', 'Tải lại trang'])
  for (const button of controls) {
    expect(button.classList.contains('min-h-11')).toBe(true)
    expect(button.dataset.slot).toBe('button')
    expect(button.classList.contains('focus-visible:ring-ring')).toBe(true)
    expect(button.type).toBe('button')
  }

  await act(async () => {
    controls[0].click()
    controls[1].click()
  })
  expect(retry).toHaveBeenCalledTimes(1)
  expect(reload).toHaveBeenCalledTimes(1)
  await act(async () => root.unmount())
})
