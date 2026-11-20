---
document_id: VV-PLAN-001
title: ChatNet Verification and Validation Plan
version: 1.1.0
status: Draft
owner: Quality and Systems Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: IEEE 1012-2024; ISO/IEC/IEEE 29119
---

# ChatNet Verification and Validation Plan

## 1. Purpose

Verification asks whether work products satisfy their specified requirements. Validation asks whether the integrated product satisfies intended user needs in its target environment. ChatNet must report both separately.

## 2. Work products to verify

- Product requirements and acceptance criteria.
- Architecture descriptions and ADRs.
- HTTP and realtime interface contracts.
- Database schema and migration scripts.
- Backend service handlers and authorization policy.
- Web/PWA, Electron and Flutter client behavior.
- Security controls, privacy and data handling.
- Build, deployment and release artefacts.
- Operational runbooks and recovery procedures.

## 3. Verification methods

| Method | Use |
|---|---|
| Inspection | Document structure, source review, configuration review and secret handling |
| Analysis | Architecture consistency, threat analysis, migration risk and traceability |
| Test | Unit, integration, contract, browser, native, security and performance checks |
| Demonstration | User journeys, call flows, native notification and platform UX |

## 4. Validation scenarios

Đối chiếu [bộ ca nghiệm thu](ACCEPTANCE_CASES.md) với [ma trận truy vết](TRACEABILITY_MATRIX.md) trước khi chọn ca. Kết quả kiểm tài liệu không đổi trạng thái test sản phẩm.

- Register, verify, login, refresh, revoke and switch accounts.
- Start direct and group chats; send, edit, delete, react, pin and mark read.
- Upload and retrieve media; revoke access after membership/block changes.
- Create posts, comments, reactions, stories and moderation reports.
- Start/join/leave/end calls on multiple devices.
- Enable and withdraw call translation consent during an active call.
- Use PWA offline fallback and update flow without retaining private pages.
- Use Electron notification, badge, permission and screen-capture workflows.
- Run Flutter auth/chat/navigation on target devices.
- Create a Marketplace pending-payment order without implying payment completion.

## 5. Mức toàn vẹn và độ sâu V&V

Kế hoạch dùng mức toàn vẹn 1–4 theo cách tiếp cận của IEEE 1012. Mức 4 là cao nhất. Định nghĩa và việc gán mức dưới đây là **tailoring của dự án**, do Quality và Engineering đề xuất, chưa được owner phê duyệt.

### 5.1 Thang mức

| Mức | Hậu quả khi lỗi | Ví dụ |
|---|---|---|
| 4 | Lộ dữ liệu riêng tư, vượt xác thực hoặc phân quyền, lộ bí mật, hoặc mất dữ liệu không khôi phục được | Phiên, phân quyền, truy cập media, bridge Desktop |
| 3 | Sai lệch dữ liệu hoặc quyền, khôi phục được nhưng ảnh hưởng nhiều người dùng | Migration, idempotency tin nhắn, chặn người dùng |
| 2 | Tính năng suy giảm hoặc sai, có cách khắc phục | Feed, giao diện, thông báo |
| 1 | Ảnh hưởng thẩm mỹ hoặc tài liệu | Văn bản, bố cục không đổi chức năng |

### 5.2 Gán mức đề xuất theo thành phần

| Thành phần | Mức | Căn cứ | Yêu cầu chính |
|---|---:|---|---|
| Xác thực và phiên | 4 | Vượt xác thực làm lộ mọi dữ liệu của tài khoản | REQ-AUTH-* |
| Phân quyền hội thoại, nhóm, kênh | 4 | Đọc hoặc ghi ngoài quyền | REQ-CHAT-001…016, NFR-SEC-001 |
| Truy cập và thu hồi media | 4 | Lộ tệp riêng tư | NFR-PRIV-001 |
| Consent và luồng dịch cuộc gọi | 4 | Âm thanh rời hệ thống không có đồng ý | REQ-CALL-003/004 |
| Khóa nhà cung cấp AI trong bundle và phản hồi | 4 | Lộ bí mật | REQ-AI-001/002 |
| E2EE/MLS pilot | 4 | Tuyên bố bảo mật sai | [E2EE/MLS](../06-security/E2EE_MLS_STATUS.md) |
| Bridge IPC Desktop | 4 | Năng lực native cho frame không tin cậy | NFR-PLAT-001 |
| Chặn người dùng, riêng tư | 3 | Hạn chế sai làm lộ hoặc cho phép liên lạc không mong muốn | REQ-ID-003/004/008 |
| Migration và toàn vẹn dữ liệu | 3 | Hỏng schema ảnh hưởng toàn hệ thống | NFR-DATA-001/002 |
| Độ tin cậy gửi tin | 3 | Mất hoặc trùng tin | NFR-REL-001/002, REQ-CHAT-014 |
| Marketplace, trạng thái đơn | 3 | Báo sai trạng thái thanh toán | REQ-MKT-003, REQ-ECON-001 |
| Build, phát hành, ký | 3 | Phát hành sai artifact | [Release](../08-operations/RELEASE_MANAGEMENT.md) |
| Feed, Story, bình luận | 2 | Sai quyền xem bài, có cách khắc phục | REQ-FEED-* |
| Trợ năng Web/PWA | 2 | Người dùng không dùng được tính năng | NFR-ACC-* |
| Vận hành và quan sát | 2 | Khó chẩn đoán sự cố | NFR-OBS-* |
| Bảo trì frontend | 2 | Nợ kỹ thuật | NFR-MAINT-001 |
| Tài liệu | 1 | Không đổi hành vi sản phẩm | Các tài liệu 00–09 |

