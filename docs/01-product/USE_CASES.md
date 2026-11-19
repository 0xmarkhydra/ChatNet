---
document_id: UC-CHATNET-001
title: ChatNet Core Use Cases
version: 1.0.0
status: Draft
owner: Product and Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: ISO/IEC/IEEE 29148:2018
---

# ChatNet Core Use Cases

## Tóm tắt

Mỗi kịch bản chỉ áp cho tác nhân có quyền và môi trường cấu hình phù hợp. Với media, call và Marketplace, luôn kiểm nhánh thất bại cùng luồng chính. Liên kết yêu cầu và ca nghiệm thu ở [ma trận](../07-quality/TRACEABILITY_MATRIX.md).

## UC-01 — Register and verify an account

**Primary actor:** Visitor\
**Preconditions:** Registration is enabled and email delivery is configured.\
**Main flow:**
1. Visitor submits registration details.
2. Client calls the registration-start endpoint.
3. Auth service validates input and issues the verification workflow.
4. Visitor submits the verification code.
5. Auth service validates the code and creates/activates the account.
6. Client receives the resulting authenticated session when the workflow succeeds.

**Alternative / failure:** Invalid or expired code, rate limit, email provider unavailable, duplicate identity or malformed payload. The client MUST show the server outcome and MUST NOT invent a successful session.

**Source:** backend/cmd/auth/main.go, registration routes.

## UC-02 — Start a direct conversation and exchange messages

**Primary actors:** Authenticated users A and B\
**Preconditions:** Both accounts are valid; privacy and block policy permit the interaction.\
**Main flow:**
1. A discovers or selects B.
2. Client requests a direct conversation.
3. Chat service checks policy and membership.
4. A sends a message.
5. Chat service persists the message and emits realtime events.
6. B receives the message and advances read state when appropriate.

**Alternative / failure:** User blocked, invalid membership, offline client, duplicate submission, upload failure, or authorization failure.

**Source:** backend/cmd/chat/main.go, conversation and message handlers.

## UC-03 — Create and administer a group

**Primary actor:** Authenticated group creator / administrator\
**Preconditions:** Caller is authorized to create or administer the group.\
**Main flow:**
1. Caller creates a group conversation.
2. Caller invites or adds members.
3. Service persists membership and role state.
4. Administrators update group settings, channels, notification preferences and governance state.
5. Members read messages and group activity subject to membership and policy.

**Alternative / failure:** Insufficient role, invalid invite, rejected join request, blocked peer policy or stale membership.

**Source:** Chat service group, channel, invite, join-request and admin-audit routes.

## UC-04 — Upload and retrieve conversation media

**Primary actors:** Authenticated sender and recipient\
**Preconditions:** Sender has access to the conversation and an authorized upload path is configured.\
**Main flow:**
1. Client requests an upload capability/presigned URL.
2. Backend validates the request and produces a scoped capability.
3. Client uploads the object to the configured object store or uses the supported relay path.
4. Message/attachment metadata is persisted.
5. Recipient requests media through an authorized route.
6. Backend checks current access policy before serving or authorizing retrieval.

**Alternative / failure:** Expired signature, invalid MIME/size, lost membership, block/recall, object missing or storage unavailable.

**Source:** Chat service media presign/relay/serve routes and backend/internal/objectstore.

## UC-05 — Publish a social post and interact

**Primary actor:** Authenticated user\
**Preconditions:** Account is permitted to use the feed.\
**Main flow:**
1. User creates a post with optional attachments.
2. Feed service validates and persists the post.
3. Other users retrieve visible feed items.
4. Users react, comment, save or report content.
5. Moderators review eligible reports.

**Alternative / failure:** Visibility policy, ownership mismatch, moderation state, invalid attachment or rate limit.

**Source:** Feed service routes and schema tables for posts, comments, reactions, attachments and reports.

## UC-06 — Start and join a call

**Primary actors:** Caller and invited participants\
**Preconditions:** Caller is authenticated; conversation and participant policy permits the call; LiveKit configuration is available.\
**Main flow:**
1. Caller creates a call.
2. Service stores call and participant state.
3. Participant retrieves current call information and joins.
4. Server issues a scoped LiveKit credential after authorization.
5. Participants leave or the host ends the call.

**Alternative / failure:** Block policy, expired session, room unavailable, permission denied, participant already left or provider unavailable.

**Source:** backend/cmd/call/main.go.

## UC-07 — Enable call translation with consent

