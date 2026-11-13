# Agent 4 — Public boundary migration (2026-11-13)

Source: refreshed `origin/main` at `d87f383`. This document is guidance only: Agent 4 did not change feature business components, hooks, or API implementations.

## Verified baseline and current scan

- Recorded baseline: **106** violations = **101 feature-entrypoint** + **5 dependency-cycle**.
- Current source scan: **111** violations in **379** files. The five additions are deep feature imports in test files, not a reason to expand the legacy baseline.
- Architecture gate currently **FAILS**. Preserve this failure until each consumer is migrated or the owner explicitly approves the architectural exception.
- Keep the baseline intact while violations remain; remove an entry only after `--report` proves the corresponding dependency is gone. The new `frontend/tests/architecture-baseline.test.ts` guards against stale baseline entries.

## Public entrypoints prepared by Agent 4

New type-only barrels are available for `auth` (`ManagedAccountSession`), `feed` (`Post`, `Story`), `profile` (`ProfileMediaState`, `ProfileUpdateResponse`, `UserPrivacy`) and `contacts` (`FriendSearchResult`, `FriendConnection`). These do not migrate their consumers or expose feature-private runtime APIs. Consumer owners must review each import and preserve test mocks and runtime behavior.

## Consumer migration assignments

| Owner | Consumer | Existing deep dependency | Migration required |
|---|---|---|---|
| Agent 3 | `features/discover/hooks/useNearbyDiscovery.test.tsx` | `features/auth/lib/session.ts` | Import stable public session types/contracts through `features/auth/index.ts` if appropriate; do not expose mutable session internals solely to satisfy the checker |
| Agent 3 | `features/profile/components/VisitorProfile.test.tsx` | `features/feed/types.ts` | Publish only stable feed DTO/types in `features/feed/index.ts`; update test import |
| Agent 3 | `features/profile/hooks/useInviteSharing.test.tsx` | `features/auth/lib/session.ts` | Prefer public auth type/contract; keep mocking at the actual dependency boundary if necessary |
| Agent 3 | `features/settings/hooks/usePrivacySettings.test.tsx` | `features/auth/lib/session.ts` | Replace deep import with stable auth public entrypoint, or keep test-local mocking without feature-internal import |
| Agent 3 | `features/settings/hooks/usePrivacySettings.test.tsx` | `features/profile/types.ts` | Publish stable profile types through `features/profile/index.ts` and migrate type-only import |
| Agent 2 | `features/chat/components/ChatSection.tsx` and its five component cycles | ChatSection ↔ ConversationHeader, ConversationList, MessageComposer, MessageTimeline, PinnedItemsPanel | Remove reverse runtime references at source; exporting these through an index does not resolve cycles |
| Agent 1 | app/platform consumers | Any imports through new public barrels | Verify session isolation and absence of runtime side effects; prefer `import type` for type-only symbols |

Before adding exports, inspect the concrete symbol consumers and dependency graph. Prefer narrowly named type-only exports over wildcard exports. Never re-export another feature's API service or runtime internals through a public entrypoint. Avoid migrating feature business code in this branch.

## Verification checklist

From the worktree's `frontend/` directory run `npm run check:architecture`, `npm run lint`, `npm run build`, and `npm run test:unit`. Use `node scripts/architecture-boundaries-check.mjs --report` to inspect the exact remaining edges. Keep failed and not-run checks distinct. Manual two-device QA remains owned by feature agents and integration reviewer.
