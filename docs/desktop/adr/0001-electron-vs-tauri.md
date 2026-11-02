# ADR 0001 — Electron cho phiên bản SOCO Desktop đầu tiên

**Ngày:** 30/10/2026
**Trạng thái:** ACCEPTED FOR INITIAL SPIKE (được chọn cho kế hoạch, cần xác minh bằng packaged app)
**Bối cảnh:** Web/PWA đã dùng Vite/React/TS, backend Go/Node, SSE, LiveKit WebRTC và Gemini translation thông qua backend. Team ưu tiên ra Beta Win/mac nhanh mà không nhân đôi UI/code.

## Decision

Chọn **Electron** cho Desktop giai đoạn đầu; tái sử dụng React/Vite hiện có, tạo Electron native shell riêng, phát hành macOS + Windows. **Không quyết định rằng Electron luôn tốt hơn Tauri cho mọi sản phẩm.** Tiêu chí ưu tiên ở đây: media compatibility, browser parity, debug và tích hợp dự án đang có.

## Alternatives

| Phương án | Ưu điểm | Hạn chế với ChatNet |
|---|---|---|
| Electron | Chromium đồng nhất hơn giữa Win/Mac, React/LiveKit web SDK quen thuộc, mature API tray/window/capture | binary lớn, RAM cao hơn, trách nhiệm security/Chromium update |
| Tauri 2 | nhỏ, tiết kiệm RAM, native WebView | Win (WebView2) và macOS (WKWebView) khác nhau, phải test sâu media/capture/permissions, Rust cho native |
| Native Swift + WinUI | UX/performance tốt từng OS | ít tái sử dụng React, 2 codebases, tăng effort |

Chốt Electron cho spike không có nghĩa bỏ qua Tauri vĩnh viễn: cân nhắc lại nếu packaged Electron RAM/startup không đáp ứng mục tiêu sau đo thực tế, hoặc nếu LiveKit/capture bị blocker không thể xử lý trong D1.

## Consequences & safeguards

1. Dùng Vite/React **package nội bộ**, không load mã remote trong privileged renderer.
2. Không copy backend hay tái thực hiện nghiệp vụ; dùng cùng Auth/Chat/Call APIs.
3. Bảo vệ `contextIsolation` + sandbox + typed IPC; không expose `ipcRenderer` hoặc Node APIs.
4. Native notifications/tray khác Web OneSignal SW; không giả định app quit vẫn nhận push.
5. Mac notarization và Win signed artifacts là release requirements, chưa được đánh dấu sẵn.
6. Auth Web hiện dùng localStorage chứa refresh token: tách secure Desktop auth boundary trước Beta.
7. Build `electron-vite` + `electron-builder`, `electron-updater` là **đề xuất công cụ** cần xác minh compatibility trước chốt lockfile.
8. LiveKit screen share/OS mic cam cần test trên signed binaries, không chỉ trên dev browser.

## Các dấu mốc xác minh tại D1

- Win/mac packaged renderer boot + CSP/IPC negative tests.
- Call audio/video 1:1 từ 2 thiết bị thật, có mic/camera permission request.
- Background/tray + notification khi minimized.
- Binary size, cold start, RAM idle và call load: lấy baseline từ thiết bị thật (chưa có số).
- Signing/notarization feasibility, update provider chosen.

## References

- Electron Security: https://www.electronjs.org/docs/latest/tutorial/security
- Electron Context Isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron desktopCapturer: https://www.electronjs.org/docs/latest/api/desktop-capturer
- electron-builder Auto Update: https://www.electron.build/docs/features/auto-update/

**Không được đổi ADR từ ACCEPTED FOR SPIKE sang PROVEN/RELEASED nếu chưa ghi kết quả kiểm thử.**
