# SOCO Desktop — Implementation Backlog v1

**Cập nhật B04 — 31/10/2026:** DSK-016/017 = IN_REVIEW: notification native giữ riêng tư, badge theo tổng server, click xác minh lại auth/membership, focus/read receipt, notification call lifecycle. 59/59 native policy tests + React contract fixtures + backend PG/Redis integration + packaged negative IPC smoke PASS. DSK-021/022 parity UI thực tế vẫn IN_PROGRESS. Xem `09_BATCH_04_STATUS.md`, gồm contract backend bổ sung chưa deploy và các gate NOT RUN/BLOCKED. Không task mới DONE.

**Cập nhật 31/10/2026 — B03:** DSK-014 = IN_PROGRESS; DSK-018/019 = IN_REVIEW; DSK-004/015/020 = BLOCKED ở nghiệm thu media thật. B03 đã có permission broker, chọn nguồn screen video-only, chuyển mic/camera và guards lifecycle. 49/49 Desktop tests, Web regression, backend DB integration và packaged macOS smoke PASS; không thay thế UAT hai thiết bị. Xem `08_BATCH_03_STATUS.md`. Không task nào mới DONE.

**Cơ sở:** `dev@c04a044` · **Nhánh triển khai:** `feat/chatnet-desktop-electron`
**Trạng thái 30/10/2026 sau B02:** DSK-000 = DONE; DSK-001/002/003/006/007/008/011 = IN_REVIEW; DSK-004 = BLOCKED (chưa UAT LiveKit hai thiết bị); DSK-005/009/010/012/013 = IN_PROGRESS. Các task còn lại = NOT_STARTED cho đến báo cáo batch tương ứng. Bằng chứng B01: `06_BATCH_01_STATUS.md`; B02: `07_BATCH_02_STATUS.md`. Chưa có task Desktop mới nào được đánh dấu DONE; chưa đủ điều kiện merge/release.

B02 đã tích hợp vault/Main-only auth, bridge React, tray/window lifecycle, text-draft persistence và kiểm thử bảo vệ Web. Native macOS smoke + 32 unit tests PASS; backend integration với PostgreSQL/Redis dùng một lần PASS. Login/chat/call hai thiết bị, Windows, signing và update/rollback chưa được UAT. Xem báo cáo B02 để phân biệt test fixture, test backend thật và smoke hệ điều hành.
**Nhân sự đề xuất:** Thắng = Desktop Platform / Native; Bắc = React / API integration; Agent 5 = review, CI, security, UAT, integration. Phân công có thể đổi khi có quyết định team.

## Quy ước task và Definition of Done

- `P0` chặn public beta; `P1` nên làm trong beta nhưng có thể phát hành sau nếu không phá nghiệp vụ; `P2` backlog.
- Mỗi task có **output code**, test tự động/điều kiện smoke rõ ràng, link commit/PR, review và không làm hỏng `npm run build` của Web.
- `NOT_STARTED → IN_PROGRESS → IN_REVIEW → DONE`, hoặc `BLOCKED`. Không đi thẳng từ IN_PROGRESS sang DONE khi chưa có test.
- QA ghi PASS/FAIL/NOT RUN/BLOCKED theo `04_QA_RELEASE_GATES.md`; build đơn thuần không chứng minh microphone, notification, auto-update hoạt động trên máy thật.

## Giai đoạn D0 — Chuẩn bị (docs-only)

| ID | Priority | Owner | Task / Output | Điều kiện nghiệm thu |
|---|---|---|---|---|
| DSK-000 | P0 | Integration Owner | Branch riêng từ dev, docs PRD/ADR/architecture/backlog/QA/handoff | Worktree độc lập, commit docs-only; không sửa Web/PWA, không merge dev |

## Giai đoạn D1 — Technical Spike / Foundation (tuần 1)

