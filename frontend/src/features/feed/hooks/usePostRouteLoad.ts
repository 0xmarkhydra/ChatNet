import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useLatest } from '../../../shared/hooks/useLatest'
import type { ApiRequest } from '../../../shared/types/api'
import type { Session } from '../../../shared/types/session'
import type { Tab } from '../../../shared/types/navigation'
import type { Post } from '../types'

type Options = {
  sessionId: string | null
  sessionToken: string | null
  sessionRef: RefObject<Session | null>
  tab: Tab
  routeSearch: string
  request: ApiRequest
  setTab: (tab: Tab) => void
  setPosts: Dispatch<SetStateAction<Post[]>>
  setActivePostId: Dispatch<SetStateAction<number | null>>
  onError: (message: string) => void
}

/** Load a shared post URL without leaking late responses into another login visit. */
export function usePostRouteLoad({
  sessionId, sessionToken, sessionRef, tab, routeSearch, request,
  setTab, setPosts, setActivePostId, onError,
}: Options) {
  const callbacks = useLatest({ request, setTab, setPosts, setActivePostId, onError })

  useEffect(() => {
    if (!sessionToken || !sessionId || sessionRef.current?.sessionId !== sessionId) return
    const params = new URLSearchParams(routeSearch)
    if (tab !== 'feed' && params.get('tab') !== 'feed') return
    if (tab !== 'feed') callbacks.current.setTab('feed')
    const id = Number(params.get('post'))
    if (!Number.isSafeInteger(id) || id <= 0) return

    let cancelled = false
    const isCurrent = () => !cancelled && sessionRef.current?.sessionId === sessionId

    void callbacks.current.request('/api/posts/' + id)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(response.status === 404
            ? 'Bài viết không tồn tại hoặc bạn không có quyền xem.'
            : 'Không thể mở bài viết.')
        return response.json() as Promise<Post>
      })
      .then((post) => {
        if (!isCurrent()) return
        callbacks.current.setPosts(current => [
          post, ...current.filter(item => item.id !== post.id),
        ])
        callbacks.current.setActivePostId(post.id)
      })
      .catch((error) => {
        if (isCurrent())
          callbacks.current.onError(error instanceof Error ? error.message : 'Không thể mở bài viết.')
      })
    return () => { cancelled = true }
  }, [sessionId, sessionToken, sessionRef, tab, routeSearch, callbacks])
}
