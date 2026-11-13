// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { consumeNotificationDeepLink, notificationDeepLink } from "./notificationDeepLink";

describe("notification deep links", () => {
  it("parses feed, contacts and valid conversation/message IDs", () => {
    expect(notificationDeepLink(new URLSearchParams("tab=feed&conversation=12&message=34")))
      .toEqual({ tab: "feed", conversationId: 12, messageId: 34 });
    expect(notificationDeepLink(new URLSearchParams("tab=contacts&conversation=-1&message=oops")))
      .toEqual({ tab: "contacts", conversationId: null, messageId: null });
    expect(notificationDeepLink(new URLSearchParams("conversation=0&message=1.5")))
      .toEqual({ tab: null, conversationId: null, messageId: null });
  });

  it("consumes only notification parameters and preserves invite/hash", () => {
    const oldUrl = window.location.href;
    try {
      window.history.replaceState(null, "", "/chat?invite=someone&conversation=12&message=34&tab=feed#room");
      consumeNotificationDeepLink(new URL(window.location.href));
      expect(window.location.pathname + window.location.search + window.location.hash)
        .toBe("/chat?invite=someone#room");
    } finally {
      window.history.replaceState(null, "", oldUrl);
    }
  });
});
