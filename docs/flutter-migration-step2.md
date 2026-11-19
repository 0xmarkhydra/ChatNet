# ChatNet Flutter migration — Bước 2: Data Models

Nguồn: React/TypeScript `frontend/src/features/{chat,feed,contacts,auth,profile}`,
`frontend/src/shared/lib/media.ts` và phần mobile đã refactor ở Bước 1,
đối chiếu với code Dart đã sửa trên `feat/flutter-pwa-mobile-parity`.

## Kết quả

Các Dart model mới nằm trong `mobile/lib/models/`. Import một lần qua
`package:soco/models/models.dart`. Model thuần Dart, không import Flutter,
React, `Api` hay lớp Widget.

| Dart file | DTO / enum | Nguồn |
| --- | --- | --- |
| `json_readers.dart` | JsonMap, typed field validation, enum/list readers | JSON từ API Go |
| `media_attachment.dart` | MediaAttachment, MediaKind, PresignedUpload | media.ts + mock Flutter |
| `chat_models.dart` | Conversation, ChatMessage, MessageReaction, PinnedMessage, MessageDraft, RealtimeEvent, GroupMember, GroupChannel, enum types | chat/types.ts + Flutter group channels |
| `feed_models.dart` | FeedPost, FeedComment, FeedReaction, Story, PostVisibility | feed/types.ts, FeedDiscussion.tsx |
| `contact_models.dart` | FriendSearchResult, FriendConnection, FriendStatus, FriendRequestDirection | contacts/types.ts |
| `auth_models.dart` | AccountUser, AuthSession, ManagedAccountSession | auth/session.ts, auth/types.ts |
| `navigation_models.dart` | AppTab, MobileDestination, MobileNavigationState, MobileNavigationItem, ChatListFilter | app/types.ts, mobileNavigationModel.ts |
| `profile_models.dart` | ProfileMediaState, ProfileUpdateResponse, UserPrivacy, UserPreferences | profile/types.ts + Flutter profile |
| `call_models.dart` | CallHistoryRecord, CallMediaType | Flutter /api/calls/history |
| `reaction_models.dart` | ReactionParticipant, ReactionParticipantsPage | Flutter /api/{posts,messages}/:id/reactions |

Mỗi model có constructor, `factory fromJson`, `toJson`, `copyWith`; kiểu
`nullable` được thể hiện trực tiếp bằng `T?`. Optional fields được bỏ
khỏi JSON khi null, tránh thay đổi payload không chủ đích. `copyWith` dùng
sentinel riêng cho trường nullable nên có thể chủ động xóa giá trị bằng
`copyWith(field: null)` mà vẫn phân biệt với không truyền tham số.

## Tương thích và ranh giới

- Khóa JSON giữ nguyên `camelCase` của backend; tên lớp/file là PascalCase/snake_case.
- `createdAt`, `updatedAt`, `lastMessageAt`, ... được lưu kiểu `String`
  ISO-8601 để không tự đổi timezone, độ chính xác hoặc định dạng payload;
  trình bày thời gian bằng `DateTime.parse` ở presentation layer.
- Các enum như `ConversationType`, `PostVisibility`, `MediaKind` xác minh
  giá trị được backend hỗ trợ; payload lạ/sai kiểu ném `FormatException`.
- Flutter demo hiện có một số JSON rút gọn (ví dụ room thiếu `createdAt`,
  comment thiếu `createdAt`, profile thiếu `updatedAt`). Các trường
  bắt buộc của hợp đồng React vẫn bắt buộc trong DTO chính. Khi bắt đầu
  chuyển UI/API ở Bước 3, cần chuẩn hóa fixture hoặc tạo mapper rõ ràng;
  không thay `Json` trực tiếp bằng DTO khi dữ liệu chưa đầy đủ.
- `MediaAttachment.storageRef` nullable để hiển thị media demo/public.
  `toUploadRequestJson()` yêu cầu storageRef và chỉ xuất 5 field đã được
  Go API chấp nhận; không gửi signed URL/ID ngược về server.
- `AuthSession` chỉ là DTO, không thực hiện lưu token. Giữ nguyên
  `flutter_secure_storage` và xác thực phiên hiện hữu; không log token.
- `AppTab` phản ánh đầy đủ web, còn `calls` là `MobileDestination` nằm
  trong khu vực chat; Flutter `SocoTab` hiện dùng 5 tab chính.
- Các biến UI, API request/response và màn hình Flutter đang dùng `Json`
  được giữ nguyên trong Bước 2 để không phá vỡ hành vi đã sửa trên nhánh.
  **Bước 3** mới chuyển lần lượt sang repository + typed DTO + state.

## Xác minh

- `dart analyze mobile/lib/models`: static checks cho data layer.
- `flutter test test/data_models_test.dart`: JSON round-trip, nullable
  copyWith, nested DTO, unknown enum, media upload projection, navigation,
  feed, auth, call history và reactions.
- `flutter test`: test hồi quy toàn bộ Flutter hiện có, nếu môi trường cho phép.

Không có thay đổi backend, schema DB, API endpoints hay dependency mới.
