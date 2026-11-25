---
document_id: QA-ACC-001
title: Các ca nghiệm thu theo yêu cầu
version: 1.0.0
status: Draft
owner: Quality Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 29119-3:2021"
---

# Các ca nghiệm thu theo yêu cầu

Tất cả ca dưới đây là **NOT RUN** trong đợt tài liệu. Đây là kịch bản đề xuất, không ghi thay lịch sử PASS. Dùng tài khoản và dữ liệu tổng hợp, không dùng qua production.

| Mã | Trình tự | Kết quả mong đợi | Hình thức kiểm |
|---|---|---|---|
| TC-AUTH-001 | Nhận OTP test, thử sai/hết hạn, xác minh hợp lệ, login/refresh/logout, liệt kê và revoke phiên từ thiết bị thứ hai. Thử lại không có bearer hoặc bearer sai. | OTP sai không tạo phiên. Phiên hợp lệ được cấp. Danh sách chỉ thấy phiên của mình. API có kiểm phiên từ chối phiên thu hồi. Phân loại riêng route chỉ kiểm JWT. | Go + staging email; auth/session tests |
| TC-CHAT-001 | Dùng A/B/C. A và B tạo direct đồng thời, A tạo nhóm và kênh, thử thêm/xóa thành viên theo vai trò. Gửi/sửa/thu hồi, reaction, ghim và read/unread. C chưa có quyền thử đọc. Ngắt mạng và nối lại. | Chỉ một direct cho cặp. Vai trò sai hoặc C ngoài nhóm bị từ chối. Tổng chưa đọc hội tụ sau refresh, luồng SSE không lộ dữ liệu ngoài quyền. | Go PG/Redis + hai browser; check:chat, check:outbox |
| TC-PRIV-001 | A chặn B khi có direct, cùng nhóm với C và có bài Story/Feed. Kiểm tìm kiếm theo thiết lập, bạn bè, report, Chat/Feed/Call, SSE, rồi bỏ chặn. | Hai phía bị hạn chế theo policy. C giữ quyền hợp lệ. Bỏ chặn không xóa lịch sử. Báo riêng cửa sổ token Call đã cấp. | Hai hoặc ba phiên test, PG/Redis, LiveKit nếu đo media |
| TC-FEED-001 | Tạo bài với từng audience được hỗ trợ, tạo phản ứng/bình luận và Story. Thử cập nhật/xóa với tài khoản khác, gửi report và xét duyệt bằng hai vai trò. | Quyền xem nhất quán giữa list/detail/mutation. Phản ứng bài và đăng bình luận hợp lệ được lưu, Story hiển thị đúng cho người được phép. Report của người dùng không tự chuyển thành quyết định moderator. Không dùng test của checkout khác làm bằng chứng. | Go Feed + Web/PWA; check:feed-api, check:social-ui |
| TC-CALL-001 | Hai tài khoản gọi thật. Thử người ngoài nhóm. Người nói từ chối, đồng ý rồi thu hồi đồng ý. Kiểm trên một lần reconnect. | Chỉ thành viên có quyền nhận credential. Không chuyển âm thanh sang provider trước consent hoặc sau thu hồi. Báo riêng mỗi OS/provider và giới hạn credential đã cấp. | LiveKit + mock provider để đo số frame thu hồi. Dùng provider staging và thiết bị thật cho nghiệm thu tích hợp riêng |
| TC-AI-001 | Kiểm cấu hình backend và bundle Web/Desktop của build cần phát hành. Mô phỏng provider không cấu hình bằng dữ liệu thử. | Bundle và phản hồi không chứa khóa. Lỗi provider rõ và không giả vờ dịch thành công. Bằng chứng lọc giá trị bí mật. | Kiểm cấu hình/build và kiểm runtime |
| TC-MKT-001 | Tạo nháp, công bố với seller, thử công bố bằng buyer. Thêm giỏ, checkout, thử lại cùng khóa và thử giỏ sai đơn vị. Đối chiếu đề xuất AI riêng. | Không công bố hộ seller. Retry trả cùng ID. Đơn ở trạng thái chờ, không thu tiền/giữ hàng và payload client không xác nhận được đã trả tiền. Ca AI chỉ chạy khi có phạm vi được phê duyệt. | Go marketplace tests + PostgreSQL riêng |
| TC-ECON-001 | Đối chiếu trạng thái ledger, quyết định sản phẩm và release flag trước khi bật luồng tiền. Khi có triển khai, thử retry và hoàn tiền bằng số dư giả lập. | Không bật giao dịch thật ở baseline. Ledger, đối soát và chính sách hoàn tiền phải có bằng chứng trước khi phát hành. | Review Product/Security; mô phỏng cho bản có ledger |
| TC-MEDIA-001 | A/B gửi/tải media, rồi chặn hoặc thu hồi quyền thành viên. B thử yêu cầu mới, C ngoài hội thoại thử quyền. Kiểm thêm tin nhắn và hồ sơ theo chính sách tương ứng. Phân biệt capability mới, URL đã phát và dữ liệu đã tải. | Yêu cầu mới không có quyền bị từ chối. Không tuyên bố thu hồi dữ liệu đã tải. Ghi kết quả và thời gian theo môi trường storage. | Go media integration + S3/R2 test riêng |
| TC-REL-001 | Ngắt mạng quanh thời điểm ACK, kết nối lại và retry với cùng clientId. Quan sát lỗi với request khác dùng cùng khóa. | Cùng yêu cầu không tạo tin trùng. Nội dung khác bị phát hiện xung đột. UI không tự chuyển sang thành công trước ACK. | TestMessageIdempotencyIntegration + check:offline-browser |
| TC-DATA-001 | Chạy trên DB mới và bản sao QA của schema cũ. Gây failure có kiểm soát trong môi trường dùng một lần. | Trình tự khớp migrate.go. Transaction lỗi không áp dở. Bản hợp lệ được xác minh bằng schema và smoke. | PostgreSQL cách ly; inspect + integration |
| TC-ACC-001 | Ở 390×844 và 1440×900, dùng Tab tới nút Tin nhắn và xem cây trợ năng với 0, 1, 100. Kiểm nhãn không đọc trùng và focus rõ. | Tên nút còn nguyên, trạng thái chưa đọc được công bố đúng và không giữ số cũ khi về 0. Trình đọc màn hình thật ghi riêng nếu chưa chạy. | Browser thật; accessibility tree và screenshot |
| TC-DESK-001 | Chạy bản đóng gói bằng profile QA. Kiểm auth/IPC mặc định, thao tác từ frame không tin cậy và xác nhận quyền media khi yêu cầu. | Frame không tin cậy bị từ chối. Không lộ refresh credential qua bridge. Ghi rõ Windows/macOS và ký hay chưa ký. | desktop/test + packaged native smoke |
| TC-OPS-001 | Trên staging, dùng lỗi giả lập và đối chiếu log với release ID, dependency health và lỗi client. | Có thể liên hệ nguyên nhân mà không lộ bí mật, token hoặc nội dung riêng tư trong bằng chứng. | Log đã lọc và đối chiếu config |
| TC-MAINT-001 | Chạy check:architecture và ratchet cho thay đổi frontend, đối chiếu kết quả với target merge. | Không tăng finding ngoài baseline hợp lệ. Lưu SHA target và mã thoát. | frontend/package.json + web-pwa-ci.yml |

