// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SharedContent from './SharedContent'
import type { SharedPage } from '../lib/sharedContentLoader'

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../lib/sharedContentLoader', () => ({ loadSharedContent: mocks.load }))

type Job = { before?: number; resolve: (page: SharedPage) => void; reject: (reason: Error) => void }
let jobs: Job[] = []
const cleanups: Array<() => Promise<void>> = []
beforeEach(() => {
  jobs = []
  vi.clearAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // Deliberately ignores the abort signal so stale responses reach the component.
  mocks.load.mockImplementation(({ before }: { before?: number }) => new Promise<SharedPage>((resolve, reject) => {
    jobs.push({ before, resolve, reject })
  }))
})
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  vi.unstubAllGlobals()
})

const page = (name: string, nextBefore?: number): SharedPage => ({
  nextBefore,
  items: [{ id: name.length, sender: 'u', createdAt: '2026-11-15T00:00:00Z',
    text: 'https://example.invalid/' + name,
    attachments: [{ storageRef: name, name, sizeBytes: 10, contentType: 'text/plain', kind: 'file' }] }],
})

async function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const render = async () => act(async () => root.render(
    <SharedContent conversationId={1} initialTab="files" request={async () => new Response()} onClose={() => {}} />,
  ))
  await render()
  cleanups.push(async () => { await act(async () => root.unmount()); host.remove() })
  const button = (text: string) => Array.from(host.querySelectorAll('button')).find(x => x.textContent === text)
  const click = async (text: string) => {
    expect(button(text), text).toBeTruthy()
    await act(async () => button(text)!.click())
  }
  const settle = async (run: () => void) => { await act(async () => run()) }
  return {
    host, render, button, click, settle,
    files: () => Array.from(host.querySelectorAll('.shared-file-copy strong'), x => x.textContent),
    links: () => Array.from(host.querySelectorAll('.shared-link-row strong'), x => x.textContent),
    loading: () => host.querySelector('[role="status"]') !== null,
  }
}

it('does not refetch when only the request prop identity changes', async () => {
  const view = await mount()
  await view.settle(() => jobs[0].resolve(page('one')))
  await view.render()
  expect(jobs).toHaveLength(1)
  expect(view.files()).toEqual(['one'])
})

it('resets the list on tab switch and ignores the previous tab late response, even after returning', async () => {
  const view = await mount()
  await view.settle(() => jobs[0].resolve(page('first', 50)))
  expect(view.files()).toEqual(['first'])
  await view.click('Liên kết')
  expect(view.loading()).toBe(true)
  expect(view.links()).toEqual([])
  expect(view.button('Xem thêm')).toBeUndefined()
  await view.click('Tệp')
  expect(view.files()).toEqual([])
  expect(view.loading()).toBe(true)
  await view.settle(() => jobs[1].resolve(page('stale-links')))
  expect(view.loading()).toBe(true)
  expect(view.files()).toEqual([])
  await view.settle(() => jobs[2].resolve(page('fresh')))
  expect(view.files()).toEqual(['fresh'])
  expect(view.loading()).toBe(false)
})

it.each(['resolves', 'rejects'])('ignores a load-more request that %s after a tab switch', async outcome => {
  const view = await mount()
  await view.settle(() => jobs[0].resolve(page('first', 50)))
  await view.click('Xem thêm')
  expect(jobs[1].before).toBe(50)
  await view.click('Liên kết')
  await view.settle(() => jobs[2].resolve(page('link', 20)))
  await view.settle(() => outcome === 'resolves'
    ? jobs[1].resolve(page('late-more', 5)) : jobs[1].reject(new Error('late failure')))
  expect(view.links()).toEqual(['https://example.invalid/link'])
  expect(view.host.textContent).not.toContain('late failure')
  expect(view.button('Xem thêm')?.disabled).toBe(false)
  await view.click('Xem thêm')
  expect(jobs[3].before).toBe(20)
})

it('shows loading during retry, then recovers or reports the new error', async () => {
  const view = await mount()
  await view.settle(() => jobs[0].reject(new Error('first failure')))
  expect(view.host.textContent).toContain('first failure')
  await view.click('Thử lại')
  expect(view.loading()).toBe(true)
  expect(view.host.textContent).not.toContain('first failure')
  await view.settle(() => jobs[1].reject(new Error('second failure')))
  expect(view.loading()).toBe(false)
  expect(view.host.textContent).toContain('second failure')
  await view.click('Thử lại')
  await view.settle(() => jobs[2].resolve(page('recovered')))
  expect(view.files()).toEqual(['recovered'])
  expect(view.loading()).toBe(false)
  expect(view.button('Thử lại')).toBeUndefined()
})

it('ignores a retry that finishes after a tab switch', async () => {
  const view = await mount()
  await view.settle(() => jobs[0].reject(new Error('failure')))
  await view.click('Thử lại')
  await view.click('Liên kết')
  await view.settle(() => jobs[1].resolve(page('late-retry')))
  expect(view.loading()).toBe(true)
  expect(view.links()).toEqual([])
})
