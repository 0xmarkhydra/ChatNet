---
document_id: QA-TDOC-001
title: Hồ sơ và mẫu tài liệu kiểm thử ChatNet
version: 1.0.0
status: Draft
owner: Quality Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 29119-3:2021"
---

# Hồ sơ và mẫu tài liệu kiểm thử ChatNet

## Tóm tắt

Tài liệu ánh xạ các hạng mục tài liệu kiểm thử của ISO/IEC/IEEE 29119-3 vào hồ sơ ChatNet và cung cấp mẫu cho các hạng mục còn thiếu. Mẫu không phải kết quả chạy. Mọi ca hiện có vẫn **NOT RUN**. Việc dùng cấu trúc này không phải là tuyên bố conformance.

## 1. Mục đích và phạm vi

[Kế hoạch QA](QUALITY_ASSURANCE_PLAN.md), [chiến lược kiểm thử](TEST_STRATEGY.md), [danh mục lệnh kiểm](TEST_CATALOG.md) và [ca nghiệm thu](ACCEPTANCE_CASES.md) đã có. Tài liệu này bổ sung các hạng mục mà chúng chưa nêu thành mẫu: đặc tả ca đầy đủ, quy trình, hồ sơ lần chạy, báo cáo sự cố, báo cáo trạng thái và báo cáo hoàn tất.

## 2. Ánh xạ hạng mục tài liệu

