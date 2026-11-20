---
document_id: OPS-DEPLOY-001
title: Triển khai và vận hành ChatNet
version: 1.0.0
status: Draft
owner: Platform Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
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

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp đầu tiên theo baseline.
