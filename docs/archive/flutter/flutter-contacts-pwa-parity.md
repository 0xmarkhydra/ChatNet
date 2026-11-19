# Rà soát Flutter Danh bạ và màn con so với PWA Mobile main (18/11/2026)

**Nhánh:** `feat/flutter-pwa-mobile-parity`; đối chiếu mã `origin/main` các thành phần `UnifiedContactsPage`, `ContactsView`, `ContactFriendProfile`, `ContactInvitations`, `ContactsOverview`, `ContactQrPanel` và `CallCenter` phía React PWA. Không cập nhật nhánh main, không commit/merge. Flutter vẫn native Dart.

## Màn đã đối chiếu và sửa

| Màn / hành vi | Thực hiện |
|---|---|
| Danh bạ hợp nhất | Sáu mục: Danh sách bạn bè, Danh sách nhóm, Lời mời kết bạn, Lịch sử cuộc gọi, Khám phá bạn bè, Dịch AI cuộc gọi |
| Danh sách bạn bè | Giữ tìm kiếm và bộ lọc A-Z / online / yêu thích, đồng bộ yêu thích + biệt danh từ `GET /api/contacts` |
| Chạm một bạn bè | Hiện modal hồ sơ theo ngữ cảnh mobile, không tự chuyển sang chat; hành động tin nhắn / gọi thoại dạng icon |
| Tùy chọn hồ sơ | `PUT /api/contacts/:id` biệt danh (60 ký tự), ghi chú (1500 ký tự), yêu thích; chặn/bỏ chặn (`/api/users/:id/block`), báo cáo (`/api/users/:id/report`), hủy kết bạn có xác nhận |
| Tìm người dùng mới | Dùng `contactSearchProvider`, không chỉ lọc danh bạ cục bộ; hiển thị trạng thái quan hệ và nút hành động |
| Danh sách nhóm | Hiển thị nhóm + liên hệ chưa kết bạn từ cuộc trò chuyện, tìm tên nhóm/liên hệ |
| Lời mời kết bạn | Tab Lời mời đến / Đã gửi / Quét QR đều có chiều rộng vừa điện thoại, nhận/từ chối/hủy đúng hướng request, có số lượng |
| QR | Mã QR của bản thân, sao chép link, quét camera, hỗ trợ quét qua ảnh trong trình QR dùng chung |
| Khám phá bạn bè | Thống kê bạn bè / lời mời / số gợi ý, các lời mời gần nhất, đề xuất kết bạn |
| Lịch sử cuộc gọi | Thống kê cuộc gọi tháng này & gọi nhỡ, tìm kiếm riêng, lọc tất cả/nhỡ/gọi đi/nhóm, chi tiết, trạng thái theo PWA, 00:00 cho cuộc gọi không kết nối |
| Dịch AI cuộc gọi | Giao diện cài đặt tương ứng PWA: tự động bật, ngôn ngữ, chế độ phụ đề, xem trước và minh bạch quyền riêng tư; cài đặt thiết bị qua `flutter_secure_storage` và catalog `/api/calls/translation/languages` |
| Mẫu kiểm thử | `mobile/test/contacts_screen_parity_test.dart` 7 bài dùng `DemoApi`, cùng hồi quy test cũ theo luồng hồ sơ mới |

## Chưa đủ căn cứ kết luận giống 100%

- Chưa có kiểm tra **snapshot từng pixel** song song PWA/Flutter trên cùng kích thước, font và nội dung thật.
- Chưa thử **gọi thoại/video thực tế, permission camera/micro, dịch cuộc gọi** và lưu tuỳ chọn trên thiết bị Android thật/đăng nhập backend thật.
- Một số thành phần phụ của PWA vẫn cần đối chiếu sâu: nội dung chi tiết trang cá nhân bên ngoài modal, quản lý quyền người dùng, chi tiết thời gian lịch sử gọi, bảng QR trên màn Khám phá, tối ưu cho tablet.
- Cấu hình dịch cuộc gọi được lưu phía thiết bị. Chưa khẳng định logic cuộc gọi đã đọc các tùy chọn mới, cần kiểm tra luồng call stack native.
- Các bài Flutter widget test chứng minh hành vi trong DemoApi, **không phải xác nhận end-to-end với Railway**.

## Chạy kiểm tra
```sh
cd mobile
flutter analyze --no-pub
flutter test test/contacts_screen_parity_test.dart --no-pub
flutter test --no-pub
```

Flutter app/emulator sẽ chỉ bật khi có yêu cầu chạy thử hoặc sau khi hoàn tất sửa lượt này.
