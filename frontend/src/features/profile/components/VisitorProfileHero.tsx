import { useEffect, useRef, useState } from 'react'
import { ChevronDown, MessageCircle, UserPlus, UserMinus, UserCheck } from 'lucide-react'
import UserAvatar, { profileAssetUrl } from '../../../shared/ui/UserAvatar'
import { userLabel } from '../../../shared/utils/userLabel'
import type { FriendSearchResult } from '../../contacts/types'
import ProfileNote from './ProfileNote'

export type VisitorProfileData = FriendSearchResult & {
  avatarSet: boolean
  coverSet: boolean
  updatedAt: string
  allowFriendRequests: boolean
  bio?: string
  city?: string
}

type Props = {
  profile: VisitorProfileData
  relation: string
  friendBusy: number | null
  action: string
  request: (path: string, init?: RequestInit) => Promise<Response>
  onMessage: (username: string) => Promise<void>
  onFriendAction: () => void
  onRemoveFriendAction: () => void
}

export default function VisitorProfileHero({
  profile, relation, friendBusy, action, request, onMessage, onFriendAction, onRemoveFriendAction,
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

  return (
    <section className="visitor-hero">
      <div className="visitor-cover">
        {profile.coverSet && <img src={profileAssetUrl(profile.username, 'cover', profile.updatedAt)} alt="Ảnh bìa" onError={event => { event.currentTarget.hidden = true }} />}
        <span>Khoảnh khắc và những câu chuyện</span>
      </div>
      <div className="visitor-identity">
        <div className="profile-note-avatar">
          <UserAvatar username={profile.username} name={userLabel(profile.displayName, profile.username)} className="profile-avatar" />
          <ProfileNote username={profile.username} request={request} refreshKey={relation} />
        </div>
        <h1>{userLabel(profile.displayName, profile.username)}</h1>
        <p>@{profile.username}</p>
        {profile.bio && <p className="visitor-profile-bio">{profile.bio}</p>}
        {profile.city && <small className="visitor-profile-city">{profile.city}</small>}
        <div className="visitor-actions">
          <button type="button" onClick={() => void onMessage(profile.username)}><MessageCircle size={18} />Nhắn tin</button>
          {relation === 'accepted' ? (
            <div
              className="visitor-friend-menu"
              ref={friendMenuRef}
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMenuForUserId(null)
              }}
              onKeyDown={event => {
                if (event.key !== 'Escape' || !friendMenuOpen) return
                event.preventDefault()
                event.stopPropagation()
                setMenuForUserId(null)
                friendMenuTrigger.current?.focus()
              }}
            >
              <button
                ref={friendMenuTrigger}
                type="button"
                aria-haspopup="menu"
                aria-expanded={friendMenuOpen}
                disabled={friendBusy === profile.id}
                onClick={() => setMenuForUserId(current => current === profile.id ? null : profile.id)}
              ><UserCheck size={18} />Bạn bè<ChevronDown size={16} /></button>
              {friendMenuOpen && (
                <div className="visitor-friend-popover" role="menu" aria-label="Tùy chọn bạn bè">
                  <button role="menuitem" type="button" disabled={friendBusy === profile.id} onClick={() => {
                    setMenuForUserId(null)
                    onRemoveFriendAction()
                  }}><UserMinus size={18} />Hủy kết bạn</button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={friendBusy === profile.id || (!profile.allowFriendRequests && relation === 'none')}
              onClick={onFriendAction}
            >
              {relation === 'outgoing' ? <UserMinus size={18} /> : relation === 'incoming' ? <UserCheck size={18} /> : <UserPlus size={18} />}
              {action}
            </button>
          )}
        </div>
        {!profile.allowFriendRequests && relation === 'none' && <small>Tài khoản này đang tắt nhận lời mời kết bạn.</small>}
      </div>
    </section>
  )
}
