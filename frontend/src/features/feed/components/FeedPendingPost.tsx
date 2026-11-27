import { useUiTranslation } from '@/shared/i18n/locale'
import MediaAttachmentsView from '../../../shared/ui/MediaAttachmentsView'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { userLabel } from '../../../shared/utils/userLabel'
import type { Post } from '../types'

export default function FeedPendingPost({ post }: { post: Post }) {
  const trUi = useUiTranslation()

  const author = userLabel(post.authorDisplayName, post.author)
  return <article className="outgoing-preview mb-3.5 grid grid-cols-[42px_minmax(0,1fr)] gap-2.5 overflow-hidden rounded-ui-xl border border-border bg-card px-3 pt-3.5 pb-3 text-foreground shadow-[0_4px_22px_rgba(38,61,120,0.043)]" aria-busy="true">
    <UserAvatar username={post.author} name={author} className="avatar" />
    <div className="flex min-w-0 items-start justify-between">
      <strong className="text-ui-body font-bold text-foreground">{author}</strong>
      <small className="text-ui-caption text-muted-foreground">{post.visibility === 'friends' ? trUi("contacts.friends") : post.visibility === 'private' ? trUi("profile.onlyMe") : trUi("common.public")}</small>
    </div>
    <p className="col-span-full mt-2.5 mb-1.5 text-ui-body leading-normal whitespace-pre-wrap">{post.content}</p>
    <MediaAttachmentsView items={post.attachments} />
  </article>
}
