---
document_id: BE-CHAT-001
title: Messaging, Conversations and Groups
version: 1.0.0
status: Draft
owner: Messaging Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# Messaging, Conversations and Groups

## Tóm tắt

Chat quản lý thành viên, tin nhắn, read/unread và các thao tác nhóm. Khi sửa luồng offline hoặc reconnect, giữ idempotency và quyền xem trước khi phát hoặc nhận SSE.

## 1. Scope

The Chat service owns direct and group conversations, membership, messages, read state, reactions, pins, shared content, search, channels, invites, join requests, group activities, category labels, push subscriptions and realtime delivery.

## 2. Conversation and message model

The base schema defines conversations, conversation_members, messages, message_reactions and message_attachments. The schema and handlers support direct and group conversations, message replies/forwards, edit/delete timestamps, client identifiers and request fingerprints.

Message mutations must be authorized against the conversation and current membership. Duplicate submission and retry behavior should be verified through the existing idempotency tests before client retry policies change.

## 3. Read state and unread summaries

The service exposes conversation list, unread summary, membership list and mark-read operations. Group channel read tracking is added by migration. Client badges and unread totals should use the account-level authoritative summary rather than only the currently loaded page.

## 4. Reactions, pins and shared content

The service exposes message reactions and reaction-user listing, message pin/unpin, conversation pin/unpin, pinned-message listing and shared-content listing. The UI must not imply a mutation succeeded until the server confirms it.

## 5. Group governance and channels

The group domain includes:
- group creation and update;
- member listing, add/remove and role changes;
- group settings;
- invite creation/list/revoke/preview/join;
- join-request listing and review;
- admin audit listing;
- public community listing/join;
- community profile and group avatar;
- channel creation/update/delete, channel read state and notification settings;
- group activities, votes and pins.

Administrative routes must verify the caller's role and membership on the server.

## 6. Conversation categories

The retained feature specification states:
- a user can create up to 50 private categories;
- category names are 1–40 characters and case-insensitively unique;
- a conversation can have at most one category per user;
- category deletion removes classification, not conversation history;
- server-side filtering applies before pagination;
- category updates are private to the owning user and synchronized through SSE.

Recheck categories.go and its tests when changing these limits or semantics. See docs/archive/features/CONVERSATION_CATEGORIES.md for the original feature note.

## 7. Realtime

GET /api/events uses Server-Sent Events. The server emits a generic update event carrying a JSON payload with an internal event type and a separate session-revoked event. Redis Pub/Sub is used internally for per-user delivery.

See [Realtime event catalog](../03-interfaces/REALTIME_EVENT_CATALOG.md). The catalog identifies known event types but is not yet a complete versioned event schema.

## 8. E2EE boundary

The Chat service contains MLS pilot status, event, consent and bootstrap routes. This is an opt-in experimental path, not a blanket encryption guarantee. See [E2EE/MLS status](../06-security/E2EE_MLS_STATUS.md).

## 9. Test references

The Chat service contains tests for categories, communities, contact metadata, conversation history, E2EE MLS, friends, group activities, governance, group security, idempotency, link preview, media access, media relay, moderation, nearby discovery, pins, preferences, privacy, profile, quick search, reactions and unread behavior.

Test file presence does not imply execution for the current baseline. See [Test catalog](../07-quality/TEST_CATALOG.md).

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
