---
document_id: QA-PLAN-001
title: ChatNet Quality Assurance Plan
version: 1.0.1
status: Draft
owner: Quality Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: IEEE 730-2026; ISO/IEC/IEEE 12207:2026
---

# ChatNet Quality Assurance Plan

## Tóm tắt

QA quản lý phạm vi, môi trường, bằng chứng và trạng thái lỗi. Chỉ dùng PASS khi có lần chạy gắn build. Việc hoàn thiện tài liệu không tự đổi trạng thái QA sản phẩm.

## 1. Purpose

This plan defines how quality activities are selected, executed, evidenced and reported for ChatNet. It is tailored to the Web/PWA, Electron Desktop, Flutter client and Go backend.

## 2. Quality objectives

- Functional correctness and requirement coverage.
- Security and privacy enforcement across services and clients.
- Data integrity and safe migrations.
- Realtime reliability and idempotent mutations.
- Responsive, accessible and visually consistent UX.
- Platform-specific native behavior and release integrity.
- Maintainability through explicit module and API boundaries.

No numeric availability, latency, error-rate or recovery targets are approved in this source baseline. SLOs require product/operations approval.

## 3. Quality roles

| Role | Responsibility |
|---|---|
| Product owner | Approves scope, acceptance criteria and release decision |
| Engineering owner | Owns implementation quality and technical risk |
| QA owner | Maintains test plan, test data, execution evidence and defect triage |
| Security reviewer | Reviews threat model, authorization, privacy and high-risk controls |
| Platform owner | Verifies Web, Desktop and Mobile platform behavior |
| Release owner | Confirms signed artifacts, CI evidence, rollback and go/no-go |

## 4. QA lifecycle

1. Derive test conditions from approved requirements and risks.
2. Identify affected service/client boundaries and test data.
3. Design positive, negative, boundary, concurrency and recovery cases.
4. Run unit/component tests, service integration tests and browser/native tests.
5. Run visual, accessibility, security and performance checks where relevant.
6. Capture commit/build, environment, command, result, logs and sanitized evidence.
7. Triage defects by severity and affected requirement.
8. Re-run regressions and record residual risks.
9. Obtain product/security/release signoff for the declared release scope.

## 5. Test environments

- Unit tests: isolated runtime and deterministic fixtures.
- Backend integration: disposable PostgreSQL and Redis.
- Web browser: Chromium/Playwright and supported browser matrix.
- Desktop: packaged Electron on Windows and macOS, including native permissions and OS notification behavior.
- Mobile: Flutter test environment and physical Android/iOS devices for platform-specific behavior.
- External integration: test accounts for LiveKit, OneSignal, email, S3-compatible storage and AI provider.

Do not use production user data as routine test fixtures.

## 6. Evidence rules

Mẫu bản ghi, báo cáo sự cố, trạng thái và hoàn tất nằm ở [hồ sơ kiểm thử](TEST_DOCUMENTATION.md).

Each execution record must include:
- test ID and requirement ID;
- commit SHA and build artifact identity;
- OS, browser/device and viewport;
- environment and provider configuration category, excluding secret values;
- command or manual steps;
- PASS / FAIL / NOT RUN / BLOCKED result;
- logs, screenshots or video with sensitive data redacted;
- defect/issue reference and reviewer.

## 7. Exit criteria

A release scope is eligible for review only when:
- all P0 requirements have an approved verification result;
- no open release-blocking security/data-integrity defect remains;
- migration and rollback risks are understood;
- platform-specific smoke tests are complete;
- signing/notarization requirements are satisfied for public installers;
- hosted CI and local CI results are separately reported;
- product, security and release owners approve residual risks.

A green TypeScript build alone is not an exit criterion.

## 8. Current execution status

This documentation workstream did not execute product tests, browser tests, native builds, database migrations or hosted CI. Those results remain NOT RUN for this workstream. Existing historical test reports retain their original dates and baselines.

## Lịch sử thay đổi

- 1.0.1 (2026-11-19) — Dẫn tới hồ sơ kiểm thử ở mục 6.
- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
