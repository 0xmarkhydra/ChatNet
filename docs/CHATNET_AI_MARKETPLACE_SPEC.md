# ChatNet / SOCO — AI-FIRST MARKETPLACE (ĐẶC TẢ ĐỀ XUẤT)

**Ngày:** 27/10/2026
**Phạm vi:** Web/PWA giai đoạn 1. Đây là đặc tả và backlog để triển khai, **không phải tính năng đã chạy**.
**Liên quan:** `docs/CHATNET_POINT_COIN_PRODUCT_SPEC.md`.

## 0. Mục tiêu sản phẩm [CHỐT]

- **Sàn thương mại điện tử là một phân hệ tích hợp trong ChatNet**, không buộc người dùng chuyển sang ứng dụng khác.
- **Người bán chỉ cần trò chuyện với AI để đăng sản phẩm**, hạn chế tối đa form và thao tác UI; có thể gửi ảnh và thông tin bằng lời nói/văn bản trong hội thoại.
- ChatNet tận dụng danh tính, hồ sơ, mạng xã hội, tin nhắn, media và thông báo đã có, nhưng phân quyền/mua bán là nghiệp vụ riêng.
- Trải nghiệm mua hàng và mô hình chốt đơn/thanh toán **chưa được chủ dự án xác nhận**: mọi phương án trong tài liệu ngoài các ý trên chỉ là thiết kế đề xuất.

## 1. Luồng AI đăng bán (Chat-to-List) [ĐỀ XUẤT]

1. Người bán mở cuộc trò chuyện `Trợ lý bán hàng AI`, nói ví dụ: “Đăng bán áo khoác, 350 nghìn, còn 5 chiếc” và gửi ảnh. Không cần vào form quản trị sản phẩm.
2. AI dùng lời kể và ảnh để **gợi ý** tên, mô tả, phân loại, thuộc tính. Những thông tin có thể gây hiểu sai (thương hiệu, kích cỡ, tình trạng, xuất xứ...) phải được **người bán xác nhận**, không được bịa.
3. AI chỉ hỏi **những trường còn thiếu hoặc mơ hồ**, lần lượt và ngắn gọn: giá/đơn vị tiền, số lượng, biến thể, tình trạng, phương thức giao nhận, liên hệ.
4. Backend lưu **bản nháp** sản phẩm có chủ sở hữu, danh sách media, thuộc tính có nguồn, giá/tồn kho có kiểm tra, trạng thái và thời gian cập nhật. Rời chat/quay lại vẫn sửa tiếp được.
5. AI hiện **thẻ xem trước** (ảnh, tên, giá, mô tả, số lượng). Chỉ khi người bán bấm hoặc nhắn xác nhận “Đăng bán” mới thực thi lệnh publish.
6. Sau đăng, AI trả về link sản phẩm; người bán tiếp tục yêu cầu bằng chat: “Sửa giá còn 320 nghìn”, “Hết hàng”, “Ẩn sản phẩm”, “Xóa sản phẩm”. Các hành động ảnh hưởng niêm yết phải có xác nhận phù hợp và kiểm tra quyền.
7. Kênh thao tác thủ công **tối thiểu** vẫn có cho xem/sửa bản nháp, xử lý lỗi, hỗ trợ truy cập và người dùng không muốn nói chuyện với AI.

### Quy tắc agent / tool calling

- Model **không truy cập DB/S3 hoặc tạo đơn trực tiếp**. Chỉ gọi công cụ backend có schema, phân quyền và kiểm tra đầu vào: `create_product_draft`, `update_product_draft`, `attach_product_media`, `preview_product`, `publish_product`, `pause_product`.
- Xác thực từ session máy chủ; mọi thao tác kiểm tra `sellerId`, `productId`, quyền sở hữu; không tin giá/người nhận do LLM tự viết. Yêu cầu `idempotencyKey` cho lệnh publish/đặt hàng tránh thao tác trùng.
- **Prompt injection** trong ảnh/nội dung từ người bán hoặc người mua không được đổi quyền hoặc vượt quy trình xác nhận.
- API key/model AI chỉ nằm ở backend; quản lý quota, giới hạn chi phí, timeout/retry, audit hành động. Khi AI lỗi, bản nháp và luồng chỉnh tay vẫn hoạt động.

## 2. Trải nghiệm mua bán [ĐỀ XUẤT]

- Góc `Marketplace` trong ChatNet: danh mục, tìm kiếm, lọc, trang chi tiết sản phẩm, hồ sơ/shop người bán, bài đăng liên kết sản phẩm, báo cáo nội dung.
- Người mua có thể mở chat **liên kết đúng sản phẩm**, hỏi người bán hoặc AI về thông tin đã công bố; AI không cam kết thay người bán và không tự bịa tình trạng tồn kho.
- Đơn hàng có trạng thái `draft → placed → confirmed → fulfilled → completed` và nhánh `cancelled / disputed / refunded` nếu nghiệp vụ checkout được duyệt. Không tự đặt thời điểm thanh toán hoặc hoàn tiền.
- Người bán quản lý danh sách sản phẩm, tồn kho, đơn hàng và thông báo trong cùng ứng dụng; khi có đơn/tranh chấp, thông báo dùng hạ tầng Web Push đã có.
- Quản trị có kiểm duyệt, xử lý hàng cấm/giả, tố cáo, gian lận, spam và khóa tài khoản/shop; audit thao tác nhạy cảm.

