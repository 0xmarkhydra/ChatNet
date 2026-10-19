# CHATNET Agent 1 — Identity, Friends & Privacy handoff

**Ngày:** 2026-10-19

**Nhánh:** `feat/chatnet-a1-identity-friends` (từ `origin/main`, commit gốc `348f91d`)

**Feature commit:** `624648c` (`feat(friends): improve contacts search and safe friend actions`).

**Worktree:** `.worktrees/chatnet-a1-identity-friends`

**Phạm vi:** Web/PWA, backend Go, frontend React; không sửa mobile native.
**Nguồn backlog:** `docs/CHATNET_WEB_PWA_MASTER_TASKS.md` (tài liệu hiện chỉ có ở checkout chính dưới dạng file untracked, chưa nằm trong branch này).

## Thay đổi đã triển khai ở nhánh Agent 1

- **FR-01/02:** Tab Danh bạ nay hiển thị kết quả tìm ngay trong tab, ghép kết quả API với bạn bè/lời mời sẵn có, trạng thái quan hệ rõ ràng; giữ debounce 250ms, AbortController, loading, empty, error/retry và xóa truy vấn.
- **FR-04:** Bạn bè hiển thị display name + username, nút chat nhanh và menu ba chấm riêng (xem tóm tắt hồ sơ, nhắn tin, hủy kết bạn). Hủy kết bạn có xác nhận.
- **FR-07:** Thay khóa action toàn cục bằng khóa theo user ID để không khóa toàn trang; backend DELETE cho phép `direction=accepted` và chỉ xóa quan hệ accepted, tránh xóa một lời mời mới do race/stale action.
- **FR-17/privacy:** API gợi ý không liệt kê người đã tắt cả searchable_by_username và searchable_by_name; API tìm người theo email chỉ khớp email nếu `searchable_by_email`, không gửi trường email cho client.
- **Kiểm thử:** Mở rộng integration test để xác nhận hủy kết bạn `direction=accepted` và từ chối kiểu xóa accepted trong lúc vẫn pending.
- **Đợt tiếp (FR-03/05/16):** Có GET/PUT `/api/privacy` (auth + no-store), 5 công tắc riêng tư ở Hồ sơ, schema mặc định tương thích ngược, Gateway proxy sang Chat service, backend từ chối lời mời mới khi người nhận không cho phép và giấu trạng thái online trong danh sách lời mời/bạn bè, tìm kiếm và gợi ý. Tìm theo email chỉ trả về định danh công khai khi đã opt-in, không trả email.
- **Lưu ý tích hợp:** Đã chạm `backend/cmd/gateway/main.go` đúng 1 tuyến `/api/privacy` để FE gọi API thật; Agent 5 review route khi tích hợp. Block/report và quyền riêng tư trong Call service vẫn cần phối hợp Agent 3/5.
- **Đợt bảo mật bổ sung (P0):** Trạng thái online trong danh sách chat 1–1, phản hồi tạo chat, danh sách thành viên nhóm và Nearby được ràng buộc bởi `show_online_status` từ PostgreSQL, không chỉ presence Redis. API PUT privacy bắt buộc đủ 5 trường boolean, tránh vô ý lưu `false` hàng loạt. Auth giới hạn 4KB/JSON strict cho đăng ký, xác thực OTP, gửi lại OTP và login; refresh/logout chỉ chấp nhận JSON 1KB/strict và reject trailing payload. Middleware chỉ cho token trên URL ở GET `/api/events` do trình duyệt EventSource không thiết lập được header Authorization. Đây là giảm bề mặt lộ token, không xóa bỏ rủi ro log URL SSE.
- **FR-09:** Bổ sung test gửi tạo chat 1–1 đồng thời từ hai tài khoản, bảo đảm cùng conversation ID và chỉ một direct_key trong PostgreSQL.

## Phân loại toàn bộ 34 task

Quy ước: **Cần cải tiến** nghĩa là có một phần luồng/đã sửa một phần, nhưng **chưa đủ kiểm thử để kết luận đạt**. Không tick Done chỉ vì build/unit test pass.

