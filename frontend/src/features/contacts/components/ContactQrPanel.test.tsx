// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ContactQrPanel from './ContactQrPanel'

const generateQr = vi.hoisted(() => vi.fn())
vi.mock('qrcode', () => ({ default: { toDataURL: generateQr } }))

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  generateQr.mockReset()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

async function renderQr(url: string) {
  await act(async () => root.render(<ContactQrPanel connectionUrl={url} onScanQr={vi.fn()} />))
}

describe('ContactQrPanel', () => {
  it('never shows QR from a previous account while the new QR is pending', async () => {
    let completeNewQr: (image: string) => void = () => {}
    generateQr
      .mockResolvedValueOnce('data:image/png;base64,old')
      .mockImplementationOnce(() => new Promise<string>(resolve => { completeNewQr = resolve }))
    await renderQr('https://example.com/user-a')
    expect(host.querySelector('img')?.getAttribute('src')).toContain('old')
    await renderQr('https://example.com/user-b')
    expect(host.querySelector('img')).toBeNull()
    expect(host.textContent).toContain('Đang tạo mã QR')
    await act(async () => completeNewQr('data:image/png;base64,new'))
    expect(host.querySelector('img')?.getAttribute('src')).toContain('new')
    expect(generateQr).toHaveBeenLastCalledWith('https://example.com/user-b', expect.any(Object))
  })

  it('offers retry after QR generation fails', async () => {
    generateQr.mockRejectedValueOnce(new Error('render failed')).mockResolvedValueOnce('data:image/png;base64,recovered')
    await renderQr('https://example.com/user-a')
    expect(host.getAttribute('aria-busy')).toBeNull()
    expect(host.textContent).toContain('Không thể tạo mã QR')
    const retry = [...host.querySelectorAll('button')].find(button => button.textContent === 'Thử lại')
    expect(retry).toBeDefined()
    await act(async () => retry?.click())
    expect(host.querySelector('img')?.getAttribute('src')).toContain('recovered')
  })

  it('ignores late QR generation from an account that is no longer active', async () => {
    let finishOld: (image: string) => void = () => {}
    generateQr
      .mockImplementationOnce(() => new Promise<string>(resolve => { finishOld = resolve }))
      .mockResolvedValueOnce('data:image/png;base64,current')
    await renderQr('https://example.com/old-user')
    await renderQr('https://example.com/current-user')
    expect(host.querySelector('img')?.getAttribute('src')).toContain('current')
    await act(async () => finishOld('data:image/png;base64,stale'))
    expect(host.querySelector('img')?.getAttribute('src')).toContain('current')
  })

  it('prevents duplicate clipboard requests and shows scoped success feedback', async () => {
    const writeText = vi.fn<(_url: string) => Promise<void>>()
    let finishCopy: () => void = () => {}
    writeText.mockImplementation(() => new Promise<void>(resolve => { finishCopy = resolve }))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      generateQr.mockResolvedValue('data:image/png;base64,qr')
      await renderQr('https://example.com/user-a')
      const copyButton = () => host.querySelector<HTMLButtonElement>('.fd-qr-actions button')!
      await act(async () => copyButton().click())
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith('https://example.com/user-a')
      expect(copyButton().disabled).toBe(true)
      expect(copyButton().textContent).toContain('Đang sao chép')
      await renderQr('https://example.com/user-b')
      expect(copyButton().disabled).toBe(false)
      await act(async () => finishCopy())
      expect(host.textContent).not.toContain('Đã sao chép liên kết')
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('reports clipboard denial and re-enables copying', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      generateQr.mockResolvedValue('data:image/png;base64,qr')
      await renderQr('https://example.com/user-a')
      await act(async () => host.querySelector<HTMLButtonElement>('.fd-qr-actions button')?.click())
      expect(host.textContent).toContain('Không thể sao chép')
      expect(host.querySelector<HTMLButtonElement>('.fd-qr-actions button')?.disabled).toBe(false)
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('does not offer copying a missing link', async () => {
    await renderQr('')
    expect(host.textContent).toContain('Chưa có liên kết kết bạn')
    expect(host.querySelector<HTMLButtonElement>('.fd-qr-actions button')?.disabled).toBe(true)
    expect(generateQr).not.toHaveBeenCalled()
  })
})
