import { useId, useRef, useState, type ReactNode } from 'react'
import { ChevronsLeftRight, Menu, MessageSquarePlus, Search, Tags } from 'lucide-react'

type Props = {
  categoryControls: ReactNode
  expanded: boolean
  onCreate: () => void
  onExpand: () => void
  onCollapse: () => void
}

/** One hamburger in place of the former blue chevron.
 * Classification and other rail actions live in its native top-layer popover
 * so neither the sliding avatar rail nor the mobile PWA viewport clips them.
 */
export default function ConversationRailMenu({
  categoryControls, expanded, onCreate, onExpand, onCollapse,
}: Props) {
  const id = useId()
  const popover = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [visuallyExpanded, setVisuallyExpanded] = useState(expanded)

  const position = () => {
    const layout = trigger.current?.closest<HTMLElement>('.social-chat-layout')
    const inGroupPicker = layout?.classList.contains('desktop-channel-panel-open') ||
      layout?.classList.contains('mobile-rail-picker-view')
    setVisuallyExpanded(inGroupPicker
      ? layout?.dataset.splitExpanded === 'true' : expanded)
    const rect = trigger.current?.getBoundingClientRect()
    const menu = popover.current
    if (!rect || !menu) return
    const menuWidth = Math.min(292, window.innerWidth - 24)
    menu.style.left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - menuWidth - 12)) + 'px'
    menu.style.top = Math.min(rect.bottom + 8, Math.max(8, window.innerHeight - 185)) + 'px'
    menu.style.maxHeight = Math.max(160, window.innerHeight - rect.bottom - 18) + 'px'
  }

  const run = (action: () => void) => {
    popover.current?.hidePopover()
    action()
  }

  const focusConversationSearch = () => {
    // A group keeps the search mounted behind its compact avatar dock.
    // Expanding the shared splitter makes that same input usable again
    // without remounting either panel or refetching conversations.
    const layout = trigger.current?.closest<HTMLElement>('.social-chat-layout')
    const pickerOpen = layout?.classList.contains('mobile-rail-picker-view') ||
      layout?.classList.contains('desktop-channel-panel-open')
    const isExpanded = pickerOpen
      ? layout?.dataset.splitExpanded === 'true' : expanded
    run(() => {
      if (!isExpanded) onExpand()
      // A closed native popover restores focus to its trigger, and the
      // initially clipped group input becomes focusable after the seam moves.
      // Focus after that transition instead of racing either operation.
      const delay = pickerOpen &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 440 : 30
      window.setTimeout(() => {
        const selector = window.matchMedia('(max-width: 760px)').matches
          ? '.conversation-avatar-rail-search-field input'
          : '.desktop-conversation-rail-search-field input'
        const input = layout?.querySelector<HTMLInputElement>(selector)
        input?.focus({ preventScroll: true })
      }, delay)
    })
  }

  return (
    <div className="conversation-rail-menu-host">
      <button
        ref={trigger} type="button" className="conversation-rail-menu-trigger"
        aria-label="Menu hội thoại" title="Menu hội thoại"
        aria-expanded={open} aria-controls={id} popoverTarget={id}
        onClick={position}
      >
        <Menu size={26} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <div
        ref={popover} id={id} popover="auto" className="conversation-rail-menu-popover"
        onToggle={event => setOpen(event.newState === 'open')}
        onChangeCapture={event => {
          const target = event.target as HTMLElement
          if (target.closest('.category-options')) {
            // A chosen classification should immediately return to the
            // conversation list, not leave a top-layer menu covering avatars.
            requestAnimationFrame(() => popover.current?.hidePopover())
          }
        }}
      >
        <div className="conversation-rail-menu-title">Tùy chọn hội thoại</div>
        <button type="button" className="conversation-rail-menu-item"
          onClick={focusConversationSearch}>
          <Search size={18} aria-hidden="true" />
          Tìm hội thoại
        </button>
        <div className="conversation-rail-menu-classification">
          <Tags size={17} aria-hidden="true" />
          {categoryControls}
        </div>
        <button type="button" className="conversation-rail-menu-item"
          onClick={() => run(onCreate)}>
          <MessageSquarePlus size={18} aria-hidden="true" />
          Tạo cuộc trò chuyện
        </button>
        <button type="button" className="conversation-rail-menu-item"
          onClick={() => run(expanded ? onCollapse : onExpand)}>
          <ChevronsLeftRight size={18} aria-hidden="true" />
          {visuallyExpanded ? 'Thu gọn cột avatar' : 'Mở rộng cột avatar'}
        </button>
      </div>
    </div>
  )
}
