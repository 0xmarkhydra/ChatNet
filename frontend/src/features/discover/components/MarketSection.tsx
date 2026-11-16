import { lazy } from "react";
import { Suspense } from "react";
import { ErrorBoundary } from "../../../shared/ui/ErrorBoundary";
import { AsyncSectionFallback } from "../../../shared/ui/AsyncSectionFallback";
import { type Session } from "../../../shared/types/session";
import type { Tab } from "../../../shared/types/navigation";

const Marketplace = lazy(() => import("./Marketplace"));

export type MarketSectionProps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  session: Session;
  switchTab: (nextTab: Tab) => void;
  searchQuery: string;
};

export default function MarketSection({
  apiFetch,
  session,
  switchTab,
  searchQuery,
}: MarketSectionProps) {
  return (
      <ErrorBoundary resetKey={session.sessionId} fallback={(retry) => <AsyncSectionFallback title="Chợ" onRetry={retry} onReload={() => window.location.reload()} />}>
      <Suspense fallback={<AsyncSectionFallback title="Chợ" loading />}>
            <Marketplace
              key={session.sessionId}
              userId={session.user.id}
              searchQuery={searchQuery}
              request={apiFetch}
              onBack={() => switchTab("discover")}
            />
          </Suspense>
      </ErrorBoundary>
  );
}
