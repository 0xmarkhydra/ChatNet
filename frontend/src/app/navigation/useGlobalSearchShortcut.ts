import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTE } from "../router/routes";

/** Keeps the global search shortcut scoped to the authenticated app lifecycle. */
export function useGlobalSearchShortcut() {
  const navigate = useNavigate();

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        navigate(ROUTE.search);
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, [navigate]);
}
