---
document_id: ARC-DEP-001
title: ChatNet Deployment Architecture
version: 1.0.0
status: Draft
owner: Platform Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: ISO/IEC/IEEE 42010:2022
---

# ChatNet Deployment Architecture

## Tóm tắt

Hình thức triển khai khai báo là Nginx, backend ghép tiến trình, PostgreSQL và Redis. Railway, provider và trạng thái health phải đánh giá bằng hiện trạng môi trường, không suy ra từ Dockerfile.

## 1. Purpose and scope

This document describes deployment mechanisms present in the source baseline. It does not claim that the current production environment is healthy, deployed from this commit or fully monitored.

## 2. Local Docker Compose topology

The root docker-compose.yml defines four services:

| Service | Image/build | Responsibility | Local exposure |
|---|---|---|---|
| postgres | postgres:16-alpine | Durable database | Internal Compose network |
| redis | redis:7-alpine | Realtime/presence and ephemeral coordination | Internal Compose network |
| backend | Dockerfile.backend | Builds and runs Auth, Chat, Feed, Translation, Call and Gateway processes | Gateway port 8080 exposed inside Compose |
| frontend | Dockerfile.frontend | Builds Vite assets and serves them through Nginx | Host port 8080 |

PostgreSQL and Redis use named volumes. Their health checks gate backend startup. Frontend Compose depends only on backend startup, not on `/api/health` being ready. Check readiness separately after startup.

## 3. Backend container process topology

Dockerfile.backend compiles six Go binaries: auth, chat, feed, translate, call and gateway.

[backend-run.sh](../../backend-run.sh) starts the services on ports 8081 through 8085 and points the Gateway's upstream URLs at `127.0.0.1`. This describes the proxy targets, not the listeners: services bind to `:8081`–`:8085` within the container. Compose does not publish those ports or the backend Gateway port to the host. The runner exits non-zero if a child process stops. Restart depends on the deployment platform or an explicit restart policy.

This is a multi-process container topology, not six separately deployed containers in the Compose definition.

## 4. Frontend container topology

Dockerfile.frontend:
1. installs frontend dependencies;
2. builds the frontend;
3. runs selected PWA/session/notification/call checks during image build;
4. copies the static bundle into Nginx.

frontend-nginx.conf.template serves the SPA and proxies /api/ requests to BACKEND_URL. The proxy forwards WebSocket upgrade headers, disables buffering/cache for the API stream and uses a long read timeout for streaming. The special clipboard-image proxy route disables access logging because the URL may contain temporary signed object-storage parameters.

The Nginx security header include defines CSP, frame denial, content-type protection, referrer policy, permissions policy and HSTS.

## 5. Railway-oriented build configuration

The source contains:
- Dockerfile.backend and backend-run.sh for backend packaging;
- Dockerfile.frontend and Nginx configuration for frontend packaging;
- a frontend development script targeting the configured Railway API host;
- internal backend URL defaults for service-to-service proxying.

These files demonstrate deployment support in source, not a verified current Railway deployment. Production service names, secrets, domain mapping, health checks, rollback and actual deployed SHA must be recorded from the hosting control plane.

## 6. Port and routing map

| Component | Default port | Notes |
|---|---:|---|
| Auth | 8081 | Internal backend process |
| Chat | 8082 | Internal backend process |
| Feed | 8083 | Internal backend process |
| Translation | 8084 | Internal backend process |
| Call | 8085 | Internal backend process |
| Gateway | 8080 | Public API and SPA fallback boundary |
| Frontend Nginx | 8080 | Host-facing frontend container in Compose |

## 7. External dependencies

Deployment requires configured PostgreSQL, Redis, S3-compatible storage, LiveKit, OneSignal, email and AI provider services according to the features enabled in that environment.

A missing optional provider configuration must not be interpreted as successful delivery. The application should report unavailable/disabled behavior rather than fabricate success.

## 8. Operational security notes

- Production secrets MUST be supplied through a secure environment/secret-management mechanism; do not commit them.
- Production S3 buckets and objects MUST remain private.
- API and streaming routes must preserve the intended proxy headers and no-buffering behavior.
- Access logs must not expose signed URL query strings or sensitive tokens. The checked-in [Nginx template](../../frontend-nginx.conf.template) disables access logging for the clipboard-image location only. It does not declare a separate redaction or disable rule for SSE under `/api/`. Effective logging behavior needs environment evidence.
- CSP and other security headers require environment-specific browser testing; source presence is not proof of effective deployed policy.
- Database backups, restore tests, Redis persistence policy and object-store recovery objectives require explicit operational runbooks.

## 9. Deployment evidence still required

- Current deployed commit/build SHA for frontend and backend.
- Current domain and internal service mapping.
- Successful health checks and smoke tests.
- Secret rotation and access policy evidence.
- Database backup/restore execution record.
- Release rollback and recovery evidence.
- LiveKit, OneSignal, email and AI provider availability evidence.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
