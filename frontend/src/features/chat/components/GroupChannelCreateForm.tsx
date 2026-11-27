import { useUiTranslation } from '@/shared/i18n/locale'
import { useRef, useState, type FormEvent } from 'react'
import { Hash, Plus, X } from 'lucide-react'
import '../styles/group-channel-picker.css'
import '../styles/group-channel-create-info.css'

type Props = {
  busy: boolean
  onCreate: (name: string, description: string) => Promise<boolean>
  onCancel: () => void
}

export default function GroupChannelCreateForm({ busy, onCreate, onCancel }: Props) {
  const trUi = useUiTranslation()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const submitting = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || busy || submitting.current) return
    submitting.current = true
    try {
      if (await onCreate(name.trim(), description.trim())) onCancel()
    } finally {
      submitting.current = false
    }
  }

  return (
    <div className="group-channel-creator conversation-info-create-channel">
      <form className="group-channel-create-form" onSubmit={event => void submit(event)}>
        <div className="group-channel-create-heading">
          <div className="group-channel-create-intro">
            <span className="group-channel-create-symbol"><Hash size={17} aria-hidden="true" /></span>
            <div>
              <strong>{trUi("chat.newChannel")}</strong>
              <small>Chỉ trưởng nhóm có quyền tạo kênh.</small>
            </div>
          </div>
          <button type="button" className="group-channel-create-close" aria-label={trUi("chat.closeNewChannel")} onClick={onCancel} disabled={busy}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <label className="group-channel-create-field">
          <span>{trUi("chat.channelName") + ' '}<b aria-hidden="true">*</b></span>
          <input autoFocus required aria-label={trUi("chat.channelNameNew")} maxLength={80}
            placeholder={trUi("common.ui.channelNameExample")}
            value={name} onChange={event => setName(event.target.value)} disabled={busy} />
        </label>
        <label className="group-channel-create-field">
          <span>{trUi("common.description") + ' '}<small>{trUi("common.optional")}</small></span>
          <textarea aria-label={trUi("chat.channelDescriptionNew")} rows={3} maxLength={500}
            placeholder={trUi("common.ui.channelTopicPlaceholder")}
            value={description} onChange={event => setDescription(event.target.value)} disabled={busy} />
        </label>
        <div className="group-channel-create-actions">
          <button type="button" className="group-channel-create-cancel" onClick={onCancel} disabled={busy}>{trUi("common.cancel")}</button>
          <button type="submit" className="group-channel-create-submit" disabled={busy || !name.trim()}>
            <Plus size={15} aria-hidden="true" />
            {busy ? trUi("common.creating") : trUi("chat.createChannel")}
          </button>
        </div>
      </form>
    </div>
  )
}
