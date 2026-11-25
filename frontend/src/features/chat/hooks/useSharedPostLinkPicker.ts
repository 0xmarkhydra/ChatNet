import { useEffect, useRef, useState } from 'react'
import { useSession } from '../../../shared/context/SessionContext'
import type { ApiRequest } from '../../../shared/types/api'
import { useConversationListSearch } from './useConversationListSearch'
import { sendSharedPostLink, SharedPostDeliveryError } from '../lib/sendSharedPostLink'
import type { Conversation } from '../types'

export type SharedPostLinkPickerProps = {
  url: string
  conversations: Conversation[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  request: ApiRequest
  onClose: () => void
  onOpenChat: (id: number) => void
  onSent: (name: string) => void
}

export function useSharedPostLinkPicker({ url, conversations, request, onClose, onSent }: Pick<SharedPostLinkPickerProps,
  'url' | 'conversations' | 'request' | 'onClose' | 'onSent'>) {
  const { session, sessionRef } = useSession()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [error, setError] = useState('')
  const [openInstead, setOpenInstead] = useState(false)
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const encryptedFailures = useRef(new Map<number, string>())
  const clientIds = useRef(new Map<number, string>())
  const search = useConversationListSearch({
    query, filter: 'all', categoryId: null, sessionId: session.sessionId, enabled: true, request,
  })
  const options = (search.active ? search.items : conversations).filter(c => !c.blockedByMe && !c.blockedByOther)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function submit() {
    if (!selected || inFlight.current || openInstead) return
    const destination = options.find(item => item.id === selected.id)
    if (!destination) return
    const isCurrent = () => sessionRef.current?.sessionId === session.sessionId && Boolean(dialog.current?.isConnected)
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const clientId = clientIds.current.get(destination.id) ?? crypto.randomUUID()
      clientIds.current.set(destination.id, clientId)
      await sendSharedPostLink({ destination, url, userId: session.user.id, clientId, request, isCurrent })
      if (!isCurrent()) return
      onSent(destination.name)
      onClose()
    } catch (cause) {
      if (!isCurrent()) return
      const message = cause instanceof Error ? cause.message : 'Không gửi được liên kết.'
      const requiresChat = cause instanceof SharedPostDeliveryError && cause.openChat
      if (requiresChat) encryptedFailures.current.set(destination.id, message)
      setOpenInstead(requiresChat)
      setError(message)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  function changeQuery(value: string) {
    setQuery(value)
    setSelected(null)
    setOpenInstead(false)
    setError('')
  }

  function selectConversation(item: Conversation) {
    if (selected?.id !== item.id) {
      const warning = encryptedFailures.current.get(item.id)
      setOpenInstead(Boolean(warning))
      setError(warning ?? '')
    }
    setSelected(item)
  }

  return { dialog, query, selected, error, openInstead, busy, search, options,
    changeQuery, selectConversation, submit }
}
