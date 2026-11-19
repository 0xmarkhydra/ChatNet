# ChatNet Documentation Portal

**Documentation set:** ChatNet Software and System Documentation\
**Baseline:** toan-nguyen-dev at 40c1f1b35958ee22c1278986bf82ff57520137a1\
**Status:** Draft — documentation standardization workstream\
**Language:** Vietnamese explanatory prose; English identifiers, APIs, code symbols and standards terminology.

Cổng này dùng cho snapshot đã ghim ở trên. Xem [chênh lệch với commit phát triển `3664430`](00-governance/BASELINE_AND_CHANGE_CONTROL.md#21-chênh-lệch-với-checkout-phát-triển) trước khi dùng tài liệu để đối chiếu một checkout khác.

This portal is the navigation entry point for the canonical documentation set. Documents are separated by engineering discipline and use stable document IDs, explicit status labels, source baselines and traceability.

## Review lần cuối

Bắt đầu từ [bản ghi bàn giao](07-quality/VERIFICATION_AND_VALIDATION_PLAN.md#bàn-giao-review-tài-liệu), rồi mở [SRS](01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md) và [ma trận truy vết](07-quality/TRACEABILITY_MATRIX.md). Review nội dung tài liệu không thay cho nghiệm thu sản phẩm.

## Đọc theo vai trò

| Audience | Start here | Then read |
|---|---|---|
| Product owner / analyst | [Product overview](01-product/PRODUCT_OVERVIEW.md) | [SRS](01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md), [Use cases](01-product/USE_CASES.md), [Feature status](01-product/FEATURE_STATUS_REGISTER.md) |
| Architect / technical lead | [System context](02-architecture/SYSTEM_CONTEXT.md) | [System architecture](02-architecture/SYSTEM_ARCHITECTURE.md), [Deployment architecture](02-architecture/DEPLOYMENT_ARCHITECTURE.md), [Data architecture](02-architecture/DATA_ARCHITECTURE.md) |
| API / backend engineer | [Backend overview](04-backend/BACKEND_OVERVIEW.md) | [API catalog](03-interfaces/API_CATALOG.md), [OpenAPI](03-interfaces/openapi.json) và [AsyncAPI](03-interfaces/realtime.asyncapi.json) phạm vi giới hạn, [Database schema](04-backend/DATABASE_SCHEMA.md), [Migrations](04-backend/DATABASE_MIGRATIONS.md) |
| Web / PWA engineer | [Frontend architecture](05-clients/FRONTEND_ARCHITECTURE.md) | [Web/PWA](05-clients/WEB_PWA.md), [Design and accessibility](05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md) |
| Desktop engineer | [Electron desktop](05-clients/DESKTOP_ELECTRON.md) | [API catalog](03-interfaces/API_CATALOG.md), [Security overview](06-security/SECURITY_OVERVIEW.md) |
| Mobile engineer | [Flutter client](05-clients/MOBILE_FLUTTER.md) | [System architecture](02-architecture/SYSTEM_ARCHITECTURE.md), [API catalog](03-interfaces/API_CATALOG.md) |
| Security reviewer | [Security overview](06-security/SECURITY_OVERVIEW.md) | [Threat model](06-security/THREAT_MODEL.md), [E2EE/MLS](06-security/E2EE_MLS_STATUS.md), [Media access](06-security/MEDIA_ACCESS_CONTROL.md) |
| QA / tester | [Quality assurance plan](07-quality/QUALITY_ASSURANCE_PLAN.md) | [Test strategy](07-quality/TEST_STRATEGY.md), [Test catalog](07-quality/TEST_CATALOG.md), [V&V plan](07-quality/VERIFICATION_AND_VALIDATION_PLAN.md), [Hồ sơ kiểm thử](07-quality/TEST_DOCUMENTATION.md), [Ca nghiệm thu](07-quality/ACCEPTANCE_CASES.md), [Ma trận truy vết](07-quality/TRACEABILITY_MATRIX.md) |
| Operator / release owner | [Local development](08-operations/LOCAL_DEVELOPMENT.md) | [Environment](08-operations/ENVIRONMENT_CONFIGURATION.md), [Deployment](08-operations/DEPLOYMENT_AND_OPERATIONS.md), [Release](08-operations/RELEASE_MANAGEMENT.md), [Bảo trì và ngừng sử dụng](08-operations/MAINTENANCE_AND_RETIREMENT.md) |

## Danh mục tài liệu

- **00 — Governance:** document control, [approval register](00-governance/APPROVAL_REGISTER.md), standards register, terminology, baseline and legacy-document register.
- **01 — Product:** product scope, requirements, use cases and feature-state evidence.
- **02 — Architecture:** context, architecture viewpoints, deployment and data architecture.
- **03 — Interfaces:** source-derived HTTP API catalog, realtime event catalog and contract governance.
- **04 — Backend:** service boundaries, identity, chat, feed, calls, marketplace, database and media.
- **05 — Clients:** Web/PWA, shared frontend, Electron, Flutter and design/accessibility.
- **06 — Security:** security posture, threat model, privacy, E2EE/MLS and media access.
- **07 — Quality:** QA, test strategy, test catalog, verification/validation, traceability and CI gates.
- **08 — Operations:** local setup, environment contract, deployment, runbooks and release.
- **09 — Decisions:** architecture decision records.

## Cách đọc trạng thái

1. Canonical documents describe the source baseline stated in each document's control block.
2. Source code, executable tests and actual deployment configuration are authoritative for implementation truth. A proposal or product decision is not evidence of implementation.
3. Historical handoffs and legacy specifications remain available; see [Legacy document register](00-governance/LEGACY_DOCUMENT_REGISTER.md). They are not automatically current requirements.
4. Statuses are not interchangeable: **Implemented**, **Tested**, **Deployed**, and **Production Ready** are separate claims.
5. A test is **PASS** only when an execution record identifies the tested commit/build, environment, command, result and evidence. Otherwise use **NOT RUN**, **BLOCKED**, or **PARTIAL**.
6. This local copy is integrated into `toan-nguyen-dev`. Its source baseline is unchanged, and the documents remain **Draft** until formal approval is recorded separately.

## Tiêu chuẩn tham chiếu

See [Standards register](00-governance/STANDARDS_REGISTER.md) for the applicable IEEE, ISO/IEC/IEEE, IETF, W3C, OpenAPI and OWASP references. This project adopts relevant practices; it does not claim formal certification or conformance assessment merely by publishing these documents.

Tra [hồ sơ lịch sử](archive/README.md) để biết bản gốc và ngữ cảnh trước khi thay thế.
