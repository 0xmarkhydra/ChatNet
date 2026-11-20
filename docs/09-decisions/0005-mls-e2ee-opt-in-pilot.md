---
document_id: ADR-0005
title: E2EE bằng MLS ở dạng pilot tự nguyện, không bật mặc định
version: 1.0.0
status: Draft
owner: Cryptography and Security Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022; IETF RFC 9420"
---

# E2EE bằng MLS ở dạng pilot tự nguyện, không bật mặc định

**Loại ghi nhận:** ghi nhận quyết định hiện có ở [trạng thái E2EE/MLS](../06-security/E2EE_MLS_STATUS.md) và [kế hoạch E2EE](../archive/features/E2EE_IMPLEMENTATION_MASTER_PLAN.md). Lý do chọn MLS so với giao thức khác chưa được tài liệu hóa trong baseline.

## Bối cảnh

Sản phẩm muốn cung cấp mã hóa đầu cuối cho chat. Các thuộc tính cần có trước khi dùng cho production gồm vòng đời KeyPackage, chuyển epoch nhóm, thu hồi thiết bị, khôi phục tài khoản và mã hóa tệp đính kèm. Phần lớn chưa hoàn thành hoặc chưa được nghiệm thu ([mục 4–5 trạng thái E2EE](../06-security/E2EE_MLS_STATUS.md#4-known-gaps)).

## Quyết định ghi nhận

- Dùng MLS theo IETF RFC 9420, thư viện phía client là `ts-mls`.
- Phạm vi hiện tại là pilot tự nguyện, bật bằng feature gate và có consent rõ ràng của người dùng. Kế hoạch pilot nêu chat trực tiếp, một thiết bị trình duyệt cho mỗi tài khoản.
- Server chuyển tiếp bản ghi giao thức và giữ metadata tài khoản/thiết bị.
- Mã hóa cuộc gọi là bề mặt giao thức riêng, không thuộc pilot chat.
- Không được mô tả pilot là E2EE toàn hệ thống.

## Phương án

Chưa có tài liệu về phương án đã cân nhắc. Mục này phải được điền khi architect xác nhận ADR.

## Hệ quả

- Trạng thái mã hóa phải hiển thị rõ cho người dùng theo từng hội thoại. Không suy ra E2EE từ việc có mã MLS hay route thiết bị.
- Phạm vi E2EE production là quyết định mở ([TBD-03](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#81-quyết-định-mở-tbd)).
- Cần đánh giá mật mã độc lập trước khi nâng phạm vi, theo [kế hoạch V&V](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md#6-độc-lập).
- Dịch âm thanh gửi âm thanh tới nhà cung cấp sau consent, nên nằm ngoài ranh giới E2EE ([quyền riêng tư dịch](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md)).

## Bằng chứng

- [Trạng thái E2EE/MLS](../06-security/E2EE_MLS_STATUS.md)
- [Kế hoạch triển khai E2EE (lịch sử)](../archive/features/E2EE_IMPLEMENTATION_MASTER_PLAN.md)
- Route thiết bị và KeyPackage ở [Auth](../../backend/cmd/auth/main.go)

## Điều kiện xem xét lại

Xem lại khi mở rộng sang nhóm, nhiều thiết bị, tệp đính kèm hoặc cuộc gọi, hoặc khi có kết quả đánh giá mật mã độc lập.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp theo baseline.
