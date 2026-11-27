import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import '../../../shared/ui/connection-tools.css'

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
  const trUi = useUiTranslation()

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
  const suggestedName = selected.length ? trUi('common.ui.groupWithNames', { names: selected.map((member) => member.displayName || member.username).join(', ') }) : trUi('common.ui.groupDefault')
  const defaultName = new TextEncoder().encode(suggestedName).length <= 120 ? suggestedName : trUi('common.ui.groupDefault')

  function toggle(member: Member) {
    setSelected((current) => current.some((item) => item.id === member.id)
      ? current.filter((item) => item.id !== member.id) : [...current, member])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || !selected.length) return
    const groupName = name.trim() || defaultName
    if (new TextEncoder().encode(groupName).length > 120) {
      setValidation(trUi('common.ui.groupNameTooLong'))
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
      <header><h2 id="group-create-title">{trUi("chat.groupCreate")}</h2><button type="button" onClick={onClose} disabled={busy} aria-label={trUi("chat.closeNewGroup")} title={trUi("chat.closeNewGroup")}><X size={20} /></button></header>
      <form className="group-create-form" onSubmit={(event) => void submit(event)}>
        <label>{trUi("common.ui.groupNameOptional")}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={defaultName} maxLength={120} disabled={busy} /></label>
        <label>{trUi("common.ui.addMembers")}<input value={query} onChange={(event) => onQuery(event.target.value)} placeholder={trUi("common.ui.findInFriends")} disabled={busy} autoFocus /></label>
        {!!selected.length && <div className="group-selection" aria-label={trUi("common.ui.selectedMembers")}>
          {selected.map((member) => <button key={member.id} type="button" onClick={() => toggle(member)} disabled={busy} aria-label={trUi('common.ui.deselectName', { name: member.displayName || member.username })}>{member.displayName || member.username} ×</button>)}
        </div>}
        <p className="group-count" aria-live="polite">{trUi('common.ui.memberCountIncludingYou', { count: selected.length + 1 })}</p>
        <div className="group-members" aria-label={trUi("common.ui.selectFriends")}>
          {members.map((member) => (
            <label key={member.id} className="group-member">
              <span><strong>{member.displayName || member.username}</strong><small>@{member.username}</small></span>
              <input type="checkbox" checked={selected.some((item) => item.id === member.id)} onChange={() => toggle(member)} disabled={busy} aria-label={trUi('common.ui.selectName', { name: member.displayName || member.username })} />
            </label>
          ))}
          {!members.length && <p>{query.trim() ? trUi("chat.noMatchingFriends") : trUi("common.ui.noFriendsToInvite")}</p>}
        </div>
        {(validation || error) && <p className="connection-message" role="alert">{validation || error}</p>}
        <button className="connection-primary" disabled={!selected.length || busy}>{selected.length ? trUi('common.ui.createGroupCount', { count: selected.length + 1 }) : trUi('chat.groupCreate')}</button>
      </form>
    </dialog>
  )
}