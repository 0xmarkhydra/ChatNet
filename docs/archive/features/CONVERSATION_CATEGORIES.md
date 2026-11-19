# Phân loại trò chuyện

Trong tab Chat, chọn bộ lọc trên danh sách hội thoại. Mở **Quản lý thẻ** để tạo, sửa tên/màu hoặc xóa thẻ. Trong một hội thoại, dùng ô **Phân loại** dưới tiêu đề để gán hoặc bỏ thẻ.

- Mỗi tài khoản có tối đa 50 thẻ; tên dài 1–40 ký tự, không trùng (không phân biệt hoa/thường). Có sáu màu cho sẵn.
- Mỗi hội thoại có tối đa một thẻ của riêng người dùng. Thẻ không chia sẻ với thành viên khác.
- Xóa thẻ chỉ bỏ phân loại, giữ nguyên hội thoại và tin nhắn. Rời/xóa tư cách thành viên tự xóa gán thẻ tương ứng.
- Bộ lọc Tất cả / Chưa phân loại / thẻ cụ thể chạy trên server trước phân trang; tìm kiếm hiện có vẫn áp dụng trên các trang đã tải.
- Cache nằm trong phiên tài khoản. CRUD thẻ chỉ vô hiệu hóa nhóm categories/conversations. SSE category.updated chỉ gửi đến tài khoản sở hữu và cập nhật các thiết bị đang kết nối.

## API

Tất cả endpoint cần xác thực:
- GET /api/conversation-categories
- POST /api/conversation-categories — {name,color}
- PUT /api/conversation-categories/{categoryId} — {name,color}
- DELETE /api/conversation-categories/{categoryId}
- PUT /api/conversations/{id}/category — {categoryId:number|null}
- GET /api/conversations?category={id|0}&limit=25&offset=0 — không truyền category để lấy tất cả.

color: indigo, blue, green, orange, pink, slate. Danh sách hội thoại bổ sung categoryId khi có gán thẻ; dữ liệu cũ và client cũ vẫn tương thích.

Migration bổ sung: backend/internal/database/migrations/001_conversation_categories.sql, được gọi bởi database.Migrate sau schema hiện có khi dịch vụ khởi động. Cần khởi động lại dịch vụ chat và gateway để nạp route mới. Không thay đổi dữ liệu hội thoại hiện có.

Kiểm tra: npm --prefix frontend run check:categories; npm --prefix frontend run check:cache. Test Go TestConversationCategoriesIntegration dùng CHATNET_TEST_DATABASE_URL trỏ đến PostgreSQL local; fixture riêng và tự dọn.
