# SOCO Desktop — native shell and shared React integration

Branch `feat/chatnet-desktop-electron`. **Not approved for beta, dev/main integration or production release.**
Read `docs/desktop/07_BATCH_02_STATUS.md` through `10_BATCH_05_STATUS.md` for actual tests, artifacts and remaining acceptance gates. B03/B04 implementation was pushed as `2330cc3` / `76b56f1`; the B05 report accompanies its packaging commit.

## Development

Development/build requires Node.js 24+ and Go for backend checks. End users of a packaged application do not install Node.js.
Electron is pinned to 45.1.0, macOS runtime minimum is 13.0.0. Physical Windows/Intel compatibility and signed installers remain release gates.

```bash
npm --prefix frontend ci
npm --prefix desktop ci
# Terminal 1: existing shared frontend, exact localhost origin
npm --prefix desktop run dev:web
# Terminal 2:
npm --prefix desktop run dev
```

Development uses `http://127.0.0.1:5173` and the existing API at `http://localhost:8080`.
Production renders packaged `app://soco` assets and uses `https://api-chat.codelocal.cloud`.
A mismatched frontend API configuration fails closed rather than sending credentials to another origin.

## Verification

```bash
npm --prefix frontend run check:session
npm --prefix frontend run check:desktop-session
npm --prefix frontend run check:desktop-notifications
npm --prefix desktop test
npm --prefix frontend run build
npm --prefix desktop run build
node frontend/scripts/desktop-shell-smoke.mjs
# Local integration: fresh loopback-only PostgreSQL/Redis Docker containers, no existing data touched.
node desktop/scripts/backend-integration.cjs
```

The shell smoke creates a new QA profile, tests OS encryption with a synthetic credential and removes only that profile afterward. It does not log in, deliver real messages, call LiveKit or use Gemini. Browser/native fixtures do not substitute for two-device UAT.

## Internal packaging vs distribution

Internal commands build unsigned test artifacts only; do not distribute them as a release:

```bash
# Mac host (internal-only environment variable syntax):
CSC_IDENTITY_AUTO_DISCOVERY=false npm --prefix desktop run dist:internal:mac
CSC_IDENTITY_AUTO_DISCOVERY=false npm --prefix desktop run dist:internal:win
npm --prefix desktop run manifest:internal
# On macOS arm64, verify/mount/copy/run an isolated app from the internal DMG:
node frontend/scripts/desktop-dmg-smoke.mjs
```

Artifacts are under `desktop/release/`: `SOCO-<version>-mac-arm64.dmg`, `SOCO-<version>-mac-x64.dmg`, matching ZIPs, and `SOCO-<version>-win-x64.exe`. The internal inventory records hashes and explicitly does not claim signatures or release approval. Builds on Mac do not prove Windows installation works.

`dist:mac` and `dist:win` require code signing (`forceCodeSigning=true`). Missing identities must fail the build. Every command has `--publish never`; there is no automatic release workflow. Successful signing alone would still not prove Apple notarization/stapling, clean install, update/rollback, UAT or release approval.

The installer icon derives from `frontend/public/soco-mark.svg`. To regenerate after an approved brand asset change, run `node frontend/scripts/desktop-icons.mjs` and review the new asset/provenance hashes.

## Implemented boundaries

- Main owns email verification, credential persistence, refresh/logout and device administration. Refresh credentials never return across IPC; access tokens remain in renderer memory. No plaintext fallback.
- Existing Web session behavior remains unchanged. Old insecure B01 Desktop localStorage credentials are discarded; legacy pending-queue migration needs a separate reviewed solution.
- Shared chat/outbox/business code is reused. Desktop text drafts persist across restart; unsent attachment/reply draft persistence is incomplete.
- Native frame/tray, explicit close-to-tray choice, saved/clamped bounds, single instance and show/minimize/quit controls. Quit stops realtime; hiding to tray does not quit.
- Ctrl/Cmd+K searches chats; Ctrl/Cmd+Shift+L focuses composer. File drop uses current upload API and validation.
- Media consent and screen selection are Main-only, session-bound and fail closed; screen sharing grants video only. Mic/camera selection uses existing LiveKit. AI translation still needs separate backend-verified speaker consent.
- Native notifications contain generic text only. Badge uses a full server unread count, not the loaded first page. Click requires current session and reauthorized conversation metadata. Positive signed OS notification delivery is still a UAT requirement.
- Backend B04 adds `/api/conversations/unread` and optional exact conversation lookup; this branch has NOT deployed those endpoints. An older backend yields explicit unavailable-badge behavior rather than fabricated counts.

## Remaining release blockers

GitHub Actions jobs are blocked by an account billing lock (details and job IDs in B05 report); local tests are not CI approval. Signing/notarization credentials and an approved update channel are not available. **A runtime auto-updater has not been implemented**; ZIP/blockmap generation is not updater functionality.

Real packaged login/revoke, Desktop↔Web parity, two-device LiveKit/Gemini consent/media, Windows/Intel UAT, signed notifications, signed update/rollback and full security review remain open. B01 queue migration, unsent attachment/reply drafts, private disk cache purge, broad media/connect CSP and SSE query-token review are explicit outstanding engineering work. Marketplace/payment rules are unchanged.

No public distribution or merge into dev/main until relevant QA gates and owner approval are satisfied.
