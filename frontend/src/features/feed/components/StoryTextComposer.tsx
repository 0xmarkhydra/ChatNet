import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { Textarea } from '../../../shared/ui/textarea'
import type { StoryBackground, TextStoryInput } from '../types'
import { STORY_BACKGROUNDS, STORY_TEXT_LIMIT, storyTextLength } from '../utils/storyText'

export default function StoryTextComposer({ busy, onBack, onPublish }: {
  busy: boolean
  onBack: () => void
  onPublish: (input: TextStoryInput) => Promise<boolean>
}) {
  const trUi = useUiTranslation()

  const [text, setText] = useState('')
  const [background, setBackground] = useState<StoryBackground>('berry')
  const [publishFailed, setPublishFailed] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const length = storyTextLength(text)
  const canPublish = length > 0 && length <= STORY_TEXT_LIMIT && !busy
  const backgrounds = Object.keys(STORY_BACKGROUNDS) as StoryBackground[]

  useEffect(() => { input.current?.focus({ preventScroll: true }) }, [])

  return (
    <form className="grid min-w-0 gap-4" aria-label={trUi("common.ui.composeTextStory")} onSubmit={async event => {
      event.preventDefault()
      if (!canPublish) return
      setPublishFailed(false)
      if (!await onPublish({ text: text.trim(), background })) setPublishFailed(true)
    }}>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <label className="text-sm font-semibold" htmlFor="story-text">{trUi('feed.storyContent')}</label>
          <Textarea ref={input} id="story-text" value={text} onChange={event => setText(event.currentTarget.value)}
            aria-describedby="story-text-length" aria-invalid={length > STORY_TEXT_LIMIT}
            placeholder={trUi("common.ui.storySharePrompt")} disabled={busy} />
          <p className="m-0 text-sm text-muted-foreground" id="story-text-length">
            {trUi('feed.characterCount', { count: length, limit: STORY_TEXT_LIMIT })}{length > STORY_TEXT_LIMIT && ' · ' + trUi('feed.textTooLong')}
          </p>
          <fieldset className="m-0 min-w-0 border-0 p-0" disabled={busy}>
            <legend className="mb-2 text-sm font-semibold">{trUi('feed.backgroundColor')}</legend>
            <div className="flex flex-wrap gap-2">
              {backgrounds.map(color => (
                <label key={color} className="cursor-pointer">
                  <input className="peer sr-only" type="radio" name="story-background" checked={color === background}
                    onChange={() => setBackground(color)} />
                  <span aria-hidden="true" data-story-background={color}
                    className="block size-9 rounded-full peer-checked:ring-2 peer-checked:ring-ring peer-checked:ring-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
                  <span className="sr-only">{trUi(`feed.background.${color}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <section aria-label={trUi("common.ui.previewTextStory")} data-story-background={background}
          className="grid min-w-0 place-items-center rounded-xl p-4 text-center font-semibold text-white sm:min-h-52">
          <p className="m-0 max-h-48 w-full overflow-auto wrap-anywhere whitespace-pre-wrap">
            {text.trim() || trUi('feed.storyPreviewEmpty')}
          </p>
        </section>
      </div>
      <p className="m-0 text-sm text-muted-foreground">{trUi('feed.storyDurationHint')}</p>
      {publishFailed && <p role="alert" className="m-0 text-sm text-destructive">{trUi('feed.storyTextFailed')}</p>}
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="secondary" aria-label={trUi("common.ui.backStoryType")} onClick={onBack} disabled={busy}><ArrowLeft size={17} aria-hidden="true" />{trUi("common.back")}</Button>
        <Button type="submit" disabled={!canPublish}><Send size={17} aria-hidden="true" /> {busy ? trUi("feed.posting") : trUi("feed.publishStory")}</Button>
      </div>
    </form>
  )
}