import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';
import 'package:soco/api.dart';
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

class _SlowPreferencesApi extends DemoApi {
  final preferencesGate = Completer<void>();
  bool delayPreferences = false;
  int historyStarts = 0;

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    if (delayPreferences && method == 'GET' && path == '/api/preferences') {
      await preferencesGate.future;
    }
    if (delayPreferences &&
        method == 'GET' &&
        RegExp(r'/api/conversations/\d+/messages\?').hasMatch(path)) {
      historyStarts++;
    }
    return super.request(method, path, body);
  }
}

class _WarmHistoryApi extends DemoApi {
  final secondLoad = Completer<void>();
  int historyReads = 0;
  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    if (method == 'GET' && path.startsWith('/api/conversations/2/messages?')) {
      historyReads++;
      if (historyReads == 2) await secondLoad.future;
    }
    return super.request(method, path, body);
  }
}

void main() {
  testWidgets('channel photo editor removes only the selected channel avatar', (
    tester,
  ) async {
    final api = DemoApi();
    api.rooms.first['avatarUrl'] = 'https://example.invalid/group.png';
    api.channels[1]!.last['avatarUrl'] = 'https://example.invalid/channel.png';
    api.preferences['autoTranslate'] = false;
    await openChatParityDemo(tester, api);
    await tester.tap(find.text('SocCO Design Team').first);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('mobile-channel-5')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('chat-more-actions')));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Đổi ảnh kênh'));
    await tester.pumpAndSettle();
    expect(find.text('Đổi ảnh kênh'), findsOneWidget);
    await tester.tap(find.text('Gỡ ảnh'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lưu ảnh'));
    await tester.pumpAndSettle();
    expect(api.channels[1]!.last['avatarUrl'], '');
    expect(api.rooms.first['avatarUrl'], 'https://example.invalid/group.png');
    expect(find.text('Đổi ảnh kênh'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });

  testWidgets(
    'recent conversation remains visible during history revalidation',
    (tester) async {
      final api = _WarmHistoryApi();
      api.preferences['autoTranslate'] = false;
      api.rooms.firstWhere((room) => room['id'] == 2)['unreadCount'] = 0;
      for (final message in api.messages[2]!) {
        message.remove('firstUnreadMessageId');
      }
      await openChatParityDemo(tester, api);
      await tester.tap(find.text('Linh Nguyễn').first);
      await tester.pumpAndSettle();
      final latestMessage = api.messages[2]!.last['text'].toString();
      expect(find.text(latestMessage), findsOneWidget);
      await tester.tap(find.byTooltip('Quay lại'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Linh Nguyễn').first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 220));
      expect(api.historyReads, 2);
      expect(find.text(latestMessage), findsOneWidget);
      api.secondLoad.complete();
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    },
  );

  testWidgets('conversation history starts before slow preferences finish', (
    tester,
  ) async {
    final api = _SlowPreferencesApi();
    api.preferences['autoTranslate'] = false;
    await openChatParityDemo(tester, api);
    api.delayPreferences = true;
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(api.historyStarts, greaterThan(0));
    api.preferencesGate.complete();
    await tester.pumpAndSettle();
    expect(find.byTooltip('Gửi Like'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });

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

  testWidgets('Like and Send share a fixed composer action', (
    tester,
  ) async {
    final api = DemoApi();
    await openChatParityDemo(tester, api);
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    final action = find.byKey(const ValueKey('composer-primary-action'));
    final input = find.byType(TextField).last;
    expect(find.byTooltip('Gửi Like'), findsOneWidget);
    expect(find.byTooltip('Gửi tin nhắn'), findsNothing);
    final initialSize = tester.getSize(action);
    final initialPosition = tester.getTopLeft(action);
    await tester.enterText(input, '   ');
    await tester.pump();
    expect(find.byTooltip('Gửi Like'), findsOneWidget);
    await tester.enterText(input, 'Bản nháp');
    await tester.pump();
    expect(find.byTooltip('Gửi Like'), findsNothing);
    expect(find.byTooltip('Gửi tin nhắn'), findsOneWidget);
    expect(tester.getSize(action), initialSize);
    expect(tester.getTopLeft(action), initialPosition);
    await tester.enterText(input, '');
    await tester.pump();
    expect(find.byTooltip('Gửi Like'), findsOneWidget);
    await tester.tap(action);
    await tester.pumpAndSettle();
    expect(find.text('👍'), findsOneWidget);
    await tester.enterText(input, 'Bản nháp');
    await tester.pump();
    await tester.tap(action);
    await tester.pumpAndSettle();
    expect(find.text('Bản nháp'), findsOneWidget);
    expect(tester.widget<TextField>(input).controller?.text, isEmpty);
    expect(find.byTooltip('Gửi Like'), findsOneWidget);
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
