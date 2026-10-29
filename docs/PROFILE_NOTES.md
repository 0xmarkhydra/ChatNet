# Ghi chú trang cá nhân

Bong bóng “Chia sẻ suy nghĩ…” phía trên avatar mở hộp đăng note. Mỗi tài khoản có một note tối đa 60 ký tự Unicode, hiển thị trong 24 giờ. Chỉ đăng và xóa; không sửa. Muốn thay nội dung, xóa note cũ rồi đăng mới.

Người đăng chọn Bạn bè (mặc định), Công khai hoặc Chỉ mình tôi. Người xem bấm bong bóng để đọc đầy đủ; không có thao tác sửa/xóa note người khác. Chặn theo cả hai chiều được kiểm tra trên server; note bạn bè chỉ hiện với quan hệ đã chấp nhận. Note hết hạn tự ẩn; bản ghi cũ được thay khi đăng note tiếp theo.

## API

- GET /api/profile/note: note của tài khoản hiện tại.
- GET /api/users/{username}/note: note được phép xem, trả {note:null} khi không có/ẩn/hết hạn; 404 nếu tài khoản không tồn tại hoặc bị chặn.
- POST /api/profile/note: {content,visibility}; chỉ nhận public/friends/private. Trả 409 nếu đang có note hoạt động. Không cung cấp PUT/PATCH.
- DELETE /api/profile/note: {version}; xóa đúng phiên bản của tài khoản hiện tại, trả 409 nếu bản ghi đã thay đổi.

Các route đều yêu cầu đăng nhập. Migration bổ sung 003_profile_notes.sql chạy qua database.Migrate khi dịch vụ khởi động. Không thay đổi bài viết/story hiện có.

Cache note riêng trong bộ nhớ theo phiên, tối đa 10 giây; đăng/xóa chỉ vô hiệu hóa cache note. UI tự ẩn theo expiresAt và kiểm tra lại khi quay về tab. Đổi quyền kết bạn làm mới note ở hồ sơ đang xem. Chưa có danh sách note tập trung hoặc gửi thông báo khi đăng note.

Kiểm thử: npm --prefix frontend run check:profile-note; go test ./cmd/chat từ backend. TestProfileNotesIntegration dùng CHATNET_TEST_DATABASE_URL cho PostgreSQL local; fixture tự dọn. Kiểm tra quyền, chặn, hết hạn, cạnh tranh phiên bản, Unicode và chỉ đăng/xóa.
