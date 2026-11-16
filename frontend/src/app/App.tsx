import AuthScreen from "../features/auth/components/AuthScreen";
import type { Session } from "../features/auth/lib/session";
import AuthedApp from "./AuthedApp";
import AuthedProviders from "./providers/AuthedProviders";
import AppPageErrorBoundary from "./layouts/AppPageErrorBoundary";
import { useAppSession } from "./hooks/useAppSession";
import { useInstallPrompt } from "./hooks/useInstallPrompt";

/** Compose the signed-out screen or a session-scoped signed-in tree. */
export default function App({ initialSession }: { initialSession?: Session | null }) {
  const { session, sessionRef, responseCache, sessionClient, auth, saveSession, endSession } =
    useAppSession(initialSession);
  const { installPrompt, setInstallPrompt } = useInstallPrompt();

  if (!session) {
    return (
      <AppPageErrorBoundary>
        <AuthScreen {...auth} />
      </AppPageErrorBoundary>
    );
  }

  return (
    <AuthedProviders
      key={session.sessionId}
      session={session}
      sessionRef={sessionRef}
      sessionClient={sessionClient}
      responseCache={responseCache}
    >
      <AppPageErrorBoundary>
        <AuthedApp
          responseCache={responseCache}
          sessionClient={sessionClient}
          saveSession={saveSession}
          endSession={endSession}
          installPrompt={installPrompt}
          setInstallPrompt={setInstallPrompt}
        />
      </AppPageErrorBoundary>
    </AuthedProviders>
  );
}