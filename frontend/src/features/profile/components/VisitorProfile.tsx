import VisitorProfileHero, { type VisitorProfileData } from './VisitorProfileHero'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import FeedPostCard from '../../feed/components/FeedPostCard'
import type { Post } from '../../feed/types'
import type { FriendSearchResult } from '../../contacts/types'
import '../styles/visitor-profile.css'

type Props = {
 username: string
 request: (path: string, init?: RequestInit) => Promise<Response>
 currentUser: string
 token: string
 targetLanguage: string
 relationship: (id: number) => string
 friendBusy: number | null
 onFriend: (user: FriendSearchResult) => Promise<void>
 onMessage: (username: string) => Promise<void>
 onClose: () => void
 onPostOpen: (post: Post) => void
 onReactionUsers: (post: Post) => void
 onUserOpen?: (username: string) => void
 onEditPost?: (post: Post) => void
 taggedNames?: Record<string, string>
 onUpdated: (post: Post) => void
 updates: Post[]
 onDeleted: (id: number) => void
 feedback: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void
}
export default function VisitorProfile({ username, request, currentUser, token, targetLanguage, relationship, friendBusy, onFriend, onMessage, onClose, onPostOpen, onReactionUsers, onUserOpen, onEditPost, taggedNames, onUpdated, updates, onDeleted, feedback }: Props) {
 const [profile,setProfile]=useState<VisitorProfileData|null>(null)
 const [posts,setPosts]=useState<Post[]>([])
 const [more,setMore]=useState(false)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const [retry,setRetry]=useState(0)
 const [likeBusy,setLikeBusy]=useState<Record<number,boolean>>({})
 const alive=useRef(true)
 const paging=useRef(false)
 const sequence=useRef(0)
 const previousUpdates=useRef(updates)
 const surface=useRef<HTMLElement>(null)
 const back=useRef<HTMLButtonElement>(null)
 useEffect(()=>{
  alive.current=true
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null
  back.current?.focus()
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape' && !document.querySelector('.post-detail-backdrop') && !document.querySelector('.profile-note-dialog[open]'))onClose()}
  document.addEventListener('keydown',escape)
  return ()=>{alive.current=false;sequence.current++;document.removeEventListener('keydown',escape);previous?.focus()}
 },[])
 useEffect(()=>{
  if(previousUpdates.current===updates)return
  previousUpdates.current=updates
  const byId=new Map(updates.map(post=>[post.id,post]))
  setPosts(current=>current.map(post=>byId.get(post.id)||post))
 },[updates])
 useEffect(()=>{
  const id=++sequence.current
  let cancelled=false
  setProfile(null);setPosts([]);setError('');setLoading(true);setMore(false)
  async function load(){
   try {
    const response=await request('/api/users/'+encodeURIComponent(username)+'/profile', retry ? { cache: 'reload' } : undefined)
    if(!response.ok)throw new Error(response.status===404?'Không tìm thấy hồ sơ hoặc bạn không thể xem tài khoản này.':'Không tải được hồ sơ.')
    const data=await response.json() as VisitorProfileData
    if(cancelled||id!==sequence.current)return
    setProfile(data)
    const timeline=await request('/api/posts?author='+encodeURIComponent(data.username)+'&limit=15', retry ? { cache: 'reload' } : undefined)
    if(!timeline.ok)throw new Error('Không tải được dòng thời gian.')
    const items=await timeline.json() as Post[]
    if(cancelled||id!==sequence.current)return
    setPosts(items);setMore(items.length===15)
   }catch(cause){if(!cancelled&&id===sequence.current)setError(cause instanceof Error?cause.message:'Không tải được hồ sơ.')}
   finally{if(!cancelled&&id===sequence.current)setLoading(false)}
  }
  void load()
  return ()=>{cancelled=true}
 },[username,retry])
 async function loadMore(){
  if(paging.current||!posts.length)return
  const id=sequence.current
  paging.current=true;setLoading(true);setError('')
  try{
   const response=await request('/api/posts?author='+encodeURIComponent(username)+'&limit=15&before='+posts[posts.length-1].id)
   if(!response.ok)throw new Error('Không tải được bài viết cũ.')
   const items=await response.json() as Post[]
   if(!alive.current||id!==sequence.current)return
   setPosts(current=>[...current,...items.filter(item=>!current.some(post=>post.id===item.id))]);setMore(items.length===15)
  }catch(cause){if(alive.current&&id===sequence.current)setError(cause instanceof Error?cause.message:'Không tải được bài viết.')}
  finally{paging.current=false;if(alive.current&&id===sequence.current)setLoading(false)}
 }
 function update(post:Post){setPosts(current=>current.map(item=>item.id===post.id?post:item));onUpdated(post)}
 async function like(post:Post,emoji='👍'){
  if(likeBusy[post.id])return
  setLikeBusy(current=>({...current,[post.id]:true}))
  try{
   const response=await request('/api/posts/'+post.id+(emoji==='👍'?'/like':'/reactions'),{method:'POST',...(emoji==='👍'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({emoji})})})
   if(!response.ok)throw new Error('Không cập nhật được lượt thích.')
   const updated=await response.json() as Post
   if(alive.current)update(updated)
  }catch(cause){if(alive.current)feedback(cause instanceof Error?cause.message:'Không cập nhật được lượt thích.','error')}
  finally{if(alive.current)setLikeBusy(current=>{const next={...current};delete next[post.id];return next})}
 }
 const relation=profile?relationship(profile.id):'none'
 const previousRelation=useRef<string|null>(null)
 useEffect(()=>{
  if(!profile)return
  const previous=previousRelation.current
  previousRelation.current=relation
  if(previous===null||previous===relation||(previous!=='accepted'&&relation!=='accepted'))return
  const id=++sequence.current
  let cancelled=false
  setLoading(true);setError('')
  void request('/api/posts?author='+encodeURIComponent(profile.username)+'&limit=15')
   .then(async response=>{if(!response.ok)throw new Error('Không tải được dòng thời gian.');return await response.json() as Post[]})
   .then(items=>{if(!cancelled&&id===sequence.current){setPosts(items);setMore(items.length===15)}})
   .catch(cause=>{if(!cancelled&&id===sequence.current)setError(cause instanceof Error?cause.message:'Không tải được bài viết.')})
   .finally(()=>{if(!cancelled&&id===sequence.current)setLoading(false)})
  return ()=>{cancelled=true}
 },[relation,profile?.username])
 const action=relation==='accepted'?'Bạn bè':relation==='incoming'?'Chấp nhận kết bạn':relation==='outgoing'?'Hủy lời mời':'Kết bạn'
 return <section ref={surface} onKeyDown={event=>{
  if(event.key!=='Tab'||document.querySelector('.post-detail-backdrop')||document.querySelector('.profile-note-dialog[open]'))return
  const controls=Array.from(surface.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')||[])
  const first=controls[0],last=controls[controls.length-1]
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
 }} className="visitor-profile" role="dialog" aria-modal="true" aria-label="Trang cá nhân người dùng">
  <header className="visitor-toolbar"><button ref={back} type="button" onClick={onClose} aria-label="Quay lại"><ArrowLeft size={21}/></button><strong>Trang cá nhân</strong><button type="button" onClick={()=>setRetry(n=>n+1)} disabled={loading} aria-label="Tải lại hồ sơ"><RefreshCw size={19}/></button></header>
  <div className="visitor-scroll"><div className="visitor-content">
   {profile&&<>
    <VisitorProfileHero profile={profile} relation={relation} friendBusy={friendBusy} action={action} request={request} onMessage={onMessage} onFriendAction={() => { void onFriend(profile).catch(cause => { if (alive.current) feedback(cause instanceof Error ? cause.message : 'Không cập nhật được kết bạn.', 'error') }) }} />
    <div className="visitor-timeline-title"><h2>Dòng thời gian</h2><span>Các bài viết được chia sẻ với bạn</span></div>
    <div className="feed zalo-feed">{posts.map(post=><FeedPostCard key={post.id} post={post} name={currentUser} onAuthorOpen={onUserOpen} onEditPost={onEditPost} taggedNames={taggedNames} apiFetch={request} syncFeedPost={update} removeFeedPost={id=>{setPosts(current=>current.filter(post=>post.id!==id));onDeleted(id)}} setNotice={feedback} token={token} translationPreferencesLoaded targetLanguage={targetLanguage} setActivePostId={()=>onPostOpen(post)} likePreviews={likeBusy} like={like} onReactionUsers={onReactionUsers}/>)}</div>
    {!loading&&!error&&posts.length===0&&<div className="visitor-empty"><strong>Chưa có bài viết để hiển thị</strong><p>Người này chưa đăng bài hoặc chưa chia sẻ bài viết với bạn.</p></div>}
    {more&&<button type="button" className="soco-load-more" disabled={loading} onClick={()=>void loadMore()}>Xem bài viết cũ hơn</button>}
   </>}

   {error&&<div role="alert" className="visitor-empty"><p>{error}</p><button type="button" disabled={loading} onClick={()=>more&&posts.length?void loadMore():setRetry(n=>n+1)}>Thử lại</button></div>}
  </div></div>
 </section>
}