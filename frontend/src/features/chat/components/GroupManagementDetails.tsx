import { useUiTranslation } from '@/shared/i18n/locale'
import { Bell, Check, FileText, Globe2, LockKeyhole } from 'lucide-react'
import { useGroupManagementDetails, type Community, type GroupManagementDetailsProps } from '../hooks/useGroupManagementDetails'

export default function GroupManagementDetails({ conversationId, section, canEdit, request, notify }: GroupManagementDetailsProps) {
  const trUi = useUiTranslation()

  const { community, setCommunity, preferences, setPreferences, loading, busy, error, saveCommunity, saveNotifications } =
    useGroupManagementDetails({ conversationId, section, canEdit, request, notify })

  if (loading) return <p className="group-management-empty" role="status">Đang tải dữ liệu nhóm...</p>
  return <div className="group-management-detail" aria-label={section === 'details' ? trUi("chat.communityInfo") : section === 'rules' ? trUi("chat.groupRules") : trUi("chat.groupNotice")}>
    {error && <p className="group-management-error" role="alert">{error}</p>}

    {section === 'details' && <div className="group-management-form">
      <p className="group-management-help"><Globe2 size={16} aria-hidden="true" /> Thông tin hiển thị với các thành viên của cộng đồng.</p>
      <label>{trUi("common.about")}<textarea rows={4} maxLength={500} aria-label={trUi("chat.communityDescription")} placeholder={trUi("common.ui.communityAbout")} disabled={!canEdit || busy}
          value={community.description} onChange={event => setCommunity(v => ({ ...v, description: event.target.value }))} />
      </label>
      <label>{trUi("common.topic")}<input aria-label={trUi("chat.communityTopic")} maxLength={100} placeholder={trUi("common.ui.topicExample")} disabled={!canEdit || busy}
          value={community.topic} onChange={event => setCommunity(v => ({ ...v, topic: event.target.value }))} />
      </label>
      <label>{trUi("common.access")}<select aria-label={trUi("chat.communityAccess")} disabled={!canEdit || busy} value={community.visibility}
          onChange={event => setCommunity(v => ({ ...v, visibility: event.target.value as Community['visibility'] }))}>
          <option value="private">{trUi("chat.groupPrivate")}</option>
          <option value="public">Cộng đồng công khai</option>
        </select>
      </label>
      {!canEdit && <p className="group-management-help"><LockKeyhole size={16} aria-hidden="true" /> Chỉ người có quyền quản trị mới có thể chỉnh sửa.</p>}
      {canEdit && <button type="button" className="group-management-save" disabled={busy} onClick={() => void saveCommunity()}><Check size={16} />{trUi("chat.saveInfo")}</button>}
    </div>}

    {section === 'rules' && <div className="group-management-form">
      <p className="group-management-help"><FileText size={16} aria-hidden="true" /> Nội quy giúp mọi thành viên trao đổi văn minh.</p>
      <label>{trUi("chat.groupRules")}<textarea aria-label={trUi("chat.communityRules")} rows={9} maxLength={5000} placeholder={trUi("common.ui.groupRulesPlaceholder")} disabled={!canEdit || busy}
          value={community.rules} onChange={event => setCommunity(v => ({ ...v, rules: event.target.value }))} />
      </label>
      {canEdit && <button type="button" className="group-management-save" disabled={busy} onClick={() => void saveCommunity()}><Check size={16} />{trUi("chat.saveRules")}</button>}
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

  </div>
}