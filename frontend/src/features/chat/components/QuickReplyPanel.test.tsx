// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { it, expect, vi } from 'vitest'
import QuickReplyPanel from './QuickReplyPanel'
import { useQuickReplyVisibility } from '../hooks/useQuickReplyVisibility'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('dismisses both management and slash suggestions without clearing the draft', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const request = vi.fn(async () => Response.json([]))
  const select = vi.fn()
  function Harness({ draft, scope }: {draft: string; scope: string}) {
    const visibility = useQuickReplyVisibility(scope, draft)
    return <>
      <span data-draft>{draft}</span>
      <button type="button" onClick={visibility.open}>Mở quản lý</button>
      <QuickReplyPanel key={scope} request={request} query={visibility.query} managing={visibility.managing} onClose={visibility.close} onSelect={select}/>
    </>
  }
  const render = async (draft: string, scope = 'a') => {
    await act(async () => { root.render(<Harness draft={draft} scope={scope}/>) })
  }
  const closeButton = () => document.querySelector<HTMLButtonElement>('[aria-label="Đóng tin nhắn nhanh"]')
  const open = () => host.querySelector('button')!
  try {
    await render('/camon')
    expect(closeButton()).not.toBeNull()
    act(() => closeButton()!.click())
    expect(closeButton()).toBeNull()
    expect(host.querySelector('[data-draft]')!.textContent).toBe('/camon')
    await render('/camon')
    expect(closeButton()).toBeNull()
    await act(async () => open().click())
    expect(document.querySelector('[aria-label="Từ khóa"]')).not.toBeNull()
    act(() => closeButton()!.click())
    expect(closeButton()).toBeNull()
    await render('/camon1')
    expect(closeButton()).not.toBeNull()
    act(() => closeButton()!.click())
    await render('/camon1', 'b')
    expect(closeButton()).not.toBeNull()
    await render('hello', 'b')
    expect(closeButton()).toBeNull()
    await act(async () => open().click())
    expect(closeButton()).not.toBeNull()
    act(() => closeButton()!.click())
    expect(closeButton()).toBeNull()
    expect(select).not.toHaveBeenCalled()
  } finally {
    act(() => root.unmount())
    host.remove()
  }
})