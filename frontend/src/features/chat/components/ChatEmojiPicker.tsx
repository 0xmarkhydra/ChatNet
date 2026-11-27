import { useUiTranslation } from '@/shared/i18n/locale'
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
  const trUi = useUiTranslation()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(chatEmojiGroups[0].id)
  const emojis = searchChatEmojis(search, category)

  return (
    <div className="chat-emoji-picker" role="group" aria-label={label}>
      <div className="chat-emoji-picker-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          aria-label={trUi("chat.emojiSearch")}
          placeholder={trUi("chat.emojiPlaceholder")}
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      </div>
      <div className="chat-emoji-picker-categories" role="group" aria-label={trUi("chat.emojiCategory")}>
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
        {search ? trUi("common.searchResults") : chatEmojiGroups.find(group => group.id === category)?.name}
      </div>
      <div className="chat-emoji-picker-grid" role="group" aria-label={trUi("chat.selectEmoji")}>
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
        )) : <p className="chat-emoji-picker-empty">{trUi("chat.noEmoji")}</p>}
      </div>
    </div>
  )
}
