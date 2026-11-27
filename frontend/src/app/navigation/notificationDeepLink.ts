import type { Tab } from "../../shared/types/navigation";
import { TAB_PATH, chatConversationPath } from "../router/routes";

export type NotificationDeepLink = {
  tab: Extract<Tab, "feed" | "contacts"> | null;
  conversationId: number | null;
  messageId: number | null;
};

/** Accept canonical positive integer IDs, matching shareable route IDs. */
function positiveId(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/** Parse a push/deep link without changing the current browser location. */
export function notificationDeepLink(params: URLSearchParams): NotificationDeepLink {
  const tab = params.get("tab");
  return {
    tab: tab === "feed" || tab === "contacts" ? tab : null,
    conversationId: positiveId(params.get("conversation")),
    messageId: positiveId(params.get("message")),
  };
}

/** Resolve and consume one-shot notification parameters using the router's location. */
export function notificationRouteTarget(location: {
  pathname: string;
  search: string;
  hash: string;
}) {
  const params = new URLSearchParams(location.search);
  const target = notificationDeepLink(params);
  // Feature pages own their query parameters. Only the legacy home route or
  // recognized notification destinations may consume the shared "tab" key.
  const consumeTab = params.has("tab") && (location.pathname === "/" || target.tab !== null);
  if (!consumeTab && !params.has("conversation") && !params.has("message")) return null;

  if (consumeTab || target.conversationId !== null) params.delete("tab");
  params.delete("conversation");
  params.delete("message");

  const search = params.toString();
  return {
    ...target,
    to: {
      pathname: target.conversationId !== null
        ? chatConversationPath(target.conversationId)
        : target.tab !== null ? TAB_PATH[target.tab] : location.pathname,
      search: search ? `?${search}` : "",
      hash: location.hash,
    },
  };
}