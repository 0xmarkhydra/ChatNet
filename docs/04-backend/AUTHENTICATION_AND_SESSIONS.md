---
document_id: BE-AUTH-001
title: Authentication and Session Management
version: 1.0.0
status: Draft
owner: Identity and Backend Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# Authentication and Session Management

## Tóm tắt

Auth quản lý đăng nhập, OTP và phiên. Đối chiếu middleware theo route: xác thực chữ ký JWT và kiểm trạng thái phiên trên server là hai mức khác nhau.

## 1. Service ownership

Authentication is implemented in backend/cmd/auth and shared backend/internal/authx. Auth service initializes PostgreSQL, Redis, JWT configuration, OTP pepper and the configured email provider.

## 2. Registration and verification

The Auth service exposes registration start, verification and resend operations, with equivalent email-prefixed aliases. The source defines a 10-minute signup verification TTL.

The source also applies rate limits:
- registration start: per-email and per-IP windows;
- verification: per-token and per-IP windows;
- resend: per-token and per-IP windows;
- login: per-email and per-IP windows.

The exact numeric limits are implementation details and must be rechecked against auth/main.go before tuning or documenting an external SLA.

## 3. Login and session lifecycle

The service exposes login, refresh, logout, current-user, session-status and managed-session operations. Session records are stored in PostgreSQL in auth_sessions. Shared middleware validates authenticated context for protected operations and includes cached session checks backed by Redis.

Clients must treat the server response as authoritative. Ở route dùng middleware kiểm phiên, local state và JWT còn hạn không thay thế kiểm trạng thái phiên. Những route chỉ dùng middleware xác thực JWT, ví dụ [Marketplace](../../backend/cmd/feed/marketplace.go), không được mô tả là kiểm thu hồi phiên giống các route dùng `CachedSessionMiddleware`.

## 4. E2EE device endpoints

Auth also exposes:
- challenge creation;
- device registration and revocation;
- device listing;
- user device listing;
- KeyPackage publication and claim.

These routes support the experimental E2EE/MLS workstream. Their presence does not establish production key transparency, device recovery or full group rekey behavior. See [E2EE/MLS status](../06-security/E2EE_MLS_STATUS.md).

## 5. Security requirements

1. JWT signing secrets and OTP pepper MUST be provided through secure environment configuration.
2. Email-provider credentials MUST remain server-side.
3. Verification tokens and login inputs MUST be rate-limited.
4. Quyền dựa trên phiên đã thu hồi phải bị từ chối ở route dùng middleware kiểm phiên. Điểm chưa bao phủ của JWT-only phải được ghi và xác minh riêng.
5. Session identifiers and tokens MUST NOT be written to application logs.
6. Desktop credentials MUST use the native vault flow and must not be copied into renderer-managed persistent storage without a reviewed design.
7. A client must not treat local session restoration as proof that a session remains active.

## 6. Environment variables

| Variable | Purpose |
|---|---|
| DATABASE_URL | PostgreSQL connection |
| REDIS_URL or REDIS_ADDR | Redis connection, according to service configuration |
| JWT_SECRET | JWT signing/verification secret |
| OTP_PEPPER | Additional secret used for OTP-related hashing |
| RESEND_API_KEY | Email provider credential |
| RESEND_API_BASE_URL | Email provider base URL |
| CHATNET_EMAIL_FROM | Sender identity |

The exact fallback behavior is implementation-specific. Do not rely on development defaults in production.

## 7. Verification

Relevant tests include Auth service tests, frontend session checks and Desktop session/auth tests. The current documentation task did not execute these tests.

See [Test catalog](../07-quality/TEST_CATALOG.md) and [Environment configuration](../08-operations/ENVIRONMENT_CONFIGURATION.md).

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
