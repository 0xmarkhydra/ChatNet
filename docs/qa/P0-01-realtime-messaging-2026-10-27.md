# P0-01 — Realtime messaging A/B/C, multi-tab, multi-device

Date: 2026-10-27 (Asia/Bangkok). Branch at inspection: `codelocal/task/57b1b34baddb`.

## Scope and result

**Overall status: BLOCKED — end-to-end signoff NOT achieved.** Automated logic checks passed, but these are not substitutes for real A/B/C sessions, browsers or devices.

| Scenario | Status | Evidence / blocker |
| --- | --- | --- |
| A → B direct message; B → A reply, realtime delivery | NOT RUN | No authenticated A/B test sessions or available browser automation; no real backend exchange observed |
| A/B/C group messaging, ordering and deduplication | NOT RUN | No authenticated A/B/C sessions or running multi-user environment verified |
| Same user across two tabs, active/background/unread sync | NOT RUN | Browser integration not available; only isolated logic tests below |
| Cross-device Web ↔ Android/iOS | BLOCKED | `adb devices -l`: no connected Android device; iOS/Safari not controlled |
| Chrome real browser | BLOCKED | CodeLocal browser status: `available=false, enabled=false, prepared=false` |
| Safari real browser | BLOCKED | No Safari browser-control session available |
| PWA installed-mode realtime | BLOCKED | No installed PWA/browser session available |
| Network drop, reconnect, replay, lost ACK | PARTIAL PASS | Isolated frontend chat/session checks passed; no real network disconnect test |
| Account isolation + logout | PARTIAL PASS | Isolated frontend chat persistence check passed; no real A/B/C authorization probe |

## Commands and actual output

```sh
cd frontend && npm run check:chat && npm run check:session && npm run check:optimistic && npm run check:pwa
```
Exit code: **0**.

```text
PASS: chat drafts, lost-ACK recovery, account isolation, read visibility, expiry, denied storage and logout
Session checks passed: refresh, concurrency, legacy revocation safety, offline, expiry, stale responses, bounded retry.
Optimistic checks passed: toggle, rollback, zero count, immutable input, duplicate receipts.
PASS: PWA update consent, offline fallback and private cache isolation
```

```sh
cd backend && go test ./cmd/chat ./internal/authx
```
Exit code: **0**.

```text
ok  chatnet/cmd/chat       1.175s
ok  chatnet/internal/authx 0.670s
```

```sh
adb devices -l
```

```text
List of devices attached
```

CodeLocal browser status: `available=false`, `enabled=false`, `prepared=false`.

## Manual / live test protocol (pending)

Use three dedicated test accounts A, B, C on a safe test environment. Do not log access tokens or message secrets. Record timestamp (UTC), browser/device version, sender, receiver, conversation ID (or anonymized test ID), server message ID, client message UUID, delivery/read transition, and latency.

1. A sends sequence A1-A10 to B in Chrome. B receives in Safari without refresh. B replies B1-B10; check ordering, duplicate IDs, missing messages, unread and read receipts.
2. A and B join group with C; send A/B/C concurrently; confirm identical message ordering and no cross-conversation leaks.
3. Open two Chrome tabs for A and a PWA session; send on one and check update, unread visibility and read receipts on all sessions. Repeat with foreground/background tabs and reload.
4. Run B on a separate Android/iOS device; background/resume, reconnect and resend after network drop. Verify exactly-once visible rendering and idempotency after lost acknowledgements.
5. Sign out A on one device, sign into C on that device; verify no A drafts, notifications, cached history or connection events appear for C.
6. Repeat on Safari and installed PWA; collect browser console logs, network/SSE/WebSocket trace, and server chat logs without personal data. Attach screenshots/video when needed.

## Signoff conditions

P0-01 may be marked PASS only after actual A/B/C Chrome, Safari, PWA and multi-device test evidence exists, with zero missing/duplicated/out-of-order messages, no cross-account leaks, correct read/unread state and reproducible reconnect behavior. Do not mark PASS from mocks/unit tests alone.
