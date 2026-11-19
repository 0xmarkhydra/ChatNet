---
document_id: BE-ID-001
title: Identity, Profile, Contacts and Blocking
version: 1.0.0
status: Draft
owner: Identity and Backend Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# Identity, Profile, Contacts and Blocking

## Tóm tắt

Quyền tìm người, danh bạ và chặn được áp trong backend. Khi hai người dùng chặn nhau, kiểm quyền của cả hai và người ngoài, không tự suy ra nội dung hoặc bản tải xuống đã bị xóa.

## 1. Scope

The Chat service owns profile read/update, profile notes, avatar/cover access, user search and suggestions, nearby discovery, friend requests, contact metadata, privacy settings, block and report operations.

## 2. Data and API surface

The base schema includes users, friend_connections, user_blocks, user_reports, friend_request_events and friend_contact_metadata. Additional profile-note behavior is introduced by an embedded migration.

The API route inventory is in [API catalog](../03-interfaces/API_CATALOG.md). Principal families include:
- GET/PUT /api/profile and PUT /api/profile/media;
- profile-note GET/POST/DELETE;
- user search, suggestions, nearby and public profile assets;
- friend list, requests, accept and remove;
- contact metadata read/update;
- privacy read/update;
- blocked-user list, block, unblock and report.

## 3. Blocking policy

The retained cross-service policy document defines a block as a directional database record but symmetric for communication and content visibility: if either A blocks B or B blocks A, the pair is treated as blocked for the documented surfaces.

The policy aims to apply to existing content, not only future writes. Group membership and administrative rights remain separate from blocking. Group history and media visibility, replies, unread state, search, preview, SSE and push must be tested for both sides. An unrelated third participant should continue to see content they are authorized to access.

Unblocking removes the block record; it does not delete historical content.

## 4. Known residual risks

- A LiveKit credential issued before a block may remain a bearer token for up to five minutes according to the retained policy note. A newly blocked peer is prevented from receiving new join credentials, but an already-established media connection or previously issued token is not retroactively revoked by the documented guards.
- Instant call teardown requires a LiveKit room/participant eviction path and reconciliation. Do not claim it is complete without real LiveKit tests.
- Push notifications already delivered and files already downloaded cannot be clawed back.
- Aggregate engagement counts and some historical participant metadata are not intended to disappear solely because of a block.

## 5. Required verification

- Verify both directions of a block with two accounts.
- Verify direct conversation reads and writes, shared content, search, link preview, unread, SSE and push.
- Verify group messages authored by the blocked peer are hidden according to policy while unrelated members retain access.
- Verify replies and reactions cannot expose hidden content.
- Verify no new LiveKit credential is issued to a blocked peer.
- Test with isolated PostgreSQL and Redis; use a real LiveKit environment for revocation claims.

The retained source policy and its acceptance matrix are at docs/BLOCK_USER_CROSS_SERVICE_POLICY.md. This summary does not upgrade historical test cases to PASS.

## 6. Related documents

- [Security overview](../06-security/SECURITY_OVERVIEW.md)
- [Threat model](../06-security/THREAT_MODEL.md)
- [Media access control](../06-security/MEDIA_ACCESS_CONTROL.md)
- [API catalog](../03-interfaces/API_CATALOG.md)

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
