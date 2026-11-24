import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { GroupActivity, GroupActivityKind } from '../types/groupActivities'

const labels: Record<GroupActivityKind, string> = {
  poll: 'Bình chọn', note: 'Ghi chú', reminder: 'Nhắc hẹn',
}

export type GroupActivityDialogProps = {
  kind: GroupActivityKind | null
  activity: GroupActivity | null
  onClose: () => void
  onCreate: (payload: {
    kind: GroupActivityKind
    title: string
    body: string
    options: string[]
    scheduledAt?: string
    pin?: boolean
  }) => Promise<void>
  onVote: (id: number, optionIndex: number) => Promise<void>
  onTogglePin: (id: number, pinned: boolean) => Promise<void>
}

export function useGroupActivityDialog({ kind, activity, onClose, onCreate, onVote, onTogglePin }: GroupActivityDialogProps) {
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


  return { body, setBody, options, setOptions, scheduledAt, setScheduledAt,
    pinOnCreate, setPinOnCreate, selection, setSelection, busy, error, panelRef,
    submit, togglePinned, castVote }
}
