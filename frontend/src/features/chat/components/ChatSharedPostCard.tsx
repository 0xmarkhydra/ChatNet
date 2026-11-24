import { Link } from 'react-router-dom'
import { Card, CardContent, CardFooter, CardHeader } from '../../../shared/ui/card'
import MediaAttachmentsView from '../../../shared/ui/MediaAttachmentsView'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { POST_FEELINGS, type SharedPostPreview } from '../../feed'

function PostIdentity({ username, author, createdAt, repostKind }: {
  username: string
  author: string
  createdAt: string
  repostKind?: SharedPostPreview['repostKind']
}) {
  const timestamp = Date.parse(createdAt)
  return (
    <header className="flex min-w-0 items-center gap-ui-3">
      <UserAvatar username={username} name={author} className="avatar size-10! basis-10! shrink-0! rounded-full!" />
      <div className="min-w-0">
        <strong className="block truncate text-ui-body font-semibold">{author}</strong>
        {repostKind && <span className="block text-ui-caption text-muted-foreground">
          {repostKind === 'quick' ? 'Đã đăng lại' : 'Đã trích dẫn'}
        </span>}
        {Number.isFinite(timestamp) && <time className="block text-ui-caption text-muted-foreground" dateTime={createdAt}>
          {new Date(timestamp).toLocaleString('vi-VN')}
        </time>}
      </div>
    </header>
  )
}

function PostMetadata({ extras }: { extras: SharedPostPreview['extras'] }) {
  const feeling = POST_FEELINGS.find(item => item.id === extras.feelingId)
  if (!extras.location && !extras.taggedUsernames.length && !feeling) return null
  return (
    <section aria-label="Thông tin bài viết" className="grid gap-ui-1 px-ui-3 pb-ui-3 text-ui-caption text-muted-foreground">
      {feeling && <p><span aria-hidden="true">{feeling.emoji}</span> Đang cảm thấy <strong>{feeling.label}</strong></p>}
      {extras.location && <p>📍 {extras.location}</p>}
      {extras.taggedUsernames.length > 0 && <p>👥 Cùng với {extras.taggedUsernames.map(name => '@' + name).join(', ')}</p>}
    </section>
  )
}

export default function ChatSharedPostCard({ post, postHref }: {
  post: SharedPostPreview
  postHref: string
}) {
  return (
    <Card asChild className="message-link-preview w-full max-w-full overflow-hidden p-0">
      <article aria-label={`Bài viết của ${post.author}`}>
        <CardHeader className="flex-row p-ui-3">
          <PostIdentity username={post.username} author={post.author} createdAt={post.createdAt} repostKind={post.repostKind} />
        </CardHeader>
        <PostMetadata extras={post.extras} />
        {post.text && <CardContent className="whitespace-pre-wrap break-words px-ui-3 pb-ui-3 text-ui-body">
          {post.text}
        </CardContent>}
        {post.attachments.length > 0 && <div className="px-ui-3 pb-ui-3">
          <MediaAttachmentsView items={post.attachments} />
        </div>}
        {post.originalPost && <section aria-label="Bài viết gốc" className="mx-ui-3 mb-ui-3 min-w-0 rounded-ui-md border border-border">
          <div className="p-ui-3">
            <PostIdentity username={post.originalPost.username} author={post.originalPost.author} createdAt="" />
          </div>
          <PostMetadata extras={post.originalPost.extras} />
          {post.originalPost.text && <p className="whitespace-pre-wrap break-words px-ui-3 pb-ui-3 text-ui-body">
            {post.originalPost.text}
          </p>}
          {post.originalPost.attachments.length > 0 && <div className="px-ui-3 pb-ui-3">
            <MediaAttachmentsView items={post.originalPost.attachments} />
          </div>}
        </section>}
        <CardFooter className="flex-wrap justify-between gap-ui-2 border-t border-border px-ui-3 py-ui-2 text-ui-caption text-muted-foreground">
          <span>{post.likes.toLocaleString('vi-VN')} lượt thích</span>
          <Link className="font-medium text-primary underline-offset-4 hover:underline" to={postHref}>
            Mở bài viết
          </Link>
        </CardFooter>
      </article>
    </Card>
  )
}
