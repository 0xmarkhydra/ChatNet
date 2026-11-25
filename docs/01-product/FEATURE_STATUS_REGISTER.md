---
document_id: PRD-STAT-001
title: ChatNet Feature Status Register
version: 1.0.0
status: Draft
owner: Product and Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 29148:2018"
---

# ChatNet Feature Status Register

## Tóm tắt

Đọc cột bằng chứng theo scope của từng hàng. Web/PWA, Electron và Flutter không cùng mức nghiệm thu. LiveKit hoạt động khác với dịch thoại đã nghiệm thu, và MLS chat không đại diện mã hóa toàn hệ thống.

## 1. Status interpretation

- **Source implemented:** implementation is present in the stated source baseline.
- **Partial:** some flows exist, but material acceptance, policy or integration gaps remain.
- **Pilot / experimental:** gated or limited use; not a general production guarantee.
- **Proposed:** specification/backlog exists, but implementation is not established.
- **Blocked:** a prerequisite prevents release or acceptance.
- **Not verified:** no current test/deployment evidence was available in this documentation task.

## 2. Capability register

| Capability | Source evidence at baseline | Status | Important qualification |
|---|---|---|---|
| Authentication and sessions | Auth service routes for register, verify, login, refresh, logout and session management | Source implemented | Hosted email/provider behavior depends on configuration |
| Direct and group chat | Chat service routes for conversations, messages, membership and governance | Source implemented | Real-world acceptance must be tied to named tests and devices |
| Realtime updates | GET /api/events, Redis-backed code and frontend SSE checks | Source implemented | Event schema and production delivery guarantees require separate verification |
| Contacts, friends, discovery | Chat service user/friend/privacy/block routes | Source implemented | Cross-service block limitations remain |
| Feed and stories | Feed service post/comment/reaction/story/moderation routes | Source implemented | Production moderation and real-media acceptance are separate |
| Message and media transfer | Presign, relay and media retrieval handlers; object-store integration | Source implemented | Storage access, expiry and revocation limitations must be explicit |
| Text/UI translation | Translation service endpoints and server-side AI provider configuration | Source implemented | Provider availability, quota and policy depend on environment |
| LiveKit calls | Call service and LiveKit configuration | Source implemented | Real multi-device/device permission acceptance not established here |
| Call live translation | Consent/session/stream routes and client checks | Partial / acceptance limited | Real multi-participant and adversarial consent verification remains required |
| Web/PWA | React/Vite frontend and PWA scripts | Source implemented | Browser-specific install/update/offline acceptance is separate |
| Electron Desktop | Main/Preload shell, IPC, auth vault, notifications, media permissions and screen capture | Source implemented | Not equivalent to a signed, notarized, fully accepted production release |
| Flutter Mobile | Flutter app source and platform directories | Source exists | Store publication and production support are not established |
| E2EE/MLS | Feature-gated explicit opt-in MLS pilot, device/key-package and relay routes | Pilot / experimental | Not default, not production-ready; group rekey and device lifecycle gaps remain |
| Marketplace | Product draft/publish, cart and order-pending backend foundation | Partial | Payment, fulfillment, refunds and AI seller flow are not established |
| Point / Coin | Product specification | Proposed | No Point/Coin ledger tables in inspected schema |
| Distributed media storage | BA/RFC/QA proposal | Proposed | No storage-node implementation or durability proof |
| Desktop updater | Packaging scripts and artifacts described in historical B05 report | Blocked / not verified | A signed update feed and N→N+1 rollback acceptance are not established |
| Hosted CI | Web/PWA and desktop workflow definitions exist | Workflow defined | Workflow execution result is not asserted by this documentation task |

## 3. Explicit non-equivalences

- Code exists ≠ tests passed.
- Tests passed locally ≠ GitHub Actions passed.
- A build artifact exists ≠ signed/notarized release.
- An API returns an order ID ≠ payment completed.
- An MLS library or pilot UI exists ≠ all conversations are E2EE.
- A presigned URL expires ≠ access is instantly revocable for an already-issued URL or in-progress transfer.
- A client source tree exists ≠ the platform is officially supported or published.

## 4. Re-baselining rule

This register MUST be updated when the source baseline changes. For each changed row, record source files, tests executed, environment, commit/build and unresolved limitations. Historical status reports remain historical.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