## Checkpoint theo yêu cầu

Mẫu đầy đủ cho đặc tả ca, hồ sơ lần chạy và báo cáo sự cố nằm ở [hồ sơ kiểm thử](TEST_DOCUMENTATION.md). Checkpoint dưới đây chưa ghi điều kiện tiên quyết và dữ liệu cụ thể. Bổ sung trước lần chạy đầu tiên.

Dùng trình tự và môi trường ở bảng trên để thiết lập fixture. Mỗi checkpoint có một kết quả riêng và vẫn **NOT RUN** cho đến khi có bằng chứng chạy. Phương pháp xác minh theo checkpoint có ở [ma trận](TRACEABILITY_MATRIX.md). Ghi phát hiện từ đọc mã ở SRS, không ghi thành kết quả chạy. Checkpoint áp dụng có điều kiện không được tính PASS khi điều kiện chưa thỏa.

### TC-AUTH-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-auth-001"></a>AC-AUTH-001 | [REQ-AUTH-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-001) | OTP hợp lệ cho đúng challenge hoàn tất xác minh email. | NOT RUN |
| <a name="ac-auth-005"></a>AC-AUTH-005 | [REQ-AUTH-005](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-005) | Thử hai challenge độc lập với OTP sai và OTP hết hạn. Không trường hợp nào cấp phiên. | NOT RUN |
| <a name="ac-auth-002"></a>AC-AUTH-002 | [REQ-AUTH-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-002) | Đăng nhập đúng rồi sai mật khẩu. Chỉ lần hợp lệ nhận phiên. | NOT RUN |
| <a name="ac-auth-006"></a>AC-AUTH-006 | [REQ-AUTH-006](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-006) | So sánh refresh hợp lệ và refresh token đã thu hồi. Chỉ token hợp lệ được đổi. | NOT RUN |
| <a name="ac-auth-007"></a>AC-AUTH-007 | [REQ-AUTH-007](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-007) | Đăng xuất rồi thử làm mới phiên đó. Phiên không được làm mới. | NOT RUN |
| <a name="ac-auth-003"></a>AC-AUTH-003 | [REQ-AUTH-003](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-003) | Gọi route bảo vệ với bearer hợp lệ, thiếu và sai. Hai trường hợp sau không nhận dữ liệu. | NOT RUN |
| <a name="ac-auth-008"></a>AC-AUTH-008 | [REQ-AUTH-008](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-008) | Thu hồi phiên thứ hai rồi gọi route kiểm phiên bằng bearer còn hạn. Bị từ chối. Không suy rộng sang route chỉ kiểm JWT. | NOT RUN |
| <a name="ac-auth-004"></a>AC-AUTH-004 | [REQ-AUTH-004](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-004) | A và B có nhiều phiên. Kết quả cho A không có phiên của B. | NOT RUN |
| <a name="ac-auth-009"></a>AC-AUTH-009 | [REQ-AUTH-009](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-009) | A thử thu hồi phiên của B. Không thành công và phiên B vẫn dùng được. | NOT RUN |

