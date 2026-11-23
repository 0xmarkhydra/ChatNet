import { useEffect, useMemo, useRef, useState } from 'react'
import type { GroupMember, Message } from '../types'
import { listGroupMembers } from '../api/groups'
import { listChannelSharedFiles, listSharedFilesBefore, searchMessages, searchMoreMessages } from '../api/search'
import { userLabel } from '../../../shared/utils/userLabel'
import { useLatest } from '../../../shared/hooks/useLatest'
import { useScopedState } from '../../../shared/hooks/useScopedState'

type SharedPage = { items: Message[]; nextBefore?: number }
const PAGE_SIZE = 40
const PREVIEW_COUNT = 4
function searchFileName(message: Message, keyword: string) {
  return (message.attachments || []).some((attachment) =>
    (attachment.kind === 'file' || attachment.kind === 'audio') &&
    (!keyword || attachment.name.toLocaleLowerCase('vi-VN').includes(keyword.toLocaleLowerCase('vi-VN'))))
}

function matchesFilters(message: Message, sender: string, from: string, to: string) {
  if (sender && message.sender.toLocaleLowerCase('vi-VN') !== sender.toLocaleLowerCase('vi-VN')) return false
  const day = new Date(message.createdAt)
  if (Number.isNaN(day.getTime())) return false
  const localDay = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0')
  return (!from || localDay >= from) && (!to || localDay <= to)
}

