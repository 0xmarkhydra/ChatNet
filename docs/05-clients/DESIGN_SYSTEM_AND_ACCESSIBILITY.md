---
document_id: UX-STD-001
title: SocCO Design System and Accessibility
version: 1.0.0
status: Draft
owner: Product Design and Frontend Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: WCAG 2.2; ISO/IEC 25010:2023
---

# SocCO Design System and Accessibility

## Tóm tắt

Tái sử dụng semantic token và component có sẵn. Kiểm keyboard, focus, touch, zoom và reduced motion. Ảnh chỉ xác nhận bố cục nhìn thấy, không thay thế kiểm cây trợ năng.

## 1. Design system source of truth

The current Web/Desktop renderer uses:
- Tailwind CSS v4 theme and utilities;
- SocCO semantic CSS variables and theme styles;
- source-owned shared UI components under frontend/src/shared/ui;
- feature-specific CSS where existing screens have not migrated;
- Lucide React icons;
- motion and responsive styles owned by the project.

The active guidance is docs/engineering/FRONTEND_STANDARDS.md and docs/engineering/UI_FOUNDATION.md.

## 2. Tailwind and CSS constraints

Tailwind Preflight is deliberately disabled while legacy CSS remains. Do not enable global reset behavior or replace all feature CSS as an unrelated task. New UI should use semantic tokens for colors, spacing and shadows where available.

The shared UI source is project-owned and shadcn-compatible. Review generated component changes before applying them; do not run initialization or token-generation commands that overwrite project theme choices.

## 3. Component and interaction rules

- Use shared Button, Input, Textarea, Dialog and Dropdown Menu components where appropriate.
- Keep focus management and keyboard behavior in accessible primitives.
- Keep feature-specific business state in its owning feature.
- Preserve responsive layout at mobile and desktop breakpoints.
- Avoid unnecessary animation, layout shifts and decorative motion that obscures status or content.
- Respect reduced-motion preferences where motion is not essential.
- Use consistent icon semantics and accessible labels.

## 4. Accessibility baseline

WCAG 2.2 is the target reference for Web/PWA accessibility. Relevant concerns include:
- keyboard operability and visible focus;
- accessible name, role and value for interactive controls;
- semantic headings and landmarks;
- contrast and non-color status indicators;
- touch target sizing;
- dialog focus trapping and restoration;
- screen-reader announcements for changing unread counts, call state and validation errors;
- captions/transcripts and controls for media where applicable.

At the baseline, the visual unread badge is separate from the accessible label in [desktop-width navigation](../../frontend/src/app/navigation/AppSidebar.tsx) and [mobile-width navigation](../../frontend/src/app/navigation/BottomNavigation.tsx). The code does not include the unread count in the button's accessible name or description. See [NFR-ACC-002](../01-product/SOFTWARE_REQUIREMENTS_SPECIFICATION.md#nfr-acc-002). This is a static source finding, not an assistive-technology test result.

This document does not claim WCAG conformance. A criterion-level audit with test evidence is required before such a claim.

## 5. Visual QA

A visual PASS requires:
- target viewport and browser/device recorded;
- screenshot or video evidence;
- comparison to approved design reference;
- clipped, overlapping and misaligned content review;
- responsive and zoom checks;
- keyboard/focus review;
- relevant screen-reader or accessibility-tree evidence.

TypeScript build and unit tests do not establish visual acceptance.

## 6. Design change control

A new global theme, token set, icon system or component primitive requires review against existing SocCO styles and product direction. UI skills and external design generators provide suggestions only; they do not override approved user requirements or source-owned theme decisions.

## 7. Related documents

- [Frontend architecture](FRONTEND_ARCHITECTURE.md)
- [Web/PWA](WEB_PWA.md)
- [Electron Desktop](DESKTOP_ELECTRON.md)
- [Frontend standards](../engineering/FRONTEND_STANDARDS.md)
- [UI foundation](../engineering/UI_FOUNDATION.md)

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