Một thành phần lệch mức khi có yêu cầu P0 thì gán theo mức cao hơn. Mức do owner phê duyệt, không tự suy ra từ bảng này.

### 5.3 Nhiệm vụ tối thiểu theo mức

| Nhiệm vụ | Mức 1 | Mức 2 | Mức 3 | Mức 4 |
|---|:---:|:---:|:---:|:---:|
| Inspection tài liệu và cấu hình | Có | Có | Có | Có |
| Test tự động cho đường chính | | Có | Có | Có |
| Ca âm và ca biên | | | Có | Có |
| Test tích hợp với PostgreSQL/Redis thật | | | Có | Có |
| Phân tích mối đe dọa hoặc rủi ro | | | Có | Có |
| Bằng chứng chạy trên môi trường đại diện (staging) | | | Có | Có |
| Reviewer độc lập với tác giả | | | | Có |
| Review chuyên môn bên ngoài nhóm viết (mật mã, bảo mật) khi áp dụng | | | | Có |
| Kiểm hồi quy sau mỗi thay đổi liên quan | | Có | Có | Có |

## 6. Độc lập

Độc lập có ba chiều: kỹ thuật (người kiểm không phải tác giả), quản lý (báo cáo không qua chủ sản phẩm) và tài chính (ngân sách tách biệt). Kế hoạch này chỉ yêu cầu **độc lập kỹ thuật** ở mức 4. Độc lập quản lý và tài chính chưa được quy định (VV-OPEN-02).

- Mức 4: người xem xét không phải tác giả thay đổi và có chuyên môn phù hợp. Với hành vi mật mã, cần người xem xét giao thức có năng lực, ngoài nhóm viết.
- Mức 3: peer review trong nhóm cùng chuyên môn là đủ.
- Tác giả không tự ghi PASS cho ca mức 4 của chính mình.

## 7. Nhiệm vụ V&V theo giai đoạn vòng đời

| Giai đoạn | Nhiệm vụ V&V | Tài liệu / công cụ | Đầu ra |
|---|---|---|---|
| Yêu cầu | Kiểm chất lượng câu yêu cầu, ID ổn định, ưu tiên và nguồn. Kiểm truy vết hai chiều | [SRS](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md), [ma trận truy vết](TRACEABILITY_MATRIX.md) | Biên bản inspection. Danh sách TBD |
| Kiến trúc và thiết kế | Kiểm nhất quán giữa các view, mỗi mối quan tâm có yêu cầu, ADR có người duyệt | [Kiến trúc](../02-architecture/SYSTEM_ARCHITECTURE.md), [ADR](../09-decisions/README.md), [mô hình mối đe dọa](../06-security/THREAT_MODEL.md) | Bản ghi kiểm nhất quán |
| Cài đặt | Review mã theo mức toàn vẹn. Chạy kiểm tĩnh và kiểm kiến trúc trong CI | [CI gates](CI_QUALITY_GATES.md) | Kết quả CI gắn SHA |
| Kiểm thử | Thiết kế, chạy và ghi ca theo mẫu 29119-3. Giữ chuỗi yêu cầu → ca → lần chạy → bằng chứng | [Test documentation](TEST_DOCUMENTATION.md), [ca nghiệm thu](ACCEPTANCE_CASES.md) | Hồ sơ lần chạy. Báo cáo dị thường |
| Phát hành và vận hành | Smoke trên môi trường đích, kiểm rollback, kiểm lọc bí mật trong bằng chứng | [Release](../08-operations/RELEASE_MANAGEMENT.md), [Vận hành](../08-operations/DEPLOYMENT_AND_OPERATIONS.md) | Hồ sơ rollout |
| Bảo trì | Phân tích tác động thay đổi. Chạy lại các ca mức 3–4 bị ảnh hưởng | [Kiểm soát thay đổi](../00-governance/BASELINE_AND_CHANGE_CONTROL.md) | Hồ sơ hồi quy |

## 8. Báo cáo dị thường

