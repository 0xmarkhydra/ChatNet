import { useEffect, useState } from "react";
import { useLatest } from "../../shared/hooks/useLatest";

function isStandaloneDisplay() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true;
}

/** Track installed display mode and keep appinstalled callbacks current. */
export function useAppInstallState(onInstalled: () => void) {
  const [isStandalone, setIsStandalone] = useState(() =>
    typeof window !== "undefined" && isStandaloneDisplay(),
  );
  const installedRef = useLatest(onInstalled);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const syncDisplayMode = () => setIsStandalone(isStandaloneDisplay());
    const installed = () => {
      setIsStandalone(true);
      installedRef.current();
    };

    media.addEventListener("change", syncDisplayMode);
    window.addEventListener("appinstalled", installed);
    return () => {
      media.removeEventListener("change", syncDisplayMode);
      window.removeEventListener("appinstalled", installed);
    };
  }, [installedRef]);

  return isStandalone;
}