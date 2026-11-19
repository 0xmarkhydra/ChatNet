import { Navigate, useLocation } from "react-router-dom";
import { TAB_PATH, tabFromPath } from "./routes";

/** Preserve existing legacy entry points, URL fragments and navigation state. */
export default function LegacyHomeRedirect() {
  const { search, hash, state } = useLocation();
  const params = new URLSearchParams(search);
  const tab = tabFromPath("/", params.get("tab"));
  params.delete("tab");
  const remaining = params.toString();
  return <Navigate to={{ pathname: TAB_PATH[tab], search: remaining ? `?${remaining}` : "", hash }} state={state} replace />;
}
