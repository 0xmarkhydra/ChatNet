// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StoryComposer from './StoryComposer'

const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
})

describe('Story media preview and publishing', () => {
  it('keeps the selected file and reports a failed publish', async () => {
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:story-preview')
    URL.revokeObjectURL = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const file = new File(['media'], 'photo.jpg', { type: 'image/jpeg' })
    const onPublish = vi.fn(async () => false)
    const onBack = vi.fn()

    try {
      await act(async () => root.render(
        <StoryComposer file={file} busy={false} onPublish={onPublish}
          onBack={onBack} onChangeFile={() => {}} />,
      ))
      expect(host.textContent).toContain('photo.jpg')
      expect(host.querySelector('img')?.getAttribute('src')).toBe('blob:story-preview')
      await act(async () => { host.querySelector<HTMLButtonElement>('.smart-story-publish')?.click() })
      expect(onPublish).toHaveBeenCalledTimes(1)
      expect(host.querySelector('[role="alert"]')?.textContent).toContain('Tệp đã chọn vẫn được giữ lại')
      expect(host.textContent).toContain('photo.jpg')
      await act(async () => { host.querySelector<HTMLButtonElement>('.smart-story-change')?.click() })
      expect(onBack).toHaveBeenCalledTimes(1)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  })

  it('revokes each preview URL when the file changes and on unmount', async () => {
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    let created = 0
    const create = vi.fn(() => `blob:preview-${++created}`)
    const revoke = vi.fn()
    URL.createObjectURL = create
    URL.revokeObjectURL = revoke
    const host = document.createElement('div')
    const root = createRoot(host)
    const photo = new File(['a'], 'photo.jpg', { type: 'image/jpeg' })
    const render = (file: File, busy = false) => act(async () => root.render(
      <StoryComposer file={file} busy={busy} onPublish={async () => true}
        onBack={() => {}} onChangeFile={() => {}} />,
    ))

    try {
      await render(photo)
      await render(photo, true)
      expect(create).toHaveBeenCalledTimes(1)
      expect(revoke).not.toHaveBeenCalled()

      await render(new File(['b'], 'clip.mp4', { type: 'video/mp4' }))
      expect(revoke.mock.calls).toEqual([['blob:preview-1']])
      expect(host.querySelector('img')).toBeNull()
      expect(host.querySelector('video')?.getAttribute('src')).toBe('blob:preview-2')

      await render(new File(['c'], 'next.mp4', { type: 'video/mp4' }))
      expect(revoke.mock.calls).toEqual([['blob:preview-1'], ['blob:preview-2']])
      expect(host.querySelector('video')?.getAttribute('src')).toBe('blob:preview-3')

      await act(async () => root.unmount())
      expect(revoke.mock.calls).toEqual([['blob:preview-1'], ['blob:preview-2'], ['blob:preview-3']])
      expect(create).toHaveBeenCalledTimes(3)
    } finally {
      await act(async () => root.unmount())
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  })
})
