import type { Tab } from "../../shared/types/navigation";

export type NotificationDeepLink = {
  tab: Extract<Tab, "feed" | "contacts"> | null;
  conversationId: number | null;
  messageId: number | null;
};

/** Parse a push/deep link without changing the current browser location. */
export function notificationDeepLink(params: URLSearchParams): NotificationDeepLink {
  const tab = params.get("tab");
  const conversation = Number(params.get("conversation"));
  const message = Number(params.get("message"));
  return {
    tab: tab === "feed" || tab === "contacts" ? tab : null,
    conversationId: Number.isSafeInteger(conversation) && conversation > 0 ? conversation : null,
    messageId: Number.isSafeInteger(message) && message > 0 ? message : null,
  };
}

/** Preserve invite links and hashes when removing one-shot notification parameters. */
export function consumeNotificationDeepLink(url: URL) {
  const params = url.searchParams;
  if (!params.has("tab") && !params.has("conversation") && !params.has("message")) return;
  params.delete("tab");
  params.delete("conversation");
  params.delete("message");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}
