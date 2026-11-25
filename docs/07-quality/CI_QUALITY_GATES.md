---
document_id: QA-CI-001
title: ChatNet CI and Quality Gates
version: 1.0.0
status: Draft
owner: Build and Quality Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-21
normative_basis: "ISO/IEC/IEEE 29119-3:2021"
---

# ChatNet CI and Quality Gates

## Tóm tắt

Phân biệt manifest, workflow, run CI cá nhân, run GitHub và nghiệm thu thiết bị. Xác minh tên script trong package trước khi kết luận workflow có thể chạy trọn.

## 1. Workflow inventory

The committed source baseline contains two GitHub Actions workflow definitions.

### Web/PWA quality gates

Source: .github/workflows/web-pwa-ci.yml

Triggers:
- push to main, dev and feat/chatnet-* branches;
- pull request to main or dev;
- manual workflow dispatch.

The workflow includes frontend lint/architecture checks, baseline ratchet checks, Vitest, TypeScript/Vite build, PWA/session/notification/chat/media/call checks, plus a backend job using PostgreSQL and Redis services for Go integration testing.

### Desktop foundation CI

Source: .github/workflows/desktop-foundation-ci.yml

Triggers:
- push to feat/chatnet-desktop-electron;
- pull request to feat/chatnet-desktop-electron or dev;
- manual workflow dispatch.

The workflow defines a platform matrix for macOS arm64, macOS Intel x64 and Windows x64. It installs frontend/Desktop dependencies, runs dependency audits, Desktop tests, frontend build, Desktop build, shell smoke and platform packaging. A backend job runs contract and disposable database integration checks.

## 2. Local baseline commands

The root Makefile defines:
- make up — docker compose up --build;
- make down — docker compose down;
- make build — docker compose build;
- make test — Go test ./... and frontend build;
- make frontend — frontend dev server.

make reset removes Compose volumes before restarting and is destructive to local database state. It MUST NOT be used against a user or production environment.

## 3. CI versus local verification

A local test PASS is not GitHub Actions PASS. A workflow file existing is not a workflow run. Record separately:
- local command and host;
- GitHub workflow run ID and job result;
- commit SHA;
- test environment and service versions;
- skipped/blocked steps.

Runner CI cá nhân (nếu có) được quản lý ngoài repo trên máy người chạy. Lần chạy runner này, lần chạy GitHub Actions và lần smoke trên thiết bị thật phải ghi riêng. Đợt tài liệu không xác minh cấu hình bên ngoài hoặc thay workflow.

## 4. Current workflow caveats

**Sai lệch tĩnh tại baseline:** [workflow Desktop](../../.github/workflows/desktop-foundation-ci.yml) gọi `check:desktop-notifications`, nhưng [frontend/package.json](../../frontend/package.json) không có script đó. Có thể chặn job khi đến bước này. Chưa chạy CI để xác lập kết quả thực tế. Không đổi workflow trong đợt tài liệu.

- Web/PWA workflow branch filters and Desktop workflow branch filters differ.
- Desktop workflow is scoped to its feature branch and dev PRs; do not assume it runs on every documentation or toan-nguyen-dev branch update.
- A historic B05 report recorded GitHub billing lock preventing jobs from starting at that time. This is not asserted as the current account status.
- This documentation task did not execute GitHub Actions or local product CI.

## 5. Hosted CI gate record

Ghi riêng local CI, runner cá nhân và GitHub Actions. Workflow hoặc log cục bộ không chứng minh hosted CI đã đạt.

| Gate | Bằng chứng bắt buộc để ghi `PASS` | Trạng thái tài liệu này |
|---|---|---|
| Hosted Web/PWA CI | URL/run ID, commit SHA, workflow attempt, job results, service versions và log lưu trữ | NOT RUN |
| Hosted Desktop CI | URL/run ID, SHA, đủ ma trận OS/kiến trúc, package/signing result và job results | NOT RUN |
| P0/P1 acceptance | Báo cáo acceptance gắn cùng SHA; P0 không có `FAIL`/`NOT RUN`/`BLOCKED`; P1 có PASS hoặc quyết định hoãn hợp lệ | NOT RUN |
| Release decision | Người duyệt, thời điểm, `GO`/`NO-GO`/`DEFERRED`, link tới mọi gap | NOT RUN |

Thiếu run ID, SHA không khớp, job bị bỏ qua hoặc run không hoàn tất giữ gate ở `NOT RUN` hoặc `BLOCKED`, không đổi thành `PASS`.

## 6. Required release gates

- Lint/typecheck/build.
- Backend unit and disposable DB/Redis integration.
- Frontend feature regressions and architecture checks.
- Desktop native/security/package tests for each supported OS/architecture.
- Mobile analysis/widget tests and physical-device checks for any declared mobile release.
- Security, accessibility, performance and visual acceptance.
- Signed/notarized distribution, updater and rollback tests where applicable.
- Product and release-owner approval.

## 7. CI maintenance

When workflow files or package scripts change, update this document and TEST_CATALOG.md. Never weaken or remove a quality gate solely to obtain a green status without documenting the risk and obtaining owner approval.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
