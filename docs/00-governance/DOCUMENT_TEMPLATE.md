---
document_id: GOV-TPL-001
title: Mẫu tài liệu và biên bản kiểm tra
version: 1.0.0
status: Draft
owner: Engineering Governance
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 15289:2019, ISO/IEC/IEEE 29119-3:2021"
---

# Mẫu tài liệu và biên bản kiểm tra

## Mẫu một tài liệu

```markdown
---
document_id: AREA-PURPOSE-001
title: Tiêu đề
version: 1.0.0
status: Draft
owner: Vai trò chịu trách nhiệm
baseline_commit: SHA commit nguồn
last_updated: YYYY-MM-DD
normative_basis: "Tham chiếu tiêu chuẩn"
---

# Tiêu đề

## Phạm vi và độc giả

## Nội dung và nguồn đối chiếu

## Cách kiểm chứng và giới hạn

## Lịch sử thay đổi
```

Yêu cầu mới ghi thêm ID, tiêu chí quan sát được, ưu tiên và mã ca. ADR ghi thêm context, phương án, quyết định, hệ quả và review. Tài liệu vận hành ghi trigger, bước xác nhận phục hồi và người chịu trách nhiệm. Chi tiết trạng thái tại [Document control](DOCUMENT_CONTROL.md).

## Mẫu biên bản

| Trường | Điền khi kiểm |
|---|---|
| Phạm vi | Docs, code, tích hợp, thiết bị hoặc release |
| Mã ca và requirement | TC-ID, REQ-ID hoặc NFR-ID |
| Bản kiểm | SHA, build ID, loại artifact |
| Môi trường | Ngày giờ, OS/browser, dữ liệu thử, provider/fixture |
| Thao tác và kết quả | Lệnh hoặc trình tự, mong đợi, kết quả thực tế |
| Bằng chứng | Link log/trace đã lọc hoặc ảnh phù hợp, người kiểm |
| Trạng thái | PASS / FAIL / NOT RUN / BLOCKED và rủi ro còn mở |

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Mẫu chuẩn cho hồ sơ và bằng chứng.
