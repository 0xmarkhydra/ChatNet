// @vitest-environment jsdom
import { act, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MediaAttachment } from '@/shared/utils/media'
import type { Post } from '../../feed'
import ProfileAvatarPicker from './ProfileAvatarPicker'

const owner = 'demo_alpha'
const photo = (name: string, changes: Partial<MediaAttachment> = {}): MediaAttachment => ({
  kind: 'image', name, storageRef: name, contentType: 'image/png', sizeBytes: 100,
  url: 'https://storage.example.test/' + name, ...changes,
})
const post = (attachments: MediaAttachment[], author = owner): Post => ({
  id: 1, author, content: '', likes: 0, liked: false, comments: [], createdAt: '', attachments,
})
const button = (label: string) => [...document.querySelectorAll('button')]
  .find(control => control.getAttribute('aria-label') === label || control.textContent?.trim() === label)
const click = (label: string) => act(async () => {
  const control = button(label)
  expect(control).toBeDefined()
  control?.click()
})

async function mount(posts: Post[], avatarUrl?: string) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const onSave = vi.fn<(file: File | null) => Promise<boolean>>().mockResolvedValue(true)

  function Example() {
    const [opener, setOpener] = useState<HTMLButtonElement | null>(null)
    const input = useRef<HTMLInputElement>(null)
    return <>
      <button type="button" onClick={event => setOpener(event.currentTarget)}>Mở trình chọn</button>
      {opener && <ProfileAvatarPicker username={owner} avatarUrl={avatarUrl} posts={posts} busy={false}
        opener={opener} inputRef={input} onSave={onSave} onClose={() => setOpener(null)} />}
    </>
  }

  await act(async () => root.render(<Example />))
  await click('Mở trình chọn')
  return { onSave, unmount: async () => { await act(async () => root.unmount()); host.remove() } }
}

afterEach(() => vi.unstubAllGlobals())

describe('profile avatar picker', () => {
  it('hides empty photo groups and leaves device upload available', async () => {
    const { unmount } = await mount([post([
      photo('clip.mp4', { kind: 'video' }),
      photo('no-url.png', { url: undefined }),
      photo('large.png', { sizeBytes: 13 * 1024 * 1024 }),
    ]), post([photo('other.png')], 'someone_else')])
    try {
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Đổi ảnh đại diện')
      expect(document.getElementById('profile-avatar-photos')).toBeNull()
      expect(button('Gỡ ảnh')).toBeUndefined()
      expect(button('Xem thêm')).toBeUndefined()
      expect(button('Tải ảnh lên')?.disabled).toBe(false)
      expect(button('Lưu ảnh')?.disabled).toBe(true)
      await click('Đóng hộp thoại')
      await vi.waitFor(() => expect(document.activeElement).toBe(button('Mở trình chọn')))
    } finally {
      await unmount()
    }
  })

  it('expands real photos, previews a selection, and uploads a copy only after saving', async () => {
    const photos = Array.from({ length: 7 }, (_, i) => photo('anh-' + i + '.png'))
    const fetchPhoto = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['png'], { type: 'image/png' }),
    })
    vi.stubGlobal('fetch', fetchPhoto)
    const { onSave, unmount } = await mount([post([...photos, photos[0]])])
    try {
      expect(button('Chọn anh-6.png')).toBeUndefined()
      await click('Xem thêm')
      expect(button('Xem thêm')).toBeUndefined()
      await click('Chọn anh-6.png')
      expect(button('Chọn anh-6.png')?.getAttribute('aria-pressed')).toBe('true')
      expect(document.querySelector('img[alt="Ảnh đại diện xem trước"]')?.getAttribute('src')).toBe(photos[6].url)
      expect(fetchPhoto).not.toHaveBeenCalled()
      expect(onSave).not.toHaveBeenCalled()
      await click('Lưu ảnh')
      expect(fetchPhoto).toHaveBeenCalledWith(photos[6].url, expect.objectContaining({ credentials: 'omit' }))
      expect(onSave.mock.calls[0]?.[0]).toMatchObject({ name: 'anh-6.png', type: 'image/png' })
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    } finally {
      await unmount()
    }
  })

  it('keeps an unavailable image selection open and never mutates the profile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { onSave, unmount } = await mount([post([photo('anh.png')])])
    try {
      await click('Chọn anh.png')
      await click('Lưu ảnh')
      expect(onSave).not.toHaveBeenCalled()
      expect(document.querySelector('[role="alert"]')?.textContent).toContain('Không tải được ảnh này')
      expect(button('Lưu ảnh')?.disabled).toBe(false)
    } finally {
      await unmount()
    }
  })

  it('validates device files and lets a removal be undone before save', async () => {
    const { onSave, unmount } = await mount([], 'https://storage.example.test/current.png')
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    try {
      expect(input).not.toBeNull()
      await act(async () => {
        Object.defineProperty(input, 'files', { value: [new File(['x'], 'data.txt', { type: 'text/plain' })] })
        input?.dispatchEvent(new Event('change', { bubbles: true }))
      })
      expect(document.querySelector('[role="alert"]')?.textContent).toContain('Vui lòng chọn ảnh')
      await click('Gỡ ảnh')
      expect(document.querySelector('img[alt="Ảnh đại diện xem trước"]')).toBeNull()
      await click('Hoàn tác lựa chọn')
      expect(document.querySelector('img[alt="Ảnh đại diện xem trước"]')).not.toBeNull()
      expect(onSave).not.toHaveBeenCalled()
    } finally {
      await unmount()
    }
  })
})
