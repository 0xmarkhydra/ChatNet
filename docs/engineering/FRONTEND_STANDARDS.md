# Frontend engineering standards (mandatory)

This is the single source of truth for **new and changed frontend code** in ChatNet. It applies equally to humans, ChatGPT, Claude and automated coding agents. Read `AGENTS.md` / `CLAUDE.md` and the relevant React and Ponytail skills first; use `docs/FRONTEND_STRUCTURE.md` for the directory map.

## Goal and scope

Ship correct Web/PWA and Desktop-compatible React 19 + strict TypeScript code **without recreating the technical debt being removed**. Follow the established API/auth, privacy, realtime, E2EE, offline outbox, translation and UI/UX contracts. A passing build does not prove runtime correctness.

Do not treat existing legacy patterns as permission to repeat them. Legacy violations in `frontend/lint-baseline.json` and `frontend/scripts/architecture-baseline.json` are **debt ceilings, not design examples**.

## File ownership and dependency direction

- `app/`: application composition, top-level providers, layouts and navigation. Domain behavior belongs to its feature. `platform/`: environment adapters, receiving domain dependencies through explicit interfaces.
- `features/<name>/`: owner of its UI, hooks, domain logic, state, styles and API adapters. Prefer `components/`, `hooks/`, `api/`, `lib/`, `utils/`, `types.ts` only when useful.
- `shared/`: genuinely feature-independent types, UI, contexts and utilities. Do not turn it into a dumping ground or put feature business rules there.
- Allowed direction: `app → features → shared`; `platform` and `shared` must not import `app` or `features`. A feature must not import `app`.
- Cross-feature imports go **only through the owning feature's deliberate public `index.ts` exports**. Do not deep-import its `components/`, `hooks/`, `lib/`, `types.ts` or `api/`. Prefer `import type` for type-only dependencies, but type-only imports still respect boundaries.
- No dependency cycles. Place shared contracts at the lowest legitimate owner rather than importing back from a parent component; keep public barrels narrow to avoid cycles.
- Backend calls belong in `features/<owner>/api/` (or an established shared transport). UI components must not add direct domain `fetch` or `apiFetch` calls. Keep methods, payloads, auth, idempotency and error semantics unchanged unless explicitly authorized.
- No arbitrary line-count limit. Split a large file when it mixes independent responsibilities, has difficult-to-test effects or causes unnecessary coupling; do **not** split mechanically, create one-hook-per-component wrappers or move complexity into an oversized `shared/` module.

## React 19 and state ownership

- Follow Rules of Hooks, purity, immutable updates and strict TypeScript. No Hook calls in conditions/loops; no reading or writing `ref.current` while rendering; no derived state stored unnecessarily.
- Use effects to synchronize with **external systems**. Derive values while rendering; use a component `key` or appropriately scoped state when identity changes. No chained effects to mirror props or reset UI state.
- Include real effect dependencies, provide cleanup and guard stale closures. Do not silence React Hooks lint to avoid investigating semantics.
- Distinguish local UI state, session/auth state, URL state and server state. Keep a clear source of truth; avoid redundant Context/caches. Context is not a default global store.
- Every async read must consider abort/cancellation, request ordering and session identity, including A → B → A. A late response/callback must not leak previous-account data or overwrite newer state.
- Treat mutations separately from reads: avoid automatic retries after ambiguous writes, preserve idempotency keys, optimistic state and outbox delivery/recovery guarantees.
- Keep E2EE key material, WebRTC/LiveKit device/room lifecycle and push/PWA subscriptions in their established ownership boundaries.

## UI, accessibility and performance

- Preserve indigo design tokens, semantics, responsive breakpoints and existing flows. Verify mobile/desktop scroll ownership, overlays, focus and keyboard navigation, dialogs, loading/empty/error/retry states.
- UI refactors require before/after checks of affected screens. Do not call a passing snapshot a substitute for real interaction QA.
- Prefer lazy-loading genuinely heavy routes or features only after identifying a measured bundle or UX problem. No automatic dependency additions (router, query/cache, state manager, form library) just to follow trends.
- Keep render and API responsibilities separate but avoid unnecessary `useMemo`, `useCallback`, providers and abstractions.

## Required workflow for AI-generated and human code

1. **Inspect:** read the relevant code, contracts, existing tests and ownership; check current Git state and instructions. Start from freshly fetched `origin/main` in an isolated branch/worktree. Never change someone else's dirty files or worktree.
2. **Scope:** state the user-visible behavior, ownership boundaries, risks and affected callers. If a necessary change crosses an assigned scope, write a migration guide or coordinate with the owner.
3. **Implement:** make the smallest complete change; keep API and UX parity and don't introduce debt under the excuse of legacy precedent.
4. **Verify:** add focused behavior/regression tests, including negative paths and stale responses where relevant. Run `npm run lint`, `npm run check:architecture`, `npm run test:unit`, `npm run build` and relevant feature-specific checks from `frontend/`.
5. **Report:** list changed files, reasons for design decisions, real test results (PASS/FAIL/NOT RUN/BLOCKED), user-visible risk and manual QA gaps. Commit/push independently; **never self-merge**.

Changes to either baseline require a separate explanation of each removed entry and **must not increase** the set/count of accepted debt. Never add `eslint-disable`, `@ts-ignore`, fake tests or loosen CI thresholds merely to pass. If an exceptional suppression is necessary, justify it at the precise site and request human review.

## Pull request acceptance criteria

- New code follows ownership/import/API rules and introduces **zero** new architecture or React Hooks findings; old debt only decreases.
- Typecheck/build, unit tests, architecture checks and lint pass on the **PR merge candidate**, not merely on an isolated branch.
- Relevant session, outbox, calls, push, translation and visual checks have evidence, or their absence is explicitly marked `NOT RUN` with risk.
- Architecture/lint baseline changes are ratchets only. PR reviewers inspect the diff for hidden code motion, API/security changes, unjustified abstractions and unmet manual QA.
- CI green is necessary, **not sufficient**. Require human review and GitHub branch protection for the required checks; these repository files cannot configure remote branch protection on their own.
