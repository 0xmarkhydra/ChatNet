# Agent 4 — Public boundary migration (2026-11-13)

## Audit sources and status

- Original audit: `origin/main` at `d87f383`, baseline 106 (101 feature-entrypoint + 5 dependency-cycle).
- Refreshed and rebased on `origin/main` at `644d4e0` (Agent 2 PR #111 merged).
- All five old ChatSection dependency cycles disappeared in the latest source scan. Removed **only those five** entries from `architecture-baseline.json`, now 101.
- Follow-up consumer migration (explicitly authorized by project owner): all four new type-only imports in `ChatSectionProps.ts` now point to public entrypoints. Current scan: **101 existing / 101 baseline**, architecture gate **PASS**. No baseline exemption was added.
- Architecture baseline integrity unit test is a separate guard ensuring the baseline does not retain already-remediated violations.

## Public type-only entrypoints

- `features/auth/index.ts`: `Session` (from shared session contract) and `ManagedAccountSession`.
- `features/contacts/index.ts`: `FriendSearchResult` and `FriendConnection`.
- `features/i18n/index.ts`: stable `UI_MESSAGES` value plus `UIMessageKey`, `UIBundle`, and `LanguageOption` types.
- `features/feed/index.ts`: `Post`, `Story`.
- `features/profile/index.ts`: `ProfileMediaState`, `ProfileUpdateResponse`, `UserPrivacy`.

All other exports above are `export type`; `UI_MESSAGES` is an intentional public, constant runtime contract. No wildcard barrel is introduced.

## Completed ChatSectionProps migration (owner-approved scope exception)

The four imports introduced by Agent 2's contract extraction were migrated directly after the project owner explicitly authorized editing this consumer.

| Previous type-only import | New public entrypoint |
| --- | --- |
| `../../auth/lib/session` | `../../auth` (`Session`) |
| `../../contacts/types` | `../../contacts` (`FriendSearchResult`, `FriendConnection`) |
| `../../i18n/lib/i18n` | `../../i18n` (`UI_MESSAGES` is now publicly re-exported; preserve existing `import type` syntax and `typeof UI_MESSAGES` annotation) |
| `../../i18n/utils/languages` | `../../i18n` (`LanguageOption`) |

**Important:** `ChatSectionProps.ts` currently uses `import type { UI_MESSAGES }` and `typeof UI_MESSAGES`. Keep this exact type-query semantics; `UI_MESSAGES` is now publicly re-exported from `../../i18n`. Verify `tsc --noEmit` and all chat tests after the consumer migration.

## Completed test-only consumer fixes

The five previously new deep imports in Discover, VisitorProfile, InviteSharing and PrivacySettings tests were replaced with corresponding public types. This reduced the 111 violations at the previous audit to 106 before Agent 2's main merge.

## Branch audit (read-only)

- Agent 2 `origin/refactor/agent02-chat-architecture-round2-20261113`: merged into main in PR #111; five dependency cycles resolved, four deep imports introduced in extracted props.
- Agent 3 `origin/refactor/agent03-feature-lifecycle-20261113`: includes auth session-request, calls lifecycle/device/interpreter, and feed infinite-scroll fixes with feature-local tests. Scope appears limited to owning features based on the current diff. No merge performed.
- Agent 1 app/platform follow-up: PR #110 merged; no changes were made to its files by Agent 4.

## Verification policy

From `frontend/`: `npm run check:architecture`, `npm run lint`, `npm run build`, `npm run test:unit`; separately execute `node --test scripts/architecture-boundaries-selfcheck.mjs` and inspect `node scripts/architecture-boundaries-check.mjs --report`. Report PASS, FAIL, NOT RUN individually. Do not merge while `check:architecture` fails. Manual two-device QA remains owned by feature agents / integration reviewer.