Mọi sai khác giữa kết quả thực tế và kết quả mong đợi được ghi bằng [báo cáo sự cố kiểm thử](TEST_DOCUMENTATION.md#54-báo-cáo-sự-cố-kiểm-thử) và liên kết tới yêu cầu và lần chạy.

| Độ nghiêm trọng | Tiêu chí | Hệ quả cho phát hành |
|---|---|---|
| S1 | Vi phạm bảo mật, riêng tư hoặc toàn vẹn dữ liệu. Hoặc yêu cầu P0 không đạt | Chặn phát hành phạm vi ảnh hưởng |
| S2 | Yêu cầu P1 không đạt, hoặc luồng chính hỏng có cách khắc phục | Chặn nếu thuộc phạm vi phát hành. Nếu hoãn, owner ghi quyết định |
| S3 | Sai nhỏ, không ảnh hưởng yêu cầu bắt buộc | Có thể phát hành kèm danh sách tồn đọng |

Owner chịu trách nhiệm chấp nhận hoặc từ chối từng dị thường được nêu trong tiêu chí thoát. Sự cố chưa phân loại được coi là S1 cho tới khi phân loại.

## 9. Tiêu chí thoát

Cho mỗi phạm vi phát hành:
- yêu cầu đã được baseline;
- bằng chứng xác minh ánh xạ được tới yêu cầu;
- ca âm và ca biên của thành phần mức 3–4 đều PASS;
- dị thường được phân loại S1/S2/S3 và được owner chấp nhận hoặc từ chối;
- rủi ro còn lại và các mục NOT RUN hiển thị rõ;
- đã xác nhận (validation) trên môi trường đích;
- chủ sản phẩm, bảo mật và phát hành ký duyệt.

## 10. Hiện trạng

Tài liệu này là kế hoạch V&V cho sản phẩm. Việc soạn tài liệu không chạy ca nghiệm thu hay kiểm tra triển khai nào. Mọi ca ở [ACCEPTANCE_CASES](ACCEPTANCE_CASES.md) là **NOT RUN**. Báo cáo lịch sử chỉ có giá trị trong baseline và môi trường đã nêu.

## 11. Nội dung chưa có và quyết định mở của kế hoạch

| ID | Nội dung | Owner đề xuất |
|---|---|---|
| VV-OPEN-01 | Phê duyệt thang mức và bảng gán mức ở mục 5 | Quality Engineering, Security |
| VV-OPEN-02 | Độc lập quản lý và tài chính cho thành phần mức 4 | Product, Release owner |
| VV-OPEN-03 | Lịch, nhân sự và công cụ cho từng đợt V&V. Chưa có baseline | QA owner |
| VV-OPEN-04 | Nơi lưu hồ sơ lần chạy và báo cáo dị thường | QA owner |
| VV-OPEN-05 | Người xem xét mật mã độc lập cho pilot E2EE | Security |

Owner ở cột 3 là đề xuất, chưa được xác nhận.

## Bàn giao review tài liệu

Đối chiếu ngày 2026-11-19 tại worktree `docs/ieee-standardization`. Tài liệu mô tả `40c1f1b`, không mô tả checkout phát triển mới hơn. Trạng thái tài liệu vẫn **Draft** cho tới khi owner duyệt. Các kết quả bên dưới chỉ phản ánh đợt kiểm tài liệu, không thay cho tiêu chí thoát ở mục 9.

| Hạng mục | Bằng chứng để review |
|---|---|
| Phạm vi và nguồn | [Baseline và chênh lệch Feed](../00-governance/BASELINE_AND_CHANGE_CONTROL.md#21-chênh-lệch-với-checkout-phát-triển). Đối chiếu chuỗi migration với `Migrate` và danh mục route bằng cặp verb/path ở baseline. |
| Yêu cầu và ca kiểm | [SRS](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md) → [ma trận](TRACEABILITY_MATRIX.md) → [checkpoint](ACCEPTANCE_CASES.md), với liên kết hai chiều giữa SRS và ma trận và phương pháp xác minh riêng. Không gộp phát hiện khi đọc mã vào kết quả chạy. |
| Hợp đồng | [Bản ghi schema và fixture](../03-interfaces/CONTRACT_GOVERNANCE.md#5-verification-record-and-future-quality-gates). OpenAPI đối chiếu ba thao tác và kiểm kê 177 thao tác khác, AsyncAPI mô tả hai loại SSE event. Cả hai đều giới hạn phạm vi. |
| Rủi ro còn mở | [Consent thu hồi](../06-security/AI_AND_CALL_TRANSLATION_PRIVACY.md#4-consent-requirements), [query bearer trên SSE](../03-interfaces/REALTIME_EVENT_CATALOG.md#5-security-and-delivery-notes), [badge trợ năng](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-acc-002) và [script CI Desktop](CI_QUALITY_GATES.md#4-current-workflow-caveats). Đây là các khoảng hở của baseline được ghi để review, không phải các lỗi tài liệu chưa xử lý. |

Khi review cuối, kiểm ba điều: SHA có đúng phạm vi muốn duyệt không, mỗi chính sách/đề xuất có được phân biệt với hành vi nguồn không, và các rủi ro sản phẩm còn mở có chủ phụ trách xem xét không. Không đổi trạng thái từ **NOT RUN** sang **PASS** khi chỉ duyệt nội dung.

## Lịch sử thay đổi

- 1.1.0 (2026-11-19) — Thêm mức toàn vẹn 1–4 và bảng gán đề xuất, độc lập, nhiệm vụ theo giai đoạn, phân loại dị thường S1–S3 và danh sách quyết định mở.
- 1.0.0 (2026-11-19) — Bản nháp đầu tiên theo baseline.
