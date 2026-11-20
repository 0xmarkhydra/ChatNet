---
document_id: BE-FEED-001
title: Social Feed, Stories and Moderation
version: 1.0.0
status: Draft
owner: Social Platform Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# Social Feed, Stories and Moderation

## Tóm tắt

Feed quản lý bài, bình luận, tương tác, Story và moderation. Quyền đọc cần nhất quán giữa danh sách, chi tiết và thao tác. Không gán tính năng chỉ thấy trong checkout đang sửa cho baseline.

## 1. Service ownership

Feed is implemented as backend/cmd/feed and is routed through the public Gateway. It owns posts, visibility, attachments, mentions, saved posts, reactions, comments, stories, reports, moderation and the marketplace foundation.

## 2. Core data model

The base schema defines:
- posts and post_attachments;
- post_mentions and saved_posts;
- post_likes and comments;
- stories;
- feed_reports and feed_moderators.

The schema uses user and content foreign keys and indexes for feed ordering, visibility, mention recipients, saved posts, report review and active stories.

## 3. HTTP operations

The service exposes post list/create/detail/update/delete, save, like, reaction and reaction-user operations; comment create/update/delete; mention list/read; report submission; moderation identity/report list/review; and story list/create/delete.

The exact method/path inventory is in [API catalog](../03-interfaces/API_CATALOG.md).

## 4. Visibility and authorization

Post visibility and moderation decisions must be enforced in service handlers. A hidden client control is not an access-control boundary. Ownership, moderation role, block policy and content visibility must be checked for read and mutation operations.

## 5. Stories

Stories are persisted in the stories table with user ownership and media metadata. The current source has list/create/delete routes. Baseline chỉ có Story ảnh/video. Text Story, đăng lại bài và thích bình luận được xác nhận ở [commit đối chiếu mới hơn](../00-governance/BASELINE_AND_CHANGE_CONTROL.md#21-chênh-lệch-với-checkout-phát-triển), không thuộc SHA tài liệu này. Cần đối chiếu TTL, xử lý hết hạn và retention trực tiếp trước khi cam kết SLA.

## 6. Moderation

The Feed service exposes report submission and moderator review routes. feed_moderators represents moderator authorization data; feed_reports stores report state and reviewer metadata.

A production moderation policy still needs an approved taxonomy, escalation/appeal process, reviewer audit requirements, abuse response times and retention rules.

## 7. Privacy and cross-service policy

Feed visibility must honor user blocking and privacy requirements. The retained block policy states that blocked users' authored content should be hidden according to the policy while unrelated authorized users retain access. Verify this across list, detail, comments, reactions, search and moderation surfaces.

## 8. Verification

Relevant test files include Feed main, manage, moderation, mentions, reactions, privacy, display name, following, visitor and block-policy tests. Their presence does not establish a PASS for the current documentation baseline.

See [Test catalog](../07-quality/TEST_CATALOG.md) for verification grouping.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
