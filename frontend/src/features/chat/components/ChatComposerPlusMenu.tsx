import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CalendarClock, ClipboardList, Clock3, FileText, Images, Plus, Smile } from 'lucide-react'
import ChatEmojiPicker from './ChatEmojiPicker'
import ChatStickerPicker from './ChatStickerPicker'
import GiphyPicker from './GiphyPicker'
import { positionChatComposerMenu, type ChatComposerMenuPosition } from '../utils/positionChatComposerMenu'
import type { GroupActivityKind } from './GroupActivities'
import './ChatEmojiPicker.css'

type MenuMode = 'closed' | 'actions' | 'emoji' | 'sticker' | 'giphy'

type Props = {
  disabled: boolean
  onAttachFile: () => void
  onAttachMedia: () => void
  onInsertEmoji: (emoji: string) => void
  userId?: number
  onSelectGiphy?: (url: string) => void
  onSelectSticker?: (file: File) => void
  onSchedule?: () => void
  onGroupActivity?: (kind: GroupActivityKind) => void
}

export default function ChatComposerPlusMenu({ disabled, onAttachFile, onAttachMedia, onInsertEmoji, userId, onSelectSticker, onSelectGiphy, onSchedule, onGroupActivity }: Props) {
  const [mode, setMode] = useState<MenuMode>('closed')
  const [position, setPosition] = useState<ChatComposerMenuPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const actionHeight = 198 + (onSelectGiphy ? 44 : 0) + (onSelectSticker ? 44 : 0) + (onSchedule ? 44 : 0)
  const groupHeight = onGroupActivity ? 132 : 0
  const panelRef = useRef<HTMLDivElement>(null)

  function locate(nextMode: Exclude<MenuMode, 'closed'>) {
    const trigger = triggerRef.current
    if (!trigger) return
    const visual = window.visualViewport
    setPosition(positionChatComposerMenu(trigger.getBoundingClientRect(), {
      left: visual?.offsetLeft ?? 0,
      top: visual?.offsetTop ?? 0,
      width: visual?.width ?? window.innerWidth,
      height: visual?.height ?? window.innerHeight,
    }, nextMode !== 'actions' ? 430 : actionHeight + (window.innerWidth <= 760 ? groupHeight : 0)))
  }

  function show(nextMode: Exclude<MenuMode, 'closed'>) {
    locate(nextMode)
    setMode(nextMode)
  }

  useEffect(() => {
    if (mode === 'closed') return
    function onPointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (!triggerRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) {
        setMode('closed')
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setMode('closed')
        triggerRef.current?.focus()
      }
    }
    function onViewportChange() {
      const trigger = triggerRef.current
      if (!trigger) return
      const visual = window.visualViewport
      setPosition(positionChatComposerMenu(trigger.getBoundingClientRect(), {
        left: visual?.offsetLeft ?? 0,
        top: visual?.offsetTop ?? 0,
        width: visual?.width ?? window.innerWidth,
        height: visual?.height ?? window.innerHeight,
      }, mode !== 'actions' ? 430 : actionHeight + (window.innerWidth <= 760 ? groupHeight : 0)))
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    window.visualViewport?.addEventListener('resize', onViewportChange)
    window.visualViewport?.addEventListener('scroll', onViewportChange)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
      window.visualViewport?.removeEventListener('resize', onViewportChange)
      window.visualViewport?.removeEventListener('scroll', onViewportChange)
    }
  }, [mode, triggerRef, actionHeight, groupHeight])

  useEffect(() => {
    if (mode !== 'closed') panelRef.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [mode])

  const choose = (action: () => void) => {
    setMode('closed')
    triggerRef.current?.focus({ preventScroll: true })
    action()
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="ghost-action attach-button chat-plus-trigger"
        type="button"
        disabled={disabled}
        aria-label="Mở menu thêm nội dung"
        aria-haspopup="dialog"
        aria-expanded={mode !== 'closed'}
        title="Tùy chọn soạn tin"
        onClick={() => mode === 'closed' ? show('actions') : setMode('closed')}
      >
        <Plus className="chat-composer-plus" size={22} aria-hidden="true" />
      </button>
      {mode !== 'closed' && position && createPortal(
        <div
          ref={panelRef}
          className="chat-composer-plus-popover"
          role="dialog"
          aria-label={mode === 'emoji' ? 'Chọn emoji' : mode === 'sticker' ? 'Chọn sticker' : mode === 'giphy' ? 'Chọn GIPHY' : 'Thêm nội dung vào tin nhắn'}
          style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
        >
          {mode === 'actions' ? (
            <>
              <p className="chat-composer-plus-title">Tùy chọn soạn tin</p>
              <button type="button" className="chat-composer-plus-option" onClick={() => choose(onAttachFile)}>
                <FileText size={19} aria-hidden="true" /><span>Tệp tin</span>
              </button>
              <button type="button" className="chat-composer-plus-option" onClick={() => choose(onAttachMedia)}>
                <Images size={19} aria-hidden="true" /><span>Ảnh / Video</span>
              </button>
              <button type="button" className="chat-composer-plus-option" onClick={() => show('emoji')}>
                <Smile size={19} aria-hidden="true" /><span>Emoji</span>
              </button>
              {onSelectSticker && <button type="button" className="chat-composer-plus-option" onClick={() => show('sticker')}>
                <Smile size={19} aria-hidden="true" /><span>Sticker</span>
              </button>}
              {onSelectGiphy && <button type="button" className="chat-composer-plus-option" onClick={() => show('giphy')}><Images size={19} aria-hidden="true" /><span>GIF / Sticker động</span></button>}
              {onSchedule && (
                <button type="button" className="chat-composer-plus-option" onClick={() => choose(onSchedule)}>
                  <Clock3 size={19} aria-hidden="true" /><span>Hẹn giờ gửi</span>
                </button>
              )}
              {onGroupActivity && <>
                <button type="button" className="chat-composer-plus-option chat-composer-mobile-option" onClick={() => choose(() => onGroupActivity('poll'))}>
                  <ClipboardList size={19} aria-hidden="true" /><span>Bình chọn</span>
                </button>
                <button type="button" className="chat-composer-plus-option chat-composer-mobile-option" onClick={() => choose(() => onGroupActivity('note'))}>
                  <FileText size={19} aria-hidden="true" /><span>Ghi chú nhóm</span>
                </button>
                <button type="button" className="chat-composer-plus-option chat-composer-mobile-option" onClick={() => choose(() => onGroupActivity('reminder'))}>
                  <CalendarClock size={19} aria-hidden="true" /><span>Nhắc hẹn nhóm</span>
                </button>
              </>}
            </>
          ) : (
            <>
              <div className="chat-composer-plus-heading">
                <button type="button" aria-label="Quay lại menu thêm" onClick={() => show('actions')}>
                  <ArrowLeft size={19} aria-hidden="true" />
                </button>
                <strong>{mode === 'sticker' ? 'Chọn sticker' : mode === 'giphy' ? 'GIPHY' : 'Chọn emoji'}</strong>
              </div>
              {mode === 'giphy' && onSelectGiphy ? <GiphyPicker disabled={disabled} onSelect={url => choose(() => onSelectGiphy(url))} /> : mode === 'sticker' && onSelectSticker ? <ChatStickerPicker userId={userId} disabled={disabled} onSelect={file => choose(() => onSelectSticker(file))} /> : <ChatEmojiPicker onSelect={(emoji) => choose(() => onInsertEmoji(emoji))} />}
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}