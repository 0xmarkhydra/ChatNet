# ChatNet / SOCO Desktop — Tài liệu tổng (Source of Truth)

> **Trạng thái tại 30/10/2026: ĐÃ CÓ ELECTRON FOUNDATION TRÊN NHÁNH RIÊNG — CHƯA ĐỦ BETA.**
> Những mục [CHỐT] là quyết định kỹ thuật/sản phẩm; [ĐỀ XUẤT] cần xác nhận hoặc spike; [CHƯA CHỐT] không được tự áp đặt thành chính sách phát hành.

## 1. Bối cảnh và nguyên tắc

- ChatNet/SOCO hiện phát triển **Web/PWA giai đoạn 1**. Desktop là **luồng phát triển riêng / giai đoạn mở rộng**, không thay thế Web/PWA và không mở phạm vi native iOS/Android.
- **[CHỐT]** Sử dụng **Electron + React 19 + TypeScript + Vite** cho vòng triển khai đầu; giữ nguyên **Go/Node services + PostgreSQL + Redis + LiveKit + hệ thống dịch Gemini qua backend**.
- **[CHỐT]** Chia sẻ frontend ở `frontend/` và chỉ bổ sung phần **native shell** tại `desktop/` khi được phép code. **Không clone cả App.tsx**, không dựng API/DB/authorization riêng.
- **[CHỐT]** Giữ brand SOCO xanh `#2563EB`, tím `#8B5CF6`; UI tinh gọn, native cảm giác desktop và responsive khi resize.
- **[CHỐT]** Không đưa Gemini provider key, refresh token plaintext hay privileged IPC vào renderer; việc lưu token an toàn là một hạng mục P0 phải làm trước beta.
- **[CHỐT]** Desktop tích hợp lên `dev` **chỉ khi đã review/test**, không merge `main` hoặc deploy tự động từ nhánh này.

## 2. Tài liệu bắt buộc đọc, theo thứ tự

| Tài liệu | Mục đích | Chủ sở hữu |
|---|---|---|
| [01_PRODUCT_SCOPE.md](01_PRODUCT_SCOPE.md) | Phạm vi P0/P1/P2, luồng sử dụng, những việc chưa làm | BA / Product |
| [02_TECH_ARCHITECTURE.md](02_TECH_ARCHITECTURE.md) | Runtime, bảo mật, IPC, auth, call, notification, offline, packaging | Desktop Tech Lead |
| [03_IMPLEMENTATION_BACKLOG.md](03_IMPLEMENTATION_BACKLOG.md) | Task ID, phụ thuộc, ưu tiên, người làm, acceptance criteria | Thắng/Bắc + Integration Owner |
| [04_QA_RELEASE_GATES.md](04_QA_RELEASE_GATES.md) | Ma trận kiểm thử, release blockers, signing/update/rollback | QA / Agent 5 |
| [05_AGENT_HANDOFF.md](05_AGENT_HANDOFF.md) | Hợp đồng giao việc, quy tắc merge & báo cáo tiến độ | Integration Owner |
| [06_BATCH_01_STATUS.md](06_BATCH_01_STATUS.md) | Báo cáo B01, kiểm thử thực chạy và các blocker Beta | Integration Owner |
| [adr/0001-electron-vs-tauri.md](adr/0001-electron-vs-tauri.md) | Vì sao chọn Electron và điều kiện xem xét lại | Tech Lead |

Nguồn nghiệp vụ đang có:
- `AGENTS.md` — quy tắc code, branch, security.
- `docs/CALL_LIVE_TRANSLATION_WEB.md` — giới hạn bảo mật dịch cuộc gọi, consent, backend Gemini.
- `docs/CHATNET_AI_MARKETPLACE_SPEC.md` — Marketplace chưa chốt Coin/VNĐ, không tự thay đổi nghiệp vụ.
- `docs/CHATNET_POINT_COIN_PRODUCT_SPEC.md` — Point/Coin không tự bổ sung payment native.
- `docs/BLOCK_USER_CROSS_SERVICE_POLICY.md` — chặn user phải thống nhất Chat/Call/Feed.