| Task | P | Trạng thái | Lý do / bước còn thiếu |
|---|---|---|---|
| FR-01 | P0 | Cần cải tiến | Đã nối UI tìm trong Danh bạ và API quyền tìm; chưa test 2 browser + 7 kích thước |
| FR-02 | P0 | Cần cải tiến | Debounce/abort/error/retry đã có; cần test mạng chậm, timeout và race trên trình duyệt |
| FR-03 | P0 | Cần cải tiến | Đã ẩn online theo opt-in ở Friends/search API; avatar còn fallback, các luồng presence khác chưa kiểm đủ |
| FR-04 | P0 | Cần cải tiến | Menu và xác nhận hủy đã code; hồ sơ mới là preview tối thiểu, cần UX/a11y/E2E |
| FR-05 | P0 | Cần cải tiến | API chặn lời mời mới khi người nhận tắt quyền (integration PASS); cần case refresh/lỗi mạng/đa tab |
| FR-06 | P0 | Cần cải tiến | Accept/decline + push + Redis integration PASS; chưa E2E browser/push thật |
| FR-07 | P0 | Cần cải tiến | Lock theo ID, accepted guard và integration PASS; cần stress/race nhiều tab |
| FR-08 | P0 | Cần cải tiến | `friend.updated` Redis 2 account integration PASS; SSE reconnect và browser đa tab chưa kiểm |
| FR-09 | P0 | Cần cải tiến | Đã thêm kiểm thử 12 request song song hai chiều, cùng conversation ID, không có direct_key trùng; vẫn thiếu full browser E2E |
| FR-10 | P1 | Cần cải tiến | Có 4 khu vực, badge chờ xử lý và đồng nhất mobile chưa đủ |
| FR-11 | P1 | Cần cải tiến | Có lọc client/tìm server, chưa chuẩn hóa dấu tiếng Việt và sort dài |
| FR-12 | P1 | Cần cải tiến | Chỉ có public preview cơ bản; thiếu hồ sơ đầy đủ/quyền/đường dẫn từ mọi bề mặt |
| FR-13 | P1 | Cần cải tiến | Có ProfileQr, chưa xác minh browser camera/deep link/PWA |
| FR-14 | P1 | Chưa có | Chưa có policy block/unblock xuyên search, chat, calls, nhóm |
| FR-15 | P1 | Chưa có | Thiếu report user đầy đủ, kiểm duyệt, chống spam |
| FR-16 | P1 | Cần cải tiến | Có 5 công tắc Web/PWA lưu DB và enforce Friends/search; vẫn thiếu privacy profile/call/nearby/toàn hệ thống |
| FR-17 | P2 | Cần cải tiến | Có mutual groups, giới hạn gợi ý riêng tư bước đầu; thiếu hide/block/consent |
| FR-18 | P1 | Chưa có | Nickname riêng per-contact đồng bộ server |
| FR-19 | P1 | Chưa có | Favorite/phân loại/nhóm liên hệ |
| FR-20 | P1 | Chưa có | Ghi chú riêng per-contact |
| FR-21 | P1 | Chưa có | Lịch sử lời mời/anti-harassment đầy đủ |
| FR-22 | P1 | Chưa có | Quota lời mời theo ngày và UX cảnh báo |
| ACC-01 | P0 | Cần cải tiến | Đã có auth/session; cần E2E OTP/refresh/logout/đa phiên |
| ACC-02 | P0 | Cần cải tiến | JWT/session hiện có, chưa hoàn thành audit cookie/rotation/revocation |
| ACC-03 | P0 | Cần cải tiến | Đã có Redis rate limiting, OTP attempts và test strict/4KB body; còn audit proxy IP spoof, enumeration, UAT và load |
| ACC-04 | P0 | Cần cải tiến | Có form sửa hồ sơ/ảnh, cần IDOR/media visibility tests |
| ACC-05 | P1 | Chưa có | Quy trình hoàn chỉnh đổi/quên mật khẩu, email, device sessions |
| ACC-06 | P1 | Cần cải tiến | Có UI ngôn ngữ/translation/push; cần cross-device permission/persistence |
| ACC-07 | P1 | Chưa có | Xóa tài khoản, export dữ liệu và retention/terms |
| ACC-08 | P1 | Chưa có | Tìm tổng hợp có enforcement privacy/block |
| ACC-09 | P1 | Cần cải tiến | Có ảnh bìa, thiếu bio/links public profile và quyền từng field |
| ACC-10 | P1 | Chưa có | Xuất dữ liệu/yêu cầu xóa, tiến độ xử lý |
| SEARCH-01 | P1 | Chưa có | Global federated search trên chat/group/feed/media với phân quyền |
| SEARCH-02 | P1 | Chưa có | Lọc loại, recent, lịch sử/xóa lịch sử và layout ổn định |

