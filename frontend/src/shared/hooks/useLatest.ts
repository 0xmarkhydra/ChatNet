import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * A ref that always holds the latest value, for async callbacks and long-lived listeners
 * that must not re-subscribe when the value changes. It is updated in a layout effect,
 * so it is current before any passive effect or event handler runs, and it is never
 * written while rendering.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
