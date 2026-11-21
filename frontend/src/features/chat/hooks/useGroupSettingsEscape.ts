import { useEffect, type Dispatch, type SetStateAction } from "react";

/** Escape closes group settings unless an active native dialog owns the key. */
export function useGroupSettingsEscape(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
) {
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, setOpen]);
}
