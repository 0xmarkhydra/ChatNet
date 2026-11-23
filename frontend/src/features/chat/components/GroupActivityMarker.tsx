import { CalendarClock, ClipboardList, FileText } from 'lucide-react'
import type { GroupActivity, GroupActivityEvent, GroupActivityKind } from '../types/groupActivities'

const labels: Record<GroupActivityKind, string> = {
  poll: 'Bình chọn', note: 'Ghi chú', reminder: 'Nhắc hẹn',
}
const icons = { poll: ClipboardList, note: FileText, reminder: CalendarClock }

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
