type AsyncSectionFallbackProps = {
  title: string;
  loading?: boolean;
  onRetry?: () => void;
  onReload?: () => void;
};

export function AsyncSectionFallback({ title, loading = false, onRetry, onReload }: AsyncSectionFallbackProps) {
  return (
    <section
      className="mx-auto flex min-h-40 w-full flex-col items-center justify-center gap-3 p-6 text-center"
      role={loading ? "status" : "alert"}
      aria-live={loading ? "polite" : undefined}
      aria-busy={loading}
    >
      <p className="text-sm text-muted-foreground">{loading ? `Đang tải ${title}…` : `Không thể hiển thị ${title}.`}</p>
      {!loading && (onRetry || onReload) && (
        <div className="flex flex-wrap justify-center gap-2">
          {onRetry && (
            <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={onRetry}>
              Thử lại
            </button>
          )}
          {onReload && (
            <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={onReload}>
              Tải lại trang
            </button>
          )}
        </div>
      )}
    </section>
  );
}
