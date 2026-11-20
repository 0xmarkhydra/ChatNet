import VisitorProfileHero, { type VisitorProfileData } from './VisitorProfileHero'
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
export default function VisitorProfile({ username, request, currentUser, token, targetLanguage, relationship, friendBusy, onFriend, onRemoveFriend, onMessage, onClose, onPostOpen, onOpenOriginal, onRepostChanged, onShareToChat, onReactionUsers, onUserOpen, onEditPost, taggedNames, onUpdated, updates, onDeleted, feedback }: Props) {
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
  const first=controls[0],last=controls[controls.length-1]
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
 }} className="visitor-profile fixed inset-0 z-[90] flex flex-col bg-[#f5f5fa] text-[#17173a]" role="dialog" aria-modal="true" aria-label="Trang cá nhân người dùng">
  <header className="visitor-toolbar"><button ref={back} type="button" onClick={onClose} aria-label="Quay lại"><ArrowLeft size={21}/></button><strong>Trang cá nhân</strong><button type="button" onClick={()=>setRetry(n=>n+1)} disabled={loading} aria-label="Tải lại hồ sơ"><RefreshCw size={19}/></button></header>
  <div className="visitor-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain" ref={scroller}><div className="visitor-content mx-auto max-w-[1200px] min-w-0 px-8 pb-12 pt-6 max-[900px]:box-border max-[900px]:w-full max-[900px]:px-3 max-[900px]:pb-8 max-[900px]:pt-3">
   {profile&&<>
    <VisitorProfileHero
      profile={profile}
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
      tabs={tabs}
      activeTab={visibleTab}
      onTabChange={setActiveTab}
      onRemoveFriendAction={() => {
        const id = sequence.current
        const sessionToken = token
        void onRemoveFriend(profile).catch(cause => {
          if (alive.current && id === sequence.current && latestToken.current === sessionToken)
            feedback(cause instanceof Error ? cause.message : 'Không thể hủy kết bạn.', 'error')
        })
      }}
    />
    {visibleTab==='media' && <section className="visitor-media-panel mt-6 rounded-3xl border border-[#e6e6f2] bg-white p-6 max-[900px]:mt-4 max-[900px]:p-[18px]" aria-label="Ảnh và video"><h2>Ảnh & video</h2><div className="visitor-media-grid mt-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">{media.map((item,index)=><button type="button" key={item.storageRef+'-'+index} onClick={()=>{const post=posts.find(post=>post.id===item.postId);if(post)onPostOpen(post)}} aria-label={'Mở bài viết chứa '+(item.kind==='video'?'video':'ảnh')}>
      {item.kind==='image'?<img src={item.url} alt={item.name||'Ảnh bài viết'} loading="lazy"/>:<video src={item.url} preload="metadata" aria-label={item.name||'Video bài viết'}/>}
    </button>)}</div></section>}
    {visibleTab==='about' && <section className="visitor-about-panel mt-6 rounded-3xl border border-[#e6e6f2] bg-white p-6 max-[900px]:mt-4 max-[900px]:p-[18px]"><h2>Giới thiệu</h2>{profile.bio&&<p>{profile.bio}</p>}{profile.city&&<p><MapPin size={18} aria-hidden="true"/>Sống tại {profile.city}</p>}<small>Chỉ thông tin công khai được hiển thị.</small></section>}
    {visibleTab==='posts' && <div className="visitor-cols mt-4 grid grid-cols-[minmax(300px,400px)_minmax(0,1fr)] items-start gap-4 min-[901px]:max-[1100px]:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] max-[900px]:flex max-[900px]:flex-col">
      {(profile.bio||profile.city||media.length>0)&&<aside ref={sidebar} className="visitor-sidebar sticky top-[var(--visitor-sticky-top,16px)] grid min-w-0 self-start gap-5 rounded-2xl border border-[#e8ecf7] bg-white p-5 max-[900px]:static! max-[900px]:box-border max-[900px]:w-full max-[900px]:self-stretch" style={{'--visitor-sticky-top':sidebarTop+'px'} as CSSProperties}>
        {(profile.bio||profile.city)&&<section className="visitor-side-section"><h2>Giới thiệu</h2>{profile.bio&&<p>{profile.bio}</p>}{profile.city&&<p className="visitor-side-detail"><span><MapPin size={19} aria-hidden="true"/></span>Sống tại {profile.city}</p>}</section>}
        {media.some(item=>item.kind==='image')&&<section className="visitor-side-section visitor-side-photos"><div className="visitor-side-heading flex items-center justify-between gap-3"><h2>Ảnh</h2><button type="button" onClick={()=>setActiveTab('media')}>Xem tất cả</button></div><div className="visitor-photo-mosaic mt-3 grid auto-rows-fr grid-cols-3 gap-1 overflow-hidden rounded-[10px]">{media.filter(item=>item.kind==='image').slice(0,5).map((item,index)=><button type="button" key={item.storageRef+'-'+index} aria-label="Xem ảnh bài viết" onClick={()=>setActiveTab('media')}><img src={item.url} alt={item.name||'Ảnh bài viết'} loading="lazy"/></button>)}</div></section>}
      </aside>}
      <main className="visitor-posts min-w-0 max-[900px]:w-full"><div className="visitor-timeline-title"><h2>Dòng thời gian</h2><span>Các bài viết được chia sẻ với bạn</span></div>
    <div className="feed zalo-feed">{posts.map(post=><FeedPostCard key={post.id} post={post} name={currentUser} onAuthorOpen={onUserOpen} onEditPost={onEditPost} taggedNames={taggedNames} apiFetch={request} syncFeedPost={update} removeFeedPost={id=>{setPosts(current=>current.filter(post=>post.id!==id));onDeleted(id)}} setNotice={feedback} token={token} translationPreferencesLoaded targetLanguage={targetLanguage} setActivePostId={(id)=>{if(id===post.id)onPostOpen(post);else onOpenOriginal?.(id)}} onRepostChanged={onRepostChanged} onShareToChat={onShareToChat} likePreviews={likeBusy} like={like} onReactionUsers={onReactionUsers}/>)}</div>
    {!loading&&!error&&posts.length===0&&<div className="visitor-empty"><strong>Chưa có bài viết để hiển thị</strong><p>Người này chưa đăng bài hoặc chưa chia sẻ bài viết với bạn.</p></div>}
    {more&&<button type="button" className="soco-load-more" disabled={loading} onClick={()=>void loadMore()}>Xem bài viết cũ hơn</button>}
    </main></div>}
   </>}

   {error&&<div role="alert" className="visitor-empty"><p>{error}</p><button type="button" disabled={loading} onClick={()=>more&&posts.length?void loadMore():setRetry(n=>n+1)}>Thử lại</button></div>}
  </div></div>
 </section>
}