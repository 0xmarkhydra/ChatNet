# SOCO Desktop — Agent Handoff / Execution Contract

**Áp dụng cho toàn bộ agent và dev trong** `feat/chatnet-desktop-electron`.
**Status 30/10/2026:** B01 foundation và B02 native-auth/window integration đã có code trên nhánh riêng. Đọc `07_BATCH_02_STATUS.md` trước khi tiếp tục: ghi bằng chứng build/unit/backend integration/native macOS và các gate còn NOT RUN/BLOCKED. Không phải giấy chứng nhận đủ điều kiện phát hành.

**Bàn giao B02:** vault + broker Main-only đã nối IPC/preload/React; renderer không lưu refresh/access credential trong localStorage. Tray, bounds, close-choice, text draft và outbox scope đã tích hợp. Đã sửa validation ép kiểu của vault và đảm bảo vẫn thử revoke server khi xóa vault lỗi. Giữ nguyên API/backend/Marketplace. Cần UAT login/revoke/chat/call thật, Windows, signed installers và updater trước signoff. Không áp dụng gói WIP cũ đè lên worktree mới.

**Lệnh kiểm thử bổ sung:** `npm --prefix frontend run check:desktop-session`; `node frontend/scripts/desktop-shell-smoke.mjs` (tạo profile QA mới, không dùng profile thật); `node desktop/scripts/backend-integration.cjs` (Docker dùng một lần, loopback, tự dọn). Không diễn giải các fixture tests thành bằng chứng nghiệp vụ thật.

## 1. Prompt chuẩn cho mọi dev/agent

> Bạn là kỹ sư triển khai SOCO Desktop, làm việc **chỉ** trên branch `feat/chatnet-desktop-electron` hoặc branch con được gán, trong worktree Desktop độc lập.
>
> Trước khi sửa: đọc `AGENTS.md`, `docs/desktop/README.md`, PRD, architecture, backlog, QA gates và các specs ChatNet liên quan. Kiểm tra `git status` + commit nền. Tôn trọng file của agent khác.
>
> Mục tiêu: Desktop Electron macOS/Windows dùng chung React Web/PWA và Go/Node API; **không copy Web App, không tự dựng backend, không expose Node hoặc Gemini key trong renderer**.
>
> Chỉ xử lý task có ID được giao, có tests và evidence. Task chưa đủ hợp đồng API phải báo BLOCKED kèm lý do thay vì mock success. Không tự merge vào `dev`/`main`, không push force, không deploy hoặc chỉnh secrets.
>
> Sau mỗi batch: báo task IDs, file thay đổi, commit, tests thực chạy và PASS/FAIL/NOT RUN/BLOCKED, issue tồn đọng, ảnh hưởng Web/PWA, PR để Integration Owner review.

## 2. Phạm vi rõ ràng theo người phụ trách

### Thắng — Desktop Platform / Native

- Ưu tiên task: DSK-001/002/005/007/011/016/018/023/024/025.
- Mã chính khi triển khai: `desktop/src/main/**`, `desktop/src/preload/**`, `desktop/electron-builder.yml`, desktop CI, native assets, permission, tray, installer.
- Chịu trách nhiệm sandbox/CSP/IPC/auth vault/chữ ký/updater. Mọi bridge method phải có typed contract, validation và security tests.
- Không thay đổi nghiệp vụ Auth/Chat/Feed server hoặc UI Web nếu không có PR review chéo.

### Bắc — React / Desktop Feature Integration

- Ưu tiên task: DSK-003/008/009/010/012/014/015/017/021/022.
- Mã chính: phần shared frontend/adapter, giao diện Desktop, kết nối API, LiveKit, translation UI, state/sync.
- Không tạo duplicate chat store, HTTP client hoặc token flow. Web/PWA vẫn build & chạy đúng; giữ chức năng đã có như Marketplace và Point/Coin specs.
- Với auth/onboarding, phối hợp Thắng về contract auth vault trước khi dùng bất kỳ storage native nào.

