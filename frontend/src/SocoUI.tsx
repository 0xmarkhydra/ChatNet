import type { ReactNode } from 'react'
import { ArrowUpRight, MessageCircleMore, SearchX, UsersRound } from 'lucide-react'

/** Presentational primitives for consistent SOCO mobile and desktop screens. */
export function SocoSectionHeading({
  eyebrow,
  title,
  description,
  action,
  className = '',
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <header className={`soco-section-heading ${className}`}>
      <div className="soco-section-heading-copy">
        {eyebrow && <span className="soco-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="soco-section-heading-action">{action}</div>}
    </header>
  )
}

export function SocoEmptyState({
  kind = 'search',
  title,
  description,
  action,
}: {
  kind?: 'chat' | 'friends' | 'search'
  title: string
  description?: string
  action?: ReactNode
}) {
  const Icon = kind === 'chat' ? MessageCircleMore : kind === 'friends' ? UsersRound : SearchX
  return (
    <div className="soco-empty-state" role="status">
      <div className="soco-empty-state-icon"><Icon size={27} strokeWidth={1.8} aria-hidden="true" /></div>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && <div className="soco-empty-action">{action}</div>}
    </div>
  )
}

export function SocoTextAction({
  children,
  onClick,
  label,
}: {
  children: ReactNode
  onClick: () => void
  label?: string
}) {
  return (
    <button type="button" className="soco-text-action" onClick={onClick} aria-label={label}>
      {children}
      <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
