import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';
import 'package:soco/api.dart';
import 'package:soco/presentation/notification_store.dart';
import 'package:soco/presentation/notification_presenter.dart';

class _OlderNotificationApi extends DemoApi {
  bool failChats = false;
  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    if (path == '/api/conversations?unread=true') {
      if (failChats) throw const ApiError('offline');
      return List.generate(
        105,
        (index) => {
          'id': 1000 + index,
          'name': 'Chat $index',
          'unreadCount': 7,
        },
      );
    }
    return super.request(method, path, body);
  }
}

void main() {
  test(
    'shared notification store includes old unread chats and retains confirmed data on failure',
    () async {
      final api = _OlderNotificationApi();
      final store = NotificationStore(api);
      await store.refresh();
      expect(store.items.where((item) => item.kind == 'message').length, 105);
      expect(store.unread, 107);
      api.failChats = true;
      await store.refresh();
      expect(store.unread, 107);
      expect(store.error, contains('tin nhắn'));
      store.dispose();
    },
  );

  test(
    'notifications aggregate actual incoming, unread and mention sources',
    () {
      final result = buildMobileNotifications(
        requests: [
          {'id': 4, 'direction': 'outgoing', 'displayName': 'Gửi đi'},
          {
            'id': 5,
            'direction': 'incoming',
            'displayName': 'Thảo',
            'updatedAt': '2026-11-18T12:00:00Z',
          },
        ],
        conversations: [
          {'id': 9, 'unreadCount': 0, 'name': 'Đã đọc'},
          {
            'id': 10,
            'unreadCount': 3,
            'name': 'Tin mới',
            'lastMessageAt': '2026-11-18T14:00:00Z',
          },
        ],
        mentions: [
          {
            'id': 40,
            'postId': 11,
            'author': 'Linh',
            'kind': 'quote',
            'createdAt': '2026-11-18T15:00:00Z',
            'readAt': null,
          },
        ],
      );
      expect(result.map((item) => item.key).toList(), [
        'mention:40',
        'chat:10',
        'friend:5',
      ]);
      expect(result.first.subtitle, 'đã trích dẫn bài viết của bạn');
      expect(filterMobileNotifications(result, filter: 'mentions').length, 1);
      expect(
        filterMobileNotifications(
          result,
          filter: 'unread',
          locallyRead: {'chat:10'},
        ).length,
        2,
      );
      expect(
        filterMobileNotifications(result, query: 'thảo').single.key,
        'friend:5',
      );
    },
  );

  testWidgets('notification sheet loads real data and opens unread chat', (
    tester,
  ) async {
    final api = DemoApi();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(SocoApp(api: api));
    await tester.pumpAndSettle();
    final badge = find.byKey(const ValueKey('header-notification-badge'));
    expect(
      find.descendant(of: badge, matching: find.text('3')),
      findsOneWidget,
    );
    await tester.tap(find.byTooltip('Thông báo'));
    await tester.pumpAndSettle();
    expect(find.text('3 thông báo chưa đọc'), findsOneWidget);

    expect(find.byKey(const ValueKey('notification-chat:2')), findsOneWidget);
    expect(find.byKey(const ValueKey('notification-friend:5')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('notification-mention:60')),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const ValueKey('notification-chat:2')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('notification-chat:2')), findsNothing);
    expect(find.text('Linh Nguyễn'), findsWidgets);
    // Chat pins and mention-member hydration are intentionally unawaited.
    // Let demo transport delays finish before the widget test disposes.
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
  });

  testWidgets('mention marks as read on server and navigates to post detail', (
    tester,
  ) async {
    final api = DemoApi();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(SocoApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Thông báo'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('notification-filter-mentions')),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('notification-mention:60')));
    await tester.pumpAndSettle();
    expect(api.postMentions.single['readAt'], isNotNull);
    expect(find.byKey(const ValueKey('post-detail-content')), findsOneWidget);
  });

  testWidgets('friend invitation can be accepted without stale fake toggles', (
    tester,
  ) async {
    final api = DemoApi();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(SocoApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Thông báo'));
    await tester.pumpAndSettle();

    final accept = find.byKey(const ValueKey('notification-accept-5'));
    await tester.ensureVisible(accept);
    await tester.tap(accept);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('notification-friend:5')), findsNothing);
    expect(find.text('2 thông báo chưa đọc'), findsOneWidget);
    expect(
      api.friends.any(
        (friend) => friend['id'] == 5 && friend['status'] == 'accepted',
      ),
      isTrue,
    );
    expect(find.text('Tin nhắn mới'), findsNothing);
  });
}
