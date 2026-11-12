import type { InterpreterUpdate } from './callMediaInterpreter'

export type CallCaption = {
  id: string
  speakerId: string
  original: string
  translated: string
  updatedAt: number
}

export function appendCallCaption(current: CallCaption[], update: InterpreterUpdate): CallCaption[] {
  const text = (update.translated || update.original || '').trim()
  if (!text) return current
  const now = Date.now()
  const previous = current.at(-1)
  if (previous && previous.speakerId === update.speakerId && now - previous.updatedAt < 3500) {
    const field = update.translated ? 'translated' : 'original'
    const last = previous[field]
    const nextText = text.startsWith(last) ? text : (last ? last + ' ' : '') + text
    return [...current.slice(0, -1), { ...previous, [field]: nextText.slice(-1200), updatedAt: now }]
  }
  return [...current, {
    id: crypto.randomUUID(),
    speakerId: update.speakerId,
    original: update.original || '',
    translated: update.translated || '',
    updatedAt: now,
  }].slice(-80)
}
