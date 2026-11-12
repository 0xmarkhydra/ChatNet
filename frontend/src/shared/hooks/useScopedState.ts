import { useCallback, useState, type SetStateAction } from 'react'

export type StateScope = string | number | null

type ScopedValue<T> = { scope: StateScope; value: T }

/**
 * `useState` whose value belongs to one scope (for example a conversation).
 * When `scope` changes the value is reset to `initial` during the same render, so a
 * previous scope's value never shows for a frame and never comes back later.
 *
 * Setters are bound to the scope they were created in. A late call from an older
 * scope (an async callback that finishes after the user switched) is ignored, so it
 * cannot overwrite the current scope. The setter identity therefore changes with
 * the scope.
 *
 * `initial` is read once; pass a constant for arrays and objects.
 */
export function useScopedState<T>(scope: StateScope, initial: T): [T, (next: SetStateAction<T>) => void] {
  const [initialValue] = useState(initial)
  const [state, setState] = useState<ScopedValue<T>>({ scope, value: initialValue })

  let current = state
  if (state.scope !== scope) {
    // Documented "adjust state while rendering" pattern: React re-renders immediately,
    // before anything is committed or painted.
    current = { scope, value: initialValue }
    setState(current)
  }

  const setValue = useCallback((next: SetStateAction<T>) => {
    setState((previous) => {
      if (previous.scope !== scope) return previous
      const value = typeof next === 'function' ? (next as (previous: T) => T)(previous.value) : next
      return Object.is(value, previous.value) ? previous : { scope, value }
    })
  }, [scope])

  return [current.value, setValue]
}
