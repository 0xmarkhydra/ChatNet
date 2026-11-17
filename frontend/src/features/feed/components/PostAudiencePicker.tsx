import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import { Check, ChevronDown, Globe2, LockKeyhole, UsersRound } from 'lucide-react'

export type PostVisibility = 'public' | 'friends' | 'private'

type Props = {
  value: PostVisibility
  disabled?: boolean
  onChange: (value: PostVisibility) => void
}

const audienceChoices = [
  { value: 'public', label: 'Công khai', description: 'Mọi người đều có thể xem bài viết.', Icon: Globe2 },
  { value: 'friends', label: 'Bạn bè', description: 'Chỉ bạn bè của bạn có thể xem.', Icon: UsersRound },
  { value: 'private', label: 'Chỉ mình tôi', description: 'Chỉ bạn có thể xem bài viết.', Icon: LockKeyhole },
] as const

export default function PostAudiencePicker({ value, disabled = false, onChange }: Props) {
  const [open, setOpen] = useScopedState(disabled ? 'disabled' : 'enabled', false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const current = audienceChoices.find(choice => choice.value === value) ?? audienceChoices[0]

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss, true)
    return () => document.removeEventListener('pointerdown', dismiss, true)
  }, [open, setOpen])

  useLayoutEffect(() => {
    const menu = menuRef.current
    const trigger = triggerRef.current
    if (!open || !menu || !trigger) return

    const position = (event?: Event) => {
      if (event?.target instanceof Node && menu.contains(event.target)) return
      const margin = 12
      const gap = 6
      const anchor = trigger.getBoundingClientRect()
      const above = Math.max(0, anchor.top - margin - gap)
      const below = Math.max(0, window.innerHeight - anchor.bottom - margin - gap)
      const naturalHeight = menu.scrollHeight + menu.offsetHeight - menu.clientHeight
      const placeAbove = naturalHeight > below && above > below
      // On short viewports overlap the anchor instead of clipping the last choice.
      const height = Math.min(naturalHeight, window.innerHeight - margin * 2)
      const preferredTop = placeAbove ? anchor.top - gap - height : anchor.bottom + gap
      const top = Math.max(margin, Math.min(preferredTop, window.innerHeight - margin - height))
      const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - menu.offsetWidth - margin))
      menu.style.top = `${top}px`
      menu.style.left = `${left}px`
      menu.style.maxHeight = `${height}px`
    }

    // A popover in the same dialog can escape its scroll container without losing modal focus.
    const selected = menu.querySelector<HTMLButtonElement>('[aria-checked="true"]')
    if (typeof menu.showPopover !== 'function') {
      selected?.focus({ preventScroll: true })
      return
    }
    menu.showPopover()
    position()
    selected?.focus({ preventScroll: true })
    window.addEventListener('resize', position)
    document.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      document.removeEventListener('scroll', position, true)
      if (menu.matches(':popover-open')) menu.hidePopover()
    }
  }, [open])

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      if (event.key === 'Tab') setOpen(false)
      return
    }
    event.preventDefault()
    const options = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
    const activeIndex = options.findIndex(option => option === document.activeElement)
    if (!options.length) return
    const targetIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? options.length - 1
        : event.key === 'ArrowDown' ? (activeIndex + 1) % options.length
          : (activeIndex - 1 + options.length) % options.length
    options[targetIndex]?.focus()
  }

  return (
    <div className="smart-composer-audience" ref={containerRef}>
      <button ref={triggerRef} type="button" className="smart-audience-trigger"
        aria-label="Ai có thể xem bài viết" aria-haspopup="menu"
        aria-expanded={open} aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen(previous => !previous)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
          }
        }}>
        <current.Icon size={14} strokeWidth={2.2} aria-hidden="true" />
        <span>{current.label}</span>
        <ChevronDown size={13} className={open ? 'smart-audience-chevron is-open' : 'smart-audience-chevron'} aria-hidden="true" />
      </button>
      {open && <div className="smart-audience-menu" id={menuId}
        role="menu" aria-label="Ai có thể xem bài viết" popover="manual"
        ref={menuRef} onKeyDown={onMenuKeyDown}>
        <div className="smart-audience-menu-heading">
          <strong>Ai có thể xem bài viết?</strong>
          <small>Chọn đối tượng bạn muốn chia sẻ.</small>
        </div>
        {audienceChoices.map(({ value: choiceValue, label, description, Icon }) => (
          <button key={choiceValue} type="button" role="menuitemradio"
            aria-label={label} aria-checked={value === choiceValue}
            className="smart-audience-choice"
            onClick={() => {
              onChange(choiceValue)
              setOpen(false)
              triggerRef.current?.focus()
            }}>
            <span className="smart-audience-choice-icon"><Icon size={19} strokeWidth={1.9} aria-hidden="true" /></span>
            <span className="smart-audience-choice-copy"><strong>{label}</strong><small>{description}</small></span>
            {value === choiceValue && <Check size={17} className="smart-audience-choice-check" aria-hidden="true" />}
          </button>
        ))}
      </div>}
    </div>
  )
}
