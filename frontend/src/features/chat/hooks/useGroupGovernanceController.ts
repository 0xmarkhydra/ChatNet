import { useEffect, useRef, useState } from 'react'
import type { ApiRequest } from '../../../shared/types/api'
import { useLatest } from '../../../shared/hooks/useLatest'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import { getGroupSettings } from '../api/groups'
import {
  createInvite as createInviteRequest,
  listAuditLog,
  listInvites,
  listJoinRequests,
  revokeInvite as revokeInviteRequest,
  reviewJoinRequest,
  updateGroupSettings,
} from '../api/governance'

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
const defaultSettings: Settings = {
  requireApproval: false,
  adminCanInvite: true,
  adminCanApprove: true,
  adminCanEditInfo: true,
};
export function useGroupGovernanceController({
  conversationId,
  role,
  request,
  notify,
  onMembersChanged,
}: {
  conversationId: number
  role: 'owner' | 'admin' | 'member'
  request: (path: string, init?: RequestInit) => Promise<Response>
  notify: (text: string) => void
  onMembersChanged: () => Promise<void>
}) {
  const requestRef = useLatest(request);
  const [settings, setSettings] = useScopedState<Settings>(conversationId, defaultSettings);
  const [expiryHours, setExpiryHours] = useState(24);
  const [maxUses, setMaxUses] = useState(0);
  const [createdUrl, setCreatedUrl] = useScopedState(conversationId, "");
  const [invites, setInvites] = useScopedState<Invite[]>(conversationId, []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [requests, setRequests] = useScopedState<JoinRequest[]>(conversationId, []);
  const [audit, setAudit] = useScopedState<Audit[]>(conversationId, []);
  const [before, setBefore] = useScopedState<number | null>(conversationId, null);
  const [busy, setBusy] = useScopedState(conversationId, false);
  const runningGroupRef = useRef<number | null>(null);
  const lifecycleRef = useRef(0);
  useEffect(() => () => { lifecycleRef.current += 1 }, [conversationId]);
  const [error, setError] = useScopedState(conversationId, "");
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
  }, [conversationId, requestRef, setSettings, setError]);

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
  }, [conversationId, canInvite, requestRef, setInvites, setError]);

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
  }, [conversationId, canApprove, requestRef, setRequests, setError]);

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
  }, [conversationId, canAudit, requestRef, setAudit, setError]);

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

  async function run(operation: (isCurrent: () => boolean) => Promise<void>) {
    if (runningGroupRef.current === conversationId) return;
    const generation = lifecycleRef.current;
    const isCurrent = () => lifecycleRef.current === generation;
    runningGroupRef.current = conversationId;
    setBusy(true);
    setError("");
    try {
      await operation(isCurrent);
    } catch (error) {
      if (isCurrent()) setError(error instanceof Error ? error.message : "Thao tác thất bại.");
    } finally {
      if (runningGroupRef.current === conversationId) runningGroupRef.current = null;
      if (isCurrent()) setBusy(false);
    }
  }

  async function refreshAudit() {
    const generation = lifecycleRef.current;
    const response = await listAuditLog(request, conversationId);
    if (response.ok) {
      const result = await response.json() as Audit[];
      if (lifecycleRef.current !== generation) return;
      setAudit(result);
      setBefore(null);
    }
  }

  async function refreshRequests() {
    const generation = lifecycleRef.current;
    const response = await listJoinRequests(request, conversationId, true);
    if (!response.ok) throw new Error("Không tải được yêu cầu tham gia.");
    const result = await response.json() as JoinRequest[];
    if (lifecycleRef.current === generation) setRequests(result);
  }

  async function refreshInvites() {
    const generation = lifecycleRef.current;
    const response = await listInvites(request, conversationId);
    if (response.ok) {
      const result = await response.json() as Invite[];
      if (lifecycleRef.current === generation) setInvites(result);
    }
  }

  async function createInvite() {
    await run(async isCurrent => {
      const value = await send((api) =>
        createInviteRequest(api, conversationId, { expiresInHours: expiryHours, maxUses }),
      );
      if (!isCurrent()) return;
      if (typeof value?.token !== "string")
        throw new Error("Không lấy được link mời.");
      const url = new URL(window.location.pathname, window.location.origin);
      url.searchParams.set("groupInvite", value.token);
      setCreatedUrl(url.toString());
      await Promise.all([refreshInvites(), refreshAudit()]);
      if (isCurrent()) notify("Đã tạo link mời tham gia nhóm.");
    });
  }

  async function saveSettings() {
    await run(async isCurrent => {
      const value = await send((api) =>
        updateGroupSettings(api, conversationId, settings),
      );
      if (!isCurrent()) return;
      setSettings(value as Settings);
      await refreshAudit();
      if (isCurrent()) notify("Đã lưu thiết lập và quyền quản trị nhóm.");
    });
  }

  async function revokeInvite(inviteId: number) {
    if (!window.confirm("Thu hồi link mời này?")) return;
    await run(async isCurrent => {
      await send((api) => revokeInviteRequest(api, conversationId, inviteId));
      if (!isCurrent()) return;
      setCreatedUrl("");
      await Promise.all([refreshInvites(), refreshAudit()]);
      if (isCurrent()) notify("Đã thu hồi link mời.");
    });
  }

  async function review(item: JoinRequest, approve: boolean) {
    await run(async isCurrent => {
      await send((api) =>
        reviewJoinRequest(api, conversationId, item.id, approve),
      );
      if (!isCurrent()) return;
      setRequests((current) => current.filter((entry) => entry.id !== item.id));
      if (approve) await onMembersChanged();
      if (!isCurrent()) return;
      await refreshAudit();
      if (isCurrent()) notify(
        approve ? "Đã phê duyệt thành viên." : "Đã từ chối yêu cầu tham gia.",
      );
    });
  }

  async function loadMoreAudit() {
    if (!audit.length || busy) return;
    await run(async isCurrent => {
      const id = audit[audit.length - 1].id;
      const response = await listAuditLog(request, conversationId, id);
      if (!response.ok) throw new Error("Không tải được nhật ký.");
      const entries = (await response.json()) as Audit[];
      if (!isCurrent()) return;
      setAudit((current) => [...current, ...entries]);
      setBefore(entries.length < 50 ? 0 : id);
    });
  }

  return {
    settings, setSettings, expiryHours, setExpiryHours, maxUses, setMaxUses,
    createdUrl, invites, now, requests, audit, before, busy, error, setError,
    isOwner, canInvite, canApprove, canAudit,
    createInvite, saveSettings, revokeInvite, review, refreshRequests, loadMoreAudit, run,
  }
}