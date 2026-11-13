// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, StrictMode, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useScopedState } from '../src/shared/hooks/useScopedState'

type Setter = (next: string | ((current: string) => string)) => void
type Observation = { scope: string; value: string; setter: Setter }

describe('useScopedState visit lifecycle', () => {
  for (const strict of [false, true]) {
    it(`rejects stale A → B → A setters in ${strict ? 'StrictMode' : 'normal mode'}`, async () => {
      const observations: Observation[] = []
      const host = document.createElement('div')
      document.body.append(host)
      const root = createRoot(host)
      const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

      function Probe({ scope }: { scope: string }) {
        const [value, setter] = useScopedState(scope, 'init')
        useLayoutEffect(() => {
          observations.push({ scope, value, setter })
        }, [scope, value, setter])
        return <div>{value}</div>
      }
      const render = async (scope: string) => {
        await act(async () => root.render(strict
          ? <StrictMode><Probe scope={scope} /></StrictMode>
          : <Probe scope={scope} />))
        return observations.at(-1)!
      }
      try {
        const first = await render('A')
        expect(first.value).toBe('init')
        expect((await render('B')).value).toBe('init')
        const returned = await render('A')
        expect(returned.value).toBe('init')
        expect(returned.setter).not.toBe(first.setter)
        await act(async () => {
          first.setter('stale from A')
          first.setter(() => 'stale function from A')
        })
        expect(host.textContent).toBe('init')
        await act(async () => returned.setter(current => current + ':current'))
        expect(host.textContent).toBe('init:current')
        expect((await render('A')).setter).toBe(returned.setter)
        await act(async () => first.setter('late again'))
        expect(host.textContent).toBe('init:current')
      } finally {
        await act(async () => root.unmount())
        host.remove()
        ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
      }
    })
  }
})
