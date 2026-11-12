import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  MoreHorizontal,
  Pin,
  PinOff,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import "../styles/group-activities.css";
import { createActivity, listActivities, setActivityPinned, voteActivity } from "../api/activities";
import { useLatest } from "../../../shared/hooks/useLatest";

export type GroupActivityKind = "poll" | "note" | "reminder";
export type GroupActivity = {
  id: number;
  kind: GroupActivityKind;
  title: string;
  body: string;
  options: string[];
  counts: number[];
  myVote: number | null;
  scheduledAt?: string;
  pinnedAt?: string;
  creatorName: string;
  createdAt: string;
};
export type GroupActivityEvent = {
  id: number;
  activityId: number;
  kind: "created" | "voted" | "vote_changed";
  actorName: string;
  createdAt: string;
};
type ActivityData = {
  conversationId: number | null;
  sessionKey?: string;
  activities: GroupActivity[];
  events: GroupActivityEvent[];
};
type Request = (path: string, init?: RequestInit) => Promise<Response>;

const labels: Record<GroupActivityKind, string> = {
  poll: "Bình chọn",
  note: "Ghi chú",
  reminder: "Nhắc hẹn",
};
const icons = { poll: ClipboardList, note: FileText, reminder: CalendarClock };

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
  const [error, setError] = useState("");

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
      setError("");
    } catch (e) {
      if (
        activeRef.current.conversationId !== conversationId ||
        activeRef.current.sessionKey !== sessionKey
      )
        return;
      setError(
        e instanceof Error ? e.message : "Không tải được hoạt động của nhóm.",
      );
    }
  }, [activeRef, conversationId, requestRef, sessionKey]);

  useEffect(() => {
    setData({ conversationId, sessionKey, activities: [], events: [] });
    setError("");
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
    error: isCurrent ? error : "",
    refresh, create, vote, setPin,
  };
}

