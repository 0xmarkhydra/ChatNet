---
document_id: GOV-APPR-001
title: Sổ duyệt tài liệu ChatNet
version: 1.0.0
status: Draft
owner: Engineering Governance
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 15289:2019"
---

# Sổ duyệt tài liệu ChatNet

## Tóm tắt

Sổ ghi ai duyệt phiên bản nào của tài liệu và khi nào. Tất cả cột duyệt đang trống vì chưa ai duyệt. Tài liệu chỉ chuyển từ `Draft` sang `In Review` hoặc `Approved` khi hàng của nó có tên người duyệt, ngày và quyết định.

## 1. Quy tắc

- Người duyệt là owner ghi ở cột **Owner** hoặc người owner ủy quyền bằng văn bản. Tác giả của thay đổi không tự duyệt tài liệu mức toàn vẹn 3–4 ([V&V mục 5](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md#5-mức-toàn-vẹn-và-độ-sâu-vv)).
- Quyết định là một trong: Approved, Approved có điều kiện, Rejected. Điều kiện và lý do ghi ở cột ghi chú.
- Duyệt gắn với **phiên bản**. Khi tài liệu đổi phiên bản, hàng cũ giữ nguyên và thêm hàng mới. Không sửa hàng đã duyệt.
- Người duyệt kiểm ba điều theo [kế hoạch V&V](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md#bàn-giao-review-tài-liệu): SHA đúng phạm vi, chính sách và đề xuất tách khỏi hành vi source, rủi ro mở có chủ.
- Duyệt tài liệu không đổi trạng thái kiểm thử sản phẩm. Ca nghiệm thu vẫn **NOT RUN** cho tới khi có hồ sơ lần chạy.

## 2. Mục cần quyết riêng khi duyệt

Các mục dưới đây không được duyệt ngầm theo tài liệu chứa chúng:

| Mục | Nơi ghi | Việc cần |
|---|---|---|
| Thang mức toàn vẹn và gán mức | [V&V mục 5](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md#5-mức-toàn-vẹn-và-độ-sâu-vv) | Phê duyệt hoặc đổi (VV-OPEN-01) |
| Quyết định mở TBD-01…05 | [SRS mục 8.1](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#81-quyết-định-mở-tbd) | Chốt hoặc giữ mở, kèm owner |
| Lý do gốc của ADR-0002 và ADR-0004 | [ADR-0002](../09-decisions/0002-sse-realtime-delivery.md), [ADR-0004](../09-decisions/0004-multi-process-backend-container.md) | Architect điền mục Phương án |
| Quyết định mở vận hành OPS-OPEN-01…05 | [Bảo trì và ngừng sử dụng](../08-operations/MAINTENANCE_AND_RETIREMENT.md#7-nội-dung-chưa-có-và-quyết-định-mở) | Chốt owner và số đo |

## 3. Bản ghi duyệt

| ID | Tài liệu | Phiên bản | Owner | Người duyệt | Ngày | Quyết định / ghi chú |
|---|---|---|---|---|---|---|
| GOV-AGENT-001 | [Agent Workflow and File Ownership](../00-governance/AGENT_WORKFLOW.md) | 1.0.0 | Engineering Governance | | | |
| GOV-BASE-001 | [Documentation Baseline and Change Control](../00-governance/BASELINE_AND_CHANGE_CONTROL.md) | 1.0.0 | Documentation Workstream | | | |
| GOV-DOC-001 | [Documentation Control and Policy](../00-governance/DOCUMENT_CONTROL.md) | 1.0.0 | ChatNet Engineering | | | |
| GOV-TPL-001 | [Mẫu tài liệu và biên bản kiểm tra](../00-governance/DOCUMENT_TEMPLATE.md) | 1.0.0 | Engineering Governance | | | |
| GOV-LEG-001 | [Legacy Document Register](../00-governance/LEGACY_DOCUMENT_REGISTER.md) | 1.0.0 | Documentation Workstream | | | |
| GOV-STD-001 | [Standards Register and Tailoring Profile](../00-governance/STANDARDS_REGISTER.md) | 1.1.1 | Engineering Governance | | | |
| GOV-TERM-001 | [ChatNet Terms and Glossary](../00-governance/TERMS_GLOSSARY.md) | 1.0.0 | Engineering Governance | | | |
| PRD-STAT-001 | [ChatNet Feature Status Register](../01-product/FEATURE_STATUS_REGISTER.md) | 1.0.0 | Product and Engineering | | | |
| PRD-PROD-001 | [ChatNet Product Overview](../01-product/PRODUCT_OVERVIEW.md) | 1.0.0 | Product and Engineering | | | |
| REQ-SRS-001 | [Đặc tả yêu cầu phần mềm ChatNet](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md) | 1.1.0 | Product and Engineering | | | |
| UC-CHATNET-001 | [ChatNet Core Use Cases](../01-product/USE_CASES.md) | 1.0.0 | Product and Engineering | | | |
| ARC-DATA-001 | [ChatNet Data Architecture](../02-architecture/DATA_ARCHITECTURE.md) | 1.0.0 | Data and Backend Engineering | | | |
| ARC-DEP-001 | [ChatNet Deployment Architecture](../02-architecture/DEPLOYMENT_ARCHITECTURE.md) | 1.0.0 | Platform Engineering | | | |
| ARC-SYS-001 | [ChatNet System Architecture](../02-architecture/SYSTEM_ARCHITECTURE.md) | 1.1.1 | System Architecture | | | |
| ARC-CTX-001 | [ChatNet System Context](../02-architecture/SYSTEM_CONTEXT.md) | 1.0.0 | System Architecture | | | |
| API-CAT-001 | [ChatNet HTTP API Catalog](../03-interfaces/API_CATALOG.md) | 1.1.0 | Backend Engineering | | | |
| API-GOV-001 | [ChatNet API and Event Contract Governance](../03-interfaces/CONTRACT_GOVERNANCE.md) | 1.1.0 | API Architecture | | | |
| API-ERR-001 | [Danh mục lỗi HTTP ChatNet](../03-interfaces/ERROR_CATALOG.md) | 1.1.0 | API Architecture | | | |
| EVT-CAT-001 | [ChatNet Realtime Event Catalog](../03-interfaces/REALTIME_EVENT_CATALOG.md) | 1.0.0 | Backend Engineering | | | |
| BE-AUTH-001 | [Authentication and Session Management](../04-backend/AUTHENTICATION_AND_SESSIONS.md) | 1.0.0 | Identity and Backend Engineering | | | |
| BE-OVW-001 | [ChatNet Backend Overview](../04-backend/BACKEND_OVERVIEW.md) | 1.0.0 | Backend Engineering | | | |
| BE-CALL-001 | [Calls and Live Translation](../04-backend/CALLS_AND_TRANSLATION.md) | 1.0.0 | Realtime and Backend Engineering | | | |
| BE-CHAT-001 | [Messaging, Conversations and Groups](../04-backend/CHAT_AND_GROUPS.md) | 1.0.0 | Messaging Engineering | | | |
| DB-MIG-001 | [ChatNet Database Migration Process](../04-backend/DATABASE_MIGRATIONS.md) | 1.0.0 | Data and Backend Engineering | | | |
| DB-SCHEMA-001 | [ChatNet Database Schema](../04-backend/DATABASE_SCHEMA.md) | 1.0.0 | Data and Backend Engineering | | | |
| BE-ID-001 | [Identity, Profile, Contacts and Blocking](../04-backend/IDENTITY_AND_CONTACTS.md) | 1.0.0 | Identity and Backend Engineering | | | |
| BE-MKT-001 | [Marketplace Backend Foundation](../04-backend/MARKETPLACE.md) | 1.0.0 | Commerce Engineering | | | |
| BE-MEDIA-001 | [ChatNet Media Storage and Access](../04-backend/MEDIA_STORAGE.md) | 1.0.0 | Backend and Security Engineering | | | |
| PRD-ECON-001 | [Point and Coin Product Specification](../04-backend/POINT_COIN_PRODUCT_SPEC.md) | 1.0.0 | Product and Finance | | | |
| BE-FEED-001 | [Social Feed, Stories and Moderation](../04-backend/SOCIAL_FEED.md) | 1.0.0 | Social Platform Engineering | | | |
| UX-STD-001 | [SocCO Design System and Accessibility](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md) | 1.0.0 | Product Design and Frontend Engineering | | | |
| DESK-ARC-001 | [SocCO Desktop Electron Architecture](../05-clients/DESKTOP_ELECTRON.md) | 1.0.0 | Desktop Engineering | | | |
| WEB-ARC-001 | [ChatNet Frontend Architecture](../05-clients/FRONTEND_ARCHITECTURE.md) | 1.0.0 | Web Engineering | | | |
| MOB-ARC-001 | [ChatNet Flutter Client](../05-clients/MOBILE_FLUTTER.md) | 1.0.0 | Mobile Engineering | | | |
| WEB-PWA-001 | [ChatNet Web and PWA](../05-clients/WEB_PWA.md) | 1.0.0 | Web Engineering | | | |
| PRIV-AI-001 | [AI and Call Translation Privacy](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md) | 1.0.0 | Privacy and Realtime Engineering | | | |
| SEC-E2EE-001 | [ChatNet E2EE and MLS Status](../06-security/E2EE_MLS_STATUS.md) | 1.0.0 | Cryptography and Security Engineering | | | |
| SEC-ID-001 | [Identity, Privacy and Blocking Security Policy](../06-security/IDENTITY_PRIVACY_AND_BLOCKING.md) | 1.0.0 | Security and Identity Engineering | | | |
| SEC-MEDIA-001 | [ChatNet Media Access Control and Revocation](../06-security/MEDIA_ACCESS_CONTROL.md) | 1.0.0 | Security and Backend Engineering | | | |
| SEC-OVW-001 | [ChatNet Security Architecture Overview](../06-security/SECURITY_OVERVIEW.md) | 1.0.0 | Security Engineering | | | |
| SEC-THREAT-001 | [ChatNet Threat Model](../06-security/THREAT_MODEL.md) | 1.0.0 | Security Engineering | | | |
| QA-ACC-001 | [Các ca nghiệm thu theo yêu cầu](../07-quality/ACCEPTANCE_CASES.md) | 1.0.0 | Quality Engineering | | | |
| QA-CI-001 | [ChatNet CI and Quality Gates](../07-quality/CI_QUALITY_GATES.md) | 1.0.0 | Build and Quality Engineering | | | |
| QA-PLAN-001 | [ChatNet Quality Assurance Plan](../07-quality/QUALITY_ASSURANCE_PLAN.md) | 1.0.1 | Quality Engineering | | | |
| QA-CAT-001 | [ChatNet Test and Check Catalog](../07-quality/TEST_CATALOG.md) | 1.0.0 | Quality Engineering | | | |
| QA-TDOC-001 | [Hồ sơ và mẫu tài liệu kiểm thử ChatNet](../07-quality/TEST_DOCUMENTATION.md) | 1.0.0 | Quality Engineering | | | |
| QA-STRAT-001 | [ChatNet Test Strategy](../07-quality/TEST_STRATEGY.md) | 1.0.0 | Quality Engineering | | | |
| QA-TRACE-001 | [Ma trận truy vết của ChatNet](../07-quality/TRACEABILITY_MATRIX.md) | 1.0.0 | Quality Engineering | | | |
| VV-PLAN-001 | [ChatNet Verification and Validation Plan](../07-quality/VERIFICATION_AND_VALIDATION_PLAN.md) | 1.1.0 | Quality and Systems Engineering | | | |
| OPS-DEPLOY-001 | [Triển khai và vận hành ChatNet](../08-operations/DEPLOYMENT_AND_OPERATIONS.md) | 1.0.0 | Platform Engineering | | | |
| OPS-ENV-001 | [Cấu hình môi trường ChatNet](../08-operations/ENVIRONMENT_CONFIGURATION.md) | 1.0.0 | Platform Engineering | | | |
| OPS-DEV-001 | [Chạy ChatNet trên máy phát triển](../08-operations/LOCAL_DEVELOPMENT.md) | 1.0.0 | Platform Engineering | | | |
| OPS-MAINT-001 | [Bảo trì, khôi phục và ngừng sử dụng ChatNet](../08-operations/MAINTENANCE_AND_RETIREMENT.md) | 1.0.0 | Platform Engineering | | | |
| OPS-INDEX-001 | [Vận hành và phát hành ChatNet](../08-operations/README.md) | 1.1.0 | Platform Engineering | | | |
| OPS-REL-001 | [Quản lý phát hành và rollback](../08-operations/RELEASE_MANAGEMENT.md) | 1.0.0 | Platform Engineering | | | |
| ADR-0001 | [Electron cho bản Desktop đầu tiên](../09-decisions/0001-electron-desktop-shell.md) | 1.0.0 | Desktop Architecture | | | |
| ADR-0002 | [SSE và Redis Pub/Sub cho cập nhật realtime của chat](../09-decisions/0002-sse-realtime-delivery.md) | 1.0.1 | System Architecture | | | |
| ADR-0003 | [Khóa nhà cung cấp AI chỉ nằm phía server](../09-decisions/0003-server-side-ai-provider-secrets.md) | 1.0.0 | System Architecture | | | |
| ADR-0004 | [Backend nhiều dịch vụ Go trong một container, truy cập qua Gateway](../09-decisions/0004-multi-process-backend-container.md) | 1.0.2 | Platform Engineering | | | |
| ADR-0005 | [E2EE bằng MLS ở dạng pilot tự nguyện, không bật mặc định](../09-decisions/0005-mls-e2ee-opt-in-pilot.md) | 1.0.0 | Cryptography and Security Engineering | | | |
| ADR-0006 | [Phân quyền do từng dịch vụ backend thực thi, Gateway chỉ định tuyến](../09-decisions/0006-per-service-authorization.md) | 1.0.0 | System Architecture | | | |
| ADR-INDEX-001 | [Hồ sơ quyết định kiến trúc](../09-decisions/README.md) | 1.1.0 | System Architecture | | | |

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp đầu tiên. Chưa có bản duyệt nào.
