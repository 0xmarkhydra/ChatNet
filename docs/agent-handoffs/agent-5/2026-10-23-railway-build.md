# Agent 5 — Railway/Docker Web/PWA build gate (2026-10-23)

Scope: phase-1 Web/PWA; no native mobile changes, no production deployment.

## Changes
- `Dockerfile.frontend` and the gateway `Dockerfile` frontend stage now use Node 24 and `npm ci` with the committed lockfile; dependency installation fails instead of silently updating resolution.
- Both build stages run frontend typecheck/Vite build plus PWA isolation, session, incoming sound, OneSignal and call privacy regression checks. They copy the one backend call source file needed for the static privacy check **only into the build stage**; final images copy built frontend assets, not backend source.
- `.dockerignore` excludes dependency/output directories, nested worktrees and local `.env` files (including production variants), preventing accidental credential ingestion into the Docker build context.
- GitHub Actions quality gates remain optional when GitHub Actions jobs cannot start for account billing reasons; Railway is the deployment build path.

## Evidence
- PASS: `docker build --target build -f Dockerfile.frontend .` from the Agent 5 worktree context, including all embedded frontend checks.
- PASS: `docker build --target frontend-build -f Dockerfile .` from the Agent 5 worktree context, including all embedded frontend checks.
- PASS: `git diff --check`.
- WARN: Vite outputs large chunks (>500 kB).
- NOT RUN: live Railway build/deploy/smoke, real OneSignal delivery, iOS/Android real-device PWA, WebRTC multi-user call, production observability, and rollback.

## Release caveats
- Tests embedded in an image build are deterministic/static checks, not a substitute for multi-account end-to-end verification on a deployed environment.
- Never mark production-ready based solely on passing Docker builds.
