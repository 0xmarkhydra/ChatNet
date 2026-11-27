import { useUiTranslation } from '@/shared/i18n/locale'
import { useScopedState } from '../hooks/useScopedState'
import { API } from '../lib/config'
import { cn } from '../lib/utils'
import { useAvatarStoryStatus, type AvatarStoryStatus } from './avatarStoryStatus'

const avatarSizes = {
  xs: 'size-6 text-ui-caption',
  sm: 'size-8 text-ui-label',
  md: 'size-10 text-ui-body',
  lg: 'size-12 text-ui-subtitle',
  xl: 'size-16 text-ui-section',
} as const

function avatarInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

export function avatarTone(displayName: string) {
  const name = displayName.trim()
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return hash % 8
}

export const avatarRefreshVersions = new Map<string, string>()

export function profileAssetUrl(name: string, kind: 'avatar' | 'cover', version?: string) {
  const base = `${API}/api/users/${encodeURIComponent(name)}/${kind}`
  return version ? `${base}?v=${encodeURIComponent(version)}` : base
}

export default function UserAvatar({
  name,
  username = name,
  className,
  size,
  storyStatus,
  online = false,
  group = false,
  imageUrl: suppliedImageUrl,
  initialsOnly = false,
}: {
  name: string
  username?: string
  className?: string
  size?: keyof typeof avatarSizes
  /** Override the session-derived ring, e.g. for a create card or group collage. */
  storyStatus?: AvatarStoryStatus
  online?: boolean
  group?: boolean
  imageUrl?: string
  initialsOnly?: boolean
}) {
  const trUi = useUiTranslation()
  const version = avatarRefreshVersions.get(username)
  const imageUrl = initialsOnly ? '' : group ? (suppliedImageUrl || '') : profileAssetUrl(username, 'avatar', version)
  const [imageFailed, setImageFailed] = useScopedState(imageUrl, false)
  const inferredStory = useAvatarStoryStatus(username)
  const ring = group ? 'none' : storyStatus ?? inferredStory

  return (
    <div
      className={cn('smart-avatar relative isolate grid shrink-0 place-items-center rounded-[var(--avatar-radius,50%)] bg-(image:--soco-avatar-gradient) text-primary-foreground',
        size ? avatarSizes[size] : !className && 'avatar',
        `avatar-tone-${avatarTone(name)}`, group && 'group', online && 'is-online', className)}
      data-story-status={ring}
      role="img"
      aria-label={name}
      aria-description={ring === 'unseen' ? trUi('common.ui.storyUnseen') : ring === 'seen' ? trUi('common.ui.storySeen') : undefined}
      title={name}
    >
      <span className="avatar-initials relative z-1 m-0 flex items-center justify-center leading-none" aria-hidden="true">{group ? '👥' : avatarInitials(name)}</span>
      {imageUrl && !imageFailed && (
        <img
          className="avatar-photo pointer-events-none absolute inset-0 z-3 size-full rounded-[inherit] object-cover object-center select-none"
          src={imageUrl}
          alt=""
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      )}
      {ring !== 'none' && <span aria-hidden="true" data-slot="avatar-story-ring"
        className={cn('pointer-events-none absolute -inset-[3px] z-4 rounded-[inherit] border-2 border-solid',
          ring === 'unseen' ? 'border-primary' : 'border-muted-foreground/50')} />}
      {online && <span className="presence-dot" aria-hidden="true" />}
    </div>
  )
}