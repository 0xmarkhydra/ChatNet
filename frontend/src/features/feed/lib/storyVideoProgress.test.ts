// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { bindStoryVideoProgress } from './storyVideoProgress'

function setup() {
  const video = document.createElement('video')
  const bar = document.createElement('span')
  const clock = { duration: 10, time: 0, paused: true, ended: false }
  Object.defineProperties(video, {
    duration: { get: () => clock.duration },
    currentTime: { get: () => clock.time },
    paused: { get: () => clock.paused },
    ended: { get: () => clock.ended },
  })
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.set(++id, callback)
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(frame => { frames.delete(frame) })
  const flushFrame = () => {
    for (const [key, callback] of [...frames]) {
      frames.delete(key)
      callback(0)
    }
  }
  const emit = (name: string) => video.dispatchEvent(new Event(name))
  const dispose = bindStoryVideoProgress(video, bar)
  return { clock, bar, frames, flushFrame, emit, dispose }
}

afterEach(() => vi.restoreAllMocks())

it('paints the actual media clock on animation frames without timeupdate events', () => {
  const { clock, bar, frames, flushFrame, emit, dispose } = setup()
  expect(bar.style.transform).toBe('scaleX(0)')
  clock.paused = false
  emit('playing')
  clock.time = 2.5
  flushFrame()
  expect(bar.style.transform).toBe('scaleX(0.25)')
  clock.time = 2.6
  flushFrame()
  expect(bar.style.transform).toBe('scaleX(0.26)')
  dispose()
  expect(frames.size).toBe(0)
})

it('stops during buffering and pause, resumes once, and removes listeners on cleanup', () => {
  const { clock, bar, frames, emit, dispose } = setup()
  clock.paused = false
  emit('playing')
  clock.time = 3
  emit('waiting')
  expect(bar.style.transform).toBe('scaleX(0.3)')
  expect(frames.size).toBe(0)
  emit('playing')
  emit('playing')
  expect(frames.size).toBe(1)
  clock.time = 4
  clock.paused = true
  emit('pause')
  expect(frames.size).toBe(0)
  expect(bar.style.transform).toBe('scaleX(0.4)')
  dispose()
  clock.paused = false
  clock.time = 8
  emit('playing')
  emit('timeupdate')
  expect(frames.size).toBe(0)
  expect(bar.style.transform).toBe('scaleX(0.4)')
})

it('handles missing metadata and clamps progress after seeking', () => {
  const { clock, bar, emit, dispose } = setup()
  clock.duration = NaN
  clock.time = 3
  emit('durationchange')
  expect(bar.style.transform).toBe('scaleX(0)')
  clock.duration = 10
  emit('loadedmetadata')
  expect(bar.style.transform).toBe('scaleX(0.3)')
  clock.time = 12
  emit('seeked')
  expect(bar.style.transform).toBe('scaleX(1)')
  clock.time = -1
  emit('seeking')
  expect(bar.style.transform).toBe('scaleX(0)')
  dispose()
})
