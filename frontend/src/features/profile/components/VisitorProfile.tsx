import { StoryHighlights } from '../../feed'
import VisitorProfileHero, { type VisitorProfileData } from './VisitorProfileHero'
import ProfileTabs from './ProfileTabs'
import ProfileDetailsCard from './ProfileDetailsCard'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import { ArrowLeft, RefreshCw, MapPin } from 'lucide-react'
import { FeedPostCard } from '../../feed'
import type { Post } from '../../feed'
import type { FriendSearchResult } from '../../contacts'
import '../styles/visitor-profile.css'
import { loadVisitorProfile, loadVisitorPosts, reactToVisitorPost } from '../api/profile'
import { useLatest } from '../../../shared/hooks/useLatest'

type Props = {
 username: string
 friendOnline?: boolean
 request: (path: string, init?: RequestInit) => Promise<Response>
 currentUser: string
 token: string
 targetLanguage: string
 relationship: (id: number) => string
 friendBusy: number | null
 onFriend: (user: FriendSearchResult) => Promise<void>
 onRemoveFriend: (user: FriendSearchResult) => Promise<void>
 onMessage: (username: string) => Promise<void>
 onClose: () => void
 onOpenOriginal?: (id: number) => void
 onShareToChat?: (url: string) => void
 onRepostChanged?: () => void
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
export default function VisitorProfile({ username, friendOnline, request, currentUser, token, targetLanguage, relationship, friendBusy, onFriend, onRemoveFriend, onMessage, onClose, onPostOpen, onOpenOriginal, onRepostChanged, onShareToChat, onReactionUsers, onUserOpen, onEditPost, taggedNames, onUpdated, updates, onDeleted, feedback }: Props) {
 const scope=JSON.stringify([username,token])
 const [profile,setProfile]=useScopedState<VisitorProfileData|null>(scope,null)
 const [posts,setPosts]=useScopedState<Post[]>(scope,[])
 const [more,setMore]=useScopedState(scope,false)
 const [loading,setLoading]=useScopedState(scope,false)
 const [error,setError]=useScopedState(scope,'')
 const [retry,setRetry]=useScopedState(scope,0)
 const [likeBusy,setLikeBusy]=useScopedState<Record<number,boolean>>(scope,{})
 const [activeTab,setActiveTab]=useScopedState(scope,'posts')
 const [sidebarTop,setSidebarTop]=useState(16)
 const sidebar=useRef<HTMLElement>(null)
 const scroller=useRef<HTMLDivElement>(null)
 const alive=useRef(true)
 const latestToken=useLatest(token)
 const latestRequest=useLatest(request)
 const latestClose=useLatest(onClose)
 const paging=useRef(false)
 const sequence=useRef(0)
 const previousUpdates=useRef(updates)
 const surface=useRef<HTMLElement>(null)
 const back=useRef<HTMLButtonElement>(null)
 useEffect(()=>{
  alive.current=true
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null
  back.current?.focus()
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape' && !document.querySelector('dialog[open]'))latestClose.current()}
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
  paging.current=false
  setLikeBusy({})
  setProfile(null);setPosts([]);setError('');setLoading(true);setMore(false)
  async function load(){
   try {
    const response=await loadVisitorProfile(latestRequest.current, username, Boolean(retry))
    if(!response.ok)throw new Error(response.status===404?'Không tìm thấy hồ sơ hoặc bạn không thể xem tài khoản này.':'Không tải được hồ sơ.')
    const data=await response.json() as VisitorProfileData
    if(cancelled||id!==sequence.current)return
    setProfile(data)
    const timeline=await loadVisitorPosts(latestRequest.current, data.username, undefined, Boolean(retry))
    if(!timeline.ok)throw new Error('Không tải được dòng thời gian.')
    const items=await timeline.json() as Post[]
    if(cancelled||id!==sequence.current)return
    setPosts(items);setMore(items.length===15)
   }catch(cause){if(!cancelled&&id===sequence.current)setError(cause instanceof Error?cause.message:'Không tải được hồ sơ.')}
   finally{if(!cancelled&&id===sequence.current)setLoading(false)}
  }
  void load()
  return ()=>{cancelled=true}
 },[username,token,retry,latestRequest,setProfile,setPosts,setError,setLoading,setMore,setLikeBusy])
 async function loadMore(){
  if(paging.current||!posts.length)return
  const id=sequence.current
  const sessionToken=token
  paging.current=true;setLoading(true);setError('')
  try{
   const response=await loadVisitorPosts(request, username, posts[posts.length-1].id)
   if(!response.ok)throw new Error('Không tải được bài viết cũ.')
   const items=await response.json() as Post[]
   if(!alive.current||id!==sequence.current||latestToken.current!==sessionToken)return
   setPosts(current=>[...current,...items.filter(item=>!current.some(post=>post.id===item.id))]);setMore(items.length===15)
  }catch(cause){if(alive.current&&id===sequence.current&&latestToken.current===sessionToken)setError(cause instanceof Error?cause.message:'Không tải được bài viết.')}
  finally{if(id===sequence.current&&latestToken.current===sessionToken){paging.current=false;if(alive.current)setLoading(false)}}
 }
 function update(post:Post){setPosts(current=>current.map(item=>item.id===post.id?post:item));onUpdated(post)}
 async function like(post:Post,emoji='👍'){
  if(likeBusy[post.id])return
  const sessionToken=token
  const id=sequence.current
  setLikeBusy(current=>({...current,[post.id]:true}))
  try{
   const response=await reactToVisitorPost(request, post.id, emoji)
   if(!response.ok)throw new Error('Không cập nhật được lượt thích.')
   const updated=await response.json() as Post
   if(alive.current&&id===sequence.current&&latestToken.current===sessionToken)update(updated)
  }catch(cause){if(alive.current&&id===sequence.current&&latestToken.current===sessionToken)feedback(cause instanceof Error?cause.message:'Không cập nhật được lượt thích.','error')}
  finally{if(alive.current&&id===sequence.current&&latestToken.current===sessionToken)setLikeBusy(current=>{const next={...current};delete next[post.id];return next})}
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
  void loadVisitorPosts(request, profile.username)
   .then(async response=>{if(!response.ok)throw new Error('Không tải được dòng thời gian.');return await response.json() as Post[]})
   .then(items=>{if(!cancelled&&id===sequence.current){setPosts(items);setMore(items.length===15)}})
   .catch(cause=>{if(!cancelled&&id===sequence.current)setError(cause instanceof Error?cause.message:'Không tải được bài viết.')})
   .finally(()=>{if(!cancelled&&id===sequence.current)setLoading(false)})
  return ()=>{cancelled=true}
 },[relation,profile?.username])
 const action=relation==='accepted'?'Bạn bè':relation==='incoming'?'Chấp nhận kết bạn':relation==='outgoing'?'Hủy lời mời':'Kết bạn'
 const media=posts.flatMap(post=>(post.attachments||[]).filter(attachment=>(attachment.kind==='image'||attachment.kind==='video')&&Boolean(attachment.url)).map(attachment=>({...attachment,postId:post.id})))
 const tabs=[{id:'posts',label:'Bài viết'},...(media.length?[{id:'media',label:'Ảnh & video'}]:[]),...(profile?.bio||profile?.city?[{id:'about',label:'Giới thiệu'}]:[])]
 const visibleTab=tabs.some(tab=>tab.id===activeTab)?activeTab:'posts'
 useEffect(()=>{
  const element=sidebar.current
  const viewport=scroller.current
  if(!element||!viewport||typeof ResizeObserver==='undefined')return
  const measure=()=>setSidebarTop(Math.min(16,viewport.clientHeight-element.getBoundingClientRect().height-16))
  const observer=new ResizeObserver(measure)
  observer.observe(element)
  observer.observe(viewport)
  measure()
  return()=>observer.disconnect()
 },[profile?.username,visibleTab])
 return <section ref={surface} onKeyDown={event=>{
  if(event.key!=='Tab'||document.querySelector('dialog[open]'))return
  const controls=Array.from(surface.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')||[])
   .filter(control => control.tabIndex >= 0)
  const first=controls[0],last=controls[controls.length-1]
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
 }} className="visitor-profile" role="dialog" aria-modal="true" aria-label="Trang cá nhân người dùng">
  <header className="visitor-toolbar profile-page-toolbar"><button ref={back} type="button" onClick={onClose} aria-label="Quay lại"><ArrowLeft size={21}/></button><strong>Trang cá nhân</strong><button type="button" onClick={()=>setRetry(n=>n+1)} disabled={loading} aria-label="Tải lại hồ sơ"><RefreshCw size={19}/></button></header>
  <div className="visitor-scroll" ref={scroller}><div className="visitor-content">
   {profile&&<>
    <VisitorProfileHero
      profile={profile}
      online={friendOnline}
      relation={relation}
      friendBusy={friendBusy}
      action={action}
      request={request}
      onMessage={onMessage}
      onFriendAction={() => {
        const id = sequence.current
        const sessionToken = token
        void onFriend(profile).catch(cause => {
          if (alive.current && id === sequence.current && latestToken.current === sessionToken)
            feedback(cause instanceof Error ? cause.message : 'Không cập nhật được kết bạn.', 'error')
        })
      }}
      onRemoveFriendAction={() => {
        const id = sequence.current
        const sessionToken = token
        void onRemoveFriend(profile).catch(cause => {
          if (alive.current && id === sequence.current && latestToken.current === sessionToken)
            feedback(cause instanceof Error ? cause.message : 'Không thể hủy kết bạn.', 'error')
        })
      }}
    />
    <ProfileTabs idPrefix="visitor-profile" tabs={tabs} active={visibleTab} onChange={setActiveTab} />
    <div className="profile-page-columns">
      <aside ref={sidebar} className="profile-page-aside" style={{'--profile-aside-top':sidebarTop+'px'} as CSSProperties}>
        <ProfileDetailsCard username={profile.username} bio={profile.bio} city={profile.city} />
        <StoryHighlights key={profile.username} request={request} username={profile.username} className="profile-page-about" />
        {media.some(item=>item.kind==='image')&&<section className="profile-page-recent"><div className="profile-page-recent-heading"><h2>Ảnh</h2><button type="button" onClick={()=>setActiveTab('media')}>Xem tất cả</button></div><div className="profile-page-recent-grid">{media.filter(item=>item.kind==='image').slice(0,5).map((item,index)=><button type="button" key={item.storageRef+'-'+index} aria-label="Xem ảnh bài viết" onClick={()=>setActiveTab('media')}><img src={item.url} alt={item.name||'Ảnh bài viết'} loading="lazy"/></button>)}</div></section>}
      </aside>
      <section id="visitor-profile-tab-content" className="profile-page-main profile-page-panel" role="tabpanel"
        aria-labelledby={`visitor-profile-tab-${visibleTab}`}>
    {visibleTab==='media' && <section className="profile-page-subsection" aria-label="Ảnh và video"><h2>Ảnh & video</h2><div className="profile-page-media-grid visitor-media-grid">{media.map((item,index)=><button type="button" className="profile-page-media-item" key={item.storageRef+'-'+index} onClick={()=>{const post=posts.find(post=>post.id===item.postId);if(post)onPostOpen(post)}} aria-label={'Mở bài viết chứa '+(item.kind==='video'?'video':'ảnh')}>
      {item.kind==='image'?<img src={item.url} alt={item.name||'Ảnh bài viết'} loading="lazy"/>:<video src={item.url} preload="metadata" aria-label={item.name||'Video bài viết'}/>}
    </button>)}</div></section>}
    {visibleTab==='about' && <section className="profile-page-subsection"><h2>Giới thiệu</h2>{profile.bio&&<p>{profile.bio}</p>}{profile.city&&<p><MapPin size={18} aria-hidden="true"/>Sống tại {profile.city}</p>}<small>Chỉ thông tin công khai được hiển thị.</small></section>}
        {visibleTab==='posts' && <>

      <div className="profile-page-about profile-page-timeline-heading"><h2>Bài viết</h2></div>
    <div className="profile-page-post-feed feed zalo-feed">{posts.map(post=><FeedPostCard key={post.id} post={post} name={currentUser} onAuthorOpen={onUserOpen} onEditPost={onEditPost} taggedNames={taggedNames} apiFetch={request} syncFeedPost={update} removeFeedPost={id=>{setPosts(current=>current.filter(post=>post.id!==id));onDeleted(id)}} setNotice={feedback} token={token} translationPreferencesLoaded targetLanguage={targetLanguage} setActivePostId={(id)=>{if(id===post.id)onPostOpen(post);else onOpenOriginal?.(id)}} onRepostChanged={onRepostChanged} onShareToChat={onShareToChat} likePreviews={likeBusy} like={like} onReactionUsers={onReactionUsers}/>)}</div>
    {!loading&&!error&&posts.length===0&&<div className="profile-page-blank"><strong>Chưa có bài viết để hiển thị</strong><p>Người này chưa đăng bài hoặc chưa chia sẻ bài viết với bạn.</p></div>}
    {more&&<button type="button" className="profile-page-more-posts" disabled={loading} onClick={()=>void loadMore()}>Xem bài viết cũ hơn</button>}
        </>}
      </section>
    </div>
   </>}

   {error&&<div role="alert" className="visitor-empty profile-page-error"><p>{error}</p><button type="button" disabled={loading} onClick={()=>more&&posts.length?void loadMore():setRetry(n=>n+1)}>Thử lại</button></div>}
  </div></div>
 </section>
}