# SocCo Flutter

Cross-platform SocCo client for mobile, tablet, web, and desktop.

## Run

```bash
flutter pub get
flutter run -d chrome --dart-define=SOCO_API_BASE_URL=http://localhost:3000
```

Use the offline demo without a backend:

```bash
flutter run -d chrome --dart-define=SOCO_DEMO=true
```

The built web demo also accepts `?demo=1`.

## Verify

```bash
dart analyze
flutter test
flutter build web --release
```
