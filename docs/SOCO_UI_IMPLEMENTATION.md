# SOCO UI 1.0 — Full application styling integration

Branch: `feat/soco-mobile-ui-20261014`

## Design direction
SOCO visual identity follows the customer brand board for review: blue `#2563EB`, violet `#8B5CF6`, orange `#FF9F0E`, teal `#14B8A6`, navy `#0F172A`. Premium, restrained iOS-inspired rounded cards and blue-violet gradient highlights. Reuse actual business flows; do **not** replace established APIs.

**Brand asset status:** `frontend/public/soco-mark.svg` and `soco-maskable.svg` are original temporary vector marks, not final official customer artwork. The existing ChatNet domain and social OG metadata remain as-is until the customer confirms the brand migration.

## Coverage

| Surface | Implemented layer | What remains to verify |
| --- | --- | --- |
| Sign-in, sign-up, OTP | `soco-theme.css`, `soco-screens.css` | OTP journey with test account |
| Chat list and in-room conversation | list, cards, header, avatar, chat bubble, text composer | touch keyboard, overflow, typing, attachments |
| Translation AI / language search | trigger, results, light violet affordances | language switching across sessions |
| Message actions and group tools | long press, reactions, replies, group management | read/edit/delete, group privileges |
| People search, friend requests, QR | 50svh connect bottom-sheet, group creator & QR dialog | QR camera permissions and search results |
| Shared media, files and links | shared content modal and tabs | real upload + download on test account |
| Calls | incoming, E2EE video/voice UI, tiles and controls | two-account LiveKit call, live captions |
| Discover / nearby map | tabs, search, map, pins, discovery cards | location permissions and map loading |
| Feed and stories | composer, posts, comments, story chrome | posts, story uploads & like/comment flows |
| Profile, settings and notification | hero/cover, settings controls, action buttons | saved locales and OneSignal push |
| PWA/app identity | SOCO visible label, icon and theme colors | install on iOS & Android; final asset review |

## Layout principles
- All main navigations remain functional; no new backend calls were introduced.
- Mobile stylesheet overrides are deliberately loaded after legacy component CSS, preserving existing React behavior.
- Safe-area padding, min-width zero for truncating text and 16px mobile form fields avoid iOS zoom/overflow.
- Color is not the sole indicator for selected navigation items.
- Old green brand accents in core components have been replaced by blue-violet where possible.
- Backend tokens, storage identifiers, API hostname and database identity are **not** renamed.

## Verified in feature branch
- `npm run build` — TypeScript and Vite passed; existing code-splitting warning (JS chunks >500kB).
- `npm run check:pwa` — passed.
- `npm run check:session` — passed.
- `npm run check:optimistic` — passed.
- `git diff --check` — passed.
- Initial unauthenticated browser render — passed with 0 JavaScript console errors.

## Release and QA follow-ups
1. Replace temporary SOCO mark with approved original vector logo and generate validated platform icon assets; align OG metadata if brand rollout approved.
2. Test authenticated flows on iPhone 375 / 390 / 430px, tablet and desktop: chat, OTP, QR, upload, translation, notifications, group actions, story, location and calling.
3. Check accessibility (contrast, touch targets, screen readers) and safe areas in genuine mobile browsers.
4. Consider splitting the large JS bundle in a subsequent performance pass.
5. **Merge does not imply release validation or Railway deployment.** Retest once combined with uncommitted Live Project work, particularly call translation.

## SOCO UI 1.1 — Semantic layout & component refinement (2026-10-14)

- Added reusable `SocoSectionHeading`, `SocoEmptyState` and `SocoTextAction` presentation components in `frontend/src/SocoUI.tsx`.
- Added `frontend/src/soco-layout-v2.css` after all existing styles to unify section hierarchy, typography, brand accents, empty states, grouped cards, mobile safe areas and desktop reading widths.
- Chat now has a recognizable heading, conversation count, connection entry point and a guided empty state.
- Contacts uses a common page heading, friend count and a guided add-friend empty state.
- Feed distinctly groups stories, composer and latest posts; includes action on empty feed.
- Profile uses the shared page heading and clear personal info/settings groups.
- No backend, authentication, storage, privacy or business logic changes.

