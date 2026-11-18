# ChatNet Flutter → PWA Mobile: rà soát màn Tin nhắn (màn 1/5)

**Phạm vi:** `feat/flutter-pwa-mobile-parity`, chỉ màn Tin nhắn trên Flutter viết bằng Dart. Nguồn đối chiếu: `origin/main` của frontend PWA mobile, đặc biệt `ConversationAvatarRail`, `ConversationAvatar`, `GroupChannelSidebar`, `ConversationHeader`, `MessageComposer`, `ChatComposerPlusMenu`, `MessageActions` và CSS `mobile-chat-navigation.css`. Không thay mã React, không merge/rebase.

## Đã đối chiếu, sửa trong lượt này

| Hạng mục | Trên PWA mobile | Flutter sau rà soát | Kiểm chứng |
|---|---|---|---|
| Điều hướng Chat | Avatar rail → avatar dock liền với chọn kênh → chat full màn | Giữ duy nhất ranh giới trượt 380ms, rail 56px/52px, back về chọn kênh | `mobile_parity_test.dart` |
| Danh sách avatar | 46px/dòng, ảnh 38px, tên và preview gọn | Thu nhỏ row, icon/ảnh, chữ, thời gian, search 32px; thêm nền đánh dấu cuộc hội thoại đang chọn | `message_screen_parity_test.dart` |
| Ảnh nhóm | Ảnh nhóm ưu tiên; nếu thiếu hiển thị tối đa 3 avatar thành viên | Thêm `ConversationAvatarView`, giữ fallback khi chưa có avatarMembers | `message_screen_parity_test.dart` |
| Chọn kênh | Avatar/initials, tên, muted, giờ, chủ đề, preview, unread, selected | Thêm `MobileChannelPicker`; avatar 42px, 3 dòng, 99+, highlight, search và clear | `message_screen_parity_test.dart` |
| Tìm kênh | Tìm cả tên + chủ đề + tin nhắn cuối | Bộ lọc `channelPreviews` đồng bộ, empty state khi không có kết quả | Unit + widget |
| Kênh chính | Kênh id=0 có dữ liệu riêng từ backend | Giữ bản ghi kênh chính nếu backend trả về, không nhầm tổng unread của nhóm | Unit + widget |
| Header chat nhóm/kênh | Kênh đang mở là tiêu đề; chủ đề hoặc số thành viên ở phụ đề | Đặt tiêu đề theo kênh, chủ đề, nút mở lại picker | Widget |
| Danh tính người gửi | Tin trong nhóm nhận có ảnh người gửi; tin của mình không có avatar | Bổ sung avatar 29px cho tin nhận trong nhóm; không thêm avatar vào tin mình hoặc chat riêng | Widget |
| Menu gửi | Tệp tin / Ảnh-Video / Emoji; có đường tắt chọn ảnh | Menu tách 3 lựa chọn, thêm nút chọn ảnh riêng | Widget |
| Gửi tệp | File được thêm vào bản nháp, có thể xóa, gửi cùng tin nhắn | Tải lên rồi xếp vào `pendingAttachments`, hiện chip xóa, chỉ POST khi bấm Gửi; giới hạn tối đa 10, không xóa khi POST thất bại | Mã + widget UI; **chưa có integration test file-picker/upload** |
| Tin nhắn: pin, forward, reply, reaction, edit/recall, @mention | Có trên PWA | Giữ luồng Flutter trước đây, không làm mất thao tác; test mobile hiện có | `mobile_parity_test.dart` |

## Vẫn khác hoặc chưa thể chứng minh giống 100%

Để tránh tuyên bố sai về parity, những phần sau **chưa được port/kiểm chứng đầy đủ** trong đợt này:

