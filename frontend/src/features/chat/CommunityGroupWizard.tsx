import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Plus, Search, ShieldCheck, Users, X } from 'lucide-react'
import type { FriendConnection } from '../contacts/types'
import UserAvatar from '../../shared/ui/UserAvatar'

export type CommunityCreationExtras = { description: string; topic: string; rules: string; visibility: 'public' | 'private' }

type Props = {
  friends: FriendConnection[]
  userId: number
  myName: string
  step: 1 | 2 | 3
  onStep: (step: 1 | 2 | 3) => void
  onCancel: () => void
  onCreate: (name: string, usernames: string[], extras: CommunityCreationExtras) => Promise<number | null>
  error: string
}

export default function CommunityGroupWizard({ friends, userId, myName, step, onStep, onCancel, onCreate, error }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [topic, setTopic] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [validation, setValidation] = useState('')
  const accepted = friends.filter(friend => friend.status === 'accepted' && friend.id !== userId)
  const chosen = accepted.filter(friend => selected.includes(friend.id))
  const filtered = accepted.filter(friend => (friend.displayName + ' ' + friend.username).toLocaleLowerCase('vi-VN').includes(query.toLocaleLowerCase('vi-VN')))
  const toggle = (id: number) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 50 ? [...current, id] : current)
  const goNext = () => {
    if (step === 1 && (!name.trim() || new TextEncoder().encode(name.trim()).length > 120)) {
      setValidation('Tên nhóm là bắt buộc và tối đa 120 byte.')
      return
    }
    setValidation('')
    onStep(step === 1 ? 2 : 3)
  }
  async function create() {
    if (busy) return
    setBusy(true)
    try { await onCreate(name.trim(), chosen.map(friend => friend.username), { description: description.trim(), topic: topic.trim(), rules: '', visibility }) }
    finally { setBusy(false) }
  }

  return <div className="cg-page cg-wizard" aria-label="Tạo cộng đồng mới">
    <div className="cg-card cg-wizard-card">
      <nav className="cg-steps" aria-label="Quy trình tạo nhóm">
        {([1,2,3] as const).map(num => <div key={num} className={'cg-step ' + (step===num?'active':step>num?'completed':'')}>
          <b>{String(num).padStart(2,'0')}</b><strong>{num===1?'Thông tin':num===2?'Thành viên':'Xác nhận'}</strong>
        </div>)}
      </nav>
      {step === 1 && <div className="cg-create-info">
        <section className="cg-fields">
          <h2>Thông tin nhóm</h2><p className="cg-muted">Đặt tên và chọn cách mọi người tham gia cộng đồng.</p>
          <label>Tên nhóm *<input type="text" aria-label="Tên nhóm" maxLength={120} value={name} onChange={e=>{setName(e.target.value);setValidation('')}} placeholder="SocCo Product Community"/></label>
          <label>Mô tả<input type="text" aria-label="Mô tả" value={description} maxLength={300} onChange={e=>setDescription(e.target.value)} placeholder="Nơi chia sẻ ý tưởng và cập nhật sản phẩm"/></label>
          <label>Chủ đề<input type="text" aria-label="Chủ đề" value={topic} maxLength={100} onChange={e=>setTopic(e.target.value)} placeholder="Công nghệ · Sản phẩm · Cộng đồng"/></label>
          <strong>Quyền truy cập</strong>
          <label className={visibility==='public'?'cg-access selected':'cg-access'}><input type="radio" checked={visibility==='public'} name="cg-privacy" onChange={()=>setVisibility('public')}/><span><b>Công khai</b><small>Mọi người có thể tìm thấy và tham gia hoặc gửi yêu cầu duyệt.</small></span></label>
          <label className={visibility==='private'?'cg-access selected':'cg-access'}><input type="radio" checked={visibility==='private'} name="cg-privacy" onChange={()=>setVisibility('private')}/><span><b>Riêng tư</b><small>Tham gia khi được mời hoặc phê duyệt.</small></span></label>
        </section>
        <aside className="cg-preview">
          <h3>Xem trước cộng đồng</h3>
          <div className="cg-preview-cover"/><div className="cg-preview-icon"><Users size={25}/></div>
          <h3>{name.trim() || 'Tên cộng đồng'}</h3><p>{visibility==='public'?'Nhóm công khai · Có thể tìm kiếm':'Nhóm riêng tư · Chờ mời thành viên'}</p><small>Chủ nhóm: {myName}</small>
          {description&&<p>{description}</p>}
          <div className="cg-preview-tip"><ShieldCheck size={18}/>Quyền và nội quy được thiết lập sau.</div>
        </aside>
      </div>}
      {step === 2 && <>
        <div className="cg-wizard-title"><div><h2>Mời thành viên đầu tiên</h2><p className="cg-muted">Bạn có thể thêm bạn bè ngay bây giờ hoặc sau khi tạo.</p></div><small>1. Thông tin　2. Thành viên　3. Xong</small></div>
        <div className="cg-member-picker">
          <section className="cg-card cg-pick-list"><h3>Danh sách bạn bè</h3>
            <label className="cg-search"><Search size={18}/><input type="search" aria-label="Tìm thành viên" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm theo tên hoặc ID SocCo..."/></label>
            <div className="cg-pick-options">{filtered.map(friend => <button type="button" key={friend.id} className={'cg-pick-row'+(selected.includes(friend.id)?' selected':'')} aria-pressed={selected.includes(friend.id)} onClick={()=>toggle(friend.id)}>
              <UserAvatar username={friend.username} name={friend.displayName||friend.username} className="avatar cg-avatar" online={friend.online}/>
              <span><strong>{friend.displayName||friend.username}</strong><small>{selected.includes(friend.id)?'Đã chọn':'Bạn bè'}</small></span>
              {selected.includes(friend.id)&&<CheckCircle2 size={21}/>}
            </button>)}{!filtered.length&&<p className="cg-empty">Không có bạn bè phù hợp.</p>}</div>
          </section>
          <aside className="cg-card cg-selected-members"><h3>Đã chọn ({chosen.length})</h3><p className="cg-muted">Chủ nhóm có thể quản lý thành viên sau này.</p>
            <div>{chosen.map(friend=><div key={friend.id} className="cg-selected-row"><UserAvatar username={friend.username} name={friend.displayName||friend.username} className="avatar cg-avatar"/><strong>{friend.displayName||friend.username}</strong><button type="button" aria-label={'Bỏ chọn '+(friend.displayName||friend.username)} onClick={()=>toggle(friend.id)}><X size={17}/></button></div>)}</div>
            <div className="cg-picker-tip"><ShieldCheck size={19}/>Nhóm riêng tư · Mời theo yêu cầu</div>
          </aside>
        </div>
      </>}
      {step === 3 && <div className="cg-confirm">
        <CheckCircle2 size={45}/><h2>Xác nhận tạo nhóm</h2><p>Kiểm tra thông tin trước khi lưu.</p>
        <dl><dt>Tên nhóm</dt><dd>{name}</dd><dt>Quyền truy cập</dt><dd>{visibility==='public'?'Công khai':'Riêng tư'}</dd><dt>Chủ đề</dt><dd>{topic||'Chưa đặt'}</dd><dt>Thành viên mời</dt><dd>{chosen.length} người</dd></dl>
        {chosen.length>0&&<p>{chosen.map(friend=>friend.displayName||friend.username).join(', ')}</p>}
        {description&&<p>Mô tả: {description}</p>}
      </div>}
      {(validation||error)&&<p className="cg-error" role="alert">{validation||error}</p>}
      <footer className="cg-wizard-footer"><button type="button" className="cg-secondary" disabled={busy} onClick={()=>step===1?onCancel():onStep(step===3?2:1)}><X size={18}/>{step===1?'Hủy':'Quay lại'}</button>
        {step<3?<button type="button" className="cg-primary" onClick={goNext}><ArrowRight size={18}/>Tiếp: {step===1?'Mời thành viên':'Xác nhận'}</button>:
        <button type="button" className="cg-primary" onClick={()=>void create()} disabled={busy}><Check size={17}/>Tạo nhóm</button>}
      </footer>
    </div>
  </div>
}
