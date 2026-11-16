/** Resolve one-shot invite parameters without mutating browser history outside the router. */
export function inviteRouteTarget(location: {
  pathname: string;
  search: string;
  hash: string;
}): { username: string; to: { pathname: string; search: string; hash: string } } | null {
  const params = new URLSearchParams(location.search);
  const username = (params.get("connect") || params.get("invite") || "")
    .replace(/^@/, "")
    .trim();
  if (!username) return null;

  params.delete("connect");
  params.delete("invite");
  const search = params.toString();
  return {
    username,
    to: {
      pathname: location.pathname,
      search: search ? `?${search}` : "",
      hash: location.hash,
    },
  };
}
