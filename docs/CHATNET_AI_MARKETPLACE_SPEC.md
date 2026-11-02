# ChatNet / SOCO — AI-FIRST MARKETPLACE (ĐẶC TẢ ĐỀ XUẤT)

**Ngày:** 27/10/2026
**Phạm vi:** Web/PWA giai đoạn 1. Đây là đặc tả và backlog để triển khai, **không phải tính năng đã chạy**.
**Liên quan:** `docs/CHATNET_POINT_COIN_PRODUCT_SPEC.md`.

## 0. Mục tiêu sản phẩm [CHỐT]

- **Sàn thương mại điện tử là một phân hệ tích hợp trong ChatNet**, không buộc người dùng chuyển sang ứng dụng khác.
- **Người bán chỉ cần trò chuyện với AI để đăng sản phẩm**, hạn chế tối đa form và thao tác UI; có thể gửi ảnh và thông tin bằng lời nói/văn bản trong hội thoại.
- ChatNet tận dụng danh tính, hồ sơ, mạng xã hội, tin nhắn, media và thông báo đã có, nhưng phân quyền/mua bán là nghiệp vụ riêng.
- **ĐÃ CHỐT 27/10/2026:** Người mua có giỏ hàng, đặt đơn, thanh toán và theo dõi đơn trực tiếp trong ChatNet; chat với người bán là tính năng bổ trợ, không thay thế checkout.
- **CHƯA CHỐT:** đơn vị/phương tiện thanh toán (Coin, VNĐ hay hình thức khác), cổng/đối tác thanh toán, chính sách COD, vận chuyển, hoàn tiền và phí. Codex không được tự lựa chọn; chỉ làm phần thanh toán sau khi có quyết định.

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
- **Bắt buộc** có giỏ hàng gắn tài khoản; cập nhật số lượng, xóa mặt hàng, xem tạm tính theo báo giá có xác thực server.
- **Bắt buộc** có checkout tạo đơn trực tiếp và danh sách/chi tiết/theo dõi trạng thái đơn cho cả người mua và người bán, không cần chốt đơn thủ công qua chat.
- Trạng thái đơn và tiền **tách biệt**: `placed → confirmed → fulfilling → shipped → completed` hoặc `cancelled / disputed / refunded` (trạng thái chi tiết cần thiết kế đồng bộ); thanh toán `unconfigured / pending / paid / failed / refunded` phải do backend và cổng thanh toán có thẩm quyền cập nhật, không do client tự đổi.
- Khi chưa chọn phương thức thanh toán, **không phát lệnh thu/trừ Coin, không tạo giao dịch tiền thật hay báo đã thanh toán**. Màn thanh toán thể hiện rõ `Chưa cấu hình phương thức thanh toán`; việc đặt đơn có thể phát triển/QA sandbox theo trạng thái chưa thanh toán, việc chấp nhận đơn thực tế phải khóa cho tới khi quy trình được duyệt.
- Người bán quản lý danh sách sản phẩm, tồn kho, đơn hàng và thông báo trong cùng ứng dụng; khi có đơn/tranh chấp, thông báo dùng hạ tầng Web Push đã có.
- Quản trị có kiểm duyệt, xử lý hàng cấm/giả, tố cáo, gian lận, spam và khóa tài khoản/shop; audit thao tác nhạy cảm.

## 3. Kỹ thuật tối thiểu [ĐỀ XUẤT]

Tận dụng frontend React/Vite, backend Go, auth, media/object storage, cơ sở dữ liệu và hệ thống thông báo hiện hữu. Tổ chức domain riêng, tránh nhồi logic thương mại vào `App.tsx` hay service chat:

- `SellerProfile`, `Product`, `ProductVariant`, `ProductMedia`, `ProductDraft`, `ProductAudit`.
- Bắt buộc có `Cart`, `CartItem`, `Order`, `OrderItem`, `InventoryReservation`/biện pháp giữ tồn kho an toàn, `OrderEvent` để truy vết; `PaymentAttempt`, `Shipment`, `Dispute` chỉ tích hợp thực tế khi phương thức được duyệt.
- AI orchestrator giữ trạng thái cuộc hội thoại và mapping `draftId`, gọi APIs nghiệp vụ có whitelist; UI hiển thị nội dung câu trả lời cùng thẻ sản phẩm.
- Ảnh tải lên cần quyền owner, validation loại/size, kiểm tra nội dung và URL ngắn hạn. Tìm kiếm chỉ thấy sản phẩm đã công bố, đúng ACL.
- Giá và số lượng dùng dạng số chính xác; nếu checkout, phải kiểm tra giá/tồn kho **lại tại backend** ở lúc đặt đơn, không tin bản nháp trên trình duyệt.

## 4. Phân biệt rõ với Point/Coin [KHÔNG TỰ SUY DIỄN]

