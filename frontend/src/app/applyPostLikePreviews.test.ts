import { describe, expect, it } from 'vitest';
import { applyPostLikePreviews } from './applyPostLikePreviews';

describe('applyPostLikePreviews', () => {
  const posts = [
    { id: 1, liked: false, likes: 3, title: 'Feed' },
    { id: 2, liked: true, likes: 1, title: 'Profile' },
    { id: 3, liked: false, likes: 0, title: 'Saved' },
  ];

  it('uses previews consistently for feed and profile without changing original posts', () => {
    const visible = applyPostLikePreviews(posts, { 1: true, 2: false });
    expect(visible).toEqual([
      { id: 1, liked: true, likes: 4, title: 'Feed' },
      { id: 2, liked: false, likes: 0, title: 'Profile' },
      posts[2],
    ]);
    expect(posts[0]).toEqual({ id: 1, liked: false, likes: 3, title: 'Feed' });
    expect(visible[2]).toBe(posts[2]);
  });

  it('does not count an unchanged preview twice or allow a negative count', () => {
    expect(applyPostLikePreviews([
      { id: 1, liked: true, likes: 3 },
      { id: 2, liked: true, likes: 0 },
    ], { 1: true, 2: false })).toEqual([
      { id: 1, liked: true, likes: 3 },
      { id: 2, liked: false, likes: 0 },
    ]);
  });
});