### Validation of 1.1
- `npm run build`: passed (existing large chunks warning remains).
- `npm run check:pwa`, `check:session`, `check:optimistic`, `check:onesignal`: passed.
- Local browser: unauthenticated signup screen rendered, 0 console errors.
- **Still required**: browser/device validation of authenticated page flows and screenshots at narrow viewport sizes. Do not claim pixel-perfect 18 mockups yet.

## SOCO layout stabilization — 2026-10-15

The production UI regression stems from legacy grid/flex styles conflicting with the SOCO responsive layer, plus percentage-width elements with extra horizontal margins. These changes retain ChatNet business logic.

Confirmed fixes:
- Desktop profile: use a stacked page layout instead of legacy two-column grid, with independently scrollable cards.
- Chat list: prevent 100% width plus side margins from overflowing at 320px.
- Feed: wrap narrow-screen media actions rather than cutting off trailing buttons.
- Mobile profile hero: account for horizontal margins in card width.
- App Shell: contain scrolling panels and preserve fixed navigation.

Repeatable regression test:
- In the frontend folder run npm ci, then npx playwright install chromium once, followed by npm run check:ui.
- Tests run local Vite and mocked authenticated API responses; no production user data is involved.
- Covers Chat List, Contacts, Feed, Profile, Discover, Chat Room at 320, 375, 390, 430, 768, 1024 and 1440px (42 combinations).
- Also checks the fixed-height friend connection sheet, language picker stability, profile stacking and uncaught runtime errors.
- Local screenshots stay in frontend/output/playwright/layout/ (Git ignored).

Caveat: these mocked UI tests do not verify live uploads, push notifications or actual voice/video calls. Production Railway deployment and real device checks require separate validation.

Deployment gate: run build, PWA, session, optimistic/notification checks and UI layout checks; only merge reviewed paths into main while preserving existing uncommitted Live Project changes.

## SOCO UI Refinement 2.0 — 2026-10-15

This pass focuses on visual density and readability on iPhone while retaining the SOCO Brand DNA 1.0 palette and all existing operations.

- Language selection: removed leftover dark-theme white-on-white typography, updated all selection rows and search input to an accessible light palette, and added an iOS-style focus-within ring. Close target is 44x44px.
- Conversation on mobile: the global SOCO brand/search header is hidden only while a conversation is open, making room for messages. At narrow phone widths the recipient avatar is omitted in the compact header so the full name can fit without removing call/media/translation controls.
- Feed: removed the edge-to-edge white story shelf, reduced story cards, and fitted the four post media actions into one compact row on modern iPhones (two rows on very narrow screens).
- Profile: removed the duplicate section caption before the profile edit card.
- Desktop: bottom navigation becomes a compact centered dock rather than a full-width tab strip.
- Notifications: restored floating toast behavior to avoid inserting an extra full-width layout row and shrinking active content.
- Find-friends and language search fields: rounded focus treatment rather than a rectangular input focus outline.
- Automated UI layout runner now uses a fresh ephemeral port and confirms that its own Vite process is ready; this avoids accidentally testing another server on port 5173.
- Automated checks include a minimum 4.5:1 contrast ratio for title, subtitle and search field text in the locale picker.

Verification: frontend build, check:ui (42 viewport × screen combinations, fixed-height connection & language sheets), check:pwa, check:session, check:optimistic, check:onesignal, and git diff --check passed in the refinement worktree. Browser screenshots were inspected at 390px and 1440px.

This is web/PWA UI refinement. It does not certify Flutter/TestFlight parity or the unmocked call, upload, notification or language catalog workflows; those need real-device integration verification.

## SOCO iOS Motion System — 2026-10-15

A single reusable motion layer is loaded last in `frontend/src/main.tsx`:
`frontend/src/design-system/motion.css`. It adds touch press-down scale (.965),
active navigation spring, subtle screen fades, sheet entrances, contextual menus,
new sent-message feedback and floating toast entrances. Animation durations are
115–340ms, with opacity and transform used instead of animating layout dimensions.
Hover elevation only appears on fine-pointer devices.

- Interactions do not change route state, modal height, scrolling regions, auth,
  translation, upload or notification behavior.
- Full-screen scrims/backdrops are excluded from press scaling.
- Page transitions fade **without transforms on layout containers** to avoid
  breaking fixed-position overlays.
- `prefers-reduced-motion: reduce` removes nonessential animations and press
  transforms for users who need reduced motion.