### TC-CHAT-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-chat-001"></a>AC-CHAT-001 | [REQ-CHAT-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-001) | A/B tạo direct đồng thời. Cả hai nhận cùng ID. | NOT RUN |
| <a name="ac-chat-002"></a>AC-CHAT-002 | [REQ-CHAT-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-002) | Tạo nhóm bằng người dùng hợp lệ và kiểm hội thoại có kiểu nhóm và người tạo có vai trò tương ứng. | NOT RUN |
| <a name="ac-chat-008"></a>AC-CHAT-008 | [REQ-CHAT-008](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-008) | Thử thêm, đổi vai trò và xóa với vai trò được phép và không được phép. Không đổi membership khi bị từ chối. | NOT RUN |
| <a name="ac-chat-003"></a>AC-CHAT-003 | [REQ-CHAT-003](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-003) | Gửi cùng payload từ thành viên được phép và người ngoài. Chỉ tin hợp lệ được lưu. | NOT RUN |
| <a name="ac-chat-009"></a>AC-CHAT-009 | [REQ-CHAT-009](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-009) | A trong hội thoại và C ngoài hội thoại dùng cùng ID. Chỉ A đọc được nội dung. | NOT RUN |
| <a name="ac-chat-010"></a>AC-CHAT-010 | [REQ-CHAT-010](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-010) | Tác giả và người không có quyền sửa cùng tin. Chỉ lần có quyền thay nội dung. | NOT RUN |
| <a name="ac-chat-011"></a>AC-CHAT-011 | [REQ-CHAT-011](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-011) | Thử thu hồi bằng người không có quyền rồi tác giả có quyền. Chỉ thao tác được cấp quyền làm mất tin khỏi lượt đọc mới. | NOT RUN |
| <a name="ac-chat-004"></a>AC-CHAT-004 | [REQ-CHAT-004](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-004) | Gửi tin vào các hội thoại có quyền của A và một hội thoại ngoài quyền. Tổng của A chỉ tính tin chưa đọc có quyền xem. | NOT RUN |
| <a name="ac-chat-012"></a>AC-CHAT-012 | [REQ-CHAT-012](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-012) | Đọc một hội thoại rồi một kênh. Tiến độ chỉ thay đổi cho phạm vi người đọc đã chọn. | NOT RUN |
| <a name="ac-chat-005"></a>AC-CHAT-005 | [REQ-CHAT-005](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-005) | Thử reaction bằng A có quyền và C ngoài nhóm. Chỉ A thay đổi được reaction. | NOT RUN |
| <a name="ac-chat-013"></a>AC-CHAT-013 | [REQ-CHAT-013](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-013) | Thử ghim/bỏ ghim với người có và không có quyền. Chỉ lần có quyền đổi trạng thái ghim. | NOT RUN |
| <a name="ac-chat-006"></a>AC-CHAT-006 | [REQ-CHAT-006](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-006) | A trong nhóm và C ngoài nhóm cùng mở stream. C không nhận payload của nhóm khi A gửi tin. | NOT RUN |
| <a name="ac-chat-014"></a>AC-CHAT-014 | [REQ-CHAT-014](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-014) | Ngắt SSE, gửi tin khi client offline rồi nối lại. Trạng thái hội tụ từ dữ liệu server. | NOT RUN |
| <a name="ac-chat-007"></a>AC-CHAT-007 | [REQ-CHAT-007](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-007) | Thử tạo, sửa và xóa kênh với hai vai trò. Vai trò không đủ quyền không đổi kênh. | NOT RUN |
| <a name="ac-chat-015"></a>AC-CHAT-015 | [REQ-CHAT-015](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-015) | Hai vai trò thử tạo và thu hồi lời mời. Thao tác sai vai trò không đổi lời mời. | NOT RUN |
| <a name="ac-chat-016"></a>AC-CHAT-016 | [REQ-CHAT-016](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-016) | Thử duyệt cùng yêu cầu với vai trò không đủ quyền rồi vai trò phù hợp. Chỉ lần sau cập nhật yêu cầu. | NOT RUN |

