import { useEffect, useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import { ProfileOverlay } from '../../profile'
import type { StoryDraft, TextStoryInput } from '../types'
import StoryComposer from './StoryComposer'
import StoryTextComposer from './StoryTextComposer'
import '../styles/story-text.css'

export type StoryDraftOverlayProps = {
  createStory: (input: { file: File } | TextStoryInput) => Promise<boolean>
  mediaUploading: 'chat' | 'feed' | 'story' | 'profile' | null
  setStoryDraft: (draft: StoryDraft | null) => void
  storyBusy: boolean
  storyDraft: StoryDraft
}

const choiceCard = 'flex h-[clamp(9.5rem,34vw,16.5rem)] min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-0 px-2 py-4 text-center text-sm font-semibold leading-snug text-white shadow-sm ring-1 ring-white/15 ring-inset hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-3 sm:px-4 sm:text-base'
const choiceIcon = 'grid size-10 shrink-0 place-items-center rounded-full bg-white font-bold text-slate-900 shadow-sm sm:size-12'
const choiceLabel = 'grid min-h-10 place-items-center text-balance sm:min-h-12'

export default function StoryDraftOverlay({
  createStory, mediaUploading, setStoryDraft, storyBusy, storyDraft,
}: StoryDraftOverlayProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const mediaChoice = useRef<HTMLButtonElement>(null)
  const mode = storyDraft.kind
  useEffect(() => {
    if (mode === 'choose') mediaChoice.current?.focus({ preventScroll: true })
  }, [mode])
  const pickFile = (file: File) => setStoryDraft({ kind: 'media', file })
  const busy = storyBusy || (storyDraft.kind === 'media' && Boolean(mediaUploading))

  return (
    <ProfileOverlay title="Tạo Story" closeLabel="Đóng tạo tin" busy={storyBusy || mediaUploading === 'story'}
      onClose={() => setStoryDraft(null)}>
      <div className="box-border px-4 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
        {storyDraft.kind === 'choose' ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4" aria-label="Chọn loại tin" role="group">
            <input ref={fileInput} hidden type="file" accept="image/*,video/*" aria-label="Chọn ảnh hoặc video cho Story"
              onChange={event => {
                const selected = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (selected) pickFile(selected)
              }} />
            <button ref={mediaChoice} type="button" className={choiceCard} data-story-background="indigo"
              onClick={() => fileInput.current?.click()}>
              <span className={choiceIcon}><ImagePlus size={22} aria-hidden="true" /></span>
              <span className={choiceLabel}>Tạo tin có ảnh hoặc video</span>
            </button>
            <button type="button" data-story-background="berry" className={choiceCard}
              onClick={() => setStoryDraft({ kind: 'text' })}>
              <span className={choiceIcon} aria-hidden="true">Aa</span>
              <span className={choiceLabel}>Tạo tin dạng văn bản</span>
            </button>
          </div>
        ) : storyDraft.kind === 'media' ? (
          <StoryComposer file={storyDraft.file} busy={busy}
            onPublish={() => void createStory({ file: storyDraft.file })} onChangeFile={pickFile} />
        ) : (
          <StoryTextComposer busy={busy} onBack={() => setStoryDraft({ kind: 'choose' })}
            onPublish={createStory} />
        )}
      </div>
    </ProfileOverlay>
  )
}