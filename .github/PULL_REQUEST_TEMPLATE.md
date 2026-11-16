## Summary and ownership

- What changed and **why**? Which feature owns the behavior?
- Affected UI flows, API/auth contracts, session/realtime/outbox behavior:
- AI-assisted changes (if any): what was independently checked?

## Architecture and React review

- [ ] New cross-feature imports use public `index.ts`; no new cycles or reverse imports.
- [ ] Backend calls remain in the owning feature's `api/`; errors, cancellation and writes are correct.
- [ ] Hooks follow React 19 purity, dependencies, cleanup, immutable state and session isolation.
- [ ] No unnecessary abstractions or mechanical file splits; large changed files have cohesive responsibilities.
- [ ] Layout, accessibility, mobile/desktop, overlays and loading/error/empty states are preserved if applicable.
- [ ] No new lint or architecture baseline entries, unsafe suppressions or relaxed quality gates.

## Verification (fill in actual evidence)

| Check | PASS / FAIL / NOT RUN / BLOCKED | Evidence / reason |
| --- | --- | --- |
| `npm run lint` | | |
| `npm run check:architecture` | | |
| `npm run test:unit` | | |
| `npm run build` | | |
| Feature-specific API/outbox/session/etc. checks | | |
| Manual browser/mobile/two-device QA (when relevant) | | |

## Risk and handoff

- Regression tests added/updated:
- Outstanding risks, manual QA not run, migration requirements:
- Branch/commit SHA:
- Any `lint-baseline.json` or `architecture-baseline.json` change? Explain each **removed** violation; additions are prohibited.
- [ ] No self-merge or deployment. Human reviewer should verify branch protection checks.
