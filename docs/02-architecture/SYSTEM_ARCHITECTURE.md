---
document_id: ARC-SYS-001
title: ChatNet System Architecture
version: 1.1.1
status: Draft
owner: System Architecture
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: ISO/IEC/IEEE 42010:2022
---

# ChatNet System Architecture

## Tóm tắt

Một monorepo, nhiều client và năm dịch vụ sau Gateway. Tách quyền sở hữu logic khỏi hình thức đóng gói: container backend hiện chạy nhiều binary, không chứng minh mỗi dịch vụ đã được triển khai độc lập.

## 1. Architecture overview

ChatNet is a multi-client monorepo with a shared React Web/Desktop renderer, a Flutter client source, and a Go backend split into service entrypoints. The public API is routed through a Go gateway. Durable application state is stored in PostgreSQL; Redis supports realtime and ephemeral coordination; media is integrated through S3-compatible object storage.

## 2. Repository-level decomposition

| Area | Source path | Primary responsibility |
|---|---|---|
| Backend entrypoint | backend/cmd/auth | Registration, login, sessions and E2EE device/key-package endpoints |
| Backend entrypoint | backend/cmd/chat | Conversations, messages, contacts, profile, privacy, media, groups, preferences and SSE |
| Backend entrypoint | backend/cmd/feed | Posts, comments, reactions, stories, moderation and marketplace |
| Backend entrypoint | backend/cmd/call | Call lifecycle, LiveKit, participant consent and call translation |
| Backend entrypoint | backend/cmd/translate | Text/UI translation and provider health |
| Backend entrypoint | backend/cmd/gateway | Public routing, health and SPA fallback |
| Shared backend | backend/internal/authx | Authentication/session middleware and token handling |
| Shared backend | backend/internal/config | Environment configuration |
| Shared backend | backend/internal/database | PostgreSQL connection, schema and migrations |
| Shared backend | backend/internal/httpx | HTTP helpers and response conventions |
| Shared backend | backend/internal/languagecatalog | Supported language catalog |
| Shared backend | backend/internal/mailer | Email provider integration |
| Shared backend | backend/internal/mediax | Media proxy and clipboard-image handling |
| Shared backend | backend/internal/objectstore | S3-compatible object-store adapter |
| Shared backend | backend/internal/onesignalx | Push provider integration |
| Shared backend | backend/internal/ratelimit | Rate limiting |
| Shared backend | backend/internal/redisx | Redis connection and helpers |
| Shared backend | backend/internal/searchx | Search helpers |
| Web client | frontend/src/app | App shell, navigation, providers and routing |
| Web client | frontend/src/features | Feature-owned React modules |
| Desktop client | desktop/src | Electron Main, Preload, IPC, vault, notification and capture modules |
| Mobile client | mobile/lib | Flutter application, screens, API and platform UI |

## 3. Backend service boundaries

### 3.1 Gateway

The gateway creates reverse proxies to Auth, Chat, Feed, Translation and Call services. It routes URL families and handles the SPA fallback. The gateway is a routing boundary; it is not a substitute for authorization inside the destination service.

### 3.2 Auth service

Owns account registration, email verification, login, refresh/logout, session administration, identity lookup for the current session and E2EE device/key-package registration operations.

### 3.3 Chat service

Owns the largest domain surface: direct/group conversations, messages, read state, reactions, pins, membership and governance, channels, invites, join requests, profile, contacts, friend graph, user discovery, privacy, blocking/reporting, preferences, media upload/read paths, push subscriptions and realtime SSE.

### 3.4 Feed service

Owns posts, visibility, comments, reactions, saves, mentions, stories, reports/moderation and marketplace routes. Marketplace is a subdomain of the Feed service in the current source structure, not a separate deployed microservice.

### 3.5 Call service

Owns call and participant lifecycle, LiveKit credential issuance, translation consent/session/stream operations and call-related E2EE key/envelope routes.

### 3.6 Translation service

Owns text translation and UI localization bundle translation. Provider URL, model, API key and authentication scheme are configured server-side.

## 4. Client architecture

### Web/PWA

React 19 and TypeScript are built with Vite. Feature modules expose API, hooks, components, types and local styles. The app router owns top-level paths and navigation state. PWA scripts check update, session, push and offline behavior.

### Desktop

Electron Main owns privileged capabilities. Preload exposes a narrow bridge through contextBridge. The shared renderer calls typed APIs from frontend/src/platform/desktop.ts. Main validates the trusted frame before native IPC operations. Native modules isolate authentication, secure credential storage, notification, media permission, screen capture and window lifecycle.

### Mobile

Flutter source provides screens for auth, chat, calls, contacts, feed, profile, discovery and related surfaces. Source presence does not prove production parity with Web or publication to app stores.

## 5. Data and infrastructure dependencies

