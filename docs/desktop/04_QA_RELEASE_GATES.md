# SOCO Desktop — QA / Security / Release Gates

**QA status tại 30/10/2026:** B02 có 32 unit tests và packaged macOS native/vault/lifecycle smoke PASS; backend PostgreSQL/Redis integration PASS. Xem `07_BATCH_02_STATUS.md` để biết phạm vi chính xác. Login/chat/call hai thiết bị, Windows physical UAT, signed install/update/rollback vẫn NOT RUN/BLOCKED. Không suy rộng các kết quả này thành PASS toàn bộ QA-ID hoặc quyền phát hành.
**Release owner:** Integration Owner / Agent 5.

## 1. Môi trường bắt buộc

| Environment | Dùng để làm gì | Tối thiểu |
|---|---|---|
| macOS arm64 thật | Silicon, camera/mic, tray, notarization, auto-update | một máy dùng để UAT |
| macOS x64 hoặc build verified | Kiểm tra target Intel/packaging | cross-build + smoke trên máy Intel nếu tuyên bố hỗ trợ |
| Windows x64 thật | NSIS, notification, camera/mic/screen, startup, updater | một máy dùng để UAT |
| 2 account thật | Call, SSE/receive, read/unread, revoke, block | hai người/2 thiết bị khác |
| Web/PWA hiện tại | kiểm thử không regression khi share frontend | Chrome/Safari mobile smoke, Web CI |

Không kết luận macOS permission từ Vite Chrome test; cần **binary packaged** có Info.plist/entitlements đúng.

## 2. Automated checks (gate theo thứ tự)

1. `cd frontend && npm ci && npm run build`.
2. `cd frontend && npm run check:session && npm run check:chat && npm run check:outbox && npm run check:offline-browser`.
3. `cd frontend && npm run check:message-search && npm run check:incoming-sound && npm run check:call-live && npm run check:call-translation`.
4. `cd backend && go test ./...` (chạy khi thay đổi backend/API; bắt buộc trước integration/release).
5. `cd desktop && npm ci && npm run lint && npm run typecheck && npm run test && npm run build` — **đây là scripts mục tiêu, CHƯA TỒN TẠI**.
6. Release CI build signed macOS + Windows, kiểm tra manifest & hashes, chạy smoke packaged app.
7. Security CI: dependency audit, CSP/IPC tests, check không bundle secrets, binary update provenance.

CI chưa có thì trạng thái gate = `NOT RUN`, tuyệt đối không coi là PASS.

## 3. Chức năng / negative scenarios

| QA-ID | P | Kịch bản | Kết quả yêu cầu |
|---|---|---|---|
| QA-001 | P0 | cài mới, uninstall/reinstall, mở trên máy mới | khởi động bình thường, không cần Node |
| QA-002 | P0 | resize từ min size đến 1440p, màn hình thứ 2 rút ra | không vỡ khung, không mất window |
| QA-003 | P0 | login OTP, refresh, logout | đúng account; không lộ refresh token |
| QA-004 | P0 | revoke từ Web khi Desktop đang chạy | Desktop nhận hết hạn, không gọi API trái quyền |
| QA-005 | P0 | Desktop A gửi cho Web B, B đọc; thử ngược lại | 1 bản ghi đúng, read/unread đồng bộ |
| QA-006 | P0 | mất mạng trước POST / sau DB commit trước HTTP ACK | hàng đợi giữ, reconnect không tạo duplicate |
| QA-007 | P0 | đóng/mở app khi còn tin chờ | queue phục hồi, không trộn account |
| QA-008 | P0 | user A bị B block và còn tin/call/feed cũ | quyền server chặn đúng, không rò cached preview |
| QA-009 | P0 | notification khi cửa sổ mở/focus/minimized | đúng số lượng, không double notify, badge đúng |
| QA-010 | P0 | click thông báo khi session expired/không còn quyền | không mở lộ tin, login/re-authorize đúng |
| QA-011 | P0 | call audio/video 1:1 + nhóm 3 người, thay device | voice/video đúng, controls đúng, reconnect |
| QA-012 | P0 | deny mic/camera; sau đó user cấp quyền lại | app không crash, hướng dẫn rõ, không request loop |
| QA-013 | P0 | call minimize, wake/sleep, ngắt mạng | state recover hoặc báo lỗi, không call ảo |
| QA-014 | P0 | dịch call có consent / revoke consent | AI xử lý đúng speaker, ngừng khi stop, key backend |
| QA-015 | P1 | chia sẻ screen, cancel permission | không crash, tôn trọng OS, chỉ stream màn user chọn |
| QA-016 | P0 | malicious link `javascript:`/`file:`/`data:`/deep link giả | không mở system path, không gọi IPC trái quyền |
| QA-017 | P0 | preload IPC gửi payload lạ/quá lớn/khác frame | từ chối, log an toàn, không Node escape |
| QA-018 | P0 | XSS từ text/chat/metadata thử gọi Main | không có privileged command, auth vault không lộ |
| QA-019 | P0 | update N → N+1 khi còn outbox/đang login | install an toàn, không mất session/draft/queue |
| QA-020 | P0 | update feed mất mạng, download sai chữ ký | không cài, app cũ chạy, có retry |
| QA-021 | P0 | kill app/OS restart/reopen | không corrupt local state, fetch missed messages |
| QA-022 | P0 | Feed, Story, profile, privacy trên Desktop | parity với Web ở những feature đã chạy thật |
| QA-023 | P1 | Marketplace UI khi backend pending payment | không báo đặt/thu tiền thành công giả |
| QA-024 | P0 | verify installer, signing, notarization, SHA256 | artifact nguồn hợp lệ, không thay đổi sau publish |
| QA-025 | P0 | App đã quit hoàn toàn | không claim vẫn realtime push; mở lại sync được |

