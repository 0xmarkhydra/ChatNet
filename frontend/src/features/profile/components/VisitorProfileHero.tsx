import { MessageCircle, UserPlus, UserMinus, UserCheck } from 'lucide-react'
import UserAvatar, { profileAssetUrl } from '../../../shared/ui/UserAvatar'
import { userLabel } from '../../../shared/utils/userLabel'
import type { FriendSearchResult } from '../../contacts/types'
import ProfileNote from './ProfileNote'

export type VisitorProfileData = FriendSearchResult & { avatarSet: boolean; coverSet: boolean; updatedAt: string; allowFriendRequests: boolean; bio?: string; city?: string }

type Props = {
  profile: VisitorProfileData
  relation: string
  friendBusy: number | null
  action: string
  request: (path: string, init?: RequestInit) => Promise<Response>
  onMessage: (username: string) => Promise<void>
  onFriendAction: () => void
}

export default function VisitorProfileHero({ profile, relation, friendBusy, action, request, onMessage, onFriendAction }: Props) {
  return (
    <section className="visitor-hero">
     <div className="visitor-cover">{profile.coverSet&&<img src={profileAssetUrl(profile.username,'cover',profile.updatedAt)} alt="Ảnh bìa" onError={event=>{event.currentTarget.hidden=true}}/>}<span>Khoảnh khắc và những câu chuyện</span></div>
     <div className="visitor-identity"><div className="profile-note-avatar"><UserAvatar username={profile.username} name={userLabel(profile.displayName,profile.username)} className="profile-avatar"/><ProfileNote username={profile.username} request={request} refreshKey={relation}/></div><h1>{userLabel(profile.displayName,profile.username)}</h1><p>@{profile.username}</p>
      {profile.bio && <p className="visitor-profile-bio">{profile.bio}</p>}
      {profile.city && <small className="visitor-profile-city">{profile.city}</small>}
      <div className="visitor-actions"><button type="button" onClick={()=>void onMessage(profile.username)}><MessageCircle size={18}/>Nhắn tin</button>
       <button type="button" disabled={relation==='accepted'||friendBusy===profile.id||(!profile.allowFriendRequests&&relation==='none')} onClick={onFriendAction}>{relation==='outgoing'?<UserMinus size={18}/>:relation==='accepted'||relation==='incoming'?<UserCheck size={18}/>:<UserPlus size={18}/>} {action}</button></div>
      {!profile.allowFriendRequests&&relation==='none'&&<small>Tài khoản này đang tắt nhận lời mời kết bạn.</small>}
     </div>
    </section>
  )
}
