// Desktop windows may be visible behind another app; focus is required there.
// Browser/PWA callers retain their existing visibility-based policy by default.
export function canMarkConversationRead(
  activeConversationId: number | null,
  incomingConversationId: number,
  currentTab: string,
  visibility: string,
  focused = true,
): boolean {
  return activeConversationId !== null &&
    activeConversationId === incomingConversationId &&
    currentTab === 'chat' &&
    visibility === 'visible' && focused
}
