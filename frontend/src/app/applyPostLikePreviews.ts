/** Keep optimistic feed and profile like counts consistent until the server confirms a mutation. */
export function applyPostLikePreviews<T extends { id: number; liked: boolean; likes: number }>(
  posts: T[],
  likePreviews: Record<number, boolean>,
): T[] {
  return posts.map((post) => {
    const preview = likePreviews[post.id];
    if (preview === undefined) return post;
    return {
      ...post,
      liked: preview,
      likes: Math.max(0, post.likes + (preview === post.liked ? 0 : preview ? 1 : -1)),
    };
  });
}
