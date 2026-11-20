---
document_id: MOB-ARC-001
title: ChatNet Flutter Client
version: 1.0.0
status: Draft
owner: Mobile Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# ChatNet Flutter Client

## Tóm tắt

Source Flutter và demo là hai nguồn bằng chứng khác nhau. Khi nối backend local, dùng define được đọc trong source. Không mặc định parity hệ điều hành, push native hay phát hành store.

## 1. Source and support status

The repository contains a Flutter client under mobile/. The package is named soco, version 1.0.0+1, with Dart SDK constraint ^3.11.0. Source presence does not establish official store publication, production support or complete parity with Web/Desktop.

## 2. Application structure

| File/module | Responsibility |
|---|---|
| main.dart | Flutter bootstrap, API creation and session restoration |
| app.dart | Signed-in/signed-out composition and localization |
| api.dart | HTTP client, API URL, secure session storage and request helpers |
| auth_screen.dart | Email/OTP registration and authentication UI |
| home_shell.dart | Main tab navigation |
| chat_screen.dart | Conversations, messages and chat interactions |
| contacts_screen.dart | Contacts/friends |
| discover_screen.dart | Discovery and nearby surfaces |
| feed_screen.dart | Social feed |
| profile_screen.dart | Profile |
| call_surface.dart | Call UI |
| group_tools.dart | Group tools |
| media_viewer.dart | Media display |
| notification_sheet.dart | Notification UI |
| localization.dart / language_picker.dart | Localization and language selection |
| theme.dart / widgets.dart | UI theme and shared widgets |

The home shell defines Chat, Contacts, Discover, Feed and Profile tabs.

## 3. API configuration

The API client reads compile-time values:
- API_URL, defaulting to the configured ChatNet API origin;
- WEB_URL, defaulting to the ChatNet web origin.

The API URL must use HTTPS except for approved local development hosts. The client uses Flutter Secure Storage for the saved session and the HTTP package for requests.

[README Flutter cũ](../../mobile/README.md) còn dùng `SocCO_API_BASE_URL`. Scope này không sửa file ngoài docs và README gốc. Cách chạy theo [api.dart](../../mobile/lib/api.dart) dùng `API_URL` và `WEB_URL`. Ví dụ khi backend local thực sự sẵn sàng trên cổng 8080: `flutter run -d chrome --dart-define=API_URL=http://localhost:8080`.

## 4. Dependencies

The current pubspec includes Flutter Secure Storage, HTTP, file picker, share_plus, MIME helpers, URL launcher, QR, geolocation, video_player, flutter_map, latlong2 and mobile_scanner.

These packages indicate source-level platform capabilities; they do not establish permission, privacy, platform-store or production acceptance.

## 5. Demo behavior

The repository includes a DemoApi implementation in mobile/lib/demo.dart. Demo behavior is local fixture data and must be clearly distinguished from a server-backed authenticated session. Do not use demo content as evidence of backend functionality.

## 6. Build and test

The mobile README documents:
- flutter pub get;
- flutter run for local development;
- dart analyze;
- flutter test;
- flutter build web --release.

The API define must match the current API_URL source contract. Platform-specific Android/iOS signing, store listing, permission descriptions, release automation and physical-device acceptance require separate verification.

## 7. Verification status

The current source inventory includes mobile/test/widget_test.dart. No Flutter test or release build was executed as part of this documentation task.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
