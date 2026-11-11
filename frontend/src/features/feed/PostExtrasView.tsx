import { useState } from 'react'
import { MapPin, Smile, UserRound, UsersRound } from 'lucide-react'
import { POST_FEELINGS } from './feelings'
import type { PostExtras } from './postExtras'
import './post-extras.css'

type Props = {
  extras: PostExtras
  onAuthorOpen?: (username: string) => void
  taggedNames?: Record<string, string>
}

export default function PostExtrasView({ extras, onAuthorOpen, taggedNames }: Props) {
  const [showAllTags, setShowAllTags] = useState(false)
  const [showFeelingInfo, setShowFeelingInfo] = useState(false)
  const feeling = POST_FEELINGS.find(item => item.id === extras.feelingId)
  if (!extras.location && !extras.taggedUsernames.length && !feeling) return null
  const usernames = showAllTags ? extras.taggedUsernames : extras.taggedUsernames.slice(0, 2)
  return (
    <div className="feed-post-extras" aria-label="Thông tin được thêm vào bài viết">
      {feeling && <span className="feed-post-extra-item">
        <button type="button" className="feed-post-extra-link feed-post-feeling"
          aria-label={`Xem cảm xúc ${feeling.label}`} aria-expanded={showFeelingInfo}
          onClick={() => setShowFeelingInfo(value => !value)}>
          <span aria-hidden="true">{feeling.emoji}</span> đang cảm thấy <strong>{feeling.label}</strong>
        </button>
        {showFeelingInfo && <span className="feed-post-feeling-info" role="status">
          <Smile size={14} aria-hidden="true" /> Người đăng đang chia sẻ cảm xúc {feeling.label}.
        </span>}
      </span>}
      {extras.location && <span className="feed-post-extra-item">
        <MapPin size={15} aria-hidden="true" />
        tại <a className="feed-post-extra-link" aria-label={`Xem địa điểm ${extras.location} trên bản đồ`}
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(extras.location)}`}
          target="_blank" rel="noopener noreferrer"><strong>{extras.location}</strong></a>
      </span>}
      {extras.taggedUsernames.length > 0 && <span className="feed-post-extra-item">
        <UsersRound size={15} aria-hidden="true" />
        cùng với{' '}
        {usernames.map((username, index) => (
          <span key={username} className="feed-post-tag-entry">
            {index > 0 ? ', ' : ''}
            <button type="button" className="feed-post-extra-link"
              title={`Xem hồ sơ @${username}`} aria-label={`Xem hồ sơ @${username}`}
              disabled={!onAuthorOpen}
              onClick={() => onAuthorOpen?.(username)}>
              <UserRound size={13} aria-hidden="true" />
              <strong>{taggedNames?.[username] || `@${username}`}</strong>
            </button>
          </span>
        ))}
        {extras.taggedUsernames.length > 2 && <button type="button" className="feed-post-extra-link feed-post-extra-more"
          aria-expanded={showAllTags} onClick={() => setShowAllTags(value => !value)}>
          {showAllTags ? 'Thu gọn' : `và ${extras.taggedUsernames.length - 2} người khác`}
        </button>}
      </span>}
    </div>
  )
}