export function useMessageSearchData({ conversationId, channelId, request, onJump, onClose }: {
  conversationId: number
  channelId: number
  request: (path: string, init?: RequestInit) => Promise<Response>
  onJump: (message: Message) => Promise<void>
  onClose: () => void
}) {
  const requestRef = useLatest(request)
  const [keyword, setKeyword] = useState('')
  const [sender, setSender] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const scope = JSON.stringify([conversationId, channelId, keyword, sender, from, to])
  const [members, setMembers] = useScopedState<GroupMember[]>(conversationId, [])
  const [results, setResults] = useScopedState<Message[]>(scope, [])
  const [fileMessages, setFileMessages] = useScopedState<Message[]>(scope, [])
  const [loading, setLoading] = useScopedState(scope, true)
  const [loadingFiles, setLoadingFiles] = useScopedState(scope, true)
  const [loadingMore, setLoadingMore] = useScopedState(scope, false)
  const [error, setError] = useScopedState(scope, '')
  const [filesError, setFilesError] = useScopedState(scope, '')
  const [hasMore, setHasMore] = useScopedState(scope, false)
  const [nextFilesBefore, setNextFilesBefore] = useScopedState<number | undefined>(scope, undefined)
  const [messageLimit, setMessageLimit] = useScopedState(scope, PREVIEW_COUNT)
  const [fileLimit, setFileLimit] = useScopedState(scope, PREVIEW_COUNT)
  const [jumpingId, setJumpingId] = useScopedState<number | null>(scope, null)
  const sequence = useRef(0)
  const fileSequence = useRef(0)
  const queryRef = useRef('')
  const hasFilters = Boolean(keyword.trim() || sender.trim() || from || to)
  const invalidDates = Boolean(from && to && from > to)

  useEffect(() => {
    let alive = true
    void listGroupMembers(requestRef.current, conversationId)
      .then(async (response) => response.ok ? await response.json() as GroupMember[] : [])
      .then((items) => { if (alive && Array.isArray(items)) setMembers(items) })
      .catch(() => { /* Some direct conversations do not expose a members list. */ })
    return () => { alive = false }
  }, [conversationId, requestRef, setMembers])

  useEffect(() => {
    const id = ++sequence.current
    if (!hasFilters || invalidDates) return
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), channelId: String(channelId) })
        if (keyword.trim()) params.set('search', keyword.trim())
        if (sender.trim()) params.set('sender', sender.trim().replace(/^@/, ''))
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        params.set('tzOffset', String(new Date().getTimezoneOffset()))
        const query = params.toString()
        const response = await searchMessages(requestRef.current, conversationId, query)
        if (!response.ok) throw new Error('Không thể tìm tin nhắn. Vui lòng thử lại.')
        const items = await response.json() as Message[]
        if (sequence.current !== id) return
        queryRef.current = query
        setResults(items)
        setHasMore(items.length === PAGE_SIZE)
      } catch (cause) {
        if (sequence.current === id) setError(cause instanceof Error ? cause.message : 'Lỗi tìm kiếm')
      } finally {
        if (sequence.current === id) setLoading(false)
      }
    }, 300)
    const activeSequence = sequence
    return () => { window.clearTimeout(timer); ++activeSequence.current }
  }, [conversationId, channelId, keyword, sender, from, to, hasFilters, invalidDates, requestRef, setResults, setHasMore, setError, setLoading])

  // The message search API filters text only; shared files supply filename matches.
  useEffect(() => {
    const id = ++fileSequence.current
    if (!hasFilters || invalidDates) return
    const timer = window.setTimeout(async () => {
      try {
        const response = await listChannelSharedFiles(requestRef.current, conversationId, channelId)
        if (!response.ok) throw new Error('Không tải được danh sách file')
        const page = await response.json() as SharedPage
        if (fileSequence.current !== id) return
        setFileMessages(Array.isArray(page.items) ? page.items : [])
        setNextFilesBefore(page.nextBefore)
      } catch (cause) {
        if (fileSequence.current === id) setFilesError(cause instanceof Error ? cause.message : 'Không tải được danh sách file')
      } finally {
        if (fileSequence.current === id) setLoadingFiles(false)
      }
    }, 300)
    const activeFileSequence = fileSequence
    return () => { window.clearTimeout(timer); ++activeFileSequence.current }
  }, [conversationId, channelId, keyword, sender, from, to, hasFilters, invalidDates, requestRef, setFileMessages, setNextFilesBefore, setFilesError, setLoadingFiles])

  const fileHits = useMemo(() => fileMessages.filter((message) =>
    !message.deleted && (message.channelId || 0) === channelId && matchesFilters(message, sender, from, to) && searchFileName(message, keyword.trim())
  ), [fileMessages, channelId, sender, from, to, keyword])

  const messageHits = useMemo(() => {
    const byId = new Map<number, Message>()
    for (const message of results) if (!message.deleted) byId.set(message.id, message)
    for (const message of fileHits) if (!byId.has(message.id)) byId.set(message.id, message)
    return [...byId.values()].sort((a, b) => b.id - a.id)
  }, [results, fileHits])

  const files = useMemo(() => fileHits.flatMap((message) =>
    (message.attachments || []).filter((attachment) =>
      (attachment.kind === 'file' || attachment.kind === 'audio') &&
      (!keyword.trim() || attachment.name.toLocaleLowerCase('vi-VN').includes(keyword.trim().toLocaleLowerCase('vi-VN')))
    ).map((attachment) => ({ message, attachment }))
  ), [fileHits, keyword])

  const people = useMemo(() => {
    const map = new Map<string, { username: string; name: string }>()
    for (const member of members) map.set(member.username, { username: member.username, name: userLabel(member.displayName, member.username) })
    for (const message of [...results, ...fileMessages]) {
      if (!map.has(message.sender)) map.set(message.sender, { username: message.sender, name: userLabel(message.senderDisplayName, message.sender) })
    }
    return [...map.values()]
  }, [members, results, fileMessages])

  async function jumpTo(message: Message) {
    setJumpingId(message.id)
    try { await onJump(message); onClose() }
    catch { setError('Không mở được tin nhắn này.'); setJumpingId(null) }
  }

  async function loadMoreMessages() {
    if (!hasMore || loadingMore || !results.length) return
    const cursor = Math.min(...results.map((message) => message.id))
    setLoadingMore(true)
    try {
      const response = await searchMoreMessages(requestRef.current, conversationId, queryRef.current, cursor)
      if (!response.ok) throw new Error('Không thể tải thêm kết quả')
      const more = await response.json() as Message[]
      setResults((current) => {
        const ids = new Set(current.map((message) => message.id))
        return [...current, ...more.filter((message) => !ids.has(message.id))]
      })
      setHasMore(more.length === PAGE_SIZE)
      setMessageLimit((value) => value + 10)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Lỗi tải kết quả') }
    finally { setLoadingMore(false) }
  }

  async function loadMoreFiles() {
    if (!nextFilesBefore || loadingMore) return
    setLoadingMore(true)
    try {
      const response = await listSharedFilesBefore(requestRef.current, conversationId, nextFilesBefore)
      if (!response.ok) throw new Error('Không thể tải thêm file')
      const page = await response.json() as SharedPage
      setFileMessages((current) => [...current, ...(Array.isArray(page.items) ? page.items : [])])
      setNextFilesBefore(page.nextBefore)
      setFileLimit((value) => value + 10)
    } catch (cause) { setFilesError(cause instanceof Error ? cause.message : 'Lỗi tải file') }
    finally { setLoadingMore(false) }
  }

  return { keyword,setKeyword,sender,setSender,from,setFrom,to,setTo,loading,loadingFiles,loadingMore,error,filesError,hasMore,nextFilesBefore,messageLimit,setMessageLimit,fileLimit,setFileLimit,jumpingId,hasFilters,invalidDates,messageHits,files,people,jumpTo,loadMoreMessages,loadMoreFiles }
}
