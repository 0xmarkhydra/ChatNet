import { useState } from 'react'
import './feed-actions.css'
import { Bookmark, Check, Copy, Ellipsis, Flag, Pencil, Share2, Trash2, X } from 'lucide-react'
export type FeedActionPost={id:number;author:string;content:string;visibility?:'public'|'friends'|'private';background?:string;saved?:boolean;attachments?:unknown[]}
type Props<P extends FeedActionPost>={post:P;mine:boolean;request:(path:string,options?:RequestInit)=>Promise<Response>;onUpdated:(post:P)=>void;onDeleted:(id:number)=>void;onFeedback:(text:string,kind?:'success'|'error')=>void;quick?:boolean}
const choices=[{id:'public',text:'🌐 Công khai'},{id:'friends',text:'👥 Bạn bè'},{id:'private',text:'🔒 Chỉ mình tôi'}]
const backgrounds=['','violet','blue','sunset','mint','night']
const reasons=['Nội dung spam','Quấy rối hoặc xúc phạm','Lừa đảo hoặc giả mạo','Thông tin gây hiểu lầm','Nội dung không phù hợp']
export default function FeedPostActions<P extends FeedActionPost>({post,mine,request,onUpdated,onDeleted,onFeedback,quick=false}:Props<P>){
 const [open,setOpen]=useState(false),[editing,setEditing]=useState(false),[reporting,setReporting]=useState(false),[busy,setBusy]=useState(false)
 const [content,setContent]=useState(post.content),[visibility,setVisibility]=useState(post.visibility||'public'),[background,setBackground]=useState(post.background||'')
 const [reason,setReason]=useState(reasons[0])
 const url='/api/posts/'+post.id
 async function send(path:string,opts:RequestInit):Promise<Response>{
  const r=await request(path,opts)
  if(!r.ok){const e=await r.json().catch(()=>({})) as {error?:string};throw new Error(e.error||'Thao tác thất bại')}
  return r
 }
 async function act(fn:()=>Promise<void>){if(busy)return;setBusy(true);try{await fn()}catch(e){onFeedback(e instanceof Error?e.message:'Thao tác thất bại','error')}finally{setBusy(false)}}
 function startEdit(){setContent(post.content);setVisibility(post.visibility||'public');setBackground(post.background||'');setReporting(false);setEditing(true);setOpen(true)}
 async function saveEdit(){await act(async()=>{const r=await send(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:content.trim(),visibility,background})});onUpdated(await r.json() as P);setEditing(false);setOpen(false);onFeedback('Đã cập nhật bài viết.','success')})}
 async function remove(){if(!window.confirm('Xóa bài viết này?'))return;await act(async()=>{await send(url,{method:'DELETE'});onDeleted(post.id);onFeedback('Đã xóa bài viết.','success')})}
 async function toggleSaved(){await act(async()=>{const r=await send(url+'/save',{method:'POST'});const v=await r.json() as P;onUpdated(v);setOpen(false);onFeedback(v.saved?'Đã lưu bài viết.':'Đã bỏ lưu bài viết.','success')})}
 async function report(){await act(async()=>{await send('/api/feed/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetType:'post',targetId:post.id,reason})});setReporting(false);setOpen(false);onFeedback('Đã gửi báo cáo.','success')})}
 async function share(copyOnly=false){
  const u=new URL(window.location.href);u.searchParams.set('tab','feed');u.searchParams.set('post',String(post.id))
  try{if(!copyOnly&&navigator.share) await navigator.share({title:'ChatNet',url:u.toString()});else {await navigator.clipboard.writeText(u.toString());onFeedback('Đã sao chép liên kết.','success')}setOpen(false)}
  catch(e){if((e as Error).name!=='AbortError')onFeedback('Không chia sẻ được bài viết.','error')}
 }
 return <div className={'feed-actions-root'+(quick ? ' feed-actions-quick' : '')}>
  {quick ? (
   <div className="feed-owner-shortcuts" aria-label="Quản lý bài viết của bạn">
    <button type="button" className="feed-owner-edit" onClick={startEdit} aria-label="Sửa bài viết"><Pencil size={16}/>Sửa</button>
    <button type="button" className="feed-owner-delete" disabled={busy} onClick={()=>void remove()} aria-label="Xóa bài viết"><Trash2 size={16}/>Xóa</button>
   </div>
  ) : <button type="button" className="post-more" aria-label="Tùy chọn bài viết" aria-expanded={open} onClick={()=>{setOpen(!open);setEditing(false);setReporting(false)}}><Ellipsis size={20}/></button>}
  {open&&<div className="feed-actions-panel" role="group" aria-label="Tùy chọn bài viết">
   <div className="feed-actions-header"><strong>Tùy chọn</strong><button type="button" aria-label="Đóng" onClick={()=>setOpen(false)}><X size={17}/></button></div>
   {editing?<div className="feed-actions-editor">
    <label>Nội dung<textarea rows={4} maxLength={5000} value={content} onChange={e=>setContent(e.target.value)}/></label>
    <label>Quyền xem<select value={visibility} onChange={e=>setVisibility(e.target.value as typeof visibility)}>{choices.map(x=><option key={x.id} value={x.id}>{x.text}</option>)}</select></label>
    <span>Nền bài viết</span><div className="feed-background-palette">{backgrounds.map(x=><button type="button" key={x||'none'} className={'feed-palette-dot bg-'+(x||'none')} aria-label={x||'Không nền'} aria-pressed={background===x} onClick={()=>setBackground(x)}>{background===x&&<Check size={14}/>}</button>)}</div>
    <div className="feed-actions-footer"><button type="button" onClick={()=>setEditing(false)}>Hủy</button><button type="button" disabled={busy||(!content.trim()&&!post.attachments?.length)} onClick={()=>void saveEdit()}>Lưu</button></div>
   </div>:reporting?<div className="feed-actions-editor">
    <label>Lý do báo cáo<select value={reason} onChange={e=>setReason(e.target.value)}>{reasons.map(x=><option key={x}>{x}</option>)}</select></label>
    <div className="feed-actions-footer"><button type="button" onClick={()=>setReporting(false)}>Hủy</button><button type="button" disabled={busy} onClick={()=>void report()}>Gửi báo cáo</button></div>
   </div>:<div className="feed-actions-list">
    <button type="button" disabled={busy} onClick={()=>void toggleSaved()}><Bookmark size={18}/>{post.saved?'Bỏ lưu bài':'Lưu bài viết'}</button>
    <button type="button" onClick={()=>void share()}><Share2 size={18}/>Chia sẻ</button>
    <button type="button" onClick={()=>void share(true)}><Copy size={18}/>Sao chép liên kết</button>
    {mine?<><button type="button" onClick={startEdit}><Pencil size={18}/>Chỉnh sửa</button><button type="button" className="danger" disabled={busy} onClick={()=>void remove()}><Trash2 size={18}/>Xóa bài viết</button></>:<button type="button" onClick={()=>setReporting(true)}><Flag size={18}/>Báo cáo nội dung</button>}
   </div>}
  </div>}
 </div>
}