import { Bell, Check, FileText, Files, Globe2, LockKeyhole } from 'lucide-react'
import { useGroupManagementDetails, type Community, type GroupManagementDetailsProps } from '../hooks/useGroupManagementDetails'

export default function GroupManagementDetails({ conversationId, section, canEdit, request, notify, onOpenShared }: GroupManagementDetailsProps) {
  const { community, setCommunity, preferences, setPreferences, files, loading, busy, error, saveCommunity, saveNotifications } =
    useGroupManagementDetails({ conversationId, section, canEdit, request, notify })

  if (loading) return <p className="group-management-empty" role="status">Đang tải dữ liệu nhóm...</p>
  return <div className="group-management-detail" aria-label={section === 'details' ? 'Thông tin cộng đồng' : section === 'rules' ? 'Nội quy nhóm' : section === 'notifications' ? 'Thông báo nhóm' : 'Tệp đã chia sẻ'}>
    {error && <p className="group-management-error" role="alert">{error}</p>}

    {section === 'details' && <div className="group-management-form">
      <p className="group-management-help"><Globe2 size={16} aria-hidden="true" /> Thông tin hiển thị với các thành viên của cộng đồng.</p>
      <label>Giới thiệu
        <textarea rows={4} maxLength={500} aria-label="Mô tả cộng đồng" placeholder="Giới thiệu về cộng đồng..." disabled={!canEdit || busy}
          value={community.description} onChange={event => setCommunity(v => ({ ...v, description: event.target.value }))} />
      </label>
      <label>Chủ đề
        <input aria-label="Chủ đề cộng đồng" maxLength={100} placeholder="Ví dụ: Công nghệ, học tập..." disabled={!canEdit || busy}
          value={community.topic} onChange={event => setCommunity(v => ({ ...v, topic: event.target.value }))} />
      </label>
      <label>Quyền truy cập
        <select aria-label="Quyền truy cập cộng đồng" disabled={!canEdit || busy} value={community.visibility}
          onChange={event => setCommunity(v => ({ ...v, visibility: event.target.value as Community['visibility'] }))}>
          <option value="private">Nhóm riêng tư</option>
          <option value="public">Cộng đồng công khai</option>
        </select>
      </label>
      {!canEdit && <p className="group-management-help"><LockKeyhole size={16} aria-hidden="true" /> Chỉ người có quyền quản trị mới có thể chỉnh sửa.</p>}
      {canEdit && <button type="button" className="group-management-save" disabled={busy} onClick={() => void saveCommunity()}><Check size={16} /> Lưu thông tin</button>}
    </div>}

    {section === 'rules' && <div className="group-management-form">
      <p className="group-management-help"><FileText size={16} aria-hidden="true" /> Nội quy giúp mọi thành viên trao đổi văn minh.</p>
      <label>Nội quy nhóm
        <textarea aria-label="Nội quy cộng đồng" rows={9} maxLength={5000} placeholder="Nhập nội quy nhóm..." disabled={!canEdit || busy}
          value={community.rules} onChange={event => setCommunity(v => ({ ...v, rules: event.target.value }))} />
      </label>
      {canEdit && <button type="button" className="group-management-save" disabled={busy} onClick={() => void saveCommunity()}><Check size={16} /> Lưu nội quy</button>}
      {!canEdit && <p className="group-management-help">Bạn có thể xem nội quy do quản trị viên thiết lập.</p>}
    </div>}

    {section === 'notifications' && <div className="group-management-form">
      <p className="group-management-help"><Bell size={16} aria-hidden="true" /> Tùy chọn được lưu riêng cho tài khoản của bạn.</p>
      <label className="group-management-check"><input type="checkbox" checked={preferences.messageNotifications}
        onChange={event => setPreferences(v => ({ ...v, messageNotifications: event.target.checked }))} /> Thông báo tin nhắn mới</label>
      <label className="group-management-check"><input type="checkbox" checked={preferences.mentionNotifications}
        onChange={event => setPreferences(v => ({ ...v, mentionNotifications: event.target.checked }))} /> Thông báo khi được nhắc tên</label>
      <button type="button" className="group-management-save" disabled={busy} onClick={() => void saveNotifications()}><Check size={16} /> Lưu cài đặt</button>
    </div>}

    {section === 'files' && <div className="group-management-form">
      <p className="group-management-help"><Files size={16} aria-hidden="true" /> Tệp đã được chia sẻ trong phần thảo luận chung.</p>
      {files.length === 0 && <p className="group-management-empty">Chưa có tệp được chia sẻ.</p>}
      {files.flatMap(message => (message.attachments || [])
        .filter(attachment => attachment.kind === 'file' || attachment.kind === 'audio')
        .map(attachment => (
          <div className="group-management-file" key={`${message.id}-${attachment.id}`}>
            <FileText size={18} aria-hidden="true" /><span title={attachment.name}>{attachment.name || 'Tệp đính kèm'}</span>
          </div>
        )))}
      <button type="button" className="group-management-save secondary" onClick={onOpenShared}>Xem kho nội dung chia sẻ</button>
    </div>}
  </div>
}