## 3. Kỹ thuật tối thiểu [ĐỀ XUẤT]

Tận dụng frontend React/Vite, backend Go, auth, media/object storage, cơ sở dữ liệu và hệ thống thông báo hiện hữu. Tổ chức domain riêng, tránh nhồi logic thương mại vào `App.tsx` hay service chat:

- `SellerProfile`, `Product`, `ProductVariant`, `ProductMedia`, `ProductDraft`, `ProductAudit`.
- Giai đoạn có đơn hàng: `Order`, `OrderItem`, `InventoryReservation`, `PaymentAttempt`, `Shipment`, `Dispute`.
- AI orchestrator giữ trạng thái cuộc hội thoại và mapping `draftId`, gọi APIs nghiệp vụ có whitelist; UI hiển thị nội dung câu trả lời cùng thẻ sản phẩm.
- Ảnh tải lên cần quyền owner, validation loại/size, kiểm tra nội dung và URL ngắn hạn. Tìm kiếm chỉ thấy sản phẩm đã công bố, đúng ACL.
- Giá và số lượng dùng dạng số chính xác; nếu checkout, phải kiểm tra giá/tồn kho **lại tại backend** ở lúc đặt đơn, không tin bản nháp trên trình duyệt.

## 4. Phân biệt rõ với Point/Coin [KHÔNG TỰ SUY DIỄN]

- **Point:** thưởng tương tác/referral, không phải phương tiện mua hàng mặc định.
- **Coin:** đã được định nghĩa ở tài liệu Point/Coin cho Gift và các tương tác thu phí. **Không tự kết luận Coin được dùng mua hàng hóa, thanh toán cho người bán hoặc rút trực tiếp**.
- Thanh toán đơn hàng, chiết khấu sàn, ký quỹ người bán, COD, vận chuyển và hoàn tiền **đều CHƯA CHỐT**. Nếu có thanh toán thật, cần đối tác thanh toán phù hợp và tư vấn nghĩa vụ thương mại điện tử/thuế/bảo vệ người mua trước khi mở.
- Không gộp tiền mua sản phẩm, tiền nạp Coin, tiền chi thưởng người sáng tạo vào một ví hoặc sổ kế toán. Không triển khai luồng giữ tiền/hộ nhận tiền thiếu thẩm định pháp lý.

## 5. Backlog triển khai theo thứ tự [ĐỀ XUẤT]

| Mã | Công việc con | Ưu tiên |
| --- | --- | --- |
| MKT-01 | Thiết kế domain sản phẩm/shop, schema và phân quyền | P0 |
| MKT-02 | Chat AI tạo/sửa bản nháp sản phẩm từ tin nhắn + ảnh, chỉ hỏi trường thiếu | P0 |
| MKT-03 | Thẻ preview, xác nhận đăng, sửa/ẩn/xóa sản phẩm | P0 |
| MKT-04 | Trang Marketplace: xem sản phẩm, lọc/tìm kiếm, chi tiết/shop, link chia sẻ | P0 |
| MKT-05 | Liên kết từ sản phẩm sang chat người bán; lịch sử trao đổi và thông báo | P1 |
| MKT-06 | Moderation, báo cáo sản phẩm, chống spam, quota AI và audit | P0 |
| MKT-07 | Đặt hàng, tồn kho, hủy/hoàn, theo dõi đơn | P1 — phụ thuộc mô hình đơn |
| MKT-08 | Thanh toán/VNĐ, vận chuyển, đối soát và tranh chấp | Chờ chốt pháp lý/mô hình |
| MKT-09 | QA nhiều tài khoản, quyền, prompt injection, retry, mobile Web/PWA và tải 1.000 user | P0 |

**Quy trình Git:** Người thực thi tự điền nhánh, làm việc ở nhánh riêng; kiểm thử/review rồi tích hợp `dev`. Không tự tạo/ấn định nhánh cho Thắng/Bắc.

## 6. Cần chủ dự án chốt trước khi code checkout

**Câu hỏi quyết định:** Giai đoạn đầu ChatNet Marketplace dùng **(A) đăng sản phẩm rồi người mua chat chốt đơn**, hay **(B) giỏ hàng + đặt đơn + thanh toán ngay trong ChatNet**?

Nếu chọn B, cần tiếp tục chốt thanh toán bằng VNĐ/COD hay nguồn khác, đối tác thanh toán, đơn vị vận chuyển, cơ chế hoàn tiền và trách nhiệm nền tảng. AI **không được tự xác nhận giao dịch tài chính thay người dùng**.

## 7. Tiêu chí nghiệm thu

- Người bán thực sự có thể đăng bằng cách trò chuyện và gửi ảnh, không cần điền form nhiều bước.
- AI không tự đăng khi chưa duyệt; không bịa giá, thương hiệu, tồn kho; session khác không sửa được sản phẩm.
- Retry/reconnect không tạo sản phẩm/đơn trùng, bản nháp không mất; link public chỉ hiển thị nội dung được phép.
- Kiểm thử Android Chrome, iOS Safari/PWA, desktop; có phương án thủ công khi AI/ảnh lỗi, đo chi phí model.
- Phải có QA đa tài khoản, an toàn nội dung và kiểm thử tải trước khi coi đủ cho 1.000 người dùng.
