import { useState } from 'react'
import { Search } from 'lucide-react'
import { chatEmojiGroups, searchChatEmojis } from '../utils/chatEmojiCatalog'
import './ChatEmojiPicker.css'

type Props = {
  onSelect: (emoji: string) => void
  selectedEmoji?: string
  label?: string
}

export default function ChatEmojiPicker({ onSelect, selectedEmoji, label = 'Danh sách emoji' }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(chatEmojiGroups[0].id)
  const emojis = searchChatEmojis(search, category)

  return (
    <div className="chat-emoji-picker" role="group" aria-label={label}>
      <div className="chat-emoji-picker-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          aria-label="Tìm emoji"
          placeholder="Tìm emoji..."
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      </div>
      <div className="chat-emoji-picker-categories" role="group" aria-label="Loại emoji">
        {chatEmojiGroups.map(group => (
          <button
            key={group.id}
            type="button"
            className={category === group.id && !search ? 'selected' : ''}
            aria-label={group.name}
            aria-pressed={category === group.id && !search}
            title={group.name}
            onClick={() => { setCategory(group.id); setSearch('') }}
          >{group.icon}</button>
        ))}
      </div>
      <div className="chat-emoji-picker-heading">
        {search ? 'Kết quả tìm kiếm' : chatEmojiGroups.find(group => group.id === category)?.name}
      </div>
      <div className="chat-emoji-picker-grid" role="group" aria-label="Chọn emoji">
        {emojis.length > 0 ? emojis.map(({ emoji, label: emojiLabel }) => (
          <button
            key={emoji}
            type="button"
            className={selectedEmoji === emoji ? 'selected' : ''}
            aria-label={emojiLabel}
            aria-pressed={selectedEmoji === emoji}
            title={emojiLabel}
            onClick={() => onSelect(emoji)}
          >{emoji}</button>
        )) : <p className="chat-emoji-picker-empty">Không tìm thấy emoji phù hợp.</p>}
      </div>
    </div>
  )
}
