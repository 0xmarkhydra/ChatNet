import { describe, expect, it, vi } from "vitest";
import { createVisitorNavigation } from "./createVisitorNavigation";

function setup(visitorUsername: string | null = "visitor") {
  const own = { current: "owner" };
  const openOwnProfile = vi.fn();
  const openVisitorProfile = vi.fn();
  const closeVisitor = vi.fn();
  const actions = createVisitorNavigation({
    getOwnUsername: () => own.current,
    openOwnProfile,
    openVisitorProfile,
    closeVisitor,
    visitorUsername,
  });
  return { own, openOwnProfile, openVisitorProfile, closeVisitor, ...actions };
}

describe("visitor profile navigation", () => {
  it("opens the owner's profile without opening a visitor route", () => {
    const nav = setup();
    nav.openVisitor("owner");
    expect(nav.openOwnProfile).toHaveBeenCalledOnce();
    expect(nav.openVisitorProfile).not.toHaveBeenCalled();
  });
  it("forwards visitor username and return route", () => {
    const nav = setup();
    nav.openVisitor("other", "/feed/post/12");
    expect(nav.openVisitorProfile).toHaveBeenCalledWith("other", "/feed/post/12");
  });
  it("uses the latest own username when the session changes", () => {
    const nav = setup();
    nav.own.current = "newOwner";
    nav.openVisitor("newOwner");
    expect(nav.openOwnProfile).toHaveBeenCalledOnce();
  });
  it("navigates on friend selection and only closes an existing preview", () => {
    const nav = setup();
    nav.setFriendPreview({ username: "other" });
    expect(nav.openVisitorProfile).toHaveBeenCalledWith("other", undefined);
    nav.setFriendPreview(null);
    expect(nav.closeVisitor).toHaveBeenCalledOnce();
    const empty = setup(null);
    empty.setFriendPreview(null);
    expect(empty.closeVisitor).not.toHaveBeenCalled();
  });
});
