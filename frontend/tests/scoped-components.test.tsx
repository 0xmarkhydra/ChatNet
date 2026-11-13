// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import GroupChannelPicker from '../src/features/chat/components/GroupChannelPicker'
import UserAvatar from '../src/shared/ui/UserAvatar'

describe('scoped component resets', () => {
  it('closes channel creation form immediately when switching A → B → A', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const prior = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const render = async (conversationId: number) => {
      await act(async () => root.render(
        <GroupChannelPicker conversationId={conversationId} selectedId={1} channels={[]}
          busy={false} canCreate onSelect={() => {}} onCreate={async () => true} />,
      ))
    }
    try {
      await render(1)
      await act(async () => (host.querySelector('button[aria-label^="Chọn kênh"]') as HTMLButtonElement).click())
      const add = Array.from(host.querySelectorAll('button')).find(x => x.textContent?.includes('Tạo kênh hội thoại'))
      expect(add).toBeTruthy()
      await act(async () => add!.click())
      expect(host.querySelector('input[aria-label="Tên kênh mới"]')).not.toBeNull()
      await render(2)
      expect(host.querySelector('[role="menu"]')).toBeNull()
      await render(1)
      expect(host.querySelector('input[aria-label="Tên kênh mới"]')).toBeNull()
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior
    }
  })

  it('recovers from an old image failure when image URL changes and returns', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const prior = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const render = async (imageUrl: string) => act(async () => root.render(
      <UserAvatar name="Team" group imageUrl={imageUrl} />,
    ))
    try {
      await render('/avatar-a.png')
      const img = host.querySelector('img')
      expect(img).not.toBeNull()
      await act(async () => img!.dispatchEvent(new Event('error')))
      expect(host.querySelector('img')).toBeNull()
      await render('/avatar-b.png')
      expect(host.querySelector('img')?.getAttribute('src')).toBe('/avatar-b.png')
      await render('/avatar-a.png')
      expect(host.querySelector('img')?.getAttribute('src')).toBe('/avatar-a.png')
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior
    }
  })
})
