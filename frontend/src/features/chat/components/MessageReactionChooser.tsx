import ChatEmojiPicker from './ChatEmojiPicker'
import type { MessageActionsProps } from '../types/messageActions'

/** The quick strip already contains the preset reactions. More opens only the catalog. */
export default function MessageReactionChooser({
  activeMessageAction, toggleReaction, setMessageActionId,
}: Pick<MessageActionsProps, 'activeMessageAction' | 'toggleReaction' | 'setMessageActionId'>) {
  const selectedEmoji = activeMessageAction.reactions?.find(reaction => reaction.mine)?.emoji
  return <ChatEmojiPicker label="Chọn emoji để thả cảm xúc" selectedEmoji={selectedEmoji}
    onSelect={emoji => { setMessageActionId(null); void toggleReaction(activeMessageAction, emoji) }} />
}
