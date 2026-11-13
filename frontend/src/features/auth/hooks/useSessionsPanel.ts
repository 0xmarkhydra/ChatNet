import type { ManagedAccountSession } from "../types";
import type { Session } from "../lib/session";
import { useScopedState } from "../../../shared/hooks/useScopedState";

export type UseSessionsPanelDeps = {
  session: Session | null;
};

export function useSessionsPanel({ session }: UseSessionsPanelDeps) {
  // The panel belongs to a single authenticated session. An old async response
  // must not reopen it or restore another account's sessions after a switch.
  const scope = session?.sessionId ?? null;
  const [sessionsOpen, setSessionsOpen] = useScopedState(scope, false);
  const [managedSessions, setManagedSessions] = useScopedState<ManagedAccountSession[]>(scope, []);
  const [sessionsBusy, setSessionsBusy] = useScopedState(scope, false);
  const [sessionsError, setSessionsError] = useScopedState(scope, "");

  return {
    managedSessions,
    sessionsBusy,
    sessionsError,
    sessionsOpen,
    setManagedSessions,
    setSessionsBusy,
    setSessionsError,
    setSessionsOpen,
  };
}
