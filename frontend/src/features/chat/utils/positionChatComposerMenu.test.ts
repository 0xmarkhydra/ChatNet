import { describe, expect, it } from 'vitest'
import { positionChatComposerMenu } from './positionChatComposerMenu'

const trigger = (left: number, top: number, width = 36, height = 44) => ({
  left, top, right: left + width, bottom: top + height,
})

describe('positionChatComposerMenu', () => {
  it('opens above a bottom composer without exceeding desktop viewport', () => {
    const rect = positionChatComposerMenu(trigger(20, 720), { left: 0, top: 0, width: 1280, height: 800 }, 430)
    expect(rect).toMatchObject({ left: 20, top: 282, width: 350, maxHeight: 430 })
    expect(rect.top + rect.maxHeight).toBeLessThanOrEqual(720)
  })
  it('stays within narrow phone viewport edges', () => {
    const rect = positionChatComposerMenu(trigger(5, 570), { left: 0, top: 0, width: 320, height: 640 }, 430)
    expect(rect.left).toBeGreaterThanOrEqual(12)
    expect(rect.left + rect.width).toBeLessThanOrEqual(308)
    expect(rect.top).toBeGreaterThanOrEqual(12)
    expect(rect.top + rect.maxHeight).toBeLessThanOrEqual(628)
  })
  it('uses below when there is no space above the trigger', () => {
    const rect = positionChatComposerMenu(trigger(800, 20), { left: 0, top: 0, width: 900, height: 650 }, 235)
    expect(rect.top).toBe(72)
    expect(rect.left + rect.width).toBeLessThanOrEqual(888)
  })
  it('respects a resized visual viewport caused by the mobile keyboard', () => {
    const rect = positionChatComposerMenu(trigger(10, 355), { left: 0, top: 245, width: 360, height: 220 }, 430)
    expect(rect.top).toBeGreaterThanOrEqual(257)
    expect(rect.top + rect.maxHeight).toBeLessThanOrEqual(453)
  })
})
