# SOCO Desktop — B02 implementation / evidence (30/10/2026)

Branch: `feat/chatnet-desktop-electron` · Worktree: `.worktrees/chatnet-desktop-electron`
Base: `a0106f6998507e6b3b6e4c9d907817674a4dc4bd`.
This report accompanies the B02 commit; identify its exact SHA with `git log -1 --format=%H -- docs/desktop/07_BATCH_02_STATUS.md`.

## Implemented, not automatically DONE

| Task | Current status | Code and outstanding acceptance |
|---|---|---|
| DSK-007 | IN_REVIEW | OS safeStorage encrypted vault, atomic writes, strict schema, no plaintext fallback. Real macOS vault encrypt/read/delete PASS with a synthetic credential. Windows vault and real-account lifecycle not yet UAT. |
| DSK-008 | IN_REVIEW | Main-only email verification, restore/refresh/logout/device administration; strict IPC/preload; renderer access JWT only in memory; generation/scope guards. Real OTP login and remote revoke from Web on the packaged app NOT RUN. |
| DSK-009 | IN_PROGRESS | Existing React chat/group/read/reaction/media/business logic reused. Desktop file drop uses the existing authorized upload pipeline; no copied chat UI/API. Real Desktop↔Web messages/files NOT RUN. |
| DSK-010 | IN_PROGRESS | Stable native session scope restores existing durable outbox; desktop text drafts survive process restarts; corrupt JSON item no longer hides other queued messages. Fixture offline/reopen/lost-ACK regression PASS; genuine two-device/network-fault acceptance NOT RUN. |
| DSK-011 | IN_REVIEW | Single-instance lifecycle, native frame, tray menu, explicit close-to-tray choice, restore/minimize/quit, visible clamped bounds and monitor-change recovery. Packaged macOS tray/hide/restore/process restart PASS; Windows native smoke NOT RUN locally. |
| DSK-012 | IN_PROGRESS | Ctrl/Cmd+K chat search, Ctrl/Cmd+Shift+L composer, focus after send, safe File drag/drop, desktop bootstrap error/retry. Authenticated UI/keyboard/accessibility cross-OS UAT remains. |
| DSK-013 | IN_PROGRESS | Automated suites below passed. No declaration of live desktop auth/chat parity. |

## Verification executed on macOS arm64

| Command / scenario | Result | Meaning |
|---|---|---|
| `npm --prefix frontend ci` | PASS | Lockfile installation; initially identified a Vite advisory. |
| `npm --prefix desktop ci` | PASS | Lockfile installation; initially identified Electron/extract-zip advisories. |
| `npm --prefix frontend run build` | PASS | Shared Web TypeScript/Vite build; bundle-size warnings remain. |
| `npm --prefix frontend run check:session` | PASS | Existing Web auth/refresh/revoke unit suite. |
| `npm --prefix frontend run check:desktop-session` | PASS | Injected native-auth contract, single-flight/stale response handling, draft restart and outbox corruption/isolation unit tests. |
| `npm --prefix frontend run check:chat` | PASS | Persistence/read/account isolation tests. |
| `npm --prefix frontend run check:outbox` | PASS | Client IDs, durable delta queue and lost-ACK logic tests. |
| `npm --prefix frontend run check:offline-browser` | PASS — fixture | Browser UI offline/reopen/ordered sends/lost ACK. Existing routed API fixtures are **not** a real backend/chat delivery test. |
| `npm --prefix frontend run check:call-live` | PASS — static | Source/secret/consent boundary check, **not** an actual call. |
| `npm --prefix frontend run check:call-translation` | PASS — unit | Transcript normalization/encryption/authentication, not provider audio UAT. |
| `go -C backend test -count=1 ./...` | PASS | Uncached Go package tests; DB-dependent tests require the separate run below. |
| `node desktop/scripts/backend-integration.cjs` | PASS | All Go package tests with fresh loopback-only PostgreSQL 16/Redis 7 containers. Includes EmailAuth, Session, SessionManagement, MessageIdempotency, block/privacy/group/feed integration tests; no skipped tests in this run. Containers stopped/removed. |
| `npm --prefix desktop test` | PASS — 32/32 | Vault/broker/IPC/URL/path/window policy tests. Crypto/HTTP unit fixtures are explicitly labelled. |
| `CSC_IDENTITY_AUTO_DISCOVERY=false npm --prefix desktop run build` | PASS | Electron 45.1.0 macOS arm64 unpacked unsigned internal application. No publishing. |
| `node frontend/scripts/desktop-shell-smoke.mjs` | PASS — native | Actual packaged app; secure preferences; narrow bridge; renderer auth HTTP blocked; unsafe URL/popup denial; actual OS vault encrypt/read/delete; tray close/reopen, minimize/restore, process restart preserving bounds and persistent origin storage. Separate fresh QA profile only. |

Evidence files generated locally (gitignored): `frontend/output/desktop-smoke/evidence.json`, `login-desktop.png`, `backend-integration.log`.
The native vault test uses a synthetic credential and no Auth API login. No customer credentials or profile were read by the test.
One smoke measurement: second launch→login UI 320 ms; sampled process working sets Browser 167008 KB, GPU 127584 KB, Utility 44784 KB, renderer 129328 KB. This is **not** a cold-start benchmark, steady-state SLA or memory-leak test.

## Dependency security remediation

- Initial audit: frontend 1 high (Vite 7.3.6); desktop 2 high (Electron 39.8.10 and extract-zip).
- Upgraded/pinned Vite **7.3.7** and Electron **45.1.0** with regenerated lockfiles, no `audit fix --force` and no suppressed advisories. Install audits then reported **0 vulnerabilities** in both dependency trees.
- Electron 45.1.0 is the official stable release dated 27/10/2026: https://releases.electronjs.org/release/v45.1.0
- Reviewed breaking changes: https://www.electronjs.org/docs/latest/breaking-changes . Our sandboxed preload only requires `electron`, not removed Node shims. Electron 44+ requires **macOS 13+**; x64 Windows and arm64/x64 macOS remain the requested targets, with physical compatibility testing still required.
- macOS native notifications require signing in newer Electron. Unsigned smoke does not prove notifications work; signing/UAT remains a release blocker.

## Data and security limits still open

1. Desktop never loads the old B01 `chatnet-session` plaintext credential. It removes that key and requires a new native login. Old B01 queue scope is not automatically migrated into a new login; no queue migration/data-loss acceptance is claimed. Do not upgrade an active B01 test profile with pending content without explicit migration review.
2. Existing outbox remains bounded localStorage (60 messages) with stable client IDs and safe attachment metadata. Desktop text drafts persist; unsent attachment/reply drafts are not fully persisted. An IndexedDB/attachment-draft migration has not been implemented or claimed.
3. Renderer HTTP/media cache purge, SSE query JWT exposure, exact CSP connect/media host allowlists and full threat-model review remain security release gates; no full security-audit PASS is claimed.
4. No real account login/revoke, Desktop↔Web file/message delivery, two-device LiveKit/Gemini audio, mic/camera user prompts, Windows OS tray/installer, signed update/rollback or 30-minute call/CPU/RAM test has been run here.
5. Large shared chunks and default installer/application icon remain. Tray reuses a small raster of the existing SOCO mark; no new product brand or Marketplace/payment behavior is introduced.

## Next / integration decision

Continue independent native permission/notification and packaging/CI tasks, while keeping real LiveKit, signed artifacts and two-OS UAT BLOCKED until their prerequisites exist. No merge into `dev`/`main`, no production deployment, no public unsigned installer, and no desktop task newly labelled DONE.
