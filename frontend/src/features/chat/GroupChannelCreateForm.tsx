import { useState, type FormEvent } from 'react'
import { Hash, Plus, X } from 'lucide-react'
import './group-channel-picker.css'
import './group-channel-create-info.css'

type Props = {
  busy: boolean
  onCreate: (name: string, description: string) => Promise<boolean>
  onCancel: () => void
}

export default function GroupChannelCreateForm({ busy, onCreate, onCancel }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || busy) return
    if (await onCreate(name.trim(), description.trim())) onCancel()
  }

  return (
    <div className="group-channel-creator conversation-info-create-channel">
      <form className="group-channel-create-form" onSubmit={event => void submit(event)}>
        <div className="group-channel-create-heading">
          <div className="group-channel-create-intro">
            <span className="group-channel-create-symbol"><Hash size={17} aria-hidden="true" /></span>
            <div>
              <strong>Tạo kênh hội thoại</strong>
              <small>Chỉ trưởng nhóm có quyền tạo kênh.</small>
            </div>
          </div>
          <button type="button" className="group-channel-create-close" aria-label="Đóng tạo kênh" onClick={onCancel} disabled={busy}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <label className="group-channel-create-field">
          <span>Tên kênh <b aria-hidden="true">*</b></span>
          <input autoFocus required aria-label="Tên kênh mới" maxLength={80}
            placeholder="Ví dụ: Công việc, Thông báo..."
            value={name} onChange={event => setName(event.target.value)} disabled={busy} />
        </label>
        <label className="group-channel-create-field">
          <span>Mô tả <small>(không bắt buộc)</small></span>
          <textarea aria-label="Mô tả kênh mới" rows={3} maxLength={500}
            placeholder="Chủ đề thảo luận trong kênh..."
            value={description} onChange={event => setDescription(event.target.value)} disabled={busy} />
        </label>
        <div className="group-channel-create-actions">
          <button type="button" className="group-channel-create-cancel" onClick={onCancel} disabled={busy}>Hủy</button>
          <button type="submit" className="group-channel-create-submit" disabled={busy || !name.trim()}>
            <Plus size={15} aria-hidden="true" />
            {busy ? 'Đang tạo...' : 'Tạo kênh'}
          </button>
        </div>
      </form>
    </div>
  )
}
