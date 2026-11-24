import type { ApiRequest } from '../../../shared/types/api'
import { listPopularCommunities, listSuggestedPeople } from '../api/search'
import { useRemoteList } from './useRemoteList'

/** Discovery content shown beside the results; independent of the query, so it is loaded once per session. */
export function useRailData(request: ApiRequest, sessionId: string, enabled: boolean) {
  const people = useRemoteList(enabled ? JSON.stringify([sessionId, 'rail-people']) : '',
    signal => listSuggestedPeople(request, signal), 'Không thể tải gợi ý kết nối.')
  const communities = useRemoteList(enabled ? JSON.stringify([sessionId, 'rail-communities']) : '',
    signal => listPopularCommunities(request, signal), 'Không thể tải cộng đồng.')
  return { people, communities }
}
