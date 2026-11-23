// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import PostComposerLauncher from './PostComposerLauncher'

vi.mock('./UserAvatar', () => ({
  default: ({ username }: { username: string }) => <span data-avatar={username} />,
}))

describe('shared Tailwind post launcher', () => {
  it('opens the composer, Story and Check-in through their respective callbacks', async () => {
    const global = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const prior = global.IS_REACT_ACT_ENVIRONMENT
    global.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const onCreatePost = vi.fn()
    const onCreateStory = vi.fn()
    const onCheckIn = vi.fn()
    const onCreateMediaPost = vi.fn()

    try {
      await act(async () => root.render(<PostComposerLauncher
        username="trung" displayName="Trung" prompt="Bạn đang nghĩ gì?"
        onCreatePost={onCreatePost}
        onCreateMediaPost={onCreateMediaPost}
        onCreateStory={onCreateStory}
        onCheckIn={onCheckIn}
      />))
      const launcher = container.querySelector<HTMLElement>('[aria-label="Tạo nội dung mới"]')
      expect(launcher?.className).toContain('rounded-2xl')
      expect(launcher?.className).not.toContain('social-feed-launcher')
      expect(launcher?.className).not.toContain('profile-page-composer')
      const getButton = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button:not([aria-label])')?.click()
        getButton('Story')?.click()
        getButton('Check-in')?.click()
      })
      expect(onCreatePost).toHaveBeenCalledOnce()
      expect(onCreateStory).toHaveBeenCalledOnce()
      expect(onCheckIn).toHaveBeenCalledOnce()

      const input = container.querySelector<HTMLInputElement>('input[type="file"]')
      expect(input).not.toBeNull()
      const file = new File(['png'], 'photo.png', { type: 'image/png' })
      await act(async () => {
        Object.defineProperty(input!, 'files', { configurable: true, value: [file] })
        input!.dispatchEvent(new Event('change', { bubbles: true }))
      })
      expect(onCreateMediaPost).toHaveBeenCalledWith([file])
    } finally {
      await act(async () => root.unmount())
      container.remove()
      global.IS_REACT_ACT_ENVIRONMENT = prior
    }
  })

  it('disables editing shortcuts while publishing or uploading', async () => {
    const global = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const prior = global.IS_REACT_ACT_ENVIRONMENT
    global.IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    const root = createRoot(container)
    try {
      await act(async () => root.render(<PostComposerLauncher
        username="trung" displayName="Trung" prompt="Bạn đang nghĩ gì?" pending storyBusy
        onCreatePost={() => {}} onCreateMediaPost={() => {}}
        onCreateStory={() => {}} onCheckIn={() => {}}
      />))
      expect(Array.from(container.querySelectorAll('button')).every(button => button.disabled)).toBe(true)
    } finally {
      await act(async () => root.unmount())
      global.IS_REACT_ACT_ENVIRONMENT = prior
    }
  })
})
