import { feedPostPath } from '../../../shared/utils/feedPostPath'

export function postShareUrl(id: number, location: Pick<Location, 'origin' | 'protocol'> = window.location): string {
  const { origin, protocol } = location
  const webOrigin = protocol === 'https:' || protocol === 'http:' ? origin : 'https://chat.codelocal.cloud'
  const url = new URL(feedPostPath(id), webOrigin)
  url.searchParams.set('ref', 'share')
  return url.href
}
