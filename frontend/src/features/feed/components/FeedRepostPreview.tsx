import { useUiTranslation } from '@/shared/i18n/locale'
import { Repeat2 } from 'lucide-react'
import { userLabel } from '../../../shared/utils/userLabel'
import MediaAttachmentsView from '../../../shared/ui/MediaAttachmentsView'
import { parsePostExtras } from '../utils/postExtras'
import type { Post } from '../types'

export default function FeedRepostPreview({ post, onOpen }: { post: Post; onOpen: (id: number) => void }) {
  const trUi = useUiTranslation()

  const original = post.originalPost
  if (!original) return null
  const author = userLabel(original.authorDisplayName, original.author)
  const { caption } = parsePostExtras(original.content)
  return <div className="my-3 grid min-w-0 gap-2 rounded-xl border border-border bg-muted/35 p-3">
    <button type="button" className="flex items-center gap-2 self-start text-left text-sm font-semibold text-primary hover:underline"
      aria-label={trUi("common.ui.openOriginalPost", { v1: String(author) })} onClick={() => onOpen(original.id)}>
      <Repeat2 size={17} aria-hidden="true" />{author} · {trUi('feed.originalPost')}
    </button>
    {caption && <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm text-foreground">{caption}</p>}
    {Boolean(original.attachments?.length) &&
      <MediaAttachmentsView items={original.attachments} onImageClick={() => onOpen(original.id)} />}
  </div>
}