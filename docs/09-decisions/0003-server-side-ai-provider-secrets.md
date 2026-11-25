---
document_id: ADR-0003
title: Khóa nhà cung cấp AI chỉ nằm phía server
version: 1.0.0
status: Draft
owner: System Architecture
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# Khóa nhà cung cấp AI chỉ nằm phía server

**Loại ghi nhận:** quyết định theo chính sách dự án đã nêu ở [ràng buộc kiến trúc 5](../02-architecture/SYSTEM_ARCHITECTURE.md#6-architecture-constraints) và [REQ-AI-001/002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-ai-001). Các phương án khác không được tài liệu hóa trong baseline.

## Bối cảnh

ChatNet dịch văn bản, dịch gói giao diện và dịch âm thanh cuộc gọi bằng nhà cung cấp AI bên ngoài. Bundle Web, PWA, Desktop và Mobile được phân phối tới thiết bị người dùng. Bất kỳ bí mật nào trong bundle đều có thể bị trích xuất.

## Quyết định

- Translation service đọc provider, API key, base URL, model và kiểu xác thực từ cấu hình server. Client chỉ gọi API của ChatNet.
- Call service giữ khóa của nhà cung cấp dịch trực tiếp ở server. Âm thanh chỉ được chuyển tới nhà cung cấp sau khi có consent của người nói.
- Bundle client và phản hồi gửi cho client không được chứa khóa nhà cung cấp.

## Phương án

Chưa có tài liệu về phương án đã cân nhắc, ví dụ gọi trực tiếp nhà cung cấp từ client bằng khóa tạm. Mục này phải được điền khi architect xác nhận ADR.

## Hệ quả

- Mọi lưu lượng dịch đi qua backend, nên backend chịu giới hạn tốc độ, độ trễ và lỗi của nhà cung cấp. Khi nhà cung cấp chưa cấu hình, ứng dụng phải báo không khả dụng, không giả vờ dịch thành công.
- Retention, vùng xử lý và điều khoản của nhà cung cấp phụ thuộc cấu hình và hợp đồng, không suy ra được từ source. Xem [TBD-04](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#81-quyết-định-mở-tbd).
- Cần quét artifact build để chứng minh bundle không chứa khóa. Baseline có cấu hình phía server nhưng chưa quét artifact ([TC-AI-001](../07-quality/ACCEPTANCE_CASES.md#tc-ai-001)).

## Bằng chứng

- [Translation service](../../backend/cmd/translate/main.go)
- [Quyền riêng tư dịch AI và cuộc gọi](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md)

## Điều kiện xem xét lại

Xem lại nếu có yêu cầu xử lý trên thiết bị, đổi nhà cung cấp, hoặc thay đổi mô hình cấp khóa.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp theo baseline.
