import type { Tab } from "../../shared/types/navigation";
import { TAB_PATH, chatConversationPath } from "../router/routes";

export type NotificationDeepLink = {
  tab: Extract<Tab, "feed" | "contacts"> | null;
  conversationId: number | null;
  messageId: number | null;
};

/** Match the positive decimal IDs accepted by the app's shareable chat routes. */
function notificationId(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/** Parse a push/deep link without changing the current browser location. */
export function notificationDeepLink(params: URLSearchParams): NotificationDeepLink {
  const tab = params.get("tab");
  const conversationId = notificationId(params.get("conversation"));
  const messageId = notificationId(params.get("message"));
  return {
    tab: tab === "feed" || tab === "contacts" ? tab : null,
    conversationId,
    messageId,
  };
}

/** Resolve and consume one-shot notification parameters using the router's location. */
export function notificationRouteTarget(location: {
  pathname: string;
  search: string;
  hash: string;
}) {
  const params = new URLSearchParams(location.search);
  if (!params.has("tab") && !params.has("conversation") && !params.has("message")) return null;

  const target = notificationDeepLink(params);
  params.delete("tab");
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
