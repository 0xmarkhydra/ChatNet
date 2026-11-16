import { useEffect, useRef, useState } from "react";
import { useScopedState } from "../../../shared/hooks/useScopedState";
import type { ApiRequest } from "../../../shared/types/api";
import type { Post } from "../types";
import { useLatest } from "../../../shared/hooks/useLatest";

const SEARCH_PAGE_SIZE = 5;

const foldVietnamese = (value: string) => value.toLocaleLowerCase('vi-VN')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

type SearchState = {
  key: string;
  posts: Post[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string;
};

const emptyState: SearchState = {
  key: "",
  posts: [],
  loading: false,
  loadingMore: false,
  hasMore: false,
  error: "",
};

export function usePostSearch({
  query,
  scope,
  enabled,
  sessionId,
  request,
}: {
  query: string;
  scope: "all" | "saved" | "following" | "latest";
  enabled: boolean;
  sessionId?: string;
  request: ApiRequest;
}) {
  // The query and scope belong to the cursor. Never append a page from a previous search.
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
  const key =
    enabled && sessionId && normalizedQuery
      ? JSON.stringify([sessionId, scope, normalizedQuery])
      : "";
  const currentKey = useLatest(key);
  const requestRef = useLatest(request);
  const searchController = useRef<AbortController | null>(null);
  const pagingController = useRef<AbortController | null>(null);
  const pagingBusy = useRef(false);
  const [retryNumber, setRetryNumber] = useState(0);
  // A search and each retry owns a fresh result set. The previous query never
  // leaks into the next render, and stale request callbacks cannot update it.
  const [state, setState] = useScopedState<SearchState>(JSON.stringify([key, retryNumber]), emptyState);

  const baseUrl =
    "/api/posts?limit=" +
    SEARCH_PAGE_SIZE +
    (scope === "saved" ? "&scope=saved" : scope === "following" ? "&scope=following" : "") +
    "&q=" +
    encodeURIComponent(normalizedQuery);

  useEffect(() => {
    pagingController.current?.abort();
    pagingController.current = null;
    pagingBusy.current = false;
    if (!key) return;

    const abort = new AbortController();
    searchController.current = abort;

    const timer = window.setTimeout(async () => {
      try {
        const response = await requestRef.current(baseUrl, {
          signal: abort.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Không thể tìm kiếm bài viết.");
        const posts = (await response.json()) as Post[];
        if (abort.signal.aborted || currentKey.current !== key) return;
        setState({
          key,
          posts,
          loading: false,
          loadingMore: false,
          hasMore: posts.length === SEARCH_PAGE_SIZE,
          error: "",
        });
      } catch {
        if (abort.signal.aborted || currentKey.current !== key) return;
        setState({
          ...emptyState,
          key,
          error: "Không thể tìm kiếm bài viết. Hãy thử lại.",
        });
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      abort.abort();
      if (searchController.current === abort) searchController.current = null;
      pagingController.current?.abort();
      pagingController.current = null;
      pagingBusy.current = false;
    };
  }, [key, baseUrl, retryNumber, requestRef, currentKey, setState]);

  const current =
    state.key === key ? state : { ...emptyState, loading: Boolean(key) };

  async function loadMore(retryOnError = false) {
    if (
      !key ||
      state.key !== key ||
      pagingBusy.current ||
      !state.hasMore ||
      state.loading ||
      (state.error && !retryOnError)
    )
      return;
    const before = state.posts[state.posts.length - 1]?.id;
    if (!before) return;
    pagingBusy.current = true;
    const abort = new AbortController();
    pagingController.current = abort;
    setState((previous) =>
      previous.key === key ? { ...previous, loadingMore: true, error: '' } : previous,
    );
    try {
      const response = await requestRef.current(baseUrl + "&before=" + before, {
        signal: abort.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Không thể tải thêm kết quả.");
      const posts = (await response.json()) as Post[];
      if (abort.signal.aborted || currentKey.current !== key) return;
      setState((previous) => {
        if (previous.key !== key) return previous;
        const existing = new Set(previous.posts.map((post) => post.id));
        return {
          ...previous,
          posts: [
            ...previous.posts,
            ...posts.filter((post) => !existing.has(post.id)),
          ],
          hasMore: posts.length === SEARCH_PAGE_SIZE,
          loadingMore: false,
          error: "",
        };
      });
    } catch {
      if (!abort.signal.aborted && currentKey.current === key) {
        setState((previous) =>
          previous.key === key
            ? {
                ...previous,
                loadingMore: false,
                error: "Không thể tải thêm kết quả. Hãy thử lại.",
              }
            : previous,
        );
      }
    } finally {
      if (pagingController.current === abort) {
        pagingBusy.current = false;
        pagingController.current = null;
      }
    }
  }

  function syncPost(updated: Post) {
    const matchesQuery = [updated.content, updated.author, updated.authorDisplayName || '']
      .some(value => foldVietnamese(value).includes(foldVietnamese(normalizedQuery)))
    setState((previous) => ({
      ...previous,
      posts: previous.posts
        .filter(post => post.id !== updated.id || (matchesQuery && (scope !== 'saved' || updated.saved)))
        .map(post => post.id === updated.id ? updated : post),
    }));
  }

  function removePost(id: number) {
    setState((previous) => ({
      ...previous,
      posts: previous.posts.filter((post) => post.id !== id),
    }));
  }

  return {
    posts: current.posts,
    loading: current.loading,
    loadingMore: current.loadingMore,
    hasMore: current.hasMore,
    error: current.error,
    loadMore,
    retry: () => {
      if (state.key === key && state.posts.length > 0 && state.error) void loadMore(true)
      else setRetryNumber((previous) => previous + 1)
    },
    syncPost,
    removePost,
  };
}
