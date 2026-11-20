---
document_id: GOV-BASE-001
title: Documentation Baseline and Change Control
version: 1.0.0
status: Draft
owner: Documentation Workstream
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 15289:2019"
---

# Documentation Baseline and Change Control

## Tóm tắt

Nhánh tài liệu mô tả commit nền, không trộn thay đổi chưa commit của checkout khác. Khi baseline đổi, đối chiếu lại route, migration, IPC, CI và trạng thái phát hành.

## 1. Documentation worktree

| Field | Value |
|---|---|
| Branch | docs/ieee-standardization |
| Worktree | `D:\06-work\ChatNet\.worktrees\docs-ieee-standardization` |
| Base branch | toan-nguyen-dev |
| Base commit | 40c1f1b35958ee22c1278986bf82ff57520137a1 |
| Work scope | Documentation files and project README only |
| Integration state | Documentation integrated locally into `toan-nguyen-dev` from reviewed snapshot `ef9e741`. No push or release was performed as part of this integration. |

## 2. Source-state snapshot at work start

Baseline này là commit nguồn cố định của nhánh tài liệu, không phải snapshot của checkout đang sửa dở. Lúc tiếp tục công việc, checkout chính ở `toan-nguyen-dev@3664430` và có thay đổi sẵn trong `AGENTS.md`. Checkout thử nghiệm tách `HEAD@40c1f1b` có các thay đổi Backend, Frontend, Desktop và test chưa commit. Các thay đổi đó không được sao chép vào worktree tài liệu, không dùng làm bằng chứng của baseline.

### 2.1 Chênh lệch với checkout phát triển

Mốc đối chiếu là `toan-nguyen-dev@3664430d8e70afc1e1889c9e86882ca92dffecbc`. Đây là một commit khác, **không** phải baseline của đặc tả, không phải trạng thái chưa commit và không phải bằng chứng đã triển khai. Bảng dưới đây chỉ ghi phần chênh lệch Feed được rà soát trong đợt này.

| Thay đổi có ở commit đối chiếu | Route hoặc hành vi thay đổi | Migration bổ sung theo thứ tự thực thi |
|---|---|---|
| Text Story | `POST /api/stories` hỗ trợ nội dung chữ. `GET /api/stories?includeText=true` đưa Story chữ vào kết quả. Hai route đã có ở baseline, nhưng hành vi này chưa có. | `016_text_stories.sql` |
| Đăng lại bài | `POST /api/posts/{id}/repost`, `DELETE /api/posts/{id}/repost` | `017_feed_reposts.sql` |
| Thích bình luận | `PUT /api/posts/{id}/comments/{commentId}/like`, `DELETE /api/posts/{id}/comments/{commentId}/like` | `018_comment_likes.sql` |

Nguồn đối chiếu Git là `backend/cmd/feed/main.go`, `backend/internal/database/migrate.go` và các file SQL được nhúng tại hai SHA. Xem [danh mục HTTP](../03-interfaces/API_CATALOG.md#6-feed-service) và [trình tự migration](../04-backend/DATABASE_MIGRATIONS.md#2-embedded-migration-sequence) cho riêng baseline `40c1f1b`. Trước khi dùng bộ tài liệu để nghiệm thu `3664430` hoặc commit mới hơn, cần cập nhật baseline và rà lại toàn bộ bề mặt ở mục 6, không chỉ bốn route này.

## 3. Source authority

For statements in this documentation set:
1. The baseline commit above is the reproducible implementation reference.
2. Code and tests in the baseline outrank old prose documentation.
3. Uncommitted work is recorded as an observation only and MUST NOT be presented as part of the committed baseline.
4. Product-owner decisions in historical specifications may define intended product behavior, but MUST be labeled separately from implementation state.
5. Deployment and production readiness require environment-specific evidence not established by a local source checkout.

## 4. Documentation-only boundary

This workstream may create or revise:
- README.md;
- Markdown and descriptive interface specifications under docs/;
- documentation indexes and architecture diagrams embedded as Mermaid.

It MUST NOT modify application source, tests, package manifests, migrations, Dockerfiles, workflows, environment files, secrets, generated assets or runtime configuration.

No staging, commit, push, merge, deployment or production action is implied by this document.

## 5. Change-control record

| Date | Change | Baseline / evidence |
|---|---|---|
| 2026-11-19 | Confirmed isolated documentation worktree | docs/ieee-standardization at 40c1f1b |
| 2026-11-19 | Started IEEE/ISO/IEC/IEEE documentation standardization | User approval in ChatNet conversation |
| 2026-11-19 | Recorded Feed drift without changing the documentation baseline | Git diff `40c1f1b` → `3664430` |

The final documentation review kept the source baseline unchanged. See the [handoff record](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md#bàn-giao-review-tài-liệu) for the distinction between document checks and product acceptance.

## 6. Re-baselining

When source changes are integrated, update the baseline commit and recheck:
- backend service routes and authorization middleware;
- database schema and migration sequence;
- frontend feature boundaries and API clients;
- desktop IPC and native security controls;
- mobile source and build status;
- CI workflows and test scripts;
- feature status and residual security risks.

A document that has not been rechecked against a later code baseline MUST identify its older baseline.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
