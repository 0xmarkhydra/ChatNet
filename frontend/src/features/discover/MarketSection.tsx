import { lazy } from "react";
import { Suspense } from "react";
import { type Session } from "../auth/session";
import type { Tab } from "../../app/types";

const Marketplace = lazy(() => import("./Marketplace"));

export type MarketSectionProps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  session: Session;
  switchTab: (nextTab: Tab) => void;
};

export default function MarketSection({
  apiFetch,
  session,
  switchTab,
}: MarketSectionProps) {
  return (
      <Suspense fallback={null}>
            <Marketplace
              key={session.sessionId}
              userId={session.user.id}
              request={apiFetch}
              onBack={() => switchTab("discover")}
            />
          </Suspense>
  );
}
