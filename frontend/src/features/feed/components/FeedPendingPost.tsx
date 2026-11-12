import MediaAttachmentsView from '../../../shared/ui/MediaAttachmentsView'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { userLabel } from '../../../shared/utils/userLabel'
import type { Post } from '../types'

export default function FeedPendingPost({ post }: { post: Post }) {
  return <article className="post zalo-post outgoing-preview" aria-busy="true">
    <UserAvatar username={post.author}
      name={userLabel(post.authorDisplayName, post.author)}
      className="avatar"
    />
    <div className="post-body">
      <div className="post-author">
        <strong>{userLabel(post.authorDisplayName, post.author)}</strong>
        <small>{post.visibility === 'friends' ? 'Bạn bè' : post.visibility === 'private' ? 'Chỉ mình tôi' : 'Công khai'}</small>
      </div>
      <p className="pending-content">{post.content}</p>
      <MediaAttachmentsView items={post.attachments} />
    </div>
  </article>
}
