---
document_id: GOV-DOC-001
title: Documentation Control and Policy
version: 1.0.0
status: Draft
owner: ChatNet Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 15289:2019"
---

# Documentation Control and Policy

## Tóm tắt

Tài liệu chính thức có ID ổn định, owner, SHA nguồn và trạng thái riêng. Khi sửa hành vi trong tài liệu, phân biệt yêu cầu đã chốt, hành vi thấy trong source và bằng chứng chạy. Dùng [mẫu tài liệu](DOCUMENT_TEMPLATE.md) để tránh bỏ sót.

## 1. Purpose

This document defines how ChatNet engineering documents are identified, authored, reviewed, maintained and retired. The structure is adapted from ISO/IEC/IEEE 15289 information-item concepts and the lifecycle and quality processes in ISO/IEC/IEEE 12207 and IEEE 730.

This is a project documentation policy, not a reproduction of any copyrighted standard and not a certification statement.

## 2. Scope

The policy applies to product requirements, architecture descriptions, interface contracts, backend/client design, security, quality assurance, operations, runbooks and architecture decisions stored under docs/. It also applies to the root README.md where that file is used as the project entry point.

It does not turn historical handoffs, test output, issue descriptions or proposals into normative requirements.

## 3. Document identification

Each canonical specification, policy, plan, runbook or decision MUST have a unique `document_id` and the following control metadata.

| Field | Meaning |
|---|---|
| document_id | Stable identifier, e.g. ARC-SYS-001 |
| title | Human-readable title |
| version | Document revision in MAJOR.MINOR.PATCH form |
| status | Draft, In Review, Approved, Superseded or Archived |
| owner | Responsible engineering discipline |
| baseline_commit | Source commit used to establish implementation facts |
| last_updated | Date of last content change |
| normative_basis | Applicable standards and project policies |

Use the following ID prefixes:

| Prefix | Discipline |
|---|---|
| GOV | Governance and document control |
| PRD / REQ / UC | Product, requirements and use cases |
| ARC / ADR | Architecture and decisions |
| API / EVT | HTTP APIs and asynchronous events |
| BE / DB | Backend and data |
| WEB / DESK / MOB / UX | Client platforms and user experience |
| SEC / PRIV | Security and privacy |
| QA / TC / VV | Quality, test cases and V&V |
| OPS / REL | Operations and release |

IDs are stable across renames. Do not reuse an ID after a document is retired.

### 3.1 Navigation, machine-readable contracts and retained records

| File class | Control rule |
|---|---|
| Root README and navigation-only `README.md` files | No individual document ID or YAML header required. Link to the governing portal, controlled document or historical register. The portal identifies the documentation set, draft status and inherited source baseline. A README that becomes a canonical specification or runbook follows the full metadata rule. |
| Machine-readable OpenAPI and AsyncAPI files | Use the format's native `info` fields and `x-source-baseline`. The [contract governance document](../03-interfaces/CONTRACT_GOVERNANCE.md) controls ownership, scope and approval. |
| Archived evidence and legacy handoffs | Preserve original content and provenance. Use the [legacy register](LEGACY_DOCUMENT_REGISTER.md) for classification and any successor. |
| Existing repository-wide engineering policy and specialist guidance outside the numbered collection | Keep their original control format. If incorporated into the canonical collection, assign full metadata to the numbered successor and identify the relationship in the legacy register. |

## 4. Status vocabulary

| Status | Definition |
|---|---|
| Draft | Authored but not approved as the project source of truth |
| In Review | Submitted for technical/product review |
| Approved | Explicitly approved by the accountable owner |
| Superseded | Replaced by a named successor; retained for history |
| Archived | Historical record retained without active normative force |

Implementation status MUST be recorded separately from document status. Use Implemented, Partially Implemented, Experimental/Pilot, Proposed, Blocked, Not Implemented, Tested, Deployed and Production Ready only where source or execution evidence supports the claim.

## 5. Normative language

Uppercase MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, MAY and OPTIONAL are used in the RFC 2119 / RFC 8174 sense only when written in uppercase. A recommendation is not an implemented control.

Each requirement MUST be:
- uniquely identified;
- singular and testable;
- traceable to one or more design/code/test artefacts;
- assigned a priority and verification method;
- marked with its source or decision authority.

## 6. Authoring and review rules

1. Write Vietnamese explanatory prose where it improves team comprehension; preserve English identifiers, protocol names, source symbols and standards titles.
2. Prefer one discipline and one primary purpose per file. Split documents when they serve materially different audiences or change at different rates.
3. Use relative links within the repository and stable source paths. Avoid machine-specific absolute paths except in local-development instructions.
4. Distinguish verified implementation facts, product decisions, proposals, assumptions and open questions.
5. Cite exact source files and symbols for implementation claims. Cite test names and evidence for verification claims.
6. Never place credentials, API keys, access tokens, production user data or unredacted logs in documentation.
7. Do not claim a security property from a design intention alone. Document limitations and residual risks.
8. Keep historical handoffs immutable where they are evidence of past work. Register their current successor instead of silently rewriting their historical result.

## 7. Change control

A document change SHOULD identify:
- reason for change;
- affected requirement/architecture/API/test IDs;
- source commit or issue/decision;
- compatibility and migration implications;
- reviewer and approval status.

Changes that alter product behavior, security policy, API compatibility, financial rules or production operations require the relevant owner decision. Documentation alone does not authorize implementation, deployment, data deletion or financial activity.

## 8. Review checklist

- [ ] Document ID and metadata are present, or the file meets a documented exception in §3.1.
- [ ] Scope, audience and status are explicit.
- [ ] Facts are grounded in the stated source baseline.
- [ ] Proposed and implemented behavior are clearly separated.
- [ ] Normative requirements are testable and traceable.
- [ ] Links and references resolve.
- [ ] Security-sensitive values and personal data are absent.
- [ ] Reviewer and approval state are recorded.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
