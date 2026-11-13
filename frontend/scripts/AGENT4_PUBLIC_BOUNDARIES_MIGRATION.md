# Agent 4 — Public boundary migration (2026-11-13)

Source: refreshed `origin/main` at `d87f383`. This document is guidance only: Agent 4 did not change feature business components, hooks, or API implementations.

## Verified baseline and current scan

- Recorded baseline: **106** violations = **101 feature-entrypoint** + **5 dependency-cycle**.
- Initial source scan: **111** violations in **379** files, including five new test-only deep imports.
- Follow-up remediation: all five test imports now use the existing type-only public barrels, with `Session` exposed from the shared type contract through `features/auth/index.ts`. The architecture gate **PASSES** with **106 existing / 106 baseline**; no baseline expansion, gate exemption, or runtime behavior change was needed.
- Keep the baseline intact while violations remain; remove an entry only after `--report` proves the corresponding dependency is gone. The new `frontend/tests/architecture-baseline.test.ts` guards against stale baseline entries.

## Public entrypoints prepared by Agent 4

New type-only barrels are available for `auth` (`ManagedAccountSession`), `feed` (`Post`, `Story`), `profile` (`ProfileMediaState`, `ProfileUpdateResponse`, `UserPrivacy`) and `contacts` (`FriendSearchResult`, `FriendConnection`). These do not migrate their consumers or expose feature-private runtime APIs. Consumer owners must review each import and preserve test mocks and runtime behavior.

## Consumer migration assignments

| Owner | Consumer | Existing deep dependency | Migration required |
|---|---|---|---|
| Agent 4 (resolved) | `features/discover/hooks/useNearbyDiscovery.test.tsx` | `features/auth/lib/session.ts` | Uses `import type { Session } from '../../auth'` |
| Agent 4 (resolved) | `features/profile/components/VisitorProfile.test.tsx` | `features/feed/types.ts` | Uses public Feed `Post` type |
| Agent 4 (resolved) | `features/profile/hooks/useInviteSharing.test.tsx` | `features/auth/lib/session.ts` | Uses public Auth `Session` type |
| Agent 4 (resolved) | `features/settings/hooks/usePrivacySettings.test.tsx` | `features/auth/lib/session.ts` | Uses public Auth `Session` type |
| Agent 4 (resolved) | `features/settings/hooks/usePrivacySettings.test.tsx` | `features/profile/types.ts` | Uses public Profile `UserPrivacy` type |
| Agent 2 | `features/chat/components/ChatSection.tsx` and its five component cycles | ChatSection ↔ ConversationHeader, ConversationList, MessageComposer, MessageTimeline, PinnedItemsPanel | Remove reverse runtime references at source; exporting these through an index does not resolve cycles |
| Agent 1 | app/platform consumers | Any imports through new public barrels | Verify session isolation and absence of runtime side effects; prefer `import type` for type-only symbols |

Before adding exports, inspect the concrete symbol consumers and dependency graph. Prefer narrowly named type-only exports over wildcard exports. Never re-export another feature's API service or runtime internals through a public entrypoint. Avoid migrating feature business code in this branch.

## Verification checklist

From the worktree's `frontend/` directory run `npm run check:architecture`, `npm run lint`, `npm run build`, and `npm run test:unit`. Use `node scripts/architecture-boundaries-check.mjs --report` to inspect the exact remaining edges. Keep failed and not-run checks distinct. Manual two-device QA remains owned by feature agents and integration reviewer.
