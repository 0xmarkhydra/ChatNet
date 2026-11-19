---
document_id: EVT-CAT-001
title: ChatNet Realtime Event Catalog
version: 1.0.0
status: Draft
owner: Backend Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "RFC 9110"
---

# ChatNet Realtime Event Catalog

## Tóm tắt

SSE giúp client nhận cập nhật nhanh nhưng Redis Pub/Sub không thay thế nguồn dữ liệu đọc lại. Sau reconnect, đồng bộ lại hội thoại và số chưa đọc. Đừng coi lỗi kết nối là bằng chứng phiên đã bị thu hồi.

## 1. Purpose

This document records realtime transport mechanisms identified in the current source baseline. It is a source-derived inventory, not yet a versioned event contract.

## 2. Chat Server-Sent Events

The Chat service exposes GET /api/events. The handler sets Content-Type to text/event-stream and writes an SSE event named update containing a JSON realtime payload. It also emits session-revoked with an empty JSON payload when the session is revoked or invalidated.

The table indexes source-emitted `type` values carried in the SSE `update` event. The `type` value is not the SSE event name. Push-only payloads such as `friend.request` and `group.member.added` are not included here.

| Origin | Internal type values | Source and recipient scope |
|---|---|---|
| Chat messages | `message`, `message.updated`, `conversation.read` | [Chat handlers and stream](../../backend/cmd/chat/main.go). Recipient filters and, for message payloads, membership and personalization are applied by the emitting/serving code. |
| Chat conversations | `conversation.created`, `conversation.updated`, `conversation.removed` | [Creation](../../backend/cmd/chat/main.go), [group membership](../../backend/cmd/chat/groups.go), [channels](../../backend/cmd/chat/group_channels.go). Invalidation goes to recipients chosen by each mutation, including the removed member for the removal event. |
| Personal organization and group activity | `pins.updated`, `category.updated`, `group.activity` | [Pins](../../backend/cmd/chat/pins.go), [categories](../../backend/cmd/chat/categories.go), [activities](../../backend/cmd/chat/group_activities.go). Category updates are per account. Other recipients depend on the emitter and stream guards. |
| Social graph and privacy | `friend.updated`, `privacy.updated` | [Friends](../../backend/cmd/chat/friends.go) and [block/report handlers](../../backend/cmd/chat/moderation.go) publish to affected users. `conversationId` may be zero. |
| Call signaling | `call.created`, `call.updated`, `call.ended`, `call.e2ee.key-request`, `call.e2ee.updated` | [Call publishers](../../backend/cmd/call/main.go) use the same per-user channel. Recipient scope is chosen by the Call emitter. Payload has `callId` and may include `call`. This is signaling, not LiveKit media or the translation WebSocket. |

The server may personalize message payloads for the receiving user before writing the generic SSE update event. Do not assume that every client receives identical message content or attachment visibility.

## 3. Session lifecycle event

| SSE event name | Payload | Meaning |
|---|---|---|
| session-revoked | Empty JSON object | Client must treat the current session as invalid and re-authenticate or clear local state |

## 4. Other realtime channels

| Channel | Source evidence | Protocol |
|---|---|---|
| Call translation | GET /api/calls/{id}/translation-stream upgrades to WebSocket | WebSocket; one-time call-scoped ticket and consent checks |
| Redis Pub/Sub | Chat service publishes per-user channel data through Redis | Internal backend event transport |
| Push notifications | Chat/Call service calls OneSignal adapter | External push provider; not a realtime socket contract |

## 5. Security and delivery notes

- SSE authentication uses cached session middleware. The Web client uses native `EventSource` with a query bearer because it cannot attach an Authorization header. This is an active baseline path, not just legacy compatibility. Keep the token and URL out of access/debug logs.
- Chat message payloads are rechecked and personalized before forwarding. Other event types also rely on recipient selection by the publishing handler. Do not infer a uniform membership recheck for every event type.
- Redis Pub/Sub is an internal transport and does not by itself prove durable event delivery.
- The [Web realtime hook](../../frontend/src/app/hooks/useAppRealtime.ts) signals re-open and reconciles membership from the server. [Message history](../../frontend/src/features/chat/hooks/useMessageData.ts) listens for the signal to reload the active conversation. Clients must not depend on full replay of missed SSE data.
- Call translation WebSocket requires a short-lived one-time ticket, call-scoped identity, participant verification and active consent.
- No exactly-once delivery guarantee is established by this catalog.

## 6. Contract gaps

The following require further source extraction and tests:
- complete event payload schemas;
- ordering and replay/cursor guarantees;
- heartbeat and reconnect behavior;
- maximum event size and backpressure policy;
- event versioning and backward compatibility;
- duplicate delivery and missed-event recovery;
- behavior for multiple active devices and revoked sessions.

[AsyncAPI 3.1.0](realtime.asyncapi.json) mô tả envelope tối thiểu của `update` gồm trường Call được xác nhận ở baseline và payload rỗng của `session-revoked`, không thay thế kiểm thử tương thích. Handler `events` trong [Chat service](../../backend/cmd/chat/main.go) gửi SSE comment lúc kết nối và ping sau khoảng 20 giây trên tick 5 giây. Presence TTL là 45 giây. Stream đóng khi không thể kiểm tra phiên, nhưng trường hợp lỗi hệ thống không phát `session-revoked`.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
