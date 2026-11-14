import type { Tab } from "../../shared/types/navigation";
import { TAB_PATH } from "../router/routes";

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
        ? TAB_PATH.chat
        : target.tab !== null ? TAB_PATH[target.tab] : location.pathname,
      search: search ? `?${search}` : "",
      hash: location.hash,
    },
  };
}
