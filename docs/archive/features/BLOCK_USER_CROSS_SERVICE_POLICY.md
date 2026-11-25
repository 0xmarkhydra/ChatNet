# Block user — cross-service policy and acceptance matrix

Source of truth: `user_blocks(blocker_id, blocked_id)` in PostgreSQL. A block is **directional as a record**, but **symmetric for communication and content visibility**: either A→B or B→A makes the pair blocked. A block is effective for existing content (not only future writes), until the blocker unblocks. Content is **never deleted** merely because two members block each other.

## Policy matrix

| Surface | A (blocks B) | B (blocked by A) | Unrelated C | Backend enforcement |
| --- | --- | --- | --- | --- |
| Discovery, nearby, friendships, direct chat | Hide/deny B; remove friendship; deny direct send/read/shared links | Same for A | Normal | Chat service `user_blocks`, direct-conversation checks |
| Group membership | Keep memberships and role/administrative rights | Keep memberships | Unchanged | Group membership table, independent from blocks |
| Group message history, media, links, replies | No B-authored messages or attachments/reply preview | No A-authored messages or attachments/reply preview | Sees messages from **both A and B** | Filter in SQL **before LIMIT/cursor**; restrict signed attachment access |
| Group conversation preview, unread and read markers | Last visible message/unread exclude B; read cursor advances to last visible message | Exclude A | Includes A and B | SQL aggregates and authorized mark-read per authenticated viewer |
| Group SSE events and message push | No payload/notification from B | No payload/notification from A | Receives both | Filter recipients prior to publish; recheck SSE payload on delivery |
| React/PWA cached content after block/unblock | Refresh chat, conversations, feed, stories; clear old group messages immediately | Same on received privacy event | Normal | `privacy.updated` event, authenticated re-fetch |
| Feed post, story, saved item | Cannot view B's posts/stories or interact with B's posts | Same for A | Sees A and B's permitted public/friend posts | `feedAccessSQL`, stories SQL, feed read/interaction authorization |
| Feed comments and reply target | B's comments hidden; cannot reply to a B comment | Same for A | Sees both | Comments SELECT and parent/target checks |
| Direct audio/video call | Cannot start or obtain new call credentials to B | Same for A | Not impacted | Call membership and current calls checks |
| Group audio/video call | Does not invite B when A starts a call; cannot newly join a LiveKit room with a blocked peer already joined | Same | Can still be invited/participate | Call invite filtering and serialised blocked-joined check |
| Unblock by A | Original group messages/feed content can reappear | Same | Unchanged | DELETE `user_blocks`; do not delete history |

For non-blocking members, existing visibility rules (friends/private/public feed, group membership, moderator permissions) **still apply**. This policy is not a bypass for resource access. Return privacy-safe 403/404 for forbidden detail or mutation endpoints and suppress realtime/push on DB error. Moderators retain separately authorized moderation evidence.

### Known boundary / operational risk

LiveKit credentials already issued **before** a block are bearer tokens valid for up to 5 minutes. The new service-side guards prevent fresh join credentials, but this change **does not retroactively revoke an existing LiveKit media connection or already-issued token**. Fully instantaneous call teardown/revocation requires a service-to-service block event plus LiveKit room/participant eviction and reconciliation; do not represent it as complete until exercised on a real LiveKit deployment. Already downloaded files and push notifications delivered before blocking likewise cannot be clawed back. Group conversation member listings and aggregate like counts are not intended to hide historical participant identities or aggregate engagement counts.

### Acceptance / reproducible checks

1. Create A, B, C as group members; write A, B, C messages, including B's link/media. Establish A→B block.
2. As A, history/shared/preview/unread/SSE/push must not contain B's message or attachment. Repeat as B for A; **as C all three messages remain visible**.
3. Confirm reactions to blocked messages and hidden reply targets are denied. Test before/after cursors and a blocked message as the newest item.
4. Check existing direct chat and call resource access from both accounts; verify 403/404, never a newly minted LiveKit token to blocked peer.
5. As A/B, feed lists, detail, stories and comments hide the opposite author; create/comment/like/save/reply attempts must be denied. C retains authorized content.
6. Unblock and verify historical records become visible again; confirm no row deletions occurred.
7. Disconnect/reconnect SSE, switch tabs and reload PWA; confirm local cached content is refreshed on `privacy.updated`.
8. Test with isolated PostgreSQL and Redis, not shared production databases: `CHATNET_TEST_DATABASE_URL`, `CHATNET_TEST_REDIS_ADDR`, then `go -C backend test ./cmd/chat ./cmd/feed ./cmd/call`. Run `npm --prefix frontend run build`. LiveKit revocation and actual notification delivery require separate end-to-end infrastructure.

Change review must include PostgreSQL query plans on busy accounts and a LiveKit revocation follow-up before claiming zero-time enforcement for ongoing calls. No schema migration needed: the existing `user_blocks` primary key/index and reverse index cover both directions.
