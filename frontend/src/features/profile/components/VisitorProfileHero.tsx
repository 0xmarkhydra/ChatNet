import { useEffect, useRef, useState } from 'react'
import { ChevronDown, MessageCircle, UserPlus, UserMinus, UserCheck } from 'lucide-react'
import UserAvatar, { profileAssetUrl } from '../../../shared/ui/UserAvatar'
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
  profile, online = false, relation, friendBusy, action, request, onMessage, onFriendAction, onRemoveFriendAction,
}: Props) {
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
  return <ProfileHero displayName={displayName} username={profile.username}
    friendCount={profile.friendCount}
    coverUrl={profile.coverSet ? profileAssetUrl(profile.username, 'cover', profile.updatedAt) : undefined}
    avatar={<>
      <UserAvatar username={profile.username} name={displayName} className="profile-page-avatar profile-hero-avatar" online={online} />
      {online && <span className="sr-only">Đang hoạt động</span>}
      <ProfileNote username={profile.username} request={request} refreshKey={relation} />
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
              <button ref={friendMenuTrigger} type="button" className="profile-page-secondary"
                aria-haspopup="menu" aria-expanded={friendMenuOpen} disabled={friendBusy === profile.id}
                onClick={() => setMenuForUserId(current => current === profile.id ? null : profile.id)}>
                <UserCheck size={18} aria-hidden="true" />Bạn bè<ChevronDown size={16} aria-hidden="true" />
              </button>
              {friendMenuOpen && (
                <div className="visitor-friend-popover" role="menu" aria-label="Tùy chọn bạn bè">
                  <button role="menuitem" type="button" disabled={friendBusy === profile.id} onClick={() => {
                    setMenuForUserId(null)
                    onRemoveFriendAction()
                  }}><UserMinus size={18} aria-hidden="true" />Hủy kết bạn</button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className={relation === 'outgoing' ? 'profile-page-secondary' : 'profile-page-primary'}
              disabled={friendBusy === profile.id || (!profile.allowFriendRequests && relation === 'none')}
              onClick={onFriendAction}>
              {relation === 'outgoing' ? <UserMinus size={18} aria-hidden="true" /> : relation === 'incoming' ? <UserCheck size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
              {action}
            </button>
          )}
          <button type="button" className={relation === 'accepted' || relation === 'outgoing' ? 'profile-page-primary' : 'profile-page-secondary'} onClick={() => void onMessage(profile.username)}>
            <MessageCircle size={18} aria-hidden="true" />Nhắn tin
          </button>
    </>} />
}
