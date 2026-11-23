import { useEffect, useRef, useState } from 'react'
import { useSession } from '../../../shared/context/SessionContext'
import type { Conversation } from '../types'
import { forwardMessageLegacy } from '../lib/forwardMessageLegacy'
import type { MessageForwardPickerProps } from '../types/messageForwardPicker'

export function useMessageForwardPicker({ message, conversations, request, uploadFiles, onClose, onFeedback }: MessageForwardPickerProps) {
  const { session, sessionRef } = useSession()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const clientIds = useRef(new Map<number, string>())
  const options = conversations.filter(item => !item.blockedByMe && !item.blockedByOther &&
    item.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))

  useEffect(() => {
    mounted.current = true
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => {
      mounted.current = false
      previousFocus.current?.focus()
    }
  }, [])

  async function submit(destination: Conversation) {
    if (inFlight.current || message.deleted) return
    const valid = options.some(item => item.id === destination.id)
    if (!valid) return
    const isCurrent = () => mounted.current && sessionRef.current?.sessionId === session.sessionId
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const clientId = clientIds.current.get(destination.id) ?? crypto.randomUUID()
      clientIds.current.set(destination.id, clientId)
      await forwardMessageLegacy({ message, destination, request, uploadFiles, clientId, isCurrent })
      if (!isCurrent()) return
      onFeedback(`Đã chuyển tiếp đến ${destination.name}.`, 'success')
      onClose()
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Không thể chuyển tiếp tin nhắn.')
    } finally {
      inFlight.current = false
      if (isCurrent()) setBusy(false)
    }
  }
  return { query, setQuery, busy, error, inputRef, options, submit }
}
