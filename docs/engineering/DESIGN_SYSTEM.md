# SocCO frontend design system — v1

**Status:** Normative for new/modified UI. Adoption is incremental; this document does **not** authorize a bulk redesign of legacy screens.

## Authority and integration

Read [FRONTEND_STANDARDS.md](FRONTEND_STANDARDS.md), [UI_SKILL_ORCHESTRATION.md](UI_SKILL_ORCHESTRATION.md), and [UI_FOUNDATION.md](UI_FOUNDATION.md). User-approved screens/Penpot and the existing SocCO palette take precedence over generic skill suggestions. Implement tokens in `frontend/src/styles/soco-theme.css` and map them for Tailwind v4 in `frontend/src/styles/tailwind.css`. Tailwind Preflight stays disabled. Reuse `shared/ui` and Lucide. Do not install a competing UI kit or global CSS reset.

## Font family and typesetting

- **Primary:** `var(--soco-font-sans)` = system UI stack starting with Apple system font, then SF Pro Text, Segoe UI, Arial and sans-serif. This requires no network font download and supports Vietnamese via system fallback.
- **Monospace:** `var(--soco-font-mono)`, for technical identifiers, logs and code only. Avoid monospace in body text.
- Do not declare a second global font stack, invent feature-local fonts, or assume that SF Pro Text is present on Windows.
- Token sizes (CSS px): caption **12**, label **13**, body **14**, subtitle **16**, section **18**, page **20**, display **24**. Use `--soco-type-*` or `text-ui-*`. Keep `font-weight` purpose-driven: body 400, label 500–600, section 600–700, page 700. Avoid 800+ outside brand/rare emphasis.
- Line-height: heading `--soco-leading-tight: 1.25`, body `--soco-leading-normal: 1.5`, long-form `--soco-leading-relaxed: 1.65`. Vietnamese diacritics must not clip.
- Headings reflect semantic hierarchy (`h1` → `h2` → `h3`); visual size is not a replacement for semantic headings. Prefer one page title per route. Don't apply a 24px heading to every section.
- Allow text zoom to 200%, wrapping and long Vietnamese labels. Don't force `white-space: nowrap` or ellipses on essential actions. Mobile form inputs may need **16px minimum** to avoid Safari focus zoom even when the rest of UI uses 14px.

## Spacing and density

`--soco-space-{1,2,3,4,5,6,8}` = **4, 8, 12, 16, 20, 24, 32px**. Corresponding Tailwind utilities use `ui-` names (e.g. `gap-ui-3`, `p-ui-4`), while native Tailwind scale remains supported.

- Within a control: 4–8px. Item/list row: 8–12px. Card interior: 12–16px. Between sections: 20–24px. Main page gutter: 16px mobile, 20–24px desktop unless an approved design uses other values.
- Density modes: **compact** for chat lists/data-dense desktop areas, **balanced** as default, **comfortable** for feed/long-form. Density changes spacing, not label readability or mobile touch target.
- Do not set arbitrary `height: 100vh`/global fixed-height wrappers; each route declares one vertical scroll owner and works on short screens, mobile keyboard and safe areas.

## Shape, controls and icons

- Radius tokens: sm **8px** (chips), md **12px** (buttons/inputs), lg **16px** (panels), xl **22px** (brand cards). Use the token, not a novel radius per component.
- Control heights: sm **36px** (dense desktop only), md **40px**, touch **44px**. Primary mobile interactive targets should be **at least 44 × 44px**, including icons. Spacing around compact visual icons can expand the actual hit target.
- Tailwind aliases: `h-control-sm` / `h-control-md` / `h-control-touch` and `size-control-md` map to the existing control-height tokens. `size-icon-sm` / `size-icon-md` / `size-icon-lg` map to the 16/20/24px icon tokens. Height tokens name a *dimension*, not permission to use a 36px mobile touch target.
- Icon sizes: **16, 20, 24px** for compact, default, prominent. Use the same Lucide stroke conventions and align icon centers with text baselines. All icon-only buttons need an accessible name.
- Avoid arbitrary icon scaling or oversized title/action chrome.

## Color and meaning

Existing identity is **Indigo/Blue-violet**. Use semantic tokens first:

| Role | Token |
| --- | --- |
| Primary action, focus and selected | `--soco-blue` / `bg-primary` |
| Supporting accent | `--soco-violet` |
| Canvas / surface | `--soco-canvas` / `--soco-surface` |
| Text / muted | `--soco-text` / `--soco-muted` |
| Border | `--soco-line` |
| Success / warning / danger / information | `--soco-success` / `--soco-warning` / `--soco-danger` / `--soco-info` |