### TC-PRIV-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-id-001"></a>AC-ID-001 | [REQ-ID-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-id-001) | Thay cài đặt tài khoản đích và tìm lại từ tài khoản không có quyền. Không trả tài khoản bị ẩn. | NOT RUN |
| <a name="ac-id-002"></a>AC-ID-002 | [REQ-ID-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-id-002) | Tạo yêu cầu từ trạng thái chưa kết bạn. Có một yêu cầu đang chờ đúng cặp người dùng. | NOT RUN |
| <a name="ac-id-005"></a>AC-ID-005 | [REQ-ID-005](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-id-005) | Người gửi thử chấp nhận rồi đến người nhận. Chỉ người nhận chuyển quan hệ sang đã kết bạn. | NOT RUN |
| <a name="ac-id-006"></a>AC-ID-006 | [REQ-ID-006](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-id-006) | A hủy yêu cầu của mình. Kiểm B không thể dùng yêu cầu đó để tạo kết nối sau khi hủy. | NOT RUN |
| <a name="ac-id-003"></a>AC-ID-003 | [REQ-ID-003](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-id-003) | A chặn B. Danh sách chặn của A có B và không đổi quan hệ với C. | NOT RUN |
| <a name="ac-id-007"></a>AC-ID-007 | [REQ-ID-007](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-id-007) | A gửi báo cáo hợp lệ về B. API ghi nhận báo cáo do A gửi cho đúng đối tượng. | NOT RUN |
| <a name="ac-id-008"></a>AC-ID-008 | [REQ-ID-008](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-id-008) | Chạy ma trận chính sách A/B/C cho Chat, tìm kiếm, Feed, Call và cập nhật liên quan. C giữ quyền hợp lệ. Tách credential và nội dung đã phát trước chặn. | NOT RUN |
| <a name="ac-id-004"></a>AC-ID-004 | [REQ-ID-004](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-id-004) | Đặt quyền riêng tư rồi dùng tài khoản không đủ quyền gọi trực tiếp, không qua UI. API áp dụng cấu hình khi lọc. | NOT RUN |
| <a name="ac-sec-001"></a>AC-SEC-001 | [NFR-SEC-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-sec-001) | Cho tài khoản ngoài hội thoại gọi API đọc bằng ID hợp lệ. Không trả dữ liệu mà thành viên được phép có thể đọc. | NOT RUN |

