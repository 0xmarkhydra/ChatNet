# ChatNet / SocCo — Agent 2 handoff (2026-10-19)

**Owner:** Agent 2 · Messaging / Realtime / Media · Web/PWA only
**Working branch:** `feat/chatnet-a2-messaging-media` (worktree `.worktrees/chatnet-a2-messaging-media`)
**Base:** `main` at `182da27`
**Integration:** `dev` now exists locally and as `origin/dev` as rechecked on 2026-10-19. Integration Owner (Agent 5) owns the review/merge; Agent 2 does **not** merge into `dev` or `main`.
**Release:** Not approved. Do not claim Agent 2 is 100% complete.

## What changed in this batch

- **CHAT-01 P0 / idempotency**: PostgreSQL `messages.client_id` is nullable (legacy clients remain compatible), with unique partial index on `(user_id, client_id)`. `POST /api/conversations/{id}/messages` atomically deduplicates concurrent retries. Original creates HTTP 201; matching retry returns existing persisted message with HTTP 200; reuse of a client ID with different content, conversation, reply or attachment refs returns HTTP 409. Only newly inserted messages publish realtime/push events.
- Message-history and single-message loading now expose the stored `clientId` for reconciliation across tabs/devices.
- React preserves an ambiguous request's `clientId` while the same session, conversation and unsent draft payload remain active, so a manual resend after lost HTTP ACK reuses the original idempotency key. It is cleared on confirmed HTTP/SSE receipt or terminal 4xx. **Limitation:** retry metadata lives in memory, not across page reload; do not advertise durable offline queue or full reconnect guarantee.
- **CHAT-03 P0 / read cursor**: marking a conversation as read uses `GREATEST(last_read_message_id, new_id)` so an older racing request cannot move the DB cursor backward. Response and event return the updated cursor.
- Test fixture repair: an older search integration test issued a token with `userId=0`, rejected by auth middleware; fixture now creates a real viewer account. This test-only cross-boundary edit should be reviewed by Agent 1.

## API/schema contract for Agent 5

- `POST /api/conversations/{id}/messages`: same request JSON; optional `clientId` must be at most 64 ASCII alphanumeric/hyphen characters. Empty/missing client IDs remain non-idempotent for older clients. UUID from frontend enables dedupe. The idempotency key is scoped to the sending user globally, so reusing one ID in another conversation intentionally yields 409.
- `GET /api/conversations/{id}/messages` and message-updated responses include `clientId` when the row has one.
- Deployment ordering: run `database.Migrate` / `schema.sql` against PostgreSQL before serving changed Chat API. Migration is additive: `client_id VARCHAR(64)` and `idx_messages_sender_client_id`. Existing rows keep NULL.
- React assumes HTTP 200 on replay is success. SSE should publish a single create event. No merge or deployment of frontend alone before compatible backend/database.
- **Batch 4 migration required:** add nullable `messages.request_fingerprint CHAR(64)` before deploying updated Chat API. New messages with `clientId` store a SHA-256 fingerprint of the original conversation ID, normalized text, reply ID and ordered storage refs. For these rows, retries succeed even after edit/recall; a different request returns 409. Rows created before the migration retain a NULL fingerprint and use legacy comparison.

## Verification evidence

| Check | Result |
|---|---|
| Go `go test ./...` from isolated Agent 2 worktree | PASS |
| Go `CHATNET_TEST_DATABASE_URL=... CHATNET_TEST_REDIS_ADDR=... go test -count=1 ./cmd/chat` | PASS with separate local Docker PostgreSQL 17 and Redis 7.4 |
| Real integration with 3 DB accounts A/B/C | PASS: A POST, B receives actual Redis event, C GET conversation history returns 403, lost-ACK replay returns same message ID, conflicting key 409, parallel POSTs persist exactly one row |
| React `npm run build` (TypeScript + Vite) | PASS; existing >500 kB chunk warning |
| Frontend `npm run check:optimistic` and `npm run check:session` | PASS |
| `git diff --check` | PASS before commit |
| Live user browsers/iPhone Safari/PWA and real S3 upload | NOT RUN |
| Network throttling, refresh during ambiguous send, multi-device UI E2E | NOT RUN |

## Scope audit / remaining work

| IDs | Classification and next action |
|---|---|
| CHAT-01 | Improved, **partial P0**: database/SSE/API concurrency tested; implement durable pending-send recovery on refresh and real network chaos E2E |
| CHAT-02 | Existing send/receipt UI; not fully verified across devices or error state |
| CHAT-03 | Read monotonicity fixed; unread/order must still get multi-device E2E |
| CHAT-04..CHAT-07 | Existing handler/UI pathways; must audit edit/recall/reply, pagination/scroll, iPhone keyboard and authorization in browsers |
| CHAT-08..CHAT-12 and CHAT-14..CHAT-23 | P1/broader features from master backlog; not accepted in this batch, inspect/implement per priority |
| CHAT-13 | P2, deferred until approval |
| MEDIA-01..MEDIA-04 | P0; validate S3 upload lifecycle, signed-read access authorization, shared media pagination and deny/expired-user cases in real tests |
| MEDIA-05..MEDIA-07 | P1; multi-upload, voice playback/recording, retention and revoke behavior pending |
| Notification sounds/push | Agent 5 interface, no changes in this batch |
| Group/Call/Gemini | Agent 4/Agent 3 ownership, no changes in this batch |

## Batch 2 — draft/retry and scroll (2026-10-19)

