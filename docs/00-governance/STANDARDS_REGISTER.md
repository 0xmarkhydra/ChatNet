---
document_id: GOV-STD-001
title: Standards Register and Tailoring Profile
version: 1.1.1
status: Draft
owner: Engineering Governance
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 15289:2019"
---

# Standards Register and Tailoring Profile

## Tóm tắt

Dùng 29148 cho yêu cầu, 42010 cho mô tả kiến trúc, 12207 và 15289 cho hồ sơ vòng đời, 730 và 1012 cho chất lượng/V&V, 29119 cho kiểm thử. Các mục dưới đây là hồ sơ áp dụng có chọn lọc, không tuyên bố chứng nhận.

## 1. Purpose

This register identifies the external standards and specifications used to shape ChatNet documentation and engineering practice. The register distinguishes normative standards from supporting technical specifications and security/accessibility guidance.

**Important:** adopting a document structure or checklist does not establish certification, independent conformance, or compliance. A formal assessment would require a defined scope, evidence, competent assessors and recorded findings.

## 2. Primary software and systems engineering standards

| Reference | Current published edition/status | ChatNet application |
|---|---|---|
| ISO/IEC/IEEE 29148:2018 | Active | Requirements engineering, requirement quality, SRS and traceability |
| ISO/IEC/IEEE 42010:2022 | Active | Architecture descriptions, stakeholders, concerns, viewpoints and models |
| ISO/IEC/IEEE 12207:2026 | Active; published 2026-04-15 | Software lifecycle process tailoring across development, maintenance and retirement |
| IEEE 730-2026 | Active; published 2026-08-21 | Software quality assurance planning, controls and evidence |
| IEEE 1012-2024 | Active; published 2025-08-22 | Verification and validation activities and independence appropriate to risk |
| ISO/IEC/IEEE 15289:2019 | Active published edition | Purpose/content of lifecycle information items and documentation |
| ISO/IEC 25010:2023 | Published, Edition 2 | Product quality model used to structure non-functional quality concerns |

### 2.1 Software testing series

| Reference | Edition | Use |
|---|---:|---|
| ISO/IEC/IEEE 29119-1 | 2022 | Testing concepts and vocabulary |
| ISO/IEC/IEEE 29119-2 | 2021 | Test processes |
| ISO/IEC/IEEE 29119-3 | 2021 | Test documentation |
| ISO/IEC/IEEE 29119-4 | 2021 | Test design techniques |

### 2.2 Standards currency note

