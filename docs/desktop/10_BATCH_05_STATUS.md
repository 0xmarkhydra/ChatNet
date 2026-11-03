# SOCO Desktop — B05 packaging and release-safety evidence

Date: 31/10/2026 (Asia/Ho_Chi_Minh) · Branch: `feat/chatnet-desktop-electron`
Base: `76b56f1dccde57057430c609b088cb4379b946e0` · Worktree: `.worktrees/chatnet-desktop-electron`
This report accompanies the B05 commit; resolve its SHA with `git log -1 --format=%H -- docs/desktop/10_BATCH_05_STATUS.md`.

**Internal artifacts exist. Production release, integration into dev/main, signing, notarization and real auto-update acceptance are NOT approved.**

## Task status

| Task | Status | Evidence / remaining work |
|---|---|---|
| DSK-023 | IN_REVIEW | Real NSIS Windows x64 EXE and Mac arm64/x64 DMG+ZIP cross-builds PASS on Mac arm64; actual arm64 DMG copy-install/native smoke/temporary uninstall PASS. Windows installation/runtime and physical Intel Mac smoke NOT RUN. |
| DSK-024 | BLOCKED | No approved Windows signing identity or Apple Developer notarization credentials supplied. Distribution scripts require signing; real missing-signing negative gate rejects the build. Notarization/stapling verification NOT RUN. |
| DSK-025 | BLOCKED — runtime updater not implemented | No approved signed release feed/channel. ZIP and blockmap generation is packaging only, NOT an updater. N→N+1 install, bad-signature rejection, offline update recovery and rollback preserving account/outbox are NOT RUN. No unsigned fallback or remote-script update mechanism added. |
| DSK-026 | IN_PROGRESS | Native/security tests, fail-closed distribution policy and dependency audits PASS within their scopes. Full security audit and outstanding cache/CSP/SSE risks remain open. |
| DSK-027 | BLOCKED | Explicit Windows x64/Mac arm64/Mac Intel matrix prepared. GitHub jobs do not start due to the account billing lock. Local success is not CI success. |
| DSK-028 | BLOCKED | Needs real accounts, Windows/Intel devices, real media/translation/notifications, signed installer/update/rollback UAT and owner signoff. No release candidate approval. |

No task newly marked DONE. No merge, deployment, release publication or billing/account change.

## Implementation

- Reuse the existing reviewed `frontend/public/soco-mark.svg` for a 1024px installer icon. The rasterization script blocks network access and records source/PNG SHA-256; no new brand design or runtime dependency.
- Explicit installer filenames include version, platform and architecture; Windows is x64 NSIS, Mac emits DMG and ZIP for arm64 and x64.
- Public distribution commands `dist:mac`/`dist:win` set `forceCodeSigning=true`; all commands retain `--publish never`. Internal-only commands are named separately and were run with `CSC_IDENTITY_AUTO_DISCOVERY=false`.
- NSIS uninstall does not silently delete application data. This setting is not proof of upgrade/rollback data safety.
- Internal artifact inventory streams SHA-256 and marks `internalOnly=true`, `releaseApproved=false`, `signatureVerified=false`. Inventory records the commit/dirty state at hashing time, not an invented build attestation.
- CI now targets `macos-15` arm64, `macos-15-intel` x64 and `windows-2025` x64 with explicit architecture checks; dependency audit, native tests, session/chat/call/Web/PWA regressions, browser contract fixtures, native package smoke and internal installer build. Bash failure semantics prevent later commands masking earlier failures. No unsigned installer upload or production secrets.
- DMG smoke verifies the image, mounts it read-only, copies only `SOCO.app` into a unique QA directory, detaches, launches the copied app with a fresh QA profile and removes only those temporary QA directories. It never follows the DMG Applications link or modifies the user's Applications/profile.

## Executed verification

