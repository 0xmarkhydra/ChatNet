---
document_id: DESK-ARC-001
title: SocCO Desktop Electron Architecture
version: 1.0.0
status: Draft
owner: Desktop Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# SocCO Desktop Electron Architecture

## Tóm tắt

Main quản lý quyền native, Preload cung cấp IPC hẹp, renderer dùng chung React. Bằng chứng B05 chỉ áp cho bản internal đã nêu, không chứng minh signing, updater hoặc UAT hiện tại.

## 1. Current source status

The committed source baseline contains an Electron 45.1.0 shell in desktop/ and a shared React renderer built from frontend/ in desktop mode. The shell is implemented in source; this does not establish a signed, notarized or fully accepted public release.

## 2. Process architecture

| Layer | Source | Responsibility |
|---|---|---|
| Main | desktop/src/main.cjs | BrowserWindow, app protocol, API origin, native permission handlers, lifecycle and trusted-frame checks |
| Preload | desktop/src/preload.cjs | Frozen, narrow contextBridge API |
| Renderer | frontend/ with desktop build mode | Shared React application |
| Platform adapter | frontend/src/platform/desktop.ts | Typed renderer-side Desktop bridge |
| IPC policy | desktop/src/ipc-policy.cjs | Trusted renderer origin and safe external URL policy |
| Auth broker / IPC | desktop/src/auth-broker.cjs, auth-ipc.cjs | Server auth requests and session lifecycle |
| Credential vault | desktop/src/auth-vault.cjs | Encrypted credential record in app user data |
| Native notifications | desktop/src/notifications.cjs | OS notifications and unread badge |
| Media permissions | desktop/src/media-permissions.cjs | Camera/microphone permission flow |
| Screen capture | desktop/src/screen-capture.cjs | User-gesture-scoped screen/window picker |
| Window lifecycle | desktop/src/window-lifecycle.cjs | Tray, window state and taskbar/dock badge |

## 3. Trusted renderer boundary

The production renderer origin is app://soco. The development origin is http://127.0.0.1:5173. Main checks that privileged IPC originates from the current BrowserWindow main frame and a trusted renderer URL.

The shell:
- denies arbitrary window-open requests;
- blocks unexpected navigation and redirects;
- prevents webview attachment;
- handles native permissions only for the trusted main frame;
- validates external URLs against an allowlist;
- resets native grants when navigation or renderer lifecycle changes invalidate the current scope.

The renderer must not receive unrestricted ipcRenderer access.

## 4. Preload contract

Preload exposes a frozen socoDesktop object containing:
- platform information and safe external navigation;
- notification sync/show/clear/dismiss and click subscription;
- media permission status/request;
- screen picker selection and picker subscription;
- auth restore/verify/refresh/logout/session management and expiry subscription.

The typed renderer contract is in frontend/src/platform/desktop.ts. Adding a native capability requires a reviewed IPC policy, strict input validation and tests.

## 5. Credential vault

The Desktop auth broker communicates with the configured Auth API and stores a constrained credential record through Electron safeStorage. The record is written under the application user-data directory as session.bin. The vault validates the record shape and encryption availability and uses a temporary file for replacement.

The current vault explicitly supports darwin and win32 when Electron safeStorage reports encryption available. Do not assume equivalent secure storage on Linux.

Refresh and session management are guarded by session identity/generation checks. The renderer receives a public session shape, while refresh credentials remain in the Main-owned vault.

## 6. Native notifications and badge

Native notification payloads are intentionally metadata-only. The implementation does not pass message text, names, avatars, credentials or external URLs into the OS notification store. Notification actions are scoped to the active session and deduplicated by event identity.

The window lifecycle module updates platform-native unread indicators, including Windows overlay badge and macOS dock badge. The notification module resets active state when the session scope changes.

## 7. Media permissions and screen capture

Camera/microphone permissions are requested through Main and scoped to the current session. Screen capture requires a user gesture, trusted main-frame context, active session and a one-time picker record. The user selects a screen/window source through the picker; renderer code cannot directly obtain unrestricted desktopCapturer access.

## 8. API origin and packaging

The current Main source selects a local API origin for development and the configured ChatNet API origin for packaged mode. Packaging scripts include:
- npm run dev;
- npm run build;
- npm run dist:mac;
- npm run dist:win;
- npm run dist:internal:mac;
- npm run dist:internal:win;
- npm test;
- npm run check.

The package config targets macOS DMG/ZIP and Windows x64 NSIS. The Windows installer does not delete application data on uninstall.

## 9. Historical release evidence and blockers

The retained B05 report dated 2026-10-31 records internal Windows x64 and macOS arm64/x64 artifact builds, but it explicitly did not approve production release. It records:
- Windows runtime/install and physical Intel Mac smoke as NOT RUN;
- signing identity and Apple notarization prerequisites as BLOCKED;
- signed runtime updater and rollback as not implemented/BLOCKED;
- GitHub CI jobs blocked by an account billing lock at the time of that report;
- real-device, real-call and signed-release UAT as NOT RUN.

These are historical statuses and must be rechecked before a current release decision. Local build or internal artifact presence is not a release approval.

## 10. Desktop verification

Desktop tests are in desktop/test and cover auth, media permissions, notifications, packaging, screen capture, security and window behavior. The Desktop CI workflow defines a Windows x64, macOS arm64 and macOS Intel matrix, plus backend integration checks.

A current successful build does not prove signing, notarization, Windows runtime acceptance, updater safety or cross-device notification/call behavior.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
