# CodeLocal Skills integration — ChatNet

Installed from [0xmarkhydra/master-skill](https://github.com/0xmarkhydra/master-skill), pinned to source commit `a0d9aa0301e6ac5b2b06bb6cd3c348930337fdda` (2026-10-17).

## Installed components

| Component | Purpose |
| --- | --- |
| `.agents/skills/` | 9 coding skills and references for Codex |
| `.claude/skills/` | The same 9 coding skills and references for Claude Code |
| `AGENTS.md` | ChatNet-specific safety/stack rules and Codex skill selection |
| `CLAUDE.md` | ChatNet-specific safety/stack rules and Claude skill selection |
| `.codelocal-skills/ponytail/LICENSE` | MIT license for Ponytail |
| `.codelocal-skills/ponytail/SOURCE.md` | Upstream and provenance details |

The 9 skills are **backend-engineering**, **react-frontend-engineering**,
**ios-inspired-ui-design**, **ponytail**, **ponytail-review**, **ponytail-audit**,
**ponytail-debt**, **ponytail-gain** and **ponytail-help**.

## Agent workflow

Read `AGENTS.md` (Codex) or `CLAUDE.md` (Claude) first.
Load *only task-relevant* specialist skill files and their references.
For implementation or refactoring, combine the relevant specialist(s)
with Ponytail Ultra as a simplicity policy. It must not remove approved
features, server validation/authorization, security or necessary tests.
Audit/review/debt/gain/help are opt-in based on task intent.

## Update and verification

Use a clean, isolated branch and review upstream changes before updating.
Run the upstream installer from a checked-out source repository:

```sh
python3 tools/install.py --target /absolute/path/to/ChatNet --agent both --dry-run
python3 tools/install.py --target /absolute/path/to/ChatNet --agent both
```

The installer verifies upstream files and **does not overwrite conflicting
skill files or an edited managed policy block**. Preserve project-specific
instructions before/after the managed blocks.

Verify the installer is idempotent (a second `--dry-run` prints SKIP),
that the 9 skill directories and reference files match between Codex and
Claude and that license/provenance files exist. The agent instructions
do not install runtime libraries, modify application behavior or grant
deployment authority.

## Scope of this integration

Documentation and coding-agent instructions only.
No runtime frontend/backend code, environment variables, migrations or
Railway configuration are changed by installing these skills.
