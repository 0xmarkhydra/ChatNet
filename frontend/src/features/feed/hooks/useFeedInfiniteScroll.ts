import { useEffect, useRef } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";

export function useFeedInfiniteScroll({
  enabled,
  hasMore,
  loading,
  error,
  onLoadMore,
}: {
  enabled: boolean;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadRef = useLatest(onLoadMore);
  useEffect(() => {
    if (
      !enabled ||
      !hasMore ||
      loading ||
      error ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    let active = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (active && entry?.isIntersecting) loadRef.current();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(sentinel);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [enabled, hasMore, loading, error, loadRef]);
  return sentinelRef;
}
