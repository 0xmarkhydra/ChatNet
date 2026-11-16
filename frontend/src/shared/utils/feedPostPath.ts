/** The same permalink is used by the router and by links shared outside the app. */
export function feedPostPath(id: number): string {
  return `/feed/posts/${id}`;
}
