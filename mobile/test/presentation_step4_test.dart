import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';
import 'package:soco/models/navigation_models.dart';
import 'package:soco/models/contact_models.dart';
import 'package:soco/presentation/conversation_list_presenter.dart';
import 'package:soco/presentation/feed_list_presenter.dart';
import 'package:soco/presentation/friend_list_presenter.dart';
import 'package:soco/presentation/mobile_shell_state.dart';
import 'package:soco/presentation/soco_bottom_navigation.dart';

void main() {
  test(
    'conversation presenter filters only room names and preserves pin order',
    () {
      final rooms = [
        {
          'id': 1,
          'name': 'SocCO Design Team',
          'type': 'group',
          'unreadCount': 0,
          'lastMessageAt': '2026-11-17T14:00:00Z',
        },
        {
          'id': 2,
          'name': 'Alex Chen',
          'type': 'direct',
          'unreadCount': 4,
          'lastMessageAt': '2026-11-18T11:00:00Z',
        },
        {
          'id': 3,
          'name': 'Nhóm UI',
          'type': 'group',
          'unreadCount': 2,
          'pinnedAt': '2026-11-18T09:00:00Z',
          'lastMessageAt': '2026-11-15T12:00:00Z',
        },
      ];
      final sorted = [...rooms]..sort(compareConversationRows);
      expect(sorted.map((room) => room['id']), [3, 2, 1]);
      expect(
        filterConversations(rooms, query: '  alex  ').map((room) => room['id']),
        [2],
      );
      expect(
        filterConversations(
          rooms,
          filter: ChatListFilter.unread,
        ).map((room) => room['id']),
        [2, 3],
      );
      expect(
        filterConversations(
          rooms,
          filter: ChatListFilter.groups,
        ).map((room) => room['id']),
        [1, 3],
      );
      expect(
        filterConversations(rooms, query: 'tin nhắn'),
        isEmpty,
        reason: 'An inbox search must not search message text',
      );
      expect(
        rooms.first['id'],
        1,
        reason: 'Filtering must not reorder sources',
      );
    },
  );

  test(
    'friends presenter handles A-Z, online, favorites and username search',
    () {
      final people = [
        {
          'username': 'binh',
          'displayName': 'Bình',
          'online': false,
          'favorite': true,
        },
        {
          'username': 'anh',
          'displayName': 'Anh',
          'online': true,
          'isFavorite': false,
        },
        {
          'username': 'cuong',
          'displayName': 'Cường',
          'online': true,
          'isFavorite': true,
        },
      ];
      expect(filterFriends(people).map((p) => p['username']), [
        'anh',
        'binh',
        'cuong',
      ]);
      expect(
        filterFriends(
          people,
          filter: FriendListFilter.online,
        ).map((p) => p['username']),
        ['anh', 'cuong'],
      );
      expect(
        filterFriends(
          people,
          filter: FriendListFilter.favorites,
        ).map((p) => p['username']),
        ['binh', 'cuong'],
      );
      expect(
        filterFriends(people, query: '  CUONG ').single['username'],
        'cuong',
      );
    },
  );

  test('friend DTO preserves favorite flags used by native list filters', () {
    final person = FriendConnection.fromJson({
      'id': 10,
      'username': 'friend',
      'displayName': 'Bạn thân',
      'online': true,
      'status': 'accepted',
      'favorite': true,
      'isFavorite': false,
    });
    expect(person.favorite, true);
    expect(person.toJson()['favorite'], true);
    expect(person.copyWith(favorite: null).favorite, isNull);
    expect(person.copyWith(favorite: false).favorite, false);
  });

  test('feed presenter matches authors, display names and content', () {
    final posts = [
      {
        'id': 1,
        'author': 'minhanh',
        'authorDisplayName': 'Minh Anh',
        'content': 'Xin chào',
      },
      {'id': 2, 'author': 'alex', 'content': 'Thiết kế Flutter'},
    ];
    expect(filterFeedPosts(posts, query: 'FLUTTER').single['id'], 2);
    expect(filterFeedPosts(posts, query: 'Minh Anh').single['id'], 1);
    expect(filterFeedPosts(posts).length, 2);
  });

  test('Riverpod shell navigation manages chat expansion and badges', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final state = container.read(mobileShellProvider);
    expect(state.tab, SocoTab.chat);
    expect(state.hideBottomNavigation(compact: true), false);

    final notifier = container.read(mobileShellProvider.notifier);
    notifier.setUnreadTotal(140);
    notifier.setConversationOpen(true);
    expect(container.read(mobileShellProvider).unreadTotal, 140);
    expect(
      container.read(mobileShellProvider).hideBottomNavigation(compact: true),
      true,
    );
    expect(
      container.read(mobileShellProvider).hideBottomNavigation(compact: false),
      false,
    );

    notifier.select(SocoTab.feed);
    expect(container.read(mobileShellProvider).conversationOpen, false);
    expect(container.read(mobileShellProvider).tab, SocoTab.feed);
    notifier.openConversation();
    expect(container.read(mobileShellProvider).tab, SocoTab.chat);
    notifier.setConversationOpen(true);
    notifier.resetConversation();
    expect(container.read(mobileShellProvider).conversationOpen, false);
    notifier.setUnreadTotal(-7);
    expect(container.read(mobileShellProvider).unreadTotal, 0);
  });

  testWidgets('contacts query uses Riverpod search and opens discovery', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('nav-contacts')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'hoang');
    // The 320ms debounce timer does not itself schedule a Flutter frame.
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    expect(find.text('Kết quả tìm kiếm'), findsOneWidget);
    expect(find.text('@hoangnam'), findsWidgets);
    expect(find.byKey(const ValueKey('bottom-navigation')), findsOneWidget);
  });

  testWidgets(
    'bottom navigation indicator moves smoothly without losing tabs',
    (tester) async {
      SocoTab selected = SocoTab.chat;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            bottomNavigationBar: StatefulBuilder(
              builder: (context, rebuild) => SocoBottomNavigationBar(
                compact: true,
                selected: selected,
                unreadTotal: 120,
                onSelected: (tab) => rebuild(() => selected = tab),
              ),
            ),
          ),
        ),
      );
      final indicator = find.byKey(const ValueKey('nav-selection-indicator'));
      expect(indicator, findsOneWidget);
      expect(find.text('99+'), findsOneWidget);
      expect(find.byKey(const ValueKey('nav-contacts')), findsOneWidget);
      final start = tester.getCenter(indicator).dx;

      await tester.tap(find.byKey(const ValueKey('nav-feed')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 120));
      final mid = tester.getCenter(indicator).dx;
      await tester.pumpAndSettle();
      final finish = tester.getCenter(indicator).dx;
      expect(selected, SocoTab.feed);
      expect(mid, greaterThan(start));
      expect(mid, lessThan(finish));
      expect(finish, greaterThan(start));
      expect(find.byKey(const ValueKey('nav-chat')), findsOneWidget);
    },
  );
}
