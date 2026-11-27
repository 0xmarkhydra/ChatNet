import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';
import 'package:soco/profile_qr.dart';
import 'package:soco/call_surface.dart';
import 'package:soco/api.dart';

void main() {
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

    expect(find.byKey(const ValueKey('mobile-avatar-rail')), findsOneWidget);
    expect(find.byKey(const ValueKey('mobile-chat-search')), findsOneWidget);
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
    expect(find.byKey(const ValueKey('web-appbar')), findsOneWidget);
    expect(find.byKey(const ValueKey('connect-action')), findsOneWidget);
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
    expect(find.text('Bạn bè'), findsWidgets);
    expect(find.text('Nhóm chat'), findsWidgets);
    expect(find.text('Lời mời'), findsWidgets);
    expect(find.byKey(const ValueKey('friends-local-search')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('nav-feed')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('feed-composer-open')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('feed-composer-open')));
    await tester.pumpAndSettle();
    expect(find.text('Gắn thẻ'), findsOneWidget);
    expect(find.text('Vị trí'), findsOneWidget);
    await tester.tap(find.byTooltip('Đóng').last);
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('nav-discover')));
    await tester.pumpAndSettle();
    // PWA parity: Discover opens on 'Tất cả'; Nearby is its fifth tab.
    await tester.drag(
      find.byKey(const ValueKey('explore-horizontal-tabs')),
      const Offset(-500, 0),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('explore-tab-recent')));
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
    expect(find.byKey(const ValueKey('mobile-channel-picker')), findsOneWidget);
    await tester.tap(find.text('Thảo luận chung'));
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
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('friend-profile-content')),
      findsOneWidget,
    );
    await tester.tap(find.byTooltip('Nhắn tin'));
    await tester.pumpAndSettle();

    expect(find.text('Linh Nguyễn'), findsWidgets);
    expect(find.textContaining('Bản dịch minh họa.'), findsOneWidget);
    await tester.tap(find.text('Hiện bản gốc'));
    await tester.pumpAndSettle();
    expect(find.text('Mình vừa cập nhật bảng màu mới.'), findsOneWidget);
    expect(find.textContaining('Bản dịch minh họa.'), findsNothing);
    await tester.tap(find.text('Hiện VI · AI'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Bản dịch minh họa.'), findsOneWidget);
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

    expect(find.byKey(const ValueKey('chat-more-actions')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('chat-translation-action')),
      findsOneWidget,
    );
    expect(
      find.byWidgetPredicate((widget) {
        final key = widget.key;
        return key is ValueKey<String> &&
            key.value.startsWith('conversation-day-divider-');
      }),
      findsWidgets,
    );
    await tester.tap(find.byKey(const ValueKey('chat-translation-action')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('chat-auto-translate')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('chat-translation-language')),
      findsOneWidget,
    );
    await tester.tapAt(const Offset(16, 180));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('chat-more-actions')));
    await tester.pumpAndSettle();
    expect(find.text('File phương tiện'), findsOneWidget);
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

  testWidgets('mobile inbox offers conversation filters', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('mobile-avatar-rail')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('mobile-chat-menu')));
    await tester.pumpAndSettle();
    expect(find.text('Tất cả'), findsOneWidget);
    expect(find.text('Chưa đọc'), findsOneWidget);
    expect(find.text('Nhóm'), findsOneWidget);
  });

  testWidgets('nearby places has offline demo results', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-discover')));
    await tester.pumpAndSettle();
    // PWA parity: Discover opens on 'Tất cả'; Nearby is its fifth tab.
    await tester.drag(
      find.byKey(const ValueKey('explore-horizontal-tabs')),
      const Offset(-500, 0),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('explore-tab-recent')));
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
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('SocCO SECURE CALL'), findsOneWidget);
    expect(find.text('Tắt mic'), findsOneWidget);
    expect(find.text('Tắt camera'), findsOneWidget);
    expect(find.text('Kết thúc'), findsOneWidget);
  });

  testWidgets('tablet notification button opens preferences and activity', (
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

    // The PWA-aligned notification sheet now shows real activity rather than
    // the legacy notification-preferences mock.
    expect(
      find.byKey(const ValueKey('notification-filter-all')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('notification-filter-unread')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('notification-filter-mentions')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('notification-chat:2')), findsOneWidget);
    expect(find.byKey(const ValueKey('notification-friend:5')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('notification-mention:60')),
      findsOneWidget,
    );
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
    await tester.tap(find.byKey(const ValueKey('profile-settings-open')));
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

    final api = DemoApi();
    await tester.pumpWidget(SocoApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-profile')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('profile-settings-open')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Ngôn ngữ ứng dụng'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ngôn ngữ ứng dụng'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();

    expect(api.preferences['appLocale'], 'en');
    expect(find.byKey(const ValueKey('profile-back')), findsOneWidget);
    expect(find.text('App language'), findsOneWidget);
    expect(find.text('Log out'), findsOneWidget);
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