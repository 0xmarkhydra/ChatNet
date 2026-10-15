# ChatNet Web/PWA — Gemini Live call translation

## Scope (2026-10-15)
- Web/PWA only; Flutter/iOS untouched.
- Both direct and group audio/video calls use the existing LiveKit secure call room.
- User opts into translating remote speakers by pressing **Dịch AI**, picks their own target language, and may enable Gemini's translated audio.
- Every speaker must explicitly consent before their remote media track is forwarded to Gemini by a listening client. Consent is never preselected.
- Audio/video calling remains functional even when Gemini is unavailable.
- One Gemini stream per consenting remote speaker per listener (limit **5** streams per listener). This avoids mixing speakers but has O(N²) worst-case API cost for a group. Revisit shared fan-out with group scale.
- Panel is side-by-side on desktop, stacked below video on narrow web screens.

## Server configuration
Set **GEMINI_API_KEY** on the **ChatNet call service** in Railway, not the frontend. Never expose this secret as `VITE_*` or send it to a browser.
Model currently pinned to `gemini-3.5-live-translate-preview` to match Google Live Translation API behavior. This is a preview model, so the model, quotas, and session limits can change.

POST `/api/calls/{id}/translation-token` authenticates the user, validates their call membership and joined state, rate-limits token issuance, checks target language against Gemini's supported codes, and creates a short-lived, single-use, constrained ephemeral token. The browser connects to Gemini over v1beta WebSockets. The token response is `Cache-Control: no-store`. LiveKit credentials and E2EE media keys are not forwarded to Gemini.

## Media pipeline
LiveKit (E2EE) -> local authorized participant audio (already decrypted in the participant browser) -> Web Audio capture -> AudioWorklet mono PCM16 @16kHz, 100ms frames -> Gemini Live -> input/output text transcriptions and output PCM16 @24kHz -> user-local translation panel and optional translated audio playback.

**Privacy disclosure:** E2EE protects the LiveKit call among participants; when AI translation is enabled with speaker consent, the authorized listener sends the decrypted voice to Google's Gemini service. It is incorrect to claim Gemini audio is end-to-end encrypted from Google. No transcript is stored to ChatNet's database by the new integration; Google data retention is governed by the API service terms.

## Functional acceptance checklist
- Two browser sessions, user A and user B, choose different languages. Both hear original voice normally when translation is off.
- B requests translation. A sees the request, can reject or consent. Until A consents, B MUST NOT send A's audio to Gemini.
- A consents. B sees text translation in the side panel and can opt into translated audio.
- A revokes consent or leaves. B's translation stream stops. Turning off translation closes Gemini sessions and restores original audio volume.
- Repeat for 3–6 users with speakers talking independently; each caption must keep the correct speaker ID.
- Web mobile viewport (375px), desktop (1440px): call controls always accessible, panel independently scrollable, no horizontal overflow.
- Test mute, unmute, screen-sharing, E2EE reconnect, Gemini service errors, rate limiting, call end.
- Test changing target language creates a new constrained Gemini session rather than reusing a previously locked token.
- Verify API key is not bundled, present in source maps, or shown in logs.
- Long calls: Gemini Live connections can expire; the panel exposes **Kết nối lại** for manual recovery. Automatic session resumption and longer-call reliability require another test pass.

## Verification and deployment gate
Run `cd backend && go test ./cmd/call` and `cd frontend && npm run build` before merging/deploying. Integration tests with a real Gemini key and two authenticated LiveKit clients are still required. No production readiness claim without completing those tests.

References:
- https://ai.google.dev/gemini-api/docs/live-api/live-translate
- https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