## Kiểm thử và bằng chứng (2026-10-19)

- **PASS:** `git diff --check` trên worktree Agent 1.
- **PASS:** `go test ./...` chạy toàn bộ backend (các module không có test được Go báo rõ).
- **PASS:** `npm run build` tại frontend: TypeScript `tsc --noEmit` + Vite production build.
- **PASS:** `npm run check:session`: refresh, concurrency, legacy migration, offline, expiry, stale response, bounded retry.
- **PASS (mock UI):** `npm run check:ui`: 42 viewport/screen checks về layout, overflow, profile stacking dùng dữ liệu/session mô phỏng. Đây không phải E2E hai tài khoản thực.
- **PASS:** `TestFriendRequestsIntegration` với 2 user/token độc lập trên PostgreSQL 17 và Redis 7.4 container riêng Agent 1: gửi, gửi chéo, chấp nhận, từ chối, cancel, unfriend, Redis `friend.updated` hai phía và conflict.
- **PASS:** `TestPrivacyIntegration` sử dụng 2 tài khoản và PostgreSQL/Redis riêng: GET/PUT riêng tư, tắt search/nhận lời mời, chặn tạo liên kết qua API, email không bị trả ra, opt-in online được phản ánh trong danh sách bạn bè. Không sử dụng dữ liệu production.
- **NOT RUN:** E2E thực tế trên 2 browser profiles đăng nhập độc lập; kiểm tra offline/weak network/F5 nhiều tab, kích thước 320/375/390/430/768/1024/1440, quyền camera và iOS PWA.
- **PASS:** Backend auth integration trên PostgreSQL + Redis: OTP/attempt lockout/atomic consumption, session refresh/logout và JSON 4KB/strict regression.
- **PASS:** JWT regression: query token chỉ được chấp nhận ở GET `/api/events`, REST yêu cầu bearer header; token query SSE vẫn cần privacy/security review khi ghi log.
- **PASS:** PostgreSQL/Redis privacy integration cho chat/direct và nhóm, 12 lượt tạo chat 1–1 song song hai phía trước khi thêm test Nearby.
- **CHƯA XÁC NHẬN:** Test mở rộng Nearby ẩn/hiện online mới thêm chưa được thực thi lại ở môi trường tích hợp vì công cụ thực thi chặn lệnh chạy có biến môi trường database/Redis; Go tests không có env vẫn PASS (test integration SKIP). Không gọi test chưa chạy là PASS.
- **NOT RUN:** Review security toàn diện JWT/IDOR, brute-force qua X-Forwarded-For/trusted-proxy, mọi service Calls, API media và load test.
- **Tồn tại:** Vite build cảnh báo chunk >500KB; profile người khác mới là preview nhỏ, chưa phải màn profile P1 đầy đủ.

## Kế hoạch xử lý tiếp (P0 trước P1)

1. Nghiệm thu FR-01..09 bằng browser profiles A/B và HTTP độc lập, throttled/offline, multi-tab SSE reconnect; bổ sung regression test UI/IDOR.
2. P0 ACC-01..04: auth OTP enumeration/brute force, JWT rotation/revocation, media/profile authorization; đảm bảo không lộ email/presence.
3. P1 FR-10..16 rồi FR-18..22: block/report/privacy enforcement, full public profile + QR, badge, contact organization/history; sau đó ACC-05..10 và SEARCH-01/02.
4. Integration review, UAT mobile Web/PWA và chỉ merge `dev` khi toàn bộ gate đạt. Không merge/deploy tự động.

**Không được diễn giải các sửa đổi đã có thành 100% Done.** Handoff ghi rõ thiếu E2E và việc cần làm; quyền của Agent khác không bị thay đổi.