- PostgreSQL: durable identity, session, conversation, message, feed, call and marketplace records.
- Redis: presence, realtime fanout and ephemeral coordination where used by service code.
- S3-compatible storage: uploaded media and object retrieval.
- LiveKit: call media infrastructure.
- OneSignal: push notification provider.
- Email provider: registration and verification delivery.
- AI provider: translation requests.

## 6. Architecture constraints

1. Authorization is enforced in backend handlers/middleware; client hiding is insufficient.
2. The gateway route table and service route registration must remain consistent.
3. Cross-service policy such as block and call membership must be checked at each relevant service boundary.
4. Database schema changes must use the established migration mechanism and preserve migration ordering.
5. AI provider secrets must not be embedded in Web, PWA, Desktop or Mobile bundles.
6. Electron native capabilities must remain behind trusted IPC.
7. E2EE pilot and distributed-media proposal must remain separate from production guarantees until their blockers are resolved.

## 7. Architecture risks and open questions

- Chat service currently owns many domain concerns; service extraction or bounded-context refactoring would require explicit ADR and compatibility plan.
- The gateway route table is manually maintained; the limited OpenAPI sample does not automate full gateway/service drift detection.
- Realtime event payloads are not yet documented in a complete versioned schema.
- Mobile support/release status is not established by this source baseline.
- Deployment topology runs several Go services as child processes in one backend container; process supervision and health behavior should be monitored.
- Formal SLOs, observability stack and disaster-recovery objectives require owner confirmation.

## Mô tả kiến trúc theo ISO/IEC/IEEE 42010

Phần này bổ sung các thành phần mà mô tả kiến trúc cần có: stakeholder và mối quan tâm, viewpoint, quy tắc đối chiếu, lý do quyết định và kiểm tra nhất quán. Việc dùng cấu trúc này không phải là tuyên bố conformance.

### Stakeholder và mối quan tâm

