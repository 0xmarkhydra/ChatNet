// @vitest-environment jsdom
import type { Room } from 'livekit-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CallDeviceSettings from './CallDeviceSettings'
import CallHeaderActions from './CallHeaderActions'

describe('accessible call control groups', () => {
  it('names the calling actions group without losing individual button names', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(<CallHeaderActions conversationId={1} />)
    const group = container.querySelector('[role="group"][aria-label="Gọi điện"]')
    expect(group).not.toBeNull()
    expect(Array.from(group?.querySelectorAll('button') ?? [], (button) => button.getAttribute('aria-label')))
      .toEqual(['Gọi thoại', 'Gọi video'])
  })

  it('names the device settings group and keeps labels associated with the selects', () => {
    const container = document.createElement('div')
    // Static rendering checks markup without starting device enumeration or a room connection.
    container.innerHTML = renderToStaticMarkup(<CallDeviceSettings room={{} as Room} micOn cameraOn />)
    const group = container.querySelector('[role="group"][aria-label="Thiết bị cuộc gọi"]')
    expect(group).not.toBeNull()
    expect(Array.from(group?.querySelectorAll('select') ?? [], (select) =>
      select.labels?.[0]?.firstChild?.textContent))
      .toEqual(['Microphone', 'Camera'])
  })
})