### TC-FEED-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-feed-001"></a>AC-FEED-001 | [REQ-FEED-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-001) | Kiểm list và detail của public/friends/private bằng tác giả, người có quyền và người ngoài. Không trả bài ngoài audience. | NOT RUN |
| <a name="ac-feed-005"></a>AC-FEED-005 | [REQ-FEED-005](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-005) | Tạo bài với từng audience hợp lệ và thử audience không hỗ trợ. Bài hợp lệ giữ audience, giá trị sai bị từ chối với HTTP 400. | NOT RUN |
| <a name="ac-feed-006"></a>AC-FEED-006 | [REQ-FEED-006](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-006) | Người khác rồi chủ bài thử sửa cùng bài. Lần không có quyền không đổi dữ liệu. | NOT RUN |
| <a name="ac-feed-007"></a>AC-FEED-007 | [REQ-FEED-007](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-007) | Người khác rồi chủ bài thử xóa cùng bài. Lần không có quyền không làm mất bài. | NOT RUN |
| <a name="ac-feed-002"></a>AC-FEED-002 | [REQ-FEED-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-002) | Người xem được phép và người không có quyền thử reaction lên bài. Chỉ lần hợp lệ đổi reaction. | NOT RUN |
| <a name="ac-feed-008"></a>AC-FEED-008 | [REQ-FEED-008](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-008) | Đăng bình luận với viewer hợp lệ và không hợp lệ. Chỉ bình luận hợp lệ xuất hiện. | NOT RUN |
| <a name="ac-feed-003"></a>AC-FEED-003 | [REQ-FEED-003](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-003) | Thử một ảnh, một video và payload chỉ có chữ. Hai payload media hợp lệ được chấp nhận, payload chữ bị từ chối. | NOT RUN |
| <a name="ac-feed-009"></a>AC-FEED-009 | [REQ-FEED-009](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-009) | Tạo Story còn hạn, quá hạn và không có quyền xem theo fixture. Kết quả chỉ chứa Story hợp lệ. | NOT RUN |
| <a name="ac-feed-004"></a>AC-FEED-004 | [REQ-FEED-004](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-feed-004) | Người gửi thường và moderator thử xét duyệt. Chỉ moderator có quyền đổi trạng thái. | NOT RUN |

