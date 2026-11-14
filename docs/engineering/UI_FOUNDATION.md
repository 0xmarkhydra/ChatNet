# SocCO UI foundation — adoption guide

This change establishes Tailwind CSS v4 and a shadcn/ui-compatible source-owned component location without migrating existing screens.

## How it works

- `frontend/src/styles/tailwind.css` imports Tailwind **theme + utilities only**, intentionally excluding Preflight. Old global and feature CSS keep their element defaults.
- Semantic utility colors (`bg-primary`, `text-foreground`, `border-border`, etc.) resolve through existing SocCO `--soco-*` variables.
- `frontend/components.json` points shadcn tooling at `src/shared/ui` and `src/shared/lib/utils.ts`; `@/*` resolves to `src/*` in Vite and TypeScript.
- `frontend/src/shared/ui/button.tsx` is a source-owned Button sample. It is not automatically installed across old features.

## Example

```tsx
import { Button } from "@/shared/ui/button";

<Button onClick={save}>Lưu</Button>
<Button variant="outline" disabled={saving}>Hủy</Button>
```

## Rules for new feature work

1. Reuse `shared/ui` first and keep business behavior in feature-owned components/hooks.
2. Prefer semantic tokens to arbitrary colors; support focus/disabled/reduced-motion/responsive states.
3. Review any `shadcn add` changes before committing. **Do not run `shadcn init` blindly**: it can overwrite tokens or introduce Tailwind Preflight. Keep `components.json` and the no-Preflight import policy.
4. Migrate existing CSS gradually, per screen, with before/after screenshots and keyboard/mobile QA. No mass replacement.
5. Run `npm run lint`, `npm run check:architecture`, `npm run test:unit`, `npm run build` before PR.

No backend routes, API contracts, auth/session, service worker or page UX are intentionally changed by this foundation.
