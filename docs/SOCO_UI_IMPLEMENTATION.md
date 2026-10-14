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
