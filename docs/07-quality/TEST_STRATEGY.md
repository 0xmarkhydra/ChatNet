---
document_id: QA-STRAT-001
title: ChatNet Test Strategy
version: 1.0.0
status: Draft
owner: Quality Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: ISO/IEC/IEEE 29119-1:2022; 29119-2:2021; 29119-3:2021; 29119-4:2021
---

# ChatNet Test Strategy

## Tóm tắt

Kiểm theo rủi ro từ unit đến E2E, thiết bị thật và release. Với tính năng có trạng thái, thêm ca biên, ngắt mạng và đổi phiên. Không lấy ảnh chụp thay cho bằng chứng hành vi.

## 1. Test levels

| Level | Purpose | Typical evidence |
|---|---|---|
| Static analysis | Type safety, lint, architecture boundaries and unsafe patterns | Tool output and baseline comparison |
| Unit | Pure functions and isolated domain behavior | Deterministic test report |
| Component | React/Dart component behavior and state transitions | Component/widget test |
| Service integration | HTTP handler, database, Redis and provider adapters | Disposable database/Redis run |
| Contract | Gateway/service routes, request/response and event compatibility | Contract fixtures and schema validation |
| Browser E2E | Full user journeys, responsive layout and browser APIs | Playwright trace, screenshots and logs |
| Native Desktop | Electron IPC, secure storage, notifications, permissions and packaging | Windows/macOS runtime evidence |
| Mobile | Flutter widget, API and device permission flows | Flutter test and physical-device evidence |
| Security | Authorization, abuse, secret handling, media, IPC and consent | Negative tests and review report |
| Performance/reliability | Latency, resource use, reconnect, backpressure and recovery | Measured run with environment metadata |
| Visual/accessibility | Responsive appearance, keyboard, accessibility tree and screen reader | Screenshots, accessibility output and manual review |

## 2. Risk-based priorities

P0:
- authentication/session revocation;
- direct/group message authorization and idempotency;
- block/privacy/membership boundaries;
- media upload limits and access revocation;
- call authorization and translation consent;
- Electron IPC and credential vault;
- database migration safety.

P1:
- push delivery and unread totals;
- feed visibility/moderation;
- search, categories, pins and group channels;
- PWA update/offline behavior;
- Marketplace order idempotency and pending-payment state;
- responsive and accessibility regressions.

P2:
- visual polish, non-critical animation and performance tuning after correctness.

## 3. Boundary and negative testing

Every stateful feature SHOULD include:
- zero, one, maximum and maximum-plus-one values;
- empty, null, malformed, Unicode and oversized inputs;
- expired, revoked, duplicated and replayed tokens;
- unauthorized user, wrong owner, removed member and blocked pair;
- concurrent requests and stale response ordering;
- network loss before request, after request and before acknowledgement;
- process restart and account switch;
- unavailable provider and partial failure;
- pagination boundary and cursor invalidation.

## 4. Data and concurrency

Use disposable PostgreSQL/Redis for integration. Test transaction rollback, unique constraints, idempotency, race conditions, membership change, unread aggregation, cleanup jobs and duplicate delivery. Do not reset a persistent user database.

## 5. Platform coverage

- Web/PWA: mobile viewport, desktop viewport, keyboard, service worker, offline fallback and browser permissions.
- Desktop: Windows x64, macOS arm64 and Intel x64; verify packaged runtime rather than only source tests.
- Mobile: Flutter widget tests plus physical Android/iOS permission, navigation, media and lifecycle checks.
- Backend: Go unit and integration packages against the expected PostgreSQL and Redis versions.

## 6. Visual and accessibility acceptance

A screenshot proves only the captured visual state. It does not prove keyboard accessibility, screen-reader announcement, semantic tree or behavior under dynamic content. Keep visual and accessibility evidence separate.

## 7. Reporting

Use PASS, FAIL, NOT RUN, BLOCKED or PARTIAL. Attach the tested SHA, environment, command and evidence. A previous run does not automatically apply to a later commit.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
