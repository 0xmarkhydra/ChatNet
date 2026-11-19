# ChatNet / SocCO

ChatNet là hệ thống giao tiếp đa ngôn ngữ với chat 1–1 và nhóm, danh bạ, Feed/Story, gọi thoại/video và dịch AI. Web/PWA và Electron dùng chung renderer React. Repo cũng chứa client Flutter, nhưng có source không đồng nghĩa đã phát hành hoặc đạt parity.

## Bắt đầu

- [Cổng tài liệu ChatNet](docs/README.md)
- [Chạy local với Docker Compose](docs/08-operations/LOCAL_DEVELOPMENT.md) và [cấu hình môi trường](docs/08-operations/ENVIRONMENT_CONFIGURATION.md)
- [Kiến trúc hệ thống](docs/02-architecture/SYSTEM_ARCHITECTURE.md), [danh mục HTTP API](docs/03-interfaces/API_CATALOG.md) và [migration](docs/04-backend/DATABASE_MIGRATIONS.md)
- [Trạng thái tính năng](docs/01-product/FEATURE_STATUS_REGISTER.md) và [tiêu chí phát hành](docs/08-operations/RELEASE_MANAGEMENT.md)

E2EE/MLS cho chat là pilot có giới hạn, không phải mặc định toàn hệ thống. Marketplace đã có một phần luồng sản phẩm, giỏ hàng và đơn chờ cấu hình thanh toán. AI đăng bán, Point/Coin và Distributed Media không được suy diễn là đã vận hành.

Bộ tài liệu phân biệt có code, đã kiểm thử, đã triển khai và đủ điều kiện phát hành. [README thời MVP](docs/archive/README_MVP.md) được lưu để tra lịch sử.
