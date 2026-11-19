---
document_id: WEB-PWA-001
title: ChatNet Web and PWA
version: 1.0.0
status: Draft
owner: Web Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# ChatNet Web and PWA

## Tóm tắt

Kiểm cập nhật, offline và notification theo trình duyệt. Service worker không được giữ API riêng tư theo phiên. Một build thành công không chứng minh khả năng cài PWA hay push trên thiết bị thật.

## 1. Build and runtime

The Web client is a React/TypeScript application built with Vite. Vite runs locally on port 5173 and can proxy /api requests to a configured API origin. Production build emits the SPA assets and a versioned service worker.

The Web application is served by Nginx in the frontend container. Nginx proxies API and streaming requests to the backend Gateway.

## 2. Service worker behavior

frontend/public/sw.js defines a build-specific cache name. It precaches the offline page, web manifest and public icons. During activation it removes older ChatNet caches and claims clients.

The fetch policy is deliberately restrictive:
- navigation requests are network-first and fall back to the offline page;
- API requests are not cached;
- media URLs and URLs containing query parameters are not cached;
- requests with Authorization headers are not cached;
- only explicitly public files and fingerprinted build assets may enter the runtime cache;
- user-specific HTML and authenticated pages are not retained across logout/account switch.

This behavior supports a safe public-asset cache and offline fallback. It does not establish a complete offline messaging or background-send guarantee.

## 3. Update flow

Vite emits the service worker with a unique build identifier. The PWA update component and check:pwa script cover update signaling. The browser still controls service-worker lifecycle and installation behavior; browser/device acceptance is required.

## 4. Push notifications

The frontend integrates push configuration/subscription endpoints and OneSignal initialization. The Chat service exposes push config, subscription create/delete and test operations. Provider delivery depends on OneSignal configuration and browser permission.

A local test fixture does not prove actual push delivery to every browser, installed PWA or terminated device.

## 5. API and media behavior

The frontend uses feature-owned API modules and the shared transport. Media upload and clipboard image proxy behavior are routed through backend capability checks. Signed URLs and authorization headers must not be written to public caches or logs.

## 6. Responsive and accessibility requirements

Web/PWA is expected to work across mobile and desktop viewport sizes. Responsive layout, keyboard navigation, accessible names, focus management, contrast and reduced-motion behavior require their own test evidence. A successful build is not visual or accessibility acceptance.

Use WCAG 2.2 as the target reference. Do not claim blanket conformance without a completed criterion-level assessment.

## 7. Verification commands

From frontend/:
- npm run lint
- npm run test:unit
- npm run build
- npm run check:pwa
- npm run check:session
- npm run check:offline-browser
- npm run check:onesignal
- npm run check:incoming-sound

The package contains many additional feature-specific checks. See TEST_CATALOG.md for grouping. These commands were not executed as part of this documentation task.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
