import { describe, expect, it } from "vitest";
import type { Post } from "../../features/feed/types";
import { selectDisplayedFeedPosts } from "./feedListSelector";

function post(id: number, createdAt: string, liked = false, likes = 2): Post {
  return { id, author: "alice", content: "", likes, liked, comments: [], createdAt };
}

describe("feed list selection", () => {
  const visible = [post(1, "2026-11-01"), post(2, "2026-11-02")];
  const search = [post(3, "2026-11-03", false, 0)];
  const saved = [post(4, "2026-11-04")];
  const following = [post(5, "2026-11-05", true, 1)];
  const args = { searchActive: false, searchPosts: search, savedPosts: saved, followingPosts: following, visiblePosts: visible, filter: "all", likePreviews: { 3: true, 5: false } };

  it("keeps default and saved feed arrays, and sorts latest without mutating sources", () => {
    expect(selectDisplayedFeedPosts(args)).toBe(visible);
    expect(selectDisplayedFeedPosts({ ...args, filter: "saved" })).toBe(saved);
    expect(selectDisplayedFeedPosts({ ...args, filter: "latest" }).map(x => x.id)).toEqual([2, 1]);
    expect(visible.map(x => x.id)).toEqual([1, 2]);
  });

  it("applies optimistic like previews to search and following while preserving source objects", () => {
    expect(selectDisplayedFeedPosts({ ...args, searchActive: true })[0]).toMatchObject({ id: 3, liked: true, likes: 1 });
    expect(selectDisplayedFeedPosts({ ...args, filter: "following" })[0]).toMatchObject({ id: 5, liked: false, likes: 0 });
    expect(search[0]?.liked).toBe(false);
    expect(following[0]?.liked).toBe(true);
  });

  it("does not double count an unchanged preview and clamps likes at zero", () => {
    const unchanged = selectDisplayedFeedPosts({ ...args, searchActive: true, likePreviews: { 3: false } });
    expect(unchanged[0]?.likes).toBe(0);
    const clamped = selectDisplayedFeedPosts({ ...args, filter: "following", followingPosts: [post(8, "2026-11-05", true, 0)], likePreviews: { 8: false } });
    expect(clamped[0]?.likes).toBe(0);
  });
});
