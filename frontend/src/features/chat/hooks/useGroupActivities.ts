import { useCallback, useEffect, useState } from "react";
import { createActivity, listActivities, setActivityPinned, voteActivity } from "../api/activities";
import { useLatest } from "../../../shared/hooks/useLatest";
import type { ActivityData, GroupActivityKind } from "../types/groupActivities";

type Request = (path: string, init?: RequestInit) => Promise<Response>;

async function readResponse(response: Response) {
  if (response.ok) return response.json();
  const body = await response.json().catch(() => ({}));
  throw new Error(
    typeof body?.error === "string"
      ? body.error
      : "Không thể thực hiện thao tác. Vui lòng thử lại.",
  );
}

export function useGroupActivities(
  conversationId: number | null,
  sessionKey: string | undefined,
  request: Request,
) {
  const requestRef = useLatest(request);
  const activeRef = useLatest({ conversationId, sessionKey });
  const [data, setData] = useState<ActivityData>({
    conversationId: null,
    activities: [],
    events: [],
  });
  const [error, setError] = useState({ conversationId: null as number | null, sessionKey: undefined as string | undefined, message: "" });

  const refresh = useCallback(async () => {
    if (!conversationId) return;
    try {
      const response = await listActivities(requestRef.current, conversationId);
      const result = (await readResponse(response)) as ActivityData;
      if (
        activeRef.current.conversationId !== conversationId ||
        activeRef.current.sessionKey !== sessionKey
      )
        return;
      setData({
        conversationId,
        sessionKey,
        activities: result.activities || [],
        events: result.events || [],
      });
      setError({ conversationId, sessionKey, message: "" });
    } catch (e) {
      if (
        activeRef.current.conversationId !== conversationId ||
        activeRef.current.sessionKey !== sessionKey
      )
        return;
      setError({
        conversationId, sessionKey,
        message: e instanceof Error ? e.message : "Không tải được hoạt động của nhóm.",
      });
    }
  }, [activeRef, conversationId, requestRef, sessionKey]);

  useEffect(() => {
    if (!conversationId) return;
    void refresh();
    const onChange = (event: Event) => {
      if ((event as CustomEvent<number>).detail === conversationId)
        void refresh();
    };
    window.addEventListener("chatnet:group-activity", onChange);
    return () => window.removeEventListener("chatnet:group-activity", onChange);
  }, [conversationId, refresh]);

  const create = async (payload: {
    kind: GroupActivityKind;
    title: string;
    body: string;
    options: string[];
    scheduledAt?: string;
    pin?: boolean;
  }) => {
    if (!conversationId) throw new Error("Chưa chọn nhóm.");
    await readResponse(
      await createActivity(requestRef.current, conversationId, payload),
    );
    await refresh();
  };

  const setPin = async (id: number, pinned: boolean) => {
    if (!conversationId) throw new Error("Chưa chọn nhóm.");
    await readResponse(
      await setActivityPinned(requestRef.current, conversationId, id, pinned),
    );
    await refresh();
  };

  const vote = async (id: number, optionIndex: number) => {
    if (!conversationId) throw new Error("Chưa chọn nhóm.");
    await readResponse(
      await voteActivity(requestRef.current, conversationId, id, optionIndex),
    );
    await refresh();
  };
  const isCurrent = data.conversationId === conversationId && data.sessionKey === sessionKey;
  return {
    activities: isCurrent ? data.activities : [],
    events: isCurrent ? data.events : [],
    error: error.conversationId === conversationId && error.sessionKey === sessionKey ? error.message : "",
    refresh, create, vote, setPin,
  };
}
