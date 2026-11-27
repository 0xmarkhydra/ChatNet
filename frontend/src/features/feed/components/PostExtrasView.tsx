import { useUiTranslation } from '@/shared/i18n/locale'
import { useState } from 'react'
import { MapPin, Smile, UserRound, UsersRound } from 'lucide-react'
import { POST_FEELINGS } from '../utils/feelings'
import { checkInDisplayName, checkInMapQuery } from '../utils/publicPostLocation'
import type { PostExtras } from '../utils/postExtras'
import '../styles/post-extras.css'

type Props = {
  extras: PostExtras
  onAuthorOpen?: (username: string) => void
  taggedNames?: Record<string, string>
}

export default function PostExtrasView({ extras, onAuthorOpen, taggedNames }: Props) {
  const trUi = useUiTranslation()

  const [showAllTags, setShowAllTags] = useState(false)
  const [showFeelingInfo, setShowFeelingInfo] = useState(false)
  const feeling = POST_FEELINGS.find(item => item.id === extras.feelingId)
  if (!extras.location && !extras.taggedUsernames.length && !feeling) return null
  const usernames = showAllTags ? extras.taggedUsernames : extras.taggedUsernames.slice(0, 2)
  return (
    <div className="feed-post-extras" aria-label={trUi("common.ui.postExtraInfo")}>
      {feeling && <span className="feed-post-extra-item">
        <button type="button" className="feed-post-extra-link feed-post-feeling"
          aria-label={trUi("common.ui.viewFeelingNamed", { v1: String(feeling.label) })} aria-expanded={showFeelingInfo}
          onClick={() => setShowFeelingInfo(value => !value)}>
          <span aria-hidden="true">{feeling.emoji}</span> đang cảm thấy <strong>{feeling.label}</strong>
        </button>
        {showFeelingInfo && <span className="feed-post-feeling-info" role="status">
          <Smile size={14} aria-hidden="true" /> Người đăng đang chia sẻ cảm xúc {feeling.label}.
        </span>}
      </span>}
      {extras.location && <span className="feed-post-extra-item min-w-0 max-w-full">
        <MapPin size={15} className="shrink-0 text-neutral-500" aria-hidden="true" />
        <a className="feed-post-extra-link min-w-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-neutral-600! hover:bg-neutral-200 [overflow-wrap:anywhere]" aria-label={trUi("common.ui.viewLocationNamed", { v1: String(checkInDisplayName(extras.location)) })}
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(checkInMapQuery(extras.location))}`}
          target="_blank" rel="noopener noreferrer"><strong>{checkInDisplayName(extras.location)}</strong></a>
      </span>}
      {extras.taggedUsernames.length > 0 && <span className="feed-post-extra-item">
        <UsersRound size={15} aria-hidden="true" />
        cùng với{' '}
        {usernames.map((username, index) => (
          <span key={username} className="feed-post-tag-entry">
            {index > 0 ? ', ' : ''}
            <button type="button" className="feed-post-extra-link"
              title={trUi("common.ui.viewAtProfile", { v1: String(username) })} aria-label={trUi("common.ui.viewAtProfile", { v1: String(username) })}
              disabled={!onAuthorOpen}
              onClick={() => onAuthorOpen?.(username)}>
              <UserRound size={13} aria-hidden="true" />
              <strong>{taggedNames?.[username] || `@${username}`}</strong>
            </button>
          </span>
        ))}
        {extras.taggedUsernames.length > 2 && <button type="button" className="feed-post-extra-link feed-post-extra-more"
          aria-expanded={showAllTags} onClick={() => setShowAllTags(value => !value)}>
          {showAllTags ? trUi("common.collapse") : `và ${extras.taggedUsernames.length - 2} người khác`}
        </button>}
      </span>}
    </div>
  )
}