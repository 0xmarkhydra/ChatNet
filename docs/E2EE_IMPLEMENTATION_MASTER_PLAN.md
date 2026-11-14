# ChatNet/SOCO — E2EE implementation plan (Web/PWA first)

Status: **IN_PROGRESS — a guarded, explicit opt-in MLS E2EE text-chat pilot is integrated into the real Web/PWA direct-chat UI (one browser device per account), with two-Chromium end-to-end simulated REST tests and isolated PostgreSQL/Redis API integration; NOT default, NOT production-ready, experimental feature flag OFF by default**.
Baseline: `main@782af69` (2026-11-13). Development is in the primary checkout `/Users/levanmong/Documents/ChatNet` on `main`, not a worktree.
Not approved for deployment; do not label any chat or file E2EE until independently verified. No commit, push, release, or production schema migration is implied by this status.

## 1. Product contract and security objectives

- Private direct chat and private group chat must become end-to-end encrypted, including text, reply excerpts, filenames, media, voice notes, attachments, previews and encrypted local outbox.
- Only authenticated participating **devices** hold decryption secrets. ChatNet Go services, PostgreSQL, Redis, S3, push service and translation service must never receive chat secrets.
- MLS 1.0 (RFC 9420, RFC 9750 architecture) is the **candidate** group/1:1 key establishment protocol. Evaluate an audited, maintained browser-compatible library (e.g. OpenMLS/WASM) in a separate feasibility gate. Do not implement MLS protocol primitives in application code.
- Every device gets its own cryptographic identity and MLS membership. User account login **does not** grant existing device keys; newly approved devices join the appropriate groups and cannot automatically decrypt earlier epochs.
- New groups must refuse plaintext messages and must not silently fall back on encryption errors. Legacy chat continues until a deliberate migration with user-visible status.
- Chat translations: only **client** decrypts a received message, then (if explicitly enabled and notified) calls the separate translation API with plaintext text + target language. This breaks confidentiality with respect to the translation provider for that translated content; clearly disclose it. Never let translation service query E2EE message DB rows or persist plaintext translations to Redis/PostgreSQL.
- Scope: Web/PWA first. Reuse cryptographic core for Electron later; no native iOS/Android work in this phase. Social Feed, public Story, Marketplace are not E2EE by default. Existing LiveKit calls have a separate E2EE flow.

## 2. Current code findings (baseline)

- `backend/cmd/chat/main.go`: `INSERT INTO messages(...,text,...)` persists plaintext; `listMessages` queries it; messages are sent over SSE as plaintext today.
- `backend/cmd/translate/main.go`: can read `m.text` by `messageId`, calls configured AI provider and persists `message_translations` and a Redis cache. For encrypted conversations, remove these capabilities; provide explicit client-supplied translation endpoint with consent/rate-limit boundaries.
- `frontend/src/features/auth/lib/session.ts` and `app/hooks/useAppSession.ts`: Web/PWA session credentials stored in `localStorage`. `frontend/src/app/hooks/useAppRealtime.ts` and `features/calls/components/CallManager.tsx` embed bearer tokens in SSE URLs. These must be hardened in parallel with E2EE.
- `backend/cmd/chat/media_access.go` has per-viewer signed media URLs with reauthorization on GET; `internal/mediax` currently presigns/uploads normal file types (not encrypted `.bin`).
- `frontend/src/features/chat/lib/mediaUpload.ts` and `api/media.ts` upload ordinary Files, not ciphertext. Offline outbox `features/chat/lib/chatOutbox.ts` may persist plaintext.
- `frontend/src/features/calls/lib/callE2EEKeySync.ts` is **for calls only**; do not reuse its shared-room key scheme for messages.

## 3. Threat model and trust boundaries

| Threat | Mandatory property / gate |
| --- | --- |
| Leaked DB/Redis/S3 or server admin | No plaintext chat content, attachment keys or decrypted metadata in server-side storage, cache, backup, metrics or logs |
| Malicious delivery server | Authenticated MLS transcript/epoch, no forged membership; enforce monotonic sequence and replay rejection |
| Compromised identity/key directory | Device verification and key-change warnings; append-only auditable key directory/transparency design before a strong claim against server impersonation |
| Lost/stolen device | Device-specific keys, revocation, rekey on removal; old previously delivered data remains readable to already-authorized devices |
| Malicious script/XSS/browser extension | CSP, trusted origins, dependency integrity, review of Web/PWA JS delivery; E2EE cannot protect data after malicious script reads in-memory decrypted text |
| Offline/ambiguous retries | Idempotent ciphertext request IDs, epoch-safe queue, never reuse AEAD nonce with same key |
| Media upload/download | Ciphertext only in S3, per-file keys only within authenticated MLS application message, signed and revocable access |
| Translation provider | Explicit opt-in, client sends only content it elects to translate; no remote model key in browser; translation must not occur silently |

Metadata privacy is limited: server still needs user/conversation/device membership, timestamps, ciphertext sizes and delivery routing. Do not advertise anonymity.

## 4. Protocol decisions pending POC

