/** Shared placeholder for first-page Feed loading, never for pagination. */
export default function FeedPostsFallback() {
  return (
    <div className="feed-posts-loading grid gap-ui-3" role="status" aria-live="polite" aria-label="Đang tải bài viết">
      <span className="sr-only">Đang tải bài viết...</span>
      {[0, 1].map(item => (
        <div key={item} aria-hidden="true"
          className="rounded-ui-lg border border-border bg-card p-ui-4 motion-safe:animate-pulse">
          <div className="flex items-center gap-ui-3">
            <div className="size-control-touch shrink-0 rounded-full bg-muted" />
            <div className="flex flex-1 flex-col gap-ui-2">
              <div className="h-3 w-2/5 rounded bg-muted" />
              <div className="h-2 w-1/4 rounded bg-muted" />
            </div>
          </div>
          <div className="mt-5 h-3 w-4/5 rounded bg-muted" />
          <div className="mt-3 h-3 w-3/5 rounded bg-muted" />
          <div className="mt-5 h-px w-full bg-border" />
          <div className="mt-4 h-5 w-full rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}