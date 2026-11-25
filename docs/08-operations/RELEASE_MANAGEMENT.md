---
document_id: OPS-REL-001
title: Quản lý phát hành và rollback
version: 1.0.0
status: Draft
owner: Platform Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-21
normative_basis: "ISO/IEC/IEEE 12207:2026, ISO/IEC/IEEE 15289:2019"
---

# Quản lý phát hành và rollback

| Gói | Bằng chứng trước khi phát hành |
|---|---|
| Web/PWA | Build, luồng chính, service-worker update, cache theo phiên, responsive và accessibility |
| Backend | Container theo SHA, migration trên DB tương đương staging, health, tích hợp PostgreSQL/Redis và provider |
| Electron | Bản chạy trên OS/kiến trúc công bố, kiểm quyền native, ký/notarize theo nền tảng, update và rollback. Bản cài nội bộ không thay thế bằng chứng |
| Flutter | Build và thiết bị thật cho từng nền tảng công bố, signing/store, Auth và dữ liệu |

## Cổng quyết định và trạng thái

Release record phải có các trường dưới đây. Không suy ra `PASS` từ việc artifact được build.

| Gate | Evidence bắt buộc | Trạng thái tài liệu này |
|---|---|---|
| P0/P1 acceptance | Báo cáo checkpoint cùng SHA, kết quả và quyết định hoãn nếu có | NOT RUN |
| Hosted CI | Run ID/URL, SHA khớp, job bắt buộc và log lưu trữ | NOT RUN |
| SLO/RPO/RTO | Mục tiêu đã phê duyệt và số đo của môi trường phát hành | NOT SET |
| Backup restore | Restore drill đạt integrity check và thời gian RTO/RPO được ghi | NOT RUN |
| Rollback | Staging drill đạt, schema tương thích, artifact trước và smoke sau rollback | NOT RUN |
| Release decision | `GO`/`NO-GO`/`DEFERRED`, owner, thời điểm, gap và link evidence | NOT RUN |

`GO` chỉ hợp lệ khi mọi gate áp dụng là `PASS`. `NOT SET`, `NOT RUN`, `BLOCKED` và `FAIL` phải giữ nguyên trạng thái hoặc chuyển `NO-GO`.

## Luồng quyết định

1. Ghi phạm vi, SHA, artifact digest, schema tương thích, QA evidence, các mục `NOT RUN` hoặc `BLOCKED` và người duyệt.
2. Kiểm smoke sau rollout staging và diễn tập quay về artifact trước. Với Electron, kiểm phiên và outbox qua install/update/rollback.
3. Khi rollout lỗi, dừng mở rộng. Kiểm tương thích schema trước khi quay lại artifact cũ. Chỉ phục hồi từ backup theo quy trình đã xác minh.
4. Phân biệt `Built`, `Verified`, `Approved`, `Published` và ghi kết quả thực tế.

Xem [V&V](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md), [CI](../07-quality/CI_QUALITY_GATES.md) và [báo cáo Desktop B05](../archive/desktop/10_BATCH_05_STATUS.md).

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp đầu tiên theo baseline.
