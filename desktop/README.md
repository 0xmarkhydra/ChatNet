# SOCO Desktop — Electron Shell (DSK-001/002/003, first implementation batch)

Code nằm trên branch `feat/chatnet-desktop-electron`; **không merge vào dev/main hoặc public-release** cho đến khi P0 gates được xử lý.

## Development

Yêu cầu Node.js 24+, frontend dependencies và desktop dependencies.

```bash
npm --prefix frontend ci
npm --prefix desktop ci
# Terminal 1:
npm --prefix desktop run dev:web
# Terminal 2:
npm --prefix desktop run dev
```

Electron chỉ nhận Vite từ `http://127.0.0.1:5173` trong dev. Renderer production là app package riêng, không load trang web remote.

## Build / verify

```bash
npm --prefix desktop test
npm --prefix desktop run build:web
npm --prefix desktop run build    # unpacked application (no public installer)
```

`dist:mac` và `dist:win` chỉ chạy khi đã xác minh signing targets; `publish: null` nên không tự xuất bản.

## Giới hạn chưa hoàn thiện

- **P0 block:** renderer vẫn dùng Web `localStorage` cho refresh token. Chưa có secure vault adapter, không phát hành bản public.
- LiveKit mic/camera, screen share, notification/tray và auto-updater **chưa được UAT** trên binary cài thực tế.
- Main chặn navigation và popup, preload chỉ expose thông tin nền tảng + mở external allowlisted URLs.
- Web/PWA OneSignal và PWA Update được tắt trong chế độ desktop; native notifications chưa thay thế.
- Windows/macOS signing/notarization chưa cấu hình. `electron-builder --dir` chỉ phục vụ spike nội bộ.
- Nếu frontend/backend có yêu cầu cookie/CORS mới phải review endpoint khi thêm auth adapter; không thay backend bừa bãi.

Đọc `docs/desktop/README.md` và `docs/desktop/04_QA_RELEASE_GATES.md` trước khi gắn trạng thái DONE.
