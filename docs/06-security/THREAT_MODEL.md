---
document_id: SEC-THREAT-001
title: ChatNet Threat Model
version: 1.0.0
status: Draft
owner: Security Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: OWASP ASVS 5.0.0
---

# ChatNet Threat Model

## Tóm tắt

Các tài sản chính là phiên, tin nhắn, media và dữ liệu thoại. Ưu tiên kiểm quyền phía server, giới hạn dữ liệu đi ra và miền IPC Electron. Các rủi ro dưới đây là đầu vào kiểm phòng thủ, không phải phát hiện đã tái hiện.

## 1. Scope and method

This is an initial asset/entry-point/trust-boundary threat model based on the committed source baseline. It uses STRIDE-style categories to organize threats. It is not a completed threat-model workshop or penetration-test report.

## 2. Assets

- Account credentials, refresh tokens, session identifiers and device registrations.
- Private messages, conversation membership, read state and contact graph.
- Profile, privacy settings, location/nearby data and user reports.
- Media objects, signed upload/download capabilities and attachment metadata.
- E2EE identity keys, KeyPackages, MLS events and consent state.
- Call room credentials, participant identity, audio/video and translation output.
- Marketplace product/order data and any future Point/Coin/payment records.
- Provider credentials, database credentials, signing identities and deployment secrets.

## 3. Threat actors

- Unauthenticated internet attacker.
- Malicious authenticated user or group member.
- Blocked or removed former member.
- Compromised browser extension or renderer context.
- Malicious file/content uploader.
- Compromised dependency, build runner or deployment credential.
- External provider compromise or misconfiguration.
- Insider with excessive production access.

## 4. Trust boundaries and threats

| Boundary / surface | Threat examples | Existing source controls | Residual verification |
|---|---|---|---|
| Browser to API | Spoofed identity, IDOR, CSRF-like misuse, replay, oversized input | Auth/session middleware, handler checks, body limits and rate limits | Per-route negative authorization tests and production cookie/token policy |
| Session lifecycle | Stolen refresh token, stale session, cross-account async response | Session records, refresh/revoke APIs, session-scoped client state checks | Revoke across active SSE/call/media flows |
| Messaging and groups | Unauthorized history, stale membership, blocked-user leakage | Membership checks, block policy, admin role handlers | Cross-service and race-condition matrix |
| Media upload/read | Oversized file, MIME spoof, leaked signed URL, revoked viewer | Presign validation, bounded relay, media ticket, private object store integration | Live S3 expiry/revocation, CDN/cache and in-progress transfer tests |
| Link preview | SSRF, redirect to private IP, malicious content | Link preview handler and validation code | DNS rebinding, redirect chains, IPv6 and cloud metadata tests |
| Realtime | Event leakage, replay, stale stream after revocation, bearer exposed in proxy logs | Authenticated SSE, per-user Redis channels, session-revoked event | Reconnect, ordering, multi-device tests and effective log redaction for the [Web EventSource path](../03-interfaces/REALTIME_EVENT_CATALOG.md#5-security-and-delivery-notes) |
| Electron IPC | Untrusted frame invokes native APIs, external URL abuse | Trusted main-frame checks, frozen preload bridge, allowlisted external URLs | Packaged Windows/macOS adversarial tests |
| Desktop credential store | Plaintext refresh token exposure | safeStorage-encrypted vault and record validation | OS keychain/DPAPI behavior, recovery and corruption tests |
| Call/translation | Unauthorized room join, audio processed without consent, replayed ticket | Server-issued LiveKit credentials, consent state, short-lived one-time ticket | Real provider, reconnect and participant-removal tests. [Periodic consent check](AI_AND_CALL_TRANSLATION_PRIVACY.md#4-consent-requirements) leaves a detection window. |
| MLS pilot | Key substitution, stale KeyPackage, device revocation gap | Device registration, attestation and MLS relay routes | Key transparency, group rekey, recovery and adversarial crypto review |
| Service worker | Private content cached across logout/account switch | API/media/authenticated/query URL network-only policy | Browser storage inspection and account-switch regression |
| Supply chain/deployment | Malicious package, secret leak, unsigned release | lockfiles, CI audit steps, signing fail-closed intent | Reproducible build, provenance, signing and release evidence |

## 5. Abuse cases

- A user guesses another conversation ID and attempts to read messages or media.
- A former group member reuses a previously issued signed media URL.
- A blocked user joins a call using an already-issued LiveKit token.
- A stale response from account A arrives after account B logs in.
- A malicious page attempts to invoke Electron IPC or open an untrusted URL.
- An attacker replays a call translation ticket.
- A client submits duplicate checkout requests with different or reused idempotency keys.
- A file upload lies about its content type or exceeds authorized byte count.
- A provider key is exposed in a client bundle or diagnostic log.

## 6. Security verification priorities

P0:
- server-side authorization/IDOR;
- session revocation and cross-account isolation;
- block and membership policy;
- media ticket expiry and access revocation;
- Electron trusted-frame and IPC validation;
- call consent and one-time ticket replay;
- secret scanning and production configuration review.

P1:
- link-preview SSRF and redirect/DNS behavior;
- service-worker cache isolation;
- rate-limit and abuse-resilience tests;
- supply-chain provenance and signed installer/update verification.

## 7. Residual risks and unknowns

No independent penetration test, formal cryptographic review, production data-flow assessment, backup restore exercise or complete cross-service authorization audit was executed in this documentation task. These items remain open until evidence is attached.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
