import { useEffect, useState } from 'react'
import { useLatest } from '../../../shared/hooks/useLatest'
import { useScopedState } from '../../../shared/hooks/useScopedState'

type RemoteState<T> = { items: T[]; error: string; done: boolean }
const initialState = { items: [], error: '', done: false }

/**
 * Loads one result list for `key` (empty key = disabled). Results belong to the key and
 * retry they were requested for, so a late response from an earlier search is ignored.
 */
export function useRemoteList<T>(key: string, load: (signal: AbortSignal) => Promise<T[]>, errorMessage: string) {
  const [retryNumber, setRetryNumber] = useState(0)
  const [state, setState] = useScopedState<RemoteState<T>>(JSON.stringify([key, retryNumber]), initialState)
  const loadRef = useLatest(load)

  useEffect(() => {
    if (!key) return
    const abort = new AbortController()
    loadRef.current(abort.signal).then(
      items => { if (!abort.signal.aborted) setState({ items, error: '', done: true }) },
      () => { if (!abort.signal.aborted) setState({ items: [], error: errorMessage, done: true }) },
    )
    return () => abort.abort()
  }, [key, retryNumber, loadRef, setState, errorMessage])

  return {
    items: state.items,
    loading: Boolean(key) && !state.done,
    error: state.error,
    retry: () => setRetryNumber(value => value + 1),
  }
}
