import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';

Future<void> openContacts(WidgetTester tester, DemoApi api) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(SocoApp(api: api));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('nav-contacts')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('directory has all six latest PWA subpages, including AI calls', (
    tester,
  ) async {
    await openContacts(tester, DemoApi());
    for (var tab = 0; tab < 6; tab++) {
      expect(find.byKey(ValueKey('contacts-tab-$tab')), findsOneWidget);
    }
    await tester.ensureVisible(find.byKey(const ValueKey('contacts-tab-5')));
    await tester.tap(find.byKey(const ValueKey('contacts-tab-5')));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('call-translation-screen')),
      findsOneWidget,
    );
    expect(find.text('Dịch thời gian thực'), findsOneWidget);
    expect(find.text('Chế độ phụ đề'), findsOneWidget);
    expect(find.byKey(const ValueKey('call-translation-save')), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Xem trước phụ đề'),
      250,
      scrollable: find.descendant(
        of: find.byKey(const ValueKey('call-translation-screen')),
        matching: find.byType(Scrollable),
      ),
    );
    expect(find.text('Xem trước phụ đề'), findsOneWidget);
  });

  testWidgets(
    'tap friend opens icon-only contact profile, never jumps to chat',
    (tester) async {
      await openContacts(tester, DemoApi());
      await tester.tap(find.byKey(const ValueKey('friend-row-2')));
      await tester.pumpAndSettle();
      expect(find.text('Thông tin bạn bè'), findsWidgets);
      expect(
        find.byKey(const ValueKey('friend-profile-content')),
        findsOneWidget,
      );
      expect(find.byTooltip('Nhắn tin'), findsOneWidget);
      expect(find.byTooltip('Gọi thoại'), findsOneWidget);
      expect(find.text('Đặt biệt danh'), findsOneWidget);
      expect(find.text('Ghim'), findsOneWidget);
      expect(find.text('Chặn'), findsOneWidget);
      expect(find.text('Báo cáo'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Hủy kết bạn'),
        180,
        scrollable: find.descendant(
          of: find.byKey(const ValueKey('friend-profile-content')),
          matching: find.byType(Scrollable),
        ),
      );
      expect(find.text('Hủy kết bạn'), findsOneWidget);
      expect(find.byKey(const ValueKey('mobile-avatar-rail')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('friend-profile-close')));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('friend-profile-content')),
        findsNothing,
      );
    },
  );

  testWidgets('nickname saves to server and favorite filter uses metadata', (
    tester,
  ) async {
    final api = DemoApi();
    await openContacts(tester, api);
    await tester.tap(find.byKey(const ValueKey('friend-row-2')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Đặt biệt danh'));
    await tester.tap(find.text('Đặt biệt danh'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('contact-edit-nickname')),
      'Bạn Linh',
    );
    await tester.tap(find.text('Lưu').last);
    await tester.pumpAndSettle();
    expect(api.contactMetadata[2]?['nickname'], 'Bạn Linh');
    expect(find.text('Bạn Linh'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('friend-row-2')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Ghim'));
    await tester.tap(find.text('Ghim'));
    await tester.pumpAndSettle();
    expect(api.contactMetadata[2]?['favorite'], isTrue);
    await tester.tap(find.text('Yêu thích'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('friend-row-2')), findsOneWidget);
    expect(find.byKey(const ValueKey('friend-row-3')), findsNothing);
  });

  testWidgets('invitation subpage has incoming, sent, QR, and own QR card', (
    tester,
  ) async {
    await openContacts(tester, DemoApi());
    await tester.tap(find.text('Kết bạn mới'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('friend-invitation-screen')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('invitation-incoming')), findsOneWidget);
    expect(find.byKey(const ValueKey('invitation-sent')), findsOneWidget);
    expect(find.byKey(const ValueKey('invitation-qr')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('invitation-sent')));
    await tester.pumpAndSettle();
    expect(find.text('Đã gửi'), findsWidgets);
    await tester.tap(find.byKey(const ValueKey('invitation-qr')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('contacts-own-qr')), findsOneWidget);
    expect(find.byKey(const ValueKey('invitations-scan-qr')), findsOneWidget);
    expect(find.byKey(const ValueKey('contacts-copy-qr-link')), findsOneWidget);
  });

  testWidgets('friend discovery has stats and invitation summary', (
    tester,
  ) async {
    await openContacts(tester, DemoApi());
    await tester.ensureVisible(find.byKey(const ValueKey('contacts-tab-4')));
    await tester.tap(find.byKey(const ValueKey('contacts-tab-4')));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('contacts-discovery-stats')),
      findsOneWidget,
    );
    expect(find.text('Gợi ý kết nối hiện có'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('discover-open-invitations')),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('discover-open-invitations')));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('friend-invitation-screen')),
      findsOneWidget,
    );
  });

  testWidgets('search directory includes users who are not yet friends', (
    tester,
  ) async {
    await openContacts(tester, DemoApi());
    await tester.enterText(
      find.byKey(const ValueKey('friends-local-search')),
      'hoang',
    );
    await tester.pumpAndSettle();
    expect(find.text('Kết quả tìm kiếm'), findsOneWidget);
    expect(find.byKey(const ValueKey('contact-search-4')), findsOneWidget);
    expect(find.text('Kết bạn'), findsOneWidget);
  });

  testWidgets('call history has statistics, search and details', (
    tester,
  ) async {
    await openContacts(tester, DemoApi());
    await tester.ensureVisible(find.byKey(const ValueKey('contacts-tab-3')));
    await tester.tap(find.byKey(const ValueKey('contacts-tab-3')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('calls-statistics')), findsOneWidget);
    expect(find.text('Cuộc gọi tháng này'), findsOneWidget);
    expect(find.text('Cuộc gọi nhỡ'), findsWidgets);
    expect(find.byKey(const ValueKey('calls-local-search')), findsOneWidget);
    await tester.enterText(
      find.byKey(const ValueKey('calls-local-search')),
      'không có ai',
    );
    await tester.pumpAndSettle();
    expect(find.text('Chưa có cuộc gọi'), findsOneWidget);
    await tester.tap(find.byTooltip('Xóa tìm kiếm cuộc gọi'));
    await tester.pumpAndSettle();
    expect(find.text('Cuộc gọi gần đây'), findsOneWidget);
  });
}
