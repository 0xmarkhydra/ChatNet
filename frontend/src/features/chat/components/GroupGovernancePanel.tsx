import { useUiTranslation } from '@/shared/i18n/locale'
import {
  ClipboardCopy,
  Link2,
  ShieldCheck,
  History,
  UserCheck,
  Ban,
} from "lucide-react";
import "../styles/group-governance.css";

import { useGroupGovernance, type GroupGovernanceProps } from "../hooks/useGroupGovernance";

const dateText = (value: string) => new Date(value).toLocaleString("vi-VN");
const actionNames: Record<string, string> = {
  "settings.updated": "Thay đổi quyền quản trị",
  "invite.created": "Tạo link mời",
  "invite.revoked": "Thu hồi link mời",
  "join.requested": "Yêu cầu tham gia nhóm",
  "join.approved": "Phê duyệt thành viên",
  "join.rejected": "Từ chối thành viên",
  "member.joined": "Tham gia qua link mời",
  "member.added": "Thêm thành viên",
  "member.removed": "Xóa thành viên",
  "member.left": "Rời khỏi nhóm",
  "member.role.updated": "Thay đổi vai trò",
  "group.renamed": "Đổi tên nhóm",
};

export default function GroupGovernancePanel(props: GroupGovernanceProps) {
  return <GroupGovernancePanelContent key={props.conversationId} {...props} />;
}

function GroupGovernancePanelContent({
  conversationId,
  role,
  request,
  notify,
  onMembersChanged,
  section,
}: GroupGovernanceProps) {
  const trUi = useUiTranslation()

  const { settings,setSettings,expiryHours,setExpiryHours,maxUses,setMaxUses,createdUrl,invites,now,requests,audit,before,busy,error,isOwner,canInvite,canApprove,canAudit,createInvite,saveSettings,revokeInvite,review,loadMoreAudit,run,refreshRequests,setError } = useGroupGovernance({ conversationId, role, request, notify, onMembersChanged });

  if (role === "member") return null;

  return (
    <div className="group-governance" data-section={section}>
      <h3>
        <ShieldCheck size={18} /> {section === "requests" ? trUi("chat.joinRequests") : section === "activity" ? trUi("chat.activityLog") : trUi("chat.adminRights")}
      </h3>
      {error && (
        <p className="group-governance-error" role="alert">
          {error}
        </p>
      )}
      {(!section || section === "permissions") && <section>
        <h4>{trUi("chat.adminRights")}</h4>
        <label>
          <input
            type="checkbox"
            checked={settings.requireApproval}
            disabled={!isOwner || busy}
            onChange={(event) =>
              setSettings((v) => ({
                ...v,
                requireApproval: event.target.checked,
              }))
            }
          />
          Yêu cầu phê duyệt khi tham gia qua link
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.adminCanInvite}
            disabled={!isOwner || busy}
            onChange={(event) =>
              setSettings((v) => ({
                ...v,
                adminCanInvite: event.target.checked,
              }))
            }
          />
          Cho phép admin mời người và tạo link
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.adminCanApprove}
            disabled={!isOwner || busy}
            onChange={(event) =>
              setSettings((v) => ({
                ...v,
                adminCanApprove: event.target.checked,
              }))
            }
          />
          Cho phép admin phê duyệt thành viên
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.adminCanEditInfo}
            disabled={!isOwner || busy}
            onChange={(event) =>
              setSettings((v) => ({
                ...v,
                adminCanEditInfo: event.target.checked,
              }))
            }
          />
          Cho phép admin sửa thông tin cộng đồng
        </label>
        {isOwner && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveSettings()}
          >
            Lưu quyền nhóm
          </button>
        )}
      </section>}

      {canInvite && (!section || section === "permissions") && (
        <section>
          <h4>
            <Link2 size={17} /> Link mời có thời hạn
          </h4>
          <div className="group-governance-controls">
            <label>
              Hết hạn
              <select
                disabled={busy}
                value={expiryHours}
                onChange={(event) => setExpiryHours(Number(event.target.value))}
              >
                <option value={1}>1 giờ</option>
                <option value={24}>24 giờ</option>
                <option value={72}>3 ngày</option>
                <option value={168}>7 ngày</option>
                <option value={720}>30 ngày</option>
              </select>
            </label>
            <label>
              Số lượt tối đa
              <input
                aria-label={trUi("common.ui.inviteUses")}
                type="number"
                min={0}
                max={10000}
                value={maxUses}
                disabled={busy}
                onChange={(event) => setMaxUses(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              disabled={busy || maxUses < 0 || maxUses > 10000}
              onClick={() => void createInvite()}
            >
              Tạo link
            </button>
          </div>
          <small>
            0 lượt = không giới hạn. Link chỉ hiển thị để sao chép khi vừa tạo.
          </small>
          {createdUrl && (
            <div className="group-governance-link">
              <input
                aria-label={trUi("common.ui.newInviteLink")}
                value={createdUrl}
                readOnly
              />
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(createdUrl)
                    .then(() => notify("Đã sao chép link mời."))
                    .catch(() => setError("Không thể sao chép link."))
                }
              >
                <ClipboardCopy size={16} />{trUi("common.copy")}</button>
            </div>
          )}
          {invites.map((link) => {
            const available =
              !link.revokedAt &&
              new Date(link.expiresAt).getTime() > now &&
              (link.maxUses === null || link.useCount < link.maxUses);
            return (
              <div className="group-governance-entry" key={link.id}>
                <span>
                  <strong>Link #{link.id}</strong>
                  <small>
                    Hết hạn: {dateText(link.expiresAt)} · {link.useCount}/
                    {link.maxUses ?? "∞"} lượt
                  </small>
                </span>
                {available ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revokeInvite(link.id)}
                  >
                    <Ban size={14} />{trUi("chat.recall")}</button>
                ) : (
                  <small>Hết hiệu lực</small>
                )}
              </div>
            );
          })}
        </section>
      )}

      {canApprove && (!section || section === "requests") && (
        <section>
          <h4>
            <UserCheck size={17} /> Yêu cầu tham gia ({requests.length}){" "}
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(refreshRequests)}
            >{trUi("common.refresh")}</button>
          </h4>
          {requests.length === 0 && <small>Chưa có yêu cầu đang chờ.</small>}
          {requests.map((item) => (
            <div key={item.id} className="group-governance-entry">
              <span>
                <strong>{item.displayName || item.username}</strong>
                <small>
                  @{item.username} · {dateText(item.createdAt)}
                </small>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void review(item, true)}
              >
                Duyệt
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void review(item, false)}
              >{trUi("common.decline")}</button>
            </div>
          ))}
        </section>
      )}

      {canAudit && (!section || section === "activity") && (
        <section>
          <h4>
            <History size={17} /> Nhật ký quản trị
          </h4>
          {audit.length === 0 && (
            <small>Chưa có hoạt động quản trị được ghi nhận.</small>
          )}
          {audit.map((entry) => (
            <div key={entry.id} className="group-governance-entry">
              <span>
                <strong>{actionNames[entry.action] || entry.action}</strong>
                <small>
                  @{entry.actor || "tài khoản đã xóa"} ·{" "}
                  {dateText(entry.createdAt)}
                </small>
              </span>
            </div>
          ))}
          {audit.length >= 50 && before !== 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void loadMoreAudit()}
            >
              Xem thêm lịch sử
            </button>
          )}
        </section>
      )}
    </div>
  );
}