Stakeholder lấy từ [tổng quan sản phẩm](../01-product/PRODUCT_OVERVIEW.md#3-stakeholders). Mối quan tâm được suy từ ràng buộc kiến trúc, rủi ro ở mục 6–7 và [SRS](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md). Chưa được từng stakeholder xác nhận.

| Mã | Mối quan tâm | Stakeholder chính | Yêu cầu liên quan |
|---|---|---|---|
| C-01 | Phân quyền và xác thực do server thực thi | Security reviewer, Backend | REQ-AUTH-003/008, NFR-SEC-001 |
| C-02 | Riêng tư và chặn người dùng xuyên dịch vụ | Người dùng cuối, Security reviewer | REQ-ID-004/008, NFR-PRIV-001 |
| C-03 | Gửi tin tin cậy, không trùng, không báo thành công giả | Người dùng cuối, Client | NFR-REL-001/002 |
| C-04 | Realtime hội tụ sau gián đoạn | Người dùng cuối, Client | REQ-CHAT-006/014 |
| C-05 | Bảo vệ bí mật nhà cung cấp AI | Security reviewer, Operator | REQ-AI-001/002, REQ-CALL-003/004 |
| C-06 | Toàn vẹn dữ liệu và migration | Backend, Operator | NFR-DATA-001/002 |
| C-07 | Triển khai, vận hành, quan sát và khôi phục | Operator | NFR-OBS-001/002 |
| C-08 | Bảo trì và ranh giới module | Backend, Client | NFR-MAINT-001 |
| C-09 | Trợ năng và dùng được trên Web/PWA | Người dùng cuối, Client, QA | NFR-ACC-001/002/003 |
| C-10 | Cô lập đặc quyền native của Desktop | Security reviewer, Client | NFR-PLAT-001 |
| C-11 | Ranh giới E2EE trung thực | Security reviewer, Product | [E2EE/MLS](../06-security/E2EE_MLS_STATUS.md). Chưa có REQ (TBD-03) |

### Viewpoint

| Viewpoint | Mối quan tâm xử lý | Loại mô hình | View hiện có |
|---|---|---|---|
| Bối cảnh | C-01, C-02, C-05 | Sơ đồ ranh giới, tác nhân, luồng dữ liệu | [Bối cảnh hệ thống](SYSTEM_CONTEXT.md) |
| Cấu trúc | C-01, C-03, C-08 | Phân rã kho mã, ranh giới dịch vụ, route | Mục 2–4 ở trên, [danh mục API](../03-interfaces/API_CATALOG.md) |
| Dữ liệu | C-03, C-06 | Kho dữ liệu, bảng và khóa ngoại | [Kiến trúc dữ liệu](DATA_ARCHITECTURE.md), [migration](../04-backend/DATABASE_MIGRATIONS.md) |
| Triển khai | C-07 | Topology container, cổng, proxy | [Kiến trúc triển khai](DEPLOYMENT_ARCHITECTURE.md), [runbook](../08-operations/DEPLOYMENT_AND_OPERATIONS.md) |
| Bảo mật | C-01, C-02, C-05, C-10, C-11 | Ranh giới tin cậy, mối đe dọa | [Mô hình mối đe dọa](../06-security/THREAT_MODEL.md), [E2EE/MLS](../06-security/E2EE_MLS_STATUS.md) |
| Realtime | C-04 | Kênh, loại sự kiện, quy tắc giao | [Danh mục sự kiện](../03-interfaces/REALTIME_EVENT_CATALOG.md) |
| Client | C-09, C-10 | Module, nền tảng, hợp đồng bridge | [Kiến trúc frontend](../05-clients/FRONTEND_ARCHITECTURE.md), [Desktop](../05-clients/DESKTOP_ELECTRON.md), [thiết kế và trợ năng](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md) |

Mọi mối quan tâm C-01…C-11 được ít nhất một viewpoint xử lý. Khoảng hở đã biết: viewpoint Realtime chưa có lược đồ payload đầy đủ, viewpoint Triển khai chưa có bằng chứng môi trường thật (mục 7 và [mục 9 của kiến trúc triển khai](DEPLOYMENT_ARCHITECTURE.md#9-deployment-evidence-still-required)).

### Quy tắc đối chiếu giữa các view

1. Tên dịch vụ và cổng giữa bối cảnh, route map, runner và kiến trúc triển khai phải nhất quán.
2. Quan hệ trong view dữ liệu phải có khóa ngoại hoặc ghi rõ chỉ là quan hệ logic.
3. Mỗi dịch vụ ở view Cấu trúc phải xuất hiện ở view Triển khai và có đường vào ở Gateway.
4. Mỗi mối quan tâm có ít nhất một yêu cầu trong SRS, hoặc ghi rõ lý do chưa có (như C-11).
5. Thay đổi ranh giới đặc quyền hoặc triển khai phải cập nhật view liên quan và có [ADR](../09-decisions/README.md).

### Lý do quyết định

| ADR | Quyết định | Mối quan tâm |
|---|---|---|
| [ADR-0001](../09-decisions/0001-electron-desktop-shell.md) | Electron cho Desktop | C-10 |
| [ADR-0002](../09-decisions/0002-sse-realtime-delivery.md) | SSE và Redis Pub/Sub | C-04 |
| [ADR-0003](../09-decisions/0003-server-side-ai-provider-secrets.md) | Khóa AI chỉ ở server | C-05 |
| [ADR-0004](../09-decisions/0004-multi-process-backend-container.md) | Nhiều dịch vụ một container | C-07, C-08 |
| [ADR-0005](../09-decisions/0005-mls-e2ee-opt-in-pilot.md) | MLS pilot tự nguyện | C-11 |
| [ADR-0006](../09-decisions/0006-per-service-authorization.md) | Phân quyền từng dịch vụ | C-01, C-02 |

ADR-0002, 0004 là hồi cứu và chưa có lý do gốc. Không coi chúng là quyết định đã được phê duyệt.

### Kiểm tra nhất quán đã thực hiện

Ngày 2026-11-19, đối chiếu tay tài liệu với source tại baseline:

- Sáu entrypoint (Gateway, Auth, Chat, Feed, Translation, Call) nhất quán giữa bối cảnh, kiến trúc và triển khai. Cổng 8081–8085 khớp [backend-run.sh](../../backend-run.sh) và URL mặc định ở [Gateway](../../backend/cmd/gateway/main.go).
- Bảng route của Gateway so với route đăng ký ở từng dịch vụ: đã kiểm bằng script cùng ngày, 179 thao tác `/api/*` đều khớp một mẫu Gateway và đúng dịch vụ đích. Kết quả ở [bản ghi kiểm OpenAPI](../03-interfaces/CONTRACT_GOVERNANCE.md#51-bản-ghi-kiểm-openapi-020). Đây là kiểm tại một thời điểm. Chưa có kiểm tự động trong CI.
- **Chưa kiểm:** khóa ngoại trong view dữ liệu so với `schema.sql`.

## 8. Architecture references

- [System context](SYSTEM_CONTEXT.md)
- [Deployment architecture](DEPLOYMENT_ARCHITECTURE.md)
- [Data architecture](DATA_ARCHITECTURE.md)
- [Backend overview](../04-backend/BACKEND_OVERVIEW.md)
- [API catalog](../03-interfaces/API_CATALOG.md)

## Lịch sử thay đổi

- 1.1.1 (2026-11-19) — Cập nhật kết quả kiểm route Gateway.
- 1.1.0 (2026-11-19) — Thêm stakeholder và mối quan tâm, viewpoint mở rộng, quy tắc đối chiếu, bảng lý do quyết định và bản ghi kiểm tra nhất quán theo 42010.
- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
