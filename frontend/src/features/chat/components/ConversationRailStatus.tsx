import { BellOff } from 'lucide-react'
import { CategoryBadge } from './ConversationCategories'
import type { ConversationCategory } from '../hooks/useConversationCategories'
import '../styles/conversation-rail-status.css'

/** Passive category and notification indicators shared by both avatar rails. */
export default function ConversationRailStatus({
  category, muted,
}: {
  category?: ConversationCategory
  muted?: boolean
}) {
  if (!category && !muted) return null

  return <span className="conversation-rail-status">
    {category && <CategoryBadge category={category} iconOnly plain />}
    {muted && <span className="conversation-rail-notification-state is-muted"
      title="Đã tắt thông báo" role="img" aria-label="Đã tắt thông báo">
      <BellOff size={13} aria-hidden="true" />
    </span>}
  </span>
}
