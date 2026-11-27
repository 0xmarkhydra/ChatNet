// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FeedLikeButton from './FeedLikeButton'
import FeedReactionControl from './FeedReactionControl'
import type { Post } from '../types'

const post: Post = { id: 1, author: 'qa', content: 'Test', likes: 0, liked: false, comments: [], createdAt: '' }
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({ finished: Promise.resolve() }))
let originalAnimate: PropertyDescriptor | undefined

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  animate.mockClear()
  originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate)
  else Reflect.deleteProperty(Element.prototype, 'animate')
})

describe('post heart burst', () => {
  it('starts 14 decorative hearts at the icon and cleans them up after animation', async () => {
    const onLike = vi.fn()
    act(() => root.render(<FeedLikeButton post={post} busy={false} onLike={onLike} />))
    const icon = host.querySelector('svg')!
    vi.spyOn(icon, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 200, 22, 22))

    act(() => host.querySelector('button')!.click())
    const burst = document.querySelector<HTMLElement>('.feed-heart-burst')!
    expect(burst.getAttribute('aria-hidden')).toBe('true')
    expect(burst.style.left).toBe('111px')
    expect(burst.style.top).toBe('211px')
    expect(burst.children).toHaveLength(14)
    expect(animate).toHaveBeenCalledTimes(14)
    expect(onLike).toHaveBeenCalledExactlyOnceWith('❤️')
    await act(async () => {})
    expect(document.querySelector('.feed-heart-burst')).toBeNull()
  })

  it('varies size, climbs slowly, and sways left and right without flying below the icon', async () => {
    let sample = 0
    vi.spyOn(Math, 'random').mockImplementation(() => ((sample++ * 17) % 101) / 101)
    act(() => root.render(<FeedLikeButton post={post} busy={false} onLike={vi.fn()} />))
    vi.spyOn(host.querySelector('svg')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(350, 490, 22, 22))
    act(() => host.querySelector('button')!.click())

    const sizes = [...document.querySelectorAll<HTMLElement>('.feed-heart-particle')].map(el => el.style.fontSize)
    expect(new Set(sizes).size).toBeGreaterThan(8)
    const coords = (frames: Keyframe[]) => frames.map(({ transform }) => {
      const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(String(transform))!
      return [Number(match[1]), Number(match[2])]
    })
    const paths = animate.mock.calls.map(([frames, options]) => {
      expect(options.duration).toBeGreaterThanOrEqual(1600)
      expect(options.duration).toBeLessThanOrEqual(2350)
      expect(frames.at(-1)?.opacity).toBe(0)
      const path = coords(frames)
      expect(path[0]).toEqual([0, 0])
      expect(path.at(-1)![1]).toBeLessThanOrEqual(-175)
      expect(path.every(([, y], index) => index === 0 || y < path[index - 1][1])).toBe(true)
      return path
    })
    expect(paths.some(path => {
      const dx = path.slice(1).map(([x], index) => x - path[index][0])
      return dx.some(x => x > 0) && dx.some(x => x < 0)
    })).toBe(true)
    await act(async () => {})
  })

  it('keeps removing the heart without emitting particles', () => {
    const onLike = vi.fn()
    act(() => root.render(<FeedLikeButton post={{ ...post, myReaction: '❤️' }} busy={false} onLike={onLike} />))
    act(() => host.querySelector('button')!.click())
    expect(animate).not.toHaveBeenCalled()
    expect(onLike).toHaveBeenCalledExactlyOnceWith('❤️')
  })

  it('keeps the reaction available when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    const onLike = vi.fn()
    act(() => root.render(<FeedLikeButton post={post} busy={false} onLike={onLike} />))
    act(() => host.querySelector('button')!.click())
    expect(animate).not.toHaveBeenCalled()
    expect(onLike).toHaveBeenCalledExactlyOnceWith('❤️')
  })

  it('bursts when selecting Love from the post reaction picker', async () => {
    const react = vi.fn(async () => {})
    act(() => root.render(<FeedReactionControl post={post} busy={false} react={react} />))
    act(() => host.querySelector('button')!.focus())
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Yêu thích"]')!.click())
    expect(animate).toHaveBeenCalledTimes(14)
    expect(react).toHaveBeenCalledExactlyOnceWith(post, '❤️')
  })
})