---
document_id: ADR-0004
title: Backend nhiều dịch vụ Go trong một container, truy cập qua Gateway
version: 1.0.2
status: Draft
owner: Platform Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# Backend nhiều dịch vụ Go trong một container, truy cập qua Gateway

**Loại ghi nhận:** hồi cứu. Quyết định suy ra từ source tại baseline. Lý do gốc chưa được tài liệu hóa. Architect cần xác nhận trước khi chuyển trạng thái sang Approved.

## Bối cảnh

Backend chia thành sáu entrypoint Go: Gateway, Auth, Chat, Feed, Translation và Call, cùng các package dùng chung. Mã nguồn nằm trong một monorepo. Phạm vi trách nhiệm từng dịch vụ ở [kiến trúc hệ thống](../02-architecture/SYSTEM_ARCHITECTURE.md#3-backend-service-boundaries).

## Quyết định ghi nhận

- Mỗi dịch vụ là một binary riêng. [Dockerfile.backend](../../Dockerfile.backend) biên dịch cả sáu.
- [backend-run.sh](../../backend-run.sh) chạy Auth, Chat, Feed, Translation, Call lần lượt ở cổng 8081–8085, rồi Gateway ở cổng 8080, trong một container. Gateway proxy tới các dịch vụ qua `127.0.0.1`.
- Marketplace là miền con của Feed service, không phải dịch vụ riêng.
- Chat service sở hữu nhiều miền: hội thoại, nhóm, danh tính và quan hệ, riêng tư, media, SSE.
- Gateway chỉ định tuyến. Mỗi dịch vụ tự thực thi phân quyền (xem [ADR-0006](0006-per-service-authorization.md)).

## Phương án

Chưa có tài liệu về phương án đã cân nhắc. Đã tra lịch sử Git ngày 2026-11-19:

- `backend-run.sh` và `Dockerfile.backend` được thêm cùng commit `bb015c4` (2026-10-01, "feat: add ChatNet media uploads and polish mobile UI"). Thông điệp commit không nêu lý do gộp dịch vụ vào một container.
- Các commit sau đó về Railway (ví dụ `b44922a`, `1a42d31`) chỉ nói về quality gate khi build, không nói về topology.

Lý do gốc và các phương án như mỗi dịch vụ một container vẫn do architect xác nhận. Không điền thay.

## Hệ quả đã quan sát

- Ranh giới logic và ranh giới triển khai khác nhau. Việc có sáu binary không chứng minh từng dịch vụ được triển khai hay mở rộng độc lập.
- Runner thoát với mã khác 0 khi một tiến trình con dừng. Tự khởi động lại phụ thuộc nền tảng triển khai.
- Bảng định tuyến của Gateway duy trì thủ công. Một lần kiểm bằng script ngày 2026-11-19 không thấy lệch ([bản ghi kiểm](../03-interfaces/CONTRACT_GOVERNANCE.md#51-bản-ghi-kiểm-openapi-020)). Chưa có kiểm tra tự động trong CI.
- Chat service lớn. Tách dịch vụ hoặc phân miền lại cần ADR mới và kế hoạch tương thích.

## Bằng chứng

- [Gateway](../../backend/cmd/gateway/main.go) (URL upstream mặc định cổng 8081–8085)
- [backend-run.sh](../../backend-run.sh), [Dockerfile.backend](../../Dockerfile.backend)
- [Kiến trúc triển khai](../02-architecture/DEPLOYMENT_ARCHITECTURE.md#3-backend-container-process-topology)

## Điều kiện xem xét lại

Xem lại khi cần mở rộng hoặc khởi động lại từng dịch vụ riêng, khi đặt SLO ([TBD-01](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#81-quyết-định-mở-tbd)), hoặc khi tách Chat service.

## Lịch sử thay đổi

- 1.0.2 (2026-11-19) — Cập nhật kết quả kiểm route Gateway.
- 1.0.1 (2026-11-19) — Bổ sung nguồn gốc commit ở mục Phương án.
- 1.0.0 (2026-11-19) — Bản nháp hồi cứu theo baseline.
