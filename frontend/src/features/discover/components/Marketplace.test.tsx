// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Marketplace from './Marketplace'

vi.mock('../../../shared/ui/useSlidingPill', () => ({
  default: () => ({ hostRef: { current: null }, activeRef: { current: null }, pillRef: { current: null } }),
}))

let root: Root
let host: HTMLDivElement
const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT

function response(path: string, products: { id: number; sellerId: number; title: string; description: string; priceAmount: number; priceUnit: string; stock: number; status: 'published' }[] = []) {
  return Response.json(path.endsWith('/cart') ? { items: [] } : path.endsWith('/orders') ? { orders: [] } : { products })
}

const product = { id: 42, sellerId: 2, title: 'Bàn học', description: '', priceAmount: 1000, priceUnit: 'VND', stock: 1, status: 'published' as const }

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
  vi.restoreAllMocks()
})

describe('Marketplace read fallback', () => {
  it('shows loading, then an error instead of false empty states, and recovers on retry', async () => {
    let releaseFirstRequest: (() => void) | undefined
    const pending = new Promise<void>((resolve) => { releaseFirstRequest = resolve })
    const request = vi.fn(async (path: string) => {
      if (request.mock.calls.length <= 4) {
        await pending
        throw new TypeError('Failed to fetch')
      }
      return response(path, path.endsWith('/products') ? [product] : [])
    })
    await act(async () => {
      root.render(<Marketplace userId={1} request={request} onBack={() => {}} />)
    })
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Đang tải dữ liệu chợ')
    expect(host.textContent).not.toContain('Chưa có sản phẩm được đăng')
    await act(async () => releaseFirstRequest?.())
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Failed to fetch')
    expect(host.textContent).not.toContain('Chưa có sản phẩm được đăng')
    const retry = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Thử tải dữ liệu')
    expect(retry).toBeTruthy()
    await act(async () => retry?.click())
    expect(host.textContent).toContain('Bàn học')
    expect(host.querySelector('[role="alert"]')).toBeNull()
  })

  it('preserves the loaded catalog when a cart mutation fails without retrying the write', async () => {
    const request = vi.fn((path: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return Promise.reject(new TypeError('Mất kết nối'))
      return Promise.resolve(response(path, path.endsWith('/products') ? [product] : []))
    })
    await act(async () => {
      root.render(<Marketplace userId={1} request={request} onBack={() => {}} />)
    })
    expect(host.textContent).toContain('Bàn học')
    const add = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Thêm vào giỏ')
    expect(add).toBeTruthy()
    await act(async () => add?.click())
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Mất kết nối')
    expect(host.textContent).toContain('Bàn học')
    expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1)
  })

  it('does not send duplicate cart mutations from rapid repeated clicks', async () => {
    let finishWrite: (() => void) | undefined
    const pendingWrite = new Promise<void>((resolve) => { finishWrite = resolve })
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        await pendingWrite
        return Response.json({})
      }
      return response(path, path.endsWith('/products') ? [product] : [])
    })
    await act(async () => root.render(<Marketplace userId={1} request={request} onBack={() => {}} />))
    const add = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Thêm vào giỏ')
    expect(add).toBeTruthy()
    await act(async () => {
      add?.click()
      add?.click()
    })
    expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1)
    await act(async () => finishWrite?.())
    expect(host.textContent).toContain('Bàn học')
  })

  it('ignores a stale failed retry after a newer successful refresh', async () => {
    let rejectOld: ((reason: Error) => void) | undefined
    const older = new Promise<Response>((_, reject) => { rejectOld = reject })
    let reads = 0
    let writes = 0
    const request = vi.fn((path: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        writes += 1
        return writes === 1
          ? Promise.reject(new Error('Không cập nhật được giỏ'))
          : Promise.resolve(Response.json({}))
      }
      reads += 1
      if (reads > 4 && reads <= 8) return older
      return Promise.resolve(response(path, path.endsWith('/products') ? [product] : []))
    })
    const button = (label: string) => Array.from(host.querySelectorAll('button'))
      .find((item) => item.textContent === label)

    await act(async () => root.render(<Marketplace userId={1} request={request} onBack={() => {}} />))
    await act(async () => button('Thêm vào giỏ')?.click())
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không cập nhật được giỏ')
    await act(async () => button('Thử tải dữ liệu')?.click())
    await act(async () => button('Thêm vào giỏ')?.click())
    expect(writes).toBe(2)
    expect(host.querySelector('[role="alert"]')).toBeNull()
    await act(async () => rejectOld?.(new Error('Lỗi phản hồi cũ')))
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(host.textContent).toContain('Bàn học')
  })

  it('coalesces rapid read-retry clicks into one group of requests', async () => {
    let completeRetry: (() => void) | undefined
    const pending = new Promise<void>((resolve) => { completeRetry = resolve })
    const request = vi.fn(async (path: string) => {
      if (request.mock.calls.length <= 4) throw new Error('Không tải được dữ liệu')
      await pending
      return response(path, path.endsWith('/products') ? [product] : [])
    })
    await act(async () => root.render(<Marketplace userId={1} request={request} onBack={() => {}} />))
    const retry = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Thử tải dữ liệu')
    expect(retry).toBeTruthy()
    await act(async () => {
      retry?.click()
      retry?.click()
    })
    expect(request).toHaveBeenCalledTimes(8)
    await act(async () => completeRetry?.())
    expect(host.textContent).toContain('Bàn học')
    expect(host.querySelector('[role="alert"]')).toBeNull()
  })

  it('resets account-specific marketplace view when switching users', async () => {
    const request = vi.fn(async (path: string) => response(path))
    const selectTab = (text: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('nav button'))
      .find((button) => button.textContent?.includes(text))
    await act(async () => root.render(<Marketplace userId={1} request={request} onBack={() => {}} />))
    await act(async () => selectTab('Bán hàng')?.click())
    expect(host.querySelector('form')).not.toBeNull()
    await act(async () => root.render(<Marketplace userId={2} request={request} onBack={() => {}} />))
    expect(host.querySelector('form')).toBeNull()
    expect(host.textContent).toContain('Chưa có sản phẩm được đăng')
  })

  it('clears a previous account draft when the active user changes', async () => {
    const request = vi.fn(async (path: string) => response(path))
    const sell = () => Array.from(host.querySelectorAll<HTMLButtonElement>('nav button'))
      .find((button) => button.textContent?.includes('Bán hàng'))
    await act(async () => root.render(<Marketplace userId={1} request={request} onBack={() => {}} />))
    await act(async () => sell()?.click())
    const title = host.querySelector('form input') as HTMLInputElement
    expect(title).not.toBeNull()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(title, 'Bản nháp riêng tài khoản 1')
      title.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(title.value).toBe('Bản nháp riêng tài khoản 1')
    await act(async () => root.render(<Marketplace userId={2} request={request} onBack={() => {}} />))
    await act(async () => sell()?.click())
    expect((host.querySelector('form input') as HTMLInputElement).value).toBe('')
  })

  it('ignores the previous user response after switching users', async () => {
    let resolveOld: ((value: Response) => void) | undefined
    const old = new Promise<Response>((resolve) => { resolveOld = resolve })
    const request = vi.fn((path: string) => {
      if (request.mock.calls.length <= 4) return old
      return Promise.resolve(response(path))
    })
    await act(async () => {
      root.render(<Marketplace userId={1} request={request} onBack={() => {}} />)
    })
    await act(async () => {
      root.render(<Marketplace userId={2} request={request} onBack={() => {}} />)
    })
    expect(host.textContent).toContain('Chưa có sản phẩm được đăng')
    await act(async () => resolveOld?.(Response.json({ products: [product], items: [], orders: [] })))
    expect(host.textContent).not.toContain('Bàn học')
    expect(host.textContent).toContain('Chưa có sản phẩm được đăng')
  })
})
