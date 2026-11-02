type Entry = { valid: boolean; response?: Response; expires: number; pending?: Promise<Response> }
function policy(path: string): { tag: string; ttl: number } | undefined {
 const p = new URL(path, 'http://cache.local').pathname
 if (p === '/api/profile/note' || /^\/api\/users\/[^/]+\/note$/.test(p)) return { tag: 'notes', ttl: 10000 }
 if (p === '/api/posts' || /^\/api\/posts\/\d+$/.test(p)) return { tag: 'feed', ttl: 15000 }
 if (p === '/api/stories') return { tag: 'stories', ttl: 10000 }
 if (['/api/friends','/api/friends/requests','/api/contacts'].includes(p)) return { tag: 'friends', ttl: 20000 }
 if (p === '/api/profile' || /^\/api\/users\/[^/]+\/profile$/.test(p)) return { tag: 'profiles', ttl: 30000 }
 if (p === '/api/conversation-categories') return { tag: 'categories', ttl: 30000 }
 if (p === '/api/conversations') return { tag: 'conversations', ttl: 8000 }
 if (/^\/api\/conversations\/\d+\/messages$/.test(p)) return { tag: 'messages', ttl: 0 }
 return undefined
}
export function mutationTags(path: string): string[] {
 const p = new URL(path, 'http://cache.local').pathname
 if (p === '/api/profile/note') return ['notes']
 if (/^\/api\/(friends|contacts|privacy|users)(\/|$)/.test(p)) return ['friends','feed','profiles','stories','conversations','messages','notes']
 if (p.startsWith('/api/profile')) return ['profiles','friends','feed','stories','conversations','messages']
 if (p.startsWith('/api/posts')) return ['feed']
 if (p.startsWith('/api/stories')) return ['stories']
 if (p.startsWith('/api/conversation-categories')) return ['categories','conversations']
 if (/^\/api\/conversations\/\d+\/category$/.test(p)) return ['conversations']
 if (p.startsWith('/api/conversations') || p.startsWith('/api/messages')) return ['messages','conversations']
 return []
}
export class SessionResponseCache {
 private scope = ''
 private entries = new Map<string, Entry & { tag: string }>()
 setScope(scope: string) { if (scope !== this.scope) { for (const entry of this.entries.values()) entry.valid = false; this.entries.clear(); this.scope = scope } }
 clear() { for (const entry of this.entries.values()) entry.valid = false; this.entries.clear(); this.scope = '' }
 invalidate(tags: string[]) {
  for (const [key, entry] of this.entries) if (tags.includes(entry.tag)) { entry.valid = false; this.entries.delete(key) }
 }
 async read(scope: string, path: string, load: () => Promise<Response>, force = false): Promise<Response> {
  this.setScope(scope)
  const rule = policy(path)
  if (!rule || !scope) return load()
  const url = new URL(path, 'http://cache.local')
  url.searchParams.sort()
  const key = url.pathname + url.search
  if (force) { const old = this.entries.get(key); if (old) old.valid = false; this.entries.delete(key) }
  const previous = this.entries.get(key)
  if (previous?.pending) {
   const response = await previous.pending
   if (this.scope !== scope || !previous.valid) throw new Error('Dữ liệu đã thay đổi. Hãy thử lại.')
   return response.clone()
  }
  if (previous?.response && previous.expires > Date.now()) return previous.response.clone()
  const entry: Entry & { tag: string } = { valid: true, expires: 0, tag: rule.tag }
  this.entries.set(key, entry)
  const pending = load().then(async response => {
   if (this.scope === scope && this.entries.get(key) === entry && response.ok && response.headers.get('content-type')?.includes('application/json')) {
    const size = (await response.clone().text()).length
    if (size <= 1_000_000 && rule.ttl > 0) { entry.response = response.clone(); entry.expires = Date.now() + rule.ttl }
   }
   return response
  })
  entry.pending = pending
  try {
   const response = await pending
   if (this.scope !== scope || !entry.valid) throw new Error('Dữ liệu đã thay đổi. Hãy thử lại.')
   return response.clone()
  }
  finally {
   if (this.entries.get(key) === entry) {
    entry.pending = undefined
    if (!entry.response) this.entries.delete(key)
   }
   while (this.entries.size > 100) {
    const evict = [...this.entries].find(([, value]) => !value.pending)
    if (!evict) break
    this.entries.delete(evict[0])
   }
  }
 }
}