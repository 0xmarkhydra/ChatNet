import { useUiTranslation } from '@/shared/i18n/locale'
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
  const trUi = useUiTranslation()

  if (!category && !muted) return null

  return <span className="conversation-rail-status">
    {category && <CategoryBadge category={category} iconOnly plain />}
    {muted && <span className="conversation-rail-notification-state is-muted"
      title={trUi("chat.muted")} role="img" aria-label={trUi("chat.muted")}>
      <BellOff size={13} aria-hidden="true" />
    </span>}
  </span>
}
