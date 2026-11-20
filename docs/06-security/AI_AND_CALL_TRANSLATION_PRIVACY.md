---
document_id: PRIV-AI-001
title: AI and Call Translation Privacy
version: 1.0.0
status: Draft
owner: Privacy and Realtime Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# AI and Call Translation Privacy

## Tóm tắt

Dịch văn bản và dịch âm thanh là hai luồng khác nhau. Âm thanh có thể rời vùng E2EE để provider xử lý sau consent. Chưa xác nhận retention của provider từ source ứng dụng.

## 1. Scope

ChatNet has a Translation service for text/UI translation and a separate Call service workflow for live call translation. The two paths use different server configuration and transport.

## 2. Text and UI translation

The Translation service reads AI provider settings on the server, including provider, API key, base URL, model and authentication scheme. Client bundles must not contain provider secrets.

The service exposes text translation and UI localization bundle endpoints. Provider health is exposed separately. Provider availability, retention and processing region depend on the configured provider and account terms.

## 3. Live call translation

The current Call service source uses a Gemini Live provider integration. It requires a server-side API key. The speaker's consent is stored with a two-hour TTL. A one-time stream ticket has a 40-second TTL and is consumed at WebSocket handshake. The stream checks session, call participant and consent state.

The maximum PCM frame size is bounded in source. The ticket is sent in the first WebSocket JSON frame, not in the URL. Do not log audio, transcripts, tickets or provider credentials.

## 4. Consent requirements

- Consent must be explicit and attributable to the participant whose audio is processed.
- A listener cannot consent on behalf of a speaker.
- Consent withdrawal must be available during an active call.
- A ticket must be one-time, short-lived and scoped to the call and participant.
- Session and consent must be rechecked after reconnect and during the stream.
- When consent is absent, expired or withdrawn, the system must not continue sending that participant's audio to the provider. This is the acceptance target, not a claim that the baseline meets it.

**Static finding at the baseline:** [streamCallTranslation](../../backend/cmd/call/translation.go) checks consent before connecting to the provider and again on a nominal 2-second tick. The forwarding path does not recheck before each frame. This design permits a window before withdrawal is detected and does not establish a 2-second worst-case bound. [REQ-CALL-004](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-call-004) được ghi là khoảng hở tĩnh ở baseline. Điều kiện nghiệm thu vẫn giữ nguyên trừ khi Product/Security quyết định khác. Provider retention and already-delivered frames are separate questions.

## 5. User transparency and provider governance

Before production enablement, document:
- the audio/text data sent to the provider;
- purpose and expected processing duration;
- provider identity, region and retention terms;
- whether data is used for provider model training;
- participant consent and withdrawal UX;
- failure and fallback behavior;
- access logging, incident response and deletion process.

## 6. Residual risks

Source-level consent controls do not establish provider-side deletion, contractual data protection, model-training exclusion, legal basis or user comprehension. These require provider terms, privacy review and real multi-participant acceptance.

See [Calls and translation](../04-backend/CALLS_AND_TRANSLATION.md).

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