| Check | Result | Meaning |
|---|---|---|
| Frontend and Desktop `npm ci` | PASS | Repeated clean install using existing lockfiles; no new runtime dependencies. npm warned about deprecated build-tool transitives and install-script allow-list coverage; no bypass/approval was applied. |
| `npm --prefix desktop test` | PASS — 62/62 | Vault/auth/IPC/window/media/screen/notifications plus 3 packaging policy/provenance/manifest tests. Fixtures are not live business acceptance. |
| Frontend `npm run build` | PASS | TypeScript and Web Vite build; existing large chunk warnings remain. |
| `check:session`, `check:desktop-session`, `check:chat`, `check:outbox` | PASS in B04 | No application logic changed in B05. |
| `check:call-live`, `check:call-translation`, `check:incoming-sound`, `check:onesignal`, `check:pwa`, `check:offline-browser` | PASS in B04 | Static/unit/browser-fixture scope as documented in B04. |
| `check:desktop-notifications` | PASS | Actual React hook with explicit transport/native fixtures, repeated after clean install. Not real native delivery. |
| Backend full suite against fresh PostgreSQL16/Redis7 | PASS in B04 | No backend changes in B05; all package/integration tests executed without skips then. |
| `dist:internal:mac` | PASS | Actual unsigned Mac arm64/x64 DMG and ZIP generated; correct Mach-O architectures verified with `file`. |
| `dist:internal:win` | PASS | Actual unsigned Windows x64 NSIS EXE generated; PE32+ x86-64 main executable verified with `file`. No Windows launch/install claim. |
| `hdiutil verify` arm64 and x64 DMG | PASS | Disk image checksums verified, not Apple signatures. |
| `node frontend/scripts/desktop-dmg-smoke.mjs` | PASS | Real arm64 DMG mount/copy/launch, native shell/vault/security/tray/storage smoke and temporary uninstall. No signed Gatekeeper acceptance. |
| `npm audit --audit-level=high` frontend and desktop | PASS — 0 vulnerabilities reported | Registry audit result at execution, not proof that all code/supply-chain risks are absent. |
| Missing-signature negative build | PASS — expected exit 1 | `forceCodeSigning=true` plus disabled discovery/unset CSC variables refused signing. Actual signed build remains BLOCKED. |
| `git diff --check` | PASS | Structural diff validation; separately reviewed changed files. |
| Automated workflow YAML parse | NOT RUN — approval required | Local command required one-time execution review. No approval bypass or fabricated parser success. Workflow manually reviewed; remote execution remains blocked below. |
| Windows/Intel runtime, positive signed notifications, real two-device calls and live AI translation | NOT RUN | No suitable physical devices/two-account media setup for this run. |
| Signed installers, notarization/stapling, updater/rollback and release UAT | BLOCKED / NOT RUN | Prerequisites and implementation/acceptance not complete. |

Red→green harness evidence: first DMG copy test failed to launch because the copy routine rewrote relative framework symlinks to the temporary mount. Set `verbatimSymlinks=true`, retaining bundle-relative links; repeated actual DMG copy/launch PASS. No OS security policy was disabled to make it pass.

The first negative-signing command used an empty CSC_LINK and failed on an invalid certificate path; that result was not counted. The corrected command unset CSC_LINK/CSC_NAME/CSC_KEY_PASSWORD for that child process and produced the explicit missing-signing failure with forceCodeSigning enabled.

## GitHub CI blocker evidence

B03 Desktop run `41107958464` and Web/PWA run `41107958251` failed before running steps. GitHub check annotations for jobs `124242644061` (Windows) and `124242644546` (Mac) state:

> The job was not started because your account is locked due to a billing issue.

B04 runs `41111949372` (Desktop) and `41111949227` (Web/PWA) were queued at the last status check. No success is claimed for them. The account owner must resolve the billing lock through GitHub; this task did not change billing, credentials or spending. Mac capacity notices are secondary, not a replacement explanation for the billing lock.

## Built internal artifacts

Stored only on the connected Mac at `.worktrees/chatnet-desktop-electron/desktop/release/`. No artifact was published or uploaded for external distribution.

| File | Bytes | SHA-256 |
|---|---:|---|
| SOCO-0.1.0-mac-arm64.dmg | 122700252 | bd6e4a39753eb3e5f188ee9b798f32e0041f4c3c6a73dd968835b06734aa6fb1 |
| SOCO-0.1.0-mac-arm64.zip | 118717868 | 0ce837b7cc6f96ea877f75c121d6676c70354b11bf9ea8c8c54b5cb422db2672 |
| SOCO-0.1.0-mac-x64.dmg | 126827552 | 93de9a332303a5e51c3e12fed6e372952d60c89d974b1c45ce921086b73f7173 |
| SOCO-0.1.0-mac-x64.zip | 122821332 | 47d6cf4596775ad7fd87af203687dc31440c57b0fe8d6ab2416bf903d3cd1d25 |
| SOCO-0.1.0-win-x64.exe | 122297220 | e82f341c8ffa6c1eb98c4b2549d4e700b229ae469c83cb82193b2835213523a5 |

These hashes describe this internal build, made from B04 plus the B05 packaging worktree. Rebuilds may differ. `internal-artifacts.json` explicitly records dirty inventory state and is not a signed provenance document. All `signatureVerified` values are false.

## Outstanding work, not merely hardware blockers

- Implement and validate a signed-feed updater once channel/publisher policy and signing prerequisites are approved. Test N→N+1/failure/rollback with credentials and unsent outbox intact; block installation during active calls/mutations.
- Complete reviewed B01 unsent-queue migration and unsent attachment/reply-draft persistence; verify account-specific private disk cache purge. Do not claim no-data-loss acceptance from simple storage restart smoke.
- Resolve SSE access-token query exposure and broad CSP media/connect allowlists with tested backend/renderer integration.
- Real packaged login/revoke, Desktop↔Web delivery, notification click, media/translation consent and UI feature parity/UAT remain open. Preserve existing backend rules and Marketplace payment semantics.
- Long-call CPU/RAM/leak/suspend-resume measurements and independent security review remain necessary.

Review handoff: B03 `2330cc3`, B04 `76b56f1`; B05 code and evidence accompany this report. No proposal to merge into dev/main until relevant acceptance gates actually pass.
