# SocCO Desktop — signed updates implementation & release runbook

Status (2026-11-06): **implemented and unit-tested on `feat/desktop-auto-update`, NOT released**. This document supplements the historical B05 report. Do not interpret passing unit tests as signed install/update acceptance.

## Runtime behavior

- Electron Main loads `electron-updater` only on packaged Windows/macOS builds containing `resources/app-update.yml`. Development builds, unsigned internal installers and Linux default to disabled.
- It checks on startup, on returning to focus after a cooldown, and every four hours. A newer release displays a UI banner. Download requires a click; restart/install requires a second click and a native confirmation.
- `autoDownload=false`, `autoInstallOnAppQuit=false`, `allowDowngrade=false`. Errors retain the running app and offer retry; no update can replace a live renderer remotely.
- Updates are controlled exclusively by Electron Main through four frame-validated IPC handlers. Renderer never selects a URL, writes update files or gets privileged filesystem APIs.
- Installation is blocked in the UI while there is an active/ringing call, a call transition, or persisted unconfirmed/queued messages. The native confirmation instructs users to finish transfers and unsaved work. Account data, drafts and outbox live in the existing user data directory and are not intentionally cleared on update. **Unsent attachment/reply drafts and N→N+1 persistence remain unverified release gates.**
- `0.2.0` introduces the updater. **Existing `0.1.x` Electron builds cannot bootstrap their own updater**: offer those users a one-time signed installer upgrade (in-place, preserving user data) and validate the actual update from 0.2.0 to 0.2.1 on Windows/macOS before broad release.

## Release prerequisites

1. Approve a stable, public HTTPS feed directory (not a private GitHub release requiring personal tokens), with TLS and immutable versioned artifacts. Use a separate feed directory for beta/stable. This project deliberately does not hardcode an unapproved domain.
2. Obtain a trusted Windows code-signing certificate. The publisher subject must remain consistent across releases; `electron-builder` writes it into `app-update.yml` for Windows signature verification. Do **not** set `win.verifyUpdateCodeSignature=false`.
3. Obtain macOS Developer ID signing + notarization/stapling credentials. Both signed DMG and signed ZIP are needed for end user distribution + auto-updates.
4. Publish only reviewed artifacts from a clean source commit with a strictly increasing `desktop/package.json` version and matching `package-lock.json` version. Do not edit `latest.yml` or release artifact contents after signing.

## Build (release operator only)

Use PowerShell on a signed Windows build host:

```powershell
$env:SOCO_DESKTOP_UPDATE_URL = "https://YOUR-APPROVED-RELEASE-HOST/stable/"
npm ci --prefix frontend
npm ci --prefix desktop
npm --prefix desktop test
npm --prefix frontend run build:desktop
npm --prefix desktop run dist:win
```

Use the same release URL on an authorized Mac signing/notarization host and run `npm --prefix desktop run dist:mac`. These commands deliberately end with `--publish never`; inspect/sign/notarize/test before manually uploading to the feed. Without a configured HTTPS feed or code signing, release builds must fail. Internal QA builds still use `dist:internal:win` and `dist:internal:mac` and **must never be placed in the update feed**.

Release directory should include platform-specific signed installer files, Windows `latest.yml` and `*.blockmap`, macOS `latest-mac.yml` and ZIP/DMG, plus checksum inventory. Serve manifests with `Cache-Control: no-store` and correct content types; versioned installers can be immutable. Upload binaries and blockmaps *first*, then atomically make version manifests live last, otherwise clients can see a release pointing to missing files. Do not mix Windows and Mac metadata from different version sets at the same release path. Test Range requests for differential downloads.

## Acceptance gates (do not release until passed)

- Windows x64: signed 0.2.0 clean/in-place install, 0.2.0→0.2.1 update, offline/retry, invalid-signature rejection, restart, and preserves session + local drafts/outbox.
- macOS arm64 & Intel: signed/notarized/stapled install, ZIP update, Gatekeeper, no untrusted downgrade, offline/retry and preserved local data.
- While a call is active/ringing or a queued/unconfirmed message exists, installation must not proceed. Ensure restart does not lose media, unsent attachments or conversation state.
- Revoke/login, startup without credentials/feed, tampered update manifest and update server outage cannot bypass authentication or prevent the old app from running.
- Verify latest Web/PWA frontend still passes its separate build/checks, plus production release security review/CI approvals.
- Rollback plan: restore a previously signed release using a *newer* version number after compatibility review; downgrades are prohibited by the app.
- Record signed artifact hashes, source commit, signer identity, build machine, real device outcomes and operator approval.

## Diagnostics

Check `app.getVersion()`, whether a packaged release has `resources/app-update.yml`, the HTTPS feed response for `latest.yml`/ `latest-mac.yml`, and matching signed binaries. If `app-update.yml` is missing, the installed app deliberately does not check for updates. If server metadata exists but is stale, update the release feed rather than clearing users' accounts. Never request users' credentials or upload session files for troubleshooting.
