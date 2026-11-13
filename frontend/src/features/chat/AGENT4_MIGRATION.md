# Agent 4 integration notes — ChatSectionProps boundary

This branch breaks the five import cycles between `ChatSection.tsx` and its child components by moving `ChatSectionProps` to `components/ChatSectionProps.ts`. `ChatSection.tsx` retains a type-only re-export to preserve existing consumers.

**Architecture gate blocker:** `npm run check:architecture` currently fails on four newly introduced *type-only* cross-feature imports in `ChatSectionProps.ts`: `auth/lib/session`, `contacts/types`, `i18n/lib/i18n`, and `i18n/utils/languages`. The five component-to-ChatSection cycles are eliminated, but the architecture checker counts type-only imports as dependencies.

**Agent 4-owned integration:** expose the four required types through authorized feature entrypoints (or agree on a documented shared contracts boundary). Then update the four import paths in `ChatSectionProps.ts` to consume those entrypoints and rerun `check:architecture`, `build`, `lint`, `test:unit`, `check:chat-api`, and `check:outbox`. Do not relax the architecture baseline to make the check pass.

`useChatPins.ts` also guards pending pin requests by request-set identity across session switches. Regression coverage is in `hooks/useChatPins.test.ts`; no API contract, outbox format or UI behavior was changed.
