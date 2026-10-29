# SOCO Desktop — Technical Architecture v1

**Kiến trúc dự kiến — chưa có mã Electron.** Quyết định runtime: [ADR 0001](adr/0001-electron-vs-tauri.md).

## 1. Các tầng và dependency

```text
                         SHARED REACT UI (frontend/src)
         Chat / Feed / Friends / Marketplace / LiveKit / Translation
                                      |
               Platform Adapter (Web or Desktop)
                     /                         \
             Browser/PWA               Electron renderer
         Web Push / web storage         local packaged UI
                                              |
                                   typed preload bridge (IPC)
                                              |
                                      Electron main
                          Window/Tray/Notifications/OS secure vault
                                              |
                          HTTPS/WSS ---- ChatNet API Gateway
                                         |
                    Auth | Chat | Feed | Call | Translation
                              PostgreSQL | Redis
                                LiveKit | Gemini backend
```

Không xây backend mới và không cho Renderer trực tiếp dùng Node/fs/shell. React có khả năng chạy trong browser như trước khi build cho Desktop. Service Worker hiện tại là concern của Web/PWA; desktop không dùng Web Push / OneSignal SW làm nguồn thông báo native.

## 2. Repo layout *đề xuất khi bắt đầu code* (chưa tạo)

```text
ChatNet/
  frontend/                   # React/Vite Web dùng chung
    src/
      app/
      features/
      shared/
      platform/               # adapters và lựa chọn platform ở entrypoint (nếu cần)
  desktop/
    package.json
    src/
      main/                   # Electron main (process đặc quyền)
        index.ts
        window.ts
        permissions.ts
        notifications.ts
        updates.ts
        authVault.ts
      preload/
        index.ts              # contextBridge, typed, least privilege
      shared/
        ipc-contract.ts       # contract request/response/event
    assets/
    electron-builder.yml
    electron.vite.config.ts
  docs/desktop/
  .github/workflows/desktop-ci.yml
```

Điều chỉnh layout theo thực tế project ở DSK-001, không copy nguyên `frontend/src` sang `desktop/src`. Từ đầu phải chọn một cơ chế build duy nhất (electron-vite + electron-builder đề xuất) và khóa phiên bản dependency bằng lockfile.

## 3. Render và navigation

- **Production:** load JS/CSS/HTML packaged cùng ứng dụng qua **custom secure app protocol** (ưu tiên `app://`/scheme đã khai báo secure/standard); không tải `https://chat.codelocal.cloud` trực tiếp vào renderer có preload đặc quyền.
- **Dev:** Vite localhost, whitelist chính xác origin trong chế độ development. DevTools và hot reload chỉ bật trong development.
- `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`, `webSecurity=true`; CSP chặt, không `eval` hoặc `allowRunningInsecureContent`.
- `setWindowOpenHandler` chặn popup ngoài app, mọi `will-navigate` không mong muốn bị từ chối. Link ngoài mở qua `shell.openExternal` **chỉ sau khi parse URL và allowlist scheme `https:`**; không mở `file:`/`javascript:`/`data:`/`custom://` tùy ý.
- Có single-instance lock theo mặc định; deep link `soco://conversation/{id}` chỉ xử lý ID hợp lệ sau khi login và backend xác nhận membership. Hỗ trợ Windows argv + macOS open-url; không đưa token vào deep link.
- Window kích thước lần mở gần nhất được lưu **sau khi kiểm tra bounds/monitor hiện tại**; không để cửa sổ mất ngoài màn hình.

## 4. IPC Contract v1: tối thiểu, có kiểm soát

**Nguyên tắc:** preload không expose `ipcRenderer` nguyên bản; Main kiểm tra `event.senderFrame`/origin, kích thước, schema và quyền của mọi call.

| Renderer → Main (method đề xuất) | Tác dụng | Kiểm soát |
|---|---|---|
| `desktop.getPlatformInfo()` | OS + app version (không trả path nhạy cảm) | read-only |
| `desktop.showNotification(payload)` | native notification | title/body giới hạn, chỉ từ authenticated app; sanitize |
| `desktop.setBadge(count)` | icon badge/tray | integer 0–99+ |
| `desktop.openExternal(url)` | mở link https trong browser | https allowlist/confirm |
| `desktop.getMediaPermission(kind)` | trạng thái mic/cam/screen | enum chặt, OS permissions |
| `desktop.selectScreenSource()` | screen/window picker | UI thực, explicit action |
| `desktop.appUpdate.check()/install()` | cập nhật | chỉ từ feed ký và user action |
| `desktop.auth.*` | kho refresh token qua main | contract riêng, fail-closed, không trả refresh token plaintext |

Các event Main → Renderer chỉ gồm: `notification-clicked(conversationId)`, `deep-link(id)`, `update-status`, `window-focus` (nếu cần). Không truyền token, path hệ thống hoặc native object trong event.

## 5. Auth & secure storage — rào chắn P0

**Hiện trạng cần xử lý:** `frontend/src/features/auth/session.ts` và UI vẫn dùng `localStorage('chatnet-session')` chứa session/refresh token. Không được coi đóng gói React nguyên trạng là production-secure Desktop.

