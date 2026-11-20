---
document_id: ADR-0006
title: Phân quyền do từng dịch vụ backend thực thi, Gateway chỉ định tuyến
version: 1.0.0
status: Draft
owner: System Architecture
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# Phân quyền do từng dịch vụ backend thực thi, Gateway chỉ định tuyến

**Loại ghi nhận:** quyết định theo [nguyên tắc sản phẩm 1–3](../01-product/PRODUCT_OVERVIEW.md#4-product-principles) và [ràng buộc kiến trúc 1 và 3](../02-architecture/SYSTEM_ARCHITECTURE.md#6-architecture-constraints). Các phương án khác không được tài liệu hóa trong baseline.

## Bối cảnh

Một yêu cầu có thể tới dịch vụ đích qua Gateway hoặc trực tiếp trong mạng nội bộ. Trạng thái giao diện cũng không đáng tin. Chính sách chặn người dùng, thành viên cuộc gọi và quyền truy cập media áp dụng ở nhiều dịch vụ.

## Quyết định

- Xác thực và phân quyền được thực thi trong handler và middleware của từng dịch vụ. Gateway là ranh giới định tuyến, không thay thế phân quyền.
- Chính sách xuyên dịch vụ, như chặn người dùng và tư cách thành viên cuộc gọi, được kiểm tại mỗi dịch vụ liên quan.
- Server thực thi thiết lập riêng tư khi trả dữ liệu, kể cả khi gọi API trực tiếp.
- Client có thể ẩn tính năng để dễ dùng, nhưng không được coi là kiểm soát bảo mật.

## Phương án

Chưa có tài liệu về phương án đã cân nhắc, ví dụ phân quyền tập trung tại Gateway. Mục này phải được điền khi architect xác nhận ADR.

## Hệ quả

- Phải phân loại từng route theo mức kiểm: chỉ kiểm JWT hay có kiểm phiên phía server. Hai mức này khác nhau ([REQ-AUTH-003, REQ-AUTH-008](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-003)).
- Chính sách chặn chưa xác nhận liên dịch vụ ở baseline ([REQ-ID-008](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-id-008)).
- Cùng một quy tắc có thể được cài đặt ở nhiều nơi, nên thay đổi chính sách phải được đối chiếu ở mọi dịch vụ.

## Bằng chứng

- [Middleware xác thực](../../backend/internal/authx/jwt.go) và [middleware phiên](../../backend/internal/authx/session.go)
- [Gateway](../../backend/cmd/gateway/main.go)
- [Chính sách chặn xuyên dịch vụ](../06-security/IDENTITY_PRIVACY_AND_BLOCKING.md)
- [Mô hình mối đe dọa](../06-security/THREAT_MODEL.md)

## Điều kiện xem xét lại

Xem lại khi thêm dịch vụ mới, khi tách Chat service, hoặc khi đưa phân quyền về một thành phần dùng chung.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp theo baseline.
