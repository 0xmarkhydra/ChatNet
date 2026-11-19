---
document_id: OPS-ENV-001
title: Cấu hình môi trường ChatNet
version: 1.0.0
status: Draft
owner: Platform Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026, ISO/IEC/IEEE 15289:2019"
---

# Cấu hình môi trường ChatNet

| Nhóm | Biến hoặc nguồn | Khi nào cần |
|---|---|---|
| Auth và dữ liệu | `JWT_SECRET`, `OTP_PEPPER`, `DATABASE_URL`, `REDIS_URL` | Runtime backend. Mỗi môi trường dùng cấu hình riêng, không dùng mặc định demo cho production |
| Email | `RESEND_API_KEY`, `RESEND_API_BASE_URL`, `CHATNET_EMAIL_FROM` | OTP thật cần nhà cung cấp và sender hợp lệ |
| Dịch văn bản | `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_STYLE`, `AI_AUTH_HEADER`, `AI_AUTH_SCHEME` | [Translate service](../../backend/cmd/translate/main.go) |
| Gọi và dịch thoại | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `GEMINI_API_KEY` | Compose ở baseline truyền ba biến LiveKit nhưng không truyền `GEMINI_API_KEY`. Để kiểm dịch thoại trên môi trường QA, cần tiêm biến này riêng vào tiến trình/container backend. Chỉ đặt biến trong shell hoặc `.env` không tự làm Compose truyền vào container |
| Media | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `MEDIA_PUBLIC_ORIGIN` | Dùng bucket thử nghiệm cho QA |
| Push | `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `CHATNET_WEB_URL` | Provider push và liên kết mở ứng dụng |
| Gateway | `AUTH_URL`, `CHAT_URL`, `FEED_URL`, `TRANSLATE_URL`, `CALL_URL`, `PORT` | [Backend runner](../../backend-run.sh) đặt các upstream URL của Gateway trỏ về loopback trong cùng container. Không phải cấu hình bind của các dịch vụ |
| Web | `VITE_API_URL`, `VITE_API_PROXY`, `BACKEND_URL`, `PORT` | Hai biến Vite dành cho build/dev, có thể xuất hiện trong bundle. Hai biến còn lại dành cho Nginx |
| Desktop | [Main](../../desktop/src/main.cjs), [package](../../desktop/package.json) | Main chọn API origin theo mode. Chứng chỉ và khóa ký nằm ngoài repo |

Đối chiếu [Compose](../../docker-compose.yml) và nơi thực sự đọc biến. Khi thay đổi, ghi owner, môi trường, nơi tiêm biến và cách xác minh. Không lưu giá trị bí mật trong docs hoặc log.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp đầu tiên theo baseline.
