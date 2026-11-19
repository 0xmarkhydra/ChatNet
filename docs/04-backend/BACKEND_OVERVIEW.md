---
document_id: BE-OVW-001
title: ChatNet Backend Overview
version: 1.0.0
status: Draft
owner: Backend Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# ChatNet Backend Overview

## Tóm tắt

Bảng dịch vụ cho biết handler nằm ở đâu và mặc định chạy cổng nào. Gateway chỉ định tuyến, không thay thế kiểm quyền. Dữ liệu và provider dùng theo nhu cầu từng dịch vụ.

## 1. Technology baseline

- Language: Go 1.23.
- HTTP stack: standard library net/http ServeMux with method/path patterns.
- Database: PostgreSQL through pgx/v5.
- Cache/realtime primitives: Redis through go-redis/v9.
- Authentication: JWT v5 and shared auth/session middleware.
- Calling: LiveKit protocol integration.
- Cryptography helpers: golang.org/x/crypto and client-side noble/MLS libraries.
- Object storage: S3-compatible adapter.
- Push: OneSignal adapter.
- Email: configured Resend-compatible mail provider.
- AI: server-configured translation provider integrations.

## 2. Executable services

| Service | Default port | Main source | Responsibility |
|---|---:|---|---|
| Gateway | 8080 | backend/cmd/gateway | Reverse proxy, health endpoint and SPA fallback |
| Auth | 8081 | backend/cmd/auth | Registration, login, sessions and E2EE device/key-package endpoints |
| Chat | 8082 | backend/cmd/chat | Messaging, conversations, profile, contacts, privacy, media, groups and SSE |
| Feed | 8083 | backend/cmd/feed | Posts, comments, reactions, stories, moderation and marketplace |
| Translation | 8084 | backend/cmd/translate | Text and UI translation |
| Call | 8085 | backend/cmd/call | Calls, LiveKit credentials, participant state and call translation |

In the Docker deployment source, these binaries are built separately but launched as child processes in one backend container by backend-run.sh. The Gateway is the container-facing HTTP entrypoint.

## 3. Shared packages

| Package | Purpose |
|---|---|
| authx | JWT claims, session middleware and cached session checks |
| config | Environment variable helpers |
| database | PostgreSQL pool, base schema and embedded migrations |
| httpx | JSON/error response helpers |
| languagecatalog | Language metadata |
| mailer | Email delivery |
| mediax | Media helpers and clipboard-image proxy |
| objectstore | S3-compatible storage |
| onesignalx | Push notifications |
| ratelimit | Redis-backed request limiting |
| redisx | Redis connection and helpers |
| searchx | Search support |

## 4. Service-to-service and data dependencies

All services use the configured PostgreSQL database and Redis as required by their handlers. Gateway proxies public paths to each service. Media flows use objectstore; call flows use LiveKit; push and email use provider adapters; translation uses a configured AI provider.

No independent message broker or durable event log was identified in this baseline. Realtime events are published through Redis and delivered to connected clients using SSE.

## 5. API ownership

The Gateway route map is maintained in backend/cmd/gateway/main.go. Service route registrations are in each service's main.go and, for marketplace, backend/cmd/feed/marketplace.go.

See [API catalog](../03-interfaces/API_CATALOG.md). The catalog is source-derived and not a complete OpenAPI contract.

## 6. Backend quality evidence

Backend Go tests are organized alongside service packages. The Web/PWA workflow contains a backend job using PostgreSQL and Redis services for an integration test. The Desktop foundation workflow also contains a backend contract/disposable-database job.

The existence of tests and workflow definitions does not establish that they passed for the current branch or that production dependencies are available. See [CI quality gates](../07-quality/CI_QUALITY_GATES.md).

## 7. Known architecture risks

- Chat service currently contains many domain responsibilities.
- Gateway and service route declarations are manually maintained.
- Realtime event payloads lack a complete versioned contract.
- Several security and cross-service policies need real provider/device acceptance.
- Production SLOs, tracing, backup and restore objectives are not established by source inspection alone.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
