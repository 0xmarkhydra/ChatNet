# Đối chiếu màn Khám phá Flutter với PWA mobile

**Nhánh:** `feat/flutter-pwa-mobile-parity`
**Nguồn đối chiếu:** `origin/main` — `frontend/src/features/discover/components/NearbyExplorer.tsx`, `NearbyMap.tsx`, `useNearbyDiscovery.ts`, `useNearbyState.ts`, `lib/nearbyPlaces.ts`.

## Phạm vi

Màn **Khám phá / Quanh đây** của PWA gồm hai phần: **Người ở gần** (bật/tắt chia sẻ vị trí, quét, tìm tên, đổi bán kính, quan hệ kết bạn) và **Địa điểm** (bộ lọc danh mục, tìm kiếm, bản đồ và danh sách địa điểm, điều khiển bản đồ, chỉ đường). `Marketplace` là một màn tách biệt trên PWA, không được tự động gộp vào Quanh đây.

## Các phần đã sửa

- Người ở gần lấy trạng thái từ `GET /api/friends` và `GET /api/friends/requests`, phân biệt **Nhắn tin**, **Chấp nhận**, **Hủy lời mời**, **Kết bạn**. Chạm Nhắn tin gọi `POST /api/conversations/direct` rồi chuyển sang chat qua callback của Mobile Shell.
- Có trạng thái chờ riêng cho thao tác kết bạn, tránh gửi trùng yêu cầu.
- Khi gọi `DELETE /api/users/nearby` thất bại, **không** giả vờ rằng vị trí đã được tắt. Chỉ tắt công tắc và xóa danh sách sau khi server xác nhận.
- Ghi nhận `expiresAt` của lượt quét, tự tắt trạng thái hiển thị khi hết hạn, vẫn giữ dữ liệu cached để người dùng nhận biết kết quả của lần quét trước; báo khi bán kính hiện tại khác bán kính của lượt quét.
- Tìm kiếm người/địa điểm có nút xóa bên trong input; thao tác chuyển giữa Người ở gần và Địa điểm giữ dữ liệu cần thiết, tránh nhầm vị trí quét người với kết quả địa điểm.
- Địa điểm: đổi bán kính hoặc danh mục **tải lại** dữ liệu khi đã xác định vị trí; dùng phiên bản request để phản hồi cũ không ghi đè kết quả mới. Khi bản đồ đang ẩn, không gọi `MapController.move` trên bản đồ đã unmount.
- Đồng bộ ID địa điểm kiểu chuỗi để highlight đúng marker và item; chạm một item trong danh sách mở lại bản đồ và focus địa điểm đó.
- Bổ sung ba nút trên bản đồ: **Về vị trí của tôi**, **Phóng to**, **Thu nhỏ**.
- Kiểm tra dịch vụ GPS và tính hợp lệ tọa độ; DEMO hỗ trợ `expiresAt` và trạng thái bật/tắt thực để kiểm thử.
- Duy trì native Flutter/Dart, không nhập React vào client Flutter.

## Kiểm thử

`mobile/test/discover_screen_parity_test.dart` có 7 kịch bản: quan hệ bạn bè, gửi/hủy lời mời, mở chat, lỗi hủy chia sẻ vị trí, hủy thành công, bản đồ/danh sách, tìm kiếm và xóa từ khóa.

Chạy tại `mobile/`:

```sh
flutter analyze --no-pub
flutter test test/discover_screen_parity_test.dart --no-pub
flutter test --no-pub
```

**Kết quả tại thời điểm rà soát:** 7/7 Discover PASS, 82/82 Flutter PASS, analyzer không lỗi.

## Việc cần kiểm tra trực tiếp trên thiết bị/backend thật

- Quyền vị trí lần đầu, vị trí giả lập, tắt GPS và từ chối quyền vĩnh viễn trên Android.
- Overpass/OSM ngoài mạng, tải tile lỗi/chậm, chỉ đường sang ứng dụng bên ngoài.
- Độ trễ và rate limit (HTTP 429), gần hết hạn chia sẻ, khi nhiều lượt quét/bộ lọc diễn ra liên tiếp.
- So sánh giao diện bằng screenshot cùng kích thước và dữ liệu giữa Android Flutter và PWA Mobile: text, shadow, khoảng cách, bo góc, icon, animation. Các widget test chưa đủ xác nhận tương đương từng pixel.

**Chưa commit/push/merge** các thay đổi trong lượt rà soát này.
