# Agent 4 — Public feature boundaries migration

Base: `origin/main` at `80b91bd` (2026-11-13). This change publishes **type-only** contracts; no consumer imports are rewritten by Agent 4.

## Consumer changes (Agents 1–3 / integrator)

Replace imports of *types* from another feature's internal `types.ts` with its public entrypoint:

| Consumer | Existing internal path | Public path | Published contracts |
| --- | --- | --- | --- |
| Calls, Contacts, Feed, Notifications, Profile | `features/chat/types` | `features/chat` | `Message`, `Conversation`, `RealtimeEvent`, `GroupMember`, `MessageReaction`, `PinnedMessage`, `MessageDraft`, `NewChatMode` |
| Chat, Calls, Discover, Feed, Notifications, Profile | `features/contacts/types` | `features/contacts` | `FriendSearchResult`, `FriendConnection` |
| Feed, Settings | `features/profile/types` | `features/profile` | `ProfileMediaState`, `ProfileUpdateResponse`, `UserPrivacy` |
| Chat, Profile | `features/feed/types` | `features/feed` | `Post`, `Story` |
| Profile | `features/auth/types` | `features/auth` | `ManagedAccountSession` |
| Notifications | `features/pwa/types` | `features/pwa` | `InstallPromptEvent` |

Use `import type { ... } from '../<feature>'` with the correct relative path. Keep same-feature imports unchanged. Do **not** replace value imports with `import type`, or export all components/hooks from the public barrel: runtime exports need a separate dependency-cycle review. `chat/types.ts` also exports `emptyDraft` and pagination constants as values; these are intentionally **not** published yet.

### Other legacy consumers needing coordination

- Auth/Chat/Profile/Calls depend on internal i18n functions; Agent 3 should approve a stable public i18n contract before migration.
- Chat/Calls/Contacts/Feed/Profile depend on runtime components and utilities across features. Agents 1–3 should assess their ownership and dependency cycles before requesting selective value exports.
- Auth session utilities (`auth/lib/session.ts`) are runtime values; do not indiscriminately re-export them or risk circular imports, session leaks and startup side effects.
- Feature `api/` imports remain forbidden, even through ad-hoc aliases; use the owning feature's supported contracts, or coordinate with the API owner.

## Baseline discipline and quality gates

At base commit the architecture scan reports **106** legacy violations: **101** `feature-entrypoint`, **5** `dependency-cycle`. No baseline entries were removed merely because public exports exist; migration must first change each consumer and confirm that the graph no longer contains the corresponding violation. `npm run check:architecture` prevents *new* violations; run `node scripts/architecture-boundaries-check.mjs --report` after each consumer migration and prune only the confirmed missing entries. Never use `--write-baseline` to hide newly introduced violations.

When reviewing Agents 1–3, verify their branches after merging/rebasing against current `origin/main`, but leave merge decisions to the user. Run `npm run build`, `npm run lint`, `npm run test:unit`, `npm run check:architecture`, and `node --test scripts/architecture-boundaries-selfcheck.mjs` in the integration worktree; report any skipped/manual checks separately.
