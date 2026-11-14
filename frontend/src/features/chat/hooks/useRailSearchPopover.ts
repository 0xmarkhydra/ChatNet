import { useEffect, useRef, useState, type CSSProperties } from 'react'

/** Anchored filter popover shared by the desktop and PWA avatar rails.
 * Rendering in a portal prevents the rail scroll/overflow from clipping filters. */
export function useRailSearchPopover(expanded: boolean) {
  const [open, setOpen] = useState(false)
  const [focusAfterExpand, setFocusAfterExpand] = useState(false)
  const [style, setStyle] = useState<CSSProperties | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!expanded) {
      const frame = requestAnimationFrame(() => {
        setOpen(false)
        setStyle(null)
      })
      return () => cancelAnimationFrame(frame)
    }
    if (!focusAfterExpand) return
    const frame = requestAnimationFrame(() => {
      searchRef.current?.querySelector('input')?.focus()
      setOpen(true)
      setFocusAfterExpand(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [expanded, focusAfterExpand])

  useEffect(() => {
    if (!open || !expanded) return
    const reposition = () => {
      const rect = searchRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(294, Math.max(200, window.innerWidth - 16))
      const roomRight = window.innerWidth - rect.right
      const roomLeft = rect.left
      // On desktop place filters BESIDE the rail, not over conversation avatars.
      // On narrow PWA screens, keep the compact panel under the input.
      const beside = window.innerWidth > 760 && roomRight >= width + 10
      const before = !beside && window.innerWidth > 760 && roomLeft >= width + 10
      const left = beside ? rect.right + 10 : before ? rect.left - width - 10
        : Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
      setStyle({
        position: 'fixed',
        left,
        top: Math.min(window.innerHeight - 54, beside || before ? rect.top : rect.bottom + 7),
        width,
        zIndex: 2200,
      })
    }
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && (searchRef.current?.contains(target) || filterRef.current?.contains(target))) return
      setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        searchRef.current?.querySelector('input')?.blur()
      }
    }
    reposition()
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, expanded])

  return { open, setOpen, searchRef, filterRef, style,
    focusAfterExpand: () => setFocusAfterExpand(true) }
}
