# Flutter Web deployment

The Flutter Web frontend shares `lib/`, dependencies and application state
with Android/iOS. It uses the existing production Go API, not a new database.

## Local release

From `mobile/`:

```sh
flutter pub get --enforce-lockfile
flutter analyze --no-pub
flutter test --no-pub
flutter build web --release --no-pub --no-web-resources-cdn \
  --dart-define=API_URL=https://api-chat.codelocal.cloud \
  --dart-define=WEB_URL=https://chat.codelocal.cloud
python3 -m http.server 5189 --bind 127.0.0.1 --directory build/web
```

With Docker installed: `docker build -t chatnet-flutter-web .` and
`docker run --rm -p 5189:8080 -e PORT=8080 chatnet-flutter-web`.
Check `/health`, `/`, a nested route, a missing JS resource (404), and
Cache-Control. The Python server is only a static preview, not an Nginx test.

## Railway dev preview (no GitHub source)

The isolated `chatnet-flutter-web-preview` service in ChatNet's `dev`
environment uses `API_URL=https://chatnet-dev.up.railway.app` and
`WEB_URL=https://chat-net.up.railway.app`. No production service is deployed
by this workflow. From the dedicated feature worktree repository root:

```sh
railway up mobile --path-as-root --service chatnet-flutter-web-preview --environment dev --ci
```

Preview: https://chatnet-flutter-web-preview-dev.up.railway.app

The Docker build and deployment have succeeded on Railway. The independent
`.github/workflows/flutter-web-ci.yml` checks the release image, dynamic PORT,
health endpoint, SPA fallback, cache headers, Wasm MIME type and missing assets
on pull requests/pushes touching mobile; it never deploys anything. Enable
Railway's Wait for CI on the production service when connecting GitHub main.

Before promoting, verify `/health`, `/`, SPA routing, missing assets, cache headers, API CORS,
real-time messaging and browser permissions using dev-only test accounts.
This preview incurs Railway resource usage while running; retire it after
verification with explicit approval. Do not attach it to production GitHub
main autodeploys.

## Railway production (after approval and merge)

Use the existing ChatNet project, production environment and empty service
`chatnet-flutter-web`. Do not change any existing service or domain.

- Root Directory: `/mobile`.
- Builder: Dockerfile (the Dockerfile is at the build root).
- Set service settings directly in Railway. New services no longer support legacy `railway.toml` config-as-code; do not migrate the entire existing project just for this service.
- Healthcheck timeout: 120 seconds; restart policy: ON_FAILURE, 3 retries.
- Watch Paths: `/mobile/**` (all Flutter sources, lockfile and deployment files).
- API_URL: `https://api-chat.codelocal.cloud`.
- WEB_URL: `https://chat.codelocal.cloud` (existing canonical share/QR links).
- Use Railway-provided PORT, with 8080 as the container default.
- Healthcheck: `/health`. Generate a separate public HTTPS domain.
- Connect `0xmarkhydra/ChatNet`, branch `main`, only after the deployment
  files have been merged and production activation is approved. Enable
  GitHub autodeploys. Feature branches must not deploy to this service.
- Public build variables are compiled into JS; do not pass secrets.
- Verify API CORS/preflight and live event streaming from the generated
  domain; do not widen backend CORS or modify backend without evidence.
- Inspect deployment source SHA, healthcheck and browser console/network.
  On subsequent Flutter merges compare the new deployment SHA with main.
  Roll back to the last healthy deployment in Railway if necessary.

The build pins Flutter 3.44.4 directly from the official Flutter Git tag
because third-party image tags do not reliably cover patch releases. Assets
are self-hosted and Nginx revalidates them to avoid stale builds. Confirm
actual container build and deployment health before declaring production ready.