**Nếu tài liệu cũ ghi “đã hoàn thành” nhưng code/test hiện tại khác, sự thật kỹ thuật phải lấy từ code + test trên nhánh cơ sở.** Không suy diễn trạng thái Desktop từ các hạng mục Web.

## 3. Git / working tree

- Repo: `0xmarkhydra/ChatNet`.
- Branch Desktop: `feat/chatnet-desktop-electron` (tạo từ `dev` tại `c04a044`).
- Worktree: `.worktrees/chatnet-desktop-electron`.
- Nhánh tích hợp: `dev`; nhánh phát hành: `main`.
- Mọi việc Desktop thực hiện trong worktree trên; **không checkout/ghi thay đổi vào worktree gốc** và không nhập ngược vào Web nếu không có test bảo vệ.
- Có thể tách nhánh con theo task từ branch Desktop; PR vào branch Desktop trước khi Integration Owner đề nghị PR sang `dev`.
- File tài liệu trạng thái phải là bằng chứng của commit/CI/test; chỉ đổi task sang DONE khi vượt điều kiện nghiệm thu và gắn commit/PR.

## 4. Mốc triển khai đề xuất (không phải tiến độ thực tế)

| Cột mốc | Mục tiêu | Exit gate |
|---|---|---|
| D0 — Docs & ADR | Chốt scope, ADR, backlog, owner, QA | Bộ tài liệu nhất quán, Git riêng |
| D1 — Spike (tuần 1) | Shell thử nghiệm; auth/media/LiveKit trên Win & Mac | Kết quả spike ghi PASS/FAIL, chọn đường build |
| D2 — Alpha (tuần 2–4) | Chat, outbox, call, dịch, tray, notification | P0 smoke + automated checks đạt |
| D3 — Internal Beta (tuần 5–6) | Signing, build, updater, UX, security hardening | Gating tại 04_QA_RELEASE_GATES |
| D4 — Public Beta (tuần 7–8) | UAT 2 OS, rollback, telemetry tối thiểu | Owner duyệt, release có ký |

Ước lượng 6–8 tuần với **2 dev full-time + QA/Integration Owner hỗ trợ** là **ước tính ban đầu**, chỉ chốt sau spike.

## 5. Điểm cần phê duyệt trước public Beta

1. Chứng chỉ ký Windows và tài khoản Apple Developer/notarization; không có thì chỉ phát hành bản internal/test có cảnh báo rõ ràng.
2. Kênh phát hành cập nhật: GitHub Releases private/public hoặc object storage có quyền truy cập/kiểm soát.
3. Phiên bản Windows/macOS tối thiểu dựa trên kiểm thử thiết bị thật; Linux chưa thuộc P0.
4. Các chức năng “luôn chạy nền”, auto-start, multi-instance và audio khi chia sẻ màn hình chỉ bật theo chính sách đã kiểm thử; không mặc định âm thầm ghi âm.
5. **Marketplace thanh toán Coin hay VNĐ vẫn chưa chốt**. Desktop không được tự quyết.

## 6. Quy tắc trạng thái và sửa đặc tả

Dùng trạng thái: `NOT_STARTED`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, `DONE`. `DONE` cần link bằng chứng: commit + kết quả test + người review. Docs cập nhật qua commit riêng; thay đổi kiến trúc phải viết ADR và xin duyệt trước khi đổi runtime/backend/auth.

**Hiện tại:** B01 có Electron nền tảng; B02 đã tích hợp Main-only credential vault/auth, native tray/window lifecycle và adapter dùng chung React. Xem [07_BATCH_02_STATUS.md](07_BATCH_02_STATUS.md) để phân biệt unit/fixture, backend PostgreSQL/Redis thật, packaged macOS smoke và các gate NOT RUN/BLOCKED. Electron hiện pin 45.1.0 (macOS 13+), Vite 7.3.7 sau xử lý audit dependency. Chưa đủ beta; không báo toàn bộ Desktop P0 là đã hoàn thành.