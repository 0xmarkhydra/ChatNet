import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SmilePlus, Plus } from 'lucide-react'
import { messageReactions } from '../utils/messageReactions'
import type { Message } from '../types'

type Props = {
  message: Message
  busy: boolean
  toggleReaction: (message: Message, emoji: string) => Promise<void>
  openMessageReactions: (message: Message) => void
}

export default function MessageReactionQuickPicker({ message, busy, toggleReaction, openMessageReactions }: Props) {
  const trigger = useRef<HTMLButtonElement>(null)
  const picker = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusFirst = useRef(false)
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }, [])

  const close = useCallback(() => {
    cancelClose()
    setPosition(null)
  }, [cancelClose])

  function scheduleClose() {
    cancelClose()
    closeTimer.current = setTimeout(() => setPosition(null), 180)
  }

  function show() {
    cancelClose()
    const element = trigger.current
    if (!element || busy) return
    const anchor = element.getBoundingClientRect()
    const bounds = element.closest('.messages')?.getBoundingClientRect()
    const minX = Math.max(8, (bounds?.left ?? 0) + 8)
    const maxX = Math.min(window.innerWidth - 8, (bounds?.right ?? window.innerWidth) - 8)
    const width = Math.min(286, Math.max(1, maxX - minX))
    const left = Math.max(minX, Math.min(anchor.right - width, maxX - width))
    const top = anchor.top >= Math.max(8, bounds?.top ?? 0) + 48
      ? anchor.top - 48
      : Math.min(anchor.bottom + 10, window.innerHeight - 58)
    setPosition({ left, top, width })
  }

  useEffect(() => () => cancelClose(), [cancelClose])
  useEffect(() => {
    if (!position) return
    if (focusFirst.current) {
      focusFirst.current = false
      picker.current?.querySelector('button')?.focus({ preventScroll: true })
    }
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !picker.current?.contains(target)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (picker.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true })
        close()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [position, close])

  const selected = message.reactions?.find(reaction => reaction.mine)?.emoji
  return <>
    <button type="button" className="reaction-add"
      aria-label="Chọn cảm xúc cho tin nhắn" aria-expanded={Boolean(position)}
      onPointerEnter={event => { if (event.pointerType === 'mouse') show() }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') scheduleClose() }}
      onClick={event => {
        focusFirst.current = event.detail === 0
        show()
      }} ref={trigger}>
      <SmilePlus size={16} aria-hidden="true" />
    </button>
    {position && createPortal(
      <div className="chat-quick-reaction-picker" role="group" aria-label="Cảm xúc nhanh"
        ref={picker} style={position}
        onPointerEnter={cancelClose}
        onPointerLeave={event => { if (event.pointerType === 'mouse') scheduleClose() }}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}>
        {messageReactions.map(({ emoji, label }) => (
          <button type="button" key={emoji} title={label} aria-label={label}
            aria-pressed={selected === emoji} disabled={busy}
            onClick={() => { close(); void toggleReaction(message, emoji) }}>
            {emoji}
          </button>
        ))}
        <button type="button" title="Thêm emoji" aria-label="Thêm emoji khác"
          onClick={() => { close(); openMessageReactions(message) }}>
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>, document.body)}
  </>
}