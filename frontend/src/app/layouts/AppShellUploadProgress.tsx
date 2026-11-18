type UploadProgress = { loaded: number; total: number };

type Props = {
  progress: UploadProgress | null;
  onCancel: () => void;
};

/** Persistent upload status is presentation-only; the upload controller owns cancellation. */
export default function AppShellUploadProgress({ progress, onCancel }: Props) {
  if (!progress) return null;
  return (
    <div className="media-upload-progress" role="status" aria-live="polite">
      <span>
        Đang tải tệp:{" "}
        {Math.round((progress.loaded / Math.max(1, progress.total)) * 100)}
        %
      </span>
      <progress value={progress.loaded} max={progress.total} aria-label="Tiến độ tải tệp" />
      <button type="button" onClick={onCancel}>
        Hủy tải
      </button>
    </div>
  );
}