### TC-CALL-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-call-001"></a>AC-CALL-001 | [REQ-CALL-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-call-001) | Chạy tạo, tham gia, từ chối, rời và kết thúc với trạng thái và vai trò hợp lệ. Thử một đối chứng không hợp lệ cho mỗi thao tác. Chỉ chuyển hợp lệ thành công. | NOT RUN |
| <a name="ac-call-002"></a>AC-CALL-002 | [REQ-CALL-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-call-002) | Thử xin credential bằng người có quyền và người ngoài. Chỉ người đủ quyền nhận credential. | NOT RUN |
| <a name="ac-call-003"></a>AC-CALL-003 | [REQ-CALL-003](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-call-003) | Thử chưa consent, consent của người khác và consent hợp lệ. Chỉ consent đúng người và cuộc gọi cho phép xử lý. | NOT RUN |
| <a name="ac-call-004"></a>AC-CALL-004 | [REQ-CALL-004](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-call-004) | Dùng endpoint/provider giả lập với PCM tổng hợp. Ghi thời điểm API xác nhận thu hồi, số frame mới provider nhận sau mốc đó và thời điểm stream đóng. Không tính frame đã gửi trước mốc. Chỉ PASS nếu không gửi frame mới sau thu hồi và reconnect với consent đã thu hồi không mở luồng provider. Không lấy tick 2 giây làm tiêu chí PASS. | NOT RUN |

### TC-AI-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-ai-001"></a>AC-AI-001 | [REQ-AI-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-ai-001) | Quét artifact của build bằng sentinel tổng hợp. Không phát hiện khóa trong bundle. | NOT RUN |
| <a name="ac-ai-002"></a>AC-AI-002 | [REQ-AI-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-ai-002) | Mô phỏng cả response thành công và lỗi provider. Không lộ sentinel hoặc nguyên văn lỗi chứa khóa. | NOT RUN |

### TC-MKT-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-mkt-001"></a>AC-MKT-001 | [REQ-MKT-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-mkt-001) | Seller tạo nháp. Bản ghi đứng tên seller và chưa hiển thị công khai. | NOT RUN |
| <a name="ac-mkt-005"></a>AC-MKT-005 | [REQ-MKT-005](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-mkt-005) | Cho buyer và seller thử công bố cùng bản nháp. Chỉ seller hợp lệ công bố thành công. | NOT RUN |
| <a name="ac-mkt-002"></a>AC-MKT-002 | [REQ-MKT-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-mkt-002) | Thêm rồi xóa dòng giỏ bằng buyer A. Giỏ của buyer B không thay đổi. | NOT RUN |
| <a name="ac-mkt-006"></a>AC-MKT-006 | [REQ-MKT-006](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-mkt-006) | Checkout với giỏ hợp lệ và chưa cấu hình thanh toán. Đơn được tạo ở trạng thái chờ, không thu tiền. | NOT RUN |
| <a name="ac-mkt-003"></a>AC-MKT-003 | [REQ-MKT-003](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-mkt-003) | Gửi request chứa trạng thái đã trả tiền do client khai. Không có đơn được xác nhận đã thanh toán. | NOT RUN |
| <a name="ac-mkt-004"></a>AC-MKT-004 | [REQ-MKT-004](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-mkt-004) | Khi có bản thử được duyệt, yêu cầu một thao tác trong danh sách và một thao tác ngoài danh sách. Thao tác ngoài danh sách không thực thi. | NOT RUN |

### TC-ECON-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-econ-001"></a>AC-ECON-001 | [REQ-ECON-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-econ-001) | Review release flag và quyết định phê duyệt ledger/đối soát. Không cho phép giao dịch thật nếu chưa đủ bằng chứng. | NOT RUN |

### TC-MEDIA-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-priv-001"></a>AC-PRIV-001 | [NFR-PRIV-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-priv-001) | Sau chặn hoặc mất tư cách thành viên, kiểm thêm hồ sơ theo policy và gọi mới để đọc tin hoặc media. Không dùng dữ liệu đã tải hoặc URL provider đã cấp để suy ra kết quả. | NOT RUN |

