# ChatNet Flutter — Bước 3: Dio + Riverpod (nhánh feat/flutter-pwa-mobile-parity)

## Mục đích

Giữ nguyên hành vi và UI Flutter/PWA đã chuyển trên nhánh hiện tại, đồng thời tách
quản lý trạng thái server và transport sang các repository/AsyncNotifier để chuẩn bị
kết nối UI trực tiếp ở Bước 4. Dữ liệu DTO lấy từ `mobile/lib/models` (Bước 2).

## Cấu trúc đã triển khai

```
lib/
├── api.dart                      # HTTPS, token refresh, SSE, media upload/download
├── data/
│   └── chatnet_repositories.dart # Chat, Feed, Contacts, Calls, Profile
├── models/
│   ├── models.dart               # export DTOs đã chuẩn hoá
│   └── email_challenge.dart      # response OTP (typed)
└── state/
    └── app_providers.dart       # providers, notifiers, debounce, realtime
```

Dependencies: `flutter_riverpod` 3.4.3 và `dio` 5.11.1. Các dependency cũ
vẫn giữ vì màn hình/streaming SSE đang sử dụng.

### Riverpod providers

| Provider | State | Vai trò |
| --- | --- | --- |
| `apiProvider` | `Api` | Instance thực theo tài khoản / DemoApi, override tại ProviderScope |
| `sessionSnapshotProvider` | `SessionSnapshot` | Đăng nhập, demo, userId; không lưu token trong widget |
| `chatRepositoryProvider`, `conversationsProvider` | `AsyncValue<List<Conversation>>` | Hội thoại có kiểu và reload |
| `messagesProvider(MessageQuery)` | `AsyncValue<List<ChatMessage>>` | Tin nhắn theo conversationId/channelId/target |
| `realtimeRevisionProvider` | `AsyncValue<int>` | SSE một nguồn chung, mỗi sự kiện tăng revision để reconcile |
| `contactsProvider`, `contactSearchProvider` | `AsyncValue<ContactsSnapshot/List<FriendSearchResult>>` | Danh bạ và tìm kiếm debounce, chặn stale result |
| `feedProvider` | `AsyncValue<FeedSnapshot>` | Posts + Story (Story lỗi không làm mất feed) |
| `callHistoryProvider` | `AsyncValue<List<CallHistoryRecord>>` | Lịch sử cuộc gọi và refresh |
| `profileProvider`, `privacyProvider`, `preferencesProvider` | `AsyncValue<DTO>` | Hồ sơ, quyền riêng tư, tuỳ chọn |
| `emailAuthProvider` | `AsyncValue<EmailChallenge?>` | OTP start, resend, verify, reset |

Các controller expose `refresh()` hoặc `ref.invalidate(provider)`; lỗi được giữ
trong `AsyncValue` thay vì trả về dữ liệu giả hoặc bỏ qua lỗi server bắt buộc.

### Màn Flutter đã kết nối

- `app.dart`: ProviderScope theo instance `Api`; tạo lại provider container khi
  thay tài khoản/đăng xuất để tránh cache của người dùng trước.
- `auth_screen.dart`: start/resend/verify OTP qua `EmailAuthNotifier`; countdown
  và text field là state UI cục bộ.
- `chat_screen.dart`: SSE qua `realtimeRevisionProvider`; bỏ subscription riêng,
  tiếp tục reconcile tin nhắn, kênh, pin bằng luồng đã kiểm thử.
- `contacts_screen.dart`: lấy friends/suggestions qua `ContactsNotifier`,
  giữ invitations và các thao tác tương tác cũ.
- `feed_screen.dart`: lấy posts/stories qua `FeedNotifier`.
- `call_history_screen.dart`: đọc `CallHistoryNotifier`; các nút gọi/chat giữ nguyên.
- `profile_screen.dart`: profile/privacy/preferences qua typed providers;
  invalidate cache sau cập nhật.

### Dio transport và bảo mật

- REST dùng Dio, tự giải mã JSON/cố định `ApiError.status` cho 401/403/5xx.
- Giữ single-flight refresh token, generation guard khi logout; 401 thử lại đúng
  một lần theo cơ chế cũ. Timeout/connection failure không phát lại thao tác ghi.
- Upload qua Dio PUT tới signed URL, chỉ gắn Content-Type không kèm Authorization.
  Download/chuyển tiếp qua Dio streaming, giới hạn dung lượng; token chỉ đi tới
  same-origin API và chỉ khi tài khoản còn đăng nhập.
- SSE `/api/events` vẫn dùng `http.Client` để xử lý các dòng event-stream như
  trước, nhưng subscription do Riverpod quản lý và cleanup theo ProviderScope.
- `Api` và `flutter_secure_storage` là nguồn xác thực duy nhất, không copy JWT
  sang Riverpod state hoặc log.

## Ranh giới còn phải chuyển tiếp — không đánh tráo trạng thái hoàn thành

**Bước 3 đã có data/state/transport layer và các đường tích hợp chính**, nhưng
chưa chuyển *mọi* thao tác UI của `ChatScreen` (~3.6k dòng) và các form phức tạp
sang notifier: tạo/sửa/thu hồi/ghim/chuyển tiếp tin nhắn, quản trị nhóm, phân trang
cũ, story/post mutations, lời mời kết bạn, upload avatar và UI navigation. Các
luồng này tiếp tục dùng `Api.request` qua Dio và state cục bộ, nên vẫn hoạt động
như cũ. Không thay nguyên bản sau một lần edit vì có rủi ro mất những hành vi
PWA đã dựng. Bước port UI/controller tiếp theo cần theo từng màn với test parity.

## Test

`flutter test test/riverpod_data_test.dart --no-pub`: provider isolation,
parsing DTO, call refresh, debounce, OTP, Dio response/error + nonretry, media
signed URL không rò rỉ bearer token.

`flutter analyze --no-pub` và `flutter test --no-pub` tại thư mục `mobile/`
để kiểm tra toàn bộ màn mobile. Test đang dùng DemoApi nên không xác nhận Railway
backend hoặc API credentials ngoài môi trường test.
