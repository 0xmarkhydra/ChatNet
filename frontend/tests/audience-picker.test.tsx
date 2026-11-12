// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import PostAudiencePicker from '../src/features/feed/components/PostAudiencePicker'

describe('post audience picker lifecycle', () => {
  it('closes on disable and remains closed after re-enable', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const prior = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const render = async (disabled: boolean) => act(async () => root.render(
      <PostAudiencePicker value="friends" disabled={disabled} onChange={() => {}} />,
    ))
    try {
      await render(false)
      const trigger = host.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement
      await act(async () => trigger.click())
      expect(host.querySelector('[role="menu"]')).not.toBeNull()
      await render(true)
      expect(host.querySelector('[role="menu"]')).toBeNull()
      expect((host.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement).disabled).toBe(true)
      await render(false)
      expect(host.querySelector('[role="menu"]')).toBeNull()
      await act(async () => trigger.click())
      expect(host.querySelector('[role="menu"]')).not.toBeNull()
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior
    }
  })
})
