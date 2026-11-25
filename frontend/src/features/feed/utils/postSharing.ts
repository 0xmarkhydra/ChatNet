import { feedPostPath } from '../../../shared/utils/feedPostPath'

export function postShareUrl(
  id: number,
  location: Pick<Location, 'origin' | 'protocol'> = window.location,
  source?: 'chat',
): string {
  const { origin, protocol } = location
  const webOrigin = protocol === 'https:' || protocol === 'http:' ? origin : 'https://chat.codelocal.cloud'
  return new URL(feedPostPath(id, { ref: 'share', source }), webOrigin).href
}
