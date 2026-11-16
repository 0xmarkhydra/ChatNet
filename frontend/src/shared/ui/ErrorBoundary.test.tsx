// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let host: HTMLDivElement
let root: Root
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const originalAct = actEnvironment.IS_REACT_ACT_ENVIRONMENT

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalAct
  vi.restoreAllMocks()
})

function FailingView(): never {
  throw new Error('Unexpected child error')
}

describe('ErrorBoundary failure isolation', () => {
  it('still shows the recovery fallback if optional crash telemetry throws', async () => {
    const onError = vi.fn(() => { throw new Error('Logger service is unavailable') })
    await act(async () => root.render(
      <ErrorBoundary onError={onError} fallback={() => <p role="alert">Có thể thử lại</p>}>
        <FailingView />
      </ErrorBoundary>,
    ))
    expect(onError).toHaveBeenCalledOnce()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Có thể thử lại')
    expect(host.textContent).not.toContain('Logger service is unavailable')
  })
})