1. **Device identity**: key generation/signatures, signed KeyPackages, device registration/auth binding, QR/safety-number verification and key-change notifications. Account password/OTP cannot replace cryptographic device verification.
2. **Group membership**: one MLS group per private conversation (devices as leaves), epoch transitions serialized transactionally; reject stale epochs/replayed commits; handle simultaneous commits and offline Welcome/KeyPackage distribution.
3. **Message format**: versioned encrypted envelope, sender device ID, group ID/epoch, encrypted application payload, idempotency key, sequence/cursor. Authorization uses server DB membership **plus** authenticated MLS state; no unauthenticated envelope metadata may grant access.
4. **Media**: per-file 256-bit AES-GCM key; 4 MiB chunk plaintext, 128-bit tag per chunk. Per-file nonce prefix + unique monotonically increasing counter as 96-bit IV; authenticated AAD binds filename, MIME, plaintext size, chunk index/total. No plaintext name/preview/mime in S3 or server-visible presign requests. File-key + manifest encrypted/authenticated inside MLS application payload.
5. **Crypto local state**: encrypted local key storage/recovery design (IndexedDB alone is not a secure vault); verify PWA browser limits and background upload. Do not make private keys exportable except an explicitly secured recovery workflow.
6. **Recovery**: new device requires a verified invite and does not get old history by default; optional encrypted history transfer / backup with user-held recovery secret. Avoid server escrow.
7. **Legacy data**: keep existing plaintext rows under a separate legacy mode; require per-conversation migration transaction and UX notice. No plaintext fallback once a conversation becomes `e2ee`.

## 5. Execution backlog with owners and acceptance

| ID | Priority | Owner | Task | Acceptance |
| --- | --- | --- | --- | --- |
| E2EE-00 | P0 | Thắng+Bắc | Threat model, MLS library/WASM feasibility, JS supply chain, device key threat model | Chrome/Safari iOS PWA 2-device POC, cryptographic review |
| E2EE-01 | P0 | Bắc | Additive DB schema: devices, key packages, group epochs, ciphertext envelopes; indexes and foreign keys | Migrations reversible by a documented forward migration; legacy messages still work |
| E2EE-02 | P0 | Bắc | Device registration and one-use KeyPackage APIs, replay/authorization controls | Non-member cannot read key material; no private keys ever arrive at backend |
| E2EE-03 | P0 | Thắng | Browser/WASM MLS lifecycle + authenticated device verification | Cross-browser two-device group join, restart, offline rejoin |
| E2EE-04 | P0 | Bắc | Transactional group Commit/Welcome sequencing, push/SSE ciphertext | Race-safe rekey; removed device receives no new epoch keys |
| E2EE-05 | P0 | Thắng+Bắc | Direct encrypted chat end-to-end, optimistic send, SSE, outbox | Two accounts, two devices each, offline/replay/edit/delete; no DB plaintext |
| E2EE-06 | P0 | Thắng+Bắc | Group E2EE, membership changes, channels and multiple devices | Remove/add/rejoin/reconnect verification incl. adversarial clients |
| E2EE-07 | P0 | Thắng | Client encrypted attachments, filename+preview metadata, chunked upload/download, revoke | Tamper/wrong key/truncation rejected; audio/video previews work without server plaintext |
| E2EE-08 | P0 | Bắc | S3 encrypted-object upload contract with random object IDs, adjusted ciphertext size limits; reauthorization | No unencrypted chat media exposed; encrypted object never served as executable |
| E2EE-09 | P0 | Thắng+Bắc | Client-side post-decryption AI translation, explicit opt-in, no stored provider plaintext | Network trace proves translation happens after decrypt and only when consented |
| E2EE-10 | P0 | Thắng+Bắc | Remove SSE bearer URLs; protect browser refresh tokens, harden CSP/XSS and local outbox | No credentials in URLs/logs; automated regression tests |
| E2EE-11 | P1 | Thắng | Device verification/recovery UI and encrypted backup/history transfer | Revoke, lose, restore devices without secret exposure |
| E2EE-12 | P0 | Security/QA | Adversarial 3-account tests, key substitution, old epoch replay, fuzzing, XSS, backup and mobile PWA | No unresolved critical/high findings; deploy gate signed |
| E2EE-13 | P0 | Integration | Feature flags and staged rollout, monitor, compatibility, backup/rollback | Never downgrade an E2EE room; stop rollout on integrity failure |

## 6.1 Batch 01 — device identity enrollment (implemented locally; experimental only)

The first additive migration is `backend/internal/database/migrations/011_e2ee_devices.sql`, embedded by `backend/internal/database/migrate.go`. It records public Ed25519 identity keys (32 bytes), generated device UUIDs and metadata. No secret/private keys are stored. The migration is additive and does not switch any conversation to E2EE.

