import { useEffect, useRef, useState } from "react";
import {
  ClipboardCopy,
  Link2,
  ShieldCheck,
  History,
  UserCheck,
  Ban,
} from "lucide-react";
import "./group-governance.css";

type Settings = {
  requireApproval: boolean;
  adminCanInvite: boolean;
  adminCanApprove: boolean;
  adminCanEditInfo: boolean;
};
type Invite = {
  id: number;
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
  revokedAt: string | null;
};
type JoinRequest = {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  createdAt: string;
};
type Audit = {
  id: number;
  actor: string;
  action: string;
  targetUserId: number | null;
  details: Record<string, unknown>;
  createdAt: string;
};
type Props = {
  conversationId: number;
  role: "owner" | "admin" | "member";
  request: (path: string, init?: RequestInit) => Promise<Response>;
  notify: (text: string) => void;
  onMembersChanged: () => Promise<void>;
  section?: 'permissions' | 'requests' | 'activity';
};

const defaultSettings: Settings = {
  requireApproval: false,
  adminCanInvite: true,
  adminCanApprove: true,
  adminCanEditInfo: true,
};
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

export default function GroupGovernancePanel({
  conversationId,
  role,
  request,
  notify,
  onMembersChanged,
  section,
}: Props) {
  const requestRef = useRef(request);
  requestRef.current = request;
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [expiryHours, setExpiryHours] = useState(24);
  const [maxUses, setMaxUses] = useState(0);
  const [createdUrl, setCreatedUrl] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isOwner = role === "owner";
  const canInvite = isOwner || (role === "admin" && settings.adminCanInvite);
  const canApprove = isOwner || (role === "admin" && settings.adminCanApprove);
  const canAudit = role === "owner" || role === "admin";

  useEffect(() => {
    let active = true;
    setCreatedUrl("");
    setInvites([]);
    setRequests([]);
    setAudit([]);
    setBefore(null);
    setSettings(defaultSettings);
    setError("");
    void requestRef
      .current(`/api/conversations/${conversationId}/group-settings`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Không tải được cài đặt nhóm.");
        const result = (await response.json()) as Settings;
        if (active) setSettings(result);
      })
      .catch(() => {
        if (active) setError("Không tải được cài đặt nhóm.");
      });
    return () => {
      active = false;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!canInvite) {
      setInvites([]);
      return;
    }
    let active = true;
    void requestRef
      .current(`/api/conversations/${conversationId}/invites`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = (await response.json()) as Invite[];
        if (active) setInvites(result);
      })
      .catch(() => {
        if (active) setError("Không tải được danh sách link mời.");
      });
    return () => {
      active = false;
    };
  }, [conversationId, canInvite]);

  useEffect(() => {
    if (!canApprove) {
      setRequests([]);
      return;
    }
    let active = true;
    void requestRef
      .current(`/api/conversations/${conversationId}/join-requests`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = (await response.json()) as JoinRequest[];
        if (active) setRequests(result);
      })
      .catch(() => {
        if (active) setError("Không tải được yêu cầu tham gia.");
      });
    return () => {
      active = false;
    };
  }, [conversationId, canApprove]);

  useEffect(() => {
    if (!canAudit) return;
    let active = true;
    void requestRef
      .current(`/api/conversations/${conversationId}/admin-audit`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = (await response.json()) as Audit[];
        if (active) setAudit(result);
      })
      .catch(() => {
        if (active) setError("Không tải được nhật ký quản trị.");
      });
    return () => {
      active = false;
    };
  }, [conversationId, canAudit]);

  async function send(path: string, method: string, payload?: unknown) {
    const response = await request(path, {
      method,
      ...(payload === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
    });
    const value = (await response.json().catch(() => null)) as {
      error?: string;
      [key: string]: unknown;
    } | null;
    if (!response.ok)
      throw new Error(value?.error || "Không thể thực hiện thao tác.");
    return value;
  }

  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshAudit() {
    const response = await request(
      `/api/conversations/${conversationId}/admin-audit`,
    );
    if (response.ok) {
      setAudit((await response.json()) as Audit[]);
      setBefore(null);
    }
  }

  async function refreshRequests() {
    const response = await request(
      `/api/conversations/${conversationId}/join-requests`,
      { cache: "reload" },
    );
    if (!response.ok) throw new Error("Không tải được yêu cầu tham gia.");
    setRequests((await response.json()) as JoinRequest[]);
  }

  async function refreshInvites() {
    const response = await request(
      `/api/conversations/${conversationId}/invites`,
    );
    if (response.ok) setInvites((await response.json()) as Invite[]);
  }

  async function createInvite() {
    await run(async () => {
      const value = await send(
        `/api/conversations/${conversationId}/invites`,
        "POST",
        { expiresInHours: expiryHours, maxUses },
      );
      if (typeof value?.token !== "string")
        throw new Error("Không lấy được link mời.");
      const url = new URL(window.location.pathname, window.location.origin);
      url.searchParams.set("groupInvite", value.token);
      setCreatedUrl(url.toString());
      await Promise.all([refreshInvites(), refreshAudit()]);
      notify("Đã tạo link mời tham gia nhóm.");
    });
  }

  async function saveSettings() {
    await run(async () => {
      const value = await send(
        `/api/conversations/${conversationId}/group-settings`,
        "PATCH",
        settings,
      );
      setSettings(value as Settings);
      await refreshAudit();
      notify("Đã lưu thiết lập và quyền quản trị nhóm.");
    });
  }

  async function revokeInvite(inviteId: number) {
    if (!window.confirm("Thu hồi link mời này?")) return;
    await run(async () => {
      await send(
        `/api/conversations/${conversationId}/invites/${inviteId}`,
        "DELETE",
      );
      setCreatedUrl("");
      await Promise.all([refreshInvites(), refreshAudit()]);
      notify("Đã thu hồi link mời.");
    });
  }

  async function review(item: JoinRequest, approve: boolean) {
    await run(async () => {
      await send(
        `/api/conversations/${conversationId}/join-requests/${item.id}`,
        "POST",
        { approve },
      );
      setRequests((current) => current.filter((entry) => entry.id !== item.id));
      if (approve) await onMembersChanged();
      await refreshAudit();
      notify(
        approve ? "Đã phê duyệt thành viên." : "Đã từ chối yêu cầu tham gia.",
      );
    });
  }

  async function loadMoreAudit() {
    if (!audit.length || busy) return;
    await run(async () => {
      const id = audit[audit.length - 1].id;
      const response = await request(
        `/api/conversations/${conversationId}/admin-audit?before=${id}`,
      );
      if (!response.ok) throw new Error("Không tải được nhật ký.");
      const entries = (await response.json()) as Audit[];
      setAudit((current) => [...current, ...entries]);
      setBefore(entries.length < 50 ? 0 : id);
    });
  }

  if (role === "member") return null;

  return (
    <div className="group-governance" data-section={section}>
      <h3>
        <ShieldCheck size={18} /> {section === "requests" ? "Yêu cầu tham gia" : section === "activity" ? "Nhật ký hoạt động" : "Quyền quản trị"}
      </h3>
      {error && (
        <p className="group-governance-error" role="alert">
          {error}
        </p>
      )}
      {(!section || section === "permissions") && <section>
        <h4>Quyền quản trị</h4>
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
                aria-label="Số lượt sử dụng link mời"
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
                aria-label="Link mời vừa tạo"
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
                <ClipboardCopy size={16} /> Sao chép
              </button>
            </div>
          )}
          {invites.map((link) => {
            const available =
              !link.revokedAt &&
              new Date(link.expiresAt).getTime() > Date.now() &&
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
                    <Ban size={14} /> Thu hồi
                  </button>
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
            >
              Làm mới
            </button>
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
              >
                Từ chối
              </button>
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