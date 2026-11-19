---
document_id: SEC-E2EE-001
title: ChatNet E2EE and MLS Status
version: 1.0.0
status: Draft
owner: Cryptography and Security Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: IETF RFC 9420
---

# ChatNet E2EE and MLS Status

## Tóm tắt

Baseline ghi nhận pilot chat trực tiếp có giới hạn, không bật mặc định. Scope một browser device mỗi tài khoản lấy từ kế hoạch pilot, không áp cho nhóm, mọi tệp, mọi client hoặc gọi điện.

## 1. Current classification

The current source includes an opt-in, feature-gated MLS/E2EE pilot path. It is experimental and MUST NOT be described as production-wide end-to-end encryption.

The existence of the ts-mls package, noble cryptographic primitives, device registration endpoints or relay routes does not prove that every conversation, message, attachment, call or client platform is end-to-end encrypted.

## 2. Source components

- Frontend dependencies include ts-mls and noble cipher/hash packages.
- Auth exposes E2EE challenge, device registration/list/revocation and KeyPackage publish/claim routes.
- Chat exposes per-conversation E2EE status, event, consent and bootstrap routes.
- Call exposes a separate public-key/envelope path.
- Database migrations add E2EE devices, key packages, MLS relay events, KeyPackage attestation and pilot consent data.

## 3. Pilot boundary

The retained implementation plan describes a limited opt-in browser/Web pilot, with a feature gate and explicit user consent. The server relays protocol records and maintains account/device metadata; it must not be assumed to possess participant plaintext only because it stores relay events.

The pilot must be assessed separately for:
- direct conversations;
- group conversations;
- multiple devices per user;
- device addition and revocation;
- KeyPackage expiry and replenishment;
- attachment encryption and media preview;
- account recovery and lost-device recovery;
- call encryption, which is a separate protocol surface.

## 4. Known gaps

The historical implementation plan identifies unfinished or not yet production-accepted areas including:
- complete group membership change and rekey behavior;
- device revocation and stale device handling;
- key transparency and independent key verification;
- account/device recovery;
- attachment E2EE lifecycle;
- multi-device acceptance and real browser/device coverage;
- complete security review and production rollout criteria.

Recheck the current E2EE plan and tests before changing this list. Do not convert historical planned work into a current implementation claim.

## 5. Required security properties before production

1. Authenticated and independently verifiable device identity.
2. Safe KeyPackage lifecycle and replay protection.
3. Correct group epoch transitions and rekey on membership/device changes.
4. Verified key authenticity and transparency model.
5. Secure backup/recovery that does not silently weaken confidentiality.
6. Ciphertext-only server/media handling for the declared E2EE scope.
7. Explicit downgrade and mixed-client behavior.
8. Adversarial protocol review and independent cryptographic assessment.
9. Multi-device and membership-change regression suite.
10. Clear user-facing state showing when a conversation is or is not E2EE.

## 6. Protocol reference

IETF RFC 9420 defines Messaging Layer Security. The application must be reviewed against the actual RFC and library version, not merely against the name MLS. Call E2EE is separate from the chat MLS pilot and requires its own review.

## 7. Source of historical detail

The detailed implementation history and pilot plan remain in docs/E2EE_IMPLEMENTATION_MASTER_PLAN.md. This status document is the concise current summary and must be re-baselined with source/test evidence.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
