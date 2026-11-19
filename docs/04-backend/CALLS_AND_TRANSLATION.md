---
document_id: BE-CALL-001
title: Calls and Live Translation
version: 1.0.0
status: Draft
owner: Realtime and Backend Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# Calls and Live Translation

## Tóm tắt

Tách ba lớp: lifecycle cuộc gọi, media LiveKit và dịch thoại qua provider. Gọi được không chứng minh dịch được. Dịch cần quyền và consent của người nói, kiểm từng môi trường.

## 1. Service ownership

The Call service is implemented in backend/cmd/call. It stores call and participant state in PostgreSQL, checks session and conversation authorization, issues LiveKit credentials and exposes call lifecycle and translation routes.

## 2. Call lifecycle

The API includes:
- call creation;
- current-call and call-history listing;
- call detail and participant listing;
- join, decline, leave and end;
- call translation language listing;
- translation consent read/update;
- translation session creation and stream;
- call E2EE public-key and envelope operations.

The base schema includes call_sessions and call_participants. Incremental migrations add call revocation and cleanup behavior.

## 3. LiveKit integration

LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are read server-side. Client applications must not mint room credentials or treat a local call UI state as proof of server authorization.

Blocking and membership policy must be checked before issuing new credentials. A previously issued bearer token or established media session may have a bounded validity window; see the residual risk in Identity and Contacts.

## 4. Call translation consent

The current source uses Redis-backed per-call/per-speaker consent. Consent is granted or withdrawn by the authenticated speaker. The source defines:
- consent TTL: 2 hours;
- one-time translation ticket TTL: 40 seconds;
- active translation session limit: 5 per call and listening user;
- maximum PCM frame size: 8192 bytes, equivalent to 256 ms at 16 kHz mono PCM16 (the source comment rounds this to about 250 ms).

The translation-session endpoint checks that the speaker has consented and returns a one-time ticket. After the HTTP upgrade, the server reads the ticket from the first WebSocket JSON frame, consumes it using Redis `GETDEL`, and rechecks session, participants and consent before connecting to the provider. An active stream rechecks these conditions on a nominal 2-second tick and closes on failed checks. There is no consent lookup before every PCM frame, so this is not evidence of immediate stop at the moment consent is withdrawn. See [consent requirements and gap](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md#4-consent-requirements).

## 5. Provider boundary

The current live call translation implementation reads GEMINI_API_KEY on the server and connects to a Gemini Live translation model. The client does not receive the provider API key. A missing backend API key yields HTTP 503 when requesting a ticket. If the upstream connection fails after the WebSocket upgrade, the stream reports an error and does not become usable. No provider availability is implied by ticket issuance.

Text/UI translation is a separate Translation service using AI_API_KEY, AI_BASE_URL, AI_MODEL and related provider configuration.

## 6. Transport clarification

GET /api/calls/{id}/translation-stream upgrades to WebSocket. It is not Server-Sent Events. The route name contains the word stream, but the implementation uses a WebSocket upgrader.

The Chat service's GET /api/events endpoint is the SSE channel for conversation events.

## 7. Privacy and safety requirements

- Do not send decrypted remote-speaker audio to a third-party provider without explicit consent.
- Consent belongs to the speaker whose audio is processed; a listener cannot grant consent on another person's behalf.
- Consent withdrawal must not be rate-limited in a way that prevents withdrawal.
- Tickets must be one-time, short-lived, call-scoped and kept out of URL query strings and logs.
- Recheck session validity, call participation and consent during the live stream.
- Do not log audio, raw tokens or provider credentials.
- Explain to users which audio is processed and by which provider.

## 8. Verification limitations

The source includes call lifecycle, revocation and translation tests plus frontend call/translation checks. These do not by themselves establish real multi-device, real provider, network interruption, consent race or production LiveKit acceptance. Such results require an execution record and environment evidence.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
