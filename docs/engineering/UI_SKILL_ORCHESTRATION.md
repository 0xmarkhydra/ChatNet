# SocCo UI skill orchestration (Codex + Claude)

This guide is the **dispatch and conflict-resolution policy** for UI work in ChatNet. It does **not** authorize visual redesigns, new runtime packages, theme resets, or API changes.

## Required reading and precedence

For a UI task, read the applicable instruction entrypoint (`AGENTS.md` for Codex or `CLAUDE.md` for Claude) and `docs/engineering/FRONTEND_STANDARDS.md` first.

Apply this priority order when advice conflicts:

1. **Explicit user scope**, authorized feature behavior, security, privacy, accessibility and API/route compatibility.
2. **Current SocCo implementation truth**: `frontend/src/styles/tailwind.css`, `frontend/src/styles/soco-theme.css`, source-owned `frontend/src/shared/ui/`, and approved screens. Preserve existing Tailwind v4 setup (Preflight disabled) and shadcn source ownership.
3. **Approved Penpot board and SocCo UI Fidelity** (`.agents/skills/socco-ui-fidelity/SKILL.md` or Claude mirror) **when actually installed**; the board is a design reference, not authority to override current code tokens. If `docs/DESIGN.md` exists, read it as a project design brief; it is not currently guaranteed on `origin/main`.
4. **`ios-inspired-ui-design`**: approved responsive, density, motion and visual QA guidance; apply balanced glass only where appropriate.
5. **`ui-ux-pro-max`**: a *read-only advisory and critique source* for interaction, accessibility, layout, typography, responsive and stack-specific patterns. Its suggested color palettes, fonts, styles, components and design-system output are **not** SocCo requirements.
6. **`react-frontend-engineering` and Ponytail Ultra** govern implementation semantics, simplicity and testability; neither can waive behavior/a11y or safety obligations.

Conflicting advice is **not averaged**. Keep the higher-priority choice, briefly log the rejected lower-priority recommendation and the reason. If a user's design request explicitly changes approved tokens, request design approval through the normal review/PR process; do not silently regenerate a global theme.

## Dispatch matrix

| Task | Skills to consult | Source of final decision |
| --- | --- | --- |
| Brand new screen or significant redesign | SocCo UI Fidelity (if available) → iOS design → UI UX Pro Max for alternative patterns → React/Ponytail | User-approved board + existing SocCo tokens/components |
| UI bug or responsive/a11y fix | iOS design + targeted UI UX Pro Max UX query → React/Ponytail | Existing interaction contract + verified behavior |
| UX audit / design review only | iOS VISUAL-QA + UI UX Pro Max targeted UX query | Evidence from live browser and current design |
| Hooks, API, data state, backend or Docker only | React/Ponytail or domain-specific skills; **skip UI UX Pro Max** | Feature/API contracts and tests |
| UI implementation and refactor | React + Ponytail, iOS UI, and UI UX Pro Max only if a visual/interaction decision is involved | Existing component system, then architecture rules |

Avoid loading every skill or generating a full design system for small targeted fixes. One targeted UI UX Pro Max domain search is enough for an individual problem. Search results are external suggestions, not checked-in source of truth.

## How to query UI UX Pro Max safely

The upstream Python search script is installed without modifications for Codex and Claude:

- Codex: `python .agents/skills/ui-ux-pro-max/scripts/search.py "keyboard focus visible" --domain ux`
- Claude: `python .claude/skills/ui-ux-pro-max/scripts/search.py "keyboard focus visible" --domain ux`
- For React or Tailwind implementation advice, use `--stack react`, `--stack shadcn` or `--stack html-tailwind` (check supported stack names first).

Requires Python 3 on the **agent execution machine**. Windows CodeLocal currently has Node but may not have `python` or `py`: if unavailable, use the bundled `references/quick-reference.md`, `references/pro-rules.md` and existing SocCo/iOS rules as *read-only* guidance; mark automated search **BLOCKED**. Do not install Python globally, run unreviewed installers, add a build dependency, or change the host environment without approval.

**Do not run `--persist`, `--force`, `--preview`, or automatically export/apply `--tokens` to the project**. The upstream generator can create `design-system/**/MASTER.md` and token files that would compete with SocCo's theme. If exploring a new visual direction, generate ideas only, compare them to approved project tokens, and propose a separate reviewed design change.

## Mandatory UI acceptance checklist

- Existing routing, callbacks, privacy behavior, error handling and API calls remain intact.
- Shared `shadcn/ui` source and semantic Tailwind tokens reused; no new competing UI/icon library, global CSS reset or silently copied UI kit.
- States: initial/loading/empty/error/retry/disabled/focus/hover/selected plus offline/optimistic where applicable.
- Keyboard and touch usable without relying on hover; visible focus, meaningful labels, reduced-motion support, Vietnamese long-text and browser zoom checks.
- Compare screenshots with the correct Penpot board or closest approved screen when board exists and browser is available. Include mobile 390px, tablet 768px, desktop 1024px and 1440px, short height and 200% zoom where relevant.
- Run appropriate lint, architecture, unit, build and responsive checks. Mark each check **PASS / FAIL / NOT RUN / BLOCKED**, never infer a visual PASS from TypeScript build.
- PR description names any conflict between UI UX Pro Max suggestions, Penpot and SocCo, plus the selected resolution.
- Respect `docs/engineering/AGENT_FILE_OWNERSHIP.md`: no overlapping edits to other agents' `AGENTS.md`, `CLAUDE.md`, `docs/DESIGN.md` or `socco-ui-fidelity` work while unmerged.

## Skill provenance and update policy

UI UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill , MIT license; snapshot pinned to upstream commit `e59ff376a41f7ca47b7541ad5c116495cbade3ee` (2026-11-17).

Vendored unchanged upstream `.claude/skills/ui-ux-pro-max/` content into matching paths `.agents/skills/ui-ux-pro-max/` and `.claude/skills/ui-ux-pro-max/`, with a copy of upstream `LICENSE` in each directory. No npm package, npm lifecycle hook, client runtime dependency, or skill-specific design file is automatically installed.

To vendor this pinned source into a clean isolated worktree, check out the upstream repository *inside that worktree*, inspect the commit and license, and run:

```sh
node scripts/vendor-ui-ux-pro-max.mjs .uipro-upstream/.claude/skills/ui-ux-pro-max
node scripts/vendor-ui-ux-pro-max.mjs .uipro-upstream/.claude/skills/ui-ux-pro-max --verify
```

The script refuses to overwrite an existing skill directory, verifies all upstream files and the license byte-for-byte, and leaves both existing design skills untouched. The source checkout (`.uipro-upstream/`) is a **temporary local review input**, not a file to add to the PR.

When updating, verify upstream commit/license, review `SKILL.md` and scripts for changed behavior, compare both mirrors, and update through a separate reviewable PR. Do not use an upstream installer that rewrites repo instructions without diff review.
