// A backgrounded browser/PWA must not automatically mark incoming chat as seen.
export function canMarkConversationRead(
  activeConversationId: number | null,
  incomingConversationId: number,
  currentTab: string,
  visibility: string,
): boolean {
  return activeConversationId !== null &&
    activeConversationId === incomingConversationId &&
    currentTab === 'chat' &&
    visibility === 'visible'
}
