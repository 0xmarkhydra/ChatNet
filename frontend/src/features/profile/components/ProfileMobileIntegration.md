# Mobile profile integration handoff

The full mobile profile uses the existing own-profile route and existing data/handlers. Do not add another friends endpoint, fetch, or mock data.

## Integration

The existing AuthedApp caller now supplies friends, onViewFriend, onCreateMediaPost, onCheckIn and storyBusy. Only the isolated feature worktree was edited; the primary checkout's parallel navigation edits were not overwritten. The preview uses the existing contacts state, with no duplicate requests.

## Visual QA

Check 320px and 390px, long Vietnamese display names, 60-character note, failed cover, empty friends, three composer shortcuts, pending post, loading/error/empty highlights, privacy form, and desktop/visitor regression. No API/schema or handwritten CSS changes.