import { useEffect, useState } from "react";
import type { ApiRequest } from "../../../shared/types/api";
import { getGroupSettings } from "../api/groups";
import { createInvite as createInviteRequest, listAuditLog, listInvites, listJoinRequests, revokeInvite as revokeInviteRequest, reviewJoinRequest, updateGroupSettings } from "../api/governance";
import { useLatest } from "../../../shared/hooks/useLatest";

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
export type GroupGovernanceProps = {
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
export function useGroupGovernance({ conversationId, role, request, notify, onMembersChanged }: GroupGovernanceProps) {
  const requestRef = useLatest(request);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [expiryHours, setExpiryHours] = useState(24);
  const [maxUses, setMaxUses] = useState(0);
  const [createdUrl, setCreatedUrl] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
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
    void getGroupSettings(requestRef.current, conversationId)
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
  }, [conversationId, requestRef]);

  useEffect(() => {
    if (!canInvite) return;
    let active = true;
    void listInvites(requestRef.current, conversationId)
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
  }, [conversationId, canInvite, requestRef]);

  useEffect(() => {
    if (!canApprove) return;
    let active = true;
    void listJoinRequests(requestRef.current, conversationId)
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
  }, [conversationId, canApprove, requestRef]);

  useEffect(() => {
    if (!canAudit) return;
    let active = true;
    void listAuditLog(requestRef.current, conversationId)
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
  }, [conversationId, canAudit, requestRef]);

  async function send(call: (api: ApiRequest) => Promise<Response>) {
    const response = await call(request);
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
    const response = await listAuditLog(request, conversationId);
    if (response.ok) {
      setAudit((await response.json()) as Audit[]);
      setBefore(null);
    }
  }

  async function refreshRequests() {
    const response = await listJoinRequests(request, conversationId, true);
    if (!response.ok) throw new Error("Không tải được yêu cầu tham gia.");
    setRequests((await response.json()) as JoinRequest[]);
  }

  async function refreshInvites() {
    const response = await listInvites(request, conversationId);
    if (response.ok) setInvites((await response.json()) as Invite[]);
  }

  async function createInvite() {
    await run(async () => {
      const value = await send((api) =>
        createInviteRequest(api, conversationId, { expiresInHours: expiryHours, maxUses }),
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
      const value = await send((api) =>
        updateGroupSettings(api, conversationId, settings),
      );
      setSettings(value as Settings);
      await refreshAudit();
      notify("Đã lưu thiết lập và quyền quản trị nhóm.");
    });
  }

  async function revokeInvite(inviteId: number) {
    if (!window.confirm("Thu hồi link mời này?")) return;
    await run(async () => {
      await send((api) => revokeInviteRequest(api, conversationId, inviteId));
      setCreatedUrl("");
      await Promise.all([refreshInvites(), refreshAudit()]);
      notify("Đã thu hồi link mời.");
    });
  }

  async function review(item: JoinRequest, approve: boolean) {
    await run(async () => {
      await send((api) =>
        reviewJoinRequest(api, conversationId, item.id, approve),
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
      const response = await listAuditLog(request, conversationId, id);
      if (!response.ok) throw new Error("Không tải được nhật ký.");
      const entries = (await response.json()) as Audit[];
      setAudit((current) => [...current, ...entries]);
      setBefore(entries.length < 50 ? 0 : id);
    });
  }

  return { settings,setSettings,expiryHours,setExpiryHours,maxUses,setMaxUses,createdUrl,invites: canInvite ? invites : [],now,requests: canApprove ? requests : [],audit,before,busy,error,isOwner,canInvite,canApprove,canAudit,createInvite,saveSettings,revokeInvite,review,loadMoreAudit,run,refreshRequests,setError };
}
