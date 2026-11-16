// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { consumeInviteDeepLink } from "./inviteDeepLink";

const originalUrl = window.location.href;
afterEach(() => window.history.replaceState(null, "", originalUrl));

describe("invite deep links", () => {
  it("preserves history state, unrelated parameters and hash", () => {
    const state = { key: "route", idx: 4, usr: { tab: "contacts" } };
    window.history.replaceState(state, "", "/chat?invite=%40friend&post=12#thread");
    expect(consumeInviteDeepLink(new URL(window.location.href))).toBe("friend");
    expect(window.location.pathname + window.location.search + window.location.hash)
      .toBe("/chat?post=12#thread");
    expect(window.history.state).toEqual(state);
  });

  it("prefers connect and consumes both invite parameters", () => {
    window.history.replaceState(null, "", "/?connect=%40first&invite=second&tab=feed");
    expect(consumeInviteDeepLink(new URL(window.location.href))).toBe("first");
    expect(window.location.search).toBe("?tab=feed");
  });

  it("leaves the URL untouched when no valid invite is supplied", () => {
    window.history.replaceState({ key: "keep" }, "", "/chat?invite=%20%20#room");
    expect(consumeInviteDeepLink(new URL(window.location.href))).toBeNull();
    expect(window.location.search + window.location.hash).toBe("?invite=%20%20#room");
    expect(window.history.state).toEqual({ key: "keep" });
  });
});
