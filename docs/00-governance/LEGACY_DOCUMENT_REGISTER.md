---
document_id: GOV-LEG-001
title: Legacy Document Register
version: 1.0.0
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

This register preserves original documentation paths and identifies canonical successors. Historical handoffs and batch evidence are retained; they are not rewritten to make past work appear to have happened under the current baseline.

Unless a file is explicitly listed as active engineering guidance, documents in the legacy section are reference material. The canonical documents linked below control current implementation summaries and status.

## 2. Product, security and feature specifications

| Existing document | Treatment | Canonical successor |
|---|---|---|
| docs/BLOCK_USER_CROSS_SERVICE_POLICY.md | Historical policy and acceptance matrix; retain as source evidence | [Identity, privacy and blocking](../06-security/IDENTITY_PRIVACY_AND_BLOCKING.md) |
| docs/CALL_LIVE_TRANSLATION_WEB.md | Historical design note; current state re-baselined | [Calls and translation](../04-backend/CALLS_AND_TRANSLATION.md), [AI/call privacy](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md) |
| docs/CALL_UI_UX_V2_WEB.md | Historical UI specification | [Web/PWA](../05-clients/WEB_PWA.md), [Design/accessibility](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md) |
| docs/CHATNET_AI_MARKETPLACE_SPEC.md | Product proposal; AI seller workflow remains proposed | [Marketplace](../04-backend/MARKETPLACE.md), [Feature status](../01-product/FEATURE_STATUS_REGISTER.md) |
| docs/CHATNET_POINT_COIN_PRODUCT_SPEC.md | Product specification, not implementation evidence | [Point/Coin product status](../04-backend/POINT_COIN_PRODUCT_SPEC.md) |
| docs/CONVERSATION_CATEGORIES.md | Feature-specific behavior reference | [Chat and groups](../04-backend/CHAT_AND_GROUPS.md) |
| docs/E2EE_IMPLEMENTATION_MASTER_PLAN.md | Historical implementation plan and pilot evidence; retain detailed history | [E2EE/MLS status](../06-security/E2EE_MLS_STATUS.md) |
| docs/MEDIA_ACCESS_REVOCATION.md | Historical access-revocation specification | [Media access control](../06-security/MEDIA_ACCESS_CONTROL.md) |
| docs/PROFILE_NOTES.md | Feature-specific API note | [Identity and contacts](../04-backend/IDENTITY_AND_CONTACTS.md) |
| docs/SOCO_UI_IMPLEMENTATION.md | Historical UI implementation and QA notes | [Design/accessibility](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md) |

## 3. Platform and engineering documents

| Existing document | Treatment | Canonical successor |
|---|---|---|
| docs/FRONTEND_STRUCTURE.md | Retain as detailed historical structure map; re-check against current source before using | [Frontend architecture](../05-clients/FRONTEND_ARCHITECTURE.md) |
| docs/AI_SKILLS_SETUP.md | Retain as tool-specific setup guidance | [Agent workflow](AGENT_WORKFLOW.md) |
| docs/engineering/FRONTEND_STANDARDS.md | Active project guidance; remains applicable | [Frontend architecture](../05-clients/FRONTEND_ARCHITECTURE.md) |
| docs/engineering/UI_FOUNDATION.md | Active UI implementation guidance; remains applicable | [Design/accessibility](../05-clients/DESIGN_SYSTEM_AND_ACCESSIBILITY.md) |
| docs/engineering/AGENT_FILE_OWNERSHIP.md | Active concurrency and file ownership policy | [Agent workflow](AGENT_WORKFLOW.md) |
| docs/engineering/UI_SKILL_ORCHESTRATION.md | Active UI skill dispatch policy | [Agent workflow](AGENT_WORKFLOW.md) |

## 4. Desktop documents

