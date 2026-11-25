---
document_id: API-GOV-001
title: ChatNet API and Event Contract Governance
version: 1.1.0
status: Draft
owner: API Architecture
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "RFC 9110"
---

# ChatNet API and Event Contract Governance

## Tóm tắt

Khi đổi handler, rà method, path, auth, mã lỗi, khả năng retry và tác động tới client. Không đưa schema dự đoán vào hợp đồng có thể dùng để sinh mã.

## 1. Current state

The current backend uses Go net/http ServeMux route registrations and handler-defined request/response behavior. The Gateway route table and service route registrations are the source of truth for the committed baseline.

[Danh mục route](API_CATALOG.md) và [danh mục realtime](REALTIME_EVENT_CATALOG.md) mô tả baseline. [OpenAPI](openapi.json) ghi ba thao tác đã đối chiếu tới handler và kiểm kê 177 thao tác khác dưới nhãn `route-inventory`. [AsyncAPI](realtime.asyncapi.json) mô tả hai loại sự kiện trên một stream SSE. Các đặc tả này chưa bao phủ toàn bộ API, payload lồng, transport provider hay tương thích runtime.

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

Kiểm ngày 2026-11-19 trên hai hợp đồng phiên bản `0.1.1` của baseline `40c1f1b`. Dùng Python `jsonschema` 4.26.0. Các schema của nhà phát hành chỉ được dùng để kiểm, không thêm dependency hay CI vào repo.

| Hiện vật | Bộ kiểm / nguồn | Kết quả |
|---|---|---|
| [OpenAPI 3.2.1](openapi.json) | JSON Schema Draft 2020-12. [OAS 3.2 schema-base](https://spec.openapis.org/oas/3.2/schema-base/2026-11-12) và các tham chiếu schema/dialect/meta của nó. | PASS cho cấu trúc JSON và Schema Object trong phạm vi file |
| [AsyncAPI 3.1.0](realtime.asyncapi.json) | JSON Schema Draft 7. [Bundled schema 3.1.0 without $id tại e27a97f](https://github.com/asyncapi/spec-json-schemas/blob/e27a97f/schemas/3.1.0-without-%24id.json) từ AsyncAPI Initiative. | PASS cho cấu trúc JSON trong phạm vi file |

Chín kiểm tra fixture tổng hợp cũng đạt. Các fixture bao gồm health thiếu thành phần, Checkout có thêm trường `status`, SSE `friend.updated` với `conversationId` bằng 0, trường Call tùy chọn và payload rỗng của `session-revoked`.

PASS của schema và fixture không chứng minh khớp payload runtime, phân quyền, khả năng sinh mã, hay bao phủ toàn bộ route và sự kiện. Những hạng mục đó vẫn cần bằng chứng riêng.

### 5.1 Bản ghi kiểm OpenAPI 0.2.0

Kiểm ngày 2026-11-19 trên baseline `40c1f1b`. Bản `0.2.0` thêm 177 thao tác kiểm kê lấy từ [danh mục API](API_CATALOG.md). Mỗi thao tác có `operationId`, thẻ dịch vụ, tham số đường dẫn kiểu `string` chưa xác minh, và một phản hồi `default` ghi rõ chưa mô hình hóa. Không có schema, mã trạng thái hay yêu cầu xác thực nào được suy ra. Ba thao tác đã đối chiếu từ bản `0.1.1` không đổi.

| Kiểm tra | Cách làm | Kết quả |
|---|---|---|
| Cấu trúc theo OAS 3.2 | `jsonschema` với [schema-base 2026-11-12](https://spec.openapis.org/oas/3.2/schema-base/2026-11-12), cài vào thư mục tạm, không thêm vào repo | PASS, 0 lỗi |
| Nhất quán nội bộ | `operationId` duy nhất. Mọi tham số `{x}` trong đường dẫn được khai báo. Không có hai đường dẫn tương đương mẫu | PASS (180 thao tác) |
| Route trong source so với danh mục | So `"METHOD /path"` trong `backend/cmd/*` (bỏ test) với bảng danh mục theo dịch vụ | Auth 22/22, Call 19/19, Translation 4/4, Chat 108/108, Feed 31/31. Không có route nào lệch |
| Danh mục so với OpenAPI | Đếm thao tác `/api/*` | 180/180 |
| Gateway so với OpenAPI | Mỗi đường dẫn `/api/*` (trừ `/api/health` do Gateway tự xử lý) phải khớp một mẫu `mux.Handle` ở [Gateway](../../backend/cmd/gateway/main.go), mẫu dài nhất thắng, và proxy đích trùng thẻ dịch vụ | PASS, 179 thao tác, 0 lệch |

Ghi chú về phạm vi so sánh: Chat có thêm `GET /health` nội bộ và Translation có `GET /health/provider`. Cả hai nằm ngoài OpenAPI vì là điểm sức khỏe nội bộ của từng dịch vụ. Gateway có `GET /__chatnet_copy_image` là helper media không thuộc `/api/*`, nên bị loại có chủ đích. Marketplace được đăng ký qua hàm `add()` trong `backend/cmd/feed/marketplace.go`, được đối chiếu riêng.

**Không chứng minh:** khớp runtime, schema, phân quyền hay khả năng sinh mã. 9 fixture của bản `0.1.1` không được chạy lại cho bản này. Quy tắc 8 ở mục 3 vẫn chưa đạt: 177 thao tác chưa có schema, mã trạng thái và yêu cầu xác thực.

### Quality gates for integration

- Re-run structural schema validation and add parser/linter validation where the supported tooling allows it.
- Contract diff against the previous approved version.
- Route-to-spec completeness check.
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

- 1.1.0 (2026-11-19) — Thêm bản ghi kiểm OpenAPI 0.2.0, kiểm tra route-to-catalog và Gateway-to-service.
- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
