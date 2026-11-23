import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, Send } from 'lucide-react'
import { STORY_MEDIA_ACCEPT } from '../utils/storyMedia'

type Props = {
  file: File
  busy: boolean
  onPublish: () => Promise<boolean>
  onBack: () => void
  onChangeFile: (file: File) => void
}

export default function StoryComposer({ file, busy, onPublish, onBack, onChangeFile }: Props) {
  const [preview, setPreview] = useState('')
  const [publishFailed, setPublishFailed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const isVideo = /\.(mp4|mov|m4v|webm)$/i.test(file.name)
  return (
    <section className="smart-story-composer" aria-label="Xem trước Story">
      <input ref={fileInputRef} className="hidden-media-input" type="file" accept={STORY_MEDIA_ACCEPT}
        aria-label="Chọn tệp Story khác" onChange={event => {
          const selected = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (selected) { setPublishFailed(false); onChangeFile(selected) }
        }} />
      <div className="smart-story-frame">
        {preview && (isVideo
          ? <video src={preview} controls playsInline preload="metadata" aria-label="Video Story đã chọn" />
          : <img src={preview} alt="Xem trước ảnh Story đã chọn" />)}
      </div>
      <p className="smart-story-note break-all">{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</p>
      <p className="smart-story-note">Story sẽ hiển thị trong 24 giờ. Kiểm tra ảnh hoặc video trước khi đăng.</p>
      {publishFailed && <p role="alert" className="mt-2 text-sm text-destructive">Không đăng được Story. Tệp đã chọn vẫn được giữ lại.</p>}
      <div className="smart-story-actions">
        <button type="button" className="smart-story-change" onClick={onBack} disabled={busy}>
          <ArrowLeft size={18} aria-hidden="true" /> Quay lại
        </button>
        <button type="button" className="smart-story-change" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          <ImagePlus size={18} aria-hidden="true" /> Chọn tệp khác
        </button>
        <button type="button" className="smart-story-publish" onClick={async () => {
          setPublishFailed(false)
          if (!await onPublish()) setPublishFailed(true)
        }} disabled={busy}>
          <Send size={17} aria-hidden="true" /> {busy ? 'Đang đăng...' : 'Đăng Story'}
        </button>
      </div>
    </section>
  )
}