/** Consume an authenticated invite without losing router history state. */
export function consumeInviteDeepLink(url: URL): string | null {
  const params = url.searchParams;
  const username = (params.get("connect") || params.get("invite") || "")
    .replace(/^@/, "")
    .trim();
  if (!username) return null;

  params.delete("connect");
  params.delete("invite");
  window.history.replaceState(
    window.history.state,
    "",
    url.pathname + url.search + url.hash,
  );
  return username;
}
