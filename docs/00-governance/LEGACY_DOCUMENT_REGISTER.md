---
document_id: GOV-LEG-001
title: Legacy Document Register
version: 1.0.1
status: Draft
owner: Documentation Workstream
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 15289:2019"
---

# Legacy Document Register

## Tóm tắt

Các tài liệu cũ được giữ để truy lại quyết định và kết quả từng đợt. Bảng dưới đây cho biết mục nào vẫn là hướng dẫn kỹ thuật đang áp dụng, mục nào là đề xuất và mục nào đã có tài liệu thay thế.

## 1. Purpose

Sổ này liên kết hồ sơ lưu trữ, đề xuất và hướng dẫn kỹ thuật tới tài liệu áp dụng theo baseline. Handoff và báo cáo kiểm thử giữ nội dung và mốc cũ. Các liên kết nội bộ trỏ đến thư mục hiện tại.

Dùng cột **Phân loại** để phân biệt tài liệu lịch sử, đề xuất và hướng dẫn còn hiệu lực. Cột **Đọc tiếp** dẫn tới mô tả theo mốc mã nguồn của bộ tài liệu mới. Với hướng dẫn còn hiệu lực, link ở cột đó bổ sung ngữ cảnh chứ không thay thế quy tắc gốc.

## 2. Product, security and feature specifications

| Tệp gốc | Phân loại | Đọc tiếp |
|---|---|---|
| [BLOCK_USER_CROSS_SERVICE_POLICY.md](../archive/features/BLOCK_USER_CROSS_SERVICE_POLICY.md) | Historical policy and acceptance matrix; retain as source evidence | [Identity, privacy and blocking](../06-security/IDENTITY_PRIVACY_AND_BLOCKING.md) |
| [CALL_LIVE_TRANSLATION_WEB.md](../archive/features/CALL_LIVE_TRANSLATION_WEB.md) | Historical design note; current state re-baselined | [Calls and translation](../04-backend/CALLS_AND_TRANSLATION.md), [AI/call privacy](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md) |
| [CALL_UI_UX_V2_WEB.md](../archive/features/CALL_UI_UX_V2_WEB.md) | Historical UI specification | [Web/PWA](../05-clients/WEB_PWA.md), [Design/accessibility](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md) |
| [CHATNET_AI_MARKETPLACE_SPEC.md](../proposals/CHATNET_AI_MARKETPLACE_SPEC.md) | Product proposal; AI seller workflow remains proposed | [Marketplace](../04-backend/MARKETPLACE.md), [Feature status](../01-product/FEATURE_STATUS_REGISTER.md) |
| [CHATNET_POINT_COIN_PRODUCT_SPEC.md](../proposals/CHATNET_POINT_COIN_PRODUCT_SPEC.md) | Product specification, not implementation evidence | [Point/Coin product status](../04-backend/POINT_COIN_PRODUCT_SPEC.md) |
| [CONVERSATION_CATEGORIES.md](../archive/features/CONVERSATION_CATEGORIES.md) | Feature-specific behavior reference | [Chat and groups](../04-backend/CHAT_AND_GROUPS.md) |
| [E2EE_IMPLEMENTATION_MASTER_PLAN.md](../archive/features/E2EE_IMPLEMENTATION_MASTER_PLAN.md) | Historical implementation plan and pilot evidence; retain detailed history | [E2EE/MLS status](../06-security/E2EE_MLS_STATUS.md) |
| [MEDIA_ACCESS_REVOCATION.md](../archive/features/MEDIA_ACCESS_REVOCATION.md) | Historical access-revocation specification | [Media access control](../06-security/MEDIA_ACCESS_CONTROL.md) |
| [PROFILE_NOTES.md](../archive/features/PROFILE_NOTES.md) | Feature-specific API note | [Identity and contacts](../04-backend/IDENTITY_AND_CONTACTS.md) |
| [SOCO_UI_IMPLEMENTATION.md](../archive/features/SOCO_UI_IMPLEMENTATION.md) | Historical UI implementation and QA notes | [Design/accessibility](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md) |

## 3. Platform and engineering documents

| Tệp gốc | Phân loại | Đọc tiếp |
|---|---|---|
| [FRONTEND_STRUCTURE.md](../engineering/FRONTEND_STRUCTURE.md) | Detailed navigation map referenced by AGENTS.md. Verify specific paths against the source tree. | [Frontend architecture](../05-clients/FRONTEND_ARCHITECTURE.md) |
| [AI_SKILLS_SETUP.md](../engineering/AI_SKILLS_SETUP.md) | Retain as tool-specific setup guidance | [Agent workflow](AGENT_WORKFLOW.md) |
| [engineering/FRONTEND_STANDARDS.md](../engineering/FRONTEND_STANDARDS.md) | Active project guidance; remains applicable | [Frontend architecture](../05-clients/FRONTEND_ARCHITECTURE.md) |
| [engineering/UI_FOUNDATION.md](../engineering/UI_FOUNDATION.md) | Active UI implementation guidance; remains applicable | [Design/accessibility](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md) |
| [engineering/AGENT_FILE_OWNERSHIP.md](../engineering/AGENT_FILE_OWNERSHIP.md) | Active concurrency and file ownership policy | [Agent workflow](AGENT_WORKFLOW.md) |
| [engineering/UI_SKILL_ORCHESTRATION.md](../engineering/UI_SKILL_ORCHESTRATION.md) | Active UI skill dispatch policy | [Agent workflow](AGENT_WORKFLOW.md) |

