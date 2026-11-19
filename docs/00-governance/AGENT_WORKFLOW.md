---
document_id: GOV-AGENT-001
title: Agent Workflow and File Ownership
version: 1.0.0
status: Draft
owner: Engineering Governance
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 15289:2019"
---

# Agent Workflow and File Ownership

## Tóm tắt

Bắt đầu bằng workspace ChatNet và xác nhận đúng worktree trước khi ghi. Mỗi tệp chỉ có một người ghi tại một thời điểm. Bàn giao phải nêu SHA, tệp thuộc phạm vi và kết quả kiểm thực tế.

## 1. Purpose

This document consolidates ChatNet's agent workflow, file ownership, review and handoff rules. It does not grant permission to change production systems or bypass repository protections.

## 2. Session bootstrap

1. Select the canonical ChatNet CodeLocal workspace rooted at `D:\06-work\ChatNet`.
2. Refresh project information, project instructions and Git status before substantive work.
3. Identify the requested source baseline and any dirty or untracked changes.
4. Read the relevant local skill and project policy before editing the affected discipline.
5. Prefer semantic source inspection and targeted reads over broad repository dumps.

## 3. Worktree and ownership rules

- One active writer per file at a time.
- A worktree isolates working directories; it does not remove merge conflicts or establish ownership of shared files.
- Before editing, inspect relevant worktrees, branches, dirty files, open PRs and recent commits.
- Announce the branch/worktree and exact path scope before parallel implementation.
- Do not edit another agent's dirty or owned files, even from a separate worktree.
- When a needed file is owned elsewhere, prepare a review note or request an explicit handoff.
- Avoid mass formatting, broad refactors or unrelated cleanup in a task-scoped worktree.

## 4. Change and verification rules

- Respect the user's explicit scope and project-specific approval gates.
- Preserve server-side authorization, privacy, validation, API compatibility and migration integrity.
- Run the smallest relevant tests first, then the required project quality gates.
- Report PASS / FAIL / NOT RUN / BLOCKED from execution evidence.
- Distinguish source implementation, automated test coverage, real-device UAT, hosted CI, merge, release and deployment.
- Never infer a visual, accessibility, security or production PASS from a successful build alone.

## 5. Git and release boundaries

- Stage only task-owned files.
- Use one-line Conventional Commit subjects in English when a commit is explicitly requested.
- Never force-push.
- Do not merge into main, publish a release or deploy without explicit approval.
- Do not delete user data, files, branches or worktrees without explicit authorization.
- A local CI result does not imply GitHub Actions or production deployment succeeded.

## 6. UI skill orchestration

For UI tasks, read docs/engineering/FRONTEND_STANDARDS.md and the relevant design guidance. Preserve current SocCO tokens and existing component ownership. Skill output is advisory and cannot override user-approved behavior, security, privacy, accessibility or actual source truth. Do not run destructive/global token-generation commands without review.

## 7. Handoff template

A handoff SHOULD include:
- Task and owner
- Branch/worktree and owned paths
- Baseline commit
- Changed files and reasons
- Verification commands, results and evidence
- NOT RUN / BLOCKED items and residual risks
- Commit/PR reference and integration status

## 8. Related policies

- [Document control](DOCUMENT_CONTROL.md)
- [Baseline and change control](BASELINE_AND_CHANGE_CONTROL.md)
- [Frontend standards](../engineering/FRONTEND_STANDARDS.md)
- [Legacy document register](LEGACY_DOCUMENT_REGISTER.md)

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
