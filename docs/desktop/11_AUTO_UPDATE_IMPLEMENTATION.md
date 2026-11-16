# SocCO Desktop — signed updates implementation & release runbook

Status (2026-11-16): **implemented on `feat/desktop-auto-update`, NOT released**. This document supplements the historical B05 report. Do not interpret passing unit tests as signed install/update acceptance.

## Runtime behavior

- Electron Main loads `electron-updater` only on packaged Windows/macOS builds containing `resources/app-update.yml`. Development builds, unsigned internal installers and Linux default to disabled.
- It checks on startup, on returning to focus after a cooldown, and every four hours. A newer release displays a UI banner. Download requires a click; restart/install requires a second click and a native confirmation.
- `autoDownload=false`, `autoInstallOnAppQuit=false`, `allowDowngrade=false`. Errors retain the running app and offer retry; no update can replace a live renderer remotely.
- Updates are controlled exclusively by Electron Main through four frame-validated IPC handlers. Renderer never selects a URL, writes update files or gets privileged filesystem APIs.
- Installation is blocked in the UI while there is an active/ringing call, a call transition, or persisted unconfirmed/queued messages. The native confirmation instructs users to finish transfers and unsaved work. Account data, drafts and outbox live in the existing user data directory and are not intentionally cleared on update. **Unsent attachment/reply drafts and N→N+1 persistence remain unverified release gates.**
- `0.4.0` introduces the updater above previously distributed `0.3.1` installers. **Existing `0.3.x` Electron builds (and all earlier builds without an updater) cannot bootstrap their own updater**: offer those users a one-time signed `0.4.0` installer upgrade (in-place, preserving user data) and validate the actual update from 0.4.0 to 0.4.1 on Windows/macOS before broad release.

## GitHub Releases (no standalone update server)

The signed release config points to public [0xmarkhydra/ChatNet Releases](https://github.com/0xmarkhydra/ChatNet/releases) using electron-builder's GitHub provider (`latest` channel). No end-user token, separate update host, S3 bucket or API endpoint is required. **The repository must remain public for unauthenticated client updates.** Never put a personal access token in the renderer, release build or `app-update.yml`.

`desktop/package.json` retains `publish: null` for unsigned internal builds; only `desktop/electron-builder.release.cjs` enables GitHub update metadata. The production NSIS updater verifies the Windows installer code signature against the publisher encoded in the installed `app-update.yml`. Code signing cannot be bypassed for production.

### One-time setup by repository owner

1. Merge `feat/desktop-auto-update` into `main` after review (the Actions release workflow must exist on the tagged commit). Ensure GitHub Actions is enabled and has sufficient billing/quota.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add repository secrets `WIN_CSC_LINK` (base64-encoded trusted Windows .pfx certificate) and `WIN_CSC_KEY_PASSWORD`. GitHub's built-in `GITHUB_TOKEN` handles draft release creation; a user PAT is **not** needed. Keep the Windows signer identity consistent across future releases.
3. Optional macOS: add `MAC_CSC_LINK` (base64 .p12 Developer ID Application certificate), `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`. Then set GitHub Actions variable `SOCO_ENABLE_MAC_RELEASE=true`. When off, the workflow publishes **Windows only**; macOS updates are not available through that draft.
4. Protect `main` and release tags: do not allow arbitrary users to push release tags. Keep release-review approval with the owner.

### Publishing a Desktop release from main

1. Increment `desktop/package.json` and the root package version in `desktop/package-lock.json` (for example `0.4.0 → 0.4.1`), commit and merge the changes into `main`. Do not release the same version twice or reuse existing tags.
2. Create and push `v0.4.1` pointing to **that exact commit on main**:
   ```bash
   git switch main
   git pull --ff-only origin main
   git tag v0.4.1
   git push origin v0.4.1
   ```
   This example is for the subsequent release; for the first updater-equipped installer use `v0.4.0` after merging version 0.4.0.
3. `.github/workflows/desktop-release.yml` checks tag/version and main ancestry, runs Desktop tests, builds signed Windows NSIS artifacts (and signed/notarized Mac builds only when enabled), verifies signing and metadata, uploads artifacts to a **Draft GitHub Release**. Failed signing or missing `latest.yml` blocks publishing.
4. Test the draft installers and an actual in-place upgrade, including session, drafts, outbox, offline/retry, code-signature rejection and call interruption behavior. Finally, **publish the Draft Release manually** from GitHub Releases. Drafts are deliberately invisible to regular auto-update clients. Once published, installed updater-equipped clients discover the new release on startup, periodically and when returning to focus. They request user consent to download and install.

Release asset inventory: signed `SocCO-<version>-win-x64.exe`, `latest.yml`, `*.blockmap`; optional macOS signed DMG, ZIP (arm64 and x64), and `latest-mac.yml`. Metadata and installers must come from the **same tag/build**. No automated pushes to `main`, no automatic public release publication, and no GitHub Pages deployment are involved.

For a local signing-enabled release build, supply the same certificate environment variables and run `npm --prefix desktop run dist:win` (or `dist:mac` on a Mac). Both commands use `--publish never`; GitHub Actions uploads only verified build artifacts. Internal QA builds `dist:internal:win` and `dist:internal:mac` are unsigned and must **never** be uploaded to GitHub Releases.

## Acceptance gates (do not release until passed)

- Windows x64: signed 0.4.0 clean/in-place install, 0.4.0→0.4.1 update, offline/retry, invalid-signature rejection, restart, and preserves session + local drafts/outbox.
- macOS arm64 & Intel: signed/notarized/stapled install, ZIP update, Gatekeeper, no untrusted downgrade, offline/retry and preserved local data.
- While a call is active/ringing or a queued/unconfirmed message exists, installation must not proceed. Ensure restart does not lose media, unsent attachments or conversation state.
- Revoke/login, startup without credentials/feed, tampered update manifest and update server outage cannot bypass authentication or prevent the old app from running.
- Verify latest Web/PWA frontend still passes its separate build/checks, plus production release security review/CI approvals.
- Rollback plan: restore a previously signed release using a *newer* version number after compatibility review; downgrades are prohibited by the app.
- Record signed artifact hashes, source commit, signer identity, build machine, real device outcomes and operator approval.

## Diagnostics

Check `app.getVersion()`, whether a packaged release has `resources/app-update.yml`, the HTTPS feed response for `latest.yml`/ `latest-mac.yml`, and matching signed binaries. If `app-update.yml` is missing, the installed app deliberately does not check for updates. If server metadata exists but is stale, update the release feed rather than clearing users' accounts. Never request users' credentials or upload session files for troubleshooting.
