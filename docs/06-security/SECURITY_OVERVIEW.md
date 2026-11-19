---
document_id: SEC-OVW-001
title: ChatNet Security Architecture Overview
version: 1.0.0
status: Draft
owner: Security Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: OWASP ASVS 5.0.0; ISO/IEC/IEEE 12207:2026
---

# ChatNet Security Architecture Overview

## Tóm tắt

Tách ranh giới Web, Electron native, backend và nhà cung cấp. Đọc threat model để xác định rủi ro còn mở, không biến việc có middleware hay audit dependency thành kết luận hệ thống an toàn.

## 1. Security objectives

ChatNet security documentation covers:
- account identity, authentication and session revocation;
- server-side authorization for conversations, groups, feed and personal data;
- private media storage and bounded access capabilities;
- user privacy, blocking and abuse reporting;
- desktop privileged-process isolation;
- AI provider secret handling and consent for call audio processing;
- E2EE/MLS pilot limitations;
- secure build, deployment and release controls.

This is an architecture overview, not an independent security assessment or compliance certificate.

## 2. Principal controls present in source

| Area | Source evidence | Qualification |
|---|---|---|
| Authentication | Auth service, JWT and session middleware | Complete threat and configuration assessment not established |
| Session lifecycle | auth_sessions, refresh/logout/revoke operations, cached session middleware | Verify revocation across all connected clients and event streams |
| Rate limiting | shared ratelimit package and Auth limits | Need abuse-case coverage and production tuning |
| Authorization | Protected route middleware and handler-level checks | Cross-service consistency requires dedicated tests |
| Media access | S3 adapter, signed upload/media tickets and authenticated serving | Existing signed URLs and in-progress downloads have bounded revocation |
| Desktop isolation | Main/Preload bridge, trusted frame checks and safe URL policy | OS-specific packaged acceptance remains separate |
| Desktop credential storage | Electron safeStorage vault | Current implementation explicitly handles macOS and Windows |
| Notifications | Metadata-only native notification payload | External push content and platform privacy settings require acceptance |
| Call translation | Consent, one-time ticket, session/participant rechecks | Real provider and multi-device acceptance still required |
| E2EE | Feature-gated MLS pilot and key-package routes | Not production-wide E2EE |

## 3. Security boundaries

1. Client to Gateway: untrusted input and client state.
2. Gateway to service: routing boundary; service authorization remains mandatory.
3. Service to PostgreSQL/Redis: privileged backend data access.
4. Service to object storage: scoped upload/download and media authorization.
5. Electron renderer to Main: privileged IPC boundary.
6. Backend to AI, email, push and LiveKit providers: server-held credentials and external trust.
7. MLS clients to relay service: protocol data and key-package metadata; relay presence is not proof of correct endpoint key verification.

## 4. Security governance

Use OWASP ASVS 5.0.0 as a web/API verification reference, RFC 9420 for MLS protocol behavior and RFC 9846 for TLS 1.3 transport. Tailor controls to the actual deployment and threat model.

Security claims MUST identify:
- protected asset and attacker capability;
- enforcing control and source location;
- negative test or review evidence;
- residual limitation;
- environment and baseline commit.

## 5. Release-blocking unknowns

- Complete threat model and abuse-case signoff.
- Independent penetration test and dependency/supply-chain review.
- Production secret management and rotation evidence.
- Full block/privacy enforcement across every service and cache.
- Media retention/deletion and backup policy.
- E2EE key lifecycle, device recovery and group rekey acceptance.
- Signed Desktop distribution and updater/rollback verification.
- AI provider data processing, retention and contractual review.
- Production incident response, audit and recovery runbooks.

## 6. Related documents

- [Threat model](THREAT_MODEL.md)
- [Identity and privacy](IDENTITY_PRIVACY_AND_BLOCKING.md)
- [E2EE/MLS status](E2EE_MLS_STATUS.md)
- [Media access control](MEDIA_ACCESS_CONTROL.md)
- [AI/call translation privacy](AI_AND_CALL_TRANSLATION_PRIVACY.md)

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
