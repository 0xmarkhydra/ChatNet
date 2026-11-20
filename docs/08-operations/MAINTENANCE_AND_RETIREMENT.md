---
document_id: OPS-MAINT-001
title: Bảo trì, khôi phục và ngừng sử dụng ChatNet
version: 1.0.0
status: Draft
owner: Platform Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-21
normative_basis: "ISO/IEC/IEEE 12207:2026, ISO/IEC/IEEE 15289:2019"
---

# Bảo trì, khôi phục và ngừng sử dụng ChatNet

## Tóm tắt

Tài liệu nêu quy trình bảo trì, xử lý sự cố, khôi phục dữ liệu và ngừng sử dụng, tương ứng các tiến trình vận hành, bảo trì và ngừng sử dụng của vòng đời phần mềm. Baseline **chưa có** số đo RPO, RTO, SLO hay bằng chứng khôi phục. Các mục dưới đây là quy trình đề xuất và danh sách bằng chứng phải có. Chưa phải hồ sơ đã chạy.

## 1. Phạm vi và quan hệ

Bổ sung cho [triển khai và vận hành](DEPLOYMENT_AND_OPERATIONS.md), [cấu hình môi trường](ENVIRONMENT_CONFIGURATION.md) và [phát hành](RELEASE_MANAGEMENT.md). Mục tiêu định lượng nằm ở quyết định mở [TBD-01](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#81-quyết-định-mở-tbd).

## Cổng mục tiêu vận hành và khôi phục

Release owner duy trì một bản ghi cho từng môi trường. Chưa chốt con số không được xem là đạt.

| Gate | Evidence bắt buộc để ghi `PASS` | Trạng thái tài liệu này |
|---|---|---|
| SLO | Chỉ tiêu availability/latency/error-rate được owner phê duyệt, cửa sổ đo, nguồn số liệu và kết quả | NOT SET |
| RPO | Giá trị tối đa mất dữ liệu được phê duyệt và đo trong restore/failure drill | NOT SET |
| RTO | Thời gian khôi phục được phê duyệt, đo từ incident đến service usable | NOT SET |
| Backup restore | ID bản backup, thời điểm, môi trường cách ly, thời gian restore, integrity/schema check và người xác nhận | NOT RUN |
| Rollback | Artifact trước, schema compatibility check, lệnh rollback/forward-fix, smoke sau rollback và kết quả | NOT RUN |

Gate `SLO`, `RPO` hoặc `RTO` ở `NOT SET` chặn production release. `PASS` chỉ dùng khi record có SHA/build, môi trường, thời điểm và evidence link.

## 2. Vận hành và quan sát

Tín hiệu có sẵn trong source tại baseline:

| Tín hiệu | Nguồn | Giới hạn |
|---|---|---|
| Health của Gateway và thành phần | [Gateway](../../backend/cmd/gateway/main.go), `/api/health` | Health không xác nhận OTP, push, LiveKit hay dịch AI |
| Log tiến trình backend và Nginx | `docker compose logs`, log nền tảng triển khai | Phải lọc URL ký và token ([triển khai](../02-architecture/DEPLOYMENT_ARCHITECTURE.md#8-operational-security-notes)) |
| Tín hiệu client | Báo lỗi của người dùng, kiểm smoke | Chưa có thu thập tự động trong baseline |

Chưa xác nhận: hệ thống giám sát tập trung, cảnh báo, on-call, SLO. Khi có, cập nhật bảng này kèm bằng chứng cấu hình.

## 3. Xử lý sự cố

Mức nghiêm trọng của **sự cố vận hành** tách khỏi mức của dị thường kiểm thử ([V&V mục 8](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md#8-báo-cáo-dị-thường)). Một sự cố vận hành có thể sinh dị thường kiểm thử.

| Mức | Tiêu chí | Hành động tối thiểu |
|---|---|---|
| Sev-1 | Lộ dữ liệu riêng tư hoặc bí mật. Mất hoặc hỏng dữ liệu. Không đăng nhập hoặc không dùng được tính năng chính | Dừng mở rộng rollout. Khoanh vùng. Xoay vòng bí mật nếu nghi lộ. Thông báo owner ngay |
| Sev-2 | Một tính năng suy giảm, có cách khắc phục | Khoanh vùng theo [runbook](DEPLOYMENT_AND_OPERATIONS.md#runbook). Quyết định sửa hoặc rollback |
| Sev-3 | Sai nhỏ, không ảnh hưởng luồng chính | Đưa vào danh sách tồn đọng |

Mọi sự cố ghi: thời điểm phát hiện, SHA và build, thành phần ảnh hưởng, hành động, thời điểm khôi phục, nguyên nhân gốc, hành động phòng ngừa. Không đưa bí mật, token hay nội dung riêng tư vào hồ sơ ([NFR-OBS-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-obs-002)). Người trực, kênh thông báo và thời hạn phản hồi chưa được quy định (OPS-OPEN-02).

## 4. Sao lưu và khôi phục

| Dữ liệu | Nơi lưu | Yêu cầu phải xác định |
|---|---|---|
| Quan hệ (tài khoản, tin nhắn, feed, cuộc gọi, marketplace) | PostgreSQL | Tần suất sao lưu, thời hạn giữ, RPO, RTO, người thực hiện |
| Trạng thái tạm | Redis | Chính sách bền vững. Dữ liệu tạm không phải nguồn phân quyền bền |
| Media | Kho đối tượng S3 | Phiên bản hóa, sao chép, khôi phục đối tượng |
| Cấu hình và bí mật | Nền tảng triển khai | Nơi giữ bản sao có kiểm soát, xoay vòng |

Một bản sao lưu chỉ được coi là dùng được sau khi có bản ghi khôi phục thử: môi trường cách ly, thời điểm sao lưu, thời gian khôi phục đo được, kiểm toàn vẹn (đếm bản ghi chính và kiểm schema theo [migration](../04-backend/DATABASE_MIGRATIONS.md)), người xác nhận. Baseline không có bản ghi nào như vậy. Trạng thái: **NOT RUN**.

Khôi phục sau migration lỗi: kiểm tương thích schema trước khi quay lại artifact cũ ([phát hành](RELEASE_MANAGEMENT.md#luồng-quyết-định)).

## 5. Bảo trì

| Loại thay đổi | Việc cần làm | Tài liệu |
|---|---|---|
| Sửa lỗi hoặc tính năng | Phân tích tác động, chạy lại ca mức 3–4 bị ảnh hưởng, cập nhật tài liệu liên quan | [Kiểm soát thay đổi](../00-governance/BASELINE_AND_CHANGE_CONTROL.md), [V&V mục 7](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md#7-nhiệm-vụ-vv-theo-giai-đoạn-vòng-đời) |
| Thay đổi schema | Migration theo trình tự đã khai báo, kiểm trên bản sao tương đương staging | [Migration](../04-backend/DATABASE_MIGRATIONS.md) |
| Nâng cấp thư viện, runtime | Chạy CI, kiểm hồi quy, xem ghi chú bảo mật | [CI gates](../07-quality/CI_QUALITY_GATES.md) |
| Vá lỗi bảo mật | Ưu tiên theo mức, ghi thời điểm phát hiện và vá | [Bảo mật](../06-security/SECURITY_OVERVIEW.md) |
| Đổi cấu hình hoặc bí mật | Ghi owner, môi trường, nơi tiêm, cách xác minh. Xoay vòng khi nghi lộ | [Cấu hình](ENVIRONMENT_CONFIGURATION.md) |
| Đổi tiêu chuẩn tham chiếu | Cập nhật hồ sơ áp dụng tiêu chuẩn | [Hồ sơ tiêu chuẩn](../00-governance/STANDARDS_REGISTER.md) |

Chưa quy định: chu kỳ nâng cấp phụ thuộc và thời hạn vá theo mức nghiêm trọng (OPS-OPEN-03).

## 6. Ngừng sử dụng

Áp dụng khi ngừng một tính năng, dịch vụ, môi trường hoặc toàn bộ hệ thống. Danh sách kiểm đề xuất:

1. Quyết định của owner được ghi lại bằng ADR hoặc bản ghi quyết định, kèm phạm vi và ngày.
2. Thông báo cho người dùng và stakeholder bị ảnh hưởng. Quy định thời hạn tối thiểu thuộc Product.
3. Xác định dữ liệu phải giữ, xuất hoặc xóa. Thời hạn giữ phụ thuộc TBD-01 và yêu cầu pháp lý chưa có trong baseline.
4. Gỡ route khỏi Gateway và dịch vụ, và cập nhật [danh mục API](../03-interfaces/API_CATALOG.md) cùng tài liệu liên quan.
5. Thu hồi hoặc xoay vòng bí mật, khóa nhà cung cấp, chứng chỉ ký và quyền truy cập dịch vụ ngoài (LiveKit, OneSignal, email, AI, kho đối tượng).
6. Xóa hoặc lưu trữ dữ liệu theo quyết định ở bước 3. Ghi bằng chứng. Xóa vĩnh viễn cần xác nhận riêng.
7. Gỡ môi trường, DNS và tài nguyên nền tảng. Ghi thời điểm.
8. Chuyển tài liệu liên quan sang trạng thái Superseded hoặc Archived theo [kiểm soát tài liệu](../00-governance/DOCUMENT_CONTROL.md) và cập nhật [sổ tài liệu cũ](../00-governance/LEGACY_DOCUMENT_REGISTER.md).

Baseline không có bản ghi ngừng sử dụng nào.

## 7. Nội dung chưa có và quyết định mở

| ID | Nội dung | Owner đề xuất |
|---|---|---|
| OPS-OPEN-01 | RPO, RTO, tần suất và thời hạn giữ sao lưu (gắn TBD-01) | Platform Engineering, Product |
| OPS-OPEN-02 | On-call, kênh thông báo, thời hạn phản hồi theo mức sự cố | Platform Engineering |
| OPS-OPEN-03 | Chu kỳ nâng cấp phụ thuộc và thời hạn vá | Engineering, Security |
| OPS-OPEN-04 | Hệ thống giám sát và cảnh báo | Platform Engineering |
| OPS-OPEN-05 | Chính sách giữ, xuất và xóa dữ liệu người dùng khi ngừng sử dụng | Product, Security |

Owner ở cột 3 là đề xuất, chưa được xác nhận.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp đầu tiên: vận hành, sự cố, sao lưu và khôi phục, bảo trì, ngừng sử dụng.
