import { useEffect, useState } from 'react'
import { API } from '../lib/config'

function avatarInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

function avatarTone(name: string) {
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
  className = 'avatar',
  online = false,
  group = false,
}: {
  name: string
  className?: string
  online?: boolean
  group?: boolean
}) {
  const version = avatarRefreshVersions.get(name)
  const imageUrl = group ? '' : profileAssetUrl(name, 'avatar', version)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [imageUrl])

  return (
    <div
      className={`${className} smart-avatar avatar-tone-${avatarTone(name)} ${group ? 'group' : ''}`}
      aria-label={name}
      title={name}
    >
      <span className="avatar-initials">{group ? '👥' : avatarInitials(name)}</span>
      {!group && !imageFailed && (
        <img
          className="avatar-photo"
          src={imageUrl}
          alt=""
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      )}
      <span className="avatar-shine" aria-hidden="true" />
      {online && <span className="presence-dot" />}
    </div>
  )
}
