import { describe, expect, it } from "vitest";
import { selectFriendRelationship } from "./friendRelationship";

describe("selectFriendRelationship", () => {
  const requests = [
    { id: 1, direction: "incoming" as const },
    { id: 2, direction: "outgoing" as const },
    { id: 3 },
  ];

  it("prefers an accepted connection over a pending request", () => {
    expect(selectFriendRelationship(1, [{ id: 1 }], requests)).toBe("accepted");
  });
  it("classifies incoming and outgoing requests", () => {
    expect(selectFriendRelationship(1, [], requests)).toBe("incoming");
    expect(selectFriendRelationship(2, [], requests)).toBe("outgoing");
  });
  it("defaults to none for unknown or unclassified requests", () => {
    expect(selectFriendRelationship(3, [], requests)).toBe("none");
    expect(selectFriendRelationship(4, [], requests)).toBe("none");
  });
});
