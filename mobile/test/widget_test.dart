import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';
import 'package:soco/profile_qr.dart';

void main() {
  testWidgets('demo opens responsive SOCO shell', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();

    expect(find.text('SOCO'), findsWidgets);
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
    expect(find.text('SOCO'), findsWidgets);
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
    await tester.tap(find.text('SOCO Design Team').first);
    await tester.pumpAndSettle();
    expect(find.textContaining('Sẵn sàng!'), findsOneWidget);
    expect(find.byKey(const ValueKey('web-appbar')), findsOneWidget);
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

    expect(find.text('SOCO SECURE CALL'), findsOneWidget);
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

    expect(find.text('Tin nhắn mới'), findsOneWidget);
    expect(find.text('Kết bạn'), findsOneWidget);
    expect(find.text('Cuộc gọi'), findsOneWidget);
    expect(find.text('Chốt bản demo sáng mai nhé!'), findsWidgets);
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

    expect(find.text('Profile'), findsNothing);
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
