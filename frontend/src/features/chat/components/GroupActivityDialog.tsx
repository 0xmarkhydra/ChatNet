import { CalendarClock, ClipboardList, FileText, Pin, PinOff, X } from 'lucide-react'
import type { GroupActivityKind } from '../types/groupActivities'
import { useGroupActivityDialog, type GroupActivityDialogProps } from '../hooks/useGroupActivityDialog'

const labels: Record<GroupActivityKind, string> = {
  poll: 'Bình chọn', note: 'Ghi chú', reminder: 'Nhắc hẹn',
}
const icons = { poll: ClipboardList, note: FileText, reminder: CalendarClock }

export function GroupActivityDialog(props: GroupActivityDialogProps) {
  const { kind, activity } = props
  const { body, setBody, options, setOptions, scheduledAt, setScheduledAt, pinOnCreate, setPinOnCreate,
    selection, setSelection, busy, error, panelRef, submit, togglePinned, castVote } =
    useGroupActivityDialog(props)
  const onClose = props.onClose
  const currentKind = kind ?? activity?.kind
  const Icon = currentKind ? icons[currentKind] : ClipboardList
  const total = activity?.counts.reduce((sum, count) => sum + count, 0) || 0
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