- **Ghi âm giọng nói** như `VoiceRecorder` (PWA), menu tạo **poll / note / reminder** trong nhóm chưa có tương đương hoàn chỉnh trong Flutter.
- **Trình chọn emoji đầy đủ**, nhóm emoji và bảng reaction mở rộng trên PWA; Flutter hiện có bộ emoji giới hạn theo danh sách tĩnh.
- **Outbox tin nhắn**: pending/offline/retry, lịch sử phân trang/gap, jump chính xác khi tìm kiếm; Flutter còn logic đơn giản và chưa có test đa thiết bị thực tế.
- **E2EE MLS pilot** và các màn báo quyền/chặn theo luồng PWA chưa đạt tương đương chức năng; cần đối chiếu với backend chạy thực tế trước khi đụng tới bảo mật.
- **Danh mục/phân loại hội thoại** và các thao tác quản lý nhóm/kênh nâng cao, panel thông tin, shared media/search có thể còn khác các tùy chọn hiện tại trên PWA.
- **Ảnh pixel-perfect 100%:** chưa thể thực hiện kiểm thử snapshot Android/PWA side-by-side trên cùng kích cỡ máy và dữ liệu; CodeLocal client không cung cấp automation mobile. Các bài widget test chỉ xác minh các ràng buộc cụ thể, không chứng minh ảnh/hiệu ứng trùng tuyệt đối.
- **Đồng bộ dữ liệu thật:** kiểm thử bằng `DemoApi`; chưa xác minh với backend Railway và tài khoản thật (cần kiểm tra nhận tin, @mention, kênh, tải media, phân quyền, realtime, offline).
- Phiên bản `origin/main` có thể thay đổi trong khi đang làm; bước đối chiếu sâu tiếp theo cần so sánh lại diff PWA trước khi merge.

## Lệnh kiểm tra

Từ thư mục `mobile`:
```sh
flutter analyze --no-pub
flutter test test/message_screen_parity_test.dart --no-pub --reporter expanded
flutter test test/mobile_parity_test.dart --no-pub --reporter expanded
flutter test --no-pub --reporter expanded
```

Không commit, push, merge. Flutter debug đã được yêu cầu dừng khi bắt đầu audit; không khởi động lại emulator/app trừ khi người dùng yêu cầu chạy thử. **Chỉ màn Tin nhắn** thuộc phạm vi sửa trong lượt này, chưa chuyển sang Danh bạ/Khám phá/Newsfeed/Cá nhân.
## Bổ sung rà soát menu Tin nhắn — 2026-11-18

- Menu ba gạch `mobile-chat-menu` hiện ở đầu avatar rail cả lúc đang ở full list và khi đang chọn kênh. Các mục: tìm hội thoại (tự mở rộng rail và focus ô tìm kiếm), phân loại tất cả/chưa đọc/nhóm, tạo hội thoại, mở/thu cột avatar. Không còn nút mũi tên riêng trong cột avatar.
- Bỏ nút `#` `chat-open-channel-picker` khỏi header kênh. Nút **Quay lại** khi đang chat nhóm trở về danh sách kênh; thao tác chạm avatar nhóm trong rail vẫn điều khiển seam trượt.
- Header `...` `chat-more-actions` mở bảng thông tin phù hợp: `Thông tin hội thoại` (chat riêng), `Thông tin nhóm` (kênh chính), `Thông tin kênh` (kênh con); không dùng menu popup chức năng rời rạc.
- Bảng thông tin có tìm tin nhắn, file phương tiện đúng channelId, dịch AI. Nhóm có quản lý thành viên/nhóm, thông báo, tạo kênh với role chủ nhóm; kênh có thông báo kênh và quyền chỉnh tên/chủ đề/xóa (role owner/admin); hội thoại riêng có thông báo và xóa lịch sử có xác nhận. Backend vẫn kiểm tra lại quyền với mỗi mutation.
- `mobile/test/message_screen_parity_test.dart` kiểm tra menu ba gạch, xóa nút arrow và `#`, thông tin riêng/nhóm/kênh; `mobile/test/mobile_parity_test.dart` kiểm tra seam trượt qua hamburger thay cho arrow.
- Chưa xác nhận pixel-perfect trên thiết bị với dữ liệu thật; PWA `ConversationDetailsPanel` còn các phân mục nâng cao ngoài phạm vi lượt sửa này (ảnh xem trước trong panel, hồ sơ/khóa chat, hoạt động nhóm). Không kết luận toàn màn Tin nhắn giống PWA 100%.
