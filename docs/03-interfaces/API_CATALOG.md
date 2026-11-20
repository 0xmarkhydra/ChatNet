---
document_id: API-CAT-001
title: ChatNet HTTP API Catalog
version: 1.2.0
status: Draft
owner: Backend Engineering
baseline_commit: 05a3caab51b55cc5393c8f47fee625fc1eaaa19d
last_updated: 2026-11-21
normative_basis: OpenAPI Specification 3.2.1; IETF RFC 9110
---

# ChatNet HTTP API Catalog

## Tóm tắt

Tra method và path theo dịch vụ. Khai báo route không xác nhận quyền, availability hay schema. Những thao tác đã đối chiếu tới phản hồi được ghi trong OpenAPI giới hạn.

## 1. Purpose and contract status

This catalog is derived from Go ServeMux registrations in the committed source baseline. It records route patterns and owning services; it is not a complete OpenAPI contract. Request schemas, response schemas, status-code matrices, authorization rules and examples still require handler-level extraction and validation.

[OpenAPI 3.2.1](openapi.json) đặc tả 21 thao tác đã đối chiếu tới handler và kiểm kê 163 thao tác còn lại. Route gắn `route-inventory` chưa có schema, mã trạng thái hoặc yêu cầu xác thực đã đối chiếu. Route trong bảng không đồng nghĩa đã xác nhận đầy đủ schema hay quyền. Xem [danh mục lỗi](ERROR_CATALOG.md).

## 2. Public API routing

The Gateway routes these path families:

| Public path | Destination |
|---|---|
| /api/auth/ | Auth |
| /api/messages, /api/messages/ | Chat |
| /api/events | Chat |
| /api/push/ | Chat |
| /api/media/ | Chat |
| /api/profile, /api/profile/ | Chat |
| /api/users/ | Chat |
| /api/friends, /api/friends/ | Chat |
| /api/contacts, /api/contacts/ | Chat |
| /api/privacy | Chat |
| /api/preferences, /api/preferences/ | Chat |
| /api/conversation-categories, /api/conversation-categories/ | Chat |
| /api/conversations, /api/conversations/ | Chat |
| /api/group-invites/ | Chat |
| /api/groups/ | Chat |
| /api/chat/ | Chat |
| /api/calls, /api/calls/ | Call |
| /api/translate | Translation |
| /api/i18n/ | Translation |
| /api/posts, /api/posts/ | Feed |
| /api/feed/ | Feed |
| /api/stories, /api/stories/ | Feed |
| /api/marketplace/ | Feed |
| /__chatnet_copy_image | Gateway media helper |

Gateway cũng phục vụ SPA fallback cho các path ngoài API trong cấu hình có static assets. Endpoint health được xử lý tại Gateway, không chuyển tiếp nguyên response từ một service.

| Method | Path | Nơi xử lý |
|---|---|---|
| GET | /api/health | [Gateway](../../backend/cmd/gateway/main.go) tổng hợp health của năm service upstream |

## 3. Auth service

Source: backend/cmd/auth/main.go

| Method | Path | Handler purpose |
|---|---|---|
| GET | /health | Service health |
| POST | /api/auth/register/start | Start registration |
| POST | /api/auth/register/verify | Verify registration |
| POST | /api/auth/register/resend | Resend verification |
| POST | /api/auth/email/start | Email registration alias |
| POST | /api/auth/email/verify | Email verification alias |
| POST | /api/auth/email/resend | Email resend alias |
| POST | /api/auth/login | Login |
| POST | /api/auth/refresh | Refresh session |
| POST | /api/auth/logout | Logout |
| POST | /api/auth/sessions/list | List managed sessions |
| POST | /api/auth/sessions/revoke | Revoke a session |
| POST | /api/auth/sessions/revoke-others | Revoke other sessions |
| GET | /api/auth/me | Current user |
| GET | /api/auth/session/status | Current session status |
| POST | /api/auth/e2ee/challenge | Create E2EE challenge |
| POST | /api/auth/e2ee/devices | Register E2EE device |
| GET | /api/auth/e2ee/devices | List E2EE devices |
| GET | /api/auth/e2ee/users/{userId}/devices | List a user's E2EE devices |
| POST | /api/auth/e2ee/devices/{deviceId}/revoke | Revoke E2EE device |
| POST | /api/auth/e2ee/key-packages | Publish key package |
| POST | /api/auth/e2ee/key-packages/claim | Claim key package |

## 4. Chat service

Source: backend/cmd/chat/main.go

### 4.1 Push and media

| Method | Path |
|---|---|
| GET | /api/push/config |
| POST | /api/push/subscription |
| DELETE | /api/push/subscription |
| POST | /api/push/test |
| POST | /api/media/presign |
| PUT | /api/media/relay |
| GET | /api/media/chat/{id} |

### 4.2 Profile, discovery, contacts and privacy

