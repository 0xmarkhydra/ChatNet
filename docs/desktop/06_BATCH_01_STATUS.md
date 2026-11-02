# SOCO Desktop — Batch B01 implementation handoff (30/10/2026)

**Worktree:** `.worktrees/chatnet-desktop-electron`
**Branch:** `feat/chatnet-desktop-electron`
**Base:** `dev@c04a044`
**Mục tiêu:** DSK-001/002/003 foundation + DSK-004 LiveKit compatibility investigation, không làm app beta.

## 1. Đã viết mã trong B01

| Task | Kết quả kỹ thuật | Trạng thái |
|---|---|---|
| DSK-001 | Tạo `desktop/` Electron Main/Preload, package/lockfile, builder, chế độ `build:desktop` dùng chung frontend | **IN_REVIEW** — macOS arm64 packaged smoke PASS; Windows NOT RUN |
| DSK-002 | `app://soco` packaged assets, CSP, context isolation/sandbox, IPC allowlist, chặn popup/navigation, media permission restrictions, 3 test security | **IN_REVIEW** — security unit PASS; full threat review NOT RUN |
| DSK-003 | React dùng chung, `frontend/src/platform/desktop.ts`, disable OneSignal Web SDK + PWAUpdate trong Desktop build | **IN_REVIEW** — Web & Desktop build PASS, full parity NOT RUN |
| DSK-004 | Phát hiện backend WebSocket dịch LiveKit chỉ cho Web Origin; bổ sung allowlist **duy nhất** `app://soco`, kèm negative test; không thay one-time ticket | **BLOCKED — LIVE CALL NOT RUN** (cần 2 user, macOS và Windows thiết bị thật) |
| DSK-005 | electron-builder `--dir` build macOS arm64 unsigned, GitHub Actions matrix nền tảng Mac/Windows; publish disabled | **IN_PROGRESS** — ký / notarization / Win installer NOT RUN |
| DSK-006 | Tập hợp chứng cứ & blocker ở file này; Integration Owner tiếp tục review | **IN_REVIEW** |

**Không có task desktop nào được tuyên bố `DONE` chỉ từ build unit/smoke.**

## 2. Kiểm thử đã thực thi ở Mac worktree

| Check | Kết quả | Minh chứng |
|---|---|---|
| Desktop IPC/policy | PASS | `cd desktop && npm test` — 3/3 |
| Desktop React bundle | PASS | `cd frontend && npm run build:desktop` — TS/Vite |
| macOS arm64 unsigned package | PASS | `cd desktop && CSC_IDENTITY_AUTO_DISCOVERY=false npm run build` — `desktop/release/mac-arm64/SOCO.app` |
| Packaged GUI smoke | PASS | `cd frontend && node scripts/desktop-shell-smoke.mjs` — `app://`, React root nonempty, preload IPC, Node unavailable |
| Web/PWA TS/Vite build | PASS | `cd frontend && npm run build` |
| Web auth/session tests | PASS | `npm run check:session` |
| Web chat persistence/outbox tests | PASS | `npm run check:chat` + `npm run check:outbox` |
| Backend tests | PASS | `cd backend && go test ./...` gồm origin restriction |
| Windows packaged smoke | NOT RUN | Chỉ có macOS được thử ở worktree này |
| 2-account LiveKit call / Gemini stream | NOT RUN | Cần end-to-end staging, consent và thiết bị thật |
| Signing & notarization / real updater | NOT RUN | Chưa có credentials / release channel |
| Desktop secure refresh vault | **BLOCKED FOR BETA** | Web hiện còn lưu session trong renderer localStorage; DSK-007 chưa làm |
| Native OS notification/tray | NOT RUN | Bắt đầu DSK-011/016 ở batch sau |

## 3. Tập tin và API thay đổi

- `desktop/src/main.cjs`: packaged `app://` static serving; Electron webPreferences, browser permissions, navigation/popup denial.
- `desktop/src/preload.cjs`: `window.socoDesktop.getPlatformInfo`, `openExternal` (https host allowlist); không expose Node/FS.
- `desktop/src/ipc-policy.cjs` + `desktop/test/security.test.cjs`: validate source/link/path, negative tests.
- `desktop/package.json` + lockfile: `electron`, `electron-builder`, unsigned internal build only; no publishing.
- `frontend/src/platform/desktop.ts` + `frontend/src/main.tsx`: Desktop adapter, stop PWAUpdate for desktop mode.
- `frontend/src/features/notifications/onesignal.ts`: Desktop mode không tải OneSignal Web SDK; native notifications còn pending.
- `frontend/package.json`: `build:desktop` dựa chung React.
- `frontend/scripts/desktop-shell-smoke.mjs`: GUI packaged smoke.
- `backend/cmd/call/translation.go` + `translation_test.go`: origin `app://soco` cho translation WSS, vẫn bắt buộc ticket một lần + consent theo code hiện có.
- `.github/workflows/desktop-foundation-ci.yml`: matrix macOS/Windows, build và unit tests; **CI remote chưa được xác nhận** cho tới khi chạy trên GitHub.

## 4. Các rủi ro còn tồn đọng

1. **P0 release blocker:** refresh token lưu theo cơ chế Web trong `localStorage`; cần secure vault và session adapter trước beta.
2. Chưa test webcam/mic/LiveKit screen share trong packaged Win/Mac hai account; permission handler mới chỉ là nền tảng.
3. `app://soco` đã được allowlist server-side cho translation, nhưng branch chưa merge/deploy backend; production API hiện chưa có đổi mới này.
4. Native push, badge, click-to-conversation chưa có; Web SDK đã disable ở Desktop để không load mã bên thứ ba vào privileged environment.
5. Build macOS hiện dùng icon Electron mặc định, binary chưa ký/notarize; Windows/Intel chưa kiểm tra; không phát hành bản này cho khách hàng.
6. Desktop `app://` dùng chung renderer hiện tại; CSP còn cho phép kết nối `https:`/`wss:` để media hoạt động. Trước beta cần security hardening theo danh sách domain thực.
7. Unit tests/smoke chưa đủ chứng minh mọi tính năng Web/PWA đầy đủ.

## 5. Bước tiếp (B02)

1. Thắng: **DSK-007** secure credentials vault/session adapter, sau đó **DSK-011** tray/window lifecycle và permissions.
2. Bắc: **DSK-008/009/010** auth/chat/outbox thật trong packaged app, không làm lại Web logic.
3. Thắng + Bắc: DSK-004 call real hardware smoke macOS + Windows, auth + backend staging; test origin mới, Gemini consent; fix nếu thất bại.
4. Agent 5: review IAM/CSP/IPC, GitHub Actions CI, PR; tuyệt đối **không** cho merge `dev` / `main` hoặc phát hành khi P0 release blockers chưa xử lý.

**Lưu ý vận hành:** `desktop/release/` là bản build nội bộ được gitignored, không có đường dẫn phân phối công khai. CI chỉ build/test; không upload unsigned installers hay tạo release tự động.