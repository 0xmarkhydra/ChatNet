---
document_id: QA-CAT-001
title: ChatNet Test and Check Catalog
version: 1.0.0
status: Draft
owner: Quality Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 29119-3:2021"
---

# ChatNet Test and Check Catalog

## Tóm tắt

Đây là danh mục lệnh và file kiểm, không phải kết quả. Chọn lệnh theo rủi ro, dùng PostgreSQL/Redis cách ly cho integration và ghi rõ fixture/test thật.

## 1. Frontend commands

Run from frontend/. The scripts below are defined in frontend/package.json at the stated baseline.

### Build and static quality

| Command | Scope |
|---|---|
| npm run lint | Lint ratchet |
| npm run lint:report | ESLint report |
| npm run test:unit | Vitest unit/component tests |
| npm run build | TypeScript check and Web Vite build |
| npm run check:architecture | Feature dependency boundary checks |

### Authentication, session and PWA

- check:session
- check:cache
- check:pwa
- check:offline-browser
- check:onesignal
- check:push-deeplink
- check:incoming-sound
- check:incoming-sound-browser
- check:incoming-sound-sse
- check:desktop-session

### Messaging and conversations

- check:chat
- check:outbox
- check:optimistic
- check:chat-layout
- check:message-search
- check:message-search-ui
- check:message-readers
- check:chat-file-transfer
- check:message-clipboard
- check:message-clipboard-ui
- check:message-clipboard-browser
- check:chat-copy-image-proxy
- check:conversation-search
- check:categories
- check:chat-messaging-flow
- check:chat-conversation-flow
- check:scoped-state
- check:chat-scoped-ui-state

### Media, voice and translation

- check:media
- check:voice
- check:message-translation
- check:call-translation
- check:call-live
- check:call-room-display

### Feed, social and UI

- check:feed-api
- check:feed-requests
- check:social-ui
- check:smart-composer
- check:friends-redesign
- check:groups-redesign
- check:auth-redesign
- check:ui
- check:app-notifications
- check:call-ux

### E2EE

- check:e2ee-poc
- check:e2ee-pilot
- check:e2ee-auto
- check:e2ee-legacy-cutover

The E2EE commands cover different proof-of-concept and pilot paths. Their names do not imply production cryptographic acceptance.

## 2. Desktop commands

Run from desktop/ or use npm --prefix desktop:
- npm test — Node test runner over desktop/test/*.test.cjs.
- npm run build:web — build shared frontend in desktop mode.
- npm run build — build renderer and Electron directory package.
- npm run dist:mac / dist:win — distribution build commands requiring signing configuration.
- npm run dist:internal:mac / dist:internal:win — internal-only package builds.
- npm run manifest:internal — internal artifact manifest.

Desktop tests cover auth broker/vault, IPC policy, media permission, native notifications, screen capture, window lifecycle and packaging policies.

## 3. Backend commands

- go test ./... from backend/ — full Go package suite.
- Web/PWA CI runs a message idempotency integration test with disposable PostgreSQL and Redis.
- Desktop CI includes backend contract and disposable-database integration checks.

## 4. Mobile commands

From mobile/:
- dart analyze
- flutter test
- flutter build web --release

The current source inventory includes a Flutter widget test. Physical-device acceptance remains separate.

## 5. Test evidence state

This catalog records available commands and test areas only. It does not report any of these commands as PASS for the documentation workstream. Record actual run results in a dated execution report with SHA, environment and logs.

## 6. Maintenance

When package scripts or workflow commands change, update this catalog from package.json, Go test packages, pubspec and workflow source. Do not keep removed scripts as active instructions.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
