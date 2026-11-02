# ChatNet / SOCO — Đặc tả sản phẩm POINT & COIN

**Ngày lập:** 27/10/2026
**Trạng thái:** Đặc tả sản phẩm để triển khai, chưa phải nghiệm thu tính năng hoặc kết luận pháp lý
**Phạm vi:** Web/PWA giai đoạn đầu; không triển khai native iOS/Android
**Backlog tham chiếu:** Google Sheets ChatNet, nhóm `08 · Point & Coin`, `PC-01`–`PC-13`.

## 0. Phân biệt và nguyên tắc sản phẩm

ChatNet có đúng **hai đơn vị hiển thị cho người dùng**:

| | POINT | COIN |
| --- | --- | --- |
| Bản chất | Điểm ghi nhận hoạt động và đóng góp cộng đồng | Đơn vị trả trước do người dùng nạp để sử dụng dịch vụ/tương tác có thu phí |
| Nguồn | Tương tác hợp lệ, giới thiệu bạn bè, chiến dịch thưởng | Mua/nạp tiền qua đối tác thanh toán |
| Công dụng | Ghi nhận đóng góp, chương trình ưu đãi, dự kiến đổi quà/gift/voucher | Tặng quà ảo; trả phí nhắn tin, gọi thoại/video, bình luận |
| Đổi/rút tiền | **Không mặc định rút tiền, quy đổi Coin, cổ phần hay token** | Coin nạp **không tự rút hoặc chuyển ngang**; người nhận tương tác có thể nhận **thu nhập bằng VNĐ** theo chính sách riêng |
| Kiểm soát | Ngân sách phát hành và chống lạm phát | Sổ giao dịch, đối soát nạp/chi, chính sách trả thu nhập và kiểm soát gian lận |

**Đã chốt:** Tách biệt Point/Coin, không tự động quy đổi qua lại. Hệ thống Coin **duy nhất** dùng chung cho Gift và các tương tác có thu phí; không tạo một loại Coin khác cho từng tính năng. Phần thu nhập VNĐ của người nhận là **khoản phải trả kế toán**, không phải “điểm thứ ba” để người dùng mua/bán/chuyển nhau.

**Quy ước:** `[CHỐT]` là yêu cầu chủ sản phẩm đã xác nhận; `[ĐỀ XUẤT]` là thiết kế tham khảo chưa phê duyệt; `[CHƯA CHỐT]` là quyết định bắt buộc trước khi code nghiệp vụ tương ứng. **Không tự đặt giá Coin, tỷ lệ phí, hạn mức rút, tỷ lệ Point.**

## 1. POINT — thưởng đóng góp và tăng trưởng cộng đồng

### 1.1. Mục đích và nguồn thưởng [CHỐT]

- Khuyến khích người dùng dùng mạng xã hội, tương tác thật, chia sẻ bài viết, bình luận và giới thiệu người dùng mới (`referral`).
- Point có thể dùng trong các **chương trình đổi quà, gift, voucher, ưu đãi về sau**. Chương trình nào mở thực tế phải có điều khoản, số lượng và điều kiện cụ thể.
- Mục tiêu tăng trưởng dài hạn, tạo động lực đóng góp cho cộng đồng nhưng **không để phát hành Point tràn lan**.
- Point không phải tài sản đầu tư và không được quảng cáo là chắc chắn đổi thành cổ phần/token hoặc có lợi nhuận. Ý tưởng cổ phần/token tương lai **không phải quyền đã phát sinh**.

### 1.2. Chống lạm phát, cày điểm và referral giả [ĐỀ XUẤT]

