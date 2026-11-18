import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, FileText, Images, Plus, Smile } from 'lucide-react'
import ChatEmojiPicker from './ChatEmojiPicker'
import { positionChatComposerMenu, type ChatComposerMenuPosition } from '../utils/positionChatComposerMenu'
import './ChatEmojiPicker.css'

type MenuMode = 'closed' | 'actions' | 'emoji'

type Props = {
  disabled: boolean
  onAttachFile: () => void
  onAttachMedia: () => void
  onInsertEmoji: (emoji: string) => void
}

export default function ChatComposerPlusMenu({ disabled, onAttachFile, onAttachMedia, onInsertEmoji }: Props) {
  const [mode, setMode] = useState<MenuMode>('closed')
  const [position, setPosition] = useState<ChatComposerMenuPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
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
    }, nextMode === 'emoji' ? 430 : 235))
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
      }, mode === 'emoji' ? 430 : 235))
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
  }, [mode])

  const choose = (action: () => void) => {
    setMode('closed')
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
        title="Thêm tệp, ảnh hoặc emoji"
        onClick={() => mode === 'closed' ? show('actions') : setMode('closed')}
      >
        <Plus className="chat-composer-plus" size={22} aria-hidden="true" />
      </button>
      {mode !== 'closed' && position && createPortal(
        <div
          ref={panelRef}
          className="chat-composer-plus-popover"
          role="dialog"
          aria-label={mode === 'emoji' ? 'Chọn emoji' : 'Thêm nội dung vào tin nhắn'}
          style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
        >
          {mode === 'actions' ? (
            <>
              <p className="chat-composer-plus-title">Thêm vào tin nhắn</p>
              <button type="button" className="chat-composer-plus-option" onClick={() => choose(onAttachFile)}>
                <FileText size={19} aria-hidden="true" /><span>Tệp tin</span>
              </button>
              <button type="button" className="chat-composer-plus-option" onClick={() => choose(onAttachMedia)}>
                <Images size={19} aria-hidden="true" /><span>Ảnh / Video</span>
              </button>
              <button type="button" className="chat-composer-plus-option" onClick={() => show('emoji')}>
                <Smile size={19} aria-hidden="true" /><span>Emoji</span>
              </button>
            </>
          ) : (
            <>
              <div className="chat-composer-plus-heading">
                <button type="button" aria-label="Quay lại menu thêm" onClick={() => show('actions')}>
                  <ArrowLeft size={19} aria-hidden="true" />
                </button>
                <strong>Chọn emoji</strong>
              </div>
              <ChatEmojiPicker onSelect={(emoji) => choose(() => onInsertEmoji(emoji))} />
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
