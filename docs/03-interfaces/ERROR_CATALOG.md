---
document_id: API-ERR-001
title: Danh mục lỗi HTTP ChatNet
version: 1.1.0
status: Draft
owner: API Architecture
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: RFC 9110
---

# Danh mục lỗi HTTP ChatNet

Các dạng phản hồi dưới đây được đối chiếu tới nguồn, không phải chuẩn lỗi mới áp cho mọi endpoint.

| Nguồn | Dạng lỗi quan sát trong code | Hệ quả cho client |
|---|---|---|
| [httpx.Error](../../backend/internal/httpx/httpx.go) | JSON có trường chuỗi `error` | Không coi nội dung chuỗi là mã lỗi ổn định |
| [Auth middleware](../../backend/internal/authx/jwt.go) và [session middleware](../../backend/internal/authx/session.go) | `401` dạng text, middleware phiên có thể trả `503` dạng text | Xử lý lỗi xác thực và lỗi phụ thuộc riêng, không mặc định parse JSON |
| [Gateway health](../../backend/cmd/gateway/main.go) | `503` có JSON `status`, `service`, `components` | Dùng riêng cho health, không áp schema `error` |
| [Marketplace](../../backend/cmd/feed/marketplace.go) | `400` input, `409` giỏ hàng/đơn vị giá hoặc xung đột, `500` nội bộ | Khi không rõ kết quả do lỗi mạng, giữ khóa idempotency của cùng thao tác |
| [SSE](REALTIME_EVENT_CATALOG.md) | `session-revoked` là sự kiện sau khi stream mở. Đóng stream không tự nó chứng minh thu hồi phiên | Kiểm tra trạng thái phiên và phục hồi bằng nguồn server khi cần |

## Mã trạng thái quan sát theo dịch vụ

Quét tĩnh các lời gọi `httpx.Error`, `httpx.JSON` và `http.Error` ở `backend/cmd/<dịch vụ>`, bỏ qua tệp test. Chỉ cho biết mã nào xuất hiện trong source. Không cho biết mã nào xảy ra khi chạy. Lời gọi qua hàm bao ngoài có thể bị bỏ sót. Gateway không có lời gọi nào, vì Gateway chỉ định tuyến và để mã lỗi của dịch vụ đích đi qua.

| Dịch vụ | Mã lỗi xuất hiện trong source |
|---|---|
| Auth | 400, 401, 403, 404, 409, 410, 429, 500, 502, 503 |
| Chat | 400, 401, 403, 404, 409, 410, 413, 429, 500, 502, 503 |
| Feed | 400, 401, 403, 404, 409, 429, 500, 503 |
| Call | 400, 401, 403, 404, 409, 429, 500, 503 |
| Translation | 400, 404, 502, 503 |

## Ý nghĩa quan sát của từng mã

Ý nghĩa dưới đây suy từ ví dụ trong source. Không phải hợp đồng. Mỗi dịch vụ có thể dùng mã theo cách khác.

| Mã | Cách dùng quan sát được | Ví dụ nguồn |
|---|---|---|
| 400 | Đầu vào không hợp lệ | Hầu hết handler |
| 401 | Thiếu hoặc sai bearer, phiên không hợp lệ. Middleware trả text, handler trả JSON `error` | [jwt.go](../../backend/internal/authx/jwt.go), [session.go](../../backend/internal/authx/session.go) |
| 403 | Có danh tính nhưng không có quyền. Cũng dùng cho origin hoặc URL ảnh không được phép | Chat, Call |
| 404 | Không có tài nguyên, hoặc che sự tồn tại khi không có quyền (cần kiểm từng route) | Chat, Feed |
| 409 | Xung đột trạng thái hoặc khóa idempotency khác nội dung | Auth, Chat, Feed (Marketplace) |
| 410 | Yêu cầu xác minh đã hết hạn, hoặc quá nhiều mã sai | [Auth](../../backend/cmd/auth/main.go) |
| 413, 415 | 413: thân yêu cầu quá lớn ở Chat, hoặc ảnh vượt 20 MB. 415: sai kiểu nội dung ảnh. Hai trường hợp ảnh do proxy ảnh dùng chung, trả `text/plain` | [Chat](../../backend/cmd/chat/main.go), [clipboard_proxy.go](../../backend/internal/mediax/clipboard_proxy.go) |
| 429 | Vượt giới hạn tốc độ. Xem bảng dưới | Auth, Chat, Call |
| 500 | Lỗi nội bộ, thường khi truy vấn DB lỗi | Mọi dịch vụ |
| 502 | Lỗi từ nhà cung cấp ngoài: email xác minh không gửi được, dịch AI thất bại | Auth, Translation |
| 503 | Phụ thuộc hoặc cấu hình thiếu: OTP chưa cấu hình, push chưa cấu hình, không kiểm được phiên hoặc chính sách liên hệ | Auth, Chat, Call |

## Giới hạn tốc độ (429)

| Nơi phát sinh | Thông điệp trong source | `Retry-After` |
|---|---|---|
| [Auth](../../backend/cmd/auth/main.go) | `too many attempts; try again later` | Không thấy |
| [Call](../../backend/cmd/call/main.go) | `too many call requests` | Có, theo cửa sổ giới hạn |
| [Chat MLS relay](../../backend/cmd/chat/e2ee_mls.go) | `MLS relay rate limit exceeded` | `60` |
| [Chat bạn bè](../../backend/cmd/chat/friends.go) | `daily friend request limit reached` | Không thấy |
| [Chat báo cáo](../../backend/cmd/chat/moderation.go) | `daily report limit reached` | Không thấy |
| [Chat link preview](../../backend/cmd/chat/link_preview.go) | Thông điệp tiếng Việt trong JSON `error` | Không thấy |

Client không được giả định mọi 429 có `Retry-After`.

## Hạn chế của hợp đồng lỗi hiện tại

- Phản hồi JSON chỉ có chuỗi `error`, không có mã lỗi ổn định. Thông điệp trộn tiếng Anh và tiếng Việt và có thể đổi. Client không được rẽ nhánh theo nội dung chuỗi.
- Middleware xác thực trả `text/plain`, các handler trả JSON. Client phải xử lý cả hai dạng.
- Chưa có tài liệu về mã trạng thái nào là hợp đồng cho từng route. Việc đó cần mô hình hóa route trong [OpenAPI](openapi.json), hiện chỉ có ba thao tác được đối chiếu tới handler, 177 thao tác khác mới ở mức kiểm kê.
- Chưa có quy tắc nào cho phép 404 che sự tồn tại và 403 lộ sự tồn tại. Cần quyết định khi chuẩn hóa ([NFR-SEC-001](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-sec-001)).

**Đề xuất, chưa là yêu cầu:** thêm trường `code` ổn định và dạng lỗi chung cho mọi dịch vụ. Cần quyết định của Backend owner và kế hoạch tương thích. Không đổi hành vi hiện tại trong đợt tài liệu.

Tham chiếu [OpenAPI](openapi.json) cho media type và response ở các thao tác đã mô hình hóa.

## Lịch sử thay đổi

- 1.1.0 (2026-11-19) — Thêm bảng mã lỗi theo dịch vụ, ý nghĩa quan sát, giới hạn tốc độ và hạn chế của hợp đồng lỗi.
- 1.0.0 (2026-11-19) — Đối chiếu dạng lỗi middleware, Gateway, SSE và Marketplace.