### Agent 5 — Integration Owner / QA

- Ưu tiên task: DSK-000/006/013/020/026/027/028/030.
- Review PR xung đột React+Electron, release gates, signed builds, security, CI, test Win/Mac thật.
- **Người duy nhất** nhập Desktop vào `dev` sau review; release sang `main` chỉ khi được chủ dự án cho phép.
- Nếu task đánh DONE nhưng thiếu test/hardware proof, đổi lại IN_REVIEW/BLOCKED. Không claim 100% trước UAT.

## 3. Branch và PR policy

- Base: `origin/dev` tại commit có ghi rõ ở PR; feature Desktop ban đầu từ `c04a044`. Nếu base dev cập nhật, rebase/merge vào branch Desktop theo kế hoạch review, không ghi đè commit của dev khác.
- Các PR nhỏ: `desktop/feature-shell`, `desktop/auth-vault`, `desktop/chat-outbox`, `desktop/livekit-media`, `desktop/native-notifications`, `desktop/release-pipeline`; tên là ví dụ, không mặc định đã tồn tại.
- File chung frontend/ phải có review của Bắc và Agent 5; file IPC/auth phải có review của Thắng và Agent 5.
- Docs/task cập nhật cùng PR; task DONE chỉ có commit hash, tests, owner/reviewer, QA link.
- Merge xung đột: ưu tiên bảo toàn backend auth/security, idempotency, permission & functional parity; không chọn `--ours`/`--theirs` một cách máy móc.
- Release nhánh phát hành/cherry-pick/rollback phải có approval rõ ràng, không implicit.

## 4. Task kick-off theo tuần

| Batch | Người xử lý | Task | Bàn giao |
|---|---|---|---|
| B01 | Thắng | DSK-001 + DSK-002 | Electron shell sandbox + typed IPC + test |
| B01 | Bắc | DSK-003 | React adapter và Web parity tests |
| B01 | Cả hai | DSK-004 | LiveKit packaging spike Win/Mac, ghi PASS/FAIL |
| B01 | Agent 5 | DSK-005/006 | Build/release feasibility, ADR update, rủi ro |
| B02 | Thắng | DSK-007/011 | Auth vault + native lifecycle |
| B02 | Bắc | DSK-008/009/010 | Auth/chat/outbox integration |

Mỗi batch là **đề xuất**, cần phát triển tuần tự theo dependency; không bắt đầu DSK-014/015 trước khi spike LiveKit packaged đạt.

## 5. Báo cáo mẫu sau mỗi batch

```text
SOCO Desktop / Bxx
Base: <commit>
Branch: <branch>
Changed files: <paths>
Tasks:
  DSK-xxx — IN_REVIEW (PR #...)
Tests:
  frontend build: PASS/FAIL/NOT RUN
  backend tests: PASS/FAIL/NOT RUN
  desktop build macOS: ...
  desktop build Windows: ...
  packaged call: ...
Security notes:
  - ...
Blockers:
  - ...
Next: DSK-...
Merge dev: NO (chờ Agent 5)
Release main: NO
```

## 6. Những trường hợp phải dừng

- Không có quyền/không thể xác minh OS secure storage hoặc Electron renderer còn giữ refresh token plaintext.
- Chưa có certificate/signing profile nhưng muốn public beta.
- Gọi video/translation không chạy trong bản packaged, hoặc consent sai.
- P0 Web/PWA regression sau sửa shared React.
- Chưa có backend endpoint thật mà muốn fake UI đã thanh toán/đã đăng sản phẩm.
- Repo có dirty work của agent khác/còn conflict: không reset/clean để giải quyết nhanh.

**Lưu ý:** Tài liệu này chỉ giao trách nhiệm và quy trình. Không đồng nghĩa agent được tự động giao việc hay thực thi khi chưa bắt đầu coding.
