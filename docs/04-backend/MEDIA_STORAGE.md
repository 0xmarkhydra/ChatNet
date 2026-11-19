---
document_id: BE-MEDIA-001
title: ChatNet Media Storage and Access
version: 1.0.0
status: Draft
owner: Backend and Security Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# ChatNet Media Storage and Access

## Tóm tắt

Server cấp quyền tải/gửi và metadata được gắn với đối tượng. Phân biệt yêu cầu mới, capability còn hiệu lực, dữ liệu đã tải và nhu cầu kiểm nhà cung cấp thật. Distributed Media là RFC riêng.

## 1. Current storage path

The current source includes an S3-compatible object-store adapter, media presign and relay handlers, media metadata on messages/posts and an authenticated media-serving path.

The Chat service exposes POST /api/media/presign, PUT /api/media/relay and GET /api/media/chat/{id}. The Gateway also exposes a clipboard-image helper. The [Nginx location](../../frontend-nginx.conf.template) for that route disables access logging to avoid recording temporary signed URL parameters. This is a proxy configuration fact, not a guarantee for other hops or routes.

## 2. Media access tickets

The current Chat media ticket:
- is bound to media ID, viewer ID and expiry;
- is signed using a server-side HMAC key;
- has a one-hour lifetime;
- is verified by the media-serving handler;
- rechecks current access and returns forbidden/unavailable when access has been revoked or the media is unavailable.

The one-hour media ticket is not equivalent to an indefinitely public object URL.

## 3. Upload relay capability

The upload relay token is bound to user ID, object reference, byte count, content type and expiry. The verifier rejects expired tokens and tokens with expiry beyond its configured upper window. The relay handler uses a bounded request body reader based on the authorized byte count.

The relay token is distinct from a viewer media ticket and from a provider-generated presigned URL.

## 4. Orphan cleanup

The Chat service defines a seven-day orphan retention period and runs cleanup on a 12-hour ticker. Cleanup jobs use a bounded execution context. This describes the source behavior; production object lifecycle and deletion audit must still be verified in the actual storage environment.

## 5. Revocation limitations

- New media requests can be denied when current access policy no longer permits the viewer.
- An already issued media ticket remains valid only within its expiry and subject to handler revalidation.
- A provider presigned URL issued directly to a client may remain valid until its own expiry; the application cannot claw back bytes already downloaded.
- A transfer already in progress may not be instantaneously terminated by a later membership or block change.
- Deleting a database reference does not by itself prove that all object versions, replicas, backups and caches have been purged.

## 6. Security requirements

- Keep buckets private and use scoped capabilities.
- Validate object ownership, MIME/type, size, path/reference and viewer authorization.
- Do not log presigned URL query strings or capability tokens.
- Keep signing secrets and S3 credentials server-side.
- Apply cache-control and referrer/security headers to sensitive media responses.
- Test membership removal, block, recall, expired ticket, tampered signature, wrong viewer, oversized upload and missing object.
- Avoid exposing original filenames or sensitive media metadata in public URLs.

## 7. Distributed media recovery proposal

The documents under docs/proposals/distributed-media-storage describe an opt-in storage-node network, erasure coding, shard auditing, recovery and paid re-access. This is a proposal, not an implemented subsystem in the current baseline.

The proposal explicitly prohibits production S3/R2 deletion based solely on elapsed retention or shard acknowledgements. A production deletion decision would require independently verified recovery drills, failure-domain diversity, current audits, rollback and owner go/no-go approval. It also does not authorize real payment or rewards.

## 8. Related documents

- [Media access control](../06-security/MEDIA_ACCESS_CONTROL.md)
- [Distributed media proposal](../proposals/distributed-media-storage/README.md)
- [Data architecture](../02-architecture/DATA_ARCHITECTURE.md)

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
