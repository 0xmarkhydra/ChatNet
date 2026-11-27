import ConversationAvatarRail, { type ConversationRailProps } from './ConversationAvatarRail'
import '../styles/desktop-conversation-rail.css'

export default function DesktopConversationRail(props: ConversationRailProps) {
  return <ConversationAvatarRail {...props} desktop />
}