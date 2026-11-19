---
document_id: SEC-MEDIA-001
title: ChatNet Media Access Control and Revocation
version: 1.0.0
status: Draft
owner: Security and Backend Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# ChatNet Media Access Control and Revocation

## Tóm tắt

Kiểm quyền truy xuất tại thời điểm cấp/đọc qua đường dẫn ứng dụng. Thu hồi không xóa dữ liệu đã tải. Bằng chứng trên PostgreSQL riêng không thay thế kiểm expiry và cache ở storage thật.

## 1. Security objective

Media access must be scoped to an authorized user and conversation at the time of access. A database reference or opaque media ID is not an authorization capability.

## 2. Current source behavior

The Chat service supports presigned upload, upload relay and media retrieval. A server-signed media ticket is bound to media ID, viewer ID and expiry and has a one-hour lifetime. The serving handler verifies the signature and rechecks access before serving the object.

The upload relay token is separately bound to user, object reference, byte count, content type and expiry. The handler bounds the body to the authorized byte count.

## 3. Revocation model

New media requests should be denied when current access policy no longer permits the viewer, including membership removal, block or recall where the handler's policy applies.

Revocation is bounded:
- a ticket can remain usable until expiry, subject to server-side revalidation;
- a direct provider presigned URL may remain valid until its own expiry;
- bytes already downloaded cannot be revoked;
- an in-progress transfer may not be terminated instantly;
- backups, object versions, replicas and caches require separate deletion evidence.

## 4. Required controls

- Private object bucket and no public ACL.
- Short-lived, narrowly scoped upload/download capabilities.
- Server-side ownership, membership, block and visibility checks.
- Content-type and byte-size validation.
- No signed URL query string in access logs.
- No-store/private cache policy for sensitive media responses.
- Key and signing-secret rotation plan.
- Auditable orphan cleanup and object deletion.

## 5. Test matrix

| Case | Expected result |
|---|---|
| Valid ticket, authorized viewer | Media served |
| Expired ticket | Rejected |
| Tampered signature | Rejected |
| Ticket copied to another viewer | Rejected |
| Membership removed before new request | Rejected |
| User blocked before new request | Rejected where policy applies |
| Media recalled/deleted | New request rejected |
| Upload exceeds authorized bytes | Rejected without unbounded body read |
| Wrong content type or object reference | Rejected |
| Object missing from storage | Safe unavailable response; no data leak |

## 6. Deletion and recovery caution

The distributed-media proposal does not authorize deleting production S3/R2 objects. Object deletion requires a separately approved retention policy, recovery evidence, audit record and owner decision. Do not infer physical deletion from removal of a database row.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
