import { useUiTranslation } from '@/shared/i18n/locale'
type UploadProgress = { loaded: number; total: number };

type Props = {
  progress: UploadProgress | null;
  onCancel: () => void;
};

/** Persistent upload status is presentation-only; the upload controller owns cancellation. */
export default function AppShellUploadProgress({ progress, onCancel }: Props) {
  const trUi = useUiTranslation()
  if (!progress) return null;
  return (
    <div className="media-upload-progress" role="status" aria-live="polite">
      <span>
        {trUi("common.ui.uploadingFile")}{" "}
        {Math.round((progress.loaded / Math.max(1, progress.total)) * 100)}
        %
      </span>
      <progress value={progress.loaded} max={progress.total} aria-label={trUi("common.ui.uploadProgress")} />
      <button type="button" onClick={onCancel}>
        {trUi('common.cancelUpload')}
      </button>
    </div>
  );
}