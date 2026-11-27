import { useState } from 'react'

/** Closing suggestions must not change the draft, or reopen the same query. */
export function useQuickReplyVisibility(scope: string, draft: string) {
  const [state, setState] = useState({ scope, draft, managing: false, dismissed: false })
  const sameScope = state.scope === scope
  const sameDraft = state.draft === draft
  const managing = sameScope && state.managing
  const dismissed = sameScope && sameDraft && state.dismissed
  // Reset dismissal when the draft changes, and reset management on conversation switches.
  if (!sameScope || !sameDraft) {
    setState({ scope, draft, managing, dismissed: false })
  }
  const query = !dismissed && /^\/[a-z0-9_-]*$/i.test(draft) ? draft.slice(1) : null
  return {
    managing,
    query,
    open: () => setState({ scope, draft, managing: true, dismissed: false }),
    close: () => setState({ scope, draft, managing: false, dismissed: true }),
  }
}