export function GroupActivityComposerMenu({
  onCreate,
}: {
  onCreate: (kind: GroupActivityKind) => void;
}) {
  const [position, setPosition] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setPosition(null), []);
  useEffect(() => {
    if (!position) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [position, close]);

  return (
    <>
      <button
        ref={triggerRef}
        className="ghost-action group-activity-composer-trigger"
        type="button"
        aria-label="Tùy chọn nhóm: bình chọn, ghi chú và nhắc hẹn"
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        title="Tùy chọn nhóm"
        onClick={() => {
          if (position) {
            close();
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setPosition({
            left: Math.min(Math.max(8, rect.left), window.innerWidth - 224),
            top: rect.top < 190 ? rect.bottom + 8 : rect.top - 8,
            below: rect.top < 190,
          });
        }}
      >
        <MoreHorizontal size={21} aria-hidden="true" />
      </button>
      {position && createPortal(
        <div
          ref={menuRef}
          className={`group-activity-composer-menu${position.below ? " below" : ""}`}
          role="menu"
          aria-label="Tạo hoạt động nhóm"
          style={{ left: position.left, top: position.top }}
        >
          {(["poll", "note", "reminder"] as const).map((kind) => {
            const Icon = icons[kind];
            return (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onCreate(kind);
                }}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{labels[kind]}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

export function GroupActivityMarker({
  event,
  activity,
  onOpen,
}: {
  event: GroupActivityEvent;
  activity?: GroupActivity;
  onOpen: () => void;
}) {
  if (!activity) return null;
  const Icon = icons[activity.kind];
  const verb =
    event.kind === "created"
      ? "đã tạo"
      : event.kind === "voted"
        ? "đã bình chọn trong"
        : "đã thay đổi bình chọn trong";
  return (
    <div className="group-activity-timeline" key={event.id}>
      <button
        className="group-activity-marker"
        type="button"
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        <Icon size={18} aria-hidden="true" />
        <span>
          <strong>{event.actorName}</strong> {verb}{" "}
          {event.kind === "created"
            ? labels[activity.kind].toLowerCase()
            : "cuộc bình chọn"}{" "}
          {activity.body && (
            <b>{activity.body.length > 100 ? `${activity.body.slice(0, 100)}…` : activity.body}</b>
          )} · <em>Xem</em>
        </span>
      </button>
    </div>
  );
}

export function GroupActivityDialog({
  kind,
  activity,
  onClose,
  onCreate,
  onVote,
  onTogglePin,
}: {
  kind: GroupActivityKind | null;
  activity: GroupActivity | null;
  onClose: () => void;
  onCreate: (payload: {
    kind: GroupActivityKind;
    title: string;
    body: string;
    options: string[];
    scheduledAt?: string;
    pin?: boolean;
  }) => Promise<void>;
  onVote: (id: number, optionIndex: number) => Promise<void>;
  onTogglePin: (id: number, pinned: boolean) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [pinOnCreate, setPinOnCreate] = useState(false);
  const [selection, setSelection] = useState<number | null>(
    activity?.myVote ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose, busy]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!kind || busy) return;
    const cleaned = options.map((value) => value.trim());
    if (kind === "poll" && (cleaned.length < 2 || cleaned.some((v) => !v))) {
      setError("Bình chọn cần ít nhất hai lựa chọn hợp lệ.");
      return;
    }
    if (kind === "note" && !body.trim()) {
      setError("Vui lòng nhập nội dung ghi chú.");
      return;
    }
    if (
      kind === "reminder" &&
      (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())
    ) {
      setError("Vui lòng chọn thời gian nhắc hẹn trong tương lai.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate({
        kind,
        title: labels[kind],
        body: body.trim(),
        pin: pinOnCreate,
        options: kind === "poll" ? cleaned : [],
        ...(kind === "reminder"
          ? { scheduledAt: new Date(scheduledAt).toISOString() }
          : {}),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo hoạt động.");
    } finally {
      setBusy(false);
    }
  };

  const togglePinned = async () => {
    if (!activity || busy) return;
    setBusy(true);
    setError("");
    try {
      await onTogglePin(activity.id, !Boolean(activity.pinnedAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được ghim.");
    } finally {
      setBusy(false);
    }
  };

  const castVote = async () => {
    if (!activity || selection === null || busy) return;
    setBusy(true);
    setError("");
    try {
      await onVote(activity.id, selection);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể bình chọn.");
    } finally {
      setBusy(false);
    }
  };

  const currentKind = kind ?? activity?.kind;
  const Icon = currentKind ? icons[currentKind] : ClipboardList;
  const total = activity?.counts.reduce((sum, count) => sum + count, 0) || 0;
  return (
    <div
      className="group-activity-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="group-activity-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={
          kind
            ? `Tạo ${labels[kind].toLowerCase()}`
            : `Chi tiết ${labels[activity?.kind || "poll"].toLowerCase()}`
        }
      >
        <header>
          <span className="group-activity-title-icon">
            <Icon size={21} aria-hidden="true" />
          </span>
          <div>
            <small>
              {kind ? "Tạo hoạt động nhóm" : labels[activity?.kind || "poll"]}
            </small>
            <strong>
              {kind ? labels[kind] : labels[activity?.kind || "poll"]}
            </strong>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            className="group-activity-close"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {kind ? (
          <form
            onSubmit={(event) => void submit(event)}
            className="group-activity-form"
          >
            <label>
              {kind === "poll"
                ? "Nội dung bình chọn (không bắt buộc)"
                : kind === "note"
                  ? "Nội dung ghi chú"
                  : "Nội dung nhắc hẹn (không bắt buộc)"}
              <textarea
                rows={3}
                maxLength={5000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required={kind === "note"}
                placeholder={kind === "poll" ? "Nhập nội dung bình chọn..." : kind === "note" ? "Nhập ghi chú..." : "Nhập nội dung nhắc hẹn..."}
              />
            </label>
            {kind === "poll" && (
              <fieldset>
                <legend>Các lựa chọn</legend>
                {options.map((option, index) => (
                  <div key={index} className="group-activity-option-input">
                    <input
                      aria-label={`Lựa chọn ${index + 1}`}
                      maxLength={120}
                      required
                      value={option}
                      placeholder={`Lựa chọn ${index + 1}`}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((value, i) =>
                            i === index ? event.target.value : value,
                          ),
                        )
                      }
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Bỏ lựa chọn ${index + 1}`}
                        onClick={() =>
                          setOptions((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {options.length < 10 && (
                  <button
                    type="button"
                    className="group-activity-add-option"
                    onClick={() => setOptions((current) => [...current, ""])}
                  >
                    + Thêm lựa chọn
                  </button>
                )}
              </fieldset>
            )}
            {kind === "reminder" && (
              <label>
                Thời gian nhắc hẹn
                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </label>
            )}
            <label className="group-activity-pin-choice">
              <input
                type="checkbox"
                checked={pinOnCreate}
                onChange={(event) => setPinOnCreate(event.target.checked)}
              />
              <span>Ghim lên đầu cuộc trò chuyện nhóm</span>
            </label>
            <p className="group-activity-readonly">
              Sau khi tạo, nội dung không thể sửa hoặc xóa. Tất cả thành viên
              nhóm đều xem và tương tác được.
            </p>
            {error && (
              <p className="group-activity-error" role="alert">
                {error}
              </p>
            )}
            <footer>
              <button type="button" onClick={onClose} disabled={busy}>
                Hủy
              </button>
              <button type="submit" disabled={busy}>
                Tạo mới
              </button>
            </footer>
          </form>
        ) : activity ? (
          <div className="group-activity-view">
            <button
              type="button"
              className="group-activity-toggle-pin"
              disabled={busy}
              onClick={() => void togglePinned()}
              aria-pressed={Boolean(activity.pinnedAt)}
            >
              {activity.pinnedAt ? <PinOff size={17} aria-hidden="true" /> : <Pin size={17} aria-hidden="true" />}
              {activity.pinnedAt ? "Bỏ ghim khỏi đầu cuộc trò chuyện" : "Ghim lên đầu cuộc trò chuyện"}
            </button>
            <p className="group-activity-author">
              Tạo bởi {activity.creatorName} ·{" "}
              {new Date(activity.createdAt).toLocaleString("vi-VN")}
            </p>
            {activity.body && (
              <p className="group-activity-description">{activity.body}</p>
            )}
            {activity.kind === "reminder" && (
              <p className="group-activity-schedule">
                <CalendarClock size={18} />{" "}
                {activity.scheduledAt
                  ? new Date(activity.scheduledAt).toLocaleString("vi-VN", {
                      dateStyle: "full",
                      timeStyle: "short",
                    })
                  : "Chưa có thời gian"}
              </p>
            )}
            {activity.kind === "poll" && (
              <div className="group-activity-votes">
                <p>
                  {total} lượt bình chọn ·{" "}
                  {activity.myVote === null
                    ? "Bạn chưa bình chọn"
                    : "Bạn đã bình chọn, có thể thay đổi"}
                </p>
                {activity.options.map((option, index) => (
                  <label
                    className={selection === index ? "selected" : ""}
                    key={index}
                  >
                    <input
                      type="radio"
                      name="group-poll-choice"
                      checked={selection === index}
                      onChange={() => setSelection(index)}
                    />
                    <span className="group-activity-vote-option">
                      <b>{option}</b>
                      <small>
                        {activity.counts[index] || 0} phiếu (
                        {total
                          ? Math.round(
                              ((activity.counts[index] || 0) / total) * 100,
                            )
                          : 0}
                        %)
                      </small>
                      <i
                        style={{
                          width: `${total ? ((activity.counts[index] || 0) / total) * 100 : 0}%`,
                        }}
                      />
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  className="group-activity-submit-vote"
                  disabled={
                    busy || selection === null || selection === activity.myVote
                  }
                  onClick={() => void castVote()}
                >
                  {activity.myVote === null ? "Gửi bình chọn" : "Thay đổi bình chọn"}
                </button>
              </div>
            )}
            {error && (
              <p className="group-activity-error" role="alert">
                {error}
              </p>
            )}
            <footer>
              <button type="button" onClick={onClose}>
                Đóng
              </button>
            </footer>
          </div>
        ) : (
          <div className="group-activity-view">
            <p>Không tìm thấy hoạt động này.</p>
            <footer>
              <button type="button" onClick={onClose}>
                Đóng
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
