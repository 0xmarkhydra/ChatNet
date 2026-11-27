// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { downloadOriginalImage } from './ImageDownloadButton'
import type { MediaAttachment } from '../utils/media'

const image: MediaAttachment = { kind: 'image', name: 'photo.jpg', url: 'https://media.example/image?sig=example', contentType: 'image/jpeg', storageRef: 'photo', sizeBytes: 3 }

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('downloads the unmodified image bytes with the original name', async () => {
  vi.useFakeTimers()
  const blob = new Blob(['abc'], { type: 'image/jpeg' })
  const fetchImage = vi.fn(async () => ({ ok: true, blob: async () => blob }))
  const createObjectURL = vi.fn(() => 'blob:original')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('fetch', fetchImage)
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('photo.jpg')
    expect(this.href).toBe('blob:original')
  })
  await downloadOriginalImage(image)
  expect(fetchImage).toHaveBeenCalledWith(image.url, { credentials: 'omit', cache: 'no-store' })
  expect(createObjectURL).toHaveBeenCalledWith(blob)
  expect(click).toHaveBeenCalledOnce()
  vi.runOnlyPendingTimers()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:original')
})

it('does not initiate a download when access has been revoked', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
  await expect(downloadOriginalImage(image)).rejects.toThrow('không còn quyền truy cập')
  expect(click).not.toHaveBeenCalled()
})