**Primary actor:** Authenticated call participant\
**Preconditions:** Call is active and translation provider configuration is available.\
**Main flow:**
1. Participant requests call translation.
2. Service identifies participants whose audio would be processed.
3. Each affected participant is asked to consent.
4. Service creates a translation session only when the required consent state is satisfied.
5. Client receives translated text/audio according to the supported workflow.
6. The service periodically rechecks consent on an active stream. See the [withdrawal gap](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md#4-consent-requirements). Do not assume instant stop.

**Alternative / failure:** Participant declines, withdraws consent, leaves, reconnects, provider fails or call ends.

**Source:** Call translation consent/session/stream routes and the historical server-only provider integration note. Real multi-device adversarial acceptance remains a separate QA gate.

## UC-08 — Use the desktop native shell

**Primary actor:** Desktop user\
**Preconditions:** Packaged Electron app is installed and its renderer is trusted.\
**Main flow:**
1. Electron Main creates the application window and secure app protocol.
2. Preload exposes a limited bridge to the renderer.
3. Renderer requests native auth, notification, media permission or screen-capture operations through the bridge.
4. Main validates trusted origin and operation scope before executing native behavior.

**Alternative / failure:** Untrusted frame, denied OS permission, unavailable secure storage, renderer crash or invalid IPC payload.

**Source:** desktop/src/main.cjs, preload.cjs, ipc-policy.cjs and related native modules.

## UC-09 — Browse marketplace foundation

**Primary actors:** Seller and buyer\
**Preconditions:** Authenticated accounts; marketplace endpoints are available.\
**Main flow:**
1. Seller creates a product draft.
2. Seller publishes the draft.
3. Buyer lists published products and updates a cart.
4. Buyer submits checkout with an idempotency key.
5. Backend creates or returns an order in its configured pending-payment state.

**Limitations:** Current schema constrains new orders to awaiting_payment_configuration. This use case does not imply payment collection, shipment, seller order fulfillment or refund processing.

**Source:** backend/cmd/feed/marketplace.go and marketplace tables in schema.sql.

## UC-10 — Proposed distributed media recovery

**Status:** Proposed; not implemented in this source baseline.\
**Actors:** Media owner, recipient, optional storage-node provider and recovery coordinator.\
**Rule:** No production object deletion, storage-node enrollment, paid recovery or reward settlement is authorized by the proposal alone.

**Source:** Restored distributed-media proposal under docs/distributed-media-storage/.

## Truy vết kịch bản

Các liên kết dưới đây dẫn đến yêu cầu đại diện và ca kiểm liên quan. Chúng không khẳng định toàn bộ bước của use case đã được nghiệm thu. Xem các checkpoint liên kết từ [ma trận](../07-quality/TRACEABILITY_MATRIX.md) cho từng yêu cầu.

| Use case | Yêu cầu liên quan | Ca kiểm liên quan |
|---|---|---|
| UC-01 | [REQ-AUTH-001](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-001), [REQ-AUTH-005](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-005) | [TC-AUTH-001](../07-quality/ACCEPTANCE_CASES.md#tc-auth-001) |
| UC-02 | [REQ-CHAT-001](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-001), [REQ-CHAT-003](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-003), [NFR-REL-001](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-rel-001) | [TC-CHAT-001](../07-quality/ACCEPTANCE_CASES.md#tc-chat-001), [TC-REL-001](../07-quality/ACCEPTANCE_CASES.md#tc-rel-001) |
| UC-03 | [REQ-CHAT-002](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-002), [REQ-CHAT-008](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-008) | [TC-CHAT-001](../07-quality/ACCEPTANCE_CASES.md#tc-chat-001) |
| UC-04 | [NFR-PRIV-001](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-priv-001) | [TC-MEDIA-001](../07-quality/ACCEPTANCE_CASES.md#tc-media-001) |
| UC-05 | [REQ-FEED-001](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-001), [REQ-FEED-005](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-005), [REQ-FEED-004](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-004) | [TC-FEED-001](../07-quality/ACCEPTANCE_CASES.md#tc-feed-001) |
| UC-06 | [REQ-CALL-001](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-call-001), [REQ-CALL-002](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-call-002) | [TC-CALL-001](../07-quality/ACCEPTANCE_CASES.md#tc-call-001) |
| UC-07 | [REQ-CALL-003](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-call-003), [REQ-CALL-004](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-call-004) | [TC-CALL-001](../07-quality/ACCEPTANCE_CASES.md#tc-call-001) |
| UC-08 | [NFR-PLAT-001](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-plat-001) | [TC-DESK-001](../07-quality/ACCEPTANCE_CASES.md#tc-desk-001) |
| UC-09 | [REQ-MKT-001](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-mkt-001), [REQ-MKT-006](SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-mkt-006) | [TC-MKT-001](../07-quality/ACCEPTANCE_CASES.md#tc-mkt-001) |
| UC-10 | Ngoài baseline sản phẩm. [Đặc tả và QA riêng](../distributed-media-storage/README.md). | Không có ca nghiệm thu sản phẩm ở baseline này. |

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
