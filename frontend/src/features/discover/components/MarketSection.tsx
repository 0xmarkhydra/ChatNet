import { lazy } from "react";
import { Suspense } from "react";
import { ErrorBoundary } from "../../../shared/ui/ErrorBoundary";
import { AsyncSectionFallback } from "../../../shared/ui/AsyncSectionFallback";
import { type Session } from "../../../shared/types/session";
import type { Tab } from "../../../shared/types/navigation";

const Marketplace = lazy(() => import("./Marketplace"));

export type MarketSectionProps = {
  searchQuery: string;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  session: Session;
  switchTab: (nextTab: Tab) => void;
};

export default function MarketSection({
  searchQuery,
  apiFetch,
  session,
  switchTab,
}: MarketSectionProps) {
  return (
      <ErrorBoundary resetKey={session.sessionId} fallback={(retry) => <AsyncSectionFallback title="Chợ" onRetry={retry} onReload={() => window.location.reload()} />}>
      <Suspense fallback={<AsyncSectionFallback title="Chợ" loading />}>
            <Marketplace
              searchQuery={searchQuery}
              key={session.sessionId}
              userId={session.user.id}
              request={apiFetch}
              onBack={() => switchTab("discover")}
            />
          </Suspense>
      </ErrorBoundary>
  );
}