1. Mỗi chương trình có **ngân sách Point tối đa**, thời gian bắt đầu/kết thúc và người duyệt.
2. Có **giới hạn theo ngày/người/loại hành vi**, hạn mức cho referral và chống thưởng lặp một sự kiện; ngưỡng cụ thể [CHƯA CHỐT].
3. Chỉ thưởng sự kiện **hợp lệ**: tránh bot, spam, tự tương tác, nội dung vi phạm và tài khoản mời ảo. Referral nên chỉ được ghi nhận sau khi người được mời thỏa điều kiện hoạt động thật [CHƯA CHỐT điều kiện].
4. Mỗi sự kiện có mã duy nhất (`eventId`, `userId`, `campaignId`), cộng điểm **đúng một lần** ngay cả khi retry/mất mạng.
5. Mọi cộng/trừ/thu hồi điểm phải có lịch sử, lý do, dấu thời gian và audit. Thu hồi bằng bút toán đảo, không xóa lịch sử.
6. Có cảnh báo bất thường, công tắc tắt chương trình và báo cáo tổng Point phát hành/thu hồi.

### 1.3. Giao diện và luồng [ĐỀ XUẤT]

- Số dư Point, lịch sử nhận/trừ, nguồn phát sinh và trạng thái “chờ duyệt/đã nhận/không hợp lệ”.
- Referral: link/mã giới thiệu, trạng thái hợp lệ của lượt giới thiệu, chống tự giới thiệu.
- Khi chương trình đổi quà được mở: danh mục quà, điều kiện đổi, tồn kho, xác nhận trừ Point, trạng thái giao quà/huỷ/hoàn; không trừ trùng.

### 1.4. Quyết định còn thiếu [CHƯA CHỐT]

Hành vi nào chính thức sinh Point; số Point/hành vi; trần/ngày và ngân sách; điều kiện referral; ai được nhận thưởng; hạn sử dụng Point; quy tắc đổi quà và điều khoản minh bạch.

## 2. COIN — nạp và chi tiêu cho tương tác có thu phí

### 2.1. Phạm vi [CHỐT]

Người dùng **nạp tiền mua Coin**. Một ví Coin dùng để:
- Tặng **Gift** (hoa, quà ảo...) cho người dùng khác.
- Trả Coin để **nhắn tin** cho người đã bật chế độ thu phí.
- Trả Coin để **gọi thoại** hoặc **gọi video**.
- Trả Coin để **bình luận** vào bài viết của người bật thu phí bình luận.

Người nhận tương tác có thể **được ghi nhận thu nhập và rút tiền về tài khoản ngân hàng**, nhưng cách ghi nhận, thuế, điều kiện và tỷ lệ chia **chưa chốt** và phải qua rà soát pháp lý trước khi mở thật.

### 2.2. Chế độ Người nổi tiếng / thu phí tương tác [CHỐT về tính năng]

Người dùng tự **bật/tắt** chế độ thu phí và đặt **giá Coin riêng** cho từng loại hành động. Khi chế độ tắt thì không thu loại phí đó.

| Tương tác | Quy trình bắt buộc | Quy tắc cần quyết định |
| --- | --- | --- |
| Nhắn tin | Người gửi thấy mức Coin, xác nhận rõ ràng và có đủ số dư trước khi gửi/mở liên hệ | Theo tin nhắn hay theo lần bắt đầu hội thoại? Có ngoại lệ cho bạn bè/người đã được chấp nhận? |
| Gọi thoại | Hiển thị giá, xác nhận trước khi gọi; có thông báo lỗi/hết Coin | Theo cuộc hay theo phút? Cuộc nhỡ, bị từ chối, đang chờ, mất mạng tính sao? |
| Gọi video | Như gọi thoại, có thể cấu hình giá riêng | Giá/phút hay giá/cuộc? Kết thúc sớm xử lý thế nào? |
| Bình luận bài viết | Hiển thị giá trước khi đăng, xác nhận trước khi gửi | Tính mỗi comment hay mỗi luồng reply? Xóa bởi kiểm duyệt xử lý thế nào? |
| Gift | Chọn quà, xem chi phí Coin và xác nhận trước khi tặng | Danh mục/giá Gift và quyền lợi người nhận |

**Yêu cầu quyền riêng tư:** Bật trả phí **không thay thế** chặn người dùng, cấm quấy rối, quản trị bình luận, kiểm duyệt nội dung và thiết lập quyền riêng tư. Không trừ Coin khi chưa có xác nhận giá và điều kiện.

