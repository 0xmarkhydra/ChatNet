import BubbleTextarea from '../../shared/ui/BubbleTextarea'
import UserAvatar from '../../shared/ui/UserAvatar'
import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Plus, Trash2, X, LockKeyhole, Users, Globe, RefreshCw } from 'lucide-react'
import './profile-note.css'
type Note = { content: string; visibility: 'friends'|'public'|'private'; version: string; createdAt: string; expiresAt: string }
type Props = { username: string; owner?: boolean; refreshKey?: string; request: (path: string, init?: RequestInit) => Promise<Response> }
export default function ProfileNote({ username, owner = false, refreshKey, request }: Props) {
 const [note,setNote] = useState<Note|null>(null)
 const [loaded,setLoaded] = useState(false)
 const [error,setError] = useState('')
 const [draft,setDraft] = useState('')
 const [visibility,setVisibility] = useState<Note['visibility']>('friends')
 const [busy,setBusy] = useState(false)
 const [confirm,setConfirm] = useState(false)
 const dialog = useRef<HTMLDialogElement>(null)
 const trigger = useRef<HTMLButtonElement>(null)
 const api = useRef(request); api.current=request
 const alive = useRef(false)
 const seq = useRef(0)
 const writing = useRef(false)
 const currentNote = note && Date.parse(note.expiresAt)>Date.now() ? note : null
 const count = Array.from(draft.trim()).length
 const path = owner ? '/api/profile/note' : '/api/users/'+encodeURIComponent(username)+'/note'
 async function load(force=false) {
  const version=++seq.current
  try {
   const response=await api.current(path,force?{cache:'reload'}:{})
   if(!response.ok)throw new Error('Không tải được ghi chú.')
   const data=await response.json() as {note:Note|null}
   if(!alive.current||version!==seq.current)return
   setNote(data.note);setLoaded(true);setError('')
  }catch(e){if(alive.current&&version===seq.current){setNote(null);setLoaded(true);setError(e instanceof Error?e.message:'Không tải được ghi chú.')}}
 }
 useEffect(()=>{
  alive.current=true;setNote(null);setLoaded(false);setError('');setDraft('');setConfirm(false)
  void load()
  const visible=()=>{if(document.visibilityState==='visible'&&!writing.current)void load()}
  document.addEventListener('visibilitychange',visible)
  return()=>{alive.current=false;++seq.current;document.removeEventListener('visibilitychange',visible)}
 },[username,owner,refreshKey])
 useEffect(()=>{
  if(!note)return
  const timer=window.setTimeout(()=>setNote(null),Math.max(0,Date.parse(note.expiresAt)-Date.now()))
  return()=>window.clearTimeout(timer)
 },[note?.expiresAt])
 async function publishOrDelete(remove=false) {
  if(writing.current||(!remove&&(count<1||count>60)))return
  writing.current=true;setBusy(true);setError('');++seq.current
  try {
   const response=await api.current('/api/profile/note',{method:remove?'DELETE':'POST',body:JSON.stringify(remove?{version:currentNote?.version}:{content:draft.trim(),visibility})})
   const data=await response.json() as {note:Note|null;error?:string}
   if(!alive.current)return
   if(!response.ok)throw new Error(data.error||'Chưa lưu được ghi chú. Hãy tải lại để kiểm tra.')
   setNote(data.note);setLoaded(true);setDraft('');setConfirm(false);dialog.current?.close()
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Chưa lưu được ghi chú. Hãy tải lại để kiểm tra.')}
  finally{writing.current=false;if(alive.current)setBusy(false)}
 }
 if(!owner&&!currentNote)return null
 return <span className="profile-note" onClick={e=>e.stopPropagation()}>
  {loaded&&<button ref={trigger} type="button" className={'profile-note-bubble'+(currentNote?' has-note':'')}
   aria-label={currentNote?'Xem ghi chú':'Đăng ghi chú'} title={currentNote?.content} disabled={busy}
   onClick={()=>{setConfirm(false);dialog.current?.showModal()}}>
   {currentNote?<span>{currentNote.content}</span>:<><Plus size={13}/><span>{error?'Tải lại ghi chú':'Chia sẻ suy nghĩ…'}</span></>}
  </button>}
  <dialog ref={dialog} className="profile-note-dialog" aria-label={currentNote?'Ghi chú':'Đăng ghi chú'}
   onClose={()=>trigger.current?.focus()} onCancel={e=>{if(busy)e.preventDefault()}}>
   <header><div><MessageCircle size={20}/><h2>{currentNote?'Ghi chú':'Chia sẻ suy nghĩ'}</h2></div>
    <button type="button" aria-label="Đóng ghi chú" disabled={busy} onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
   {currentNote?<div className="profile-note-body">
    <p className="profile-note-full">{currentNote.content}</p>
    <small className="profile-note-meta">{currentNote.visibility==='friends'?<Users size={14}/>:currentNote.visibility==='private'?<LockKeyhole size={14}/>:<Globe size={14}/>}
     {currentNote.visibility==='friends'?'Bạn bè':currentNote.visibility==='private'?'Chỉ mình tôi':'Công khai'} · Tự hết hạn sau 24 giờ</small>
    {owner&&<div className="profile-note-delete">
     {confirm&&<p>Xóa ghi chú này? Bạn có thể đăng ghi chú mới sau đó.</p>}
     <button type="button" disabled={busy} onClick={()=>confirm?void publishOrDelete(true):setConfirm(true)}><Trash2 size={16}/>{busy?'Đang xóa…':confirm?'Xác nhận xóa':'Xóa ghi chú'}</button>
     {confirm&&<button type="button" disabled={busy} onClick={()=>setConfirm(false)}>Giữ lại</button>}
    </div>}
   </div>:owner&&<form className="profile-note-body" onSubmit={e=>{e.preventDefault();void publishOrDelete()}}>
    <p className="profile-note-hint">Một suy nghĩ nhỏ, một ngày mới. Ghi chú hiển thị trong 24 giờ.</p>
    <div className="profile-note-compose">
     <BubbleTextarea className="profile-note-input-bubble" aria-label="Nội dung ghi chú" placeholder="Chia sẻ suy nghĩ…" value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} autoFocus />
     <UserAvatar username={username} name={username} className="profile-note-compose-avatar" />
     <span className={'profile-note-count'+(count>60?' over-limit':'')}>{count}/60</span>
    </div>
    <label className="profile-note-audience"><Users size={16}/><span>Ai có thể xem?</span>
     <select aria-label="Ai có thể xem ghi chú" value={visibility} disabled={busy} onChange={e=>setVisibility(e.target.value as Note['visibility'])}>
      <option value="friends">Bạn bè</option><option value="public">Công khai</option><option value="private">Chỉ mình tôi</option>
     </select></label>
    <button type="submit" className="profile-note-publish" disabled={busy||!loaded||!!error||count<1||count>60}>{busy?'Đang đăng…':'Đăng ghi chú'}</button>
   </form>}
   {error&&<div className="profile-note-error" role="alert"><span>{error}</span><button type="button" disabled={busy} onClick={()=>void load(true)}><RefreshCw size={14}/>Tải lại ghi chú</button></div>}
  </dialog>
 </span>
}