QA-001..025: **NOT RUN** cho đến khi tester ghi bằng chứng theo nền tảng.

## 4. Performance / reliability targets (đề xuất, cần baseline)

- Mở app từ cold-start: xác lập số liệu trên 2 thiết bị thật ở D1; không đặt SLA vô căn cứ.
- Theo dõi CPU/RAM idle, lúc 1:1 call, 3–5 người gọi và khi dịch; lưu version/OS/device.
- Queue offline 100 tin nhắn thử có giới hạn backend thực tế, nhưng không phá MAX_OUTBOX hiện hành; test từ ngưỡng thực tế `chatOutbox` đang hỗ trợ (tối đa 60 item/user) và không báo thành công sai.
- 30 phút gọi liên tục, suspend/resume, disconnect/reconnect, refresh access token, media leak.
- Không dùng screenshot để xác nhận gọi video/AI hoạt động; audio thật, caption và thông báo từ máy khác phải có evidence.

## 5. P0 release blockers không được override bằng “chấp nhận tạm”

- Token refresh lưu plaintext trong renderer/localStorage hoặc IPC không giới hạn.
- Bật `nodeIntegration`, tắt sandbox/contextIsolation/webSecurity, mở external protocol không allowlist.
- App tải remote script tùy ý hoặc updater không xác minh origin/chữ ký.
- Gọi video/dịch AI hiển thị thành công nhưng thực tế không truyền media; không có consent speaker.
- Mất hoặc trùng message sau reconnect.
- Push/notification để lộ nội dung bị chặn/tài khoản khác.
- Không có signed/notarized macOS bundle để phát hành cho người dùng cuối chính thức.
- Backend/Web regression P0 khi tích hợp code Desktop.

## 6. Release decision flow

```text
Desktop branch code
  → PR review + unit/integration tests
  → CI Web + Desktop build & security checks
  → Smoke packaged binary Windows + macOS
  → Signed artifacts + update/rollback UAT
  → Integration Owner signoff
  → PR vào dev (không tự động vào main)
  → release candidate → approved beta channel
```

Phát hành beta cần changelog, installer links, SHA256, ký/notarization, release notes nêu hạn chế đã biết, giám sát và rollback instructions. Không tự tạo deploy workflow dùng production secrets khi chưa approved.

## 7. Mẫu test evidence

| Field | Ví dụ / format |
|---|---|
| QA-ID | QA-006 |
| Branch / commit | `feat/chatnet-desktop-electron@<sha>` |
| Build | `SOCO-0.x.y-beta.n` + hash |
| Platform | `Windows x64 / macOS arm64` |
| Session / API env | staging, không chứa user/token thật |
| Steps | offline, gửi, mất ACK, reconnect |
| Expected / Actual | không tạo duplicate / số message |
| Result | PASS / FAIL / NOT RUN / BLOCKED |
| Evidence | CI job / screen recording redacted / test output |
| Tester / time | người kiểm thử, ISO timestamp |
| Bug / follow-up | issue ID, owner, severity |

**Chốt:** Beta P0 không được coi đạt chỉ vì `npm run build` thành công.
