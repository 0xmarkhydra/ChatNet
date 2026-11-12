import { useState, useEffect } from "react";
import type { ManagedAccountSession } from "../types";
import { type Session } from "../lib/session";

export type UseSessionsPanelDeps = {
  session: Session | null;
};

export function useSessionsPanel({
  session,
}: UseSessionsPanelDeps) {
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [managedSessions, setManagedSessions] = useState<
    ManagedAccountSession[]
  >([]);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  useEffect(() => {
    setManagedSessions([]);
    setSessionsOpen(false);
    setSessionsBusy(false);
    setSessionsError("");
  }, [session?.sessionId]);

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
