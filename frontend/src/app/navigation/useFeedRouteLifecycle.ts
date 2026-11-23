import { useEffect, useLayoutEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { Tab } from '../../shared/types/navigation'

type Options = {
  tab: Tab
  searchKey: string
  feedViewRef: RefObject<HTMLDivElement | null>
  setSearchHasScrolled: Dispatch<SetStateAction<boolean>>
  pathname: string
  search: string
  getPostIdFromPath: (pathname: string) => number | null
  setActivePostId: Dispatch<SetStateAction<number | null>>
}

/** The browser route owns the active feed post; search transitions own scroll restoration. */
export function useFeedRouteLifecycle({
  tab, searchKey, feedViewRef, setSearchHasScrolled,
  pathname, search, getPostIdFromPath, setActivePostId,
}: Options) {
  // Only entering the feed or changing the search resets its scroll position.
  useLayoutEffect(() => {
    if (tab !== 'feed') return
    if (feedViewRef.current) feedViewRef.current.scrollTop = 0
    setSearchHasScrolled(false)
  }, [tab, searchKey, feedViewRef, setSearchHasScrolled])

  // Router location is authoritative for browser Back/Forward on post URLs.
  useEffect(() => {
    if (tab !== 'feed') return
    const routeId = getPostIdFromPath(pathname)
    const id = routeId ?? Number(new URLSearchParams(search).get('post'))
    setActivePostId(Number.isSafeInteger(id) && id > 0 ? id : null)
  }, [tab, pathname, search, getPostIdFromPath, setActivePostId])
}
