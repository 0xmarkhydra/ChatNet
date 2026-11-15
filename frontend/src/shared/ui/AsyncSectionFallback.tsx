type AsyncSectionFallbackProps = {
  title: string;
  loading?: boolean;
  onRetry?: () => void;
};

export function AsyncSectionFallback({ title, loading = false, onRetry }: AsyncSectionFallbackProps) {
  return (
    <section
      className="mx-auto flex min-h-40 w-full flex-col items-center justify-center gap-3 p-6 text-center"
      role={loading ? "status" : "alert"}
      aria-live={loading ? "polite" : undefined}
      aria-busy={loading}
    >
      <p className="text-sm text-muted-foreground">{loading ? `Đang tải ${title}…` : `Không thể hiển thị ${title}.`}</p>
      {!loading && onRetry && (
        <button type="button" className="rounded-md border border-border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </section>
  );
}
