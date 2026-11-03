import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import '../../styles/connection-tools.css'

type Member = { id: number; username: string; displayName: string }

export default function GroupCreator({ ownerId, friends, query, onQuery, onCreate, onClose, error }: {
  ownerId: number
  friends: Member[]
  query: string
  onQuery: (value: string) => void
  onCreate: (name: string, usernames: string[]) => Promise<void>
  onClose: () => void
  error: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Member[]>([])
  const [busy, setBusy] = useState(false)
  const [validation, setValidation] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  const normalizedQuery = query.trim().replace(/^@/, '').toLocaleLowerCase('vi-VN')
  const matchingFriends = friends.filter((member) =>
    `${member.displayName} ${member.username}`.toLocaleLowerCase('vi-VN').includes(normalizedQuery))
  const members = matchingFriends.filter((member) => member.id !== ownerId)
  const suggestedName = selected.length ? `Nhóm ${selected.map((member) => member.displayName || member.username).join(', ')}` : 'Nhóm mới'
  const defaultName = new TextEncoder().encode(suggestedName).length <= 120 ? suggestedName : 'Nhóm mới'

  function toggle(member: Member) {
    setSelected((current) => current.some((item) => item.id === member.id)
      ? current.filter((item) => item.id !== member.id) : [...current, member])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || !selected.length) return
    const groupName = name.trim() || defaultName
    if (new TextEncoder().encode(groupName).length > 120) {
      setValidation('Tên nhóm quá dài. Rút ngắn tên rồi thử lại.')
      return
    }
    setValidation('')
    submitting.current = true
    setBusy(true)
    try { await onCreate(groupName, selected.map((member) => member.username)) }
    finally { submitting.current = false; setBusy(false) }
  }

  return (
    <dialog ref={dialog} className="connection-dialog" aria-labelledby="group-create-title"
      onCancel={(event) => { if (submitting.current) event.preventDefault(); else onClose() }}>
      <header><h2 id="group-create-title">Tạo nhóm</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Đóng tạo nhóm" title="Đóng tạo nhóm"><X size={20} /></button></header>
      <form className="group-create-form" onSubmit={(event) => void submit(event)}>
        <label>Tên nhóm (không bắt buộc)<input value={name} onChange={(event) => setName(event.target.value)} placeholder={defaultName} maxLength={120} disabled={busy} /></label>
        <label>Thêm thành viên<input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Tìm trong danh sách bạn bè" disabled={busy} autoFocus /></label>
        {!!selected.length && <div className="group-selection" aria-label="Thành viên đã chọn">
          {selected.map((member) => <button key={member.id} type="button" onClick={() => toggle(member)} disabled={busy} aria-label={`Bỏ chọn ${member.displayName || member.username}`}>{member.displayName || member.username} ×</button>)}
        </div>}
        <p className="group-count" aria-live="polite">{selected.length + 1} thành viên, gồm bạn</p>
        <div className="group-members" aria-label="Chọn bạn bè">
          {members.map((member) => (
            <label key={member.id} className="group-member">
              <span><strong>{member.displayName || member.username}</strong><small>@{member.username}</small></span>
              <input type="checkbox" checked={selected.some((item) => item.id === member.id)} onChange={() => toggle(member)} disabled={busy} aria-label={`Chọn ${member.displayName || member.username}`} />
            </label>
          ))}
          {!members.length && <p>{query.trim() ? 'Không tìm thấy bạn bè phù hợp.' : 'Chưa có bạn bè để mời vào nhóm.'}</p>}
        </div>
        {(validation || error) && <p className="connection-message" role="alert">{validation || error}</p>}
        <button className="connection-primary" disabled={!selected.length || busy}>{busy ? 'Đang tạo...' : `Tạo nhóm${selected.length ? ` · ${selected.length + 1} người` : ''}`}</button>
      </form>
    </dialog>
  )
}