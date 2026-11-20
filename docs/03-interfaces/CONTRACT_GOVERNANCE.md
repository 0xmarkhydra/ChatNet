---
document_id: API-GOV-001
title: ChatNet API and Event Contract Governance
version: 1.2.0
status: Draft
owner: API Architecture
baseline_commit: 05a3caab51b55cc5393c8f47fee625fc1eaaa19d
last_updated: 2026-11-21
normative_basis: "RFC 9110"
---

# ChatNet API and Event Contract Governance

## Tóm tắt

Khi đổi handler, rà method, path, auth, mã lỗi, khả năng retry và tác động tới client. Không đưa schema dự đoán vào hợp đồng có thể dùng để sinh mã.

## 1. Current state

The current backend uses Go net/http ServeMux route registrations and handler-defined request/response behavior. The Gateway route table and service route registrations are the source of truth for the committed baseline.

[Danh mục route](API_CATALOG.md) và [danh mục realtime](REALTIME_EVENT_CATALOG.md) mô tả baseline. [OpenAPI](openapi.json) ghi 21 thao tác đã đối chiếu tới handler và kiểm kê 163 thao tác khác dưới nhãn `route-inventory`. [AsyncAPI](realtime.asyncapi.json) mô tả hai loại sự kiện trên một stream SSE. Các đặc tả này chưa bao phủ toàn bộ API, payload lồng, transport provider hay tương thích runtime.

## 2. Target contract format

- Use OpenAPI Specification 3.2.1 for HTTP request/response contracts.
- Use AsyncAPI for the verified message shape. Explicitly mark transport, ordering, authentication and recovery details outside the modeled scope.
- Keep schemas reusable and split by domain where that improves ownership.
- Keep security schemes and server URLs environment-neutral; do not commit credentials or production-only hostnames as defaults.

## 3. Contract generation rules

1. Extract the actual handler request decoder, validation, status codes and response structure.
2. Record authentication and authorization requirements per operation.
3. Record path/query/header parameters and pagination limits.
4. Record idempotency behavior and retry safety where implemented.
5. Record error codes and failure behavior from source/tests.
6. Add examples only from fixtures or safe synthetic values.
7. Validate the contract against handlers and frontend API clients.
8. Do not claim contract coverage until all public routes are represented or explicitly excluded.

## 4. Change process

An API change MUST identify:
- owning service and handler;
- request/response schema impact;
- client compatibility impact;
- authorization and privacy impact;
- migration/backfill requirements;
- tests and rollout/rollback plan.

Breaking changes SHOULD use a versioning or compatibility strategy approved by the API owner. Additive fields still require client compatibility review.

## 5. Verification record and future quality gates

Kiểm ngày 2026-11-21 trên OpenAPI `0.3.0` và AsyncAPI `0.1.1` của baseline `05a3caa`. Dùng Python `jsonschema` 4.26.0 khi kiểm schema. Kiểm tra route-to-spec dùng script không thêm dependency tại `scripts/check-api-contract.mjs`.

