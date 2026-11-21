import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/api.dart';
import 'package:soco/auth_screen.dart';
import 'package:soco/demo.dart';
import 'package:soco/state/app_providers.dart';

class PasswordAuthDemoApi extends DemoApi {
  Json? credentials;
  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    if (method == 'POST' && path == '/api/auth/login') {
      credentials = body;
      if (body?['password'] != 'secure-password') {
        throw const ApiError('Invalid credentials', 401);
      }
      return {
        'token': 'test-token',
        'refreshToken': 'test-refresh',
        'user': {'id': 1, 'username': 'minhanh'},
      };
    }
    return super.request(method, path, body);
  }

  @override
  Future<void> authenticate(Json value) async {
    session = value;
  }
}

Future<void> showAuth(
  WidgetTester tester,
  PasswordAuthDemoApi api,
  VoidCallback onAuthenticated,
) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [apiProvider.overrideWithValue(api)],
      child: MaterialApp(
        home: AuthScreen(
          api: api,
          onAuthenticated: onAuthenticated,
          onDemo: () {},
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('mobile login defaults to password and can switch to email OTP', (
    tester,
  ) async {
    final api = PasswordAuthDemoApi();
    await showAuth(tester, api, () {});
    expect(find.byKey(const ValueKey('auth-password-input')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('auth-toggle-method')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('auth-password-input')), findsNothing);
    expect(find.text('Gửi mã OTP'), findsOneWidget);
  });

  testWidgets('register mode uses email verification and hides password', (
    tester,
  ) async {
    final api = PasswordAuthDemoApi();
    await showAuth(tester, api, () {});
    await tester.tap(find.text('Tạo tài khoản'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('auth-password-input')), findsNothing);
    expect(find.text('Gửi mã xác minh'), findsOneWidget);
  });

  testWidgets(
    'password login handles server success without persisting password',
    (tester) async {
      final api = PasswordAuthDemoApi();
      var authenticated = 0;
      await showAuth(tester, api, () => authenticated++);
      await tester.enterText(find.byType(TextField).first, 'demo@example.com');
      await tester.enterText(
        find.byKey(const ValueKey('auth-password-input')),
        'secure-password',
      );
      await tester.tap(find.text('Đăng nhập').last);
      await tester.pumpAndSettle();
      expect(api.credentials?['email'], 'demo@example.com');
      expect(api.credentials?['password'], 'secure-password');
      expect(authenticated, 1);
      expect(api.session?['token'], 'test-token');
    },
  );

  testWidgets('password login shows 401 error without authenticating', (
    tester,
  ) async {
    final api = PasswordAuthDemoApi();
    var authenticated = 0;
    await showAuth(tester, api, () => authenticated++);
    await tester.enterText(find.byType(TextField).first, 'demo@example.com');
    await tester.enterText(
      find.byKey(const ValueKey('auth-password-input')),
      'wrong',
    );
    await tester.tap(find.text('Đăng nhập').last);
    await tester.pumpAndSettle();
    expect(authenticated, 0);
    expect(
      find.textContaining('Email hoặc mật khẩu không đúng'),
      findsOneWidget,
    );
  });
}
