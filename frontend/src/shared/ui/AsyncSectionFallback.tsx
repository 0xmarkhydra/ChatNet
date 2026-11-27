import { useUiTranslation } from '@/shared/i18n/locale'
import { Button } from "./button";

type AsyncSectionFallbackProps = {
  title: string;
  loading?: boolean;
  onRetry?: () => void;
  onReload?: () => void;
};

/** Shared async boundary for route code-splitting and recoverable render errors. */
export function AsyncSectionFallback({ title, loading = false, onRetry, onReload }: AsyncSectionFallbackProps) {
  const trUi = useUiTranslation()

  return (
    <section
      className="mx-auto flex min-h-40 w-full flex-col items-center justify-center gap-3 p-6 text-center"
      role={loading ? "status" : "alert"}
      aria-live={loading ? "polite" : undefined}
      aria-busy={loading}
    >
      {loading && (
        <div data-slot="loading-skeleton" aria-hidden="true" className="flex w-full max-w-xs flex-col gap-3">
          <div className="h-5 w-3/5 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          <div className="h-3 w-full animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <div className="h-3 w-4/5 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        </div>
      )}
      <p className="text-sm text-muted-foreground">{loading ? trUi("common.ui.loadingSection", { name: title }) : trUi("common.ui.failedSection", { name: title })}</p>
      {!loading && (onRetry || onReload) && (
        <div className="flex flex-wrap justify-center gap-2">
          {onRetry && <Button variant="outline" className="min-h-11" onClick={onRetry}>{trUi("common.retry")}</Button>}
          {onReload && <Button variant="outline" className="min-h-11" onClick={onReload}>{trUi("common.ui.reloadPage")}</Button>}
        </div>
      )}
    </section>
  );
}