| ID | P | Owner | Phụ thuộc | Phạm vi | Acceptance Criteria |
|---|---|---|---|---|---|
| DSK-001 | P0 | Thắng | DSK-000 | Dựng `desktop/` electron-vite/builder + scripts | app khởi động Win/Mac từ packaged assets, không mở trình duyệt web bên ngoài; Web build vẫn PASS |
| DSK-002 | P0 | Thắng | 001 | Electron Main + Preload IPC contract + CSP/security | sandbox/isolated, IPC typed và hạn quyền, chặn navigation nguy hiểm, kiểm tra sender, negative tests |
| DSK-003 | P0 | Bắc | 001 | Adapter platform dùng chung React | không copy UI/business code, Web/PWA không bị thay đổi behavior, bundle desktop có thể route vào App |
| DSK-004 | P0 | Thắng+Bắc | 002–003 | Spike LiveKit media + permissions trên macOS/Windows | 2 account thật join call, mic/camera hoạt động ở binary packaged, lỗi permission có UX |
| DSK-005 | P0 | Thắng | 002 | Spike release pipeline + code signing/updater | build Win/mac targets, mô tả blocking certificate và artifact scheme, proof đơn giản từ smoke |
| DSK-006 | P0 | Agent 5 | 001–005 | Chốt đo đạc và quyết định kỹ thuật | ADR findings, PASS/FAIL/risks, estimate re-baseline; không bypass blockers |

**Gate D1:** nếu DSK-004 FAIL trên một OS, không “chuyển full parity” hoặc tuyên bố có LiveKit Desktop. Tạo issue root cause/fallback trước D2.

## Giai đoạn D2 — Identity, Chat, Desktop UX (tuần 2)

| ID | P | Owner | Phụ thuộc | Phạm vi | Acceptance Criteria |
|---|---|---|---|---|---|
| DSK-007 | P0 | Thắng | 002 | Secure credential vault + session bridge | refresh token chỉ trong OS-protected store, logout/revoke clear; không fallback plaintext |
| DSK-008 | P0 | Bắc | 003,007 | Auth adapter/login/OTP/refresh/revoke dùng chung | 2 sessions Web/Desktop, revoke máy khác -> 401/UI logout, no regressions Web |
| DSK-009 | P0 | Bắc | 003,008 | Danh sách và giao diện chat desktop | 1:1/nhóm, hội thoại, search, reaction, edit/recall, media thật qua API |
| DSK-010 | P0 | Bắc | 008,009 | Offline queue & reconnect từ code hiện có | mất mạng, restart app, lost ACK, cùng clientId, zero duplicate, user thấy trạng thái |
| DSK-011 | P0 | Thắng | 001 | Window, tray, close behavior, saved bounds, startup | show/hide/quit đúng, không mất window khi đổi monitor, single-instance |
| DSK-012 | P1 | Bắc | 009 | Desktop layout, keyboard and basic file drag/drop | không tràn 1024×768, focus/shortcuts, metadata file đúng API, không mở path tùy tiện |
| DSK-013 | P0 | Agent 5 | 007–011 | Auth/chat regression | automated + test 2 account thật, Web/PWA CI vẫn PASS |

**Gate D2:** logout/revoke/blocked user không thể còn đọc offline content cũ; queue không lộ giữa account.

## Giai đoạn D3 — Calls, AI & Native Notifications (tuần 3–4)

| ID | P | Owner | Phụ thuộc | Phạm vi | Acceptance Criteria |
|---|---|---|---|---|---|
| DSK-014 | P0 | Bắc | 004,008 | Call UI 1:1/nhóm, thiết bị, ringtone, reconnect | nhận/từ chối, mute/camera, gọi khi minimized, call quality chấp nhận |
| DSK-015 | P0 | Bắc | 014 | AI translation call + transcript/tab | speaker consent rõ ràng, 1 nút dịch, Gemini chỉ ở backend, 2–5 speaker test |
| DSK-016 | P0 | Thắng | 011 | OS notifications + unread badge/tray | visible/minimized chính xác, không double báo, không ping khi mở lịch sử |
| DSK-017 | P0 | Bắc | 009,016 | Notification adapter từ SSE và điều hướng | bấm notification mở đúng chat sau auth/membership, không sai account |
| DSK-018 | P0 | Thắng | 002,014 | OS camera/mic permission handlers | prompt khi user tương tác, denial UX, macOS plist/entitlements đúng |
| DSK-019 | P1 | Thắng+Bắc | 014,018 | Screen share cửa sổ/màn hình qua LiveKit | macOS/Windows permission UX, source picker, khi deny không crash; system audio không hứa khi chưa test |
| DSK-020 | P0 | Agent 5 | 014–018 | UAT call/translation/notify | call 2/nhóm, minimized, sleep/wake, no provider key leak; evidence matrix |

**Gate D3:** LiveKit và dịch thật phải test 2 máy / mạng khác nhau; fake SDK/mock API không thay cho UAT.

## Giai đoạn D4 — Feature parity & Release (tuần 5–6)

