import { useUiTranslation } from '@/shared/i18n/locale'
import { useRef } from 'react'
import { Clapperboard, ImagePlus, MapPin } from 'lucide-react'
import PostStatusPrompt from './PostStatusPrompt'

type Props = {
  username: string
  displayName: string
  hasDraft?: boolean
  onCreatePost: () => void
  onCreateMediaPost: (files: File[]) => void
  onCreateStory: () => void
  onCheckIn: () => void
  pending?: boolean
  storyBusy?: boolean
  /** Edge-to-edge on mobile: no corner radius or side borders. */
  flushOnMobile?: boolean
  layout?: "inline" | "stacked"
}

const shortcutClass = 'inline-grid size-10 shrink-0 place-items-center rounded-xl border border-transparent transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-blue-400 disabled:cursor-not-allowed! disabled:opacity-45! app-mobile:size-[36px]'

/** One Tailwind-owned launcher for Feed and Profile. Parent page CSS must not style its internals. */
export default function PostComposerLauncher({
  username, displayName, hasDraft = false, onCreatePost, onCreateMediaPost, onCreateStory, onCheckIn,
  pending = false, storyBusy = false, flushOnMobile = false, layout = "inline",
}: Props) {
  const trUi = useUiTranslation()
  const stacked = layout === "stacked";
  const quickMediaInput = useRef<HTMLInputElement>(null)

  return (
    <section aria-label={trUi("common.ui.createContent")}
      className={`box-border flex w-full min-w-0 flex-col rounded-2xl border border-solid border-border-subtle bg-card p-3 px-4 shadow-sm app-mobile:p-3 ${flushOnMobile ? 'app-mobile:rounded-none app-mobile:border-x-0' : 'app-mobile:rounded-[14px]'}`}>
      <div className={`flex w-full min-w-0 items-center gap-ui-2 ${stacked ? "flex-wrap" : ""}`}>
        <PostStatusPrompt
          username={username}
          displayName={displayName}
          avatarClassName="relative size-10! shrink-0! overflow-hidden rounded-full! app-mobile:size-9!"
          promptClassName="box-border min-h-[41px] min-w-0 flex-1 rounded-full border border-[#eef0f4] bg-[#f3f5f8] px-[17px] py-2 text-left text-sm font-normal leading-normal text-[#687487] transition-colors hover:border-[#e2e7f0] hover:bg-[#edf1f7] focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-blue-400 disabled:cursor-not-allowed! disabled:opacity-45! app-mobile:min-h-10 app-mobile:px-[11px] app-mobile:text-xs"
          prompt={trUi(hasDraft ? "profile.continuePost" : "feed.whatThinking")}
          onCreatePost={onCreatePost}
          pending={pending}
        />
        <div className={`flex shrink-0 items-center gap-1.5 ${stacked ? "w-full justify-between border-0 border-t border-solid border-border-subtle pt-ui-2" : "justify-end app-mobile:gap-1"}`} role="group" aria-label={trUi("common.ui.quickCreateContent")}>
          <input ref={quickMediaInput} className="sr-only" type="file" accept="image/*,video/*" multiple
            aria-label={trUi("common.ui.chooseMediaPost")}
            onChange={event => {
              const files = Array.from(event.currentTarget.files || [])
              event.currentTarget.value = ''
              if (files.length) onCreateMediaPost(files)
            }} />
          <button type="button" aria-label={trUi("common.photoSlashVideo")} title={trUi("feed.addMedia")} disabled={pending}
            className={stacked ? "flex min-w-0 flex-1 items-center justify-center gap-ui-2 whitespace-normal rounded-ui-md border-0 bg-transparent py-ui-2 text-ui-body font-medium text-muted-foreground hover:bg-accent" : `${shortcutClass} border-[#e0f0e6] bg-[#e9f8ef] text-[#168658]`}
            onClick={() => quickMediaInput.current?.click()}>
            <ImagePlus size={21} className={stacked ? "text-[#168658] shrink-0" : undefined} aria-hidden="true" />{stacked && <span>{trUi('common.photoSlashVideo')}</span>}
          </button>
          <button type="button" aria-label={trUi("feed.createStory")} title={trUi("feed.createStory")} disabled={pending || storyBusy}
            className={stacked ? "flex min-w-0 flex-1 items-center justify-center gap-ui-2 whitespace-normal rounded-ui-md border-0 bg-transparent py-ui-2 text-ui-body font-medium text-muted-foreground hover:bg-accent" : `${shortcutClass} border-[#ebe1fc] bg-[#f3edfe] text-[#8250cb]`}
            onClick={onCreateStory}>
            <Clapperboard size={21} className={stacked ? "text-primary shrink-0" : undefined} aria-hidden="true" />{stacked && <span>{trUi('profile.storyShort')}</span>}
          </button>
          <button type="button" aria-label={trUi("common.ui.addCheckin")} title={trUi("common.ui.addCheckin")} disabled={pending}
            className={stacked ? "flex min-w-0 flex-1 items-center justify-center gap-ui-2 whitespace-normal rounded-ui-md border-0 bg-transparent py-ui-2 text-ui-body font-medium text-muted-foreground hover:bg-accent" : `${shortcutClass} border-[#f9e7d3] bg-[#fff3e6] text-[#d47a26]`}
            onClick={onCheckIn}>
            <MapPin size={21} className={stacked ? "text-[#d47a26] shrink-0" : undefined} aria-hidden="true" />{stacked && <span>{trUi('profile.checkinShort')}</span>}
          </button>
        </div>
      </div>
    </section>
  )
}