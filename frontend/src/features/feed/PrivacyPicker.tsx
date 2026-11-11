import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe, Lock, Users } from 'lucide-react'
import './feed-actions.css'

export type PostVisibility = 'public' | 'friends' | 'private'

const options = [
  { value: 'public', label: 'Công khai', hint: 'Mọi người đều có thể xem', icon: Globe },
  { value: 'friends', label: 'Bạn bè', hint: 'Chỉ bạn bè của bạn', icon: Users },
  { value: 'private', label: 'Chỉ mình tôi', hint: 'Không ai khác thấy bài viết', icon: Lock },
] as const

type Props = {
  value: PostVisibility
  onChange: (value: PostVisibility) => void
  disabled?: boolean
}

export default function PrivacyPicker({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const current = options.find(option => option.value === value) ?? options[0]
  const CurrentIcon = current.icon

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div className="feed-edit-privacy" ref={root}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
        }
      }}>
      <button type="button" className="feed-edit-privacy-trigger" aria-haspopup="listbox" disabled={disabled}
        aria-expanded={open} aria-label={'Ai có thể xem bài viết? Hiện tại: ' + current.label}
        onClick={() => setOpen(previous => !previous)}>
        <CurrentIcon size={14} aria-hidden="true" />
        <span>{current.label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <ul className="feed-edit-privacy-menu" role="listbox" aria-label="Ai có thể xem bài viết?">
          {options.map(({ value: optionValue, label, hint, icon: Icon }) => (
            <li key={optionValue} role="option" aria-selected={value === optionValue}>
              <button type="button" onClick={() => { onChange(optionValue); setOpen(false) }}>
                <span className="feed-edit-privacy-icon"><Icon size={18} aria-hidden="true" /></span>
                <span className="feed-edit-privacy-text"><strong>{label}</strong><small>{hint}</small></span>
                {value === optionValue && <Check size={17} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
