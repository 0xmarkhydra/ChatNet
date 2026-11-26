import type { ApiRequest } from '../../../shared/types/api'
import { searchCommunities, searchPeople } from '../api/search'
import { foldText } from '../lib/searchFilters'
import type { SearchHistory } from '../lib/searchHistory'
import { useRemoteList } from './useRemoteList'

export type SuggestConfig = {
  history: SearchHistory
  request: ApiRequest
  sessionId: string
  onQuery: (query: string) => void
  onPerson: (username: string, title: string) => void
  onCommunity: (name: string) => void
}

export type Suggestion =
  | { id: string; kind: 'query'; query: string; fromHistory: boolean }
  | { id: string; kind: 'person'; username: string; title: string }
  | { id: string; kind: 'community'; name: string; subtitle: string }

const DEBOUNCE_MS = 250
const MIN_REMOTE_LENGTH = 2

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
  })
}

/**
 * Suggestions for a draft: the draft itself, the user's own matching past searches, and (after a short
 * pause) matching people and public communities. Remote lookups only run while `enabled`.
 */
export function useSuggestions(config: SuggestConfig | undefined, draft: string, enabled: boolean): Suggestion[] {
  const term = draft.trim()
  const remote = Boolean(config) && enabled && term.length >= MIN_REMOTE_LENGTH
  const people = useRemoteList(remote ? JSON.stringify([config?.sessionId, 'suggest-people', term]) : '',
    async signal => { await wait(DEBOUNCE_MS, signal); return (await searchPeople(config!.request, term, signal)).slice(0, 3) }, 'people')
  const communities = useRemoteList(remote ? JSON.stringify([config?.sessionId, 'suggest-communities', term]) : '',
    async signal => { await wait(DEBOUNCE_MS, signal); return (await searchCommunities(config!.request, term, signal)).slice(0, 2) }, 'communities')

  if (!config || !enabled || !term) return []
  const folded = foldText(term)
  const seen = new Set([folded])
  const past: string[] = []
  for (const query of [...config.history.saved.map(item => item.query), ...config.history.recent]) {
    const key = foldText(query)
    if (seen.has(key) || !key.includes(folded)) continue
    seen.add(key)
    past.push(query)
  }
  return [
    { id: 'q-0', kind: 'query', query: term, fromHistory: false },
    ...past.slice(0, 3).map((query, index): Suggestion => ({ id: 'q-' + (index + 1), kind: 'query', query, fromHistory: true })),
    ...people.items.map((person): Suggestion => ({ id: 'p-' + person.id, kind: 'person', username: person.username, title: person.displayName || person.username })),
    ...communities.items.map((community): Suggestion => ({
      id: 'c-' + community.id, kind: 'community', name: community.name, subtitle: community.memberCount.toLocaleString('vi-VN') + ' thành viên',
    })),
  ]
}