| Hiện vật | Bộ kiểm / nguồn | Kết quả |
|---|---|---|
| [OpenAPI 3.2.1](openapi.json) | JSON Schema Draft 2020-12. [OAS 3.2 schema-base](https://spec.openapis.org/oas/3.2/schema-base/2026-11-12) và các tham chiếu schema/dialect/meta của nó. | PASS cho cấu trúc JSON và Schema Object trong phạm vi file |
| [AsyncAPI 3.1.0](realtime.asyncapi.json) | JSON Schema Draft 7. [Bundled schema 3.1.0 without $id tại e27a97f](https://github.com/asyncapi/spec-json-schemas/blob/e27a97f/schemas/3.1.0-without-%24id.json) từ AsyncAPI Initiative. | PASS cho cấu trúc JSON trong phạm vi file |

Chín kiểm tra fixture tổng hợp cũng đạt. Các fixture bao gồm health thiếu thành phần, Checkout có thêm trường `status`, SSE `friend.updated` với `conversationId` bằng 0, trường Call tùy chọn và payload rỗng của `session-revoked`.

PASS của schema và fixture không chứng minh khớp payload runtime, phân quyền, khả năng sinh mã, hay tương thích client. 163 route inventory vẫn cần handler extraction riêng.

### 5.1 Bản ghi kiểm OpenAPI 0.3.0

Kiểm ngày 2026-11-21 trên baseline `05a3caa`. Bản `0.3.0` đối chiếu 21 thao tác rủi ro cao từ auth, chat, feed, call và translation; 163 thao tác còn lại giữ nhãn `route-inventory`. Route inventory có `operationId`, thẻ dịch vụ, tham số đường dẫn chưa xác minh và phản hồi `default` ghi rõ chưa mô hình hóa. Không có schema, mã trạng thái hay yêu cầu xác thực nào được suy ra cho inventory.

| Kiểm tra | Cách làm | Kết quả |
|---|---|---|
| Cấu trúc theo OAS 3.2 | `jsonschema` với [schema-base 2026-11-12](https://spec.openapis.org/oas/3.2/schema-base/2026-11-12), cài vào thư mục tạm, không thêm vào repo | PASS, 0 lỗi |
| Nhất quán nội bộ | `operationId` duy nhất. Mọi tham số `{x}` trong đường dẫn được khai báo. Không có hai đường dẫn tương đương mẫu | PASS (184 thao tác) |
| Route trong source, catalog và OpenAPI | `node scripts/check-api-contract.mjs`; quét route registration trong `backend/cmd` (bỏ test), [danh mục API](API_CATALOG.md) và OpenAPI | PASS, 184/184 route, 0 lệch; 21 verified, 163 route-inventory |
| Danh mục so với OpenAPI | Đếm thao tác `/api/*` | 184/184 |
| Gateway so với OpenAPI | Mỗi đường dẫn `/api/*` phải khớp route source và Gateway proxy | PASS, 184 thao tác, 0 lệch |

Ghi chú về phạm vi so sánh: Chat có thêm `GET /health` nội bộ và Translation có `GET /health/provider`. Cả hai nằm ngoài OpenAPI vì là điểm sức khỏe nội bộ của từng dịch vụ. Gateway có `GET /__chatnet_copy_image` là helper media không thuộc `/api/*`, nên bị loại có chủ đích. Marketplace được đăng ký qua hàm `add()` trong `backend/cmd/feed/marketplace.go`, được đối chiếu riêng.

**Không chứng minh:** khớp runtime, schema, phân quyền hay khả năng sinh mã. 9 fixture của bản `0.1.1` không được chạy lại cho bản này. 163 thao tác inventory vẫn thiếu schema, mã trạng thái và yêu cầu xác thực đã đối chiếu.

### Quality gates for integration

- Re-run structural schema validation and add parser/linter validation where the supported tooling allows it.
- Contract diff against the previous approved version.
- Route-to-spec completeness check.
- `node scripts/check-api-contract.mjs` in CI; fail on missing or stale route.
- Handler-to-schema conformance tests.
- Authentication/authorization negative tests.
- Realtime event compatibility checks.
- Client API type generation or contract tests where appropriate.

## 6. Prohibited shortcuts

- Do not infer response schemas from handler names.
- Do not add endpoints to the spec that are not registered in source or explicitly approved as future contracts.
- Do not describe a provider's external behavior as guaranteed by ChatNet.
- Do not publish secrets, bearer tokens, signed URLs or real user data in examples.

## Lịch sử thay đổi

- 1.2.0 (2026-11-21) — Thêm 21 handler-verified operations, route checker `scripts/check-api-contract.mjs`, và ghi nhận 163 route inventory còn lại.
- 1.1.0 (2026-11-19) — Thêm bản ghi kiểm OpenAPI 0.2.0, kiểm tra route-to-catalog và Gateway-to-service.
- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
