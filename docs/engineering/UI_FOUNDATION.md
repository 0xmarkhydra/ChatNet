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

## Shared components now available

- `shared/ui/button.tsx`: Button / variants for app-shell navigation and actions.
- `shared/ui/input.tsx`: native Input (used by Header quick search).
- `shared/ui/textarea.tsx`: native textarea with semantic styling.
- `shared/ui/dialog.tsx`: Radix Dialog primitives with focus management, accessible title/description, portal overlay and close action.
- `shared/ui/dropdown-menu.tsx`: Radix menu primitives with keyboard navigation and selectable items.

```tsx
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/shared/ui/dropdown-menu";

<Input aria-label="Tìm kiếm" type="search" value={query} onChange={event => setQuery(event.target.value)} />
<Textarea aria-label="Nội dung" />
<Dialog>
  <DialogTrigger asChild><button type="button">Chỉnh sửa</button></DialogTrigger>
  <DialogContent>
    <DialogTitle>Chỉnh sửa</DialogTitle>
    <DialogDescription>Cập nhật thông tin.</DialogDescription>
  </DialogContent>
</Dialog>
<DropdownMenu>
  <DropdownMenuTrigger asChild><button type="button">Thao tác</button></DropdownMenuTrigger>
  <DropdownMenuContent><DropdownMenuItem onSelect={save}>Lưu</DropdownMenuItem></DropdownMenuContent>
</DropdownMenu>
```

Keep existing feature dialog/menu implementations until a feature-scoped QA migration is planned. Do not silently replace application-owned modal lifecycle, focus returns or outside-click semantics.

## Rules for new feature work

1. Reuse `shared/ui` first and keep business behavior in feature-owned components/hooks.
2. Prefer semantic tokens to arbitrary colors; support focus/disabled/reduced-motion/responsive states.
3. Review any `shadcn add` changes before committing. **Do not run `shadcn init` blindly**: it can overwrite tokens or introduce Tailwind Preflight. Keep `components.json` and the no-Preflight import policy.
4. Migrate existing CSS gradually, per screen, with before/after screenshots and keyboard/mobile QA. No mass replacement.
5. Run `npm run lint`, `npm run check:architecture`, `npm run test:unit`, `npm run build` before PR.

No backend routes, API contracts, auth/session, service worker or page UX are intentionally changed by this foundation.
## Design-debt ratchet

`frontend/design-debt-baseline.json` records, per file, hardcoded design values: hex colours, `!important`, `.modern-shell.app-layout` selectors and literal `z-index` in CSS; arbitrary colours, pixel values, breakpoints, `!` modifiers and literal `z-index` in TSX/TS. Counts may only go down.

- `npm run check:design-debt` fails when any file/metric increases or a new file introduces debt (CI runs it; the PR baseline guard also rejects a raised baseline).
- `npm run design-debt:report` prints totals per metric and area, CSS files nothing imports and theme tokens never referenced.
- `npm run design-debt:baseline` rewrites the baseline after debt was removed. Never use it to accept new debt.
- A legitimately fixed value (SVG, canvas, third-party) may carry `design-debt-ignore: <reason>` in a comment on the same line; an empty reason does not count.
