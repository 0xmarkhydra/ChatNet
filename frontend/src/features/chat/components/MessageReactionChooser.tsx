import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import ChatEmojiPicker from './ChatEmojiPicker'
import { messageReactions } from '../utils/messageReactions'
import type { MessageActionsProps } from '../types/messageActions'

export default function MessageReactionChooser({
  activeMessageAction, toggleReaction, setMessageActionId,
}: Pick<MessageActionsProps, 'activeMessageAction' | 'toggleReaction' | 'setMessageActionId'>) {
  const [showAllEmojis, setShowAllEmojis] = useState(false)
  const selectedEmoji = activeMessageAction.reactions?.find(reaction => reaction.mine)?.emoji
  const selectReaction = (emoji: string) => {
    setMessageActionId(null)
    void toggleReaction(activeMessageAction, emoji)
  }
  return <>
        <div className="message-context-reactions" aria-label="Thả cảm xúc">
          {messageReactions.map(({ emoji, label }) => (
            <button
              key={emoji}
              type="button"
              className={(activeMessageAction.reactions || []).some((reaction) => reaction.emoji === emoji && reaction.mine) ? 'active' : ''}
              aria-pressed={(activeMessageAction.reactions || []).some((reaction) => reaction.emoji === emoji && reaction.mine)}
              aria-label={`${label} ${emoji}`}
              title={label}
              onClick={() => selectReaction(emoji)}
            >
              {emoji}
              <small>{label}</small>
            </button>
          ))}
          <button
            type="button"
            className="chat-reaction-more"
            aria-label="Thêm emoji khác"
            aria-expanded={showAllEmojis}
            title="Thêm emoji"
            onClick={() => setShowAllEmojis(open => !open)}
          >
            <SmilePlus size={25} aria-hidden="true" />
            <small>Thêm</small>
          </button>
        </div>
        {showAllEmojis && (
          <ChatEmojiPicker label="Chọn emoji để thả cảm xúc" selectedEmoji={selectedEmoji} onSelect={selectReaction} />
        )}

  </>
}
