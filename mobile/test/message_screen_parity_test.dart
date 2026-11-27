import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';
import 'package:soco/presentation/channel_list_presenter.dart';
import 'package:soco/presentation/conversation_avatar.dart';
import 'package:soco/widgets.dart';

Future<void> openChatParityDemo(WidgetTester tester, DemoApi api) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(SocoApp(api: api));
  await tester.pumpAndSettle();
}

void main() {
  test(
    'PWA channel search includes topic and latest message, not name alone',
    () {
      final entries = channelPreviews([
        {
          'id': 0,
          'name': 'Server general',
          'lastMessage': 'should not duplicate',
        },
        {
          'id': 5,
          'name': 'Thiết kế UI',
          'description': 'Bản vẽ giao diện',
          'lastMessage': 'Đã sửa màu nền',
          'lastMessageAt': '2026-11-17T10:05:00+07:00',
          'unreadCount': 102,
          'muted': true,
        },
      ]);
      expect(entries.length, 2);
      expect(entries.first.id, 0);
      expect(entries.first.lastMessage, 'should not duplicate');
      expect(entries.last.name, 'Thiết kế UI');
      expect(entries.last.unreadCount, 102);
      expect(entries.last.muted, isTrue);
      expect(
        channelPreviews([
          {
            'id': 5,
            'name': 'Thiết kế UI',
            'description': 'Bản vẽ giao diện',
            'lastMessage': 'Đã sửa màu nền',
          },
        ], query: 'bản vẽ').single.id,
        5,
      );
      expect(
        channelPreviews([
          {
            'id': 5,
            'name': 'Thiết kế UI',
            'description': 'Bản vẽ giao diện',
            'lastMessage': 'Đã sửa màu nền',
          },
        ], query: 'MÀU NỀN').single.id,
        5,
      );
      expect(channelPreviews([], query: 'không có'), isEmpty);
      expect(entries.last.initials, 'BD');
      expect(
        channelPreviewTime(
          '2026-11-17T10:05:00+07:00',
          now: DateTime(2026, 11, 18),
        ),
        '17/11',
      );
      expect(channelPreviewTime('not a timestamp'), '');
    },
  );

  testWidgets('inbox uses compact avatar rows and group participant cluster', (
    tester,
  ) async {
    final api = DemoApi();
    api.rooms.first['avatarMembers'] = ['linhnguyen', 'alexchen', 'hoangnam'];
    await openChatParityDemo(tester, api);
    final groupRow = find.byKey(const ValueKey('rail-room-1'));
    expect(groupRow, findsOneWidget);
    expect(tester.getSize(groupRow).height, closeTo(46, 5));
    final cluster = find.descendant(
      of: groupRow,
      matching: find.byType(ConversationAvatarView),
    );
    expect(cluster, findsOneWidget);
    expect(
      find.descendant(of: cluster, matching: find.byType(UserAvatar)),
      findsNWidgets(3),
    );
    expect(find.text('SocCO Design Team'), findsOneWidget);
  });

  testWidgets('group messages show sender portrait, own messages do not', (
    tester,
  ) async {
    await openChatParityDemo(tester, DemoApi());
    await tester.tap(find.text('SocCO Design Team').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thảo luận chung'));
    await tester.pumpAndSettle();

    final received = find.byKey(const ValueKey('chat-message-10'));
    final own = find.byKey(const ValueKey('chat-message-12'));
    expect(received, findsOneWidget);
    expect(own, findsOneWidget);
    expect(
      find.descendant(of: received, matching: find.byType(UserAvatar)),
      findsOneWidget,
    );
    expect(
      find.descendant(of: own, matching: find.byType(UserAvatar)),
      findsNothing,
    );
  });

  testWidgets('hamburger remains available for group picker without arrow', (
    tester,
  ) async {
    await openChatParityDemo(tester, DemoApi());
    expect(find.byKey(const ValueKey('mobile-chat-menu')), findsOneWidget);
    await tester.tap(find.text('SocCO Design Team').first);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('mobile-avatar-toggle')), findsNothing);
    expect(find.byKey(const ValueKey('mobile-chat-menu')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('mobile-chat-menu')));
    await tester.pumpAndSettle();
    expect(find.text('Tìm hội thoại'), findsOneWidget);
    expect(find.text('Phân loại'), findsOneWidget);
    expect(find.text('Tạo cuộc trò chuyện'), findsOneWidget);
    await tester.tap(find.text('Mở rộng cột avatar').last);
    await tester.pumpAndSettle();
    expect(
      tester
          .getSize(find.byKey(const ValueKey('mobile-avatar-viewport')))
          .width,
      closeTo(390, 1),
    );
    expect(find.byKey(const ValueKey('mobile-channel-picker')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('mobile-chat-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tìm hội thoại').last);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<TextField>(find.byKey(const ValueKey('mobile-chat-search')))
          .focusNode
          ?.hasFocus,
      isTrue,
    );
  });

  testWidgets('direct conversation opens information panel, not group menu', (
    tester,
  ) async {
    await openChatParityDemo(tester, DemoApi());
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('chat-more-actions')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('chat-more-actions')));
    await tester.pumpAndSettle();
    expect(find.text('Thông tin hội thoại'), findsOneWidget);
    expect(find.text('Tắt thông báo hội thoại'), findsOneWidget);
    expect(find.text('Xóa lịch sử trò chuyện'), findsOneWidget);
    expect(find.text('File phương tiện'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('chat-info-close')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('chat-info-close')), findsNothing);
  });

  testWidgets('main group shows group actions in information panel', (
    tester,
  ) async {
    await openChatParityDemo(tester, DemoApi());
    await tester.tap(find.text('SocCO Design Team').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thảo luận chung'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('chat-open-channel-picker')),
      findsNothing,
    );
    await tester.tap(find.byKey(const ValueKey('chat-more-actions')));
    await tester.pumpAndSettle();
    expect(find.text('Thông tin nhóm'), findsOneWidget);
    expect(find.text('Thành viên và quản lý nhóm'), findsOneWidget);
    expect(find.text('Tạo kênh'), findsOneWidget);
    expect(find.text('Tắt thông báo nhóm'), findsOneWidget);
  });

  testWidgets('quick Like sends alone and preserves the composed text', (tester) async {
    final api = DemoApi();
    await openChatParityDemo(tester, api);
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    final like = find.byKey(const ValueKey('composer-quick-like'));
    expect(like, findsOneWidget);
    final input = find.byType(TextField).last;
    await tester.enterText(input, 'Bản nháp');
    await tester.tap(like);
    await tester.pumpAndSettle();
    expect(find.text('👍'), findsOneWidget);
    expect(tester.widget<TextField>(input).controller?.text, 'Bản nháp');
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });

  testWidgets('composer exposes PWA separate file, media and emoji actions', (
    tester,
  ) async {
    final api = DemoApi();
    await openChatParityDemo(tester, api);
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('composer-quick-media')), findsOneWidget);
    await tester.tap(find.byTooltip('Thêm ảnh, file, emoji'));
    await tester.pumpAndSettle();
    expect(find.text('Tệp tin'), findsOneWidget);
    expect(find.text('Ảnh / Video'), findsOneWidget);
    expect(find.text('Emoji'), findsOneWidget);
  });

  testWidgets(
    'channel picker shows topic, preview, unread, and searches both',
    (tester) async {
      final api = DemoApi();
      api.channels[1]![0].addAll({
        'lastMessage': 'Thông báo chung',
        'unreadCount': 3,
      });
      api.channels[1]![1].addAll({
        'description': 'Bản vẽ giao diện',
        'lastMessage': 'Đã sửa màu nền',
        'unreadCount': 104,
        'muted': true,
      });
      await openChatParityDemo(tester, api);
      await tester.tap(find.text('SocCO Design Team').first);
      await tester.pumpAndSettle();

      expect(find.text('Bản vẽ giao diện'), findsOneWidget);
      expect(find.text('Đã sửa màu nền'), findsOneWidget);
      expect(find.text('Thông báo chung'), findsOneWidget);
      expect(find.text('99+'), findsOneWidget);
      expect(find.byKey(const ValueKey('mobile-channel-5')), findsOneWidget);

      await tester.enterText(
        find.byKey(const ValueKey('mobile-channel-search')),
        'màu nền',
      );
      await tester.pumpAndSettle();
      expect(find.text('Thiết kế UI'), findsOneWidget);
      expect(find.text('Thảo luận chung'), findsNothing);

      await tester.enterText(
        find.byKey(const ValueKey('mobile-channel-search')),
        'không tồn tại',
      );
      await tester.pumpAndSettle();
      expect(find.text('Không tìm thấy kênh phù hợp.'), findsOneWidget);
      await tester.tap(find.byTooltip('Xóa tìm kiếm kênh'));
      await tester.pumpAndSettle();
      expect(find.text('Thảo luận chung'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('mobile-channel-5')));
      await tester.pumpAndSettle();
      expect(find.text('Thiết kế UI'), findsWidgets);
      expect(find.text('Bản vẽ giao diện'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('chat-open-channel-picker')),
        findsNothing,
      );
      await tester.tap(find.byKey(const ValueKey('chat-more-actions')));
      await tester.pumpAndSettle();
      expect(find.text('Thông tin kênh'), findsOneWidget);
      expect(find.text('Quản lý kênh'), findsOneWidget);
      expect(find.text('Đổi tên kênh'), findsOneWidget);
      expect(find.text('File phương tiện'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('chat-info-close')));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Quay lại'));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('mobile-channel-picker')),
        findsOneWidget,
      );
    },
  );
}