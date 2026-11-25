---
document_id: OPS-DEPLOY-001
title: Triển khai và vận hành ChatNet
version: 1.0.0
status: Draft
owner: Platform Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-21
normative_basis: "ISO/IEC/IEEE 12207:2026, ISO/IEC/IEEE 15289:2019"
---

# Triển khai và vận hành ChatNet

## Cấu trúc khai báo

Local dùng Compose với Nginx, backend, PostgreSQL và Redis. [Dockerfile backend](../../Dockerfile.backend) đóng gói Gateway cùng năm dịch vụ Auth, Chat, Feed, Translate và Call. [Backend runner](../../backend-run.sh) thoát khi một tiến trình con dừng. Việc tự khởi động lại phụ thuộc môi trường.

[Template Nginx](../../frontend-nginx.conf.template) chuyển `/api/` tới upstream, hỗ trợ WebSocket upgrade và tắt buffering cho luồng realtime. Default upstream trong image tham chiếu mạng riêng Railway, không chứng minh deployment đang chạy. Xem [sơ đồ triển khai](../02-architecture/DEPLOYMENT_ARCHITECTURE.md).

## Runbook

| Tín hiệu | Khoanh vùng | Xác nhận khôi phục |
|---|---|---|
| Web lỗi hoặc health không đạt | Đối chiếu release ID, log Nginx và Gateway, health từng service và dependency | Health và một luồng người dùng đại diện hoạt động |
| Chat không cập nhật | Đối chiếu ghi/ack với trạng thái tải lại, kiểm SSE reconnect, Redis và proxy | Hai phiên QA về cùng trạng thái server, không lặp tin |
| Media, gọi hoặc dịch lỗi | Kiểm tra network, provider và quyền bằng tài khoản QA. Lọc URL ký khỏi log | Luồng hợp lệ thành công, luồng không có quyền bị từ chối |
| Migration lỗi | Dừng rollout tiếp theo, lưu log đã lọc, kiểm tương thích schema | Phương án sửa hoặc rollback kiểm được trên staging |
| Cần khôi phục dữ liệu | Khôi phục bản backup trong môi trường cách ly, kiểm integrity và đo thời gian | Biên bản restore được owner xác nhận |

Hồ sơ rollout ghi SHA, build ID, migration, health, smoke và rollback. Chưa xác minh production, SLO, RPO, RTO hoặc on-call trong đợt docs.

## Cổng rollout và hồ sơ trạng thái

Release owner ghi các trường này trước khi mở rộng rollout. Mỗi dòng phải có trạng thái và link evidence; thiếu evidence không được ghi `PASS`.

| Gate | Điều kiện `PASS` | Trạng thái tài liệu này |
|---|---|---|
| P0/P1 acceptance | Báo cáo [ca nghiệm thu](../07-quality/ACCEPTANCE_CASES.md#cổng-nghiệm-thu-p0p1) cùng SHA đạt quy tắc P0/P1 | NOT RUN |
| Hosted CI | GitHub Actions run ID, SHA khớp, mọi job bắt buộc hoàn tất và đạt | NOT RUN |
| SLO/RPO/RTO | SLO, RPO và RTO đã được Product/Platform phê duyệt, có số đo từ môi trường đích và cửa sổ đo | NOT SET |
| Backup restore | Restore drill trong môi trường cách ly, integrity check, thời gian đo và người xác nhận | NOT RUN |
| Rollback | Staging rollback drill đạt, schema tương thích, artifact trước và lệnh khôi phục đã ghi | NOT RUN |
| Quyết định rollout | `GO`, `NO-GO` hoặc `DEFERRED` kèm owner, thời điểm và gap còn lại | NOT RUN |

Trạng thái tổng hợp là `GO` chỉ khi mọi gate áp dụng là `PASS`. `NOT SET`, `NOT RUN`, `BLOCKED` hoặc `FAIL` chặn mở rộng rollout.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp đầu tiên theo baseline.
