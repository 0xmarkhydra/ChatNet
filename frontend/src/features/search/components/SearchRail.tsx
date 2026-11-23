import { useId } from 'react'
import { UsersRound } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { useRailData } from '../hooks/useRailData'
import { avatar, card, cardTitle, iconTile, rowCopy, rowMeta, rowTitle } from './ui'

export type SearchRailProps = {
  data: ReturnType<typeof useRailData>
  className?: string
  onOpenProfile: (username: string, title: string) => void
  onOpenCommunity: (name: string) => void
}

const ROWS = 4
const item = 'flex items-center gap-ui-3 py-ui-2 [&+&]:border-t [&+&]:border-border'

function RailSkeleton() {
  return (
    <div className="grid gap-ui-2" aria-hidden="true">
      {[0, 1, 2].map(index => <Skeleton key={index} className="h-12" />)}
    </div>
  )
}

/** Suggested people and public communities; a section that fails or is empty is left out rather than shown as an error. */
export default function SearchRail({ data, className, onOpenProfile, onOpenCommunity }: SearchRailProps) {
  const idPrefix = useId()
  const people = data.people.items.slice(0, ROWS)
  const communities = data.communities.items.slice(0, ROWS)
  const showPeople = data.people.loading || people.length > 0
  const showCommunities = data.communities.loading || communities.length > 0
  if (!showPeople && !showCommunities) return null

  return (
    <aside className={cn('grid content-start gap-ui-3', className)} aria-label="Gợi ý cho bạn">
      {showPeople && (
        <section className={card} aria-labelledby={idPrefix + 'people'}>
          <h2 id={idPrefix + 'people'} className={cn(cardTitle, 'mb-ui-3')}>Gợi ý kết nối</h2>
          {data.people.loading ? <RailSkeleton /> : (
            <ul className="m-0 grid list-none p-0">
              {people.map(person => (
                <li key={person.id} className={item}>
                  <UserAvatar name={person.displayName || person.username} username={person.username} className={avatar} />
                  <div className={rowCopy}>
                    <strong className={rowTitle}>{person.displayName || person.username}</strong>
                    <small className={rowMeta}>{person.reason}</small>
                  </div>
                  <Button variant="secondary" size="sm" className="text-primary max-lg:h-11" onClick={() => onOpenProfile(person.username, person.displayName || person.username)}>Xem</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {showCommunities && (
        <section className={card} aria-labelledby={idPrefix + 'communities'}>
          <h2 id={idPrefix + 'communities'} className={cn(cardTitle, 'mb-ui-3')}>Cộng đồng nổi bật</h2>
          {data.communities.loading ? <RailSkeleton /> : (
            <ul className="m-0 grid list-none p-0">
              {communities.map(community => (
                <li key={community.id} className={item}>
                  <span className={iconTile} aria-hidden="true"><UsersRound size={22} /></span>
                  <div className={rowCopy}>
                    <strong className={rowTitle}>{community.name}</strong>
                    <small className={rowMeta}>{community.memberCount.toLocaleString('vi-VN')} thành viên</small>
                  </div>
                  <Button variant="secondary" size="sm" className="text-primary max-lg:h-11" onClick={() => onOpenCommunity(community.name)}>Xem</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </aside>
  )
}