| Method | Path |
|---|---|
| GET | /api/users/{username}/profile |
| GET | /api/profile |
| PUT | /api/profile |
| PUT | /api/profile/media |
| GET | /api/profile/note |
| POST | /api/profile/note |
| DELETE | /api/profile/note |
| GET | /api/users/{username}/note |
| GET | /api/users/{username}/avatar |
| GET | /api/users/{username}/cover |
| GET | /api/users/search |
| GET | /api/users/suggestions |
| POST | /api/users/nearby |
| DELETE | /api/users/nearby |
| GET | /api/friends |
| GET | /api/friends/requests |
| POST | /api/friends/{id} |
| POST | /api/friends/{id}/accept |
| DELETE | /api/friends/{id} |
| GET | /api/contacts |
| PUT | /api/contacts/{id} |
| GET | /api/privacy |
| PUT | /api/privacy |
| GET | /api/users/blocked |
| POST | /api/users/{id}/block |
| DELETE | /api/users/{id}/block |
| POST | /api/users/{id}/report |

### 4.3 Preferences and conversation categories

| Method | Path |
|---|---|
| GET | /api/preferences |
| PUT | /api/preferences |
| GET | /api/preferences/translation |
| PUT | /api/preferences/translation |
| GET | /api/conversation-categories |
| POST | /api/conversation-categories |
| PUT | /api/conversation-categories/{categoryId} |
| DELETE | /api/conversation-categories/{categoryId} |
| PUT | /api/conversations/{id}/category |

### 4.4 Conversations and messaging

| Method | Path |
|---|---|
| GET | /api/link-preview |
| GET | /api/conversations |
| POST | /api/conversations/direct |
| POST | /api/conversations/groups |
| GET | /api/conversations/memberships |
| GET | /api/conversations/unread |
| GET | /api/conversations/{id}/messages |
| POST | /api/conversations/{id}/messages |
| POST | /api/conversations/{id}/read |
| DELETE | /api/conversations/{id}/history |
| GET | /api/conversations/{id}/shared |
| PATCH | /api/messages/{id} |
| DELETE | /api/messages/{id} |
| POST | /api/messages/{id}/reactions |
| GET | /api/messages/{id}/reactions |
| PUT | /api/messages/{id}/pin |
| DELETE | /api/messages/{id}/pin |
| PUT | /api/conversations/{id}/pin |
| DELETE | /api/conversations/{id}/pin |
| GET | /api/conversations/{id}/pins |
| GET | /api/chat/search |

### 4.5 Groups, communities and channels

| Method | Path |
|---|---|
| GET | /api/groups/public |
| POST | /api/groups/{id}/join |
| GET | /api/conversations/{id}/community |
| PATCH | /api/conversations/{id}/community |
| PATCH | /api/conversations/{id} |
| GET | /api/conversations/{id}/members |
| POST | /api/conversations/{id}/members |
| PATCH | /api/conversations/{id}/members/{userId} |
| DELETE | /api/conversations/{id}/members/{userId} |
| GET | /api/conversations/{id}/group-settings |
| PATCH | /api/conversations/{id}/group-settings |
| GET | /api/conversations/{id}/notification-settings |
| PUT | /api/conversations/{id}/notification-settings |
| GET | /api/conversations/{id}/avatar |
| PUT | /api/conversations/{id}/avatar |
| GET | /api/conversations/{id}/channels |
| POST | /api/conversations/{id}/channels |
| POST | /api/conversations/{id}/channel-read |
| PATCH | /api/conversations/{id}/channels/{channelId} |
| DELETE | /api/conversations/{id}/channels/{channelId} |
| GET | /api/conversations/{id}/channels/{channelId}/notifications |
| PUT | /api/conversations/{id}/channels/{channelId}/notifications |
| GET | /api/conversations/{id}/channels/{channelId}/avatar |
| PUT | /api/conversations/{id}/channels/{channelId}/avatar |
| GET | /api/conversations/{id}/activities |
| POST | /api/conversations/{id}/activities |
| POST | /api/conversations/{id}/activities/{activityId}/vote |
| PUT | /api/conversations/{id}/activities/{activityId}/pin |
| DELETE | /api/conversations/{id}/activities/{activityId}/pin |
| POST | /api/conversations/{id}/invites |
| GET | /api/conversations/{id}/invites |
| DELETE | /api/conversations/{id}/invites/{inviteId} |
| GET | /api/group-invites/{token} |
| POST | /api/group-invites/{token}/join |
| GET | /api/conversations/{id}/join-requests |
| POST | /api/conversations/{id}/join-requests/{requestId} |
| GET | /api/conversations/{id}/admin-audit |

### 4.6 Chat E2EE pilot and realtime

| Method | Path |
|---|---|
| GET | /api/conversations/{id}/e2ee/status |
| GET | /api/conversations/{id}/e2ee/events |
| GET | /api/conversations/{id}/e2ee/consents |
| POST | /api/conversations/{id}/e2ee/consents |
| POST | /api/conversations/{id}/e2ee/bootstrap |
| POST | /api/conversations/{id}/e2ee/events |
| GET | /api/events |

