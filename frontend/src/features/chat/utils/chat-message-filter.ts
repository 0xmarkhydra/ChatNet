export type ChatMessageSearchFilters = {
  keyword: string
  sender: string
  from: string
  to: string
}

type SearchableChatMessage = {
  sender: string
  text: string
  createdAt: string
  deleted?: boolean
}

export function chatMessageSearchQuery({ keyword, sender, from, to }: ChatMessageSearchFilters): string {
  const params = new URLSearchParams()
  if (keyword.trim()) params.set('search', keyword.trim())
  if (sender.trim()) params.set('sender', sender.trim().replace(/^@/, ''))
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return params.toString()
}

export function matchesChatMessageSearch(message: SearchableChatMessage, filters: ChatMessageSearchFilters): boolean {
  const keyword = filters.keyword.trim().toLocaleLowerCase('vi-VN')
  const sender = filters.sender.trim().replace(/^@/, '').toLocaleLowerCase('vi-VN')
  if (keyword && (message.deleted || !message.text.toLocaleLowerCase('vi-VN').includes(keyword))) return false
  if (sender && message.sender.toLocaleLowerCase('vi-VN') !== sender) return false
  if (filters.from || filters.to) {
    const date = new Date(message.createdAt)
    if (Number.isNaN(date.getTime())) return false
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    if (filters.from && day < filters.from) return false
    if (filters.to && day > filters.to) return false
  }
  return true
}
