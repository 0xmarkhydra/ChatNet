---
document_id: ADR-0001
title: Electron cho bản Desktop đầu tiên
version: 1.0.0
status: Draft
owner: Desktop Architecture
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# Electron cho bản Desktop đầu tiên

## Quyết định ghi nhận

[ADR gốc](../desktop/adr/0001-electron-vs-tauri.md) chọn Electron **cho spike ban đầu**. Baseline có shell trong [desktop](../../desktop/package.json), nhưng điều đó không mở rộng quyết định lịch sử thành phê duyệt phát hành.

| Phương án | Đánh đổi |
|---|---|
| Electron | Dùng chung React/Vite, Chromium tương đối đồng nhất và LiveKit đang có. Đổi lại, phải duy trì runtime và bộ cài lớn hơn |
| Tauri 2 | Bộ cài nhỏ hơn, nhưng cần chứng minh WebView, WebRTC và media permissions theo từng OS |
| Native từng OS | Tích hợp nền tảng trực tiếp, nhưng ít tái sử dụng renderer và tăng chi phí |

[Main](../../desktop/src/main.cjs) giữ thao tác đặc quyền. [Preload](../../desktop/src/preload.cjs) cung cấp bridge hẹp cho [adapter có kiểu](../../frontend/src/platform/desktop.ts). Xem lại runtime nếu đo được blocker media hoặc mức dùng tài nguyên vượt mục tiêu đã duyệt. Đối chiếu [Desktop](../05-clients/DESKTOP_ELECTRON.md) và [release](../08-operations/RELEASE_MANAGEMENT.md).

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Bản nháp đầu tiên theo baseline.
