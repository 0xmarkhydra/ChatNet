import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';
import 'package:soco/feed_post_links.dart';

Future<void> openMobile(WidgetTester tester, DemoApi api) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(SocoApp(api: api));
  await tester.pumpAndSettle();
}

Future<void> openDirectChat(WidgetTester tester) async {
  await tester.tap(find.text('Linh Nguyễn').first);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('mobile tabs initialize on first visit and retain their state', (
    tester,
  ) async {
    await openMobile(tester, DemoApi());
    expect(
      find.byKey(const ValueKey('contacts'), skipOffstage: false),
      findsNothing,
    );
    expect(
      find.byKey(const ValueKey('feed'), skipOffstage: false),
      findsNothing,
    );

    await tester.tap(find.byKey(const ValueKey('nav-contacts')));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('contacts'), skipOffstage: false),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('feed'), skipOffstage: false),
      findsNothing,
    );

    await tester.tap(find.byKey(const ValueKey('nav-chat')));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('contacts'), skipOffstage: false),
      findsOneWidget,
    );
  });

  testWidgets('chat searches sender text without leaving the conversation', (
    tester,
  ) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await openDirectChat(tester);

    await tester.tap(find.byTooltip('Tìm tin nhắn'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('conversation-message-search')),
      findsOneWidget,
    );
    await tester.enterText(
      find.byKey(const ValueKey('conversation-message-search')),
      'Mình vừa cập nhật',
    );
    await tester.pumpAndSettle();
    expect(find.text('1 tin nhắn phù hợp'), findsOneWidget);
    expect(api.messageSearchRequests, isNotEmpty);
    final searchParameters = Uri.parse(
      api.messageSearchRequests.last,
    ).queryParameters;
    expect(searchParameters['search'], 'Mình vừa cập nhật');
    expect(searchParameters['limit'], '40');
    expect(searchParameters['channelId'], '0');
    expect(find.byKey(const ValueKey('bottom-navigation')), findsNothing);

    await tester.tap(find.byTooltip('Đóng tìm kiếm'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('conversation-message-search')),
      findsNothing,
    );
  });

  testWidgets('long press can pin and forward a direct message', (
    tester,
  ) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await openDirectChat(tester);

    final bubble = find.textContaining('Bản dịch minh họa.');
    await tester.longPress(bubble);
    await tester.pumpAndSettle();
    expect(find.text('Ghim / Bỏ ghim tin nhắn'), findsOneWidget);
    expect(find.text('Chuyển tiếp'), findsOneWidget);

    await tester.tap(find.text('Ghim / Bỏ ghim tin nhắn'));
    await tester.pumpAndSettle();
    expect(api.pinnedMessageIds.contains(20), isTrue);

    await tester.longPress(bubble);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chuyển tiếp'));
    await tester.pumpAndSettle();
    expect(find.text('Tìm cá nhân hoặc nhóm'), findsOneWidget);
    await tester.tap(find.text('Alex Chen').last);
    await tester.pumpAndSettle();
    expect(api.messages[3]!.last['forwarded'], isTrue);
    expect(api.messages[3]!.last['text'], 'Mình vừa cập nhật bảng màu mới.');
  });

  testWidgets(
    'PWA mobile keeps avatar rail and channel picker on one sliding seam',
    (tester) async {
      final api = DemoApi();
      await openMobile(tester, api);
      final rail = find.byKey(const ValueKey('mobile-avatar-viewport'));
      final channel = find.byKey(const ValueKey('mobile-channel-viewport'));
      expect(tester.getSize(rail).width, closeTo(390, 1));

      await tester.tap(find.text('SocCO Design Team').first);
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('mobile-avatar-rail')), findsOneWidget);
      expect(
        find.byKey(const ValueKey('mobile-channel-picker')),
        findsOneWidget,
      );
      expect(tester.getSize(rail).width, closeTo(56, 1));
      expect(tester.getSize(channel).width, closeTo(334, 1));

      expect(find.byKey(const ValueKey('mobile-avatar-toggle')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('mobile-chat-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mở rộng cột avatar').last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 170));
      final inFlightRail = tester.getSize(rail).width;
      expect(inFlightRail, greaterThan(56));
      expect(inFlightRail, lessThan(390));
      expect(
        tester.getSize(rail).width + tester.getSize(channel).width,
        closeTo(390, 1),
      );
      await tester.pumpAndSettle();
      expect(tester.getSize(rail).width, closeTo(390, 1));
      expect(
        find.byKey(const ValueKey('mobile-channel-picker')),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const ValueKey('mobile-chat-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Thu gọn cột avatar').last);
      await tester.pumpAndSettle();
      expect(tester.getSize(rail).width, closeTo(56, 1));

      await tester.tap(find.text('Thảo luận chung'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('bottom-navigation')), findsNothing);
      await tester.tap(find.byTooltip('Quay lại'));
      await tester.pumpAndSettle();
      expect(tester.getSize(rail).width, closeTo(56, 1));
      expect(
        find.byKey(const ValueKey('mobile-channel-picker')),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('bottom-navigation')), findsOneWidget);
    },
  );

  testWidgets('group channel keeps its own message content and navigation', (
    tester,
  ) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await tester.tap(find.text('SocCO Design Team').first);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('mobile-channel-picker')), findsOneWidget);

    await tester.tap(find.text('Thiết kế UI'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('bottom-navigation')), findsNothing);
    await tester.enterText(find.byType(TextField).last, 'Tin nhắn của kênh UI');
    await tester.pump();
    await tester.tap(find.byTooltip('Gửi'));
    await tester.pumpAndSettle();

    expect(api.messages[1]!.last['channelId'], 5);
    expect(api.messages[1]!.last['text'], 'Tin nhắn của kênh UI');
    await tester.tap(find.byTooltip('Quay lại'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('mobile-channel-picker')), findsOneWidget);
    expect(find.byKey(const ValueKey('bottom-navigation')), findsOneWidget);
  });

  testWidgets('group composer ports React mention suggestions to Dart', (
    tester,
  ) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await tester.tap(find.text('SocCO Design Team').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thảo luận chung'));
    await tester.pumpAndSettle();

    final input = find.byType(TextField).last;
    await tester.enterText(input, 'Xin chào @hoang');
    await tester.pumpAndSettle();
    expect(find.text('Hoàng Nam'), findsWidgets);

    await tester.tap(find.text('Hoàng Nam').last);
    await tester.pumpAndSettle();
    final composer = tester.widget<TextField>(input);
    expect(composer.controller!.text, 'Xin chào @hoangnam ');

    await tester.tap(find.byTooltip('Gửi'));
    await tester.pumpAndSettle();
    expect(api.messages[1]!.last['text'], 'Xin chào @hoangnam');

    expect(find.text('@hoangnam'), findsWidgets);
    await tester.ensureVisible(find.text('@hoangnam').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('@hoangnam').last);
    await tester.pumpAndSettle();
    expect(find.text('Nhắn tin'), findsOneWidget);
  });

  testWidgets('older groups remain reachable beyond the first PWA page', (
    tester,
  ) async {
    final api = DemoApi();
    for (var index = 0; index < 35; index++) {
      api.rooms.add({
        'id': 1000 + index,
        'type': 'direct',
        'name': 'Người dùng $index',
        'unreadCount': 0,
        'lastMessageAt': '2026-01-15T08:00:00+07:00',
      });
    }
    api.rooms.add({
      'id': 999,
      'type': 'group',
      'name': 'Nhóm thảo luận cũ',
      'memberCount': 4,
      'unreadCount': 0,
      'lastMessageAt': '2025-01-01T10:00:00+07:00',
    });
    api.messages[999] = [];
    await openMobile(tester, api);

    await tester.enterText(
      find.byKey(const ValueKey('mobile-chat-search')),
      'Nhóm thảo luận cũ',
    );
    await tester.pumpAndSettle();
    final oldGroup = find.byKey(const ValueKey('rail-room-999'));
    expect(oldGroup, findsOneWidget);
    await tester.tap(oldGroup);
    await tester.pumpAndSettle();
    expect(find.text('Nhóm thảo luận cũ'), findsWidgets);
    expect(find.text('Thảo luận chung'), findsWidgets);
  });

  testWidgets('muting groups preserves @mention notifications like PWA', (
    tester,
  ) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await tester.longPress(find.byKey(const ValueKey('rail-room-1')));
    await tester.pumpAndSettle();
    expect(find.text('Tắt thông báo hội thoại'), findsOneWidget);
    await tester.tap(find.text('Tắt thông báo hội thoại'));
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pumpAndSettle();
    expect(api.notificationSettings[1]?['messageNotifications'], false);
    expect(api.notificationSettings[1]?['mentionNotifications'], true);
    expect(api.rooms.first['muted'], true);

    await tester.longPress(find.byKey(const ValueKey('rail-room-1')));
    await tester.pumpAndSettle();
    expect(find.text('Bật thông báo hội thoại'), findsOneWidget);
  });

  testWidgets('friends plus opens incoming friend invitations', (tester) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await tester.tap(find.byKey(const ValueKey('nav-contacts')));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Thêm bạn'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('friend-invitation-screen')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('invitation-incoming')), findsOneWidget);
    expect(find.text('Chấp nhận'), findsWidgets);
  });

  testWidgets(
    'friend invitations have incoming sent and QR subpages like PWA',
    (tester) async {
      final api = DemoApi();
      await openMobile(tester, api);
      await tester.tap(find.byKey(const ValueKey('nav-contacts')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const ValueKey('contacts-tab-2')));
      await tester.tap(find.byKey(const ValueKey('contacts-tab-2')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('invitation-incoming')), findsOneWidget);
      expect(find.text('Chấp nhận'), findsWidgets);
      await tester.tap(find.byKey(const ValueKey('invitation-sent')));
      await tester.pumpAndSettle();
      expect(
        find.text('Những lời mời đang chờ người nhận phản hồi'),
        findsOneWidget,
      );
      await tester.ensureVisible(find.byKey(const ValueKey('invitation-qr')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('invitation-qr')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('invitations-scan-qr')), findsOneWidget);
    },
  );

  testWidgets('profile subpage saves bio city and server privacy', (
    tester,
  ) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await tester.tap(find.byKey(const ValueKey('nav-profile')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('profile-settings-open')));
    await tester.pumpAndSettle();
    final privacyToggle = find.byKey(
      const ValueKey('privacy-searchableByUsername'),
    );
    await tester.ensureVisible(privacyToggle);
    await tester.pumpAndSettle();
    expect(api.privacy['searchableByUsername'], true);
    await tester.tap(privacyToggle);
    await tester.pumpAndSettle();
    expect(api.privacy['searchableByUsername'], false);
    final back = find.byKey(const ValueKey('profile-back'));
    await tester.ensureVisible(back);
    await tester.pumpAndSettle();
    await tester.tap(back.hitTestable());
    await tester.pumpAndSettle();
    final edit = find.byKey(const ValueKey('profile-edit-open'));
    await tester.ensureVisible(edit);
    await tester.pumpAndSettle();
    await tester.tap(edit.hitTestable());
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('profile-bio')));
    await tester.enterText(
      find.byKey(const ValueKey('profile-bio')),
      'Flutter và PWA đồng bộ',
    );
    await tester.enterText(
      find.byKey(const ValueKey('profile-city')),
      'Hà Nội',
    );
    await tester.pumpAndSettle();
    final save = find.widgetWithText(FilledButton, 'Lưu hồ sơ');
    await tester.ensureVisible(save);
    await tester.pumpAndSettle();
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(api.profile['bio'], 'Flutter và PWA đồng bộ');
    expect(api.profile['city'], 'Hà Nội');
  });

  testWidgets('feed story opens fullscreen native viewer and returns to feed', (
    tester,
  ) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await tester.tap(find.byKey(const ValueKey('nav-feed')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    expect(find.text('@Linh Nguyễn'), findsOneWidget);
    await tester.tap(find.byTooltip('Đóng').last);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('feed-composer-open')), findsOneWidget);
  });

  test('shared post URLs use canonical PWA detail route', () {
    final url = postShareUri(42);
    expect(
      url.toString(),
      'https://chat.codelocal.cloud/feed/posts/42?ref=share',
    );
    expect(postIdFromSharedUri(url), 42);
    expect(
      postIdFromSharedUri(
        Uri.parse('https://example.org/feed/posts/42?ref=share'),
      ),
      isNull,
    );
    expect(() => postShareUri(0), throwsArgumentError);
  });

  testWidgets(
    'new main Feed post details retain actions and comment composer',
    (tester) async {
      final api = DemoApi();
      await openMobile(tester, api);
      await tester.tap(find.byKey(const ValueKey('nav-feed')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Bình luận').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Bình luận').first);
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('post-detail-content')), findsOneWidget);
      expect(find.byKey(const ValueKey('post-detail-like')), findsOneWidget);
      expect(find.byKey(const ValueKey('post-detail-share')), findsOneWidget);
      expect(
        find.byKey(const ValueKey('post-detail-comment-input')),
        findsOneWidget,
      );

      await tester.enterText(
        find.byKey(const ValueKey('post-detail-comment-input')),
        'Bình luận từ Flutter Dart',
      );
      await tester.tap(find.byKey(const ValueKey('post-detail-send-comment')));
      await tester.pumpAndSettle();
      expect(
        api.posts.first['comments'].last['content'],
        'Bình luận từ Flutter Dart',
      );

      await tester.tap(find.byKey(const ValueKey('post-comment-sort')));
      await tester.pumpAndSettle();
      expect(find.text('Cũ nhất').last, findsOneWidget);
      await tester.tap(find.text('Cũ nhất').last);
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('close-post-detail')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('feed-composer-open')), findsOneWidget);
    },
  );

  testWidgets('post author opens visitor only after post detail closes', (
    tester,
  ) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await tester.tap(find.byKey(const ValueKey('nav-feed')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Bình luận').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bình luận').first);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('post-detail-author')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('post-detail-content')), findsNothing);
    expect(
      find.byKey(const ValueKey('visitor-profile-content')),
      findsOneWidget,
    );
    expect(find.text('Nhắn tin'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('feed-composer-open')), findsOneWidget);
  });

  testWidgets('comment author opens visitor, then messages the right user', (
    tester,
  ) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await tester.tap(find.byKey(const ValueKey('nav-feed')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Bình luận').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bình luận').first);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Alex Chen').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Alex Chen').last);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('post-detail-content')), findsNothing);
    expect(
      find.byKey(const ValueKey('visitor-profile-content')),
      findsOneWidget,
    );
    expect(find.text('@alexchen'), findsOneWidget);
    await tester.tap(find.text('Nhắn tin'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('visitor-profile-content')), findsNothing);
    expect(find.text('Alex Chen'), findsWidgets);
    expect(find.byKey(const ValueKey('bottom-navigation')), findsNothing);
  });

  testWidgets('visitor timeline can open full native post details', (
    tester,
  ) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await tester.tap(find.byKey(const ValueKey('nav-feed')));
    await tester.pumpAndSettle();
    final author = find.byKey(const ValueKey('feed-post-author-1'));
    await tester.ensureVisible(author);
    await tester.pumpAndSettle();
    await tester.tap(author);
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('visitor-profile-content')),
      findsOneWidget,
    );
    final visitorPost = find.byKey(const ValueKey('visitor-post-1'));
    await tester.ensureVisible(visitorPost);
    await tester.pumpAndSettle();
    await tester.tap(visitorPost);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('post-detail-content')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('close-post-detail')));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('visitor-profile-content')),
      findsOneWidget,
    );
  });

  testWidgets('contacts includes usable call history', (tester) async {
    final api = DemoApi();
    await openMobile(tester, api);
    await tester.tap(find.byKey(const ValueKey('nav-contacts')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('contacts-tab-3')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('contacts-tab-3')));
    await tester.pumpAndSettle();
    expect(find.text('Cuộc gọi gần đây'), findsOneWidget);
    expect(find.text('Linh Nguyễn'), findsWidgets);
    await tester.tap(find.text('Linh Nguyễn').last);
    await tester.pumpAndSettle();
    expect(find.text('Thời lượng'), findsOneWidget);
    expect(find.text('Gọi lại'), findsOneWidget);
  });
}
