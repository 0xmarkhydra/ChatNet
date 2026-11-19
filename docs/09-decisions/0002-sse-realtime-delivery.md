---
document_id: ADR-0002
title: SSE và Redis Pub/Sub cho cập nhật realtime của chat
version: 1.0.1
status: Draft
owner: System Architecture
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# SSE và Redis Pub/Sub cho cập nhật realtime của chat

**Loại ghi nhận:** hồi cứu. Quyết định suy ra từ source tại baseline. Lý do gốc và các phương án đã cân nhắc chưa được tài liệu hóa. Architect cần xác nhận trước khi chuyển trạng thái sang Approved.

## Bối cảnh

Client cần nhận cập nhật tin nhắn, đọc, hội thoại, quan hệ bạn bè, riêng tư và tín hiệu cuộc gọi mà không phải thăm dò liên tục. Chat service chạy trong cùng container backend với các service khác và dùng Redis cho điều phối tạm thời ([kiến trúc hệ thống](../02-architecture/SYSTEM_ARCHITECTURE.md#5-data-and-infrastructure-dependencies)).

## Quyết định ghi nhận

- Chat service phát một luồng Server-Sent Events tại `GET /api/events`. Sự kiện `update` mang JSON với trường `type`. Sự kiện `session-revoked` báo phiên không còn hiệu lực.
- Redis Pub/Sub là kênh nội bộ của backend để chuyển dữ liệu theo từng người dùng. Pub/Sub không phải nguồn dữ liệu đọc lại.
- Client Web dùng `EventSource` gốc. Vì `EventSource` không đặt được header Authorization, token bearer đi qua query string.
- Cuộc gọi dịch trực tiếp dùng kênh WebSocket riêng với ticket một lần, không đi qua SSE.

## Phương án

Chưa có tài liệu về phương án đã cân nhắc. Đã tra lịch sử Git và các handoff trong repo ngày 2026-11-19:

- Handler `text/event-stream` của backend xuất hiện lần đầu ở commit `bb015c4` (2026-10-01, "feat: add ChatNet media uploads and polish mobile UI"). Thông điệp commit không nêu lý do chọn SSE.
- [Handoff Agent 4](../agent-handoffs/agent-4/2026-10-19-phase3.md) ghi hành vi hiện tại: client đồng bộ lại khi SSE nối lại, khi trình duyệt online lại, khi tab hiện lại và mỗi 90 giây. Đây là hệ quả, không phải lý do chọn.

Lý do gốc và các phương án như WebSocket hay long polling vẫn do architect xác nhận. Không điền thay.

## Hệ quả đã quan sát

- Không có bảo đảm replay hay giao đúng một lần. Client phải đồng bộ lại hội thoại và số chưa đọc từ server sau gián đoạn. Yêu cầu tương ứng là [REQ-CHAT-014](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-014).
- Token trong query string có thể lọt vào log truy cập hoặc log debug. Cần giữ URL luồng ngoài log.
- Lược đồ payload chưa đầy đủ và chưa có phiên bản. Xem phần khoảng hở ở [danh mục sự kiện](../03-interfaces/REALTIME_EVENT_CATALOG.md#6-contract-gaps).
- Việc lọc người nhận do từng handler phát hành thực hiện. Không suy ra kiểm tra thành viên đồng nhất cho mọi loại sự kiện ([REQ-CHAT-006](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-chat-006)).

## Bằng chứng

- [Handler `events` của Chat](../../backend/cmd/chat/main.go)
- [Middleware xác thực chấp nhận bearer qua query cho `EventSource`](../../backend/internal/authx/jwt.go)
- [Hook realtime phía Web](../../frontend/src/app/hooks/useAppRealtime.ts)
- [Danh mục sự kiện realtime](../03-interfaces/REALTIME_EVENT_CATALOG.md) và [AsyncAPI giới hạn](../03-interfaces/realtime.asyncapi.json)

## Điều kiện xem xét lại

Xem lại khi cần replay hoặc thứ tự bảo đảm, khi chuyển token ra khỏi query string, hoặc khi cần hợp đồng sự kiện có phiên bản.

## Lịch sử thay đổi

- 1.0.1 (2026-11-19) — Bổ sung nguồn gốc commit ở mục Phương án.
- 1.0.0 (2026-11-19) — Bản nháp hồi cứu theo baseline.
