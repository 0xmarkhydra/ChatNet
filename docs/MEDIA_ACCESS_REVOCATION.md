# P0 – Media download access revocation

## Scope

Chat message attachments are no longer returned as S3 presigned GET URLs. The backend returns a signed **per-viewer** /api/media/chat/{id} URL. A GET or Range request validates that ticket and verifies current PostgreSQL group membership, sender block relationships, direct-chat block relationships, and message recall state before fetching from S3. All content is streamed without revealing the upstream S3 URL. Responses use Cache-Control: private, no-store.

A ticket expires in one hour, but its holder loses access **immediately for new requests** after group removal, leaving, blocking, or message recall. A download already in progress cannot have transferred bytes recalled. Legacy S3 URLs issued before this rollout are not revocable by ChatNet and may remain valid for up to their original expiry (normally one hour). Storage must remain private; public S3 bucket/object ACLs defeat this access policy.

Chat upload presign tickets no longer return a raw S3 GET URL. The browser uses a local blob URL for unsent preview; only persisted message attachments receive gateway URLs. Feed, story and profile paths continue using their existing policies.

## Configuration

- `MEDIA_PUBLIC_ORIGIN`: trusted external origin for the gateway. Docker Compose defaults to `http://localhost:8080`; on other deployments set it explicitly to the public API origin. The backend fallback is `https://api-chat.codelocal.cloud`. Do not use an arbitrary Host header to generate these URLs.
- `MEDIA_ORPHAN_CLEANUP_ENABLED`: `true` enables S3 orphan sweeping; defaults to `false` to protect existing deployments until object-store list/delete permissions and backups are verified.
- Sweeping runs every 12 hours, checks the `chatnet/chat/` prefix, retains objects for at least seven days, and deletes only objects with **no** reference in `message_attachments`. On PostgreSQL errors, cleanup aborts without deleting anything. Other media scopes are untouched.
- The S3 IAM user requires GetObject for reads and (only if cleanup enabled) ListBucket on chat prefix plus DeleteObject on chat objects. Keep S3 bucket private.

## Verification

`go -C backend test ./...`; `npm --prefix frontend run build`; `git diff --check`.

Run functional QA against a configured private S3 and isolated PostgreSQL/Redis: A and B exchange media, B keeps gateway URL, A blocks B => B's saved gateway URL must return 403; unblock and create fresh link => 200. Repeat removing/leaving groups, message recall, S3 Range GET, valid/expired/tampered links and cross-account URL replay. Verify orphan retention over seven days before enabling deletes, and check logs for S3 IAM failures.

**Important:** gateway URLs are still bearer capabilities: someone who obtains an eligible viewer's ticket can use it while that viewer remains authorized, until expiry. Never expose it in analytics, logs or link previews. Full device-bound authentication for raw img/video elements needs a session-aware CDN/media architecture.
