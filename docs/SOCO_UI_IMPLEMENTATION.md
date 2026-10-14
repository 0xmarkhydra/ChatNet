# SOCO Mobile UI — implementation status

Branch: `feat/soco-mobile-ui-20261014`

## Scope
- Brand direction follows customer-provided SOCO Brand DNA 1.0 (visual concept; pending final brand asset approval).
- Added `frontend/src/soco-theme.css` imported last; design tokens and responsive styling cover shell, chat list, conversation, translation, contacts/QR modal, discovery, feed/story, profile, login and calls.
- Added an original temporary `frontend/public/soco-mark.svg`; **not** a traced or final customer logo. Replace with official vector asset after approval.
- Updated in-app primary heading/header/cover branding to SOCO; existing ChatNet API, social-link sharing text, PWA/metadata and deployment identity intentionally remain unchanged until naming approval.
- No backend or database changes.

## Tests
- `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline` — passed.
- `npm run build` — passed (tsc, Vite; chunk-size warning remains).
- `git diff --check` — passed.
- Browser localhost smoke for unauthenticated registration screen — passed; browser console had zero errors.

## Remaining before release
- Check authenticated flows with test user on 375/390/430px viewport, tablet and desktop; verify chat actions, group creation, translations, uploads and calling.
- Obtain final SOCO logo, update favicon/manifest/OG assets and localized brand strings after customer approves product rename.
- Review color contrast and accessibility, overflow of menu/popovers/bottom sheets and dark mode.
- Do not merge to main or deploy without visual and regression acceptance.