### 2.3. Nạp Coin — sử dụng Coin — thu nhập VNĐ [ĐỀ XUẤT]

`Nạp VNĐ → nhận Coin → xác nhận tặng Gift / tương tác thu phí → ghi giao dịch Coin → ghi nhận phần thu nhập hợp lệ của người nhận bằng VNĐ → đối soát/xác minh/thuế → chi trả qua đối tác hợp pháp.`

- **Coin đã mua** là quyền sử dụng dịch vụ nội bộ, không phải công cụ chuyển tiền ngang hàng; **không** tự cho phép user chuyển Coin trực tiếp cho user khác hay đổi lại thành tiền.
- **Thu nhập rút được** là một khoản nợ/phải trả VNĐ của nền tảng với người nhận sau khi giao dịch đủ điều kiện; tách sổ kế toán với ví Coin. Đây không phải điểm/token thứ ba.
- Một giao dịch sử dụng Coin thống nhất cho tất cả loại `gift / paid_message / voice_call / video_call / paid_comment`; chỉ khác `type`, quy tắc hoàn tất và chính sách hoàn phí.
- Ví dụ minh họa, **không phải giá đã chốt:** A chi 10 Coin để yêu cầu nhắn tin với B. Coin bị giữ/khấu trừ theo điều kiện đã công bố; B nhận ghi nhận thu nhập VNĐ theo chính sách chia doanh thu; B **không tự nhận 10 Coin đã nạp của A để chuyển thành tiền**.

### 2.4. An toàn tài chính và hậu kiểm [ĐỀ XUẤT]

- Sổ cái append-only cho Coin, Point và doanh thu VNĐ (tách bảng/phân hệ, không trộn số dư); dùng đơn vị nguyên và bút toán bất biến.
- Nạp qua cổng thanh toán: xác minh webhook/chữ ký, `paymentId` duy nhất, chống ghi có hai lần, hoàn/chargeback và đối soát ngân hàng.
- Chi Coin: kiểm tra đủ tiền, trừ/giữ nguyên tử khi đồng thời nhiều tab, sử dụng `transactionId` duy nhất. Trạng thái khuyến nghị `created → reserved → settled` hoặc `cancelled / refunded / disputed`.
- Cuộc gọi không bắt máy/từ chối, bình luận không được đăng hoặc dịch vụ lỗi: có chính sách huỷ/hoàn rõ ràng; **không tùy tiện trừ tiền**.
- Người nhận: thu nhập `pending / available / withdrawn`, chống self-dealing, chiết khấu ảo, tranh chấp và kiểm tra giao dịch bất thường.
- Admin có dashboard đối soát phát hành/chi Coin, phần thu nhập người nhận, giao dịch rút, phí nền tảng và bút toán hoàn/điều chỉnh có audit.
- Quyền truy cập backend, idempotency, rate limit, kiểm thử đa thiết bị và xử lý mất kết nối là điều kiện nghiệm thu.

### 2.5. Rút tiền [ĐỀ XUẤT — KHÔNG MỞ MẶC ĐỊNH]

- Rút từ **thu nhập VNĐ đủ điều kiện**, không từ Point hay số Coin đã nạp.
- Người rút phải đáp ứng xác minh danh tính/tài khoản ngân hàng phù hợp, kiểm tra gian lận, nghĩa vụ thuế, mức rút và điều khoản nhà sáng tạo.
- Luồng đề xuất: `yêu cầu → kiểm tra → duyệt → chi qua đối tác → nhận xác nhận/đối soát`, xử lý thất bại/hoàn và chống chi hai lần.
- **Chưa chốt:** Giá VNĐ/Coin; phần trăm nền tảng/người nhận; điều kiện hoàn tiền; tối thiểu/tối đa và chu kỳ rút; thời gian giữ tiền; thuế/phí; đối tượng được bật kiếm tiền.