| Existing document | Treatment | Canonical successor |
|---|---|---|
| docs/desktop/README.md | Historical index; current desktop state is documented separately | [Electron desktop](../05-clients/DESKTOP_ELECTRON.md) |
| docs/desktop/01_PRODUCT_SCOPE.md | Historical PRD; contains planned-state wording that predates implementation | [Electron desktop](../05-clients/DESKTOP_ELECTRON.md), [Feature status](../01-product/FEATURE_STATUS_REGISTER.md) |
| docs/desktop/02_TECH_ARCHITECTURE.md | Historical architecture proposal; reconcile against current Main/Preload source | [Electron desktop](../05-clients/DESKTOP_ELECTRON.md) |
| docs/desktop/03_IMPLEMENTATION_BACKLOG.md | Historical task and batch record | [Quality plan](../07-quality/QUALITY_ASSURANCE_PLAN.md), [Release management](../08-operations/RELEASE_MANAGEMENT.md) |
| docs/desktop/04_QA_RELEASE_GATES.md | Historical gate definition; current commands are in package/workflow source | [CI gates](../07-quality/CI_QUALITY_GATES.md), [Release management](../08-operations/RELEASE_MANAGEMENT.md) |
| docs/desktop/05_AGENT_HANDOFF.md | Historical handoff; retain unchanged | [Agent workflow](AGENT_WORKFLOW.md) |
| docs/desktop/06_BATCH_01_STATUS.md through 10_BATCH_05_STATUS.md | Immutable historical evidence snapshots; statuses are not current without re-verification | [Electron desktop](../05-clients/DESKTOP_ELECTRON.md), [CI gates](../07-quality/CI_QUALITY_GATES.md) |
| docs/desktop/adr/0001-electron-vs-tauri.md | Existing decision record; retain and reference | [Architecture decisions](../09-decisions/README.md) |

## 5. Historical handoffs

The following are retained without rewriting their dated execution results:
- docs/CHATNET_AGENT1_HANDOFF.md
- docs/CHATNET_AGENT2_HANDOFF.md
- docs/agent-handoffs/agent-3/*
- docs/agent-handoffs/agent-4/*
- docs/agent-handoffs/agent-5/*

They are historical evidence only. Any PASS, IN_REVIEW, BLOCKED or NOT RUN result applies to the build, branch, environment and date stated inside the handoff.

## 6. Tài liệu đối chiếu từ checkout chính

Các tệp dưới đây có trong cây nguồn của checkout chính ở SHA ghi tại mục 7 nhưng không có ở baseline tài liệu. They have been restored at their original paths to preserve project knowledge:
- docs/distributed-media-storage/README.md
- docs/distributed-media-storage/CHATNET_DISTRIBUTED_MEDIA_RECOVERY_SPEC.md
- docs/distributed-media-storage/CHATNET_DISTRIBUTED_MEDIA_RECOVERY_QA_MATRIX.md
- docs/distributed-media-storage/CHATNET_DISTRIBUTED_MEDIA_RECOVERY_BA_HANDOFF.md
- docs/engineering/AGENT_FILE_OWNERSHIP.md
- docs/engineering/UI_SKILL_ORCHESTRATION.md

The distributed-media proposal remains **not implemented**, has no verified durability result, and MUST NOT authorize deletion of production S3/R2 objects or real payment.

## 7. Tra cứu hồ sơ lưu trữ

- [README thời MVP](../archive/README_MVP.md) — bản chụp từ baseline. README gốc hiện là cổng vào tài liệu mới.
- Gói ZIP Distributed Media đã có trong checkout nguồn `3664430d8e70afc1e1889c9e86882ca92dffecbc` tại `docs/distributed-media-storage/ChatNet_Distributed_Media_Handoff_2026-11-16.zip`. Repo nguồn giữ nguyên. Worktree docs nhập nội dung Markdown, không tạo bản ZIP trùng.
- [Mục lục lịch sử](../archive/README.md) — các handoff và báo cáo batch vẫn ở đường dẫn cũ để bảo toàn liên kết.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
