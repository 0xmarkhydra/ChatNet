---
document_id: DB-SCHEMA-001
title: ChatNet Database Schema
version: 1.0.0
status: Draft
owner: Data and Backend Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# ChatNet Database Schema

## Tóm tắt

Tra bảng chính và khóa qua schema và migration. Không coi thống kê CREATE TABLE là số bảng đầy đủ sau migration. Baseline không có ledger Point/Coin tương ứng.

## 1. Schema authority

The base schema is embedded from backend/internal/database/schema.sql. Incremental SQL files under backend/internal/database/migrations are embedded and applied by database.Migrate. This source baseline does not use the old migration path described by the root README.

The base schema contains 30 CREATE TABLE statements. Incremental migrations add or alter more tables, columns, constraints and indexes.

## 2. Base tables by domain

| Domain | Tables | Purpose |
|---|---|---|
| Identity and sessions | users, auth_sessions | User identity, profile fields and authenticated sessions |
| Conversations | conversations, conversation_members | Direct/group conversation and membership/read state |
| Social graph and safety | friend_connections, user_blocks, user_reports, friend_request_events, friend_contact_metadata | Friend lifecycle, block policy, user reports and per-user contact metadata |
| Messaging | messages, message_reactions, message_attachments | Messages, reactions and attachment metadata |
| Feed and moderation | posts, post_mentions, saved_posts, feed_reports, feed_moderators, post_attachments, stories, post_likes, comments | Social content, visibility, media, engagement and moderation |
| Preferences and translation | user_preferences, message_translations | User preferences and stored translation data |
| Push | push_subscriptions | Push endpoint/provider subscription metadata |
| Calls | call_sessions, call_participants | Call lifecycle and participants |
| Marketplace | market_products, market_cart_items, market_orders, market_order_items | Product listing, buyer cart, pending order and item snapshots |

## 3. Important constraints visible in the schema

- Conversation type is constrained to direct or group.
- Friend connection pairs are normalized with user_low less than user_high; request state is pending or accepted.
- Block and report records prevent self-targeting.
- Message replies use a self-reference with delete behavior defined in schema.
- Attachment size must be positive; attachment kind is constrained.
- Post visibility and moderation fields have explicit defaults/constraints.
- Comment parent relationships are constrained to the same post and earlier comment ordering.
- Call media type and status are constrained; participant roles are constrained.
- Marketplace product title, price, unit and stock are validated by database constraints.
- Marketplace cart quantity is constrained to a positive bounded range.
- Marketplace order status is constrained to awaiting_payment_configuration in this baseline.

Always inspect the actual DDL and migration before relying on a summarized constraint.

## 4. Relationships

- User records are the parent for sessions, profile, preferences, friend/block/report records and user-owned content.
- Conversations own members and messages.
- Messages own reactions and attachments and may reference a reply target.
- Posts own attachments, mentions, saves, reactions, comments and reports.
- Calls own participant records.
- Marketplace products reference sellers; carts reference buyers/products; orders reference buyer/seller; order items reference order/product.

Foreign-key ON DELETE actions differ by relationship. Do not infer cascade behavior from this summary.

## 5. Absent economic structures

No Point balance, Coin wallet, financial transaction ledger, payment webhook, payout or withdrawal tables were found in the inspected base schema and migration list. The Point/Coin specification is therefore product documentation, not evidence of implemented wallets or financial operations.

## 6. Data governance gaps

A complete production data governance baseline still needs:
- data classification and lawful-purpose inventory;
- retention and deletion schedule by table/domain;
- account export and deletion behavior;
- backup and restore objectives;
- access logging and audit retention;
- data residency and provider processing assessment;
- schema-level ownership and migration review responsibilities.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
