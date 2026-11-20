import { useEffect, useRef, useState } from 'react'
import { ChevronDown, MessageCircle, UserPlus, UserMinus, UserCheck, MapPin } from 'lucide-react'
import UserAvatar, { profileAssetUrl } from '../../../shared/ui/UserAvatar'
import { userLabel } from '../../../shared/utils/userLabel'
import type { FriendSearchResult } from '../../contacts'
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
  online?: boolean
  relation: string
  friendBusy: number | null
  action: string
  request: (path: string, init?: RequestInit) => Promise<Response>
  onMessage: (username: string) => Promise<void>
  onFriendAction: () => void
  onRemoveFriendAction: () => void
  tabs: { id: string; label: string }[]
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function VisitorProfileHero({
  profile, online = false, relation, friendBusy, action, request, onMessage, onFriendAction, onRemoveFriendAction,
  tabs, activeTab, onTabChange,
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
        <div className="visitor-cover-art" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        {profile.coverSet && <img src={profileAssetUrl(profile.username, 'cover', profile.updatedAt)} alt="Ảnh bìa" onError={event => { event.currentTarget.hidden = true }} />}
        <span>Khoảnh khắc và những câu chuyện</span>
      </div>
      <div className="visitor-identity">
        <div className="visitor-avatar-wrap">
          <div className="profile-note-avatar">
            <UserAvatar username={profile.username} name={userLabel(profile.displayName, profile.username)} className="profile-avatar profile-hero-avatar" online={online} />
            {online && <span className="sr-only">Đang hoạt động</span>}
            <ProfileNote username={profile.username} request={request} refreshKey={relation} />
          </div>
        </div>
        <div className="visitor-person">
          <h1>{userLabel(profile.displayName, profile.username)}</h1>
          <p className="visitor-handle">@{profile.username}{profile.city && <span className="visitor-city"> · <MapPin size={14} aria-hidden="true" />{profile.city}</span>}</p>
          {profile.bio && <p className="visitor-profile-bio">{profile.bio}</p>}
          {!profile.allowFriendRequests && relation === 'none' && <small>Tài khoản này đang tắt nhận lời mời kết bạn.</small>}
        </div>
        <div className="visitor-actions">
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
              <button ref={friendMenuTrigger} type="button" className="visitor-primary"
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
            <button type="button" className={'visitor-primary' + (relation === 'outgoing' ? ' is-outgoing' : '')}
              disabled={friendBusy === profile.id || (!profile.allowFriendRequests && relation === 'none')}
              onClick={onFriendAction}>
              {relation === 'outgoing' ? <UserMinus size={18} aria-hidden="true" /> : relation === 'incoming' ? <UserCheck size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
              {action}
            </button>
          )}
          <button type="button" className="visitor-message" onClick={() => void onMessage(profile.username)}>
            <MessageCircle size={18} aria-hidden="true" />Nhắn tin
          </button>
        </div>
      </div>
      <nav className="visitor-tabs" aria-label="Nội dung hồ sơ">
        {tabs.map(tab => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined}
          onClick={() => onTabChange(tab.id)}>{tab.label}</button>)}
      </nav>
    </section>
  )
}