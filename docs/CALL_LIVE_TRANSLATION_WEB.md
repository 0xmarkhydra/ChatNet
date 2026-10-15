# ChatNet Web call translation — server-only provider integration

Updated October 15, 2026.

## Web UX
- Tap **Dịch AI** during a direct or group call. ChatNet immediately opens a translation panel, listens to consented remote speakers, and automatically plays translated speech with live captions. No translation checkboxes.
- Target language initially follows the viewer's saved translation setting; the language dropdown is optional.
- Translation can be stopped by clicking **Đang dịch** or closing the translation panel. Errors show a reconnect control.
- Audio volume of the original speech is reduced while translated speech is available.
- A participant who has not opted in may see a single, clear permission prompt if someone else asks to translate their voice. **Do not silently send remote speakers' decrypted E2EE audio to a third party without their agreement.**

## Data flow & security
- Normal E2EE LiveKit room is untouched. Client only captures the locally decrypted stream for an authorized, consented speaker.
- Browser POSTs to ChatNet `/api/calls/{callId}/translation-session` with speaker ID and the listener's language; backend checks JWT, joined membership of listener and speaker, rate limits, and issues a 40-second one-use, call-scoped ticket stored as a hash in Redis.
- Browser opens `wss://api-chat.codelocal.cloud/api/calls/{callId}/translation-stream?ticket=...`, sends bounded binary 16kHz mono PCM frames and receives only `ready`, `original`, `translated`, `audio`, and `error` events from ChatNet.
- Only Go backend knows Gemini model, provider WebSocket and `GEMINI_API_KEY`. Browser receives **no Gemini token, URL, model setting or SDK**.
- Backend opens `BidiGenerateContent` directly with its API key, streams audio to Gemini, validates and filters provider responses before relaying captions and translated PCM chunks.
- One backend Gemini session per listening speaker, capped to 5 concurrent streams for one listener. No translation transcript is persisted.
- E2EE does **not** extend to the AI provider after the explicit voice consent. Inform users that selected audio is processed by Google's service.
- Redis ticket is one-time, expires after 40 seconds, uses hashed Redis key. WebSocket enforces browser Origin and participant membership.
- No browser or application logs may include Gemini credentials.

## Railway
`GEMINI_API_KEY` must be added to the **backend** service (combined process also runs `call`). It is NOT a frontend / `VITE_*` variable.
Auto deployment on `main` should rebuild both frontend and backend. On boot the call service performs a one-off, audio-free Gemini WebSocket setup check. Watch Railway backend logs for `Gemini Live diagnostic:`.
Free-tier access is subject to Google's per-model quotas. A successful API-key check does not prove two-way call translation: two logged-in browser sessions with microphone permission and speaker consent must be tested.

## Verification
- `cd backend && go test ./...`
- `cd frontend && npm run build`
- `cd frontend && npm run check:call-live`
- Real integration: A and B connect and both press Dịch AI. Check B sees A's translated text and hears A's translated audio. A separate allow prompt can be required when a speaker has not yet opted into translation.
- Repeat with 3–5 people, different language selections, simultaneous speakers, muted microphone, network drop, 403/429/quota errors, call end, and reconnect.