### TC-REL-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-rel-001"></a>AC-REL-001 | [NFR-REL-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-rel-001) | Chặn ACK thử, gửi lại cùng clientId và payload. Chỉ một bản ghi và cùng ID trả về. | NOT RUN |
| <a name="ac-rel-002"></a>AC-REL-002 | [NFR-REL-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-rel-002) | Giữ ACK ở trạng thái chưa đến rồi cho server xác nhận. Chỉ sau xác nhận UI báo gửi thành công. | NOT RUN |

### TC-DATA-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-data-001"></a>AC-DATA-001 | [NFR-DATA-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-data-001) | Quan sát thứ tự trên DB QA mới và bản sao schema cũ. Khớp thứ tự danh sách đã nhúng. | NOT RUN |
| <a name="ac-data-002"></a>AC-DATA-002 | [NFR-DATA-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-data-002) | Gây lỗi có kiểm soát sau bước đầu trên DB dùng một lần. Migration trả lỗi và các thay đổi trong transaction được rollback. | NOT RUN |

### TC-ACC-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-acc-001"></a>AC-ACC-001 | [NFR-ACC-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-acc-001) | Ở hai viewport đã nêu trong ca, dùng Tab đến nút Tin nhắn. Nút có thể nhận focus và chỉ dấu focus nhìn thấy được. | NOT RUN |
| <a name="ac-acc-002"></a>AC-ACC-002 | [NFR-ACC-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-acc-002) | Ở hai viewport của ca, đọc tên hoặc mô tả trong cây trợ năng cho nút Tin nhắn ở 0, 1, 100 và lại về 0. Ở 1 và 100, công bố đúng mức chưa đọc đúng một lần, giữ nhãn Tin nhắn. Sau về 0, không công bố số cũ. | NOT RUN |
| <a name="ac-acc-003"></a>AC-ACC-003 | [NFR-ACC-003](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-acc-003) | Ghi ma trận cho đăng nhập, điều hướng, đọc/gửi tin và thao tác chính của Feed. Đánh giá 2.1.1, 2.4.7 và 4.1.2 ở từng luồng hoặc ghi tiêu chí không áp dụng cùng lý do. Checkpoint hai viewport của nút Tin nhắn không thay thế ma trận này. | NOT RUN |

### TC-DESK-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-plat-001"></a>AC-PLAT-001 | [NFR-PLAT-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-plat-001) | Gọi cùng IPC từ frame tin cậy và không tin cậy trong build QA. Frame không tin cậy không nhận năng lực native. | NOT RUN |

### TC-OPS-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-obs-001"></a>AC-OBS-001 | [NFR-OBS-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-obs-001) | Kích hoạt lỗi tổng hợp tại staging. Từ evidence nhận diện được release và thành phần gặp lỗi. | NOT RUN |
| <a name="ac-obs-002"></a>AC-OBS-002 | [NFR-OBS-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-obs-002) | Dùng sentinel tổng hợp khi giả lập sự cố. Bản evidence đã lọc không chứa sentinel nhạy cảm. | NOT RUN |

### TC-MAINT-001

| Checkpoint | Yêu cầu | Thao tác và điều kiện đạt | Kết quả |
|---|---|---|---|
| <a name="ac-maint-001"></a>AC-MAINT-001 | [NFR-MAINT-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-maint-001) | Chạy cùng gate trên SHA thay đổi và target. Không có finding mới ngoài baseline hợp lệ. | NOT RUN |

Khi chạy, ghi mã ca và checkpoint, build SHA, OS/browser/kiến trúc, thời gian, môi trường, dữ liệu thử, kết quả thực tế, bằng chứng, lỗi còn lại và người kiểm. Xem [ma trận truy vết](TRACEABILITY_MATRIX.md).

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp đối chiếu theo baseline. Bổ sung điều kiện đạt riêng cho từng yêu cầu.
