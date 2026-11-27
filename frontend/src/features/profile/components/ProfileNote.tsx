import { useUiTranslation } from '@/shared/i18n/locale'
import BubbleTextarea from '../../../shared/ui/BubbleTextarea'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Plus, Trash2, X, LockKeyhole, Users, Globe, RefreshCw } from 'lucide-react'
import { useLatest } from '../../../shared/hooks/useLatest'
import '../styles/profile-note.css'
import { loadProfileNote, saveProfileNote, deleteProfileNote } from '../api/profile'
type Note = { content: string; visibility: 'friends'|'public'|'private'; version: string; createdAt: string; expiresAt: string }
type Props = { username: string; displayName?: string; owner?: boolean; refreshKey?: string; request: (path: string, init?: RequestInit) => Promise<Response> }
// Keyed so a note, its draft and pending requests never carry over to another profile or relation.
export default function ProfileNote(props: Props) {
 return <ProfileNoteSession key={JSON.stringify([props.username, props.owner ?? false, props.refreshKey])} {...props} />
}
function ProfileNoteSession({ username, displayName = username, owner = false, request }: Props) {
  const trUi = useUiTranslation()

 const [note,setNote] = useState<Note|null>(null)
 const [loaded,setLoaded] = useState(false)
 const [error,setError] = useState('')
 const [draft,setDraft] = useState('')
 const [visibility,setVisibility] = useState<Note['visibility']>('friends')
 const [busy,setBusy] = useState(false)
 const [confirm,setConfirm] = useState(false)
 const dialog = useRef<HTMLDialogElement>(null)
 const trigger = useRef<HTMLButtonElement>(null)
 const apiRef = useLatest(request)
 const alive = useRef(false)
 const seq = useRef(0)
 const writing = useRef(false)
 const mutationRevision = useRef(0)
 const [now,setNow] = useState(() => Date.now())
 useEffect(()=>{
  const timer=window.setInterval(()=>setNow(Date.now()),30_000)
  return()=>window.clearInterval(timer)
 },[])
 const currentNote = note && Date.parse(note.expiresAt)>now ? note : null
 const count = Array.from(draft.trim()).length
 const load=useCallback((force=false)=>{
  const version=++seq.current
  return loadProfileNote(apiRef.current, username, owner, force).then(async response=>{
   if(!response.ok)throw new Error('Không tải được ghi chú.')
   const data=await response.json() as {note:Note|null}
   if(!alive.current||version!==seq.current)return
   setNote(data.note);setLoaded(true);setError('')
  }).catch(e=>{if(alive.current&&version===seq.current){setNote(null);setLoaded(true);setError(e instanceof Error?e.message:'Không tải được ghi chú.')}})
 },[apiRef,username,owner])
 useEffect(()=>{
  const reads=seq
  alive.current=true // set in the effect so StrictMode's second setup restores it
  void load()
  const visible=()=>{if(document.visibilityState==='visible'&&!writing.current)void load()}
  document.addEventListener('visibilitychange',visible)
  return()=>{alive.current=false;++reads.current;document.removeEventListener('visibilitychange',visible)}
 },[load])
 const expiresAt=note?.expiresAt
 useEffect(()=>{
  if(!expiresAt)return
  const timer=window.setTimeout(()=>setNote(null),Math.max(0,Date.parse(expiresAt)-Date.now()))
  return()=>window.clearTimeout(timer)
 },[expiresAt])
 async function publishOrDelete(remove=false) {
  if(writing.current||(!remove&&(count<1||count>60)))return
  const revision=++mutationRevision.current
  writing.current=true;setBusy(true);setError('');++seq.current
  try {
   const response=await (remove ? deleteProfileNote(apiRef.current, currentNote?.version) : saveProfileNote(apiRef.current, draft.trim(), visibility))
   const data=await response.json() as {note:Note|null;error?:string}
   if(!alive.current||revision!==mutationRevision.current)return
   if(!response.ok)throw new Error(data.error||'Chưa lưu được ghi chú. Hãy tải lại để kiểm tra.')
   setNote(data.note);setLoaded(true);setDraft('');setConfirm(false);dialog.current?.close()
  }catch(e){if(alive.current&&revision===mutationRevision.current)setError(e instanceof Error?e.message:'Chưa lưu được ghi chú. Hãy tải lại để kiểm tra.')}
  finally{if(revision===mutationRevision.current){writing.current=false;if(alive.current)setBusy(false)}}
 }
 if(!owner&&!currentNote)return null
 return <span className="profile-note" onClick={e=>e.stopPropagation()}>
  {loaded&&<button ref={trigger} type="button" className={'profile-note-bubble'+(currentNote?' has-note':'')}
   aria-label={currentNote?trUi("common.ui.viewNote"):trUi("profile.postNote")} title={currentNote?.content} disabled={busy}
   onClick={()=>{setConfirm(false);dialog.current?.showModal()}}>
   {currentNote?<span>{currentNote.content}</span>:<><Plus size={13}/><span>{error?trUi("profile.reloadNote"):trUi("profile.shareThoughts")}</span></>}
  </button>}
  <dialog ref={dialog} className="profile-note-dialog" aria-label={currentNote?trUi("common.note"):trUi("profile.postNote")}
   onClose={()=>trigger.current?.focus()} onCancel={e=>{if(busy)e.preventDefault()}}>
   <header><div><MessageCircle size={20}/><h2>{currentNote?trUi("common.note"):'Chia sẻ suy nghĩ'}</h2></div>
    <button type="button" aria-label={trUi("common.ui.closeNote")} disabled={busy} onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
   {currentNote?<div className="profile-note-body">
    <p className="profile-note-full">{currentNote.content}</p>
    <small className="profile-note-meta">{currentNote.visibility==='friends'?<Users size={14}/>:currentNote.visibility==='private'?<LockKeyhole size={14}/>:<Globe size={14}/>}
     {currentNote.visibility==='friends'?trUi("contacts.friends"):currentNote.visibility==='private'?trUi("profile.onlyMe"):trUi("common.public")} · Tự hết hạn sau 24 giờ</small>
    {owner&&<div className="profile-note-delete">
     {confirm&&<p>Xóa ghi chú này? Bạn có thể đăng ghi chú mới sau đó.</p>}
     <button type="button" disabled={busy} onClick={()=>confirm?void publishOrDelete(true):setConfirm(true)}><Trash2 size={16}/>{busy?'Đang xóa…':confirm?trUi("common.deleteConfirm"):'Xóa ghi chú'}</button>
     {confirm&&<button type="button" disabled={busy} onClick={()=>setConfirm(false)}>{trUi("common.keep")}</button>}
    </div>}
   </div>:owner&&<form className="profile-note-body" onSubmit={e=>{e.preventDefault();void publishOrDelete()}}>
    <p className="profile-note-hint">Một suy nghĩ nhỏ, một ngày mới. Ghi chú hiển thị trong 24 giờ.</p>
    <div className="profile-note-compose">
     <BubbleTextarea className="profile-note-input-bubble" aria-label={trUi("chat.noteContent")} placeholder={trUi("profile.shareThoughts")} value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} autoFocus />
     <UserAvatar username={username} name={displayName} className="profile-note-compose-avatar" />
     <span className={'profile-note-count'+(count>60?' over-limit':'')}>{count}/60</span>
    </div>
    <label className="profile-note-audience"><Users size={16}/><span>Ai có thể xem?</span>
     <select aria-label={trUi("common.ui.noteAudience")} value={visibility} disabled={busy} onChange={e=>setVisibility(e.target.value as Note['visibility'])}>
      <option value="friends">{trUi("contacts.friends")}</option><option value="public">{trUi("common.public")}</option><option value="private">{trUi("profile.onlyMe")}</option>
     </select></label>
    <button type="submit" className="profile-note-publish" disabled={busy||!loaded||!!error||count<1||count>60}>{trUi("profile.postNote")}</button>
   </form>}
   {error&&<div className="profile-note-error" role="alert"><span>{error}</span><button type="button" disabled={busy} onClick={()=>void load(true)}><RefreshCw size={14}/>{trUi("profile.reloadNote")}</button></div>}
  </dialog>
 </span>
}