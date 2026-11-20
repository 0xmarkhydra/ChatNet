---
document_id: DB-MIG-001
title: ChatNet Database Migration Process
version: 1.0.0
status: Draft
owner: Data and Backend Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# ChatNet Database Migration Process

## Tóm tắt

Trình tự thực thi nằm trong Go, không sắp theo tên file. Các câu SQL chạy trong một transaction có advisory lock. Kiểm trên database QA mới và schema đã có dữ liệu trước khi rollout.

## 1. Mechanism

backend/internal/database/migrate.go embeds schema.sql and a fixed list of SQL migration files at compile time. Migrate opens a PostgreSQL transaction, acquires a transaction-scoped advisory lock using the key chatnet:schema-migrations, executes the base schema and migration SQL in a defined order, then commits.

A migration error aborts the operation. The database open path invokes Migrate during service initialization.

## 2. Embedded migration sequence

At the source baseline `40c1f1b`, [Migrate](../../backend/internal/database/migrate.go) applies this sequence after `schema.sql`.

1. 001_conversation_categories.sql
2. 002_default_conversation_categories.sql
3. 003_profile_notes.sql
4. 004_group_governance.sql
5. 005_community_channels.sql
6. 004_single_message_reaction.sql
7. 005_post_reactions.sql
8. 005_chat_pins.sql
9. 006_group_activities.sql
10. 007_group_activity_pins.sql
11. 008_group_channel_reads.sql
12. 009_group_avatars.sql
13. 010_channel_profile_notifications.sql
14. 011_call_revocations.sql
15. 012_call_cleanup_jobs.sql
16. 011_e2ee_devices.sql
17. 012_e2ee_key_packages.sql
18. 013_e2ee_mls_relay.sql
19. 014_e2ee_keypackage_attestation.sql
20. 015_e2ee_pilot_consents.sql

Ba migration `016_text_stories.sql`, `017_feed_reposts.sql` và `018_comment_likes.sql` chỉ xuất hiện trong [commit đối chiếu mới hơn](../00-governance/BASELINE_AND_CHANGE_CONTROL.md#21-chênh-lệch-với-checkout-phát-triển), không thuộc trình tự 20 bước của baseline này.

## 3. Ordering warning

Migration filename prefixes are not globally unique. For example, multiple files begin with 004, 005, 011 or 012. The order in migrate.go, not lexical filename sorting, is the authoritative execution sequence.

Do not rename, reorder or add migration files without reviewing embedded declarations, execution statements, idempotency and all deployed database states.

## 4. Safety requirements

1. Treat schema changes as production data changes.
2. Use isolated disposable PostgreSQL databases for integration tests.
3. Review lock duration, table rewrite, index build and transaction behavior.
4. Make migrations safe for the supported deployment model and expected retries.
5. Provide a rollback or forward-fix plan; do not assume every DDL change is automatically reversible.
6. Never run destructive reset or volume deletion against a user or production database.
7. Verify the migration result with schema inspection and application tests.

## 5. Current process gaps to resolve

- The embedded migration sequence is explicit, but this file does not establish a durable per-migration history table or a formal down-migration mechanism.
- Migration checksums and applied-version reconciliation are not documented here.
- Production backup/restore and rollback evidence must be captured separately.
- Migration compatibility during rolling deployment needs an explicit policy.

These are documentation and process gaps; do not infer that the current migrations have failed.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
