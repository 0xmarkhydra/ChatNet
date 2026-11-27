import { useUiTranslation } from '@/shared/i18n/locale'
import { useState, type ReactNode, type RefObject } from 'react'
import { BriefcaseBusiness, GraduationCap, MapPin } from 'lucide-react'

type Props = {
  displayName: string
  username: string
  city?: string
  workplace?: string
  school?: string
  friendCount?: number
  coverUrl?: string
  fallbackCoverTone?: number
  coverAction?: ReactNode
  avatar: ReactNode
  actions?: ReactNode
  identityNotice?: ReactNode
  desktopMasthead?: boolean
  compact?: boolean
  centered?: boolean
  bio?: string
  headingRef?: RefObject<HTMLHeadingElement | null>
  note?: ReactNode
}

export default function ProfileHero({ displayName, username, city, workplace, school, friendCount, coverUrl, fallbackCoverTone, coverAction, avatar, actions, identityNotice, desktopMasthead = false, compact = false, centered = false, bio, headingRef, note }: Props) {
  const trUi = useUiTranslation()
  const [failedCover, setFailedCover] = useState<string>()
  const showCover = coverUrl && coverUrl !== failedCover
  const coverClass = showCover ? 'has-user-cover' : fallbackCoverTone === undefined ? 'has-default-cover' : `has-account-cover avatar-tone-${fallbackCoverTone}`
  const details = [
    { id: 'city', text: city?.trim(), label: trUi('profile.placeOfResidence'), Icon: MapPin },
    { id: 'workplace', text: workplace?.trim(), label: trUi('profile.workplace'), Icon: BriefcaseBusiness },
    { id: 'school', text: school?.trim(), label: trUi('profile.school'), Icon: GraduationCap },
  ].filter(detail => detail.text)
  if (centered) {
    return (
      <section className="profile-mobile-full-hero relative mx-auto w-full min-w-0 shrink-0 bg-card">
        <div className={`relative h-[250px] w-full overflow-hidden bg-[image:var(--soco-avatar-gradient)] ${coverClass}`}>
          {showCover && <img className="block size-full object-cover" src={coverUrl} alt={trUi("profile.cover")} draggable={false} onError={() => setFailedCover(coverUrl)} />}
          <div className="absolute inset-x-0 top-28 z-10">{note}</div>
          {coverAction}
        </div>
        <div className="relative -mt-7 grid min-w-0 justify-items-center gap-ui-2 rounded-t-[28px] bg-card px-ui-4 pb-ui-3 text-center">
          <div className="relative -mt-22 box-border size-[180px] rounded-full bg-card p-[5px]" data-profile-avatar-wrap>{avatar}</div>
          <div className="min-w-0 max-w-full wrap-anywhere">
            <h1 ref={headingRef} tabIndex={-1} className="m-0 text-[26px]! leading-tight! font-bold! tracking-[-0.5px] text-foreground! focus:outline-none">{displayName}</h1>
            <p className="m-0 mt-ui-1 text-ui-body! text-muted-foreground!">@{username}</p>
            {friendCount !== undefined && friendCount > 0 && <p className="m-0 mt-ui-1 text-ui-body! font-semibold! text-foreground!">{trUi('profile.heroFriendCount', { count: friendCount })}</p>}
            {bio?.trim() && <p className="m-0 mt-ui-3 text-[15px]! leading-normal! text-foreground!">{bio}</p>}
            {identityNotice}
          </div>
          {actions && <div className="mt-ui-2 grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-ui-2 max-[340px]:grid-cols-1">{actions}</div>}
        </div>
      </section>
    )
  }
  return (
    <section className={'profile-page-hero' + (compact ? ' profile-page-hero-compact' : '') + (desktopMasthead ? ' app-desktop:max-w-none! app-desktop:border-0! app-desktop:rounded-none! app-desktop:bg-card! app-desktop:shadow-none!' : '')}>
      <div className={`profile-page-cover ${coverClass} ${desktopMasthead ? "app-desktop:mx-auto app-desktop:h-[clamp(260px,23vw,400px)]! app-desktop:max-w-[1060px] app-desktop:rounded-b-ui-md! app-desktop:bg-secondary! app-desktop:bg-none!" : ""}`}>
        {desktopMasthead && !showCover && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/50 to-transparent" />}
        {showCover && <img src={coverUrl} alt={trUi("profile.cover")} draggable={false} onError={() => setFailedCover(coverUrl)} />}
        {coverAction}
      </div>
      <div className={`profile-page-hero-bottom ${desktopMasthead ? "app-desktop:mx-auto app-desktop:max-w-[1024px] app-desktop:items-start! app-desktop:gap-ui-4! app-desktop:px-ui-4! app-desktop:py-ui-6!" : ""}`}>
        <div className={`profile-page-avatar-wrap ${desktopMasthead ? "app-desktop:size-[180px]! app-desktop:p-0! app-desktop:shadow-none!" : ""}`}>{note}{avatar}</div>
        <div className={`profile-page-identity-text ${desktopMasthead ? "app-desktop:mt-ui-4!" : ""}`}>
          <h1 className={desktopMasthead ? "app-desktop:text-[32px]! app-desktop:font-bold! app-desktop:text-foreground!" : undefined}>{displayName}</h1>
          <div className="profile-page-identity-summary">
            {!desktopMasthead && <div className="profile-page-identity-meta">@{username}</div>}
            {friendCount !== undefined && friendCount > 0 &&
              <p className="profile-page-friend-summary">{trUi('profile.heroFriendCount', { count: friendCount })}</p>}
          </div>
          {desktopMasthead && bio?.trim() && <p className="m-0 mt-ui-1 text-ui-body font-normal text-foreground">{bio}</p>}
          {details.length > 0 && <ul role="list" className="profile-page-identity-details mt-[5px] flex list-none flex-wrap gap-x-3 gap-y-[5px] p-0 text-sm leading-[1.45] text-muted-foreground">
            {details.map(({ id, text, label, Icon }) => <li key={id} className="flex min-w-0 max-w-full items-start gap-[5px]">
              <Icon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className={`min-w-0 break-words ${desktopMasthead ? "app-desktop:font-semibold app-desktop:text-foreground" : ""}`}><span className="sr-only">{label}: </span>{desktopMasthead && id === "city" && text ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="text-inherit no-underline hover:underline focus-visible:underline">{text}</a> : text}</span>
            </li>)}
          </ul>}
          {identityNotice}
        </div>
        {actions && <div className={`profile-page-hero-actions ${desktopMasthead ? "app-desktop:mt-ui-4! app-desktop:justify-end" : ""}`}>{actions}</div>}
      </div>
    </section>
  )
}