- **Point:** thưởng tương tác/referral, không phải phương tiện mua hàng mặc định.
- **Coin:** đã được định nghĩa ở tài liệu Point/Coin cho Gift và các tương tác thu phí. **Không tự kết luận Coin được dùng mua hàng hóa, thanh toán cho người bán hoặc rút trực tiếp**.
- **Thanh toán trong ChatNet là yêu cầu ĐÃ CHỐT; cách thanh toán và các tham số kinh tế CHƯA CHỐT.** Thanh toán đơn hàng, chiết khấu sàn, ký quỹ người bán, COD, vận chuyển và hoàn tiền **đều chưa được chọn**. Nếu có thanh toán thật, cần đối tác thanh toán phù hợp và tư vấn nghĩa vụ thương mại điện tử/thuế/bảo vệ người mua trước khi mở.
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
| MKT-07 | Giỏ hàng, checkout trực tiếp, tạo đơn, lưu snapshot giá, chống đặt trùng, quản lý tồn kho và theo dõi đơn | P0 — ĐÃ CHỐT, thực hiện ngay phần phi thanh toán |
| MKT-08 | Thanh toán ngay trong ChatNet, vận chuyển, đối soát, hoàn tiền và tranh chấp | P0 bắt buộc, **BLOCKED** chờ chốt đơn vị/phương thức, đối tác và pháp lý; không tự chọn Coin/VNĐ |
| MKT-09 | QA nhiều tài khoản, quyền, prompt injection, retry, mobile Web/PWA và tải 1.000 user | P0 |

**Quy trình Git:** Người thực thi tự điền nhánh, làm việc ở nhánh riêng; kiểm thử/review rồi tích hợp `dev`. Không tự tạo/ấn định nhánh cho Thắng/Bắc.

## 6. Quyết định sản phẩm và các bước chặn triển khai

**ĐÃ CHỐT:** Chọn **B — sàn đầy đủ tích hợp ChatNet với giỏ hàng, đặt hàng, thanh toán, theo dõi đơn**. Codex không được quay về phương án chỉ chat chốt đơn hoặc tự giảm scope checkout.

**CHƯA CHỐT:** Dùng Coin, VNĐ hay hình thức khác; PSP/cổng thanh toán, nhà vận chuyển, thời điểm thu tiền, bảo vệ người mua, hoàn tiền, thuế và điều kiện pháp lý. Không suy ra rằng Coin nội bộ là phương tiện thanh toán đơn hàng.

**Phân tách làm việc:** Xây và thử dữ liệu giỏ hàng, API đơn, quản lý trạng thái và UI checkout trước; giữ payment adapter bị khóa mặc định, không giả lập thanh toán thành công cho người dùng thật. Khi Product Owner chốt phương thức, mới kết nối gateway, đối soát, webhook bảo mật và bật thanh toán sau QA/pháp lý. AI **không được tự xác nhận giao dịch tài chính thay người dùng**.

## 7. Tiêu chí nghiệm thu

- Người bán thực sự có thể đăng bằng cách trò chuyện và gửi ảnh, không cần điền form nhiều bước.
- AI không tự đăng khi chưa duyệt; không bịa giá, thương hiệu, tồn kho; session khác không sửa được sản phẩm.
- Retry/reconnect không tạo sản phẩm/đơn trùng, bản nháp không mất; link public chỉ hiển thị nội dung được phép.
- Kiểm thử Android Chrome, iOS Safari/PWA, desktop; có phương án thủ công khi AI/ảnh lỗi, đo chi phí model.
- Phải có QA đa tài khoản, an toàn nội dung và kiểm thử tải trước khi coi đủ cho 1.000 người dùng.

## 8. Trạng thái triển khai trong `dev` (27/10/2026)

**Đã code bước nền tảng, CHƯA hoàn thiện Marketplace production:**
- `backend/internal/database/schema.sql`: bảng sản phẩm, giỏ hàng theo tài khoản, yêu cầu đơn và snapshot mặt hàng; không tạo bảng hay số dư tiền thật.
- `backend/cmd/feed/marketplace.go` cùng route gateway: API tạo bản nháp/xác nhận đăng, danh sách sản phẩm, giỏ hàng, tạo yêu cầu đơn theo từng người bán và lịch sử đơn của người mua. Các API được bảo vệ bằng JWT và giới hạn đầu vào; idempotency key áp dụng cho yêu cầu đơn.
- `frontend/src/Marketplace.tsx`, `marketplace.css`, `App.tsx`: màn SOCO Market truy cập từ Khám phá, xem sản phẩm, giỏ, lịch sử yêu cầu đơn, bản nháp do người bán tự nhập.
- **Mọi yêu cầu đơn đang ở `awaiting_payment_configuration`**: KHÔNG đặt thành công về mặt thương mại, KHÔNG giữ tồn kho, KHÔNG trừ Coin, KHÔNG thu/đối soát VNĐ, KHÔNG thông báo đơn mới cho người bán.
- Kiểm thử mã: `go test ./...` chạy đạt, frontend `npm run build` đạt. **Chưa** test PostgreSQL thật, nhiều tài khoản, trình duyệt/PWA thực tế hay tải 1.000 người dùng. Không coi đây là hoàn tất các task MKT.

**Các khối CHƯA TRIỂN KHAI:** AI đăng sản phẩm bằng hội thoại/tool calling và ảnh (form hiện tại chỉ là fallback), sản phẩm nhiều biến thể, ảnh/catalog media, sửa/xóa/ẩn sản phẩm, phía người bán xử lý đơn, thanh toán thật, webhook, giữ/giải phóng tồn kho, vận chuyển/hoàn tiền, kiểm duyệt và dashboard. Codex tiếp tục ưu tiên MKT-02/MKT-03/MKT-06, rồi hoàn thiện MKT-07, MKT-08 khi chủ dự án chốt thanh toán.

**Cảnh báo đặc biệt:** Không tự mở payment bằng cách giả định đơn vị tiền là Coin hoặc VNĐ. Giá niêm yết (`price_unit`) chỉ là trường dữ liệu người bán tự khai, không phải loại tài sản hay phương tiện thu tiền đã được duyệt.
