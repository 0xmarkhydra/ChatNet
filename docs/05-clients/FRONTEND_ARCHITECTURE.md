---
document_id: WEB-ARC-001
title: ChatNet Frontend Architecture
version: 1.0.0
status: Draft
owner: Web Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 42010:2022"
---

# ChatNet Frontend Architecture

## Tóm tắt

App sở hữu điều hướng, feature sở hữu logic, shared dành cho phần không gắn domain, platform che khác biệt môi trường. Chặn phản hồi cũ cập nhật nhầm phiên khi switch tài khoản.

## 1. Technology baseline

The Web and shared Desktop renderer use React 19, TypeScript 5.9, Vite 7.3.7, React Router 7, Tailwind CSS 4 and Lucide React. Vitest, Testing Library/browser fixtures and Playwright are used by the existing frontend test toolchain.

## 2. Application composition

- frontend/src/main.tsx creates the React root and applies the application router.
- frontend/src/app/App.tsx composes the signed-out Auth screen or the authenticated application tree.
- frontend/src/app/AuthedApp.tsx owns the authenticated shell.
- frontend/src/app/providers/ provides session-scoped dependencies and shared authenticated context.
- frontend/src/app/router/ owns route parsing and top-level navigation.
- frontend/src/platform/ contains platform adapters such as the Desktop bridge.
- frontend/src/shared/ contains feature-independent UI, contexts, types and utilities.
- frontend/src/features/ owns domain behavior and feature-specific API adapters.

## 3. Feature modules

The source baseline has these feature areas:

| Feature | Responsibility |
|---|---|
| auth | Registration/login, session management and E2EE device/key utilities |
| calls | Call lifecycle, room UI, media controls, consent and translation |
| chat | Conversations, messaging, groups, channels, media, search, read state and E2EE pilot UI |
| contacts | Friends, contacts and social graph |
| discover | Discovery and marketplace UI |
| feed | Social posts, comments, stories and interactions |
| i18n | Localization and translation support |
| notifications | In-app and push notification UI |
| profile | Profile and visitor profile surfaces |
| pwa | Install/update/offline behavior |
| settings | User and application settings |

## 4. Route model

Top-level tabs:
- /chat
- /contacts
- /discover
- /marketplace
- /feed
- /profile
- /notifications

Additional route families:
- /calls
- /settings
- /users/{username} for visitor profiles
- /feed/posts/{id} for shareable post detail
- /chat/{id} for shareable conversation detail

The app router owns route parsing and tab selection. Feature components own their business state and API calls.

## 5. Dependency direction

The mandatory frontend standard defines:
- app may compose features;
- features may depend on shared;
- shared and platform must not import app or feature modules;
- cross-feature imports go through the owning feature's public index.ts;
- backend calls belong in the owning feature's api/ layer or an established shared transport;
- UI components must not add ad-hoc domain fetch calls.

Architecture checks are implemented in frontend/scripts/architecture-boundaries-check.mjs and its self-check.

## 6. State and session ownership

The application distinguishes local UI state, URL state, session/auth state and server state. Authenticated providers are keyed by session identity. Async reads must account for cancellation, request ordering and session identity so stale responses cannot leak data across accounts. Mutations must preserve idempotency and outbox semantics.

## 7. Styling and design ownership

Tailwind CSS v4 utilities and SocCO semantic tokens are available. Tailwind Preflight is deliberately disabled while legacy CSS remains. Existing theme, feature CSS and source-owned shared UI components remain authoritative.

See [Design system and accessibility](DESIGN_SYSTEM_AND_ACCESSIBILITY.md) and the active engineering standards in docs/engineering/.

## 8. Quality controls

The frontend package exposes:
- lint ratchet and ESLint report;
- Vitest unit/component tests;
- architecture boundary check;
- TypeScript typecheck and Vite build;
- feature-specific browser/logic checks for sessions, chat, outbox, media, calls, translation, notifications, PWA, accessibility-adjacent UI and responsive layout.

See [Test strategy](../07-quality/TEST_STRATEGY.md) and [CI gates](../07-quality/CI_QUALITY_GATES.md).

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
