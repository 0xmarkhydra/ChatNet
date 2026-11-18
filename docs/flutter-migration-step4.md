# ChatNet Flutter — Bước 4: Native Presentation Layer

**Nhánh:** `feat/flutter-pwa-mobile-parity`
**Phạm vi:** Mobile Flutter thuần Dart, tiếp nối các DTO và Dio/Riverpod ở Bước 2–3.

## Đã thực hiện

### Điều hướng và state của Mobile Shell

- `lib/presentation/mobile_shell_state.dart`: `SocoTab`,
  `MobileShellState`, `MobileShellNotifier` (Riverpod), theo dõi tab đang chọn,
  hội thoại đang mở và tổng chưa đọc. Trạng thái thuộc `ProviderScope` theo session.
- `lib/presentation/soco_bottom_navigation.dart`: tách bottom navigation khỏi
  `HomeShell`, giữ 5 tab, semantics/key cũ, số chưa đọc tối đa `99+`.
  Bubble chỉ có một bản duy nhất và di chuyển bằng `AnimatedAlign`, ưu tiên
  `disableAnimations` để tôn trọng giảm chuyển động. Không khởi tạo lại
  các màn con khi chuyển tab (`IndexedStack` giữ nguyên).
- `home_shell.dart`: dùng `ref.watch(mobileShellProvider)` khi build,
  `ref.read(...notifier)` trong callback; giữ cơ chế deep-link từ Danh bạ
  và Newsfeed sang đúng hội thoại, yêu cầu tạo chat/post và reset ô tìm kiếm.
  Bottom nav ẩn khi đang mở một cuộc hội thoại trên điện thoại, luôn hiện
  ở chế độ tablet/desktop.

### Màn Chat: avatar rail và bộ lọc

- `lib/presentation/mobile_avatar_channel_split.dart`: hai viewport cùng
  ranh giới chuyển động; giữ `ValueKey` trước đây, scroll position và trạng thái
  chọn kênh; avatar rail và channel picker không được dựng lại vào từng frame
  `AnimationController`.
- `lib/presentation/conversation_list_presenter.dart`: projection bất biến
  `ConversationPreview`, tìm **chỉ theo tên cuộc hội thoại**, lọc
  `all/unread/groups` bằng `ChatListFilter` (model Bước 2), sắp xếp
  hội thoại ghim lên trước rồi mới tới thời gian tin nhắn gần nhất.
- Giữ `Json` gốc khi giao cho menu ghim, thao tác nhóm và chuyển tiếp,
  tránh mất các trường ngoài phạm vi DTO đang được kiểm chứng.

### Danh bạ và Newsfeed

- `lib/presentation/friend_list_presenter.dart`: danh sách A–Z, tìm
  displayName/username, trạng thái online, yêu thích. Bổ sung trường
  `favorite`/`isFavorite` nullable vào `FriendConnection` để DTO
  không bỏ mất các flag hiện có trên server.
- `contacts_screen.dart`: ô tìm bạn dùng `contactSearchProvider`
  (debounce 320ms, bỏ kết quả stale). Không sửa provider đồng bộ trong
  `didUpdateWidget` — thay bằng callback sau khung hình, có kiểm tra
  `mounted` và query còn đúng. Có UI cho loading/error/retry.
- `lib/presentation/feed_list_presenter.dart`: bộ lọc Newsfeed dùng cả
  `author`, `authorDisplayName`, `content`, áp dụng cho bài thường và
  bài đã lưu; không thay đổi API phân trang/story và post actions.

## Kiểm thử

`mobile/test/presentation_step4_test.dart` bao gồm:

- Search/filter/sort conversation, preserve original record.
- A–Z/online/favorite/search friends, round-trip flag favorite ở DTO.
- Newsfeed search author, displayName và nội dung.
- Riverpod navigation state: mở/đóng chat, ẩn nav, badge, reset.
- Widget native bottom nav: `99+`, bubble chuyển động thực tế qua
  thời gian animation, giữ các tab còn lại.
- Widget Danh bạ: tìm kiếm thực tế qua `DemoApi` + debounce Riverpod.

Bộ `mobile/test/mobile_parity_test.dart` kiểm tra trượt
avatar–kênh cùng một đường nối, trạng thái rail width và quay lại,
chọn kênh, gửi tin, @mention và các màn khác.

Chạy từ `mobile/`:
```sh
flutter analyze --no-pub
flutter test --no-pub --reporter expanded
```

## Giới hạn / phần chuyển đổi chưa thực hiện

Các màn Flutter đã có sẵn UI và chức năng PWA ở phạm vi kiểm thử; Bước 4
**chỉ chuyển đổi phần presentation có thể tách an toàn**. Các action phức tạp
vẫn nằm trong controller Widget: gửi/sửa/thu hồi/ghim/chuyển tiếp tin nhắn,
quản lý nhóm, composer và tương tác Feed, profile và các request phân trang
cũ. Chúng vẫn dùng `Api.request` qua Dio và hoạt động theo luồng hiện tại;
chưa tuyên bố đã port 100% màn/cơ chế PWA mới nhất. Để chuyển phần còn lại,
phải đối chiếu schema backend thực tế với Dart DTO và tăng kiểm thử theo
từng nhóm chức năng trước khi thay đổi cách quản lý dữ liệu.

Không commit, push, merge hay sửa branch khác. Không build APK/chạy emulator.
