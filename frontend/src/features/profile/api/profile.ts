/** Request builders for profile and visitor timelines. Response parsing stays with UI hooks. */
export type ProfileRequest = (path: string, init?: RequestInit) => Promise<Response>

export function loadProfileNote(request: ProfileRequest, username: string, owner: boolean, force = false) {
  const path = owner ? '/api/profile/note' : '/api/users/' + encodeURIComponent(username) + '/note'
  return request(path, force ? { cache: 'reload' } : {})
}

export function saveProfileNote(
  request: ProfileRequest,
  content: string,
  visibility: 'friends' | 'public' | 'private',
) {
  return request('/api/profile/note', {
    method: 'POST',
    body: JSON.stringify({ content, visibility }),
  })
}

export function deleteProfileNote(request: ProfileRequest, version: string | undefined) {
  return request('/api/profile/note', {
    method: 'DELETE',
    body: JSON.stringify({ version }),
  })
}

export function loadVisitorProfile(request: ProfileRequest, username: string, retry = false) {
  return request('/api/users/' + encodeURIComponent(username) + '/profile',
    retry ? { cache: 'reload' } : undefined)
}

export function loadVisitorPosts(
  request: ProfileRequest,
  username: string,
  before?: number,
  retry = false,
) {
  const path = '/api/posts?author=' + encodeURIComponent(username) + '&limit=15' +
    (before === undefined ? '' : '&before=' + before)
  return request(path, retry ? { cache: 'reload' } : undefined)
}

export function reactToVisitorPost(request: ProfileRequest, postId: number, emoji: string) {
  return request('/api/posts/' + postId + (emoji === '👍' ? '/like' : '/reactions'), {
    method: 'POST',
    ...(emoji === '👍' ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    }),
  })
}