## 5. Call service

Source: backend/cmd/call/main.go

| Method | Path |
|---|---|
| GET | /health |
| POST | /api/calls |
| GET | /api/calls/current |
| GET | /api/calls/history |
| GET | /api/calls/{id} |
| GET | /api/calls/{id}/participants |
| POST | /api/calls/{id}/join |
| POST | /api/calls/{id}/decline |
| POST | /api/calls/{id}/leave |
| POST | /api/calls/{id}/end |
| GET | /api/calls/translation/languages |
| GET | /api/calls/{id}/translation-consent |
| POST | /api/calls/{id}/translation-consent |
| POST | /api/calls/{id}/translation-session |
| GET | /api/calls/{id}/translation-stream |
| POST | /api/calls/{id}/e2ee/public-key |
| GET | /api/calls/{id}/e2ee/public-keys |
| POST | /api/calls/{id}/e2ee/envelopes |
| GET | /api/calls/{id}/e2ee/envelope |

The translation-stream route upgrades to WebSocket in the handler; it is not an SSE stream despite the route name.

## 6. Feed service

Source: backend/cmd/feed/main.go

| Method | Path |
|---|---|
| GET | /health |
| GET | /api/posts |
| POST | /api/posts |
| GET | /api/posts/{id} |
| PATCH | /api/posts/{id} |
| DELETE | /api/posts/{id} |
| POST | /api/posts/{id}/save |
| POST | /api/posts/{id}/like |
| POST | /api/posts/{id}/reactions |
| GET | /api/posts/{id}/reactions |
| POST | /api/posts/{id}/repost |
| DELETE | /api/posts/{id}/repost |
| POST | /api/posts/{id}/comments |
| PATCH | /api/posts/{id}/comments/{commentId} |
| DELETE | /api/posts/{id}/comments/{commentId} |
| PUT | /api/posts/{id}/comments/{commentId}/like |
| DELETE | /api/posts/{id}/comments/{commentId}/like |
| GET | /api/feed/mentions |
| POST | /api/feed/mentions/{id}/read |
| POST | /api/feed/reports |
| GET | /api/feed/moderation/me |
| GET | /api/feed/moderation/reports |
| PATCH | /api/feed/moderation/reports/{id} |
| GET | /api/stories |
| POST | /api/stories |
| DELETE | /api/stories/{id} |

## 7. Marketplace routes hosted by Feed

Source: backend/cmd/feed/marketplace.go

| Method | Path |
|---|---|
| GET | /api/marketplace/products |
| GET | /api/marketplace/products/mine |
| POST | /api/marketplace/products |
| POST | /api/marketplace/products/{id}/publish |
| GET | /api/marketplace/cart |
| PUT | /api/marketplace/cart/{id} |
| DELETE | /api/marketplace/cart/{id} |
| POST | /api/marketplace/orders |
| GET | /api/marketplace/orders |

All Marketplace routes use bearer JWT middleware, not the active-session check. Checkout creates an order in `awaiting_payment_configuration`. See [Marketplace](../04-backend/MARKETPLACE.md#3-http-operations) for the authentication and idempotency boundaries.

## 8. Translation service

Source: backend/cmd/translate/main.go

| Method | Path |
|---|---|
| GET | /health |
| GET | /health/provider |
| POST | /api/translate |
| POST | /api/i18n/bundle |

## 9. Authentication and route caveats

Most protected routes are registered with CachedSessionMiddleware or Auth middleware. A small number of handlers are registered without that wrapper at the route declaration, including public asset/capability routes and the call translation WebSocket stream. Their handler-level signed capability, ticket, origin and authorization checks MUST be inspected before treating them as public.

The Gateway path map is not the complete security policy. Service handlers and middleware remain authoritative.

## 10. Contract gaps

- OpenAPI mô tả đầy đủ route cho 184 thao tác `/api/*`; 21 thao tác đã đối chiếu handler, 163 thao tác còn ở trạng thái `route-inventory`.
- Request and response schemas are not fully captured in this catalog.
- Error response schemas and status-code guarantees need handler-level verification.
- Pagination, idempotency, rate limits and authorization requirements vary by route.
- Realtime event payloads need a versioned schema.
- The route list MUST be regenerated or reviewed when service registrations change. Run `node scripts/check-api-contract.mjs` in CI.

See [Contract governance](CONTRACT_GOVERNANCE.md) before generating a machine-readable contract.

## Lịch sử thay đổi

- 1.2.0 (2026-11-21) — Đối chiếu 21 thao tác rủi ro cao; đồng bộ 184 route với source; thêm kiểm tra route-to-spec cho CI.
- 1.1.0 (2026-11-19) — Cập nhật trạng thái OpenAPI sang bản kiểm kê route.
- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
