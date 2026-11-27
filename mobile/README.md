# SocCO Flutter

Cross-platform SocCO client for mobile, tablet, web, and desktop.

## Run

```bash
flutter pub get --enforce-lockfile
flutter run -d chrome --dart-define=API_URL=https://api-chat.codelocal.cloud --dart-define=WEB_URL=https://chat.codelocal.cloud
```

Use `API_URL` to select the desired backend. The default is the existing production API; use dev or local APIs for test accounts and test data. `WEB_URL` controls canonical share/QR links. The in-memory `DemoApi` is used by widget tests, not the production entrypoint.

For release containers, Railway preview and production autodeploy settings, see [RAILWAY.md](RAILWAY.md).

## Verify

```bash
dart analyze
flutter test
flutter build web --release
```
