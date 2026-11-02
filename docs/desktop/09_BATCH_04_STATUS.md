# SOCO Desktop — B04 native notifications / badge / authorized navigation

Date: 31/10/2026 · Branch `feat/chatnet-desktop-electron` · Base `2330cc3`.
This report is committed with B04; resolve the precise SHA using `git log -1 --format=%H -- docs/desktop/09_BATCH_04_STATUS.md`.

## Implementation status

| Task | Status | Evidence / remaining acceptance |
|---|---|---|
| DSK-016 | IN_REVIEW | Native Electron message/call notification service, per-account opt-out, privacy-preserving generic text, bounded dedupe/throttle/lifetime, Dock/tray/Windows overlay badge adapter. Native OS positive delivery and badge visual UAT on signed Windows/Mac still NOT RUN. |
| DSK-017 | IN_REVIEW | Click carries only session/conversation/kind. Auth status and exact server-authorized metadata lookup precede opening. Logout, privacy invalidation and stale-account races reject late clicks. React contract fixtures PASS; actual second-account native click UAT NOT RUN. |
| DSK-009/010 | IN_PROGRESS acceptance | Read receipt now additionally requires Desktop window focus, not only visible page. Existing Web behavior unchanged. Queue regressions PASS; real Desktop↔Web/account restart tests remain NOT RUN. |
| DSK-021/022 | IN_PROGRESS acceptance | Shared Friends/Profile/Feed/Story/Marketplace implementations retained, backend real-DB privacy/block/feed/marketplace regression PASS. Full native UI parity/UAT NOT RUN. No Coin/VND/payment rule changes. |
| DSK-012 | IN_PROGRESS | Existing B02 layout/shortcuts retained; no new full visual/accessibility acceptance is inferred from a build. |

No new task is marked DONE. No merge to dev/main, release, production deployment or credential changes.

## Native behavior

- No sender names, message text, avatar URLs, refresh tokens or system paths are placed into the OS notification store. Preview is deliberately off for this implementation.
- Current focused chat, own sends, replayed/old events and disabled notifications are suppressed. Foreground notification is silent; existing renderer message sound is suppressed when viewing that Desktop chat. Native call notice is silent and retains existing ringtone as the only call sound.
- Call notifications are dismissed when the incoming call changes/ends. Closing a call notice does not remove message notices. App quit is not background push support.
- Native IPC checks exact sender/main frame, payload schema/limits and current main-process auth scope. Reset/clear invalidates old notification instances so a late click cannot reopen revoked content.
- Frontend revalidates access before opening and ignores in-flight results after account change or privacy/membership invalidation. The same current conversation is not cleared without triggering a new fetch.
- Badge is a server snapshot, never an increment from replayed SSE or a sum of only the first conversation page. Unknown/offline count clears the numeric badge and reports the sync problem.

## Additive backend contract / integration issue DSK-016-API

Approved within this scoped Integration Owner change because no authoritative total/exact lookup existed:

1. `GET /api/conversations/unread`: returns `{unreadCount}`, cached-session middleware, no-store response, parameterized query scoped to the authenticated user. Filters direct conversation blocks and blocked senders in groups identically to the existing list projection.
2. `GET /api/conversations?limit=1&id=<positive id>`: optional exact lookup using the existing membership/privacy query. Missing/unauthorized yields an empty list, not information about another user's conversation. Existing callers without `id` retain their behavior. No DB migration.

**Backend deployment is NOT performed by this branch.** Against an old server, missing unread support produces an explicit unavailable badge warning. An old server ignoring `id` cannot open the wrong chat: the client requires exactly one result with the requested ID. Roll out only via the approved backend integration/QA process.

## Verification on connected macOS arm64

| Command / check | Result |
|---|---|
| Frontend/Desktop `npm ci` | PASS earlier in this execution before B03; dependencies unchanged by B04, only test script metadata added. Audits then reported 0 vulnerabilities. |
| `npm --prefix desktop test` | PASS — 59/59, including 10 notification fixture/IPC tests. These are not OS banner delivery evidence. |
| `npm --prefix frontend run check:desktop-notifications` | PASS — actual React hook in isolated Chromium with explicit native/API fixtures: toggle, authoritative badge, missing backend, expired auth, denied membership, wrong session, privacy invalidation and delayed cross-account response. |
| Frontend `build` | PASS — TypeScript/Vite Web bundle; existing large chunks remain. |
| `check:session`, `check:desktop-session`, `check:chat`, `check:outbox` | PASS. Focus/hidden-window read tests included. |
| `check:call-live`, `check:call-translation`, `check:incoming-sound` | PASS — static/unit, not media acceptance. |
| `check:onesignal`, `check:pwa`, `check:offline-browser` | PASS — Web/PWA and browser-fixture regressions. |
| `node desktop/scripts/backend-integration.cjs` | PASS — all Go suites against disposable real PostgreSQL 16/Redis 7; new unread/exact-lookup integration checks passed, no skipped tests in output. |
| `CSC_IDENTITY_AUTO_DISCOVERY=false npm --prefix desktop run build` | PASS — unsigned internal macOS arm64 application; no publishing. |
| `node frontend/scripts/desktop-shell-smoke.mjs` | PASS — actual packaged negative notification IPC plus existing OS vault, sandbox, tray/window and restart checks. No fabricated OS message or authenticated business login. |
| Windows/Intel install, actual native banner/click from second account, LiveKit/Gemini audio, signed update/rollback | NOT RUN / BLOCKED pending machines, accounts, signing and approved release channel. |

Failures found and fixed: initial notification privacy-clear test accepted a stale click (57 PASS / 1 FAIL); active-instance invalidation fixed it. New DB fixture omitted mandatory display_name and was corrected without changing assertions. Existing OneSignal Node check crashed on absent `import.meta.env`; optional build-environment access now preserves Web tests and still excludes SDK from Desktop.

Evidence: gitignored `frontend/output/desktop-smoke/evidence.json`, `backend-integration.log`, login screenshot. Tests use fresh QA profiles/disposable databases only. A packaged launch sample and process memory samples are observations, not a cold-start SLA or long-run leak test.

## Remaining risks / next work

B02/B03 blockers still apply: B01 unsent-queue migration and attachment/reply draft persistence, renderer private cache purge, SSE query token review, broad media/connect CSP, signed installers, real media/device UAT and long-call resource testing. Native notification compatibility must be checked in signed binaries; unsigned macOS is not positive delivery evidence. Backend query load/index behavior needs production-scale measurement before release.

Next independent work is B05 packaging/CI/security gates. Keep signing, notarization, real updates/rollback and release candidate approval BLOCKED until actual prerequisites and evidence exist.
