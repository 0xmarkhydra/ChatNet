import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { ArrowLeft, ArrowRight, Bell, Check, Clock3, FileText, Image as ImageIcon, MessageCircle, MoreHorizontal, PencilLine, Plus, Search, Send, Settings, ShieldCheck, Users, UserPlus, Video, X } from 'lucide-react'
import type { Conversation, GroupMember, Message } from '../features/chat/types'
import type { QueuedChatMessage } from '../chatOutbox'
import type { FriendConnection } from '../features/contacts/types'
import UserAvatar from '../shared/ui/UserAvatar'
import MediaAttachmentsView from '../shared/ui/MediaAttachmentsView'
import GroupGovernancePanel from '../features/chat/GroupGovernancePanel'
import './community-groups.css'

export type GroupWorkspaceMode = 'list' | 'create' | 'manage' | 'channel'
type ManageTab = 'members' | 'details' | 'permissions' | 'requests' | 'rules' | 'notifications' | 'files' | 'activity'
type CommunityMetadata = { id: number; name: string; description: string; topic: string; rules: string; visibility: 'public' | 'private'; memberCount: number }
type Channel = { id: number; conversationId: number; name: string; description: string }
type NotificationPreferences = { messageNotifications: boolean; mentionNotifications: boolean }
type Props = {
  mode: GroupWorkspaceMode
  onMode: (mode: GroupWorkspaceMode) => void
  groups: Conversation[]
  userId: number
  myName: string
  selectedGroup: Conversation | null
  onSelectGroup: (id: number, mode: 'channel' | 'manage') => void
  onOpenFullChat: () => void
  onCreate: () => void
  onJoinedGroup: (id: number) => Promise<void>
  members: GroupMember[]
  groupBusy: boolean
  activeMember: GroupMember | null
  canManage: boolean
  canInvite: boolean
  canEdit: boolean
  onRename: () => void
  onInvite: () => void
  inviteCandidates: FriendConnection[]
  inviteSelection: number[]
  setInviteSelection: Dispatch<SetStateAction<number[]>>
  inviteSearch: string
  setInviteSearch: (value: string) => void
  onChangeRole: (member: GroupMember, role: GroupMember['role']) => Promise<void>
  onRemoveMember: (member: GroupMember) => Promise<void>
  onOpenMember: (username: string) => void
  onMembersChanged: () => Promise<void>
  request: (path: string, init?: RequestInit) => Promise<Response>
  notify: (message: string) => void
  messages: Message[]
  pendingMessages: QueuedChatMessage[]
  chatOnline: boolean
  onRetryPending: () => void
  messageText: string
  onMessageText: (value: string) => void
  onSend: (event: FormEvent) => void
  canSend: boolean
  onCall: (id: number) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

const nameOf = (item: { username: string; displayName?: string }) => item.displayName || item.username

export default function CommunityGroupsPage({
  mode, onMode, groups, userId, myName, selectedGroup, onSelectGroup, onOpenFullChat, onCreate, onJoinedGroup,
  members, groupBusy, activeMember, canManage, canInvite, canEdit, onRename, onInvite,
  inviteCandidates, inviteSelection, setInviteSelection, inviteSearch, setInviteSearch,
  onChangeRole, onRemoveMember, onOpenMember, onMembersChanged, request, notify,
  messages, pendingMessages, chatOnline, onRetryPending, messageText, onMessageText, onSend, canSend, onCall, hasMore, loadingMore, onLoadMore,
}: Props) {
  const [query, setQuery] = useState('')
  const [manageTab, setManageTab] = useState<ManageTab>('members')
  const [memberQuery, setMemberQuery] = useState('')
  const [menuId, setMenuId] = useState<number | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [metadata, setMetadata] = useState<CommunityMetadata | null>(null)
  const [metadataDraft, setMetadataDraft] = useState({description:'',topic:'',rules:'',visibility:'private' as 'public'|'private'})
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelId] = useState(0)
  const [channelMessages, setChannelMessages] = useState<Message[]>([])
  const [channelError,setChannelError] = useState('')
  const [newChannelName,setNewChannelName] = useState('')
  const [newChannelDescription,setNewChannelDescription] = useState('')
  const [channelBusy,setChannelBusy] = useState(false)
  const [channelDraft,setChannelDraft] = useState('')
  const [channelSendBusy,setChannelSendBusy] = useState(false)
  const [channelUnconfirmed,setChannelUnconfirmed] = useState<{clientId:string;text:string}|null>(null)
  const [preferences,setPreferences] = useState<NotificationPreferences>({messageNotifications:true,mentionNotifications:true})
  const [settingsBusy,setSettingsBusy] = useState(false)
  const [publicGroups,setPublicGroups] = useState<CommunityMetadata[]>([])
  const [publicLoading,setPublicLoading] = useState(false)
  const [joiningId,setJoiningId] = useState<number | null>(null)
  const requestRef=useRef(request)
  requestRef.current=request
  const groupId=selectedGroup?.id ?? null
  useEffect(()=>{
    setMetadata(null)
    setChannels([])
    setActiveChannelId(0)
    setChannelMessages([])
    setChannelDraft('')
    setChannelUnconfirmed(null)
    if(!groupId)return
    let cancelled=false
    const load=async()=>{
      const responses=await Promise.allSettled([
        requestRef.current('/api/conversations/'+groupId+'/community'),
        requestRef.current('/api/conversations/'+groupId+'/channels'),
        requestRef.current('/api/conversations/'+groupId+'/notification-settings'),
      ])
      if(cancelled)return
      if(responses[0].status==='fulfilled'&&responses[0].value.ok){
        const value=await responses[0].value.json() as CommunityMetadata
        if(!cancelled){setMetadata(value);setMetadataDraft({description:value.description,topic:value.topic,rules:value.rules,visibility:value.visibility})}
      }
      if(responses[1].status==='fulfilled'&&responses[1].value.ok){
        const value=await responses[1].value.json() as Channel[]
        if(!cancelled)setChannels(Array.isArray(value)?value:[])
      }
      if(responses[2].status==='fulfilled'&&responses[2].value.ok){
        const value=await responses[2].value.json() as NotificationPreferences
        if(!cancelled)setPreferences(value)
      }
      if(responses.some(item=>item.status==='rejected'||!item.value.ok)) {
        if(!cancelled)notify('Không tải được đầy đủ dữ liệu cộng đồng. Kiểm tra backend.')
      }
    }
    void load()
    return()=>{cancelled=true}
  },[groupId])

  useEffect(()=>{
    if(mode!=='list'){setPublicGroups([]);return}
    const ctrl=new AbortController()
    setPublicLoading(true)
    void requestRef.current('/api/groups/public?limit=30&q='+encodeURIComponent(query),{signal:ctrl.signal}).then(async response=>{
      if(!response.ok)throw new Error('Không tải được nhóm công khai')
      const value=await response.json() as CommunityMetadata[]
      if(!ctrl.signal.aborted)setPublicGroups(Array.isArray(value)?value:[])
    }).catch(()=>{if(!ctrl.signal.aborted)setPublicGroups([])}).finally(()=>{if(!ctrl.signal.aborted)setPublicLoading(false)})
    return()=>ctrl.abort()
  },[mode,query])

  useEffect(()=>{
    setChannelMessages([])
    setChannelError('')
    setChannelUnconfirmed(null)
    if(!groupId||activeChannelId===0)return
    let cancelled=false
    void requestRef.current('/api/conversations/'+groupId+'/messages?channelId='+activeChannelId+'&limit=100')
      .then(async response=>{if(!response.ok)throw new Error('Không tải được tin kênh');return await response.json() as Message[]})
      .then(value=>{if(!cancelled)setChannelMessages(Array.isArray(value)?value:[])})
      .catch(()=>{if(!cancelled)setChannelError('Không tải được tin nhắn. Thử chọn lại kênh.')})
    return()=>{cancelled=true}
  },[groupId,activeChannelId])

  useEffect(()=>{
    if(!groupId)return
    const onChange=(event:Event)=>{
      const id=(event as CustomEvent<{conversationId:number}>).detail?.conversationId
      if(id!==groupId)return
      void requestRef.current('/api/conversations/'+groupId+'/channels').then(async r=>{
        if(r.ok){const value=await r.json() as Channel[];setChannels(Array.isArray(value)?value:[])}
      }).catch(()=>undefined)
    }
    window.addEventListener('chatnet:group-community-updated',onChange)
    return()=>window.removeEventListener('chatnet:group-community-updated',onChange)
  },[groupId])

  useEffect(()=>{
    if(!groupId||activeChannelId===0)return
    const onChannelMessage=(event:Event)=>{
      const detail=(event as CustomEvent<{type:string;message:Message}>).detail
      const m=detail?.message
      if(!m||m.conversationId!==groupId||m.channelId!==activeChannelId)return
      setChannelMessages(current=>[...current.filter(item=>item.id!==m.id),m].sort((a,b)=>a.id-b.id))
      if(m.clientId&&m.senderId===userId)setChannelUnconfirmed(pending=>pending?.clientId===m.clientId?null:pending)
    }
    window.addEventListener('chatnet:group-channel-event',onChannelMessage)
    return()=>window.removeEventListener('chatnet:group-channel-event',onChannelMessage)
  },[groupId,activeChannelId,userId])

  async function joinPublic(id:number) {
    if(joiningId!==null)return
    setJoiningId(id)
    try{
      const response=await request('/api/groups/'+id+'/join',{method:'POST'})
      const result=await response.json().catch(()=>null) as {status?:string;error?:string}|null
      if(!response.ok)throw new Error(result?.error||'Không tham gia được cộng đồng.')
      if(result?.status==='member'){notify('Đã tham gia cộng đồng.');await onJoinedGroup(id)}
      else notify('Đã gửi yêu cầu tham gia. Chờ quản trị viên duyệt.')
    }catch(e){notify(e instanceof Error?e.message:'Không thể tham gia cộng đồng.')}
    finally{setJoiningId(null)}
  }

  async function saveMetadata() {
    if(!groupId||!canEdit||settingsBusy)return
    setSettingsBusy(true)
    try{
      const response=await request('/api/conversations/'+groupId+'/community',{
        method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(metadataDraft)
      })
      const value=await response.json().catch(()=>null) as CommunityMetadata|null
      if(!response.ok||!value)throw new Error('Không cập nhật được thông tin nhóm.')
      setMetadata(value)
      notify('Đã lưu thông tin cộng đồng.')
    }catch(e){notify(e instanceof Error?e.message:'Không lưu được thông tin nhóm.')}
    finally{setSettingsBusy(false)}
  }
  async function savePreferences() {
    if(!groupId||settingsBusy)return
    setSettingsBusy(true)
    try{
      const response=await request('/api/conversations/'+groupId+'/notification-settings',{
        method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(preferences)
      })
      if(!response.ok)throw new Error('Không lưu được tùy chọn thông báo.')
      setPreferences(await response.json() as NotificationPreferences)
      notify('Đã lưu tùy chọn thông báo.')
    }catch(e){notify(e instanceof Error?e.message:'Không thể lưu thông báo.')}
    finally{setSettingsBusy(false)}
  }
  async function refreshChannels(id:number) {
    const response=await request('/api/conversations/'+id+'/channels')
    if(!response.ok)throw new Error('Không tải được kênh')
    const value=await response.json() as Channel[]
    setChannels(value)
  }
  async function createChannel(){
    if(!groupId||!canEdit||channelBusy||!newChannelName.trim())return
    setChannelBusy(true);setChannelError('')
    try{
      const response=await request('/api/conversations/'+groupId+'/channels',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newChannelName.trim(),description:newChannelDescription.trim()})
      })
      const result=await response.json().catch(()=>null) as (Channel&{error?:string})|null
      if(!response.ok||!result?.id)throw new Error(result?.error||'Không tạo được kênh.')
      await refreshChannels(groupId)
      setNewChannelName('');setNewChannelDescription('')
      setActiveChannelId(result.id)
      notify('Đã tạo kênh mới.')
    }catch(e){setChannelError(e instanceof Error?e.message:'Không tạo được kênh.')}
    finally{setChannelBusy(false)}
  }
  async function renameChannel(channel:Channel){
    if(!groupId||channel.id===0||!canEdit)return
    const name=window.prompt('Đổi tên kênh',channel.name)
    if(name===null||!name.trim())return
    setChannelBusy(true)
    try{
      const response=await request('/api/conversations/'+groupId+'/channels/'+channel.id,{
        method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),description:channel.description})
      })
      if(!response.ok)throw new Error('Không đổi được tên kênh.')
      await refreshChannels(groupId)
      notify('Đã đổi tên kênh.')
    }catch{notify('Không đổi được tên kênh.')}
    finally{setChannelBusy(false)}
  }
  async function removeChannel(channel:Channel){
    if(!groupId||!canEdit||channel.id===0||!window.confirm('Xóa kênh trống "'+channel.name+'"?'))return
    setChannelBusy(true)
    try{
      const response=await request('/api/conversations/'+groupId+'/channels/'+channel.id,{method:'DELETE'})
      if(!response.ok)throw new Error('Không thể xóa kênh chứa tin nhắn.')
      await refreshChannels(groupId)
      if(activeChannelId===channel.id)setActiveChannelId(0)
      notify('Đã xóa kênh.')
    }catch(e){notify(e instanceof Error?e.message:'Không thể xóa kênh.')}
    finally{setChannelBusy(false)}
  }
  async function sendChannelMessage(event:FormEvent) {
    event.preventDefault()
    if(!groupId||!activeChannelId||channelSendBusy)return
    const text=(channelUnconfirmed?.text||channelDraft).trim()
    if(!text)return
    const clientId=channelUnconfirmed?.clientId||crypto.randomUUID()
    setChannelSendBusy(true);setChannelError('')
    setChannelUnconfirmed({clientId,text})
    try{
      const response=await request('/api/conversations/'+groupId+'/messages',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text,clientId,channelId:activeChannelId,attachments:[]})
      })
      const result=await response.json().catch(()=>null) as Message|null
      if(!response.ok||!result?.id)throw new Error('Chưa xác nhận được tin nhắn, kiểm tra trước khi gửi lại.')
      setChannelMessages(current=>[...current.filter(m=>m.id!==result.id),result].sort((a,b)=>a.id-b.id))
      setChannelDraft('')
      setChannelUnconfirmed(null)
    }catch(e){setChannelError(e instanceof Error?e.message:'Không gửi được tin nhắn.')}
    finally{setChannelSendBusy(false)}
  }

  const shownGroups = groups.filter(g => g.type==='group' && g.name.toLocaleLowerCase('vi-VN').includes(query.toLocaleLowerCase('vi-VN')))
  const shownMembers = members.filter(m => (m.displayName + ' ' + m.username).toLocaleLowerCase('vi-VN').includes(memberQuery.toLocaleLowerCase('vi-VN')))
  const loadedMessages = selectedGroup ? messages.filter(m=>m.conversationId===selectedGroup.id) : []
  const displayedMessages = activeChannelId===0 ? loadedMessages : channelMessages
  const attachments = displayedMessages.flatMap(m=>m.attachments || [])
  const currentChannel = channels.find(channel=>channel.id===activeChannelId)
  const isAdmin = activeMember?.role==='owner'||activeMember?.role==='admin'
  function select(id: number, next: 'channel'|'manage') {
    setManageTab('members')
    setInviteOpen(false)
    setMenuId(null)
    onSelectGroup(id,next)
  }

  if (mode==='list') return <div className="cg-page" aria-label="Nhóm & cộng đồng">
    <div className="cg-card cg-list-head"><div><span className="cg-eyebrow"><Users size={16}/>CỘNG ĐỒNG SOCCO</span><h2>Nhóm & cộng đồng</h2><p>Tiếp tục trò chuyện và quản trị các nhóm bạn tham gia.</p></div><button type="button" className="cg-primary" onClick={onCreate}><Plus size={18}/>Tạo cộng đồng mới</button></div>
    <div className="cg-list-grid"><section className="cg-card cg-list-card">
      <header className="cg-card-head"><h3>Nhóm của bạn</h3><small>{shownGroups.length} nhóm</small></header>
      <label className="cg-search"><Search size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên nhóm..." aria-label="Tìm nhóm"/></label>
      <div className="cg-group-list">{shownGroups.map(group=><div className="cg-group-row" key={group.id}>
        <span className="cg-group-icon"><Users size={23}/></span><div><strong>{group.name}</strong><small>{group.memberCount} thành viên · {group.unreadCount} tin chưa đọc</small><p>{group.lastMessage||'Bắt đầu trao đổi với nhóm của bạn.'}</p></div>
        <button type="button" className="cg-secondary" onClick={()=>select(group.id,'manage')}><Settings size={16}/>Quản trị</button>
        <button type="button" className="cg-primary" onClick={()=>select(group.id,'channel')}>Mở nhóm<ArrowRight size={16}/></button>
      </div>)}{shownGroups.length===0&&<p className="cg-empty">{query?'Không tìm thấy nhóm phù hợp.':'Chưa có nhóm. Hãy tạo cộng đồng mới hoặc tải thêm.'}</p>}</div>
      {hasMore&&<button type="button" className="cg-secondary" disabled={loadingMore} onClick={onLoadMore}>Tải thêm hội thoại</button>}
    </section><aside className="cg-card cg-list-aside"><ShieldCheck size={32}/><h3>Khám phá cộng đồng công khai</h3><p>Tìm và tham gia các cộng đồng phù hợp. Nhóm yêu cầu phê duyệt sẽ cần quản trị viên đồng ý.</p>
      <div className="cg-public-list">
        {publicGroups.filter(g=>!groups.some(group=>group.id===g.id)).map(g=><article key={g.id} className="cg-public-entry">
          <strong>{g.name}</strong><small>{g.topic||'Cộng đồng'} · {g.memberCount} thành viên</small>
          <p>{g.description||'Cộng đồng công khai trên SocCo.'}</p>
          <button type="button" className="cg-secondary" disabled={joiningId!==null} onClick={()=>void joinPublic(g.id)}><UserPlus size={15}/>Tham gia</button>
        </article>)}
        {!publicLoading&&!publicGroups.length&&<p className="cg-muted">Chưa tìm thấy nhóm công khai.</p>}

      </div>
      <button type="button" className="cg-secondary" onClick={onCreate}>Tạo nhóm mới<ArrowRight size={16}/></button>
    </aside></div>
  </div>

  if (!selectedGroup) return <div className="cg-page"><div className="cg-card cg-empty">Không tìm thấy nhóm. <button type="button" className="cg-secondary" onClick={()=>onMode('list')}>Về danh sách</button></div></div>

  if (mode==='manage') return <div className="cg-page cg-management" aria-label="Quản trị nhóm">
    <header className="cg-card cg-group-banner"><span className="cg-group-icon"><Users size={26}/></span><div><h2>{selectedGroup.name}</h2><p>{metadata?.visibility==='public'?'Nhóm công khai':'Nhóm riêng tư'} · {selectedGroup.memberCount} thành viên</p></div><button type="button" className="cg-secondary" onClick={()=>onMode('list')}><ArrowLeft size={17}/>Danh sách</button>
      {canInvite&&<button className="cg-primary" type="button" onClick={()=>{setManageTab('members');setInviteOpen(true)}}><Plus size={17}/>Mời thành viên</button>}</header>
    <div className="cg-admin-grid">
      <nav className="cg-card cg-admin-nav" aria-label="Quản trị nhóm">
        {([['members','Thành viên',Users],['details','Thông tin cộng đồng',PencilLine],['permissions','Quyền quản trị',ShieldCheck],['requests','Yêu cầu tham gia',Clock3],['rules','Nội quy nhóm',FileText],['notifications','Thông báo',Bell],['files','Tệp đã chia sẻ',ImageIcon],['activity','Nhật ký hoạt động',Settings]] as const).map(([id,label,Icon])=>
          <button type="button" key={id} className={manageTab===id?'active':''} aria-current={manageTab===id?'page':undefined} onClick={()=>{setManageTab(id);setInviteOpen(false)}}><Icon size={19}/>{label}</button>)}
        <button type="button" onClick={()=>onMode('channel')}><MessageCircle size={19}/>Vào trò chuyện</button>
      </nav>
      <section className="cg-card cg-admin-content">
        {manageTab==='members'&&<><h2>Thành viên</h2><p className="cg-muted">{members.length} người · {members.filter(m=>m.role!=='member').length} quản trị viên</p>
          {inviteOpen&&canInvite&&<div className="cg-invite-form"><h3>Mời bạn bè vào nhóm</h3>
            <label className="cg-search"><Search size={17}/><input type="search" aria-label="Tìm bạn để mời" value={inviteSearch} onChange={e=>setInviteSearch(e.target.value)} placeholder="Tìm bạn chưa trong nhóm..."/></label>
            <div className="cg-invite-options">{inviteCandidates.map(friend=><label key={friend.id}><input type="checkbox" checked={inviteSelection.includes(friend.id)} onChange={()=>setInviteSelection(v=>v.includes(friend.id)?v.filter(id=>id!==friend.id):[...v,friend.id])}/>{nameOf(friend)}</label>)}{!inviteCandidates.length&&<p className="cg-muted">Không còn bạn phù hợp để mời.</p>}</div>
            <button type="button" className="cg-primary" disabled={groupBusy||!inviteSelection.length} onClick={onInvite}><UserPlus size={16}/>Mời ({inviteSelection.length})</button><button type="button" className="cg-secondary" onClick={()=>setInviteOpen(false)}>Đóng</button>
          </div>}
          <label className="cg-search"><Search size={18}/><input type="search" aria-label="Tìm thành viên trong nhóm" placeholder="Tìm thành viên" value={memberQuery} onChange={e=>setMemberQuery(e.target.value)}/></label>
          <div className="cg-members-list">{shownMembers.map(member=><article className="cg-member-row" key={member.id}>
            <button type="button" className="cg-member-info" onClick={()=>onOpenMember(member.username)}><UserAvatar username={member.username} name={nameOf(member)} className="avatar cg-avatar" online={member.online}/><span><strong>{member.id===userId?myName:nameOf(member)}</strong><small>{member.role==='owner'?'Chủ nhóm':member.role==='admin'?'Quản trị viên':'Thành viên'}</small></span></button>
            {member.role==='owner'&&<span className="cg-owner-label">Chủ nhóm</span>}
            <div className="cg-menu-wrap"><button type="button" aria-label={'Tùy chọn '+nameOf(member)} aria-expanded={menuId===member.id} onClick={()=>setMenuId(v=>v===member.id?null:member.id)}><MoreHorizontal size={20}/></button>
              {menuId===member.id&&<div className="cg-pop-menu" role="menu">
                <button role="menuitem" type="button" onClick={()=>{setMenuId(null);onOpenMember(member.username)}}>Xem hồ sơ</button>
                {canManage&&member.role!=='owner'&&<>
                  <button role="menuitem" type="button" disabled={groupBusy} onClick={()=>{setMenuId(null);void onChangeRole(member,member.role==='admin'?'member':'admin')}}>{member.role==='admin'?'Gỡ quản trị':'Cấp quyền quản trị'}</button>
                  {activeMember?.role==='owner'&&<button role="menuitem" disabled={groupBusy} type="button" onClick={()=>{setMenuId(null);void onChangeRole(member,'owner')}}>Chuyển quyền chủ nhóm</button>}
                  <button role="menuitem" disabled={groupBusy} type="button" onClick={()=>{setMenuId(null);void onRemoveMember(member)}}>Xóa khỏi nhóm</button>
                </>}
                {member.id===userId&&<button role="menuitem" type="button" disabled={groupBusy} onClick={()=>{setMenuId(null);void onRemoveMember(member)}}>Rời nhóm</button>}
              </div>}</div>
          </article>)}{!members.length&&<p className="cg-muted">Đang tải thành viên hoặc danh sách trống.</p>}</div>
        </>}
        {manageTab==='details'&&<><h2>Thông tin cộng đồng</h2><p className="cg-muted">Mô tả và chủ đề được lưu vào PostgreSQL.</p>
          <div className="cg-admin-edit">
            <label>Mô tả<textarea aria-label="Mô tả cộng đồng" maxLength={500} rows={4} disabled={!canEdit||settingsBusy} value={metadataDraft.description} onChange={e=>setMetadataDraft(v=>({...v,description:e.target.value}))}/></label>
            <label>Chủ đề<input aria-label="Chủ đề cộng đồng" maxLength={100} disabled={!canEdit||settingsBusy} value={metadataDraft.topic} onChange={e=>setMetadataDraft(v=>({...v,topic:e.target.value}))}/></label>
            <label>Quyền truy cập<select aria-label="Quyền truy cập cộng đồng" disabled={!canEdit||settingsBusy} value={metadataDraft.visibility} onChange={e=>setMetadataDraft(v=>({...v,visibility:e.target.value as 'private'|'public'}))}><option value="private">Riêng tư</option><option value="public">Công khai</option></select></label>
            {canEdit&&<button type="button" className="cg-primary" disabled={settingsBusy} onClick={()=>void saveMetadata()}><Check size={17}/>Lưu thông tin</button>}
          </div>
        </>}
        {(['permissions','requests','activity'] as ManageTab[]).includes(manageTab)&&<>
          <h2>{manageTab==='permissions'?'Quyền quản trị':manageTab==='requests'?'Yêu cầu tham gia':'Nhật ký hoạt động'}</h2>
          {activeMember&&isAdmin?<GroupGovernancePanel key={selectedGroup.id} conversationId={selectedGroup.id} role={activeMember.role} section={manageTab as 'permissions' | 'requests' | 'activity'} request={request} notify={notify} onMembersChanged={onMembersChanged}/>:<p className="cg-muted">Chỉ chủ nhóm hoặc quản trị viên được truy cập mục này.</p>}
        </>}
        {manageTab==='files'&&<><h2>Tệp đã chia sẻ</h2><p className="cg-muted">Tệp trong tin nhắn nhóm đã tải.</p>{attachments.length?<MediaAttachmentsView items={attachments}/>:<p className="cg-empty">Chưa có tệp đính kèm.</p>}</>}
        {manageTab==='rules'&&<><h2>Nội quy nhóm</h2><p className="cg-muted">Các thành viên được xem nội quy; chủ nhóm và quản trị viên được quyền chỉnh sửa.</p>
          <div className="cg-admin-edit"><label>Nội quy<textarea aria-label="Nội quy cộng đồng" rows={10} maxLength={5000} disabled={!canEdit||settingsBusy} value={metadataDraft.rules} onChange={e=>setMetadataDraft(v=>({...v,rules:e.target.value}))}/></label>
            {canEdit&&<button className="cg-primary" type="button" disabled={settingsBusy} onClick={()=>void saveMetadata()}><Check size={17}/>Lưu nội quy</button>}</div>
        </>}
        {manageTab==='notifications'&&<><h2>Thông báo nhóm</h2><p className="cg-muted">Tùy chọn riêng cho tài khoản của bạn, được đồng bộ qua backend.</p>
          <div className="cg-admin-edit cg-pref-edit">
            <label><input type="checkbox" checked={preferences.messageNotifications} onChange={e=>setPreferences(v=>({...v,messageNotifications:e.target.checked}))}/>Thông báo tin nhắn nhóm</label>
            <label><input type="checkbox" checked={preferences.mentionNotifications} onChange={e=>setPreferences(v=>({...v,mentionNotifications:e.target.checked}))}/>Thông báo khi được nhắc đến</label>
            <button className="cg-primary" type="button" disabled={settingsBusy} onClick={()=>void savePreferences()}><Check size={17}/>Lưu thông báo</button>
          </div>
        </>}
      </section>
      <aside className="cg-card cg-admin-right"><h3><ShieldCheck size={22}/>Quyền quản trị</h3><p className="cg-muted">Vai trò hiện tại: {activeMember?.role==='owner'?'Chủ nhóm':activeMember?.role==='admin'?'Quản trị viên':'Thành viên'}</p>
        {['Đổi tên nhóm','Duyệt thành viên mới','Mời thành viên','Ghim tin nhắn','Quản lý kênh riêng'].map((label,index)=>{
          const allowed=index===0?canEdit:index===1?canManage:index===2?canInvite:index===3?canManage:canEdit
          return <div className="cg-right-permission" key={label}><span className={allowed?'yes':''}>{allowed?<Check size={15}/>:<X size={15}/>}</span>{label}</div>
        })}
        {canEdit&&<button className="cg-secondary" type="button" onClick={onRename}><PencilLine size={16}/>Đổi tên nhóm</button>}
      </aside>
    </div>
  </div>

  return <div className="cg-page cg-channel" aria-label="Kênh trò chuyện nhóm">
    <div className="cg-channel-grid">
      <aside className="cg-card cg-channel-nav"><div className="cg-channel-heading"><h2>{selectedGroup.name}</h2><p>{selectedGroup.memberCount} thành viên · {metadata?.visibility==='public'?'Nhóm công khai':'Nhóm riêng tư'}</p></div>
        <small className="cg-section-label">KÊNH THẢO LUẬN</small><button type="button" className={'cg-channel-link'+(activeChannelId===0?' active':'')} onClick={()=>setActiveChannelId(0)}><MessageCircle size={19}/>Thảo luận chung</button>
        <small className="cg-section-label">KÊNH CON</small>
        {channels.filter(c=>c.id!==0).map(channel=><div key={channel.id} className="cg-channel-option">
          <button type="button" className={'cg-channel-link'+(activeChannelId===channel.id?' active':'')} onClick={()=>setActiveChannelId(channel.id)}><MessageCircle size={17}/>{channel.name}</button>
          {canEdit&&<span><button type="button" title="Đổi tên kênh" aria-label={'Đổi tên kênh '+channel.name} disabled={channelBusy} onClick={()=>void renameChannel(channel)}><PencilLine size={14}/></button>
          <button type="button" title="Xóa kênh trống" aria-label={'Xóa kênh '+channel.name} disabled={channelBusy} onClick={()=>void removeChannel(channel)}><X size={14}/></button></span>}
        </div>)}
        {canEdit&&<form className="cg-channel-create" onSubmit={e=>{e.preventDefault();void createChannel()}}>
          <input aria-label="Tên kênh mới" maxLength={80} value={newChannelName} onChange={e=>setNewChannelName(e.target.value)} placeholder="Tên kênh mới"/>
          <input aria-label="Mô tả kênh mới" maxLength={500} value={newChannelDescription} onChange={e=>setNewChannelDescription(e.target.value)} placeholder="Mô tả (tùy chọn)"/>
          <button type="submit" className="cg-secondary" disabled={!newChannelName.trim()||channelBusy}><Plus size={15}/>Tạo kênh</button>
        </form>}
        <small className="cg-section-label">THÀNH VIÊN TRỰC TUYẾN</small><div className="cg-online-list">{members.filter(m=>m.online).slice(0,8).map(member=><button type="button" key={member.id} onClick={()=>onOpenMember(member.username)}><UserAvatar username={member.username} name={nameOf(member)} className="avatar cg-small-avatar" online/>{nameOf(member)}</button>)}
          {!members.some(m=>m.online)&&<p className="cg-muted">Không có trạng thái online mới.</p>}</div>
        <button type="button" className="cg-secondary cg-bottom-link" onClick={()=>onMode('list')}><ArrowLeft size={16}/>Danh sách nhóm</button>
      </aside>
      <section className="cg-center">
        <header className="cg-card cg-channel-title"><div><h3><Users size={22}/> # {currentChannel?.name||'Thảo luận chung'}</h3><p>{currentChannel?.description||'Trao đổi của '+selectedGroup.name}</p></div><button type="button" aria-label="Gọi video nhóm" onClick={()=>onCall(selectedGroup.id)}><Video size={21}/></button></header>
        <div className="cg-chat-messages" role="log" aria-label="Tin nhắn nhóm">{displayedMessages.map(message=><article className={'cg-message'+(message.senderId===userId?' mine':'')} key={message.id}>
          {message.senderId!==userId&&<UserAvatar username={message.sender} name={message.senderDisplayName||message.sender} className="avatar cg-small-avatar"/>}
          <div><strong>{message.senderDisplayName||message.sender}</strong><p>{message.deleted?'Tin nhắn đã thu hồi':message.text||'Tin nhắn có tệp đính kèm'}</p>
            {!message.deleted&&message.attachments?.length?<MediaAttachmentsView items={message.attachments}/>:null}
            <small>{new Date(message.createdAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</small></div>
        </article>)}
        {activeChannelId===0&&pendingMessages.filter(item=>item.conversationId===selectedGroup.id).map(item=><article className="cg-message mine cg-message-pending" key={item.clientId}><div>
          <strong>Bạn · tin đang chờ</strong><p>{item.text||'Tệp đính kèm đang gửi'}</p>
          <small>{item.status==='failed'?item.error||'Gửi thất bại':!chatOnline?'Chờ có mạng':item.status==='unconfirmed'?'Đang xác nhận...':'Đang gửi...'}</small>
          {item.status==='failed'&&<button type="button" onClick={onRetryPending}>Gửi lại</button>}
        </div></article>)}
        {activeChannelId!==0&&channelUnconfirmed&&<article className="cg-message mine cg-message-pending"><div><strong>Bạn · Chờ xác nhận</strong><p>{channelUnconfirmed.text}</p><button type="button" disabled={channelSendBusy} onClick={()=>void sendChannelMessage({preventDefault(){}} as FormEvent)}>Gửi lại cùng mã tin</button></div></article>}
        {!displayedMessages.length&&!channelUnconfirmed&&(activeChannelId!==0||!pendingMessages.some(item=>item.conversationId===selectedGroup.id))&&<p className="cg-empty">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!</p>}</div>
        <form className="cg-card cg-chat-form" onSubmit={activeChannelId===0?onSend:sendChannelMessage}><label htmlFor="cg-chat-text">Nhắn tin cho # {currentChannel?.name||'Thảo luận chung'}</label><textarea id="cg-chat-text" rows={2} value={activeChannelId===0?messageText:channelDraft} onChange={e=>activeChannelId===0?onMessageText(e.target.value):(setChannelDraft(e.target.value),setChannelUnconfirmed(null))} placeholder="Nhập tin nhắn..."/>
          {channelError&&<p className="cg-error" role="alert">{channelError}</p>}
          <div><button className="cg-secondary" type="button" onClick={onOpenFullChat}><Plus size={17}/>Tệp, trả lời, ghim (chat chung)</button><button type="submit" className="cg-primary" disabled={activeChannelId===0?!canSend:channelSendBusy||(!channelDraft.trim()&&!channelUnconfirmed)}><Send size={16}/>Gửi</button></div></form>
      </section>
      <aside className="cg-card cg-channel-info"><h3>Thông tin kênh</h3><hr/><h4>Mô tả</h4><p>{currentChannel?.description||metadata?.description||'Thảo luận chung của nhóm '+selectedGroup.name}</p><h4>Chủ đề</h4><p>{metadata?.topic||'Chưa có chủ đề'}</p>
        <h4>Thành viên</h4><div className="cg-channel-avatars">{members.slice(0,6).map(member=><UserAvatar key={member.id} username={member.username} name={nameOf(member)} className="avatar cg-small-avatar"/>)}</div>
        <button type="button" className="cg-secondary" onClick={()=>onMode('manage')}><Users size={16}/>Xem tất cả thành viên</button>
        <h4>Tài liệu chia sẻ</h4>{attachments.length?<MediaAttachmentsView items={attachments.slice(0,4)}/>:<p>Chưa có tệp được tải.</p>}
        <button type="button" className="cg-secondary cg-bottom-link" onClick={()=>onMode('manage')}><Settings size={16}/>Quản lý nhóm</button>
      </aside>
    </div>
  </div>
}
