import { useEffect, useRef, useState } from 'react'
import type { AppDataContext } from '../../app/dataTypes'
import { CHAT_LIST_PAGE_SIZE, type Conversation } from './types'
export type ConversationCategory = { id: number; name: string; color: string }
type Options = AppDataContext & { mergeConversations: (items: Conversation[]) => void; setCategory: (id: number, categoryId: number | null) => void; clearCategory: (categoryId: number) => void }

export function useConversationCategories({ session, sessionRef, apiFetch, mergeConversations, setCategory, clearCategory }: Options) {
 const [categories, setCategories] = useState<ConversationCategory[]>([])
 const [selected, setSelected] = useState<number | null>(null)
 const [items, setItems] = useState<Conversation[]>([])
 const [hasMore, setHasMore] = useState(false)
 const [loading, setLoading] = useState(false)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [listError, setListError] = useState('')
 const selectedRef = useRef<number | null>(null)
 const sequence = useRef(0)
 const categorySequence = useRef(0)
 const offset = useRef(0)
 const flight = useRef(false)
 const mutation = useRef(false)
 const current = useRef({ apiFetch, mergeConversations, setCategory, clearCategory })
 current.current = { apiFetch, mergeConversations, setCategory, clearCategory }

 async function refreshCategories(force = false) {
  const sessionId = sessionRef.current?.sessionId
  if (!sessionId) return
  const seq = ++categorySequence.current
  try {
   const response = await current.current.apiFetch('/api/conversation-categories', force ? { cache: 'reload' } : {})
   if (!response.ok) throw new Error('Không tải được phân loại.')
   const data = await response.json() as ConversationCategory[]
   if (sessionRef.current?.sessionId !== sessionId || seq !== categorySequence.current) return
   setCategories(data)
   if (selectedRef.current && !data.some(c => c.id === selectedRef.current)) select(null)
   setError('')
  } catch (e) {
   if (sessionRef.current?.sessionId === sessionId && seq === categorySequence.current) setError(e instanceof Error ? e.message : 'Không tải được phân loại.')
  }
 }

 async function load(more = false, force = false) {
  const category = selectedRef.current
  const sessionId = sessionRef.current?.sessionId
  if (!sessionId || category === null || (more && flight.current)) return
  const seq = ++sequence.current
  flight.current = true
  setLoading(true)
  setListError('')
  try {
   const response = await current.current.apiFetch('/api/conversations?limit=' + CHAT_LIST_PAGE_SIZE + '&category=' + category + '&offset=' + (more ? offset.current : 0), force ? { cache: 'reload' } : {})
   if (!response.ok) throw new Error('Không tải được hội thoại theo phân loại.')
   const data = await response.json() as Conversation[]
   if (sessionRef.current?.sessionId !== sessionId || seq !== sequence.current || category !== selectedRef.current) return
   offset.current = (more ? offset.current : 0) + data.length
   setHasMore(data.length === CHAT_LIST_PAGE_SIZE)
   setItems(previous => more ? [...previous, ...data.filter(c => !previous.some(p => p.id === c.id))] : data)
   current.current.mergeConversations(data)
  } catch (e) {
   if (sessionRef.current?.sessionId === sessionId && seq === sequence.current) setListError(e instanceof Error ? e.message : 'Không tải được hội thoại.')
  } finally {
   if (seq === sequence.current) { flight.current = false; setLoading(false) }
  }
 }

 function select(id: number | null) {
  ++sequence.current
  selectedRef.current = id
  offset.current = 0
  flight.current = false
  setSelected(id)
  setItems([])
  setHasMore(false)
  setListError('')
  setLoading(false)
  if (id !== null) void load()
 }

 async function write(path: string, init: RequestInit, apply: (data: unknown) => void) {
  if (mutation.current) return false
  const sessionId = sessionRef.current?.sessionId
  if (!sessionId) return false
  mutation.current = true
  setBusy(true)
  setError('')
  try {
   const response = await current.current.apiFetch(path, init)
   const data = await response.json()
   if (sessionRef.current?.sessionId !== sessionId) return false
   if (!response.ok) throw new Error(data.error || 'Không lưu được phân loại.')
   ++categorySequence.current
   apply(data)
   return true
  } catch (e) {
   if (sessionRef.current?.sessionId === sessionId) setError(e instanceof Error ? e.message : 'Không lưu được phân loại. Hãy tải lại để kiểm tra.')
   return false
  } finally {
   mutation.current = false
   if (sessionRef.current?.sessionId === sessionId) setBusy(false)
  }
 }

 function save(value: Omit<ConversationCategory, 'id'>, id?: number) {
  return write('/api/conversation-categories' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body: JSON.stringify(value) }, data => {
   const category = data as ConversationCategory
   setCategories(previous => [...previous.filter(c => c.id !== category.id), category].sort((a,b) => a.name.localeCompare(b.name,'vi')))
  })
 }
 function remove(id: number) {
  return write('/api/conversation-categories/' + id, { method: 'DELETE' }, () => {
   setCategories(previous => previous.filter(c => c.id !== id))
   if (selectedRef.current === id) select(null)
   // Only locally loaded conversations need updating; the server cascades the assignments.
   current.current.clearCategory(id)
   if (selectedRef.current !== null) void load(false, true)
  })
 }
 function applyAssignment(id: number, categoryId: number | null) {
  current.current.setCategory(id, categoryId)
  if (selectedRef.current !== null) void load(false, true)
 }
 function assign(id: number, categoryId: number | null) {
  return write('/api/conversations/' + id + '/category', { method: 'PUT', body: JSON.stringify({ categoryId }) }, () => {
   applyAssignment(id, categoryId)
  })
 }
 function refreshFiltered() { if (selectedRef.current !== null) void load() }

 useEffect(() => {
  ++sequence.current
  ++categorySequence.current
  selectedRef.current = null
  offset.current = 0
  flight.current = false
  setSelected(null); setCategories([]); setItems([]); setHasMore(false); setLoading(false); setBusy(false); setError(''); setListError('')
  if (session?.sessionId) void refreshCategories()
  return () => { ++sequence.current; ++categorySequence.current }
 }, [session?.sessionId])

 return { categories, selected, select, items, hasMore, loading, busy, error, listError, load, save, remove, assign, refreshCategories, refreshFiltered, applyAssignment }
}