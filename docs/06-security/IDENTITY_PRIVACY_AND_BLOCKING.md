---
document_id: SEC-ID-001
title: Identity, Privacy and Blocking Security Policy
version: 1.0.0
status: Draft
owner: Security and Identity Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# Identity, Privacy and Blocking Security Policy

## Tóm tắt

Một chiều lưu bản ghi, hai chiều cưỡng chế theo chính sách được ghi. Phân biệt quyền gửi/đọc mới, nội dung đã nhận và token cuộc gọi đã cấp. Không biến hạn chế triển khai thành cam kết thu hồi tức thì.

## 1. Scope

This document summarizes the identity, privacy and blocking policy across Auth, Chat, Feed and Call. The original cross-service policy and acceptance matrix remain at docs/BLOCK_USER_CROSS_SERVICE_POLICY.md.

## 2. Identity and authorization principles

- A user ID or conversation ID supplied by a client is an identifier, not proof of authorization.
- Every protected read and mutation must verify the authenticated actor, current membership, ownership and role required by that operation.
- Privacy settings must be enforced by server-side queries and handlers.
- Cached or realtime state must be invalidated or rechecked when the session, membership or block state changes.

## 3. Block semantics

The retained policy models user_blocks as a directional database record but treats the relationship symmetrically for communication and visibility: if either party blocks the other, both sides are treated as blocked for the specified interaction surfaces.

The intended effect covers:
- direct conversation visibility and writes;
- user search/discovery and friend actions;
- group content visibility for the blocked pair;
- replies and reaction visibility;
- shared media and link previews;
- unread state and realtime SSE;
- push notifications;
- call creation/join credential issuance.

Unblocking restores access according to current membership and visibility rules; it does not erase historical content.

## 4. Group semantics

Blocking does not automatically remove either user from a group or change group administrator roles. The policy aims to hide content authored by the blocked peer from the blocked pair while unrelated group members retain access to content they are authorized to view.

The implementation must not accidentally hide a whole group or expose a blocked user's content through search, preview, reply, attachment, reaction or notification side channels.

## 5. Call-token limitation

The retained policy records that an already issued LiveKit credential may remain valid for up to five minutes. Blocking prevents new credential issuance where the guard applies, but does not itself revoke an existing bearer token or forcibly disconnect an already established media session.

Do not promise instant call termination without a verified LiveKit participant eviction/reconciliation path.

## 6. Non-revocable effects

- Push notifications already delivered cannot be recalled.
- Files already downloaded cannot be remotely erased.
- Data copied or screenshotted by a recipient cannot be clawed back.
- Historical aggregate counts may remain where policy allows.

## 7. Verification matrix

For each pair A/B, test A blocks B and B blocks A. Include:
- direct conversation list/detail/messages;
- group list/history/channels and third-member visibility;
- reply, reaction and shared attachment paths;
- search, suggestions, nearby and link preview;
- unread count, SSE and push;
- new call credential and active-call behavior;
- unblocking and restored visibility;
- simultaneous membership/block changes.

Run tests against isolated PostgreSQL and Redis. Use a real LiveKit environment for token and participant revocation claims.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
