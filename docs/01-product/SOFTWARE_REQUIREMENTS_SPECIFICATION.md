---
document_id: REQ-SRS-001
title: Đặc tả yêu cầu phần mềm ChatNet
version: 1.1.0
status: Draft
owner: Product and Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 29148:2018"
---

# Đặc tả yêu cầu phần mềm ChatNet

## 1. Giới thiệu

### 1.1 Mục đích

Tài liệu này nêu yêu cầu phần mềm của ChatNet tại commit ghi trong metadata. Product, Engineering, QA và Security dùng tài liệu làm cơ sở thiết kế, kiểm thử và nghiệm thu. Cấu trúc theo các mục của SRS trong ISO/IEC/IEEE 29148:2018, rút gọn theo [hồ sơ áp dụng tiêu chuẩn](../00-governance/STANDARDS_REGISTER.md). Việc dùng cấu trúc này không phải là tuyên bố chứng nhận hay conformance.

### 1.2 Phạm vi

**Trong phạm vi:** Web/PWA là phạm vi chính. Backend Go gồm Gateway, Auth, Chat, Feed, Call và Translation. Renderer dùng chung với Electron Desktop. Flutter chỉ được đề cập ở mức tương thích, chưa có yêu cầu riêng.

**Ngoài phạm vi baseline:** E2EE production và rekey nhóm/thiết bị, lưu trữ ngang hàng phân tán, AI hỗ trợ người bán, thanh toán thật, ledger Point/Coin, kênh cập nhật Desktop có ký. Các mục này chỉ xuất hiện dưới dạng đề xuất hoặc giới hạn phát hành. Xem [tổng quan sản phẩm](PRODUCT_OVERVIEW.md#5-product-scope-boundaries) và [bảng trạng thái tính năng](FEATURE_STATUS_REGISTER.md).

### 1.3 Tài liệu tham chiếu

- [Tổng quan sản phẩm](PRODUCT_OVERVIEW.md), [use case](USE_CASES.md), [bảng trạng thái tính năng](FEATURE_STATUS_REGISTER.md)
- [Bối cảnh hệ thống](../02-architecture/SYSTEM_CONTEXT.md), [kiến trúc hệ thống](../02-architecture/SYSTEM_ARCHITECTURE.md)
- [Danh mục API](../03-interfaces/API_CATALOG.md), [danh mục sự kiện realtime](../03-interfaces/REALTIME_EVENT_CATALOG.md), [danh mục lỗi](../03-interfaces/ERROR_CATALOG.md)
- [Hồ sơ áp dụng tiêu chuẩn](../00-governance/STANDARDS_REGISTER.md), [bảng thuật ngữ](../00-governance/TERMS_GLOSSARY.md)
- [Ma trận truy vết](../07-quality/TRACEABILITY_MATRIX.md), [ca nghiệm thu](../07-quality/ACCEPTANCE_CASES.md), [kế hoạch V&V](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md)

### 1.4 Định nghĩa dùng trong SRS

Thuật ngữ chung nằm ở [bảng thuật ngữ](../00-governance/TERMS_GLOSSARY.md). Bảng dưới định nghĩa các cụm xuất hiện lặp lại ở cột yêu cầu, để mỗi yêu cầu kiểm được theo cùng một nghĩa.

| Cụm trong yêu cầu | Nghĩa trong SRS |
|---|---|
| Người dùng đủ quyền, người gọi được phép | Tài khoản đã xác thực, có phiên chưa thu hồi và thỏa mọi điều kiện sau mà thao tác đó áp dụng: quan hệ chặn không áp dụng cho cặp tài khoản liên quan; vai trò hoặc tư cách thành viên mà mục thiết kế ở cột **Nguồn / thẩm quyền** quy định cho thao tác; thiết lập riêng tư của tài nguyên đích cho phép. Nếu mục thiết kế không nêu điều kiện cho một thao tác, yêu cầu đó chưa kiểm được và phải được bổ sung điều kiện trước nghiệm thu. |
| Hợp lệ (thông tin, yêu cầu, tệp, OTP, bearer) | Vượt qua các kiểm tra định dạng, kích thước, thời hạn và trạng thái mà server thực hiện tại điểm xử lý nêu ở [ma trận truy vết](../07-quality/TRACEABILITY_MATRIX.md). |
| Từ chối | Server trả phản hồi lỗi HTTP hoặc đóng luồng, và không thay đổi dữ liệu được bảo vệ. Mã lỗi cụ thể theo [danh mục lỗi](../03-interfaces/ERROR_CATALOG.md). Danh mục này chưa quy định mã lỗi ổn định cho mọi endpoint. |
| Trạng thái phù hợp, quan hệ phù hợp | Trạng thái mà máy trạng thái hoặc quy tắc nghiệp vụ ở mục thiết kế tương ứng cho phép chuyển tiếp. |
| Có đối chiếu source | Đã tìm thấy điểm xử lý trong mã nguồn tại baseline. Không có nghĩa là đã chạy, nghiệm thu, triển khai hay được Product phê duyệt. |
| Chưa nghiệm thu / NOT RUN | Chưa có bản ghi thực thi xác định commit/build, môi trường, lệnh, kết quả và bằng chứng. |

### 1.5 Quy ước yêu cầu

- Mỗi hàng ở mục 6 và 7 là một yêu cầu bắt buộc theo nghĩa "hệ thống phải". Câu trong cột **Yêu cầu kiểm được** mô tả hành vi quan sát được.
- ID ổn định, không dùng lại sau khi bỏ. Tiền tố REQ cho chức năng, NFR cho chất lượng.
- Cột **Nguồn / thẩm quyền** phân biệt quy tắc suy từ source, quy tắc lấy từ chính sách và đề xuất chờ quyết định. Product và Engineering chịu trách nhiệm trình các yêu cầu chức năng ra review. Với yêu cầu chất lượng, chủ chuyên môn được nêu ở tài liệu dẫn chiếu.
- Cột **Tình trạng tại baseline** ghi kết quả đối chiếu source, không phải kết quả nghiệm thu.
- Mỗi mã dẫn tới hàng tương ứng trong [ma trận truy vết](../07-quality/TRACEABILITY_MATRIX.md) để xem mã nguồn, ký hiệu, cách xác minh và checkpoint.

| Ưu tiên | Tiêu chí áp dụng trong bản nháp |
|---|---|
| P0 | Không đề xuất phát hành phạm vi bị ảnh hưởng khi yêu cầu không đạt, chưa có bằng chứng hoặc còn quyết định chặn phát hành. |
| P1 | Cần nghiệm thu nếu thuộc phạm vi phát hành. Nếu hoãn, ghi giới hạn, phạm vi bị ảnh hưởng và quyết định của owner. |
| P2 | Cải tiến hoặc đề xuất chưa bắt buộc cho baseline. Chỉ nghiệm thu khi được đưa vào phạm vi. |

Giữ 36 mã đã dùng để không gãy tham chiếu. Mã cũ giữ một nghĩa chính duy nhất. Các nghĩa đi kèm được cấp mã mới trong cùng nhóm. Cụ thể, AUTH-001/002/003/004 được tách với AUTH-005–009, CHAT-002–007 với CHAT-008–016, ID-002/003 với ID-005–008, FEED-001/002/003 với FEED-005–009, CALL-003 với CALL-004, AI-001 với AI-002, MKT-001/002 với MKT-005/006, và REL-001, DATA-001, ACC-001, OBS-001 với các mã bổ sung của từng nhóm. Xem checkpoint tương ứng để đối chiếu hành vi cụ thể.

## 2. Mô tả tổng quát

### 2.1 Bối cảnh sản phẩm

ChatNet là nền tảng nhắn tin đa ngôn ngữ kết hợp mạng xã hội. Client gọi API Gateway qua HTTPS. Gateway chuyển yêu cầu tới Auth, Chat, Feed, Call và Translation. Các service dùng PostgreSQL cho dữ liệu bền, Redis cho trạng thái tạm và realtime, kho đối tượng tương thích S3 cho media, LiveKit cho cuộc gọi. Ranh giới hệ thống, tác nhân ngoài và luồng dữ liệu nằm ở [bối cảnh hệ thống](../02-architecture/SYSTEM_CONTEXT.md).

### 2.2 Chức năng chính

| Nhóm | Vị trí trong SRS |
|---|---|
| Xác thực và phiên | Mục 6, nhóm "Xác thực và phiên" |
| Hội thoại, nhóm, kênh, đọc và realtime | Mục 6, nhóm "Hội thoại và nhóm" |
| Danh tính, liên hệ, chặn, riêng tư | Mục 6, nhóm "Danh tính và quyền riêng tư" |
| Feed, bình luận, Story, báo cáo | Mục 6, nhóm "Feed và Story" |
| Cuộc gọi và đồng ý dịch | Mục 6, nhóm "Cuộc gọi và đồng ý dịch" |
| Bảo vệ khóa nhà cung cấp AI | Mục 6, nhóm "Khóa nhà cung cấp AI" |
| Marketplace | Mục 6, nhóm "Marketplace" |
| Point và Coin | Mục 6, nhóm "Point và Coin" (chỉ giới hạn phát hành) |

### 2.3 Người dùng và nhu cầu của stakeholder

Bảng dưới suy từ danh sách stakeholder ở [tổng quan sản phẩm](PRODUCT_OVERVIEW.md#3-stakeholders). Các nhu cầu này **chưa được từng stakeholder xác nhận**. Mục đích là cho phép truy vết từ nhu cầu tới yêu cầu.

| Stakeholder | Nhu cầu | Yêu cầu liên quan |
|---|---|---|
| Người dùng cuối | Nhắn tin không mất, không trùng. Tài khoản và dữ liệu riêng tư được bảo vệ. Giao diện dùng được bằng bàn phím và trình đọc màn hình. | REQ-AUTH-*, REQ-CHAT-*, REQ-ID-*, NFR-REL-*, NFR-PRIV-001, NFR-ACC-* |
| Chủ nhóm, moderator | Quản lý thành viên, kênh, lời mời, yêu cầu gia nhập, báo cáo. | REQ-CHAT-007/008/015/016, REQ-FEED-004 |
| Product owner | Phạm vi, chính sách, quyết định phát hành rõ ràng và có thể kiểm. | Mục 8 (quyết định mở), REQ-MKT-003/004, REQ-ECON-001 |
| Kỹ sư backend | Phân quyền phía server, hợp đồng API, toàn vẹn dữ liệu. | REQ-AUTH-003/008, NFR-SEC-001, NFR-DATA-* |
| Kỹ sư client | Tách UI khỏi chính sách, hành vi offline, năng lực nền tảng. | NFR-REL-002, NFR-PLAT-001, NFR-MAINT-001 |
| QA | Mỗi yêu cầu có điểm kiểm và bằng chứng tái lập được. | Mục 8, [ma trận truy vết](../07-quality/TRACEABILITY_MATRIX.md) |
| Security reviewer | Ranh giới tin cậy, bí mật, thu hồi quyền, lạm dụng. | REQ-AI-*, REQ-CALL-003/004, NFR-SEC-001, NFR-PRIV-001 |
| Operator | Cấu hình, triển khai, quan sát, khôi phục. | NFR-OBS-*, NFR-DATA-* |

### 2.4 Ràng buộc thiết kế

- Phân quyền do server quyết định. Trạng thái UI không thay cho chính sách server ([nguyên tắc sản phẩm 1–3](PRODUCT_OVERVIEW.md#4-product-principles)).
- Khóa nhà cung cấp AI chỉ nằm phía server. Bundle Web và Desktop không chứa khóa (REQ-AI-001/002).
- Dữ liệu bền ở PostgreSQL, trạng thái tạm ở Redis. Redis TTL không phải nguồn phân quyền bền.
- Phase 1 phát hành Web và PWA. Không thêm công việc phát hành iOS hoặc Android native khi chưa có yêu cầu rõ ràng.
- Stack hiện tại: React 19, TypeScript, Vite cho frontend. Go, PostgreSQL, Redis cho backend. Chi tiết ở [kiến trúc hệ thống](../02-architecture/SYSTEM_ARCHITECTURE.md#6-architecture-constraints).

### 2.5 Giả định và phụ thuộc

- Dịch vụ ngoài (LiveKit, kho đối tượng, OneSignal, email, nhà cung cấp AI) không thuộc kho mã nguồn. Hợp đồng, sẵn sàng và cấu hình của chúng phải được xác minh theo từng môi trường.
- Yêu cầu có trạng thái "Có đối chiếu source" giả định source tại baseline là hành vi dự kiến. Source không phải chứng cứ thay cho chạy thử.
- Các quyết định ở mục 8 là phụ thuộc chặn phát hành của những yêu cầu được liệt kê.

## 3. Yêu cầu giao diện bên ngoài

SRS này không thêm yêu cầu mới ở mục này. Bảng chỉ chỉ ra tài liệu hợp đồng và mã yêu cầu áp dụng.

| Loại giao diện | Tài liệu hợp đồng | Yêu cầu áp dụng |
|---|---|---|
| Giao diện người dùng Web/PWA | [Thiết kế và trợ năng](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md), [Web/PWA](../05-clients/WEB_PWA.md) | NFR-ACC-001/002/003, NFR-REL-002 |
| HTTP API | [Danh mục API](../03-interfaces/API_CATALOG.md) (dẫn xuất từ source). [OpenAPI](../03-interfaces/openapi.json) có ba thao tác đối chiếu tới handler và 177 thao tác kiểm kê chưa có schema, không thay thế danh mục | REQ-AUTH-*, REQ-CHAT-*, REQ-ID-*, REQ-FEED-*, REQ-MKT-* |
| Sự kiện realtime (SSE) | [Danh mục sự kiện](../03-interfaces/REALTIME_EVENT_CATALOG.md), [AsyncAPI](../03-interfaces/realtime.asyncapi.json) giới hạn | REQ-CHAT-006, REQ-CHAT-014 |
| Lỗi | [Danh mục lỗi](../03-interfaces/ERROR_CATALOG.md) | Định nghĩa "Từ chối" ở mục 1.4 |
| Hệ thống ngoài | [Bối cảnh hệ thống](../02-architecture/SYSTEM_CONTEXT.md#4-external-actors-and-systems) | REQ-CALL-002/003/004, REQ-AI-001/002, REQ-MKT-003 |
| Cầu nối Desktop (IPC) | [Desktop Electron](../05-clients/DESKTOP_ELECTRON.md#3-trusted-renderer-boundary) | NFR-PLAT-001 |

## 4. Yêu cầu hiệu năng và mức dịch vụ

Baseline **chưa có yêu cầu định lượng** về độ trễ, thông lượng, khả dụng, RPO hay RTO. Chủ sở hữu chưa chốt SLO và retention (TBD-01 ở mục 8). Không công bố con số khi chưa có số đo và quyết định của owner. Yêu cầu chất lượng ở mục 7 là định tính và kiểm được bằng quan sát hành vi.

## 5. Tiêu chuẩn và ràng buộc tuân thủ

[Hồ sơ áp dụng tiêu chuẩn](../00-governance/STANDARDS_REGISTER.md) liệt kê tiêu chuẩn tham chiếu. WCAG 2.2 và OWASP ASVS là tham chiếu đích, không phải tuyên bố conformance. NFR-ACC-003 yêu cầu ghi pass/fail riêng theo từng tiêu chí WCAG đã chọn.

## 6. Yêu cầu chức năng

### Xác thực và phiên

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="req-auth-001"></a>[REQ-AUTH-001](../07-quality/TRACEABILITY_MATRIX.md#trace-req-auth-001) | P0 | Auth chỉ hoàn tất xác minh email đăng ký bằng OTP hợp lệ. | [Suy từ source](../04-backend/AUTHENTICATION_AND_SESSIONS.md#2-registration-and-verification) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-auth-005"></a>[REQ-AUTH-005](../07-quality/TRACEABILITY_MATRIX.md#trace-req-auth-005) | P0 | Auth không cấp phiên khi OTP sai hoặc hết hạn. | [Suy từ source](../04-backend/AUTHENTICATION_AND_SESSIONS.md#2-registration-and-verification) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-auth-002"></a>[REQ-AUTH-002](../07-quality/TRACEABILITY_MATRIX.md#trace-req-auth-002) | P0 | Auth cấp phiên khi người dùng đã xác minh đăng nhập bằng thông tin hợp lệ. | [Suy từ source](../04-backend/AUTHENTICATION_AND_SESSIONS.md#3-login-and-session-lifecycle) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-auth-006"></a>[REQ-AUTH-006](../07-quality/TRACEABILITY_MATRIX.md#trace-req-auth-006) | P0 | Auth chỉ làm mới phiên khi refresh credential còn hiệu lực. | [Suy từ source](../04-backend/AUTHENTICATION_AND_SESSIONS.md#3-login-and-session-lifecycle) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-auth-007"></a>[REQ-AUTH-007](../07-quality/TRACEABILITY_MATRIX.md#trace-req-auth-007) | P0 | Auth thu hồi phiên được chỉ định bởi yêu cầu đăng xuất hợp lệ. | [Suy từ source](../04-backend/AUTHENTICATION_AND_SESSIONS.md#3-login-and-session-lifecycle) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-auth-003"></a>[REQ-AUTH-003](../07-quality/TRACEABILITY_MATRIX.md#trace-req-auth-003) | P0 | Route bảo vệ từ chối yêu cầu thiếu hoặc có bearer không hợp lệ. | [Suy từ source](../04-backend/AUTHENTICATION_AND_SESSIONS.md#5-security-requirements) | Có middleware, phải phân loại từng route |
| <a name="req-auth-008"></a>[REQ-AUTH-008](../07-quality/TRACEABILITY_MATRIX.md#trace-req-auth-008) | P0 | Route có kiểm phiên phía server từ chối bearer của phiên đã thu hồi. | [Suy từ source](../04-backend/AUTHENTICATION_AND_SESSIONS.md#5-security-requirements) | Có kiểm phiên, không áp cho route chỉ kiểm JWT |
| <a name="req-auth-004"></a>[REQ-AUTH-004](../07-quality/TRACEABILITY_MATRIX.md#trace-req-auth-004) | P1 | Danh sách phiên chỉ trả phiên của tài khoản đang xác thực. | [Suy từ source](../04-backend/AUTHENTICATION_AND_SESSIONS.md#3-login-and-session-lifecycle) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-auth-009"></a>[REQ-AUTH-009](../07-quality/TRACEABILITY_MATRIX.md#trace-req-auth-009) | P1 | API thu hồi phiên từ chối thao tác lên phiên thuộc tài khoản khác. | [Suy từ source](../04-backend/AUTHENTICATION_AND_SESSIONS.md#3-login-and-session-lifecycle) | Có đối chiếu source, chưa nghiệm thu |

### Hội thoại và nhóm

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="req-chat-001"></a>[REQ-CHAT-001](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-001) | P0 | Server tạo tối đa một hội thoại trực tiếp cho một cặp đủ quyền. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#2-conversation-and-message-model) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-002"></a>[REQ-CHAT-002](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-002) | P0 | Người dùng đủ quyền tạo được hội thoại nhóm. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#5-group-governance-and-channels) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-008"></a>[REQ-CHAT-008](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-008) | P0 | Thao tác quản lý thành viên nhóm chỉ thành công với vai trò có quyền tương ứng. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#5-group-governance-and-channels) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-003"></a>[REQ-CHAT-003](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-003) | P0 | Server chỉ nhận tin mới từ người dùng có quyền gửi vào hội thoại hoặc kênh tương ứng. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#2-conversation-and-message-model) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-009"></a>[REQ-CHAT-009](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-009) | P0 | API lịch sử tin chỉ trả nội dung hội thoại hoặc kênh người gọi được phép đọc. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#2-conversation-and-message-model) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-010"></a>[REQ-CHAT-010](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-010) | P0 | API sửa tin từ chối người dùng không có quyền sửa tin đó. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#2-conversation-and-message-model) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-011"></a>[REQ-CHAT-011](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-011) | P0 | API thu hồi tin từ chối người gọi không có quyền thu hồi tin đó. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#2-conversation-and-message-model) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-004"></a>[REQ-CHAT-004](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-004) | P0 | API trả tổng tin chưa đọc theo tài khoản đang xác thực. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#3-read-state-and-unread-summaries) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-012"></a>[REQ-CHAT-012](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-012) | P0 | API cập nhật con trỏ đọc trong đúng hội thoại hoặc kênh của người đọc. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#3-read-state-and-unread-summaries) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-005"></a>[REQ-CHAT-005](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-005) | P1 | Thao tác reaction tin chỉ thành công khi người gọi được phép tương tác với tin đó. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#4-reactions-pins-and-shared-content) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-013"></a>[REQ-CHAT-013](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-013) | P1 | Thao tác ghim tin thực thi quy tắc ghim của loại hội thoại và quyền người gọi. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#4-reactions-pins-and-shared-content) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-006"></a>[REQ-CHAT-006](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-006) | P0 | Server chỉ gửi sự kiện SSE tới phiên được phép nhận nội dung sự kiện. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#7-realtime) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-014"></a>[REQ-CHAT-014](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-014) | P0 | Sau gián đoạn SSE, client đồng bộ lại trạng thái từ server thay vì giả định có replay đầy đủ. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#7-realtime) | Có luồng SSE, chưa xác nhận hội tụ trên build |
| <a name="req-chat-007"></a>[REQ-CHAT-007](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-007) | P1 | Chỉ vai trò được phép mới quản lý được kênh trong nhóm. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#5-group-governance-and-channels) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-015"></a>[REQ-CHAT-015](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-015) | P1 | Chỉ vai trò được phép mới quản lý được lời mời nhóm. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#5-group-governance-and-channels) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-chat-016"></a>[REQ-CHAT-016](../07-quality/TRACEABILITY_MATRIX.md#trace-req-chat-016) | P1 | Chỉ vai trò được phép mới xét được yêu cầu gia nhập nhóm. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#5-group-governance-and-channels) | Có đối chiếu source, chưa nghiệm thu |

### Danh tính và quyền riêng tư

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="req-id-001"></a>[REQ-ID-001](../07-quality/TRACEABILITY_MATRIX.md#trace-req-id-001) | P1 | Tìm người chỉ trả tài khoản cho người tìm được phép theo thiết lập tài khoản đích. | [Suy từ source](../06-security/IDENTITY_PRIVACY_AND_BLOCKING.md#2-identity-and-authorization-principles) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-id-002"></a>[REQ-ID-002](../07-quality/TRACEABILITY_MATRIX.md#trace-req-id-002) | P1 | Người gửi đủ quyền tạo được yêu cầu kết bạn ở trạng thái quan hệ phù hợp. | [Suy từ source](../04-backend/IDENTITY_AND_CONTACTS.md#2-data-and-api-surface) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-id-005"></a>[REQ-ID-005](../07-quality/TRACEABILITY_MATRIX.md#trace-req-id-005) | P1 | Chỉ người nhận yêu cầu đang chờ mới chấp nhận được yêu cầu kết bạn. | [Suy từ source](../04-backend/IDENTITY_AND_CONTACTS.md#2-data-and-api-surface) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-id-006"></a>[REQ-ID-006](../07-quality/TRACEABILITY_MATRIX.md#trace-req-id-006) | P1 | Thao tác hủy hoặc gỡ kết nối chỉ làm thay đổi quan hệ của người dùng đang gọi. | [Suy từ source](../04-backend/IDENTITY_AND_CONTACTS.md#2-data-and-api-surface) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-id-003"></a>[REQ-ID-003](../07-quality/TRACEABILITY_MATRIX.md#trace-req-id-003) | P0 | Yêu cầu chặn hợp lệ tạo quan hệ chặn cho đúng cặp tài khoản. | [Suy từ source](../06-security/IDENTITY_PRIVACY_AND_BLOCKING.md#3-block-semantics) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-id-007"></a>[REQ-ID-007](../07-quality/TRACEABILITY_MATRIX.md#trace-req-id-007) | P0 | Người dùng gửi được báo cáo tài khoản hợp lệ qua API báo cáo. | [Suy từ source](../04-backend/IDENTITY_AND_CONTACTS.md#2-data-and-api-surface) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-id-008"></a>[REQ-ID-008](../07-quality/TRACEABILITY_MATRIX.md#trace-req-id-008) | P0 | Mỗi bề mặt thuộc chính sách chặn áp dụng hạn chế cho thao tác mới của cặp bị chặn. | [Chính sách chặn giữ lại](../06-security/IDENTITY_PRIVACY_AND_BLOCKING.md#3-block-semantics) | Có guard, chưa xác nhận liên dịch vụ |
| <a name="req-id-004"></a>[REQ-ID-004](../07-quality/TRACEABILITY_MATRIX.md#trace-req-id-004) | P0 | Server thực thi thiết lập riêng tư khi trả dữ liệu, kể cả khi gọi API trực tiếp. | [Chính sách riêng tư](../06-security/IDENTITY_PRIVACY_AND_BLOCKING.md#2-identity-and-authorization-principles) | Có cấu hình và lọc, chưa xác nhận từng bề mặt |

### Feed và Story

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="req-feed-001"></a>[REQ-FEED-001](../07-quality/TRACEABILITY_MATRIX.md#trace-req-feed-001) | P1 | API Feed áp dụng audience khi trả bài cho người xem. | [Suy từ source](../04-backend/SOCIAL_FEED.md#4-visibility-and-authorization) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-feed-005"></a>[REQ-FEED-005](../07-quality/TRACEABILITY_MATRIX.md#trace-req-feed-005) | P1 | Người dùng đủ quyền tạo bài với audience được hỗ trợ. | [Suy từ source](../04-backend/SOCIAL_FEED.md#3-http-operations) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-feed-006"></a>[REQ-FEED-006](../07-quality/TRACEABILITY_MATRIX.md#trace-req-feed-006) | P1 | API cập nhật bài chỉ cho phép người có quyền sửa bài đó. | [Suy từ source](../04-backend/SOCIAL_FEED.md#4-visibility-and-authorization) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-feed-007"></a>[REQ-FEED-007](../07-quality/TRACEABILITY_MATRIX.md#trace-req-feed-007) | P1 | API xóa bài chỉ cho phép người có quyền xóa bài đó. | [Suy từ source](../04-backend/SOCIAL_FEED.md#4-visibility-and-authorization) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-feed-002"></a>[REQ-FEED-002](../07-quality/TRACEABILITY_MATRIX.md#trace-req-feed-002) | P1 | Người xem đủ quyền có thể thay reaction của chính mình trên bài viết. | [Suy từ source](../04-backend/SOCIAL_FEED.md#3-http-operations) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-feed-008"></a>[REQ-FEED-008](../07-quality/TRACEABILITY_MATRIX.md#trace-req-feed-008) | P1 | Người xem đủ quyền có thể đăng bình luận vào bài viết. | [Suy từ source](../04-backend/SOCIAL_FEED.md#3-http-operations) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-feed-003"></a>[REQ-FEED-003](../07-quality/TRACEABILITY_MATRIX.md#trace-req-feed-003) | P1 | API tạo Story tại baseline yêu cầu đúng một ảnh hoặc video hợp lệ. | [Suy từ source](../04-backend/SOCIAL_FEED.md#5-stories) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-feed-009"></a>[REQ-FEED-009](../07-quality/TRACEABILITY_MATRIX.md#trace-req-feed-009) | P1 | Danh sách Story chỉ trả Story còn hiệu lực và có quyền xem. | [Suy từ source](../04-backend/SOCIAL_FEED.md#5-stories) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-feed-004"></a>[REQ-FEED-004](../07-quality/TRACEABILITY_MATRIX.md#trace-req-feed-004) | P0 | Quyền gửi báo cáo Feed không cấp quyền xét duyệt báo cáo. | [Suy từ source](../04-backend/SOCIAL_FEED.md#6-moderation) | Có đối chiếu source, chưa nghiệm thu |

### Cuộc gọi và đồng ý dịch

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="req-call-001"></a>[REQ-CALL-001](../07-quality/TRACEABILITY_MATRIX.md#trace-req-call-001) | P0 | Mỗi thao tác vòng đời cuộc gọi chỉ thực hiện chuyển trạng thái được phép cho vai trò hiện tại. | [Suy từ source](../04-backend/CALLS_AND_TRANSLATION.md#2-call-lifecycle) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-call-002"></a>[REQ-CALL-002](../07-quality/TRACEABILITY_MATRIX.md#trace-req-call-002) | P0 | Server chỉ cấp credential LiveKit cho người có quyền tham gia cuộc gọi tương ứng. | [Suy từ source](../04-backend/CALLS_AND_TRANSLATION.md#3-livekit-integration) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-call-003"></a>[REQ-CALL-003](../07-quality/TRACEABILITY_MATRIX.md#trace-req-call-003) | P0 | Server không chuyển âm thanh của người nói sang provider khi chưa có consent hợp lệ cho cuộc gọi tương ứng. | [Chính sách consent](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md#4-consent-requirements) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-call-004"></a>[REQ-CALL-004](../07-quality/TRACEABILITY_MATRIX.md#trace-req-call-004) | P0 | Sau khi consent bị thu hồi, luồng dịch không tiếp tục gửi âm thanh mới của người nói đó tới provider. | [Chính sách consent](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md#4-consent-requirements) | Khoảng hở thiết kế: kiểm consent theo tick, không theo từng frame. Nghiệm thu NOT RUN |

### Khóa nhà cung cấp AI

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="req-ai-001"></a>[REQ-AI-001](../07-quality/TRACEABILITY_MATRIX.md#trace-req-ai-001) | P0 | Bundle Web và Desktop không chứa khóa nhà cung cấp AI. | [Chính sách Secrets](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md#2-text-and-ui-translation) | Có cấu hình server, chưa quét artifact |
| <a name="req-ai-002"></a>[REQ-AI-002](../07-quality/TRACEABILITY_MATRIX.md#trace-req-ai-002) | P0 | Phản hồi gửi cho client không chứa khóa nhà cung cấp AI. | [Chính sách Secrets](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md#2-text-and-ui-translation) | Có xử lý server, chưa kiểm toàn bộ response |

### Marketplace

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="req-mkt-001"></a>[REQ-MKT-001](../07-quality/TRACEABILITY_MATRIX.md#trace-req-mkt-001) | P1 | Người bán tạo được bản nháp sản phẩm thuộc tài khoản mình. | [Suy từ source](../04-backend/MARKETPLACE.md#3-http-operations) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-mkt-005"></a>[REQ-MKT-005](../07-quality/TRACEABILITY_MATRIX.md#trace-req-mkt-005) | P1 | Chỉ chủ bản nháp đủ điều kiện mới công bố được sản phẩm đó. | [Suy từ source](../04-backend/MARKETPLACE.md#3-http-operations) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-mkt-002"></a>[REQ-MKT-002](../07-quality/TRACEABILITY_MATRIX.md#trace-req-mkt-002) | P1 | API cho phép người mua thay đổi dòng giỏ của chính mình. | [Suy từ source](../04-backend/MARKETPLACE.md#4-transaction-and-validation-behavior) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-mkt-006"></a>[REQ-MKT-006](../07-quality/TRACEABILITY_MATRIX.md#trace-req-mkt-006) | P1 | Checkout hợp lệ tạo đơn ở trạng thái chờ khi chưa có cấu hình thanh toán. | [Suy từ source](../04-backend/MARKETPLACE.md#5-payment-and-order-state-boundary) | Có đối chiếu source, chưa nghiệm thu |
| <a name="req-mkt-003"></a>[REQ-MKT-003](../07-quality/TRACEABILITY_MATRIX.md#trace-req-mkt-003) | P0 | Trạng thái đã thanh toán chỉ được xác nhận bởi tích hợp thanh toán được phê duyệt, không lấy từ client. | [Quyết định thanh toán chưa duyệt](../04-backend/MARKETPLACE.md#5-payment-and-order-state-boundary) | Chưa tích hợp thanh toán thật |
| <a name="req-mkt-004"></a>[REQ-MKT-004](../07-quality/TRACEABILITY_MATRIX.md#trace-req-mkt-004) | P2 | Nếu triển khai trợ lý AI đăng bán, trợ lý chỉ được thực hiện thao tác nằm trong danh sách cho phép. | [Đề xuất Product](../04-backend/MARKETPLACE.md#6-ai-first-seller-workflow) | Đề xuất, chưa có source |

### Point và Coin

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="req-econ-001"></a>[REQ-ECON-001](../07-quality/TRACEABILITY_MATRIX.md#trace-req-econ-001) | P0 | Không bật luồng giao dịch Point/Coin trước khi ledger và đối soát được phê duyệt và kiểm chứng. | [Quyết định Product/Security còn mở](../04-backend/POINT_COIN_PRODUCT_SPEC.md#7-implementation-boundary) | Giới hạn phát hành, chưa có ledger |

## 7. Yêu cầu chất lượng

### An toàn truy cập

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="nfr-sec-001"></a>[NFR-SEC-001](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-sec-001) | P0 | Biết ID tài nguyên không đủ để đọc dữ liệu bảo vệ của tài nguyên đó. | [Chính sách Security](../06-security/THREAT_MODEL.md#4-trust-boundaries-and-threats) | Có đối chiếu source, chưa nghiệm thu |

### Thu hồi quyền truy cập

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="nfr-priv-001"></a>[NFR-PRIV-001](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-priv-001) | P0 | Yêu cầu mới qua ứng dụng phải từ chối dữ liệu khi quyền truy cập tương ứng đã bị thu hồi. | [Chính sách Security](../06-security/MEDIA_ACCESS_CONTROL.md#3-revocation-model) | Có recheck, chưa nghiệm thu mọi bề mặt |

### Độ tin cậy gửi tin

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="nfr-rel-001"></a>[NFR-REL-001](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-rel-001) | P0 | Retry gửi tin cùng định danh và cùng nội dung sau mất ACK không tạo bản ghi tin thứ hai. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#2-conversation-and-message-model) | Có đối chiếu source, chưa nghiệm thu |
| <a name="nfr-rel-002"></a>[NFR-REL-002](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-rel-002) | P0 | UI không báo tin đã gửi thành công nếu chưa có xác nhận thành công từ server. | [Suy từ source](../04-backend/CHAT_AND_GROUPS.md#2-conversation-and-message-model) | Có luồng gửi phía client, chưa nghiệm thu mất ACK |

### Toàn vẹn migration

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="nfr-data-001"></a>[NFR-DATA-001](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-data-001) | P0 | Ứng dụng chạy migration đúng trình tự khai báo của baseline. | [Suy từ source](../04-backend/DATABASE_MIGRATIONS.md#2-embedded-migration-sequence) | Có đối chiếu source, chưa nghiệm thu |
| <a name="nfr-data-002"></a>[NFR-DATA-002](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-data-002) | P0 | Lỗi migration không để lại các thay đổi dở của transaction. | [Suy từ source](../04-backend/DATABASE_MIGRATIONS.md#1-mechanism) | Có đối chiếu source, chưa nghiệm thu |

### Khả năng tiếp cận Web và PWA

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="nfr-acc-001"></a>[NFR-ACC-001](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-acc-001) | P1 | Nút Tin nhắn của Web/PWA phải có thể nhận focus bằng bàn phím và có dấu focus nhìn thấy được. | [Tiêu chí WCAG 2.2 (2.1.1, 2.4.7)](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md#4-accessibility-baseline) | Có nút điều hướng, chưa kiểm focus trên build |
| <a name="nfr-acc-002"></a>[NFR-ACC-002](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-acc-002) | P1 | Tên hoặc mô tả truy cập của nút Tin nhắn phải biểu đạt trạng thái chưa đọc hiện tại mà vẫn giữ nhãn Tin nhắn. | [Tiêu chí WCAG 2.2 (4.1.2)](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md#4-accessibility-baseline) | Khoảng hở tĩnh: tên nút tách khỏi badge, không có mô tả trợ năng cho số chưa đọc |
| <a name="nfr-acc-003"></a>[NFR-ACC-003](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-acc-003) | P1 | Ca kiểm truy cập Web/PWA cho luồng chính phải ghi pass/fail riêng theo từng tiêu chí WCAG đã chọn. | [Kế hoạch QA/WCAG](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md#4-accessibility-baseline) | Chưa kiểm theo ma trận |

### An toàn Electron

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="nfr-plat-001"></a>[NFR-PLAT-001](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-plat-001) | P0 | Electron từ chối yêu cầu bridge IPC cấp năng lực native từ frame không tin cậy. | [Chính sách Desktop](../05-clients/DESKTOP_ELECTRON.md#3-trusted-renderer-boundary) | Có đối chiếu source, chưa nghiệm thu |

### Bằng chứng vận hành

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="nfr-obs-001"></a>[NFR-OBS-001](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-obs-001) | P1 | Bằng chứng vận hành liên kết được sự cố thử với build và thành phần liên quan. | [Tiêu chí Operations](../08-operations/DEPLOYMENT_AND_OPERATIONS.md#runbook) | Chờ bằng chứng staging |
| <a name="nfr-obs-002"></a>[NFR-OBS-002](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-obs-002) | P1 | Bằng chứng vận hành đính kèm không tiết lộ khóa, token hoặc nội dung riêng tư. | [Chính sách lọc bằng chứng](../08-operations/DEPLOYMENT_AND_OPERATIONS.md#runbook) | Chờ bằng chứng đã lọc |

### Khả năng bảo trì

| ID | Ưu tiên | Yêu cầu kiểm được | Nguồn / thẩm quyền | Tình trạng tại baseline |
|---|---|---|---|---|
| <a name="nfr-maint-001"></a>[NFR-MAINT-001](../07-quality/TRACEABILITY_MATRIX.md#trace-nfr-maint-001) | P1 | Thay đổi frontend không làm tăng vi phạm ranh giới module ngoài baseline đã duyệt. | [Chính sách kiến trúc](../05-clients/FRONTEND_ARCHITECTURE.md#8-quality-controls) | Có đối chiếu source, chưa nghiệm thu |

## 8. Xác minh và quyết định mở

[Mỗi ID có thiết kế, nguồn đối chiếu, phương pháp xác minh và checkpoint](../07-quality/TRACEABILITY_MATRIX.md). Phương pháp (kiểm thử, kiểm tra mã, phân tích, trình diễn) được ghi theo từng hàng của ma trận. Tất cả ca và checkpoint ở trạng thái **NOT RUN** cho tài liệu này. [Danh mục API](../03-interfaces/API_CATALOG.md) và [V&V](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md) cung cấp chi tiết tương ứng.

### 8.1 Quyết định mở (TBD)

Owner ở cột 3 là đề xuất, chưa được xác nhận. Không công bố cam kết định lượng, tương thích hoặc phát hành khi chưa có số đo và quyết định của owner.

| ID | Quyết định còn mở | Owner đề xuất | Yêu cầu bị ảnh hưởng |
|---|---|---|---|
| TBD-01 | SLO và retention (độ trễ, khả dụng, RPO, RTO, thời hạn lưu) | Platform Engineering, Product | Mục 4, NFR-OBS-001/002 |
| TBD-02 | Nền tảng phát hành và phạm vi kiểm từng nền tảng | Product, Release owner | NFR-PLAT-001, NFR-ACC-003 |
| TBD-03 | Phạm vi E2EE production | Product, Security | [E2EE/MLS](../06-security/E2EE_MLS_STATUS.md). Chưa có REQ |
| TBD-04 | Điều khoản nhà cung cấp dịch thoại | Product, Security | REQ-CALL-003, REQ-CALL-004 |
| TBD-05 | Mô hình thanh toán | Product, Security | REQ-MKT-003, REQ-ECON-001 |

## Lịch sử thay đổi

- 1.1.0 (2026-11-19) — Bổ sung các mục SRS theo 29148: giới thiệu, mô tả tổng quát, giao diện ngoài, hiệu năng, tiêu chuẩn. Thêm định nghĩa cụm "đủ quyền", "hợp lệ", "từ chối". Đánh số mục và lập bảng quyết định mở TBD. Không đổi ID và nội dung yêu cầu.
- 1.0.0 (2026-11-19) — Bản nháp. Tách yêu cầu ghép, giữ mã cũ, bổ sung nguồn thẩm quyền, tiêu chí ưu tiên và checkpoint riêng.
