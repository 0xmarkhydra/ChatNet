# ChatNet Flutter — Newsfeed so với PWA mobile

**Nhánh:** `feat/flutter-pwa-mobile-parity`. **Đối chiếu:** `origin/main` tại commit `bb73349` (PR #204). Flutter thuần Dart, không dùng mã React.

## Đã bổ sung và đối chiếu

- Bảng tin: bài đăng, thông tin tác giả, xem chi tiết, đính kèm, tìm kiếm, danh sách đã lưu, phân trang 15 bài theo PWA; gộp bài repost nhanh trùng bài gốc, giữ bài trích dẫn là bài riêng.
- Tạo/sửa/xóa bài: composer có phạm vi hiển thị, file phương tiện, gắn thẻ, cảm xúc, check-in và nền chữ; vẫn dùng endpoint backend tương ứng; thất bại đăng bài giữ lại nháp.
- Story: gọi `GET /api/stories?includeText=true`, hỗ trợ media và Story văn bản, 4 màu berry/indigo/teal/sunset, giới hạn 200 ký tự, có xem trước và viewer; còn cần kiểm thử upload/video thật.
- Bài đăng lại: `POST /api/posts/:id/repost` với `quick` hoặc `quote`; `DELETE` để bỏ đăng lại; hiển thị nội dung tác giả và bài gốc, có xác nhận khi xóa repost, không xóa bài viết gốc.
- Bình luận: xem/sắp xếp/trả lời/sửa/xóa/báo cáo; thích và bỏ thích qua PUT/DELETE `/api/posts/:id/comments/:commentId/like` và xác nhận response.
- Chia sẻ: bản sao liên kết đúng đường dẫn PWA `/feed/posts/:id?ref=share`, giao diện chọn hội thoại/nhóm để gửi link, chia sẻ native.
- Cộng đồng: tìm cộng đồng đã tham gia trên Newsfeed, mở hội thoại trong tab Tin nhắn; không tạo bản sao quản trị nhóm tại đây.
- Model Dart có các trường `repostKind`, `originalPost`, `repostCount`, `myRepostId`, `comment.liked` và `Story.text/background`, tránh làm rơi dữ liệu backend khi qua Riverpod.

## Kiểm thử

`mobile/test/feed_newsfeed_parity_test.dart`: 10 bài test cho model, Story văn bản, repost quick/quote/undo, lượt thích bình luận, chia sẻ hội thoại và chuyển màn cộng đồng; **10/10 PASS**. Các bài kiểm tra dùng `DemoApi` nên không chứng minh endpoint Railway đã hoạt động end-to-end.

## Chưa kết luận tương đương 100%

- Reaction emoji đa dạng trong bài viết, viewer và trình bày theo PWA vẫn cần so sánh sâu với backend thực.
- Dịch AI bài viết tự động, UI danh sách người thả reaction và đồng bộ trạng thái mention cần thử thực tế.
- Story trả lời/report/chia sẻ, media/video timeline, thông báo push và trải nghiệm vuốt chuyển story có thể vẫn khác PWA.
- Newsfeed phân trang vô hạn, lọc Đang theo dõi và tìm kiếm trên server chưa được chứng minh hoàn chỉnh chỉ bằng các widget test.
- Tác vụ media qua file picker và network, retry/offline, upload dữ liệu thực và snapshot ảnh cùng kích thước Android/PWA chưa được kiểm thử trên thiết bị.

**Quy tắc:** Không chạy Flutter app/emulator cho đến khi người dùng yêu cầu; chưa commit/push/merge trong lượt rà soát.
