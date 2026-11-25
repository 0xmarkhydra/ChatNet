import { useEffect } from 'react'
import type { Tab } from '../../../shared/types/navigation'
import type { ApiRequest } from '../../../shared/types/api'
import { useLatest } from '../../../shared/hooks/useLatest'
import { usePostSearch } from './usePostSearch'
import { useFeedInfiniteScroll } from './useFeedInfiniteScroll'
import type { useFollowingPosts } from './useFollowingPosts'
import type { FeedFilter } from '../utils/feedFilterRoute'

type Options = {
  tab: Tab
  sessionId?: string
  globalSearch: string
  feedFilter: FeedFilter
  request: ApiRequest
  followingFeed: ReturnType<typeof useFollowingPosts>
  savedPostsLoaded: boolean
  savedPagingError: boolean
  savedPostsBusy: boolean
  postsLoadingMore: boolean
  postsPagingError: boolean
  searchHasScrolled: boolean
  hasMoreSavedPosts: boolean
  hasMorePosts: boolean
  loadSavedPosts: (more?: boolean, mode?: 'open' | 'refresh') => Promise<void>
  loadMorePosts: () => Promise<void>
}

/** Owns selection and paging of the visible feed view without changing fetch contracts. */
export function useFeedPagingOrchestration({
  tab, sessionId, globalSearch, feedFilter, request, followingFeed,
  savedPostsLoaded, savedPagingError, savedPostsBusy, postsLoadingMore,
  postsPagingError, searchHasScrolled, hasMoreSavedPosts, hasMorePosts,
  loadSavedPosts, loadMorePosts,
}: Options) {
  const feedSearchActive = tab === "feed" && globalSearch.trim().length > 0;
  const postSearch = usePostSearch({
    query: globalSearch,
    scope: feedFilter,
    enabled: tab === "feed",
    sessionId: sessionId,
    request,
  });
  // The selected Feed view must not flash an empty state while its first page loads.
  const feedInitialLoading = feedSearchActive
    ? postSearch.loading
    : feedFilter === "following"
      ? followingFeed.loading
      : feedFilter === "saved"
        ? !savedPostsLoaded && !savedPagingError
        : false;
  const feedLoadingMore = feedSearchActive
    ? postSearch.loadingMore
    : feedFilter === "saved"
      ? savedPostsBusy
      : feedFilter === "following"
        ? followingFeed.loadingMore
        : postsLoadingMore;
  const feedPagingError = feedSearchActive
    ? Boolean(postSearch.error)
    : feedFilter === "saved"
      ? savedPagingError
      : feedFilter === "following"
        ? Boolean(followingFeed.error)
        : postsPagingError;
  const savedPostsLoader = useLatest(loadSavedPosts);
  useEffect(() => {
    if (tab !== "feed" || !sessionId || feedSearchActive) return;
    if (feedFilter === "saved") {
      void savedPostsLoader.current();
      return;
    }
    // Warm the first saved page after giving the visible feed a head start.
    const timer = window.setTimeout(() => void savedPostsLoader.current(), 350);
    return () => window.clearTimeout(timer);
  }, [tab, feedFilter, feedSearchActive, sessionId, savedPostsLoader]);
  const feedInfiniteScrollRef = useFeedInfiniteScroll({
    enabled: tab === "feed" && (!feedSearchActive || searchHasScrolled),
    hasMore: feedSearchActive
      ? postSearch.hasMore
      : feedFilter === "saved"
        ? hasMoreSavedPosts
        : feedFilter === "following"
          ? followingFeed.hasMore
          : hasMorePosts,
    loading:
      (feedSearchActive && postSearch.loading) ||
      (feedFilter === "following" && followingFeed.loading) ||
      feedLoadingMore,
    error: feedPagingError,
    onLoadMore: () => {
      if (feedSearchActive) void postSearch.loadMore();
      else if (feedFilter === "saved") void loadSavedPosts(true);
      else if (feedFilter === "following") void followingFeed.loadMore();
      else void loadMorePosts();
    },
  });

  return { feedSearchActive, postSearch, feedInitialLoading, feedLoadingMore, feedPagingError, feedInfiniteScrollRef }
}