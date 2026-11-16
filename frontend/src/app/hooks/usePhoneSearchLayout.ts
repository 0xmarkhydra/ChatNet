import { useSyncExternalStore } from "react";

const PHONE_SEARCH_QUERY = "(max-width: 760px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(PHONE_SEARCH_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(PHONE_SEARCH_QUERY).matches;
}

/** Browser viewport is external state: subscribe instead of mirroring it in an effect. */
export function usePhoneSearchLayout() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
