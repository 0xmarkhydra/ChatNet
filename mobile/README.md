# SocCO Flutter

Cross-platform SocCO client for mobile, tablet, web, and desktop.

## Run

```bash
flutter pub get
flutter run -d chrome --dart-define=API_URL=http://localhost:8080
```

Use the offline demo without a backend by selecting **Xem bản demo** on the sign-in screen:

```bash
flutter run -d chrome
```

`API_URL` defaults to `https://api-chat.codelocal.cloud`. Set `WEB_URL` when local profile links must use a different web origin.

## Verify

```bash
dart analyze
flutter test
flutter build web --release
```
