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
  profile, relation, friendBusy, action, request, onMessage, onFriendAction, onRemoveFriendAction,
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
    <section className="visitor-hero relative min-w-0 rounded-b-2xl border border-[#e8ecf7] bg-white max-[900px]:rounded-3xl">
      <div className="visitor-cover">
        <div className="visitor-cover-art" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        {profile.coverSet && <img src={profileAssetUrl(profile.username, 'cover', profile.updatedAt)} alt="Ảnh bìa" onError={event => { event.currentTarget.hidden = true }} />}
        <span>Khoảnh khắc và những câu chuyện</span>
      </div>
      <div className="visitor-identity">
        <div className="visitor-avatar-wrap">
          <div className="profile-note-avatar">
            <UserAvatar username={profile.username} name={userLabel(profile.displayName, profile.username)} className="profile-avatar" />
            <ProfileNote username={profile.username} request={request} refreshKey={relation} />
          </div>
        </div>
        <div className="visitor-person min-w-0 self-center pt-[22px] max-[900px]:pt-0">
          <h1>{userLabel(profile.displayName, profile.username)}</h1>
          <p className="visitor-handle">@{profile.username}{profile.city && <span className="visitor-city inline-flex items-center gap-1"> · <MapPin size={14} aria-hidden="true" />{profile.city}</span>}</p>
          {profile.bio && <p className="visitor-profile-bio">{profile.bio}</p>}
          {!profile.allowFriendRequests && relation === 'none' && <small>Tài khoản này đang tắt nhận lời mời kết bạn.</small>}
        </div>
        <div className="visitor-actions flex items-center gap-2.5 self-center justify-self-end pt-5 min-[901px]:max-[1100px]:col-start-2 min-[901px]:max-[1100px]:justify-self-start min-[901px]:max-[1100px]:pt-0 max-[900px]:col-start-1 max-[900px]:w-full max-[900px]:justify-self-stretch max-[900px]:pt-2">
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
      <nav className="visitor-tabs flex gap-1 overflow-x-auto border-t border-[#e8ecf7] px-6 [scrollbar-width:thin] max-[900px]:px-3 max-[900px]:py-2" aria-label="Nội dung hồ sơ">
        {tabs.map(tab => <button key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined}
          onClick={() => onTabChange(tab.id)}>{tab.label}</button>)}
      </nav>
    </section>
  )
}