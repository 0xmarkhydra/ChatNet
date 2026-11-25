---
document_id: OPS-DEV-001
title: Chạy ChatNet trên máy phát triển
version: 1.0.0
status: Draft
owner: Platform Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026, ISO/IEC/IEEE 15289:2019"
---

# Chạy ChatNet trên máy phát triển

## Stack Docker Compose

Từ thư mục gốc repository, chạy `docker compose up --build`, mở `http://localhost:8080`, kiểm `/api/health` và xem `docker compose logs --tail=100 backend frontend` nếu lỗi. Cần Git, Docker Engine hoặc Desktop có Compose và cổng host 8080 chưa bị chiếm. Cấu hình các tích hợp thử nghiệm theo [Environment](ENVIRONMENT_CONFIGURATION.md). Health không xác nhận OTP, push, LiveKit hoặc dịch AI hoạt động.

Dừng bằng `docker compose down` để giữ volume. **`make reset` và `docker compose down -v` xóa dữ liệu volume local.** Không cần reset volume để áp dụng [migration](../04-backend/DATABASE_MIGRATIONS.md).

## Chạy từng thành phần

| Thành phần | Lệnh và điều kiện |
|---|---|
| Go | Trong `backend/`, chạy `go test ./...`. Các ca integration cần PostgreSQL/Redis riêng, xem [CI](../07-quality/CI_QUALITY_GATES.md) |
| React | Trong `frontend/`, chạy `npm ci`, `npm run dev`, `npm run lint`, `npm run check:architecture`, `npm run test:unit`, `npm run build`. CI chọn Node 24 |
| Electron | Cài dependencies ở cả `frontend/` và `desktop/`. Trong `desktop/`, chạy `npm run dev:web` rồi `npm run dev` ở cửa sổ riêng. Dùng `npm test` hoặc `npm run check` để kiểm |
| Flutter | Trong `mobile/`, chạy `flutter pub get`, `flutter analyze`, `flutter test`. Chọn SDK theo [pubspec](../../mobile/pubspec.yaml) |

Nguồn đối chiếu gồm [Compose](../../docker-compose.yml), [Makefile](../../Makefile) và package scripts. Đây là hướng dẫn, không phải nhật ký đã chạy.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp đầu tiên theo baseline.