### 2.6. Điều kiện pháp lý trước khi bật nạp và rút tiền thật [BẮT BUỘC]

Cần luật sư/đối tác thanh toán đánh giá **theo mô hình triển khai thực tế**, không suy luận từ tên “Coin”, “Gift”, hay việc TikTok/BIGO có triển khai tại thị trường khác:
1. Tư cách/phạm vi hoạt động của mạng xã hội ChatNet, điều kiện nội dung và dịch vụ có thu phí.
2. Phân loại dòng tiền, nghĩa vụ thanh toán, ngân hàng/trung gian thanh toán, điều kiện lưu giữ tiền người dùng, hoàn tiền và tranh chấp.
3. Thuế, chứng từ, khấu trừ và hợp đồng/điều khoản chi trả cho người tạo nội dung/người nhận thu nhập.
4. Bảo vệ dữ liệu cá nhân, xác minh danh tính, chống rửa tiền/gian lận theo phạm vi áp dụng, kiểm soát người chưa thành niên.
5. Nghĩa vụ thương mại điện tử hoặc viễn thông nếu mô hình triển khai thuộc phạm vi pháp luật tương ứng.

**Không được coi tài liệu này là sự bảo đảm đã đủ giấy phép hoặc được phép vận hành dịch vụ rút tiền.**

## 3. Nghiệm thu và chia giai đoạn triển khai [ĐỀ XUẤT]

**Giai đoạn A — hệ thống nội bộ:** Sổ Point và Coin độc lập; cấu hình cấp Point, referral có chống gian lận; hiển thị lịch sử; cấu hình chế độ thu phí cho message/call/comment; chạy Coin sandbox, giả lập giao dịch. Kiểm thử phân quyền và cạnh tranh nhiều thiết bị.

**Giai đoạn B — thanh toán thật (sau chấp thuận pháp lý):** Tích hợp nạp Coin, webhook an toàn, đối soát, lịch sử sử dụng Coin, Gift/thu phí tương tác, xử lý hủy/hoàn/chargeback, thông báo rõ cho người dùng.

**Giai đoạn C — chi trả (sau chấp thuận pháp lý):** Xác minh người nhận, ghi nhận doanh thu VNĐ, quy tắc chia doanh thu, theo dõi nghĩa vụ thuế, payout qua đối tác và báo cáo minh bạch. Sau đó mới triển khai chương trình đổi quà Point khi có chính sách được duyệt.

**Điều kiện Done:** Test đa tài khoản A/B/C và nhiều tab; trừ Coin/điểm đúng một lần khi retry; không rút Coin nạp; không dùng Point trả phí; không vượt ngân sách Point; không thu Coin khi giao dịch thất bại ngoài quy định; quyền chặn/bảo mật vẫn đúng; đối soát được toàn bộ bút toán; audit admin đầy đủ.

## 4. Danh sách quyết định dành cho Product Owner

1. Chính sách Point: bảng thưởng, ngân sách phát hành, giới hạn/ngày, điều kiện referral, đổi quà.
2. Chính sách chế độ thu phí: ai được bật; mức giá tự do/hạn mức; mỗi lượt nhắn tin, mỗi cuộc hay mỗi phút gọi; ngoại lệ bạn bè; cách thu phí bình luận.
3. Chính sách doanh thu: tỷ lệ chia cho nền tảng/người nhận, công thức VNĐ/Coin sau phí/thuế, thời gian chờ.
4. Chính sách rút: xác minh, hạn mức, tần suất, hoàn tiền, xử lý tranh chấp và đối tác ngân hàng/chi trả.
5. Kết quả rà soát pháp lý và điều khoản sản phẩm trước khi bật thanh toán/rút tiền thật.

**Quy tắc thực thi:** Người thực thi/nhánh Git và chính sách chưa được chủ dự án chốt phải để trống/chờ duyệt; không tự bịa tham số kinh tế. Phát triển trên nhánh hợp lệ, review trước khi tích hợp `dev`; không coi doc là code đã chạy.
