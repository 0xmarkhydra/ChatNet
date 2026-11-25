# ChatNet — Rà soát tổng thể Flutter với PWA mobile (19/11/2026)

**Nguồn so sánh:** `origin/main` commit `bb73349` (PR #204). **Nhánh làm việc:** `feat/flutter-pwa-mobile-parity`. Duy trì Flutter native Dart, backend Go API dùng chung. Đây là **audit theo mã và test tự động**, **không phải xác nhận pixel-perfect hoặc chạy thử trên emulator**.

| Mảng | Đã có trên Flutter | Khác biệt / xác minh còn thiếu |
|---|---|---|
| Xác thực | Đăng nhập email/mật khẩu, OTP qua email, đăng ký OTP, chuyển chế độ, hiện/ẩn mật khẩu và xử lý lỗi. | Bước thiết lập tài khoản mới, ghi nhớ email, quản lý phiên như PWA chưa hoàn toàn tương đương; luồng OTP thực tế cần xác minh email. |
| Tin nhắn | Avatar rail, search tên hội thoại, channel picker dạng trượt, kênh, soạn tin, gửi media, tag/reaction/forward, thông tin nhóm/kênh, shared media. | Ghi âm giọng nói, polls/notes/reminders, full emoji, gửi offline/pending/retry, realtime nhiều thiết bị, E2EE MLS và quản trị nâng cao chưa đầy đủ. |
| Danh bạ/cuộc gọi | Danh bạ hợp nhất, bạn bè, nhóm, lời mời, QR, khám phá bạn bè, lịch sử cuộc gọi, cài đặt dịch AI cuộc gọi. | **Cuộc gọi thoại/video thực tế chưa được Flutter triển khai** (`call_surface.dart` từ chối account thật); demo chỉ mô phỏng, cài đặt dịch chưa gắn vào luồng WebRTC native. |
| Khám phá | Người ở gần, trạng thái friend request, bật/tắt chia sẻ có xác nhận, thời hạn, lọc bán kính và danh mục địa điểm, bản đồ với điều khiển. | GPS/permission thực, tile OSM/Overpass, mở chỉ đường, timeout/rate limit và các thao tác touch chưa được thử trên thiết bị. |
| Newsfeed | Story media và văn bản, tạo/sửa/xóa bài, đăng lại quick/quote/undo, bình luận/thích, chia sẻ qua chat, cộng đồng trên feed. | Một số controls reaction, story viewer/report, feed Đang theo dõi, infinite scroll và behavior mạng offline có thể thiếu; xem tài liệu Newsfeed riêng. |
| Cá nhân | Profile/cover/avatar, thông tin danh tính, privacy, ngôn ngữ, QR, thông báo; thêm 4 tab Bài viết/Ảnh & video/Giới thiệu/Bạn bè và đi tới Danh bạ/chi tiết bài. | Profile note, social sidebar/đề xuất, hành vi gallery và đồng bộ media theo PWA chưa thử trên dữ liệu thật. |
| Thông báo | Danh sách incoming invitations, tin nhắn chưa đọc, feed mentions; bộ lọc; chuyển tới tin nhắn/bài viết. | OS push/OneSignal và thông báo cuộc gọi đến trên Flutter chưa đạt đầy đủ PWA; phụ thuộc background lifecycle. |
| Điều hướng | 5 tab, thanh dưới nổi bật có hoạt ảnh, chat ẩn thanh khi vào tin, deep link nội bộ, giữ state khi đổi tab. | Cần kiểm thử chuyển trang FPS, memory, PWA bubble đàn hồi, resize/vuốt trên thiết bị thật. |

## Chất lượng mã và kiểm thử

- Có widget tests cho Tin nhắn/kênh, Danh bạ, Khám phá, Newsfeed, Cá nhân, đăng nhập, thông báo, navigation và lớp dữ liệu Riverpod.
- `flutter analyze --no-pub`, `flutter test --no-pub --reporter compact`, `git diff --check` là các lệnh kiểm tra bắt buộc trước khi đánh giá hoàn tất.
- Có tài liệu chi tiết: `flutter-chat-pwa-parity.md`, `flutter-contacts-pwa-parity.md`, `flutter-discover-pwa-parity.md`, `flutter-newsfeed-pwa-parity.md`.
- Chỉ test tự động với `DemoApi` **không** chứng minh dữ liệu backend Railway, push notifications, âm thanh/video hoặc tính tương đương pixel. Muốn xác nhận đó phải chạy app/thiết bị Android, nhưng **người dùng đã yêu cầu chưa chạy thử**.

## Các ưu tiên còn lại

1. **P0:** Native realtime audio/video + incoming call thực, xin quyền camera/microphone và media/E2EE; không dùng màn mock báo connected.
2. **P0:** Xác minh auth/OTP và online/offline multi-device messaging, retry, permission media với backend thật.
3. **P1:** Hoàn thiện media/gallery, story actions, reaction/comment/mention, voice recording, group management theo PWA.
4. **P1:** Snapshot UI Android vs PWA cùng viewport và dữ liệu, chuyển tab và animation để xác nhận tương đương trực quan.

**Trạng thái:** Giữ nguyên trên nhánh `feat/flutter-pwa-mobile-parity`; **không mở app, không bật emulator, không commit/push/merge** nếu chưa có chỉ định.
