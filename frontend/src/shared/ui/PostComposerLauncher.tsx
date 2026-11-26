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
  /** Edge-to-edge on mobile: no corner radius or side borders. */
  flushOnMobile?: boolean
  /** Stacked quick actions for the owner’s full mobile profile only. */
  mobileProfile?: boolean
}

const shortcutClass = 'inline-grid size-10 shrink-0 place-items-center rounded-xl border border-transparent transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-blue-400 disabled:cursor-not-allowed! disabled:opacity-45! app-mobile:size-[36px]'

/** One Tailwind-owned launcher for Feed and Profile. Parent page CSS must not style its internals. */
export default function PostComposerLauncher({
  username, displayName, prompt, onCreatePost, onCreateMediaPost, onCreateStory, onCheckIn,
  pending = false, storyBusy = false, flushOnMobile = false, mobileProfile = false,
}: Props) {
  const quickMediaInput = useRef<HTMLInputElement>(null)

  const profileShortcut = "flex min-h-control-touch min-w-0 flex-1 items-center justify-center gap-1 whitespace-normal rounded-full border-0 bg-card px-1 text-ui-caption font-semibold leading-tight text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 [&>svg]:shrink-0 [&>svg]:text-primary"
  return (
    <section aria-label="Tạo nội dung mới"
      className={mobileProfile ? "box-border flex w-full min-w-0 flex-col bg-card" : `box-border flex w-full min-w-0 flex-col rounded-2xl border border-[#e5eaf2] bg-white p-3 px-4 shadow-[0_3px_16px_rgba(30,51,96,0.035)] app-mobile:p-3 ${flushOnMobile ? 'app-mobile:rounded-none app-mobile:border-x-0' : 'app-mobile:rounded-[14px]'}`}>
      <div className={mobileProfile ? "flex w-full min-w-0 flex-wrap items-center gap-ui-2" : "flex w-full min-w-0 items-center gap-[11px] app-mobile:gap-2"}>
        <PostStatusPrompt
          username={username}
          displayName={displayName}
          avatarClassName={mobileProfile ? "size-control-touch shrink-0 rounded-full" : "relative size-10! shrink-0! overflow-hidden rounded-full! app-mobile:size-9!"}
          promptClassName={mobileProfile ? "min-h-control-touch min-w-0 flex-1 border-0 bg-transparent px-ui-2 py-ui-2 text-left text-ui-body text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50" : "box-border min-h-[41px] min-w-0 flex-1 rounded-full border border-[#eef0f4] bg-[#f3f5f8] px-[17px] py-2 text-left text-sm font-normal leading-normal text-[#687487] transition-colors hover:border-[#e2e7f0] hover:bg-[#edf1f7] focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-blue-400 disabled:cursor-not-allowed! disabled:opacity-45! app-mobile:min-h-10 app-mobile:px-[11px] app-mobile:text-xs"}
          prompt={prompt}
          onCreatePost={onCreatePost}
          pending={pending}
        />
        <div className={mobileProfile ? "flex w-full basis-full items-stretch gap-ui-2 bg-background px-ui-2 py-ui-3 box-border" : "flex shrink-0 items-center justify-end gap-1.5 app-mobile:gap-1"} role="group" aria-label="Tạo nội dung nhanh">
          <input ref={quickMediaInput} className="sr-only" type="file" accept="image/*,video/*" multiple
            aria-label="Chọn ảnh hoặc video đăng bài"
            onChange={event => {
              const files = Array.from(event.currentTarget.files || [])
              event.currentTarget.value = ''
              if (files.length) onCreateMediaPost(files)
            }} />
          <button type="button" aria-label="Ảnh / Video" title="Thêm ảnh hoặc video" disabled={pending}
            className={mobileProfile ? profileShortcut : `${shortcutClass} border-[#e0f0e6] bg-[#e9f8ef] text-[#168658]`}
            onClick={() => quickMediaInput.current?.click()}>
            <ImagePlus size={mobileProfile ? 20 : 21} aria-hidden="true" />
            {mobileProfile && <span>Ảnh / Video</span>}
          </button>
          <button type="button" aria-label="Story" title="Tạo Story" disabled={pending || storyBusy}
            className={mobileProfile ? profileShortcut : `${shortcutClass} border-[#ebe1fc] bg-[#f3edfe] text-[#8250cb]`}
            onClick={onCreateStory}>
            <Clapperboard size={mobileProfile ? 20 : 21} aria-hidden="true" />
            {mobileProfile && <span>Story</span>}
          </button>
          <button type="button" aria-label="Check-in" title="Thêm địa điểm check-in" disabled={pending}
            className={mobileProfile ? profileShortcut : `${shortcutClass} border-[#f9e7d3] bg-[#fff3e6] text-[#d47a26]`}
            onClick={onCheckIn}>
            <MapPin size={mobileProfile ? 20 : 21} aria-hidden="true" />
            {mobileProfile && <span>Check-in</span>}
          </button>
        </div>
      </div>
    </section>
  )
}