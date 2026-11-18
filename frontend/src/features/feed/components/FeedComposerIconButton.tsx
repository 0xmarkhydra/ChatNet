import { useState, type ComponentPropsWithoutRef } from 'react'
import { MapPin } from 'lucide-react'

type Icon = 'photo' | 'story' | 'location' | 'background' | 'tag' | 'feeling'
type Props = Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'onFocus' | 'onPointerEnter'> & { icon: Icon }

function PhotoCard() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2.5" className="feed-shortcut-photo-surface" />
      <circle cx="9" cy="9" r="1.6" />
      <path d="m4 17 4-4 3 3 4.5-5L21 17" />
    </svg>
  )
}

function Brush() {
  return (
    <>
      <path d="M9.1 8.6 17.6 1a1.5 1.5 0 0 1 2.1 2.1l-7.6 8.5z" fill="var(--composer-art-surface)" />
      <path d="m9.1 8.6 3 3c.4 2.2-2.2 4.2-5.6 3.4 1.2-.8.2-3.4 2.6-6.4Z" fill="currentColor" strokeWidth="1.1" />
    </>
  )
}

function PaletteGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
      strokeLinecap="round" strokeLinejoin="round">
      <g className="composer-art-brush composer-art-brush--behind"><Brush /></g>
      <g className="composer-art-board">
        <path d="M12 3a9 9 0 1 0 0 18h1.4a1.6 1.6 0 0 0 1-2.8 1.1 1.1 0 0 1 .7-2h2.4a3.5 3.5 0 0 0 3.5-3.6A9.2 9.2 0 0 0 12 3Z"
          fill="var(--composer-art-surface)" />
        <g fill="currentColor" stroke="none">
          <circle cx="7.6" cy="10.9" r="1.05" />
          <circle cx="10.6" cy="7.6" r="1.05" />
          <circle cx="15" cy="8" r="1.05" />
          <circle cx="17.4" cy="11.6" r="1.05" />
        </g>
      </g>
      <path className="composer-art-ink" d="M6.3 16.3c2.4-1.2 4.8-3.1 7.6-3.2 1.3-.1 1.8.3 1.9.6" pathLength="1" strokeWidth="1.65" />
      <g className="composer-art-brush composer-art-brush--front"><Brush /></g>
      <path className="composer-art-glint" d="M18.4 5v3.1m-1.6-1.55H20M21 3v1.6m-.8-.8h1.6" strokeWidth="1.15" />
    </svg>
  )
}

function TagPerson() {
  return <><circle cx="10" cy="7.5" r="4" /><path d="M2.8 20a7.2 7.2 0 0 1 12.1-5.2" /></>
}

function TagGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <g className="composer-tag-resident"><TagPerson /></g>
      <g className="composer-tag-visitor"><TagPerson /></g>
      <path className="composer-tag-impact" d="m2.5 4.5-1.7-1.4M1.9 9.7H0m15.5-7.2 1.1-1.7"
        strokeWidth="1.3" />
      <path className="composer-tag-plus" d="M19.3 13.3v6.9m-3.45-3.45h6.9" />
    </svg>
  )
}

function FeelingGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">
      <path className="composer-feeling-head" d="M19.8 10.2A8.9 8.9 0 1 1 13.3 3.6" />
      <g className="composer-face-idle">
        <path d="M17.5 3.1v5m.0-2.5H15m2.5 0H20M21 9.2v1.9m-1-.95h2" strokeWidth="1.4" />
        <path d="M7.3 10.4h.02m5.8 0h.02" strokeWidth="2.15" />
        <path d="M7 13.5a4.5 4.5 0 0 0 6.6 0" />
      </g>
      <g className="composer-face-happy">
        <path d="M6.1 10.8q1.3-2.3 2.6 0m3.4 0q1.3-2.3 2.6 0M7.1 13.7q3.3 1.2 6.6 0c-1.1 4.4-5.5 4.4-6.6 0Z" />
        <path d="M16.8 7.3v3m-1.5-1.5h3M4.2 13.1h1.1m10.1 0h1.1" strokeWidth="1.15" />
      </g>
      <g className="composer-face-sad">
        <path d="m6.5 10.5 2-1m4.3 0 2 1M7.8 16.1q2.4-2.6 5 0" />
      </g>
      <g className="composer-face-crying">
        <path d="m6.2 10.8 2.6 1-2.6 1m8.2-2-2.6 1 2.6 1" />
        <ellipse cx="10.4" cy="16" rx="1.8" ry="1.45" />
        <path className="composer-face-tear" d="M5.2 13.6q-1.7 2.2 0 2.6 1.7-.4 0-2.6Zm11 0q-1.7 2.2 0 2.6 1.7-.4 0-2.6Z"
          fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}

function ComposerGlyph({ icon }: { icon: Icon }) {
  switch (icon) {
    case 'photo': return <><PhotoCard /><PhotoCard /></>
    case 'story':
      return (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <g className="feed-shortcut-clapper-lid">
            <path d="M3 11V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v4z M8 6l2.5 5 M15 6l2.5 5" />
          </g>
        </svg>
      )
    case 'location': return <MapPin size={21} />
    case 'background': return <PaletteGlyph />
    case 'tag': return <TagGlyph />
    case 'feeling': return <FeelingGlyph />
  }
}

export default function FeedComposerIconButton({ icon, disabled, onClick, ...props }: Props) {
  const [run, setRun] = useState(0)
  const play = () => {
    if (!disabled && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setRun(current => current + 1)
    }
  }

  return (
    <button {...props} type="button" disabled={disabled}
      onPointerEnter={event => { if (event.pointerType === 'mouse') play() }}
      onFocus={event => { if (event.currentTarget.matches(':focus-visible')) play() }}
      onClick={event => { play(); onClick?.(event) }}>
      <span key={run} className={`feed-shortcut-icon feed-shortcut-icon--${icon}${run ? ' is-playing' : ''}`} aria-hidden="true">
        <ComposerGlyph icon={icon} />
      </span>
    </button>
  )
}