import { useUiTranslation } from '@/shared/i18n/locale'
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AsyncSectionFallback } from "../../shared/ui/AsyncSectionFallback";
import { ErrorBoundary } from "../../shared/ui/ErrorBoundary";

/** Contain page render crashes without unmounting the persistent app shell. */
export default function AppPageErrorBoundary({ children }: { children: ReactNode }) {
  const trUi = useUiTranslation()
  const { pathname, search, hash } = useLocation();

  return (
    <ErrorBoundary
      resetKey={pathname + search + hash}
      fallback={(retry) => <AsyncSectionFallback title={trUi("common.ui.thisPage")} onRetry={retry} />}
    >
      {children}
    </ErrorBoundary>
  );
}