- Additional opt-in surfaces preserve existing colors rather than restyling screens: `bg-surface-input` = `#f8fafe`, `bg-surface-page` = `#f7f9fd`, and `border-border-subtle` = `#e8ecf5`. Use `bg-card`, `bg-background`, `border-border` when their semantic role matches instead; do not automatically replace visually similar colors. These surface values are **not** global background replacements.
- Feed like/reaction is not a primary action color: preserve the approved `#ee416a` / `#fff2f6` as `text-reaction-like` / `bg-reaction-like-hover` (source: `--soco-reaction-*`), never collapse it into `primary`.
- Selected states must be distinguishable beyond color (indicator, contrast, icon, weight or accessible state). Do not use violet/blue/orange indiscriminately as arbitrary decoration.
- Contrast goals: normal text **≥ 4.5:1**, large text **≥ 3:1**; focus visibly distinct; check actual layered gradient/glass backgrounds. The semantic status colors are **text/icon hues**, not automatically accessible background/foreground combinations. Validate contrast before creating status fills.
- Use accessible hover, focus-visible, active, selected, loading, disabled, empty, error and retry states. Do not signal validation errors through color alone.
- Dark mode is not automatically enabled by these light-mode tokens. Any dark theme needs a coherent semantic override, contrast QA and approval; no isolated feature-local inversion.

## Elevation, motion and layers

- `--soco-shadow-sm`: subtle control/card; `--soco-shadow-md`: elevated card; `--soco-shadow-overlay`: popover/dialog. Most content surfaces should be flat or lightly elevated.
- Use `--soco-motion-fast` **120ms**, `normal` **200ms**, `slow` **320ms** for noncritical UI transitions. Animate opacity and transform where possible, not layout geometry.
- Obey `prefers-reduced-motion`; never hide content behind an entrance animation. Glass is reserved for nav/overlays, not large scrolling data panels. Provide an opaque fallback.
- Shared layering must keep dropdowns above sticky headers and dialogs above dropdowns; use existing shell/portal z-index conventions rather than introducing arbitrary large values.

## Responsive and component contract

Reference viewport checks: mobile **390px** (also 320px minimum), tablet **768px**, desktop **1024/1440px**, plus short-height and **200% zoom**. These are QA points, not permission to invent new layout breakpoints. Preserve existing responsive breakpoints unless approved.

New UI uses `frontend/src/shared/ui/` source-owned shadcn/Radix controls when appropriate, Tailwind utilities and semantic tokens; legacy CSS remains until screen-specific migration. Every reusable component documents variants, size, disabled/loading/focus behavior, keyboard semantics, scroll ownership (when applicable), and screen-reader name.

## Example

```tsx
<section className="rounded-ui-lg bg-card p-ui-4 shadow-ui-sm">
  <h2 className="font-sans text-ui-section font-semibold leading-tight text-foreground">Lời mời kết bạn</h2>
  <p className="mt-ui-2 text-ui-body leading-normal text-muted-foreground">Danh sách lời mời mới</p>
</section>
```

## Adoption and quality gate

1. New/changed UI: reuse existing token/component first. Exceptions for a genuine design requirement must be **named and justified in the PR**, not silently duplicated.
2. Do **not** mass-replace all hardcoded CSS or alter current screens merely to satisfy the scale. Start with new components and change existing ones only within a reviewed visual scope.
3. Evaluate before/after screenshots and interactions on representative routes, screen states, keyboard navigation, focus, scroll and touch. Validate Vietnamese labels, reduced motion, zoom and contrast.
4. Run lint, architecture, unit, build and relevant UI browser tests on the merge candidate. Report PASS/FAIL/NOT RUN/BLOCKED explicitly.
5. Follow [AGENT_FILE_OWNERSHIP.md](AGENT_FILE_OWNERSHIP.md). Tokens and shared components require a single coordinating writer. Avoid editing other agents' in-progress files.
6. Run `npm run check:design-system` for the dedicated gate. The regular `npm run build` also enforces the gate. It validates token mappings, the no-Preflight policy, and rejects hardcoded color/font/typography/spacing declarations in newly added `src/shared/ui/*.css` files.
7. Existing `bubble-textarea.css`, `connection-tools.css`, `media-viewer.css` and `reaction-participants.css` are explicitly grandfathered to preserve the accepted legacy UI. Do not expand this exception list without a documented migration decision. Feature CSS is governed by review/visual QA for now; this is **not** a full repository-wide arbitrary-value ban.