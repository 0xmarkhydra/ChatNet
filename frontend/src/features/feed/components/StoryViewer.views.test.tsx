// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest } from '@/shared/types/api'
import type { Story } from '../types'
import StoryViewer from './StoryViewer'

let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

const story = (id: number, author: string): Story => ({
  id, author, createdAt: '2026-11-26T01:00:00Z', expiresAt: '2099-01-01T00:00:00Z', text: 'Xin chào', background: 'indigo',
})
const stories = [story(1, 'an'), story(2, 'me')]
const requestStub = () => vi.fn(async (url: string, init?: RequestInit) => {
  if (init?.method) return new Response(null, { status: 204 })
  return url.includes('/views') ? Response.json({ total: 0, viewers: [] }) : Response.json({ liked: false })
})
const views = (request: ReturnType<typeof requestStub>) => request.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([url]) => url)
const render = (active: Story, request: ApiRequest) => act(async () => root.render(
  <StoryViewer activeStory={active} stories={stories} setActiveStoryId={() => {}} request={request} name="me" storyBusy={false}
    deleteStory={async () => {}} onReply={async () => true} onProfile={() => {}} onShare={() => {}} onReport={() => {}} onOpenMessages={() => {}} />,
))

describe('StoryViewer view tracking', () => {
  it('records a view of someone else once, even when the request function changes', async () => {
    const first = requestStub(), second = requestStub()
    await render(stories[0], first)
    await render(stories[0], second)
    expect(views(first)).toEqual(['/api/stories/1/view'])
    expect(views(second)).toEqual([])
  })

  it('does not record a view of your own story', async () => {
    const request = requestStub()
    await render(stories[1], request)
    expect(views(request)).toEqual([])
  })
})
