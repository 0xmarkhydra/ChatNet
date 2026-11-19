---
document_id: ADR-INDEX-001
title: Hồ sơ quyết định kiến trúc
version: 1.1.0
status: Draft
owner: System Architecture
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# Hồ sơ quyết định kiến trúc

| ADR | Quyết định | Loại ghi nhận | Mối quan tâm |
|---|---|---|---|
| [ADR-0001](0001-electron-desktop-shell.md) | Electron cho bản Desktop đầu tiên | Từ ADR gốc ở `docs/archive/desktop/adr` | C-10 |
| [ADR-0002](0002-sse-realtime-delivery.md) | SSE và Redis Pub/Sub cho realtime của chat | Hồi cứu | C-04 |
| [ADR-0003](0003-server-side-ai-provider-secrets.md) | Khóa nhà cung cấp AI chỉ nằm phía server | Theo chính sách | C-05 |
| [ADR-0004](0004-multi-process-backend-container.md) | Nhiều dịch vụ Go trong một container, qua Gateway | Hồi cứu | C-07, C-08 |
| [ADR-0005](0005-mls-e2ee-opt-in-pilot.md) | E2EE bằng MLS ở dạng pilot tự nguyện | Theo tài liệu hiện có | C-11 |
| [ADR-0006](0006-per-service-authorization.md) | Phân quyền do từng dịch vụ thực thi | Theo chính sách | C-01, C-02 |

Mã mối quan tâm C-01…C-11 định nghĩa ở [kiến trúc hệ thống](../02-architecture/SYSTEM_ARCHITECTURE.md#stakeholder-và-mối-quan-tâm).

## Cấu trúc một ADR

Bối cảnh, quyết định, phương án đã cân nhắc, hệ quả, bằng chứng, điều kiện xem xét lại. Trạng thái của quyết định tách riêng với trạng thái tài liệu và nghiệm thu.

ADR hồi cứu ghi nhận hiện trạng của source. Chúng không thay cho quyết định đã được phê duyệt. Mục "Phương án" của ADR hồi cứu để trống cho tới khi architect xác nhận lý do gốc. Một ADR chỉ chuyển sang Approved khi có người duyệt có tên và ngày.

## Lịch sử thay đổi

- 1.1.0 (2026-11-19) — Thêm ADR-0002 đến ADR-0006 và bảng mối quan tâm.
- 1.0.0 (2026-11-19) — Bản nháp đầu tiên theo baseline.