- IEEE 12207-2026 supersedes the 2017 edition.
- IEEE 730-2026 supersedes IEEE 730-2014.
- IEEE/ISO/IEC 42010-2022 supersedes 42010-2011.
- As checked on 2026-11-19, [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html) remains the published edition. [ISO/IEC/IEEE DIS 29148](https://www.iso.org/standard/94091.html) is a draft replacement and is not the basis of the current SRS.
- [ISO/IEC/IEEE 15289:2019](https://www.iso.org/standard/74909.html) remains the published edition. [ISO/IEC/IEEE DIS 15289](https://www.iso.org/standard/94699.html) is a draft replacement and does not supersede the published edition. Recheck the issuing bodies before changing either reference.
- ISO/IEC/IEEE 29119-1 is edition 2022; Parts 2, 3 and 4 are edition 2021. Do not label the entire series as 2021.

## 3. Supporting interface, security and accessibility specifications

| Reference | Status / edition | ChatNet application |
|---|---|---|
| OpenAPI Specification 3.2.1 | Published specification | Mô tả HTTP. [Đặc tả](../03-interfaces/openapi.json) gồm ba thao tác đối chiếu và 177 thao tác kiểm kê route chưa có schema. Không thay thế danh mục route đầy đủ. |
| AsyncAPI Specification 3.1.0 | Published specification | [Hợp đồng phạm vi giới hạn](../03-interfaces/realtime.asyncapi.json) chỉ mô tả hai payload sự kiện SSE. |
| IETF RFC 9110 | Internet Standard | HTTP semantics, methods, status codes and idempotency considerations |
| IETF RFC 9420 | Proposed Standard | Messaging Layer Security (MLS) protocol reference for the E2EE pilot |
| IETF RFC 9846 | Proposed Standard, July 2026 | Current TLS 1.3 specification; supersedes RFC 8446 |
| OWASP ASVS 5.0.0 | Stable release, 2025-05-30 | Web/API security verification requirements and control review |
| W3C WCAG 2.2 | W3C Recommendation, 2024-12-12 | Accessibility requirements for Web/PWA interfaces |

These references supplement, but do not replace, the primary lifecycle, requirements, architecture, quality and V&V standards.

## 4. Tailoring for ChatNet

| Discipline | Required application |
|---|---|
| Product and requirements | Maintain a testable SRS, stable requirement IDs, source authority and acceptance criteria |
| Architecture | Maintain context, container/service, deployment and data viewpoints; record decisions as ADRs |
| Interfaces | Maintain a source-derived route catalog now; create a validated OpenAPI description only after request/response schemas are verified |
| Security | Maintain threat boundaries, trust assumptions, abuse cases, access controls and residual risks |
| Testing | Link requirements to test conditions, test cases, executions and evidence; never infer PASS from source presence |
| Operations | Maintain reproducible local setup, environment contract, deployment topology, release controls and recovery procedures |
| Accessibility | Use WCAG 2.2 as the target reference; record tested criteria and known gaps instead of claiming blanket conformance |

## 5. Official references

1. [ISO/IEC/IEEE 29148:2018 — Requirements engineering](https://standards.ieee.org/ieee/29148/6937/)
2. [ISO/IEC/IEEE 42010-2022 — Architecture description](https://standards.ieee.org/ieee/42010/6846/)
3. [ISO/IEC/IEEE 12207-2026 — Software life cycle processes](https://standards.ieee.org/ieee/12207/11416/)
4. [IEEE 730-2026 — Software quality assurance processes](https://standards.ieee.org/ieee/730/10854/)
5. [IEEE 1012-2024 — Verification and validation](https://standards.ieee.org/ieee/1012/7324/)
6. [ISO/IEC/IEEE 15289-2019 — Lifecycle information items](https://standards.ieee.org/ieee/15289/7196/)
7. [ISO/IEC 25010:2023 — Product quality model](https://www.iso.org/standard/78176.html)
8. [ISO/IEC/IEEE 29119-1:2022](https://www.iso.org/standard/81291.html), [29119-2:2021](https://www.iso.org/standard/79428.html), [29119-3:2021](https://www.iso.org/standard/79429.html), [29119-4:2021](https://www.iso.org/standard/79430.html)
9. [OpenAPI Specification](https://spec.openapis.org/oas/v3.2.1.html)
10. [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html), [RFC 9420 — MLS](https://www.rfc-editor.org/rfc/rfc9420.html), [RFC 9846 — TLS 1.3](https://www.rfc-editor.org/rfc/rfc9846.html)
11. [OWASP ASVS 5.0.0](https://asvs.owasp.org/)
12. [WCAG 2.2](https://www.w3.org/TR/wcag/)

13. [AsyncAPI 3.1.0](https://www.asyncapi.com/blog/release-notes-3.1.0) — tham chiếu cho [hợp đồng sự kiện SSE giới hạn](../03-interfaces/realtime.asyncapi.json).

## 6. Review cadence

The owner SHOULD review this register at least once per major documentation revision and whenever a referenced standard is superseded, withdrawn or materially revised. Standards status is checked against the issuing organization, not inferred from third-party summaries.

## 7. Bản ghi đối chiếu với bên phát hành

Đối chiếu ngày 2026-11-19 bằng cách mở trang của bên phát hành. Kết quả ghi theo trang, không theo bản tóm tắt của bên thứ ba, trừ khi nêu rõ.

| Tham chiếu | Điều trang phát hành ghi | Kết quả so với mục 2 và 3 |
|---|---|---|
| IEEE/ISO/IEC 12207-2026 | Active, công bố 2026-04-15, thay thế IEEE 12207-2017 | Khớp |
| IEEE 730-2026 | Active, công bố 2026-08-21, thay thế IEEE 730-2014 | Khớp |
| IEEE 1012-2024 | Active, công bố 2025-08-22, thay thế 1012-2016 | Khớp |
| IEEE/ISO/IEC 42010-2022 | Active, công bố 2022-11-07, thay thế 42010-2011 | Khớp |
| IEEE/ISO/IEC 29148-2018 | Active, công bố 2018-11-30. Trang liệt kê dự án sửa đổi P29148 ở dạng Draft International Standard, chưa phải ấn bản đã công bố | Khớp |
| IEEE/ISO/IEC 15289-2019 | Active, công bố 2019-07-19. Dự án P15289 còn ở dạng draft | Khớp |
| RFC 9846 | Proposed Standard, tháng 7 năm 2026, obsolete RFC 8446 | Khớp |
| RFC 9420 | Proposed Standard, tháng 7 năm 2023 | Khớp |
| OpenAPI Specification 3.2.1 | Có trên trang spec.openapis.org, ngày 10 tháng 9 năm 2026 | Khớp |
| AsyncAPI 3.1.0 | Ghi chú phát hành ngày 2026-01-31 | Khớp |
| OWASP ASVS 5.0.0 | Stable release, 2025-05-30 | Khớp |
| W3C WCAG 2.2 | Recommendation, 2024-12-12. Trang có ghi chú errata | Khớp |
| ISO/IEC 25010:2023 | Trang `committee.iso.org`: Edition 2, Published (stage 60.60), công bố 2023-11-15, thay 25010:2011 đã rút. Trang IEC webstore cũng ghi 2023-11-15 | Khớp |
| ISO/IEC/IEEE 29119-1:2022 | Trang `committee.iso.org`: Edition 2, Published, stage 60.60 ngày 2022-02-04, thay bản 2013 đã rút | Khớp |
| ISO/IEC/IEEE 29119-2:2021 | Trang `committee.iso.org`: Edition 2, Published, 2021-10-28 | Khớp |
| ISO/IEC/IEEE 29119-3:2021 | Trang `committee.iso.org`: Edition 2, Published, 2021-10-28, thay bản 2013 đã rút | Khớp |
| ISO/IEC/IEEE 29119-4:2021 | Trang `committee.iso.org`: Edition 2, Published, 2021-10-28, thay bản 2015 đã rút | Khớp |

Trang `www.iso.org` trả HTTP 403 khi mở tự động. Các mục ISO được đọc qua `committee.iso.org`, là trang của chính ISO với cùng số tiêu chuẩn. Ngoài ra có 29119-5:2024 và TR 29119-6, không dùng ở đây.

## Lịch sử thay đổi

- 1.1.1 (2026-11-19) — Cập nhật mục 7: các mục ISO được đọc qua trang của ISO.
- 1.1.0 (2026-11-19) — Thêm mục 7: bản ghi đối chiếu số hiệu và ngày với bên phát hành.
- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