- **CHAT-16 P1 (partial)**: draft **text** now survives a page refresh within the same browser tab and login, scoped to the active account ID in `sessionStorage`. Logs out and cross-account session changes wipe the local draft/pending receipt. Media blobs and signed S3 URLs are intentionally not persisted; attachments must be reselected after reload. No cross-device draft synchronization yet.
- **CHAT-21 / CHAT-01 P0 (improved, still not full E2E)**: ambiguous-send client IDs now survive refresh within the same tab/session for 24 hours and matching retry reuses the original ID. Message history or SSE confirmation recognizes persisted `clientId` and clears a matching text draft. After refresh an unresolved attachment send is not silently resent as text-only. The server DB unique key is authoritative.
- **CHAT-07 P0 (improved)**: message-list scroll only follows new messages while reader is near the bottom, and restores offset after pagination. Real iOS Safari/PWA and independent browser E2E remain outstanding.
- **Automated verification**: `frontend npm run check:chat` validates per-account drafts, expiry, replay keys, malformed/sessionStorage-denied data and logout cleanup; `npm run build` / TypeScript PASS; `git diff --check` PASS. Existing chunk >500kB warning persists.
- **Important limitation:** plain text kept in browser sessionStorage is readable by scripts executing on this origin (like existing localStorage session); it is not an end-to-end encrypted multi-device draft store. Never store access tokens/download URLs there. This increment is not release approval.

## Batch 3 — upload progress and media MIME hardening (2026-10-19)

- **MEDIA-01 P0 (improved)**: browser uses `XMLHttpRequest` to PUT directly to presigned S3 URLs, reports real uploaded bytes (not simulated progress), and exposes **Hủy tải** for the current upload. Network error/HTTP error/timeout/cancel propagate to existing UI notices. A failure aborts sibling parallel uploads; logging out aborts the active transfer.
- **MEDIA-04 P0 (improved)**: Go `mediax.classify` now accepts explicit MIME values for each permitted extension rather than generic `image/*`/`video/*`/any document content type. Rejects SVG disguised as JPEG, HTML disguised as PDF, JavaScript disguised as ZIP and other mismatches. Existing file size, type and ownership checks remain authoritative at backend.
- **Automated verification**: `frontend npm run check:media` covers PUT progress, success, network/HTTP errors, timeout, abort and no bearer token to S3; `npm run build` PASS; `go test ./internal/mediax` PASS with executable-MIME denial/valid format cases.
- **Limitations**: S3 real-environment/CORS/device/browser upload not yet exercised; presigned URLs remain usable until expiration even if membership is revoked; true content/magic-byte validation, quota controls, upload orphan cleanup and retention require additional backend/storage work. No release approval.

## Batch 4 — immutable retry receipts, membership enforcement, visibility-aware read (2026-10-19)

- **CHAT-01 / CHAT-21 P0**: backend stores immutable `request_fingerprint` on original insert when `clientId` is present. An identical replay returns existing message after editing or recalling its content; an unrelated request reusing `clientId` still returns HTTP 409. PostgreSQL/Redis integration test exercises create, single Redis event, A/B/C isolation, lost ACK, edit, recall, and parallel sends. Legacy NULL fingerprints keep old behavior until migrated.
- **SEC-08 / CHAT-04 P0**: `createMessage` locks the sending user's conversation membership transactionally after validating media and before inserting. The edit/recall SQL also requires live membership; removed users cannot mutate historical messages even if they authored them. Dedicated group integration tests remove the member, then assert message send/edit/recall/reaction, history and shared-media access are rejected and the stored message remains unchanged.
- **CHAT-03 P0 (improved)**: background browser tabs/PWAs no longer automatically mark newly received messages read just because the conversation ID remains selected. The frontend only sends receipts when the chat view is visible, and synchronizes unread on focus/visibility restoration; `npm run check:chat` covers visibility predicate.
- **Checks**: isolated PostgreSQL 17 + Redis 7.4 `go test -count=1 ./cmd/chat` PASS; `go test ./...` PASS; React/TypeScript `npm run build` PASS; `npm run check:chat` PASS; `git diff --check` PASS. Existing JS chunk warnings persist.
- **Still outstanding**: live browser focus/background E2E, 3-account multi-device scenarios, S3 revocation/retention, and rest of CHAT/MEDIA P0/P1. This increment is not 100% completion or production approval.

## Batch 5 — Web/PWA voice message capture (2026-10-19)

- **MEDIA-06 P1 (partial)**: new `frontend/src/VoiceRecorder.tsx` adds an accessible 2-minute voice recorder to message composer. Prompts for microphone on a user gesture, supports stop-to-attach vs cancel, displays elapsed time, and releases `MediaStream`/timer on stop, navigation, session change or unmount. A saved recording becomes a real audio `File` and uses the existing authenticated presign + S3 upload path; user explicitly presses **Gửi** after upload. Incoming voice attachments use existing native browser audio controls.
- **Browser compatibility**: chooses Opus/WebM when supported, MP4/M4A on Safari, and Ogg where available. Backend `mediax.classify` allows `voice.webm` with `audio/webm` while preserving video/webm support. Added `frontend npm run check:voice` and Go MIME unit case; TypeScript/Vite build and Go tests PASS.
- **Remaining MEDIA-06 acceptance**: real microphone permissions denied/granted and recording/audio playback on Chrome, Firefox, Safari and installed iOS PWA; waveform and duration metadata in persisted message; interrupted-upload retry. This feature is **not** marked 100% accepted based solely on build/unit tests.

## Integration warnings

1. The root checkout has substantial uncommitted work in unrelated areas; none of those changes were modified here.
2. This worktree was created from tracked `main`, because the master backlog markdown currently appears as **untracked content in the root checkout**. Integration Owner must separately preserve/version that source backlog.
3. Coordinate with Agent 1 on the viewer fixture adjustment; no production Identity API logic was changed.
4. Do not label full Agent 2 100% until all P0/P1 tests and live device/multiuser scenarios have documented evidence, and the branch passes review/merge gates.
