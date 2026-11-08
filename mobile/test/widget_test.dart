import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/auth_screen.dart';
import 'package:soco/demo.dart';
import 'package:soco/profile_qr.dart';
import 'package:soco/call_surface.dart';
import 'package:soco/api.dart';

class _CountingDemoApi extends DemoApi {
  final calls = <String>[];
  final updates = StreamController<void>.broadcast();
  int translating = 0;
  int peakTranslations = 0;

  @override
  Stream<void> events() => updates.stream;

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    calls.add('$method $path');
    if (path == '/api/translate') {
      translating++;
      if (translating > peakTranslations) peakTranslations = translating;
      try {
        await Future<void>.delayed(const Duration(milliseconds: 40));
        return await super.request(method, path, body);
      } finally {
        translating--;
      }
    }
    return super.request(method, path, body);
  }

  @override
  void dispose() {
    updates.close();
    super.dispose();
  }
}

void main() {
  testWidgets('Zalo-style navigation stays below the main screens', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('bottom-navigation')), findsOneWidget);
    expect(find.text('Tin nhắn'), findsOneWidget);
    expect(find.byKey(const ValueKey('chat-filter-all')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('chat-filter-unread')));
    await tester.pumpAndSettle();
    expect(find.text('SocCO Design Team'), findsNothing);
    expect(find.text('Linh Nguyễn'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('chat-filter-all')));
    await tester.pumpAndSettle();
    expect(find.text('SocCO Design Team'), findsOneWidget);

    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('web-appbar')), findsNothing);
    expect(find.byKey(const ValueKey('bottom-navigation')), findsNothing);
    await tester.tap(find.byTooltip('Quay lại'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('bottom-navigation')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('auth mirrors Web login, register and OTP choices', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: AuthScreen(api: Api(), onAuthenticated: () {}, onDemo: () {}),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chào mừng trở lại 👋'), findsOneWidget);
    expect(find.text('Mật khẩu'), findsOneWidget);

    await tester.tap(find.text('Tạo tài khoản').first);
    await tester.pumpAndSettle();
    expect(find.text('Tạo tài khoản SocCo'), findsOneWidget);
    expect(find.textContaining('Tài khoản được tạo sau'), findsOneWidget);

    await tester.tap(find.text('Đăng nhập').first);
    await tester.pumpAndSettle();
    expect(find.text('Mật khẩu'), findsOneWidget);
    await tester.ensureVisible(find.text('Đăng nhập bằng mã OTP qua email'));
    await tester.tap(find.text('Đăng nhập bằng mã OTP qua email'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Nhập mã OTP được gửi'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('unused tabs do not fetch data before first visit', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final api = _CountingDemoApi();
    addTearDown(api.dispose);

    await tester.pumpWidget(SocoApp(api: api));
    await tester.pumpAndSettle();
    expect(api.calls.any((call) => call.contains('/api/posts')), isFalse);
    expect(
      api.calls.any((call) => call.contains('/api/groups/public')),
      isFalse,
    );
    expect(api.calls.any((call) => call.contains('/api/friends')), isFalse);

    await tester.tap(find.byKey(const ValueKey('nav-feed')));
    await tester.pumpAndSettle();
    expect(api.calls.any((call) => call.contains('/api/posts')), isTrue);
    await tester.tap(find.byKey(const ValueKey('nav-chat')));
    await tester.pumpAndSettle();
    expect(find.text('Trò chuyện'), findsOneWidget);
  });

  testWidgets('chat batches realtime updates and pauses offscreen', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final api = _CountingDemoApi();
    addTearDown(api.dispose);
    await tester.pumpWidget(SocoApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('SocCO Design Team').first);
    await tester.pumpAndSettle();

    api.calls.clear();
    for (var i = 0; i < 12; i++) {
      api.updates.add(null);
    }
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(
      api.calls
          .where((call) => call.contains('/api/conversations/1/messages'))
          .length,
      1,
    );
    expect(api.calls.any((call) => call.contains('/api/preferences')), isFalse);
    expect(
      api.calls.any((call) => call.contains('/api/conversations/1/read')),
      isFalse,
    );

    await tester.tap(find.byTooltip('Quay lại'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-feed')));
    await tester.pumpAndSettle();
    api.calls.clear();
    api.updates.add(null);
    await tester.pump(const Duration(milliseconds: 450));
    expect(
      api.calls.any((call) => call.contains('/api/conversations')),
      isFalse,
    );
  });

  testWidgets('auto translate limits concurrent requests on long chats', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final api = _CountingDemoApi();
    addTearDown(api.dispose);
    for (var i = 0; i < 12; i++) {
      api.messages[1]!.add(
        api.message(1000 + i, 1, 2, 'Linh Nguyễn', 'Một tin nhắn cần dịch $i'),
      );
    }

    await tester.pumpWidget(SocoApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('SocCO Design Team').first);
    await tester.pumpAndSettle();

    expect(api.peakTranslations, lessThanOrEqualTo(3));
    expect(
      api.calls.where((call) => call.contains('/api/translate')).length,
      greaterThanOrEqualTo(12),
    );
  });

  testWidgets('real mobile calls do not show a simulated connection', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showCallSurface(
                context,
                api: Api(),
                conversation: const {},
                video: true,
              ),
              child: const Text('Call'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Call'));
    await tester.pump();
    expect(find.textContaining('chưa được hỗ trợ'), findsOneWidget);
    expect(find.text('SocCO SECURE CALL'), findsNothing);
  });

  testWidgets('demo opens responsive SocCO shell', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();

    expect(find.text('SocCO'), findsWidgets);
    expect(find.text('Trò chuyện'), findsOneWidget);
    expect(find.text('Kết nối'), findsOneWidget);
    expect(find.text('14:00'), findsNWidgets(3));
    expect(find.byKey(const ValueKey('web-appbar')), findsOneWidget);
    expect(find.byKey(const ValueKey('bottom-navigation')), findsOneWidget);
    expect(find.byKey(const ValueKey('nav-chat')), findsOneWidget);
    expect(find.byKey(const ValueKey('nav-contacts')), findsOneWidget);
    expect(find.byKey(const ValueKey('nav-discover')), findsOneWidget);
    expect(find.byKey(const ValueKey('nav-feed')), findsOneWidget);
    expect(find.byKey(const ValueKey('nav-profile')), findsOneWidget);
  });

  testWidgets('desktop keeps web appbar and bottom navigation', (tester) async {
    tester.view.physicalSize = const Size(1440, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('web-appbar')), findsOneWidget);
    expect(find.byKey(const ValueKey('bottom-navigation')), findsOneWidget);
    expect(find.text('SocCO'), findsWidgets);
    expect(find.text('Kết nối'), findsOneWidget);
  });

  testWidgets('web parity controls stay visible across primary tabs', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('nav-contacts')));
    await tester.pumpAndSettle();
    expect(find.text('Lời mời kết bạn'), findsWidgets);
    expect(find.text('Nhóm và cộng đồng'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('nav-feed')));
    await tester.pumpAndSettle();
    expect(find.text('Ảnh'), findsOneWidget);
    expect(find.text('Video'), findsOneWidget);
    expect(find.text('Album'), findsOneWidget);
    expect(find.text('Nền chữ'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('nav-discover')));
    await tester.pumpAndSettle();
    expect(find.text('Tên hoặc @username'), findsOneWidget);
    expect(find.text('5 km'), findsOneWidget);
    expect(find.text('Bật và tìm người'), findsOneWidget);
  });

  testWidgets('open chat survives mobile to tablet resize', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('SocCO Design Team').first);
    await tester.pumpAndSettle();
    expect(find.textContaining('Sẵn sàng!'), findsOneWidget);
    expect(find.byKey(const ValueKey('web-appbar')), findsNothing);
    expect(find.byKey(const ValueKey('bottom-navigation')), findsNothing);
    tester.view.physicalSize = const Size(900, 1100);
    await tester.pumpAndSettle();

    expect(find.textContaining('Sẵn sàng!'), findsOneWidget);
    expect(find.byTooltip('Gọi video'), findsOneWidget);
  });

  testWidgets('contact message opens matching conversation', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-contacts')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nhắn tin').first);
    await tester.pumpAndSettle();

    expect(find.text('Linh Nguyễn'), findsWidgets);
    expect(find.textContaining('Bản dịch minh họa.'), findsOneWidget);
    await tester.tap(find.text('Hiện bản gốc'));
    await tester.pumpAndSettle();
    expect(find.text('Mình vừa cập nhật bảng màu mới.'), findsOneWidget);
    expect(find.text('Hai bạn đã là bạn bè'), findsOneWidget);
  });

  testWidgets('mobile chat exposes translation and shared content actions', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();

    expect(find.byTooltip('Nội dung đã chia sẻ'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('chat-translation-action')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('conversation-day-divider')),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('chat-translation-action')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('chat-auto-translate')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('chat-translation-language')),
      findsOneWidget,
    );
  });

  testWidgets('message long press supports copy', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async => null,
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    await tester.longPress(find.textContaining('Bản dịch minh họa.'));
    await tester.pumpAndSettle();

    expect(find.text('Sao chép'), findsOneWidget);
    await tester.tap(find.text('Sao chép'));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Đã sao chép tin nhắn.'), findsOneWidget);
  });

  testWidgets('quick create opens direct and group chat actions', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('quick-create')));
    await tester.pumpAndSettle();

    expect(find.text('Chat riêng'), findsOneWidget);
    expect(find.text('Tạo nhóm'), findsOneWidget);
  });

  testWidgets('nearby places has offline demo results', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-discover')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Địa điểm'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dùng vị trí hiện tại'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Bếp Nhà Sài Gòn'), findsOneWidget);
    expect(find.textContaining('OpenStreetMap'), findsWidgets);
  });

  testWidgets('video call opens complete demo surface', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Gọi video'));
    await tester.pump();

    expect(find.text('SocCO SECURE CALL'), findsOneWidget);
    expect(find.text('Tắt mic'), findsOneWidget);
    expect(find.text('Tắt camera'), findsOneWidget);
    expect(find.text('Kết thúc'), findsOneWidget);
  });

  testWidgets('tablet notifications show real friend and unread-chat actions', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(834, 1112);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-feed')));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Thông báo'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Thông báo mới'), findsOneWidget);
    expect(find.text('Phương Thảo'), findsOneWidget);
    expect(find.text('Chưa đọc'), findsOneWidget);
    await tester.tap(find.text('Phương Thảo'));
    await tester.pumpAndSettle();
    expect(find.text('Chấp nhận lời mời'), findsOneWidget);
    expect(find.text('Từ chối'), findsOneWidget);
  });

  testWidgets('group navigation opens responsive group management', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-groups')));
    await tester.pumpAndSettle();

    expect(find.text('Nhóm & cộng đồng'), findsOneWidget);
    expect(find.text('Tạo nhóm'), findsOneWidget);
    expect(find.text('SocCO Design Team'), findsOneWidget);
    await tester.tap(find.byTooltip('Quản lý nhóm').first);
    await tester.pumpAndSettle();
    expect(find.text('Kênh thảo luận'), findsOneWidget);
    expect(find.text('Trò chuyện chung'), findsOneWidget);
  });

  testWidgets('profile QR dialog renders without camera startup', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-profile')));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('QR của tôi'));
    await tester.pumpAndSettle();

    expect(find.text('Kết nối bằng QR'), findsOneWidget);
    expect(find.text('QR của tôi'), findsOneWidget);
    expect(find.text('Sao chép link hồ sơ'), findsOneWidget);
  });

  testWidgets('profile language picker filters catalog', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-profile')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Ngôn ngữ ứng dụng'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ngôn ngữ ứng dụng'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'ja');
    await tester.pumpAndSettle();

    expect(find.text('日本語'), findsOneWidget);
    expect(find.text('Việt Nam'), findsNothing);
  });

  testWidgets('app language preference updates visible UI bundle', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-profile')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Ngôn ngữ ứng dụng'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ngôn ngữ ứng dụng'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();

    expect(find.text('Profile'), findsWidgets);
    expect(find.text('App language'), findsOneWidget);
    expect(find.text('Log out'), findsOneWidget);
  });

  testWidgets('narrow 320px phone keeps community tab usable', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-groups')));
    await tester.pumpAndSettle();

    expect(find.text('Nhóm & cộng đồng'), findsOneWidget);
    expect(find.byKey(const ValueKey('bottom-navigation')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('profile QR validates same-origin connect links', () {
    expect(
      profileFromQr('https://chat.codelocal.cloud/?connect=linh.nguyen', 'me'),
      'linh.nguyen',
    );
    expect(
      () => profileFromQr('https://example.com/?connect=linh', 'me'),
      throwsFormatException,
    );
    expect(
      () => profileFromQr('https://chat.codelocal.cloud/?connect=me', 'me'),
      throwsFormatException,
    );
  });
}