- Existing Playwright layout smoke now checks motion presence, actual press
  scale, and reduced-motion behavior. It continues to check seven viewport
  widths, 50% connection sheet height and language picker contrast.

The motion layer is for the Web/PWA app. The Flutter native app needs a separate
motion audit and real iOS device verification.

## SOCO Feed & Chat Pagination — 2026-10-15

Requested on production screenshot:
- Removed the redundant “CỘNG ĐỒNG / Bảng tin” introduction block from the Feed.
- Removed “N bài viết” on the right of the “Bài viết mới” heading.
- Replaced the active bottom-navigation oversized rounded block/top indicator with a minimal blue active icon.
- Added iOS-style API-backed load-more actions:
  - Feed posts: 15 per request, cursor `before=<post id>`.
  - Chat conversation list: 25 per request, `offset` and stable secondary `id DESC` sorting.
  - Older messages: 40 per request, cursor `before=<message id>`, query retains translation target.
- Older messages are prepended with scroll position compensated; incoming realtime messages remain visible. Loaded pages deduplicate IDs; request locks and per-session guards protect rapid taps and session changes.
- The previous API responses remain arrays and legacy no-query clients keep their original defaults.
- Pagination limits and cursor/offset values are validated server side.
- The Playwright UI suite now mocks 18 feed posts, 30 conversations and 45 chat messages and verifies page appending, no remaining button at the end, active tab styling, layout and scroll preservation.

QA scope: automated checks use Chromium and mocked API responses. Production DB pagination and real iPhone scroll behavior still need a real-user or staging-device check. Do not claim infinite scroll; this intentionally uses explicit load-more buttons.

## iPhone group management layout correction — 2026-10-15

Production screenshot revealed group settings rendered as an inline section limited to
approximately 48–52dvh, with truncated member management and chat bubbles/composer
visible underneath. Fixed as a **dedicated group management view** on mobile:

- The group settings content occupies the full chat panel height below the iOS app safe area, with an independent scroll container and sticky management header.
- While open, the conversation header, messages and composer are hidden; closing instantly restores the existing conversation state.
- Rename, invite, role management, remove/leave group APIs are unchanged.
- On group chats, the overloaded top action bar is a deliberate two-row layout on mobile. Back/name stays unobstructed; call, video, shared files, group and translation controls remain accessible on the second row.
- Member rows, invite search (16px input prevents iPhone zoom), button targets, wrapping and safe-area spacing are tuned for narrow phones.
- Playwright now checks group settings at 320, 375, 390 and 430 px, including panel bounds, independent scroll, sticky header, hidden chat/composer and restoration on close. Screenshots: `frontend/output/playwright/layout/group-settings-390.png`, `group-chat-header-{320,390}.png` (local, Git ignored).
- Keep this regression in automated QA alongside the existing 42 viewport/screen checks and load-more tests.

Live device validation is still required for keyboard, iOS Safari/PWA safe area, real membership and API responses.

## SOCO quick-create and profile settings polish — 2026-10-15

Two customer screenshot regressions were corrected:
- The global plus (+) action used to render its menu inside the conversation sidebar with a fixed 60px top position, covering the conversation heading and first chats. The menu is now anchored to the actual appbar plus button on desktop (right-aligned popover); on iPhone it opens as a compact bottom action sheet, retaining chat-list visibility. It includes typed Lucide icons, accessible menuitem roles, aria-expanded, click-outside dismissal and Escape dismissal. Disabling appbar backdrop blur while the sheet is open avoids mispositioning fixed descendants.
- The isolated right-aligned red logout button and large empty footer have been removed. 'Log out' (and install when relevant) now appears as a full-width row at the bottom of the existing profile settings card, with an icon, a subtle danger color and consistent padding. The existing logout/install actions are reused unchanged.

Automated Chromium regression checks validate popup placement, three menu actions, keyboard and backdrop dismissal, profile settings row geometry, 42 screen/viewport layouts, feed pagination, group management and iOS motion. Added targeted 320 / 390 / 768 / 1440 px checks for both screenshot issues, while checking that the popup does not overlap the desktop conversation sidebar. QA screenshots are retained locally at `frontend/output/playwright/layout/quick-create-{390,1440}.png` and `profile-actions-{390,1440}.png` (gitignored).

Existing auth, notifications, translation, messaging, profile APIs and other business flows have not been changed. Production real-user verification should follow the Railway deployment.
