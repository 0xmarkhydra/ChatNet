import type { Post } from "../../features/feed/types";

type FeedFilter = "latest" | "saved" | "following" | string;

/** Keep feed source selection and optimistic like preview semantics independent from App Shell. */
export function selectDisplayedFeedPosts(args: {
  searchActive: boolean;
  searchPosts: Post[];
  savedPosts: Post[];
  followingPosts: Post[];
  visiblePosts: Post[];
  filter: FeedFilter;
  likePreviews: Readonly<Record<number, boolean>>;
}): Post[] {
  const { searchActive, searchPosts, savedPosts, followingPosts, visiblePosts, filter, likePreviews } = args;
  function withLikePreviews(posts: readonly Post[]): Post[] {
    return posts.map((post) =>
      likePreviews[post.id] === undefined
        ? post
        : {
            ...post,
            liked: likePreviews[post.id],
            likes: Math.max(
              0,
              post.likes + (likePreviews[post.id] === post.liked
                ? 0 : likePreviews[post.id] ? 1 : -1),
            ),
          },
    );
  }

  if (searchActive) return withLikePreviews(searchPosts);
  if (filter === "saved") return savedPosts;
  if (filter === "following") return withLikePreviews(followingPosts);
  if (filter === "latest") {
    return [...visiblePosts].sort((a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
  }
  return visiblePosts;
}
