# SocCO shared UI component contract

These controls live in `frontend/src/shared/ui/` and are opt-in for new UI. This change does **not** replace Feed/Profile post cards or existing feature-specific controls. User-approved screens remain the visual authority.

| Component | Entry point | Contract |
| --- | --- | --- |
| Button | `button.tsx` | Native button defaults to `type="button"`; explicit submit/reset types, `disabled`, size and variant remain supported. Icon-only buttons need `aria-label`. `asChild` delegates semantics to the child. |
| Input | `input.tsx` | Forwards native input attributes, including type/autocomplete/required and accessible metadata. |
| Textarea | `textarea.tsx` | Forwards native textarea attributes and allows resizing. |
| Card | `card.tsx` | Neutral `section` wrapper with Header, Title, Description, Content and Footer; header/title levels are opt-in and can be overridden with explicit semantic markup when needed. No built-in post/feed actions. |
| Dialog | `dialog.tsx` | Uses Radix focus management, Escape and portal behavior. DialogTitle/Description must label dialogs unless callers provide an equivalent accessible name. |
| Dropdown | `dropdown-menu.tsx` | Uses Radix keyboard/focus behavior; preserve disabled, checked and submenu state. |

## Tokens and compatibility

The existing 12px/16px radii and 14px/18px typography are now expressed as `rounded-ui-md`, `rounded-ui-lg`, `text-ui-body` and `text-ui-section` in the eligible shared primitives; values match the previous Tailwind utilities. No global CSS reset or screen-level CSS migration is included. `Card` uses `rounded-ui-lg`, `bg-card` and other semantic tokens in new screens only.

Keep component API and a11y behavior under tests in `frontend/tests/shared-ui-contract.test.tsx`. Validate overlays and focus interactions in a real browser whenever a new feature adopts Dialog/Dropdown. See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for colors, sizing, contrast and responsive conventions. Follow [AGENT_FILE_OWNERSHIP.md](AGENT_FILE_OWNERSHIP.md) when editing shared controls.
