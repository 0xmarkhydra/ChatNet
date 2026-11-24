import { useRef } from 'react'
import { Clapperboard, ImagePlus, MapPin } from 'lucide-react'
import PostStatusPrompt from './PostStatusPrompt'

type Props = {
  username: string
  displayName: string
  prompt: string
  onCreatePost: () => void
  onCreateMediaPost: (files: File[]) => void
  onCreateStory: () => void
  onCheckIn: () => void
  pending?: boolean
  storyBusy?: boolean
}

const shortcutClass = 'inline-grid size-10 shrink-0 place-items-center rounded-xl border border-transparent transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-blue-400 disabled:cursor-not-allowed! disabled:opacity-45! app-mobile:size-[36px]'

/** One Tailwind-owned launcher for Feed and Profile. Parent page CSS must not style its internals. */
export default function PostComposerLauncher({
  username, displayName, prompt, onCreatePost, onCreateMediaPost, onCreateStory, onCheckIn,
  pending = false, storyBusy = false,
}: Props) {
  const quickMediaInput = useRef<HTMLInputElement>(null)

  return (
    <section aria-label="Tạo nội dung mới"
      className="box-border flex w-full min-w-0 flex-col rounded-2xl border border-[#e5eaf2] bg-white p-3 px-4 shadow-[0_3px_16px_rgba(30,51,96,0.035)] app-mobile:rounded-[14px] app-mobile:p-3">
      <div className="flex w-full min-w-0 items-center gap-[11px] app-mobile:gap-2">
        <PostStatusPrompt
          username={username}
          displayName={displayName}
          avatarClassName="relative size-10! shrink-0! overflow-hidden rounded-full! app-mobile:size-9!"
          promptClassName="box-border min-h-[41px] min-w-0 flex-1 rounded-full border border-[#eef0f4] bg-[#f3f5f8] px-[17px] py-2 text-left text-sm font-normal leading-normal text-[#687487] transition-colors hover:border-[#e2e7f0] hover:bg-[#edf1f7] focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-blue-400 disabled:cursor-not-allowed! disabled:opacity-45! app-mobile:min-h-10 app-mobile:px-[11px] app-mobile:text-xs"
          prompt={prompt}
          onCreatePost={onCreatePost}
          pending={pending}
        />
        <div className="flex shrink-0 items-center justify-end gap-1.5 app-mobile:gap-1" role="group" aria-label="Tạo nội dung nhanh">
          <input ref={quickMediaInput} className="sr-only" type="file" accept="image/*,video/*" multiple
            aria-label="Chọn ảnh hoặc video đăng bài"
            onChange={event => {
              const files = Array.from(event.currentTarget.files || [])
              event.currentTarget.value = ''
              if (files.length) onCreateMediaPost(files)
            }} />
          <button type="button" aria-label="Ảnh / Video" title="Thêm ảnh hoặc video" disabled={pending}
            className={`${shortcutClass} border-[#e0f0e6] bg-[#e9f8ef] text-[#168658]`}
            onClick={() => quickMediaInput.current?.click()}>
            <ImagePlus size={21} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Story" title="Tạo Story" disabled={pending || storyBusy}
            className={`${shortcutClass} border-[#ebe1fc] bg-[#f3edfe] text-[#8250cb]`}
            onClick={onCreateStory}>
            <Clapperboard size={21} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Check-in" title="Thêm địa điểm check-in" disabled={pending}
            className={`${shortcutClass} border-[#f9e7d3] bg-[#fff3e6] text-[#d47a26]`}
            onClick={onCheckIn}>
            <MapPin size={21} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
