# Agent 1 — App Shell final QA handoff (2026-11-16)

## Ownership and change

- Branch: `fix/app-agent1-final-qa-20261116`, based on `origin/main` `7434c85`.
- Owned scope: `frontend/src/app/`.
- Change: `useAppRealtime` now checks that the current session **object** is the one that created its SSE connection, not just that `sessionId` matches. This applies to SSE updates, revocation, related async continuations and timers. A replacement account that reuses a session ID must not receive events or callbacks from the old visit.
- Regression: `useAppRealtime.reconnect.test.tsx` simulates an account replacement sharing the same session ID and checks that old SSE update/revocation signals are ignored.
- No changes to SSE URLs/events, auth protocol, API payloads, chat send/retry semantics, E2EE or UI.

## Verified checks

| Check | Result | Evidence |
| --- | --- | --- |
| React lint ratchet | PASS | 81 React Hooks findings vs baseline 86; no new findings |
| Architecture boundaries | PASS | 506 checked files, 0 legacy and 0 baseline violations |
| Unit tests | PASS | 91 files, 301 tests |
| TypeScript + Vite production build | PASS | `npm run build` |
| SSE old-session regression | PASS | 4 tests including the newly added same-ID account switch |
| Session / Desktop session checks | PASS | `check:session`, `check:desktop-session` |
| Outbox / scoped state / cache checks | PASS | `check:outbox`, `check:scoped-state`, `check:cache` |
| Notification deep link check | PASS | `check:push-deeplink` |
| Offline browser (mocked API) | PASS | `check:offline-browser`: durable queue, serialized sends, resend, lost-ACK idempotency, reload recovery |
| Chat messaging-flow browser (mocked API) | FAIL | `check:chat-messaging-flow`: `.conversation-item` exists but stays hidden at test viewport; Playwright click timeout |
| Chat conversation-flow browser (mocked API) | FAIL | `check:chat-conversation-flow`: same hidden `.conversation-item` locator; waitFor visible timeout |
| Actual two-account / two-device manual QA | NOT RUN | No real accounts or interactive manual validation |
| Docker rebuild / deployment / CI status | NOT RUN | Not requested for this branch |

The two browser failures may be stale test assumptions after recent layout changes or an actual UI visibility regression. They are **not proven production Chat failures**. Do not mark them PASS without re-running after investigation.

## Required handoffs

1. **Chat UI owner / QA-script owner**: investigate which conversation list is currently visible at desktop width and update the mock browser test selectors/flows **or fix a verified UI regression**. Files: `frontend/scripts/chat-messaging-flow-check.mjs`, `frontend/scripts/chat-conversation-flow-check.mjs`, and if justified, the owning Chat feature components. Agent 1 did not modify these files.
2. **Integration Agent 7**: validate Back/Forward, direct chat link, changing conversation with unsent draft, offline outbox reconnect/lost ACK, SSE reconnect, expiry and login A→B→A on two real browser sessions; record PASS/FAIL/NOT RUN separately. Confirm no privacy leak, duplicate message, or call lifecycle loss.
3. **Frontend performance owner (non-blocking)**: Vite reports large chunks and mixed static/dynamic `ts-mls` imports; not caused by this change.

## Merge guidance

- Review only changes in `frontend/src/app/hooks/useAppRealtime.ts` and `useAppRealtime.reconnect.test.tsx` plus this handoff.
- Rebase/merge latest `origin/main`, re-run lint, architecture, tests and build before integration.
- **Do not self-merge.** The owner of Agent 7 / user decides whether the two browser QA failures block the integration PR.
