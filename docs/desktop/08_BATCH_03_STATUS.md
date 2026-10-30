# SOCO Desktop — B03 media/capture implementation evidence (31/10/2026)

Branch: `feat/chatnet-desktop-electron` · Worktree: `.worktrees/chatnet-desktop-electron`
Base: `18c72f3` (B02 native auth/window integration). This report accompanies the B03 commit; obtain its SHA with `git log -1 --format=%H -- docs/desktop/08_BATCH_03_STATUS.md`.

## Scope and status

| Task | Status | Implemented / outstanding |
|---|---|---|
| DSK-004 | BLOCKED | Real LiveKit on two devices and packaged Windows/macOS has not been performed. No call success is inferred from build or fixtures. |
| DSK-014 | IN_PROGRESS | Reuses existing LiveKit/E2EE call flows. Desktop mic/camera selection is connected to LiveKit device switching; explicit media grant before enabling capture; restored calls do not silently republish mic/camera. Added cancellation and single-flight guards to key synchronization. Actual device switching, 1:1/group media and sleep/wake call acceptance NOT RUN. |
| DSK-015 | BLOCKED — live acceptance | Existing backend Gemini/consent/transcript implementation retained, static/crypto regression PASS. No provider key or privileged provider logic added to client. Real 2–5 speaker translation and consent-revocation media tests NOT RUN. |
| DSK-018 | IN_REVIEW | Main-only permission broker, native consent dialog, OS access status, per-session grants and fail-closed unknown/denied/restricted states; exact trusted IPC; macOS usage descriptions. Actual unauthenticated packaged IPC denial tested, positive device prompts/capture NOT RUN. |
| DSK-019 | IN_REVIEW | Main-only source enumeration, bounded explicit picker, video-only selection, gesture/foreground/main-frame/session checks, cancellation/expiry/navigation/logout protection. Actual screen media transmission NOT RUN. No system audio claim. |
| DSK-020 | BLOCKED | Requires real accounts/devices, signed Mac notification testing and Windows QA. |

No task newly marked DONE. Permission and capture foundations are independent work while the DSK-004 hardware gate remains blocked; no full call parity or release signoff is asserted.

## Tests executed on connected macOS arm64

| Check | Result | Evidence meaning |
|---|---|---|
| Frontend and Desktop `npm ci` | PASS | Clean lockfile installation; both audits reported 0 vulnerabilities. npm warned about deprecated transitive build packages and install-script allow-list coverage; no bypass was applied. |
| Frontend `npm run build` | PASS | TypeScript/Vite 7.3.7 Web build. Existing chunk-size warnings remain. |
| Frontend `check:session`, `check:desktop-session`, `check:chat`, `check:outbox` | PASS | Unit/native-contract regressions, not real account delivery. |
| Frontend `check:offline-browser` | PASS — fixture | Existing routed browser fixtures prove queue UI/restart/lost-ACK behavior, not live backend delivery. |
| Frontend `check:call-live` | PASS — static | Provider secret/consent boundary source checks; not a real LiveKit call. |
| Frontend `check:call-translation` | PASS — unit | Transcript normalization/authentication/encryption, not live Gemini audio. |
| Desktop `npm test` | PASS — 49/49 | Existing 32 tests plus 9 permission and 8 screen-capture policy tests. Injected OS/transport fixtures are not device UAT. |
| Backend `go test -count=1 ./...` | PASS | Uncached package suite; infrastructure-dependent acceptance additionally exercised below. |
| `node desktop/scripts/backend-integration.cjs` | PASS | Real disposable loopback PostgreSQL 16/Redis 7; email auth, sessions/revoke, message idempotency, block/privacy/group/feed and translation authorization tests. Output had no skipped tests. Containers cleaned up. |
| `CSC_IDENTITY_AUTO_DISCOVERY=false npm --prefix desktop run build` | PASS | Electron 45.1.0 unsigned unpacked macOS arm64 application, publish disabled. |
| `node frontend/scripts/desktop-shell-smoke.mjs` | PASS | Real packaged app with fresh QA profile: sandbox/auth HTTP denial, unauthenticated media IPC denial without activating devices, actual OS encrypted vault, tray/minimize/restore, restart/bounds/storage, Mac privacy plist descriptions. |
| Screen-picker error/cancel UI within packaged app | PASS — UI fixture | A synthetic expired picker event renders error then closes on Cancel. No real screen or window was captured. |
| Windows/Intel native tests; actual mic/camera/screen; LiveKit/Gemini two-device calls | NOT RUN | No physical Windows/Intel endpoint or two-account media setup supplied to this run. |
| Signing/notarization, auto-update/rollback, installer UAT | BLOCKED / NOT RUN | No approved signing credentials or update release channel available. |

Red→green evidence: permission test initially failed because `unknown` OS status was accepted (40 PASS / 1 FAIL). Fixed to require confirmed `granted`; final 49/49 PASS. Added rejection of stale/foreign/superseded screen requests and explicit cancel recovery.

Local gitignored artifacts: `frontend/output/desktop-smoke/evidence.json`, `login-desktop.png`, `backend-integration.log`. The synthetic profile is deleted after smoke. Launch-to-login sample on the second launch was 490 ms; process memory samples are in evidence.json, not a cold-start/SLA/leak benchmark.

## Review and remaining risks

- Existing shared React and all backend contracts preserved; Marketplace/payment rules unchanged. No new runtime dependency.
- Mic/camera and screen grants never imply consent for AI translation. Screen selection grants only exact video source, not system audio. No OS source IDs or Node objects exposed to renderer.
- Permission denial/unknown status is fail-closed. Grants reset after auth expiry, renderer crash, navigation and window close. Logout/account switches invalidate pending requests.
- Native call device UI still needs physical device/unplug/reconnect and accessibility UAT. Long-call CPU/RAM/leak measurements NOT RUN.
- Prior B02 open issues remain: unsigned installer/default app icon, SSE token-in-query review, broad CSP media/connect allowlists, cache purge policy and B01 profile queue migration/attachment-draft persistence. Do not upgrade a B01 test profile with unsent content and claim data-loss acceptance.
- No merge to dev/main, no production deploy, no release publication.

Next independent work: DSK-016/017 native notifications/badge/click authorization and packaging/security CI. Preserve all BLOCKED media and signed-release gates until real evidence exists.
