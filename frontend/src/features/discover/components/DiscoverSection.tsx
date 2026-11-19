import type { DiscoverSectionProps } from '../types'
import ExplorePage from './ExplorePage'

export type { DiscoverSectionProps } from '../types'
export default function DiscoverSection(props: DiscoverSectionProps) {
  return <ExplorePage key={props.sessionId} {...props} />
}
