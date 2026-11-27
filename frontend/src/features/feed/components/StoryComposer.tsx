import { useUiTranslation, useUiLocale, formatUiNumber } from '@/shared/i18n/locale'
import { useCallback, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, Send } from 'lucide-react'
import { STORY_MEDIA_ACCEPT } from '../utils/storyMedia'

const action = 'inline-flex min-h-10.25 cursor-pointer items-center justify-center gap-1.75 rounded-[0.625rem] border border-solid px-3.5 py-2.25 disabled:cursor-not-allowed disabled:opacity-50 app-mobile:flex-[1_1_7.8125rem]'
const secondaryAction = 'smart-story-change border-story-action-border bg-story-action text-story-action-foreground ' + action
const note = 'm-0 text-xs leading-normal text-story-note'

type Props = {
  file: File
  busy: boolean
  onPublish: () => Promise<boolean>
  onBack: () => void
  onChangeFile: (file: File) => void
}

export default function StoryComposer({ file, busy, onPublish, onBack, onChangeFile }: Props) {
  const trUi = useUiTranslation()
  const locale = useUiLocale()

  const [publishFailed, setPublishFailed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // The object URL lives exactly as long as the preview element showing this file.
  const showFile = useCallback((media: HTMLImageElement | HTMLVideoElement | null) => {
    if (!media) return
    const url = URL.createObjectURL(file)
    media.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const isVideo = /\.(mp4|mov|m4v|webm)$/i.test(file.name)
  return (
    <section className="grid w-full min-w-0 gap-3.75" aria-label={trUi("common.ui.storyPreview")}>
      <input ref={fileInputRef} className="hidden-media-input" type="file" accept={STORY_MEDIA_ACCEPT}
        aria-label={trUi("common.ui.chooseOtherStoryFile")} onChange={event => {
          const selected = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (selected) { setPublishFailed(false); onChangeFile(selected) }
        }} />
      <div className="smart-story-frame grid max-h-[min(62dvh,32.5rem)] min-h-55 w-full place-items-center overflow-hidden rounded-[0.8125rem] bg-story-frame">
        {isVideo
          ? <video ref={showFile} className="block max-h-[min(62dvh,32.5rem)] max-w-full object-contain" controls playsInline preload="metadata" aria-label={trUi("common.ui.selectedStoryVideo")} />
          : <img ref={showFile} className="block max-h-[min(62dvh,32.5rem)] max-w-full object-contain" alt={trUi("common.ui.storyPhotoPreview")} />}
      </div>
      <p className={note + ' break-all'}>{file.name} · {formatUiNumber(file.size / (1024 * 1024), locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB</p>
      <p className={note}>{trUi('feed.storyMediaHint')}</p>
      {publishFailed && <p role="alert" className="mt-2 text-sm text-destructive">{trUi('feed.storyMediaFailed')}</p>}
      {/* Font size and weight sit here because buttons inherit them from the legacy global rule. */}
      <div className="flex flex-wrap justify-end gap-2.5 text-[0.8125rem] font-[660]">
        <button type="button" className={secondaryAction} onClick={onBack} disabled={busy}>
          <ArrowLeft size={18} aria-hidden="true" />{trUi("common.back")}</button>
        <button type="button" className={secondaryAction} onClick={() => fileInputRef.current?.click()} disabled={busy}>
          <ImagePlus size={18} aria-hidden="true" /> {trUi('feed.chooseOtherFile')}
        </button>
        <button type="button" className={'smart-story-publish border-primary bg-primary text-primary-foreground ' + action} onClick={async () => {
          setPublishFailed(false)
          if (!await onPublish()) setPublishFailed(true)
        }} disabled={busy}>
          <Send size={17} aria-hidden="true" /> {busy ? trUi("feed.posting") : trUi("feed.publishStory")}
        </button>
      </div>
    </section>
  )
}