---
document_id: PRD-PROD-001
title: ChatNet Product Overview
version: 1.0.0
status: Draft
owner: Product and Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 29148:2018"
---

# ChatNet Product Overview

## Tóm tắt

ChatNet kết hợp nhắn tin đa ngôn ngữ và mạng xã hội. Web/PWA là phạm vi chính. Desktop tái sử dụng renderer, Flutter được kiểm độc lập. MVP lịch sử không còn là mô tả đầy đủ của source.

## 1. Product summary

ChatNet (also referred to as SocCO in source and historical documentation) is a multi-client communication and social platform. Its current committed source baseline contains a Web/PWA application, a Go backend composed of service entrypoints, an Electron desktop shell and a Flutter client source tree.

The core product combines:
- identity, account sessions and profile management;
- direct and group conversations;
- messaging, attachments, reactions, read state and realtime events;
- contacts, friend requests, discovery and privacy controls;
- social feed, posts, comments, reactions, mentions and stories;
- audio/video calling with LiveKit integration;
- text and UI translation, plus a call-translation workflow;
- notifications and PWA behavior;
- a marketplace foundation;
- experimental opt-in MLS/E2EE capabilities.

Source presence does not imply that every feature is complete, deployed, available to all users or production-ready.

## 2. Product boundary

| Product surface | Source evidence | Status interpretation |
|---|---|---|
| Web | frontend/, React 19 + TypeScript + Vite | Primary application source |
| PWA | Frontend PWA scripts, service worker and notification integration | Implemented source; per-browser/device acceptance is separate |
| Desktop | desktop/, Electron Main/Preload and shared frontend build mode | Implemented shell source; release readiness is separately gated |
| Mobile | mobile/, Flutter/Dart | Client source exists; production/store release status is not established by this baseline |
| Backend | backend/cmd/* and backend/internal/* | Go service source |
| External capabilities | PostgreSQL, Redis, S3-compatible storage, LiveKit, OneSignal, email and AI provider configuration | Integration points; runtime availability depends on environment configuration |

## 3. Stakeholders

| Stakeholder | Primary concerns |
|---|---|
| End user | Reliable messaging, identity, privacy, notifications and accessible UX |
| Group owner / moderator | Membership, governance, channels, invites and moderation |
| Product owner | Product scope, feature status, policy and release decisions |
| Backend engineer | API contracts, data integrity, authorization and service operations |
| Client engineer | Responsive behavior, offline behavior, platform capabilities and accessibility |
| QA engineer | Requirement coverage, reproducible tests and evidence |
| Security reviewer | Trust boundaries, key management, privacy, media access and abuse controls |
| Operator | Configuration, availability, deployment, observability and recovery |

## 4. Product principles

1. Server-side authorization is authoritative for protected data and actions.
2. Client UI state is not a substitute for server policy.
3. User blocking and privacy controls must be enforced across relevant services, not only hidden in the UI.
4. E2EE must not be claimed for a conversation or attachment unless the complete cryptographic and lifecycle guarantees are verified.
5. AI translation of participant audio requires explicit consent and server-side provider credentials.
6. Marketplace order state and payment state are separate; an order-pending API does not mean payment is configured.
7. Experimental and proposed features must remain clearly labeled.
8. Test, deployment and production-readiness claims require evidence.

## 5. Product scope boundaries

The committed baseline includes product code for messaging, social feed, calls, translation and marketplace foundations. The following remain separate proposals or restricted workstreams:
- full production E2EE and group/device rekey lifecycle;
- distributed peer storage and paid media re-access;
- AI-first seller onboarding and listing orchestration;
- real-money payments, Coin/Point ledgers, payout and financial reconciliation;
- production-grade signed desktop update feed and complete platform release acceptance.

See [Feature status register](FEATURE_STATUS_REGISTER.md) for the current evidence classification.

## 6. Related requirements

- [Software Requirements Specification](SOFTWARE_REQUIREMENTS_SPECIFICATION.md)
- [Use cases](USE_CASES.md)
- [Feature status register](FEATURE_STATUS_REGISTER.md)
- [System context](../02-architecture/SYSTEM_CONTEXT.md)

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