The Go Auth service exposes these routes **only when** `CHATNET_E2EE_EXPERIMENTAL=1`; otherwise each returns 404:

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/e2ee/challenge` | Session-authenticated one-use registration challenge (Redis TTL 120 sec), returns challenge and public session UUID |
| POST | `/api/auth/e2ee/devices` | Register an Ed25519 device public key with a signed challenge proof |
| GET | `/api/auth/e2ee/devices` | List own active public device identities |
| GET | `/api/auth/e2ee/users/{userId}/devices` | List peer devices only after a shared conversation membership check |

Registration request:
```json
{
  "deviceId": "UUID-v4",
  "identityKey": "base64url-ed25519-public-key-32-bytes",
  "challenge": "base64url-32-bytes-from-challenge-api",
  "signature": "base64url-ed25519-signature-64-bytes",
  "label": "This device"
}
```

The signed transcript is exactly UTF-8 lines joined with newline, no trailing newline:
`chatnet:e2ee:register:v1`, decimal `userID`, actual JWT `sessionID` returned by the challenge route, `deviceId`, `identityKey`, `challenge`, `label`.

Proof is verified before Redis `GETDEL`; reused or expired challenges fail. Enrollment locks the owner row to serialize the 12-active-device quota. Redis rate limits protect challenge (20 / 10 min), enrollment (30 / hour) and directory (300 / 5 min). Authorization also requires a valid, unrevoked JWT session. Duplicate device IDs or identity keys are rejected, never silently replaced. No key substitution protection beyond account authorization and explicit device signature is claimed yet: **device verification and key transparency are pending**.

Client POC is in `frontend/src/features/auth/lib/e2eeIdentity.ts`, with API adapters in `frontend/src/features/auth/api/e2eeDevices.ts`. Ed25519 private keys are generated non-exportable by WebCrypto; caller must persist and independently verify identity before using these APIs. No enrollment UI, key-storage/recovery or MLS client has been connected yet. `frontend/scripts/e2ee-device-check.mjs` tests browser-compatible signing in Node without installing new dependencies.

### Batch 02 — one-use KeyPackage delivery and signed revocation (implemented locally)

Additional migration: `backend/internal/database/migrations/012_e2ee_key_packages.sql`. The database stores **public, opaque** KeyPackage bytes (64–16384 bytes), SHA-256 digest, device ID, timestamps and single-use claim status; no private key or MLS group secret. No previous chat storage is migrated.

Endpoints (all authenticated with cached session middleware and hidden unless `CHATNET_E2EE_EXPERIMENTAL=1`):

| Method | Route | Contract |
| --- | --- | --- |
| POST | `/api/auth/e2ee/key-packages` | Publish a device-signed KeyPackage via a fresh one-use challenge; max 30 unclaimed per device, 7-day expiry |
| POST | `/api/auth/e2ee/key-packages/claim` | Atomically claim one unused package using `userId` and `deviceId`; caller must have shared conversation membership with target user (or be owner) |
| POST | `/api/auth/e2ee/devices/{deviceId}/revoke` | Require one-use challenge signed by an **active** device on the same account; revoke target and delete all unclaimed packages in one transaction |

The signed KeyPackage publication transcript (newline-separated UTF-8, no trailing newline) is:
`chatnet:e2ee:keypackage:publish:v1`, decimal `userID`, JWT `sessionID`, `deviceId`, `packageId`, `base64url(SHA256(rawPackageBytes))`, `challenge`. Request body carries `deviceId`, `packageId`, `package` (base64url), `challenge`, `signature` (base64url Ed25519 64 bytes).

The signed revocation transcript uses `chatnet:e2ee:device:revoke:v1`, decimal `userID`, `sessionID`, `targetDeviceId`, `authorizingDeviceId`, `challenge`. Revocation request body contains `authorizingDeviceId`, `challenge` and `signature`; the target is the URL path parameter.

**Security constraints and release blockers:**
- Backend verifies transport identity signature only; it **does not validate actual MLS KeyPackage credential, ciphersuite, lifetime, extension support or signature**. Browser MLS library MUST do full protocol verification before consuming a package or adding group members.
- Device revocation **does not automatically rekey any MLS group**; a removed device can still decrypt old epoch keys. Group membership commit + rekey and future-message access enforcement must be completed before production rollout.
- A user who loses **all active private device keys** cannot use this device-signed revocation endpoint. A separate strong recovery path must be designed, audited and tested.
- A member of a shared conversation can consume eligible public KeyPackages; publish/claim operations are Redis rate-limited. KeyPackage depletion needs monitoring and replenishment, ideally linked to explicit enrollment protocol intent.
- The server's key directory is not yet transparent. A compromised backend can attempt identity-key substitution; peer-verification UX and an append-only auditable identity history are P0 before any strong trust claim.
- E2EE endpoints remain opt-in, no upload or claim API is integrated into current chat and nothing is enabled for existing users.

Browser helpers: `frontend/src/features/auth/lib/e2eeIdentity.ts` signs publication/revocation with the non-exportable device identity; API adapters are in `frontend/src/features/auth/api/e2eeKeyPackages.ts` and `e2eeDevices.ts`.

**Remaining for E2EE-01/02:** MLS-correct KeyPackages and consumable Welcome/Commit delivery, verified device onboarding, strong key transparency/recovery, group-epoch schema and encrypted message storage, plus real multi-device integration tests. No E2EE API should be enabled on production until these contracts and tests are complete.

## 6. Attachment implementation status

- **Implemented in this branch, isolated and not wired to upload:** `frontend/src/features/chat/lib/attachmentCrypto.ts` + `attachmentCrypto.test.ts`.
- `encryptAttachment(file)` creates one random per-file AES-256-GCM key and random nonce prefix; encrypts each 4 MiB chunk with unique IV, authenticated metadata. Returns ciphertext Blob, manifest and in-memory raw key.
- `decryptAttachment(ciphertext, manifest, key)` validates sizes/format, tag on every chunk, then reconstructs client Blob; corrupt data throws instead of returning partial plaintext.
- **Do not enable it in live chat yet.** In particular, raw `fileKey` and the identifying `manifest` must be delivered only via authenticated MLS encryption, which does not exist yet. Existing S3 presign would leak filename/MIME and rejects `.bin`; uploading an encrypted Blob through existing code requires backend changes and client integration. Current module is crypto POC, not complete E2EE.
- `Blob` is assembled in browser memory for this POC. Before production, verify peak Safari iOS RAM and adopt streaming write/decrypt where needed. Do not log/serialize fileKey or leave plaintext in outbox/offline cache.

## 6.2 Verification evidence (2026-11-14)

- **PASS:** `go -C backend test -count=1 ./...` across all Go packages.
- **PASS:** `go -C backend vet ./cmd/auth ./internal/database`.
- **PASS:** `node --experimental-strip-types frontend/scripts/e2ee-device-check.mjs` (client Ed25519 registration, package hash signature, revocation signature, negative impersonation cases).
- **PASS:** TypeScript strict isolated check for `e2eeIdentity.ts`, `e2eeDevices.ts`, `e2eeKeyPackages.ts` and `attachmentCrypto.ts` using existing compiler, no reinstall.
- **PASS:** Isolated PostgreSQL/Redis integration using locally cached Docker images `postgres:16-alpine` and `redis:7-alpine` with throwaway containers and no persistent volumes. `TestE2EEDeviceDirectoryIntegration` and `TestE2EEKeyPackageExchangeIntegration` both passed; this covers one-time claim, concurrent claims, authorization checks and pending-package deletion on revocation.
- **NOT RUN:** Current Web/PWA runtime/browser compatibility, actual MLS KeyPackage content validation, full live chat, media S3 cipher upload, translation after decryption, device key persistence/recovery and independent security audit.
- **RELEASE GATE:** E2EE experimental endpoints remain disabled by default, and `main` working-tree changes are not committed/pushed/deployed. No conversation is E2EE.

## 6.3 Batch 03 — opaque MLS relay with epoch sequencing (implemented locally)

This is a **transport only**, NOT a working MLS crypto engine or E2EE chat mode. No production client is connected and no legacy conversation has been switched to E2EE.

- Schema: `backend/internal/database/migrations/013_e2ee_mls_relay.sql` creates `e2ee_mls_groups` (conversation ID and current epoch) and `e2ee_mls_events` (opaque bytes, sender/device IDs, signature, epoch, per-device optional Welcome destination, idempotency key and request hash). **No plaintext column** exists in these tables.
- Go handler: `backend/cmd/chat/e2ee_mls.go`. Experimental-only routes under existing authenticated chat service:
  - `POST /api/conversations/{id}/e2ee/events`
  - `GET /api/conversations/{id}/e2ee/events?deviceId=<UUID>&after=<cursor>&limit=25`
- Client helpers: `frontend/src/features/chat/lib/mlsTransport.ts` signs MLS ciphertext bytes with a non-exportable Ed25519 device key; `frontend/src/features/chat/api/mlsTransport.ts` provides typed REST operations. Neither file sends unencrypted chat text, persists secrets, decrypts anything or installs an MLS library.
- Write body: `{deviceId,clientId,eventType,epoch,targetDeviceId?,payload,signature}`. Types are `commit`, `application`, `welcome`; payload is canonical base64url of 32–131072 opaque bytes; signature is canonical base64url of 64-byte Ed25519 signature. Only a valid, unrevoked device owned by a current conversation member may publish. Direct-message block policy applies.
- The sender signs a newline-separated UTF-8 transcript with no final newline:
  `chatnet:e2ee:mls:relay:v1`, decimal `senderUserID`, decimal `conversationID`, `deviceId`, `clientId`, `eventType`, decimal `epoch`, `targetDeviceId` (empty for non-Welcome events), `base64url(SHA256(rawPayload))`.
- The initial Commit uses `epoch=1`. Each subsequent Commit must request `epoch=currentEpoch+1`; applications and targeted Welcomes require `epoch=currentEpoch>=1`. PostgreSQL locks the group row to serialize concurrent epochs. The backend **does not** validate that the binary Commit is an actual valid MLS Commit; clients must do this cryptographically and reject invalid/broken transcript state.
- `clientId` and signed request hash make successful lost-ACK retries idempotent. Reusing the same client ID for different authenticated payloads yields 409. Implement reconciliation before retrying ambiguous Commit writes on the client.
- Welcome payloads are queryable **only** by the intended active target device; shared Commit/Application events are queryable by current members with active registered devices. GET enforces cursor (0 or greater), capped page size 50, device ownership and current membership at query time. It returns ciphertext and Ed25519 transport signature; **the receiver must still verify MLS credentials and process the real MLS transcript**. A revoked device or removed group member is denied new queries; previously downloaded content remains available on its local storage.
- All routes are hidden under `CHATNET_E2EE_EXPERIMENTAL=1`, with Redis-based rate limits. The current plaintext chat endpoint is unchanged, and no application UI labels any conversation E2EE.

**Verification:** `TestMLSRelayThreeAccountsIntegration` PASS on disposable PostgreSQL 16 + Redis 7 (Docker images already present, containers cleaned up). Covers three accounts, four devices, outsider/removed member/revoked device, device signature tampering, idempotency conflict, concurrent epoch commits, stale epoch, targeted Welcome privacy, and cursor bounds. `node --experimental-strip-types frontend/scripts/e2ee-mls-transport-check.mjs` PASS with 128 KiB payload and signed-field tampering; isolated strict TypeScript check PASS.

**P0 blockers to actual E2EE:** integrate a real reviewed MLS implementation (e.g., a supported OpenMLS/WASM build), verify KeyPackages and group credentials, persist and protect MLS state, cryptographically validate each Commit/Application/Welcome, commit membership changes and rekeys, deliver real-time notifications, prevent plaintext fallback and write a controlled conversation migration. Experimental relay accepts arbitrary authenticated binary and is **not safe to advertise as secure messaging**.

## 6.4 Batch 04 — browser device-key persistence POC (implemented locally)

- `frontend/src/features/auth/lib/e2eeKeyStore.ts` saves **non-exportable** Ed25519 `CryptoKey` objects by structured clone in IndexedDB, scoped by `userId:deviceId`. It refuses overwriting existing identities and verifies the stored public/private key pair by signing and verifying a random challenge before accepting it.
- Exporting private key bytes, localStorage/sessionStorage storage, backup and server escrow are intentionally **not implemented**. A user-controlled device deletion function is provided; do not call it implicitly on logout without a separately agreed recovery policy.
- `frontend/scripts/e2ee-key-store-browser-check.mjs` uses the **existing** local Playwright + TypeScript dependencies. **PASS in real Chromium** after saving, reloading the entire page, reopening IndexedDB, signing with recovered private key, isolating accounts, refusing duplicate keys and explicit deletion.
- `--webkit` attempt: **BLOCKED**, because this machine's Playwright WebKit executable is not installed. No browser packages were downloaded or reinstalled. Manual Safari iOS/PWA testing remains P0 before release.
- A non-exportable browser CryptoKey does **not** protect against malicious JavaScript injected into the same origin; CSP, dependency integrity, browser supply chain and XSS defenses remain P0. IndexedDB loss/browser reset will lose the identity without a user-controlled recovery workflow.
- Enrollment UI and actual MLS state/credential storage are NOT connected; no device is enrolled automatically and no production E2EE chat is enabled.

## 6.5 Batch 05 — actual RFC 9420 MLS crypto PoC (local, 2026-11-14)

### Cryptographic library selection

- **PoC only:** `ts-mls@1.6.4`, exact pinned version with `@noble/hashes@2.3.0` and `@noble/ciphers@2.1.1`, added in existing `frontend/` installation and lockfile; no `npm ci`, no new worktree.
- Mandatory/interoperable cipher suite: `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`.
- SECURITY GATE: `ts-mls` declares it has **not** undergone an independent security audit. Versions below 1.6.4 had a **high-severity removal/rekey vulnerability** `GHSA-gwp3-968w-m7gv`; **1.6.4 is patched**. A passing PoC is insufficient for production. Production candidate still requires reviewed OpenMLS/WASM vs audited alternatives and an independent security assessment.
- References: https://github.com/LukaJCB/ts-mls/security/advisories/GHSA-gwp3-968w-m7gv and https://github.com/LukaJCB/ts-mls/blob/main/SECURITY.md and https://www.rfc-editor.org/rfc/rfc9420.html.

### New client implementation and API attestation

- `frontend/src/features/chat/lib/mlsEngineExperimental.ts` uses **real MLS** `generateKeyPackage`, `createGroup`, `createCommit`, `joinGroup`, `createApplicationMessage`, `processPrivateMessage`, signed credential validation and epoch tracking. It returns the next MLS state instead of silently mutating the previous state; the application must reconcile with the backend, durably persist encrypted MLS state and only advance its local epoch after an acknowledged Commit.
- `ExperimentalMLSTrust` **rejects unknown credentials by default**, rather than using the library's built-in permissive default `validateCredential`. It pins account/device to a specific MLS signing public key. Only a previously **independently verified** device key is permitted to authorize a peer; a backend-provided key cannot establish its own trust.
- A new `backend/internal/database/migrations/014_e2ee_keypackage_attestation.sql` stores only the device's public signed publication proof: `publisher_session_id`, `publication_challenge`, and `publication_signature` next to the public KeyPackage. Old packages with no attestation cannot be claimed. No new plaintext or private key storage is introduced.
- Auth `POST /api/auth/e2ee/key-packages/claim` now returns `{userId,deviceId,packageId,package,sessionId,challenge,signature,expiresAt}`. Client `verifyClaimedE2EEKeyPackage` (exported by `features/auth/index.ts`) reconstructs the original signed transcript, hashes the **actual** KeyPackage bytes, then verifies Ed25519 against the **pinned** device identity key before accepting the package. The crypto engine then verifies the MLS KeyPackage's internal signature and expected account/device credential binding, again before creating a Commit.
- `frontend/scripts/e2ee-mls-real-crypto-check.mjs`: real MLS create/join/Welcome/chat round-trip, then a Remove Commit and verification that the removed member **cannot** decrypt an application message from the new epoch.
- `frontend/scripts/e2ee-mls-browser-check.mjs`: PASS on two **independent Chromium browser contexts**: group setup, KeyPackage, Commit, Welcome, encrypted message from Alice to Bob, successful decrypt and duplicate/replay rejection.
- `frontend/scripts/e2ee-mls-engine-check.mjs`: PASS on pinned Ed25519 publisher attestation, unknown/changed peer rejection, tampered KeyPackage rejection, wrong conversation Welcome rejection, real AES-GCM MLS ciphertext and replay rejection.
- `frontend/scripts/e2ee-device-check.mjs`: PASS on client-side signed publication verification and rejection when package bytes, user, session, ID, signature or pinned key are substituted.

### Verification and remaining release blockers

- **PASS** `npm --prefix frontend run build` (TypeScript and Vite); **PASS** `go -C backend test -count=1 ./...` and Go Vet; **PASS** 5 attachment cipher Vitest unit tests.
- **PASS** isolated PostgreSQL 16 / Redis 7 integration tests: `TestE2EEDeviceDirectoryIntegration`, `TestE2EEKeyPackageExchangeIntegration` (including signed publication receipt), and `TestMLSRelayThreeAccountsIntegration`. Disposable Docker containers were removed after tests.
- **FAIL unrelated existing debt:** `npm --prefix frontend run check:architecture` reports a cycle `ChatSection.tsx -> ConversationRailControls.tsx -> ChatSection.tsx`; `npm --prefix frontend run lint` fails in `ChatSection.tsx` and `useRailSearchPopover.ts`. No E2EE lint baseline increase was added. The unrelated files were left untouched.
- **NOT RUN** Safari/iOS WebKit (required Playwright binary not available); no production/staging deployment, LiveKit integration, independent cryptographic audit or full UI journey.
- **P0:** Connect real MLS state machine to enrolled and verified devices with **encrypted durable group-state storage**, handle lost ACKs and concurrent epoch proposals/recovery, and enforce that application-message senders belong to the actual MLS group (not only the database conversation). Authenticated MLS Commit proposals must be checked against ChatNet membership and device revocation; current `applyExperimentalMLSCommit` still uses `acceptAll` for prototype testing and **is not a production membership policy**.
- **P0:** Implement secure device linking/QR verification and key transparency, encrypted media upload to S3, explicit opt-in client-only translation, local encrypted outbox and no-downgrade conversation migration. No existing user message is encrypted by this PoC.
- **Remain disabled:** `CHATNET_E2EE_EXPERIMENTAL` defaults to off and the modules are not mounted in the live chat composer.

## 6.6 Batch 06 — durable MLS state and fail-closed cutover safeguards (local; not pushed)

**Implementation completed locally:**
- `frontend/src/features/chat/lib/mlsStateVault.ts`: browser IndexedDB vault stores RFC 9420 serialized `GroupState` encrypted with a non-exportable AES-256-GCM key. AAD binds user/device/conversation/epoch/revision, the stored group ID and own leaf credential must match those identifiers, and the monotonically increasing revision/epoch is checked with a single transaction to prevent stale-tab overwrites.
- The MLS decoder retains subarray references to private signing bytes; aggressively zeroing the *decrypted* serialization buffer made a recovered key invalid. The PoC test caught this, and the decoder's backing buffer is now preserved until state is discarded. Independent *encoder* buffer is wiped after AES-GCM encryption.
- `frontend/scripts/e2ee-mls-state-browser-check.mjs`: browser-level check with Alice and Bob, each reloading the entire page, decrypting after restore, verifying their active ratchets, detecting stale concurrent writes, rejecting cross-account reads and ciphertext tampering, and refusing to export the AES-GCM storage key.
- Backend `GET /api/conversations/{id}/e2ee/status` reports `legacy` or `e2ee` according to committed MLS epoch, with membership authorization. `createMessage` and `editMessage` refuse plaintext writes after MLS epoch 1 in that conversation. The first MLS Commit and ordinary send serialize through a PostgreSQL parent conversation row lock so they cannot race across the cutover.
- `frontend/src/features/chat/api/messages.ts`, `hooks/useMessageSender.ts` and `hooks/useOutboxDelivery.ts`: check encryption status before queuing/sending legacy plaintext. An MLS room rejects the plaintext draft without erasing it, and old local outbox messages are marked failed rather than submitted. An unavailable or malformed status fails closed; **this is a temporary safeguard, not the completed E2EE sending UI**.
- Integration test `TestMLSRelayThreeAccountsIntegration` exercises the legacy-to-MLS transition: old history survives, plaintext POST and PATCH are denied after MLS activation, and no new plaintext rows appear. Unit tests in `useOutboxDelivery.test.ts` verify no plaintext POST happens when MLS is active or encryption status is unavailable.

**Release status: BLOCKED — DO NOT DEPLOY THESE NEW CHANGES TO AUTO-DEPLOYING `main` YET.** The existing composer currently refuses to send to an activated MLS room because there is no full supported encrypted send/receive replacement. Pushing now would risk user-visible outages. The end-user chat is **not** E2EE by default.

**Required before production/main push:**
1. User/device enrollment in the actual Web/PWA login flow, private MLS KeyPackage persistence, signed/pinned key verification and onboarding of every relevant account and device.
2. Complete the MLS state machine for actual conversation membership, Welcome/Commit queue, concurrent epoch conflict recovery, encryption in send composer and decrypt/render in history, realtime notifications, secure encrypted local outbox and cursor atomicity with persisted ratchet. Never retry a Commit blindly.
3. Key transparency or user-verifiable safety numbers, group removal/rekey before future messages, authenticated membership changes and multi-device tests. The prototype `acceptAll` Commit policy is NOT acceptable for live chat.
4. Encrypt private attachments before S3 and send file keys over MLS; keep public feed/story/media unchanged.
5. Rework the translation contract: after the receiver client decrypts, remote translation only with user consent; never read or store E2EE plaintext in the server-side translation cache.
6. Explicitly mark pre-cutover legacy history as **not E2EE**, test two real accounts with reconnect/reload/device removal, WebKit/iOS PWA, and get a professional security review of the MLS dependency. The current `ts-mls` package has no independent audit.
7. Resolve the unrelated repository-wide lint/architecture CI failures or obtain a reviewed, supported release process without bypassing checks.

## 6.7 Batch 07 — end-to-end direct-chat Web pilot with explicit two-party consent (2026-11-14)

**Status:** Web/PWA has an opt-in E2EE test interface for direct (1-to-1) conversations, but this is NOT E2EE-by-default and NOT a security-reviewed release. Production users continue using legacy chat by default. The test feature is gated behind **`CHATNET_E2EE_EXPERIMENTAL=1` in BOTH the auth service and chat service**. The environment variable is OFF by default.

### What is integrated

- `backend/cmd/chat/e2ee_bootstrap.go`: `POST /api/conversations/{id}/e2ee/bootstrap` writes the first signed MLS Commit and targeted Welcome atomically and advances the group epoch to 1. Only direct conversations with exactly two members and exactly one active registered device per member are eligible. Committed signed client IDs make a lost-ACK retry idempotent. A sender cannot initialize a direct group by calling the generic Commit endpoint without a matching Welcome.
- `backend/internal/database/migrations/015_e2ee_pilot_consents.sql`: per-member consent table; `backend/cmd/chat/e2ee_pilot_consent.go` exposes `GET/POST /api/conversations/{id}/e2ee/consents`. **Both users must explicitly approve** the transition from their active registered device IDs. A single user's click does NOT switch the other user's conversation, preventing surprise write outages. Consent is tied to membership, and becomes ineffective on removal/revocation.
- `backend/cmd/chat/e2ee_mls.go`: direct pilot only accepts application messages at MLS epoch 1 after atomic bootstrap. The generic direct-chat rekey / second Commit is explicitly rejected until credential/membership rekey policy is implemented. The status endpoint `GET /api/conversations/{id}/e2ee/status` returns `{mode,epoch,pilotEnabled}`. Existing legacy create/edit message APIs fail closed once the epoch advances; historical plaintext rows are retained but never relabeled as E2EE.
- `frontend/src/features/chat/lib/mlsPilotService.ts` and `mlsStateVault.ts`: enroll an Ed25519 device, seal the MLS private KeyPackage and state on the originating device with non-exportable AES-256-GCM IndexedDB key, publish signed public KeyPackage, and verify the peer's pin/attestation before creating MLS group. Handle real encrypted send/receive, persist MLS ratchet, ciphertext cursor, locally encrypted plaintext history and encrypted signed pending outbox **atomically**, and idempotently retry pending signed envelopes without consuming the ratchet twice.
- `frontend/src/features/chat/components/E2EEPilotGate.tsx` **lazy loads** the React MLS test panel only if permitted by the server flag or a previously activated direct conversation exists. `E2EEPilotPanel.tsx` adds device enrollment, out-of-band safety-code comparison, user-controlled pin, two-user consent and activation, local encrypted message timeline and encrypted-only composer inside the normal ChatNet direct conversation screen. No fallback to plaintext after activation. A clear notice states that earlier historical messages are NOT E2EE.
- The pilot is separate from the legacy timeline and **text-only**. Legacy group rooms, attachments, online translation, voice calls, search, moderation and notifications are NOT E2EE and are NOT part of this pilot.

### Repeatable tests

- `npm --prefix frontend run check:e2ee-pilot` — real React pilot interface in two isolated Chromium pages with an in-process simulated API: enroll two accounts; compare/pin device identity; prove that zero or one consent cannot bootstrap; complete two approvals; atomic Commit/Welcome; send A→B and B→A; verify no plaintext in simulated server event storage; reload both browser pages; continue decrypting and chatting; simulate ACK lost after persisting ciphertext, then reload and retry same signed event ID exactly once, no duplicate; click the actual React **send** button and verify decrypted content on sender and receiver DOM.
- `npm --prefix frontend run check:e2ee-poc` — other actual MLS crypto, removal, transport signature and state-reload tests on Chromium/Node.
- `npm --prefix frontend run build` and `npm --prefix frontend run test:unit` (82 tests), `go -C backend test -count=1 ./...`, `go -C backend vet ./cmd/chat ./cmd/auth ./internal/database`, plus scoped ESLint: PASS.
- Isolated real PostgreSQL 16 + Redis 7 integration tests: `TestE2EEDeviceDirectoryIntegration`, `TestE2EEKeyPackageExchangeIntegration`, `TestMLSRelayThreeAccountsIntegration`: PASS including the new double-consent and atomic direct bootstrap. Disposable test containers were removed.

### Test instructions after deployment

1. Deploy frontend plus chat and auth backend code to a controlled testing environment using the same commit. Set **`CHATNET_E2EE_EXPERIMENTAL=1` on BOTH chat and auth services**. Check both deployments and schema migration 015 are healthy before changing the variable. Leave disabled in general production if real users would be affected.
2. Use **two disposable test accounts**, one active E2EE device per account, two independent desktop browsers/profiles. Open their direct chat, press **Chuẩn bị khóa thiết bị** on each device. Browser WebCrypto/IndexedDB must be available.
3. Compare the full displayed **mã an toàn** through a trusted **out-of-band** channel, not via the same unverified conversation. Only after checking, each user clicks **Tôi đã đối chiếu mã an toàn**.
4. Each user clicks **Tôi đồng ý dùng E2EE**; only when both approvals are present can either user click **Bắt đầu hội thoại E2EE**. This is a one-way pilot conversion; **do not perform it in an important existing chat**.
5. Send short text from both clients in the separate purple E2EE composer, wait for receive (4-second polling), refresh browsers and verify local history and new messages. Backend stores only opaque MLS event bytes after cutover; pre-cutover history remains in the original plaintext table.
6. Never test with sensitive information: library is not independently audited and pilot is not ready for production. Browser storage reset, new login on another browser, device loss, member revocation/rekey, and attachments may cause inaccessible messages because they are not supported.

### Remaining blockers to E2EE-by-default

- One device per user, no group MLS membership management, no MLS rekey on member/peer device removal, no secure recovery/transfer of MLS state and messages between devices; the underlying `ts-mls@1.6.4` is not independently audited.
- No E2EE media or file keys, audio/video attachments, no server-free translation integration and no encrypted realtime push notifications; UI uses polling.
- No production-ready safety-number/key-transparency infrastructure, cross-device user onboarding, threat-model signoff, full account management/backup semantics, Safari/iOS PWA interoperability, production server e2e smoke with real accounts.
- Do NOT automatically turn on `CHATNET_E2EE_EXPERIMENTAL` as a product default. Only expand after these are resolved, verified and security reviewed.

## 7. Sequence, migration, gates

1. Do not push/deploy this primary checkout until the POC, protocol contract, isolated integration tests and security review pass; keep current chat behavior unchanged.
2. Land additive auth/device/schema APIs behind `CHATNET_E2EE_EXPERIMENTAL=0` (default). A separate conversation-scoped E2EE flag is still required for encrypted messages.
3. Land MLS JS/WASM core with cross-browser key lifecycle and identity verification tests.
4. Enable encrypted direct chat for isolated test accounts; implement file and translation integration; complete group flows.
5. Migrate eligible conversations with explicit client compatibility and user education; legacy content remains labeled and separable.
6. Expand slowly only after automated tests, browser/device UAT, independent audit and a rollback plan which **never** converts E2EE chats back to plaintext.

## 8. Verification matrix

- Unit: crypto file round-trip, multi-chunk, tampered body, wrong key, wrong AAD, truncated/extra bytes, nonce format, empty file; Go auth/DB/member tests.
- Integration: two accounts, three devices, revoked device, removed member, new device/Welcome, offline/out-of-order events, retry, sender identity/key substitution attempt, encrypted S3 range.
- Privacy: server/DB/Redis/S3/push/logs contain only ciphertext or explicitly permitted metadata. Translation service receives plaintext **only** after individual opt-in; consent can be revoked.
- Operations: web lint/build/architecture/units, Go test with isolated DB/Redis, Safari iOS PWA and Chrome browser QA, independent security review.

Reference specifications:
- https://www.rfc-editor.org/rfc/rfc9420.html
- https://www.rfc-editor.org/rfc/rfc9750.html
- https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams
