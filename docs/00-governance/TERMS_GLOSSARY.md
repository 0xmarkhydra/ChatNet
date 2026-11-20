---
document_id: GOV-TERM-001
title: ChatNet Terms and Glossary
version: 1.0.0
status: Draft
owner: Engineering Governance
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 15289:2019"
---

# ChatNet Terms and Glossary

## Tóm tắt

Dùng cùng cách gọi giữa Product, Dev và QA. Ba phân biệt quan trọng là Web/PWA khác Flutter native, pilot khác production và tạo yêu cầu đơn khác hoàn tất thanh toán.

| Term | Meaning in ChatNet documentation |
|---|---|
| ChatNet / SocCO | Project and product codebase. Source packages may still use the soco identifier. |
| Web | React application served by the Web deployment. |
| PWA | Web application with install/update/offline capabilities; not equivalent to a native mobile app. |
| Desktop | Electron shell hosting the shared frontend and exposing a constrained native bridge. |
| Mobile client | Flutter source under mobile/; source presence does not establish store publication or production support. |
| Gateway | Go HTTP reverse proxy that routes public API paths to internal services and serves the frontend fallback. |
| Auth service | Go service responsible for registration, login, session lifecycle and E2EE device/key-package endpoints. |
| Chat service | Go service responsible for messaging, conversations, groups, identity/social graph, preferences, media access and realtime events. |
| Feed service | Go service responsible for posts, comments, reactions, stories, moderation and marketplace endpoints. |
| Call service | Go service responsible for call lifecycle, LiveKit credentials, participant state and call translation sessions. |
| Translation service | Go service that proxies text/UI translation to a configured AI provider without exposing provider credentials to the client. |
| E2EE | End-to-end encryption: plaintext is intended to be available only to participating endpoints. |
| MLS | Messaging Layer Security, specified by IETF RFC 9420. |
| Pilot | Explicitly limited experiment; not a default, production-ready or generally available feature. |
| SSE | Server-Sent Events; server-to-client event stream over HTTP. |
| Presence | Ephemeral online/activity state, currently associated with Redis TTL behavior. |
| Read receipt | Server-tracked read progress for a conversation or channel. |
| Presigned URL | Time-limited object-storage URL that grants a scoped upload/download operation. |
| Relay object | Temporary server/object-storage copy used to transfer media. |
| Storage Node | Proposed opt-in peer device for distributed storage; not implemented in the current source baseline. |
| Point / Coin | Product concepts described in a specification; no Point/Coin ledger tables are present in the inspected schema baseline. |
| Marketplace | Feed-service subdomain with product drafts, publishing, cart and order-pending endpoints; payment is not configured by the current schema evidence. |
| Implemented | Behavior exists in the named source baseline. Does not imply tested, deployed or production-ready. |
| Tested | A named test has been executed against a stated commit/build and environment. |
| Deployed | A build has been installed in a named environment and its deployment is evidenced. |
| Production Ready | All release, security, operational and acceptance gates for the stated scope have been satisfied and approved. |
| NOT RUN | Verification has not been executed or no trustworthy execution evidence is available. |
| BLOCKED | A prerequisite, environment, approval or implementation dependency prevents verification or release. |
| ADR | Architecture Decision Record: a durable record of context, decision, alternatives and consequences. |
| SRS | Software Requirements Specification. |
| V&V | Verification and Validation: conformance to specified requirements and fitness for intended use. |

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
