import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, MessageCircle, UserPlus, UserMinus, UserCheck } from 'lucide-react'
import UserAvatar, { profileAssetUrl, avatarTone } from '../../../shared/ui/UserAvatar'
import { userLabel } from '../../../shared/utils/userLabel'
import type { FriendSearchResult } from '../../contacts'
import ProfileNote from './ProfileNote'
import ProfileHero from './ProfileHero'

export type VisitorProfileData = FriendSearchResult & {
  avatarSet: boolean
  coverSet: boolean
  updatedAt: string
  allowFriendRequests: boolean
  bio?: string
  city?: string
  workplace?: string
  school?: string
  friendCount?: number
}

type Props = {
  mobile?: boolean
  profile: VisitorProfileData
  online?: boolean
  relation: string
  friendBusy: number | null
  action: string
  request: (path: string, init?: RequestInit) => Promise<Response>
  onMessage: (username: string) => Promise<void>
  onFriendAction: () => void
  onRemoveFriendAction: () => void
}

export default function VisitorProfileHero({
  profile, mobile = false, online = false, relation, friendBusy, action, request, onMessage, onFriendAction, onRemoveFriendAction,
}: Props) {
  const trUi = useUiTranslation()

  const [menuForUserId, setMenuForUserId] = useState<number | null>(null)
  const friendMenuOpen = relation === 'accepted' && menuForUserId === profile.id
  const friendMenuRef = useRef<HTMLDivElement>(null)
  const friendMenuTrigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!friendMenuOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!friendMenuRef.current?.contains(event.target as Node)) setMenuForUserId(null)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
  }, [friendMenuOpen])

  const displayName = userLabel(profile.displayName, profile.username)
  const buttonClass = 'flex min-h-control-touch w-full min-w-0 items-center justify-center gap-ui-1 rounded-ui-md border-0 px-ui-2 text-[14px] font-bold whitespace-normal disabled:opacity-50'
  const primary = mobile ? buttonClass + ' bg-primary text-white' : 'profile-page-primary'
  const secondary = mobile ? buttonClass + ' bg-secondary text-foreground' : 'profile-page-secondary'
  return <ProfileHero centered={mobile} bio={mobile ? profile.bio : undefined} fallbackCoverTone={mobile ? avatarTone(displayName) : undefined}
    note={mobile ? <ProfileNote username={profile.username} request={request} refreshKey={relation} /> : undefined} displayName={displayName} username={profile.username} city={profile.city}
    workplace={profile.workplace} school={profile.school} friendCount={profile.friendCount}
    coverUrl={profile.coverSet ? profileAssetUrl(profile.username, 'cover', profile.updatedAt) : undefined}
    avatar={<>
      <UserAvatar username={profile.username} name={displayName} className={mobile ? "avatar profile-hero-avatar size-full! rounded-full! text-5xl font-bold [&>.presence-dot]:right-auto! [&>.presence-dot]:left-2!" : "profile-page-avatar profile-hero-avatar"} online={online} />
      {online && <span className="sr-only">{trUi("profile.active")}</span>}
      {!mobile && <ProfileNote username={profile.username} request={request} refreshKey={relation} />}
    </>}
    identityNotice={!profile.allowFriendRequests && relation === 'none' && <small className="profile-page-hint">Tài khoản này đang tắt nhận lời mời kết bạn.</small>}
    actions={<>
          {relation === 'accepted' ? (
            <div className="visitor-friend-menu" ref={friendMenuRef}
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMenuForUserId(null)
              }}
              onKeyDown={event => {
                if (event.key !== 'Escape' || !friendMenuOpen) return
                event.preventDefault()
                event.stopPropagation()
                setMenuForUserId(null)
                friendMenuTrigger.current?.focus()
              }}>
              <button ref={friendMenuTrigger} type="button" className={secondary}
                aria-haspopup="menu" aria-expanded={friendMenuOpen} disabled={friendBusy === profile.id}
                onClick={() => setMenuForUserId(current => current === profile.id ? null : profile.id)}>
                <UserCheck size={18} aria-hidden="true" />{trUi("contacts.friends")}<ChevronDown size={16} aria-hidden="true" />
              </button>
              {friendMenuOpen && (
                <div className="visitor-friend-popover" role="menu" aria-label={trUi("common.ui.friendOptions")}>
                  <button role="menuitem" type="button" disabled={friendBusy === profile.id} onClick={() => {
                    setMenuForUserId(null)
                    onRemoveFriendAction()
                  }}><UserMinus size={18} aria-hidden="true" />{trUi("contacts.unfriend")}</button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className={relation === 'outgoing' ? secondary : primary}
              disabled={friendBusy === profile.id || (!profile.allowFriendRequests && relation === 'none')}
              onClick={onFriendAction}>
              {relation === 'outgoing' ? <UserMinus size={18} aria-hidden="true" /> : relation === 'incoming' ? <UserCheck size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
              {action}
            </button>
          )}
          <button type="button" className={relation === 'accepted' || relation === 'outgoing' ? primary : secondary} onClick={() => void onMessage(profile.username)}>
            <MessageCircle size={18} aria-hidden="true" />{trUi("chat.message")}</button>
    </>} />
}