| ID | P | Owner | Phụ thuộc | Phạm vi | Acceptance Criteria |
|---|---|---|---|---|---|
| DSK-021 | P0 | Bắc | 008–010 | Friends/Profile/Feed/Story/Privacy parity | nghiệp vụ đang hoạt động trên Web có mặt, block cross-service đúng |
| DSK-022 | P1 | Bắc | 021 | Marketplace parity với backend hiện có | không giả lập Coin/VNĐ hay checkout đã thanh toán; feature flag rõ |
| DSK-023 | P0 | Thắng | 005,011 | Build macOS arm64/x64 + Windows x64 | installer clean install/uninstall, no Node dependency, OS prompts đúng |
| DSK-024 | P0 | Thắng | 023 | Signing, Apple notarization, release manifest | artifact ký/được verify, hash và provenance, không upload secret |
| DSK-025 | P0 | Thắng | 024 | Auto-updater, channel beta/stable, rollback | update kiểm thử từ bản N→N+1, giữ phiên/queue, failed update recovery |
| DSK-026 | P0 | Agent 5 | 021,023–025 | Security review XSS/IPC/auth/signed update | negative IPC tests, CSP, security checklist pass; không mở external URL unsafe |
| DSK-027 | P0 | Agent 5 | 026 | Regression/Performance CI cross-OS | matrix đầy đủ và proof CI/runner; crash/OOM đều log và xử lý |

## Giai đoạn D5 — Beta (tuần 7–8)

| ID | P | Owner | Phụ thuộc | Phạm vi | Acceptance Criteria |
|---|---|---|---|---|---|
| DSK-028 | P0 | Agent 5 | 020,027 | UAT 2 OS + release candidate | không còn P0, QA signed install/upgrade, call 2 máy, user flows |
| DSK-029 | P0 | Thắng | 028 | Phát hành beta qua kênh được duyệt | link build, checksum, changelog, rollback plan, crash monitoring |
| DSK-030 | P0 | Agent 5 | 029 | Theo dõi, xử lý regression, báo cáo | log bug/owner/ETA, rollback khi auth/message failure |
| DSK-031 | P1 | Bắc | 028 | Polish UX, screen-reader, shortcut nâng cao | keyboard smoke, focus, right-click, tooltips, UI theo brand |

## Task chưa vào beta đầu (P2)

| ID | Owner | Đề xuất |
|---|---|---|
| DSK-032 | Thắng | Linux AppImage/deb |
| DSK-033 | Thắng+Bắc | Multi-window / multi-account đồng thời |
| DSK-034 | Bắc | Quick reply native và message rich preview |
| DSK-035 | Thắng | Auto-start tại login theo opt-in |
| DSK-036 | Thắng+Bắc | Screen share system audio mọi OS sau benchmark |

## Luồng dependency trọng yếu

```text
000 (Docs)
 └─ 001 (Shell) ── 002 (IPC Security) ── 007 (Vault) ── 008 (Auth) ── 009 (Chat) ── 010 (Outbox)
        ├─ 003 (Frontend adapter) ───────────┘                    └─ 021 (Social)
        ├─ 004 (LiveKit spike) ── 014 (Call) ── 015 (Translation) ── 020 (Call QA)
        ├─ 011 (Tray) ── 016 (Native notify) ── 017 (Chat click)
        └─ 005 (Release spike) ── 023 (Installer) ── 024 (Signing) ── 025 (Updater)
                                                              └─ 026–028 (Release gates)
```

## Quy trình làm việc và điều phối

- **Thắng (Platform)** chỉ sở hữu `desktop/src/main`, `desktop/src/preload`, builder/CI/release configs, permission/tray. Không chỉnh trực tiếp UI React nếu Bắc đang làm, trừ thay đổi có thỏa thuận.
- **Bắc (App)** sở hữu adapter dùng chung, UI/feature integrations, LiveKit UX và realtime; không expose Node API ở renderer.
- **Integration Owner** review và merge PR trong Desktop branch; chịu trách nhiệm bảo vệ Web/PWA CI, security gate và release. Hai dev không tự push thẳng `dev`/`main`.
- Thay đổi backend chỉ làm khi chứng minh app hiện tại thiếu contract; bắt buộc mở issue, được Integration Owner duyệt và có test.
- Cập nhật bảng task/Google Sheet (nếu đồng bộ): giữ nguyên ID `DSK-xxx`, owner, status, PR, QA evidence, blocked reason; không ghi DONE chỉ vì branch đã merge.

**Bắt đầu code hợp lệ** sau khi bộ docs D0 được commit: **DSK-001, DSK-002, DSK-003 và DSK-004 spike**, không triển khai full app trực tiếp trong một PR.