Lộ trình triển khai:
1. Tách một `SessionStorageAdapter` / boundary tối thiểu mà **Web vẫn giữ cơ chế tương thích**; không thay backend auth contract.
2. Desktop Main lưu **refresh token** bằng keychain/OS protected secret vault (Electron `safeStorage` phù hợp nếu encryption available, hoặc credential store). Nếu OS encryption không khả dụng, không tự fallback plaintext: yêu cầu login lại.
3. Renderer chỉ giữ **access JWT sống ngắn trong bộ nhớ** để gọi API; refresh/logout qua API bọc bởi Main trong allowlisted flow, không xuất secret dài hạn qua IPC.
4. Sau refresh/revoke/logout, clear session + outbox + cache theo account đúng policy; browser Web không bị logout chỉ vì Desktop thoát.
5. Chặn IPC cross-window spoofing, race giữa refresh và revoke; đảm bảo CSRF/Origin/CORS backend phù hợp với custom protocol.
6. Endpoint SSE hiện dùng query `?token=` do EventSource; đánh giá khả năng chuyển sang stream broker/ticket ngắn hạn (không thay protocol tùy tiện) và đảm bảo không log URL/token. Đây là security risk cần signoff trước beta.

Không ghi secret vào error telemetry, crash dump custom metadata, update logs hoặc JS console.

## 6. Message / offline / multiple windows

- Dùng API Chat hiện tại, SSE event, idempotency key `clientId` và `chatOutbox` đã có; không tạo queue server thứ hai.
- D1 xác minh cache/storage chuyển từ Web sang custom protocol có được, không làm mất queue khi update. Nếu cần migrate từ browser sang desktop, làm thủ công có consent; **không tự đọc profile browser**.
- Outbox giữ thứ tự enqueue, retry cùng `clientId` khi POST ambiguous; user thấy queued/unconfirmed/failed; server vẫn xử lý write authorization.
- Runtime native chỉ có **một nơi điều phối notification**; window focused trên conversation không ping/ding trùng; minimized → native Notification.
- Luồng multi-tab Web và Desktop phải hoạt động đồng thời, nhưng **mỗi OS app chỉ có một instance** trong MVP.

## 7. Call, screen share, AI translation

- LiveKit JS dùng từ React không đổi signaling/backend; E2EE/session/permission theo code hiện có.
- Mac và Windows phải kiểm tra microphone/camera device switching, reconnect khi suspend/resume, call khi window minimize, screen capture permissions.
- Electron hỗ trợ `desktopCapturer`/`setDisplayMediaRequestHandler` nhưng hành vi âm thanh chia sẻ màn hình khác theo OS và version; không cam kết “chia sẻ cả tiếng máy” trước spike thật.
- Tài liệu đồng ý dịch và giới hạn quyền: `docs/CALL_LIVE_TRANSLATION_WEB.md`. Gemini API key và model/provider URL chỉ ở backend. Desktop không cần Gemini SDK.
- Call window tách nổi và media controls là P1 trừ khi được quyết định nâng vào beta. Không tự ghi âm hay ghi phụ đề lên đĩa.

## 8. Notification / background / lifecycle

- OS notification dùng Electron Notification. Sự kiện nhận tin qua SSE trong renderer hiện đang chạy, kể cả ẩn cửa sổ **nếu còn process**; tại D1 xác nhận behavior sleep/wake và macOS tray.
- Chính sách `close`: mặc định đóng cửa sổ -> hide to tray chỉ khi có icon tray và user đã được thông báo lựa chọn; có menu Quit đóng hẳn.
- Khi app quit, **không claim có push nền**; sau mở lại fetch missed events qua API.
- Badge số unread đồng bộ từ server, không tự cộng lặp khi reconnect; preview nội dung nhạy cảm tùy setting.

## 9. Build, signing, updater

- Electron target: Windows x64 installer (NSIS), macOS arm64 + x64 (DMG/ZIP update artifacts); kiến trúc tối thiểu cần test cả Apple Silicon và Intel hoặc minh chứng tương thích.
- Tạo signed/notarized binary trên CI với secrets, artefact immutable + SHA256 + metadata release; không cho user tải build dev như bản production.
- Dùng `electron-builder` + `electron-updater` nếu spike đạt. macOS updater cần ký; Windows code signing nên có trước external beta.
- Feed update `alpha` → `beta` → `stable` rõ ràng, không tự nâng stable từ alpha mà không cho phép; check signature, không thực thi script từ server.
- Rollback: giữ bản build trước, khả năng cài lại gói đã ký; mọi thay đổi DB/local cache phải backward compatible. Không xóa offline queue khi cập nhật.

## 10. Rủi ro & phương án giảm

| Rủi ro | Mức | Cách xử lý |
|---|---|---|
| Refresh token đang ở localStorage | **BLOCKER P0** | Secure auth adapter + negative test XSS/IPC |
| SSE có access token trong query | **BLOCKER review** | giảm log, ticket/broker khi khả thi, signoff |
| LiveKit/mic/camera trên packaged binary | P0 | smoke 2 OS, không chỉ browser dev |
| Screen sharing + system audio khác OS | P1 | explicit spike, degradations rõ ràng |
| OneSignal SW không chạy native | P0 | native notifier dùng realtime, không double notify |
| Update unsigned/unverified | **BLOCKER P0** | signing, notarization, hash, rollback |
| Chia sẻ React làm hỏng Web/PWA | P0 | CI Web regression + feature gates riêng |
| Bundled Chromium tăng RAM/binary | Theo dõi | đo cold start/RAM, tách bundle sau benchmark |

## 11. Tài liệu kỹ thuật tham chiếu

- Electron Security: https://www.electronjs.org/docs/latest/tutorial/security
- Electron Context Isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron desktopCapturer: https://www.electronjs.org/docs/latest/api/desktop-capturer
- electron-builder Auto Update: https://www.electron.build/docs/features/auto-update/

**Lưu ý:** Đây là thiết kế tham chiếu. Các lựa chọn keychain, custom protocol, auth gateway và installer chỉ đánh dấu DONE sau spike + test thật.
