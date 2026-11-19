# Tài liệu ChatNet

Bộ tài liệu mô tả [mốc mã nguồn `40c1f1b`](00-governance/BASELINE_AND_CHANGE_CONTROL.md). Xem [chênh lệch với `3664430`](00-governance/BASELINE_AND_CHANGE_CONTROL.md#21-chênh-lệch-với-checkout-phát-triển) trước khi áp dụng cho checkout mới hơn. Trạng thái của từng tài liệu nằm ở đầu tệp và trong [sổ duyệt](00-governance/APPROVAL_REGISTER.md).

**Bắt đầu nhanh** — [Chạy local](08-operations/LOCAL_DEVELOPMENT.md) · [Kiến trúc](02-architecture/SYSTEM_ARCHITECTURE.md) · [API](03-interfaces/API_CATALOG.md) · [Trạng thái tính năng](01-product/FEATURE_STATUS_REGISTER.md)

## Danh mục tài liệu

| Nhóm | Mở tài liệu khi cần |
|---|---|
| 00 · Quản trị tài liệu | [Quy tắc tài liệu](00-governance/DOCUMENT_CONTROL.md), [sổ duyệt và danh sách tài liệu](00-governance/APPROVAL_REGISTER.md), [tiêu chuẩn tham chiếu](00-governance/STANDARDS_REGISTER.md), [thuật ngữ](00-governance/TERMS_GLOSSARY.md) |
| 01 · Sản phẩm | [Tổng quan](01-product/PRODUCT_OVERVIEW.md), [đặc tả yêu cầu (SRS)](01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md), [luồng sử dụng](01-product/USE_CASES.md) |
| 02 · Kiến trúc | [Bối cảnh hệ thống](02-architecture/SYSTEM_CONTEXT.md), [kiến trúc dữ liệu](02-architecture/DATA_ARCHITECTURE.md), [mô hình triển khai](02-architecture/DEPLOYMENT_ARCHITECTURE.md) |
| 03 · Giao diện dịch vụ | [Quản trị hợp đồng](03-interfaces/CONTRACT_GOVERNANCE.md), [OpenAPI](03-interfaces/openapi.json), [danh mục realtime](03-interfaces/REALTIME_EVENT_CATALOG.md), [AsyncAPI](03-interfaces/realtime.asyncapi.json) |
| 04 · Backend | [Tổng quan dịch vụ](04-backend/BACKEND_OVERVIEW.md), [lược đồ CSDL](04-backend/DATABASE_SCHEMA.md), [migration](04-backend/DATABASE_MIGRATIONS.md) |
| 05 · Ứng dụng khách | [Kiến trúc frontend](05-clients/FRONTEND_ARCHITECTURE.md), [Web/PWA](05-clients/WEB_PWA.md), [Electron](05-clients/DESKTOP_ELECTRON.md), [Flutter](05-clients/MOBILE_FLUTTER.md), [thiết kế và trợ năng](05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md) |
| 06 · Bảo mật | [Tổng quan bảo mật](06-security/SECURITY_OVERVIEW.md), [mô hình mối đe dọa](06-security/THREAT_MODEL.md), [E2EE/MLS](06-security/E2EE_MLS_STATUS.md), [quyền truy cập media](06-security/MEDIA_ACCESS_CONTROL.md) |
| 07 · Kiểm thử và nghiệm thu | [Kế hoạch QA](07-quality/QUALITY_ASSURANCE_PLAN.md), [chiến lược kiểm thử](07-quality/TEST_STRATEGY.md), [danh mục lệnh kiểm](07-quality/TEST_CATALOG.md), [hồ sơ kiểm thử](07-quality/TEST_DOCUMENTATION.md), [cổng CI](07-quality/CI_QUALITY_GATES.md) |
| 08 · Vận hành | [Mục lục vận hành](08-operations/README.md) — local, môi trường, runbook, phát hành, rollback và bảo trì |
| 09 · Quyết định kiến trúc | [Danh mục ADR](09-decisions/README.md) |

## Review lần cuối

Đọc [bản ghi bàn giao](07-quality/VERIFICATION_AND_VALIDATION_PLAN.md#bàn-giao-review-tài-liệu), rồi đi theo [SRS](01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md) → [ma trận truy vết](07-quality/TRACEABILITY_MATRIX.md) → [ca nghiệm thu](07-quality/ACCEPTANCE_CASES.md).

## Cách đọc trạng thái

- Đánh giá nội dung tài liệu và nghiệm thu sản phẩm là hai việc riêng. Chỉ ghi **PASS** khi có kết quả chạy gắn với phiên bản, môi trường và bằng chứng. Xem [quy ước trạng thái](00-governance/DOCUMENT_CONTROL.md#4-status-vocabulary).
- OpenAPI mô tả ba thao tác đã đối chiếu chi tiết và chỉ liệt kê 177 thao tác khác. AsyncAPI mô tả hai loại sự kiện SSE. Không suy ra mức bao phủ hợp đồng từ số route.
- Đối chiếu phần đã triển khai với source và test tại mốc nêu trong từng tài liệu. Hồ sơ đề xuất, hướng dẫn kỹ thuật và kết quả phát hành có phạm vi riêng.

## Hướng dẫn kỹ thuật và hồ sơ cũ

- [Hướng dẫn kỹ thuật đang áp dụng](00-governance/LEGACY_DOCUMENT_REGISTER.md#3-platform-and-engineering-documents) — quy tắc frontend, UI và phối hợp chỉnh sửa.
- [Mục lục hồ sơ lưu trữ](archive/README.md) · [Đối chiếu tài liệu cũ và bản thay thế](00-governance/LEGACY_DOCUMENT_REGISTER.md).
- [Đề xuất sản phẩm và kiến trúc](proposals/README.md) — phân biệt đề xuất với hiện trạng và kết quả nghiệm thu.