| Hạng mục 29119-3 | Tài liệu ChatNet | Tình trạng |
|---|---|---|
| Chính sách kiểm thử tổ chức | [Kế hoạch QA, mục 2](QUALITY_ASSURANCE_PLAN.md#2-quality-objectives) | Một phần: nêu mục tiêu chất lượng, chưa có chính sách riêng |
| Chiến lược kiểm thử | [Chiến lược kiểm thử](TEST_STRATEGY.md) | Có |
| Kế hoạch kiểm thử | [Kế hoạch QA](QUALITY_ASSURANCE_PLAN.md), [kế hoạch V&V](VERIFICATION_AND_VALIDATION_PLAN.md) | Một phần: chưa có lịch, nhân sự, công cụ theo đợt |
| Đặc tả thiết kế kiểm thử | Kịch bản `TC-*` ở [ca nghiệm thu](ACCEPTANCE_CASES.md) | Một phần: nêu trình tự và kết quả, chưa có điều kiện tiên quyết và dữ liệu |
| Đặc tả ca kiểm thử | Checkpoint `AC-*` ở [ca nghiệm thu](ACCEPTANCE_CASES.md) | Một phần: có yêu cầu, thao tác và điều kiện đạt. Dùng [mẫu 5.1](#51-đặc-tả-ca-kiểm-thử) để bổ sung |
| Đặc tả quy trình kiểm thử | Mẫu 5.2 | Mẫu, chưa có bản điền |
| Yêu cầu dữ liệu kiểm thử | Mẫu 5.1 (trường dữ liệu) | Mẫu, chưa có bản điền |
| Yêu cầu môi trường kiểm thử | [Kế hoạch QA, mục 5](QUALITY_ASSURANCE_PLAN.md#5-test-environments) | Một phần: nêu loại môi trường |
| Báo cáo sẵn sàng dữ liệu và môi trường | Mẫu 5.2 (mục điều kiện sẵn sàng) | Mẫu |
| Kết quả thực tế, nhật ký thực thi | Mẫu 5.3 | Mẫu. Chưa có bản ghi nào |
| Báo cáo sự cố kiểm thử | Mẫu 5.4 | Mẫu |
| Báo cáo trạng thái kiểm thử | Mẫu 5.5 | Mẫu |
| Báo cáo hoàn tất kiểm thử | Mẫu 5.6 | Mẫu |

## 3. Quy ước

- Kết quả chỉ nhận một trong: **PASS**, **FAIL**, **NOT RUN**, **BLOCKED**, **PARTIAL**. Chỉ ghi PASS khi bản ghi có đủ các trường ở mẫu 5.3.
- Ca có điều kiện không được tính PASS khi điều kiện chưa thỏa.
- Dùng tài khoản và dữ liệu tổng hợp. Không dùng dữ liệu production làm fixture.
- Không đưa khóa, token, URL ký hoặc nội dung riêng tư vào bằng chứng. Che trước khi lưu.
- Mã lần chạy: `RUN-<phạm vi>-<yyyymmdd>-<số thứ tự>`, ví dụ `RUN-AUTH-20261201-01`. Mã sự cố theo hệ thống theo dõi lỗi của dự án.
- Mức toàn vẹn của thành phần theo [kế hoạch V&V, mục 5](VERIFICATION_AND_VALIDATION_PLAN.md#5-mức-toàn-vẹn-và-độ-sâu-vv). Mức quyết định độ sâu ca và yêu cầu độc lập.
- Nơi lưu hồ sơ lần chạy chưa được quy định (VV-OPEN-04). QA owner phải chọn trước lần chạy đầu tiên.

## 4. Quan hệ giữa các hạng mục

Yêu cầu (`REQ-*`, `NFR-*`) → kịch bản `TC-*` → checkpoint `AC-*` → lần chạy `RUN-*` → bằng chứng. Sự cố gắn vào lần chạy và yêu cầu. Ma trận nằm ở [truy vết](TRACEABILITY_MATRIX.md).

## 5. Mẫu

### 5.1 Đặc tả ca kiểm thử

| Trường | Nội dung |
|---|---|
| ID ca | `AC-…` (checkpoint) thuộc kịch bản `TC-…` |
| Yêu cầu | Mã `REQ-*` hoặc `NFR-*` |
| Mức toàn vẹn | 1–4 của thành phần ([V&V mục 5](VERIFICATION_AND_VALIDATION_PLAN.md#5-mức-toàn-vẹn-và-độ-sâu-vv)) |
| Mục tiêu | Hành vi cần xác minh, một câu |
| Loại ca | Dương, âm, biên, đồng thời, khôi phục |
| Phương pháp | Test, inspection, analysis hoặc demonstration |
| Điều kiện tiên quyết | Trạng thái hệ thống, tài khoản, quyền và dữ liệu cần có trước khi chạy |
| Dữ liệu kiểm thử | Giá trị đầu vào cụ thể hoặc cách sinh. Không ghi bí mật |
| Môi trường | Loại môi trường và nền tảng ([QA mục 5](QUALITY_ASSURANCE_PLAN.md#5-test-environments)) |
| Bước thực hiện | Danh sách bước đánh số |
| Kết quả mong đợi | Quan sát được, kiểm đúng/sai được |
| Điều kiện sau | Trạng thái cần có sau khi chạy, cách dọn dữ liệu |
| Ghi chú | Phụ thuộc, giới hạn, ca liên quan |

### 5.2 Đặc tả quy trình kiểm thử

| Trường | Nội dung |
|---|---|
| ID quy trình | `TP-…` |
| Ca bao phủ | Danh sách `AC-*` chạy theo thứ tự |
| Điều kiện sẵn sàng môi trường | Build/SHA, cấu hình, dịch vụ ngoài, kết quả kiểm sẵn sàng |
| Điều kiện sẵn sàng dữ liệu | Tài khoản, vai trò, fixture đã tạo |
| Trình tự chạy | Thứ tự và phụ thuộc giữa các ca |
| Điểm dừng | Điều kiện dừng và chuyển sang BLOCKED |
| Dọn dẹp | Cách đưa môi trường về trạng thái ban đầu |

### 5.3 Hồ sơ lần chạy (nhật ký thực thi và kết quả thực tế)

Các trường theo [kế hoạch QA, mục 6](QUALITY_ASSURANCE_PLAN.md#6-evidence-rules).

| Trường | Nội dung |
|---|---|
| ID lần chạy | `RUN-…` |
| Ca và yêu cầu | `AC-*` và `REQ-*`/`NFR-*` |
| Commit SHA và artifact | SHA đầy đủ, định danh build |
| Môi trường | Hệ điều hành, trình duyệt hoặc thiết bị, viewport. Loại cấu hình nhà cung cấp, không ghi giá trị bí mật |
| Người chạy, thời điểm | Tên và ngày giờ |
| Lệnh hoặc bước thủ công | Lệnh chính xác hoặc bước đã làm |
| Kết quả thực tế | Quan sát, không diễn giải |
| Kết quả | PASS / FAIL / NOT RUN / BLOCKED / PARTIAL |
| Bằng chứng | Log, ảnh chụp hoặc video đã che dữ liệu nhạy cảm |
| Sự cố | Mã sự cố nếu FAIL |
| Người xem xét | Tên. Với mức 4, phải khác người chạy và khác tác giả thay đổi |

### 5.4 Báo cáo sự cố kiểm thử

| Trường | Nội dung |
|---|---|
| ID sự cố | Theo hệ thống theo dõi lỗi |
| Lần chạy và ca | `RUN-*`, `AC-*` |
| Yêu cầu bị ảnh hưởng | `REQ-*`/`NFR-*` |
| Tóm tắt | Một câu |
| Kết quả mong đợi và thực tế | Hai mục tách riêng |
| Cách tái hiện | Bước, dữ liệu, SHA, môi trường |
| Độ nghiêm trọng | S1, S2, S3 ([V&V mục 8](VERIFICATION_AND_VALIDATION_PLAN.md#8-báo-cáo-dị-thường)) |
| Phân loại | Lỗi sản phẩm, lỗi ca, lỗi môi trường, lỗi dữ liệu |
| Trạng thái | Mới, đã xác nhận, đang sửa, đã sửa chờ chạy lại, đóng, từ chối |
| Quyết định của owner | Tên, ngày, chấp nhận hoặc từ chối |
| Chạy lại | `RUN-*` xác nhận sửa |

### 5.5 Báo cáo trạng thái kiểm thử

| Trường | Nội dung |
|---|---|
| Kỳ báo cáo và phạm vi | Ngày, bản build hoặc phạm vi phát hành |
| Số ca theo kết quả | PASS, FAIL, NOT RUN, BLOCKED, PARTIAL |
| Số ca mức 3–4 chưa PASS | Danh sách `AC-*` |
| Sự cố mở theo S1/S2/S3 | Số lượng và danh sách S1 |
| Rào cản | Môi trường, dữ liệu, phụ thuộc |
| Rủi ro mới | Mô tả và owner |

### 5.6 Báo cáo hoàn tất kiểm thử

| Trường | Nội dung |
|---|---|
| Phạm vi và SHA | Phạm vi phát hành, SHA kiểm |
| Tóm tắt kết quả | Số ca theo kết quả, so với kế hoạch |
| Độ bao phủ yêu cầu | Số yêu cầu P0/P1 có ca PASS, liệt kê yêu cầu không có |
| Sự cố còn lại | Danh sách và quyết định chấp nhận của owner |
| Mục NOT RUN và BLOCKED | Lý do và ảnh hưởng |
| Khác biệt so với kế hoạch | Ca bỏ, môi trường thay thế |
| Bài học | Thay đổi đề xuất cho kế hoạch và mẫu |
| Duyệt | Chủ sản phẩm, bảo mật, phát hành |

## 6. Ví dụ điền mẫu

Ví dụ minh họa cách điền mẫu 5.1 từ checkpoint hiện có. Không phải kết quả chạy.

| Trường | Nội dung |
|---|---|
| ID ca | [AC-AUTH-005](ACCEPTANCE_CASES.md#ac-auth-005), thuộc [TC-AUTH-001](ACCEPTANCE_CASES.md#tc-auth-001) |
| Yêu cầu | [REQ-AUTH-005](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#req-auth-005) |
| Mức toàn vẹn | 4 (xác thực và phiên, đề xuất) |
| Mục tiêu | Xác minh Auth không cấp phiên khi OTP sai hoặc hết hạn |
| Loại ca | Âm |
| Phương pháp | Test |
| Điều kiện tiên quyết | Hai challenge đăng ký độc lập chưa xác minh. Cách lấy OTP kiểm thử do Engineering xác nhận |
| Dữ liệu kiểm thử | Tài khoản tổng hợp. OTP sai cho challenge thứ nhất. OTP đúng nhưng quá hạn cho challenge thứ hai |
| Môi trường | Go integration hoặc staging có email test |
| Bước thực hiện | 1. Gửi OTP sai cho challenge thứ nhất. 2. Chờ challenge thứ hai quá hạn rồi gửi OTP của nó |
| Kết quả mong đợi | Cả hai lần đều bị từ chối. Không có phiên nào được cấp |
| Điều kiện sau | Xóa hai tài khoản tổng hợp |
| Kết quả hiện tại | NOT RUN |

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp đầu tiên: ánh xạ hạng mục 29119-3, mẫu hồ sơ kiểm thử và ví dụ.
