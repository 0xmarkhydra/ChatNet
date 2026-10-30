# SOCO Desktop — native shell and shared React integration

Branch `feat/chatnet-desktop-electron`. **Not approved for beta, dev/main integration or production release.**
Read `docs/desktop/07_BATCH_02_STATUS.md` for actual tests and remaining acceptance gates.

## Development

Development/build requires Node.js 24+ and Go for backend checks. End users of a packaged application do not install Node.js.
Electron is pinned to 45.1.0; macOS 13+ is a runtime requirement. Physical Windows/macOS compatibility and signed installers remain release gates.

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
npm --prefix desktop test
npm --prefix frontend run build
npm --prefix desktop run build
node frontend/scripts/desktop-shell-smoke.mjs
# Optional local integration run: Docker with fresh loopback-only containers; no existing data touched.
node desktop/scripts/backend-integration.cjs
```

The smoke script creates a new QA profile, tests OS encryption with a synthetic credential, and removes only that profile afterward. It does not log in, deliver messages, call LiveKit or use Gemini. Never substitute it for two-device UAT.
`CSC_IDENTITY_AUTO_DISCOVERY=false` is for explicitly unsigned **internal** smoke only; it is not a release-security exception. Scripts keep `--publish never`.

## B02 behavior

- Main owns email verification, credential persistence, refresh/logout and device administration. Refresh credentials never return across IPC; access tokens remain in renderer memory. No plaintext fallback.
- Existing Web session behavior remains unchanged. Old insecure B01 Desktop localStorage credentials are discarded; legacy pending-queue migration requires a separate reviewed plan.
- Existing chat/outbox/business code is reused. Desktop text drafts persist across process restarts; unsent attachment/reply draft persistence is not complete.
- Native frame, tray menu, explicit close-to-tray choice, saved/clamped bounds and show/minimize/quit controls. Quit stops realtime; tray hide does not quit.
- Desktop shortcuts: Ctrl/Cmd+K to search chats; Ctrl/Cmd+Shift+L to focus the composer. File drop uses the current upload API and validation.

## Remaining blockers

Real packaged login/revoke, Desktop↔Web message/file parity, two-device LiveKit and Gemini consent/media, Windows native UAT, native notifications, signing/notarization, update/rollback and full security review are not certified by B02. Broad media/connect CSP and SSE query-token review remain open. Marketplace/payment rules are unchanged.

No public distribution or merge into dev/main until the documented QA gates and owner approval are satisfied.