### Báo cáo chuyển đổi Flutter

[Chat/PWA](../archive/flutter/flutter-chat-pwa-parity.md), [Danh bạ](../archive/flutter/flutter-contacts-pwa-parity.md), [bước 2](../archive/flutter/flutter-migration-step2.md), [bước 3](../archive/flutter/flutter-migration-step3.md) và [bước 4](../archive/flutter/flutter-migration-step4.md) là các ghi nhận theo đợt. Tra [Flutter client](../05-clients/MOBILE_FLUTTER.md) trước khi dùng chúng để đánh giá hiện trạng theo baseline.

## 4. Desktop documents

| Tệp gốc | Phân loại | Đọc tiếp |
|---|---|---|
| [desktop/README.md](../archive/desktop/README.md) | Historical index; current desktop state is documented separately | [Electron desktop](../05-clients/DESKTOP_ELECTRON.md) |
| [desktop/01_PRODUCT_SCOPE.md](../archive/desktop/01_PRODUCT_SCOPE.md) | Historical PRD; contains planned-state wording that predates implementation | [Electron desktop](../05-clients/DESKTOP_ELECTRON.md), [Feature status](../01-product/FEATURE_STATUS_REGISTER.md) |
| [desktop/02_TECH_ARCHITECTURE.md](../archive/desktop/02_TECH_ARCHITECTURE.md) | Historical architecture proposal; reconcile against current Main/Preload source | [Electron desktop](../05-clients/DESKTOP_ELECTRON.md) |
| [desktop/03_IMPLEMENTATION_BACKLOG.md](../archive/desktop/03_IMPLEMENTATION_BACKLOG.md) | Historical task and batch record | [Quality plan](../07-quality/QUALITY_ASSURANCE_PLAN.md), [Release management](../08-operations/RELEASE_MANAGEMENT.md) |
| [desktop/04_QA_RELEASE_GATES.md](../archive/desktop/04_QA_RELEASE_GATES.md) | Historical gate definition; current commands are in package/workflow source | [CI gates](../07-quality/CI_QUALITY_GATES.md), [Release management](../08-operations/RELEASE_MANAGEMENT.md) |
| [desktop/05_AGENT_HANDOFF.md](../archive/desktop/05_AGENT_HANDOFF.md) | Historical handoff; retain unchanged | [Agent workflow](AGENT_WORKFLOW.md) |
| [B01](../archive/desktop/06_BATCH_01_STATUS.md) · [B02](../archive/desktop/07_BATCH_02_STATUS.md) · [B03](../archive/desktop/08_BATCH_03_STATUS.md) · [B04](../archive/desktop/09_BATCH_04_STATUS.md) · [B05](../archive/desktop/10_BATCH_05_STATUS.md) | Immutable historical evidence snapshots; statuses are not current without re-verification | [Electron desktop](../05-clients/DESKTOP_ELECTRON.md), [CI gates](../07-quality/CI_QUALITY_GATES.md) |
| [desktop/adr/0001-electron-vs-tauri.md](../archive/desktop/adr/0001-electron-vs-tauri.md) | Existing decision record; retain and reference | [Architecture decisions](../09-decisions/README.md) |

## 5. Historical handoffs

The following are retained without rewriting their dated execution results:
- [Agent 1](../archive/agent-handoffs/CHATNET_AGENT1_HANDOFF.md) và [Agent 2](../archive/agent-handoffs/CHATNET_AGENT2_HANDOFF.md).
- [Hồ sơ Agent 3](../archive/agent-handoffs/agent-3/), [Agent 4](../archive/agent-handoffs/agent-4/) và [Agent 5](../archive/agent-handoffs/agent-5/).

They are historical evidence only. Any PASS, IN_REVIEW, BLOCKED or NOT RUN result applies to the build, branch, environment and date stated inside the handoff.

## 6. Đề xuất Distributed Media

[Hồ sơ Distributed Media](../proposals/distributed-media-storage/README.md) gồm [đặc tả](../proposals/distributed-media-storage/CHATNET_DISTRIBUTED_MEDIA_RECOVERY_SPEC.md), [bàn giao BA](../proposals/distributed-media-storage/CHATNET_DISTRIBUTED_MEDIA_RECOVERY_BA_HANDOFF.md) và [ma trận QA](../proposals/distributed-media-storage/CHATNET_DISTRIBUTED_MEDIA_RECOVERY_QA_MATRIX.md). Đề xuất chưa triển khai, chưa có bằng chứng độ bền và không cấp quyền thu phí thật hoặc xóa dữ liệu S3/R2 production.

Các tệp này đã có ở checkout `3664430`. Hồ sơ và gói ZIP bàn giao được chuyển cùng nhau vào `docs/proposals/distributed-media-storage/`.

## 7. Tra cứu hồ sơ lưu trữ

- [README thời MVP](../archive/README_MVP.md) — bản chụp từ baseline. README gốc hiện là cổng vào tài liệu mới.
- [Mục lục lịch sử](../archive/README.md) — handoff, báo cáo batch và ghi chú tính năng được gom theo nhóm trong `docs/archive/`.

## Lịch sử thay đổi

- 1.0.1 (2026-11-19) — Phân loại rõ hướng dẫn còn hiệu lực và hồ sơ cũ. Thêm liên kết trực tiếp và đối chiếu các báo cáo Flutter.

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
