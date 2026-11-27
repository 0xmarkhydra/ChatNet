import { StoryHighlights } from '../../feed'
import VisitorProfileHero, { type VisitorProfileData } from './VisitorProfileHero'
import ProfileTabs from './ProfileTabs'
import { Button } from '@/shared/ui/button'
import ProfileDetailsCard from './ProfileDetailsCard'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import { MapPin } from 'lucide-react'
import { FeedPostCard } from '../../feed'
import type { Post } from '../../feed'
import type { FriendSearchResult } from '../../contacts'
import '../styles/visitor-profile.css'
import { loadVisitorProfile, loadVisitorPosts, reactToVisitorPost } from '../api/profile'
import { useLatest } from '../../../shared/hooks/useLatest'

type Props = {
 username: string
 mobile?: boolean
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
export default function VisitorProfile({ username, mobile = false, friendOnline, request, currentUser, token, targetLanguage, relationship, friendBusy, onFriend, onRemoveFriend, onMessage, onPostOpen, onOpenOriginal, onRepostChanged, onShareToChat, onReactionUsers, onUserOpen, onEditPost, taggedNames, onUpdated, updates, onDeleted, feedback }: Props) {
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
 const paging=useRef(false)
 const sequence=useRef(0)
 const previousUpdates=useRef(updates)
 useEffect(()=>{
  const generation=sequence
  alive.current=true
  return ()=>{alive.current=false;generation.current++}
 },[])
 useEffect(()=>{
  if(previousUpdates.current===updates)return
  previousUpdates.current=updates
  const byId=new Map(updates.map(post=>[post.id,post]))
  setPosts(current=>current.map(post=>byId.get(post.id)||post))
 },[updates,setPosts])
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
 // Only a new relation or profile may rerun this: a rerun cancels the reload, so request is read through its ref.
 const profileName=profile?.username
 useEffect(()=>{
  if(!profileName)return
  const previous=previousRelation.current
  previousRelation.current=relation
  if(previous===null||previous===relation||(previous!=='accepted'&&relation!=='accepted'))return
  const id=++sequence.current
  let cancelled=false
  setLoading(true);setError('')
  void loadVisitorPosts(latestRequest.current, profileName)
   .then(async response=>{if(!response.ok)throw new Error('Không tải được dòng thời gian.');return await response.json() as Post[]})
   .then(items=>{if(!cancelled&&id===sequence.current){setPosts(items);setMore(items.length===15)}})
   .catch(cause=>{if(!cancelled&&id===sequence.current)setError(cause instanceof Error?cause.message:'Không tải được bài viết.')})
   .finally(()=>{if(!cancelled&&id===sequence.current)setLoading(false)})
  return ()=>{cancelled=true}
 },[relation,profileName,latestRequest,setPosts,setMore,setLoading,setError])
 const action=relation==='accepted'?'Bạn bè':relation==='incoming'?'Chấp nhận kết bạn':relation==='outgoing'?'Hủy lời mời':'Kết bạn'
 const media=posts.flatMap(post=>(post.attachments||[]).filter(attachment=>(attachment.kind==='image'||attachment.kind==='video')&&Boolean(attachment.url)).map(attachment=>({...attachment,postId:post.id})))
 const tabs=mobile ? [{id:'posts',label:'Tất cả'}, {id:'media',label:'Ảnh & video'}] : [{id:'posts',label:'Bài viết'},...(media.length?[{id:'media',label:'Ảnh & video'}]:[]),...(profile?.bio||profile?.city?[{id:'about',label:'Giới thiệu'}]:[])]
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
 return <section className={mobile ? "visitor-profile relative! inset-auto! z-auto! flex-1 min-h-0 min-w-0 bg-card! font-sans text-foreground" : "visitor-profile relative! inset-auto! z-auto! flex-1 min-h-0 min-w-0"} aria-label="Trang cá nhân người dùng">
  <div className={mobile ? "visitor-scroll [scrollbar-gutter:auto]!" : "visitor-scroll"} ref={scroller}><div className={mobile ? "visitor-content px-0! pb-[96px]!" : "visitor-content"}>
   {profile&&<>
    <VisitorProfileHero
      profile={profile}
      mobile={mobile}
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
    {mobile ? <div className="flex w-full box-border gap-ui-2 px-ui-4 py-ui-2" role="group" aria-label="Nội dung trang cá nhân">
      {tabs.map(tab => <Button key={tab.id} size="lg" variant={visibleTab===tab.id?'secondary':'ghost'} className="min-h-control-touch rounded-full! text-[14px]! font-semibold! text-foreground! aria-pressed:bg-[#e2ecff]! aria-pressed:font-bold! aria-pressed:text-primary!" aria-pressed={visibleTab===tab.id} onClick={()=>setActiveTab(tab.id)}>{tab.label}</Button>)}
    </div> : <ProfileTabs idPrefix="visitor-profile" tabs={tabs} active={visibleTab} onChange={setActiveTab} />}
    <div className={mobile ? "grid min-w-0 gap-ui-4 px-ui-4" : "profile-page-columns"}>
      {(!mobile || visibleTab==='posts') && <aside ref={sidebar} className={mobile ? "grid min-w-0 gap-ui-6 py-ui-2" : "profile-page-aside"} style={{'--profile-aside-top':sidebarTop+'px'} as CSSProperties}>
        <ProfileDetailsCard username={profile.username} bio={mobile ? undefined : profile.bio} city={profile.city} workplace={mobile ? profile.workplace : undefined} school={mobile ? profile.school : undefined} iconEdit={mobile} />
        <StoryHighlights key={profile.username} request={request} username={profile.username} className={mobile ? undefined : "profile-page-about"} mobileProfile={mobile} />
        {!mobile && media.some(item=>item.kind==='image')&&<section className="profile-page-recent"><div className="profile-page-recent-heading"><h2>Ảnh</h2><button type="button" onClick={()=>setActiveTab('media')}>Xem tất cả</button></div><div className="profile-page-recent-grid">{media.filter(item=>item.kind==='image').slice(0,5).map((item,index)=><button type="button" key={item.storageRef+'-'+index} aria-label="Xem ảnh bài viết" onClick={()=>setActiveTab('media')}><img src={item.url} alt={item.name||'Ảnh bài viết'} loading="lazy"/></button>)}</div></section>}
      </aside>}
      <section id="visitor-profile-tab-content" className={mobile ? "min-w-0" : "profile-page-main profile-page-panel"} role={mobile ? "region" : "tabpanel"}
        aria-label={mobile ? tabs.find(tab=>tab.id===visibleTab)?.label : undefined} aria-labelledby={mobile ? undefined : `visitor-profile-tab-${visibleTab}`}>
    {visibleTab==='media' && <section className="profile-page-subsection" aria-label="Ảnh và video">{!mobile && <h2>Ảnh & video</h2>}{mobile && !loading && !media.length && <p className="text-ui-body text-muted-foreground">Chưa có ảnh hoặc video được chia sẻ với bạn.</p>}<div className="profile-page-media-grid visitor-media-grid">{media.map((item,index)=><button type="button" className="profile-page-media-item" key={item.storageRef+'-'+index} onClick={()=>{const post=posts.find(post=>post.id===item.postId);if(post)onPostOpen(post)}} aria-label={'Mở bài viết chứa '+(item.kind==='video'?'video':'ảnh')}>
      {item.kind==='image'?<img src={item.url} alt={item.name||'Ảnh bài viết'} loading="lazy"/>:<video src={item.url} preload="metadata" aria-label={item.name||'Video bài viết'}/>}
    </button>)}</div></section>}
    {visibleTab==='about' && <section className="profile-page-subsection"><h2>Giới thiệu</h2>{profile.bio&&<p>{profile.bio}</p>}{profile.city&&<p><MapPin size={18} aria-hidden="true"/>Sống tại {profile.city}</p>}<small>Chỉ thông tin công khai được hiển thị.</small></section>}
        {visibleTab==='posts' && <>

      {!mobile && <div className="profile-page-about profile-page-timeline-heading"><h2>Bài viết</h2></div>}
    <div className={mobile ? "feed zalo-feed -mx-4! w-[calc(100%+32px)]! border-t-8 border-solid border-background border-x-0 border-b-0" : "profile-page-post-feed feed zalo-feed app-mobile:-mx-3! app-mobile:w-[calc(100%+24px)]!"}>{posts.map(post=><FeedPostCard key={post.id} post={post} name={currentUser} onAuthorOpen={onUserOpen} onEditPost={onEditPost} taggedNames={taggedNames} apiFetch={request} syncFeedPost={update} removeFeedPost={id=>{setPosts(current=>current.filter(post=>post.id!==id));onDeleted(id)}} setNotice={feedback} token={token} translationPreferencesLoaded targetLanguage={targetLanguage} setActivePostId={(id)=>{if(id===post.id)onPostOpen(post);else onOpenOriginal?.(id)}} onRepostChanged={onRepostChanged} onShareToChat={onShareToChat} likePreviews={likeBusy} like={like} onReactionUsers={onReactionUsers}/>)}</div>
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