import { useUiTranslation } from '@/shared/i18n/locale'
import { useId, useLayoutEffect, useRef, useState, type RefObject, type ClipboardEvent } from 'react'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { GroupMember } from '../types'
import { shouldSendChatOnEnter } from '../utils/composerKeyboard'
import { findMentionQuery, insertMention, matchMentionMembers, mentionedUsernames, splitMessageMentions } from '../utils/mentions'
import '../styles/chat-mentions.css'

type Props = {
  conversationId: number
  members: GroupMember[]
  inputRef: RefObject<HTMLTextAreaElement | null>
  text: string
  setText: (text: string) => void
  placeholder: string
  onFilesPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void
}

type Candidate = { key: string; username: string; displayName: string; online?: boolean; all?: boolean }

export default function ChatMentionInput({ members, inputRef, text, setText, placeholder, onFilesPaste }: Props) {
  const trUi = useUiTranslation()

  const [cursor, setCursor] = useState(0)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [selected, setSelected] = useState(0)
  const [composing, setComposing] = useState(false)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const mentionListId = useId()
  const mentionOptionId = (key: string) => `${mentionListId}-${key}`
  const query = focused && !dismissed && !composing && members.length ? findMentionQuery(text, cursor) : null
  const otherMentions = query ? text.slice(0, query.start) + ' '.repeat(query.end - query.start) + text.slice(query.end) : text
  const used = mentionedUsernames(otherMentions)
  const candidates: Candidate[] = query ? [
    ...(!used.has('all') && 'all'.includes(query.query.toLocaleLowerCase()) ? [{ key: 'all', username: 'all', displayName: 'Tất cả thành viên', all: true }] : []),
    ...matchMentionMembers(members, query.query, text, query).map(member => ({ key: String(member.id), username: member.username, displayName: member.displayName, online: member.online })),
  ].slice(0, 8) : []
  const open = query !== null && candidates.length > 0
  const activeIndex = Math.min(selected, Math.max(0, candidates.length - 1))
  const tokens = splitMessageMentions(text, members)

  // The textarea owns the real caret, while the mirror paints @mentions. Match their
  // computed text metrics (including responsive overrides) so the caret stays on the
  // visible glyph when typing, wrapping, or scrolling through multiple lines.
  useLayoutEffect(() => {
    const input = inputRef.current
    const mirror = mirrorRef.current
    if (!input || !mirror) return
    const resize = () => {
      input.style.height = 'auto'
      input.style.height = `${Math.min(154, Math.max(43, input.scrollHeight))}px`

      const computed = getComputedStyle(input)
      for (const property of [
        'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
        'font-stretch', 'line-height', 'letter-spacing', 'word-spacing',
        'text-align', 'text-indent', 'text-transform', 'direction',
        'white-space', 'overflow-wrap', 'word-break', 'tab-size',
        'padding-top', 'padding-bottom', 'padding-left',
      ]) {
        mirror.style.setProperty(property, computed.getPropertyValue(property))
      }
      // Non-overlay scrollbars consume text width in the textarea, but not in
      // the absolutely positioned mirror. Reserve exactly the same space.
      const scrollbarWidth = Math.max(0, input.offsetWidth - input.clientWidth
        - (parseFloat(computed.borderLeftWidth) || 0)
        - (parseFloat(computed.borderRightWidth) || 0))
      mirror.style.paddingRight = `${(parseFloat(computed.paddingRight) || 0) + scrollbarWidth}px`
      mirror.scrollTop = input.scrollTop
      mirror.scrollLeft = input.scrollLeft
    }
    resize()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    if (input.parentElement && observer) observer.observe(input.parentElement)
    return () => observer?.disconnect()
  }, [text, inputRef])

  function choose(candidate: Candidate) {
    const input = inputRef.current
    if (!input || !query) return
    const next = insertMention(text, query, candidate.username)
    setText(next.text)
    setCursor(next.cursor)
    setDismissed(false)
    setSelected(0)
    input.focus()
    requestAnimationFrame(() => input.setSelectionRange(next.cursor, next.cursor))
  }

  function syncScroll(input: HTMLTextAreaElement) {
    if (mirrorRef.current) {
      mirrorRef.current.scrollTop = input.scrollTop
      mirrorRef.current.scrollLeft = input.scrollLeft
    }
  }

  return (
    <div className="chat-mention-input">
      {open && <div className="chat-mention-list" id={mentionListId} role="listbox" aria-label={trUi("chat.mentionMember")}>
        {candidates.map((candidate, index) => (
          <button
            key={candidate.key}
            id={mentionOptionId(candidate.key)}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={index === activeIndex ? 'chat-mention-option active' : 'chat-mention-option'}
            onMouseDown={event => event.preventDefault()}
            onClick={() => choose(candidate)}
          >
            {candidate.all
              ? <span className="chat-mention-avatar" aria-hidden="true">@</span>
              : <UserAvatar username={candidate.username} name={candidate.displayName || candidate.username} className="chat-mention-avatar" />}
            <span className="chat-mention-name"><strong>{candidate.displayName || candidate.username}</strong><small>@{candidate.username}</small></span>
            {candidate.online && <span className="chat-mention-online" aria-label={trUi("profile.active")} />}
          </button>
        ))}
      </div>}
      <div className="chat-mention-editor">
        <div className="chat-mention-highlight" ref={mirrorRef} aria-hidden="true">{tokens.map((part, index) =>
          part.username || part.all ? <span key={index} className="chat-mention-highlighted">{part.text}</span> : <span key={index}>{part.text}</span>
        )}{text.endsWith('\n') ? '\u200b' : null}</div>
        <textarea
          ref={inputRef}
          className="chat-message-input"
          rows={1}
          aria-label={trUi("chat.messages")}
          aria-autocomplete={members.length ? 'list' : 'none'}
          aria-expanded={open}
          aria-controls={open ? mentionListId : undefined}
          aria-activedescendant={open ? mentionOptionId(candidates[activeIndex].key) : undefined}
          placeholder={placeholder}
          value={text}
          onFocus={event => { setFocused(true); setCursor(event.currentTarget.selectionStart) }}
          onBlur={() => setFocused(false)}
          onChange={event => { setText(event.target.value); setCursor(event.target.selectionStart); setDismissed(false); setSelected(0); syncScroll(event.currentTarget) }}
          onClick={event => { setCursor(event.currentTarget.selectionStart); setDismissed(false) }}
          onSelect={event => setCursor(event.currentTarget.selectionStart)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={event => { setComposing(false); setCursor(event.currentTarget.selectionStart) }}
          onScroll={event => syncScroll(event.currentTarget)}
          onKeyDown={event => {
            // IME Enter confirms a Vietnamese composition; it must never send a message or pick a mention.
            if (event.nativeEvent.isComposing || composing || event.keyCode === 229) return
            if (open) {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setSelected(i => (i + (event.key === 'ArrowDown' ? 1 : -1) + candidates.length) % candidates.length)
                return
              }
              if (event.key === 'Escape') { event.preventDefault(); setDismissed(true); return }
              if ((event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) || event.key === 'Tab') {
                event.preventDefault()
                choose(candidates[activeIndex])
                return
              }
            }
            if (!shouldSendChatOnEnter(event.nativeEvent)) return
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }}
          onPaste={onFilesPaste}
          title={trUi("chat.pasteFile")}
          maxLength={4000}
        />
      </div>
    </div>
  )
}
