import { useCallback, useEffect, useRef } from 'react'
import { useLatest } from '../../../shared/hooks/useLatest'
import type { ApiRequest } from '../../../shared/types/api'
import { listMessages } from '../api/messages'
import { listChannels } from '../api/community'
import { MESSAGE_PAGE_SIZE, type Conversation } from '../types'
import type { ChatTranslationSettings } from '../lib/conversationTranslationSettings'

type Options = {
  request?: ApiRequest
  sessionId?: string
  enabled: boolean
  conversations: Conversation[]
  activeConversationId: number | null
  targetLanguage: string
  overrides: Record<number, ChatTranslationSettings>
}

function canPrefetch() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return navigator.onLine && document.visibilityState === 'visible' &&
    !connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '')
}

/** A single low-priority warmup at a time. No read receipt or mutation. */
export function useChatPrefetch(options: Options) {
  const latest = useLatest(options)
  const pending = useRef(false)
  const attempted = useRef(new Map<string, number>())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const warm = useCallback(async (conversation: Conversation) => {
    const { request, enabled, sessionId, activeConversationId, targetLanguage, overrides } = latest.current
    if (!request || !enabled || !sessionId || conversation.id === activeConversationId ||
        conversation.blockedByMe || conversation.blockedByOther || !canPrefetch() || pending.current) return
    const target = overrides[conversation.id]?.targetLanguage ?? targetLanguage
    const key = JSON.stringify([sessionId, conversation.id, target])
    if (Date.now() - (attempted.current.get(key) ?? 0) < 3500) return
    attempted.current.set(key, Date.now())
    if (attempted.current.size > 12) attempted.current.delete(attempted.current.keys().next().value!)
    pending.current = true
    try {
      // Channel metadata is the first thing a group picker needs. Warm it
      // independently of history; do not wait for message responses.
      if (conversation.type === 'group') await listChannels(request, conversation.id)
      if (latest.current.sessionId === sessionId && latest.current.enabled &&
          latest.current.activeConversationId !== conversation.id && canPrefetch()) {
        await listMessages(request, { conversationId: conversation.id, target, channelId: 0, limit: MESSAGE_PAGE_SIZE })
      }
    } catch { /* Best effort only. The normal foreground request remains authoritative. */ }
    finally { pending.current = false }
  }, [latest])
  const prefetchConversation = useCallback((conversation: Conversation) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void warm(conversation), 100)
  }, [warm])
  const recent = options.conversations.filter(item => item.id !== options.activeConversationId && !item.blockedByMe && !item.blockedByOther).slice(0, 2)
  const recentKey = recent.map(item => item.id).join(':')
  useEffect(() => {
    if (!options.enabled || !options.sessionId) return
    const idle = setTimeout(async () => {
      const candidates = latest.current.conversations.filter(item => item.id !== latest.current.activeConversationId &&
        !item.blockedByMe && !item.blockedByOther).slice(0, 2)
      for (const item of candidates) {
        if (cancelled) break
        await warm(item)
      }
    }, 500)
    let cancelled = false
    return () => { cancelled = true; clearTimeout(idle); clearTimeout(timer.current) }
  }, [options.enabled, options.sessionId, recentKey, latest, warm])
  return prefetchConversation
}