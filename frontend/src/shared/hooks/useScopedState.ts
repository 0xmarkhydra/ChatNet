import { useCallback, useState, type SetStateAction } from 'react'

export type StateScope = string | number | null

type ScopedValue<T> = { scope: StateScope; epoch: number; value: T }

/**
 * `useState` whose value belongs to one visit of a scope (for example a conversation).
 * When `scope` changes the value is reset to `initial` during the same render, so a
 * previous visit's value never shows for a frame and never comes back later.
 *
 * Every change of scope starts a new epoch. Setters are bound to the epoch they were
 * created in, so a late call from an earlier visit (an async callback that finishes
 * after the user switched, even if the user has since returned to the same scope,
 * A -> B -> A) is ignored. The setter identity is stable within one visit and changes
 * with the next one.
 *
 * `initial` is read once; pass a constant for arrays and objects.
 */
export function useScopedState<T>(scope: StateScope, initial: T): [T, (next: SetStateAction<T>) => void] {
  const [initialValue] = useState(initial)
  const [state, setState] = useState<ScopedValue<T>>({ scope, epoch: 0, value: initialValue })

  let current = state
  if (state.scope !== scope) {
    // Documented "adjust state while rendering" pattern: React re-renders immediately,
    // before anything is committed or painted. The epoch is derived from the previous
    // state, so rendering twice (StrictMode) gives the same result.
    current = { scope, epoch: state.epoch + 1, value: initialValue }
    setState(current)
  }

  const epoch = current.epoch
  const setValue = useCallback((next: SetStateAction<T>) => {
    setState((previous) => {
      if (previous.epoch !== epoch) return previous
      const value = typeof next === 'function' ? (next as (previous: T) => T)(previous.value) : next
      return Object.is(value, previous.value) ? previous : { ...previous, value }
    })
  }, [epoch])

  return [current.value, setValue]
}
