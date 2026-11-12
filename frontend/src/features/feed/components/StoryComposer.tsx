import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Send } from 'lucide-react'

type Props = {
  file: File
  busy: boolean
  onPublish: () => void
  onChangeFile: (file: File) => void
}

export default function StoryComposer({ file, busy, onPublish, onChangeFile }: Props) {
  const [preview, setPreview] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const isVideo = file.type.startsWith('video/')
  return (
    <section className="smart-story-composer" aria-label="Xem trước Story">
      <input ref={fileInputRef} className="hidden-media-input" type="file" accept="image/*,video/*"
        aria-label="Chọn tệp Story khác" onChange={event => {
          const selected = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (selected) onChangeFile(selected)
        }} />
      <div className="smart-story-frame">
        {preview && (isVideo
          ? <video src={preview} controls playsInline preload="metadata" aria-label="Video Story đã chọn" />
          : <img src={preview} alt="Xem trước ảnh Story đã chọn" />)}
      </div>
      <p className="smart-story-note">Story sẽ hiển thị trong 24 giờ. Kiểm tra ảnh hoặc video trước khi đăng.</p>
      <footer className="smart-story-actions">
        <button type="button" className="smart-story-change" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          <ImagePlus size={18} aria-hidden="true" /> Chọn tệp khác
        </button>
        <button type="button" className="smart-story-publish" onClick={onPublish} disabled={busy}>
          <Send size={17} aria-hidden="true" /> {busy ? 'Đang đăng...' : 'Đăng Story'}
        </button>
      </footer>
    </section>
  )
}
