import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/api.dart';
import 'package:soco/demo.dart';
import 'package:soco/discover_screen.dart';

class StopFailureDemoApi extends DemoApi {
  @override
  Future<dynamic> request(String method, String path, [Json? body]) {
    if (method == 'DELETE' && path == '/api/users/nearby') {
      throw const ApiError('Không thể tắt vị trí.', 503);
    }
    return super.request(method, path, body);
  }
}

Future<void> openDiscover(
  WidgetTester tester,
  DemoApi api, {
  ValueChanged<Json>? onOpenConversation,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SafeArea(
          child: DiscoverScreen(
            api: api,
            query: '',
            onOpenConversation: onOpenConversation,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> scanPeople(WidgetTester tester) async {
  await tester.tap(find.text('Bật và tìm người'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'nearby user actions reflect accepted, incoming and no relation',
    (tester) async {
      final api = DemoApi();
      await openDiscover(tester, api);
      await scanPeople(tester);

      expect(api.nearbyEnabled, isTrue);
      expect(find.byKey(const ValueKey('nearby-person-2')), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('nearby-friend-action-2')),
          matching: find.text('Nhắn tin'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('nearby-friend-action-5')),
          matching: find.text('Chấp nhận'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('nearby-friend-action-4')),
          matching: find.text('Kết bạn'),
        ),
        findsOneWidget,
      );

      await tester.ensureVisible(
        find.byKey(const ValueKey('nearby-friend-action-5')),
      );
      await tester.tap(find.byKey(const ValueKey('nearby-friend-action-5')));
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('nearby-friend-action-5')),
          matching: find.text('Nhắn tin'),
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets('new friend can send and cancel invitation from nearby list', (
    tester,
  ) async {
    final api = DemoApi();
    await openDiscover(tester, api);
    await scanPeople(tester);
    await tester.ensureVisible(
      find.byKey(const ValueKey('nearby-friend-action-4')),
    );
    await tester.tap(find.byKey(const ValueKey('nearby-friend-action-4')));
    await tester.pumpAndSettle();
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('nearby-friend-action-4')),
        matching: find.text('Hủy lời mời'),
      ),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('nearby-friend-action-4')));
    await tester.pumpAndSettle();
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('nearby-friend-action-4')),
        matching: find.text('Kết bạn'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('accepted friend opens direct conversation via shell callback', (
    tester,
  ) async {
    Json? opened;
    await openDiscover(
      tester,
      DemoApi(),
      onOpenConversation: (room) => opened = room,
    );
    await scanPeople(tester);
    await tester.ensureVisible(
      find.byKey(const ValueKey('nearby-friend-action-2')),
    );
    await tester.tap(find.byKey(const ValueKey('nearby-friend-action-2')));
    await tester.pumpAndSettle();
    expect(opened?['type'], 'direct');
    expect(opened?['otherUserId'], 2);
  });

  testWidgets('failed privacy revoke does not falsely hide shared location', (
    tester,
  ) async {
    final api = StopFailureDemoApi();
    await openDiscover(tester, api);
    await scanPeople(tester);
    final switchFinder = find.byKey(const ValueKey('nearby-visibility-switch'));
    expect(tester.widget<Switch>(switchFinder).value, isTrue);
    await tester.ensureVisible(switchFinder);
    await tester.tap(switchFinder);
    await tester.pumpAndSettle();
    expect(tester.widget<Switch>(switchFinder).value, isTrue);
    expect(api.nearbyEnabled, isTrue);
    expect(
      find.textContaining('Chưa xác nhận đã tắt Quanh đây'),
      findsOneWidget,
    );
  });

  testWidgets('confirmed revoke clears results and disables visibility', (
    tester,
  ) async {
    final api = DemoApi();
    await openDiscover(tester, api);
    await scanPeople(tester);
    final switchFinder = find.byKey(const ValueKey('nearby-visibility-switch'));
    await tester.ensureVisible(switchFinder);
    await tester.tap(switchFinder);
    await tester.pumpAndSettle();
    expect(api.nearbyEnabled, isFalse);
    expect(tester.widget<Switch>(switchFinder).value, isFalse);
    expect(find.byKey(const ValueKey('nearby-person-2')), findsNothing);
  });

  testWidgets('place discovery has map controls and list-to-map navigation', (
    tester,
  ) async {
    await openDiscover(tester, DemoApi());
    await tester.tap(find.text('Địa điểm'));
    await tester.pumpAndSettle();
    expect(find.text('Tìm địa điểm gần bạn'), findsOneWidget);
    await tester.tap(find.text('Dùng vị trí hiện tại'));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('nearby-map-my-location')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('nearby-map-zoom-in')), findsOneWidget);
    expect(find.byKey(const ValueKey('nearby-map-zoom-out')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('nearby-map-marker-demo:0')),
      findsWidgets,
    );

    await tester.tap(find.byTooltip('Danh sách'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('nearby-map-my-location')), findsNothing);
    await tester.ensureVisible(
      find.byKey(const ValueKey('nearby-place-demo:0')),
    );
    await tester.tap(find.byKey(const ValueKey('nearby-place-demo:0')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('nearby-map-zoom-in')), findsOneWidget);
  });

  testWidgets('search can filter people and be cleared in place', (
    tester,
  ) async {
    await openDiscover(tester, DemoApi());
    await scanPeople(tester);
    await tester.enterText(
      find.byKey(const ValueKey('nearby-search')),
      'hoang',
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('nearby-person-4')), findsOneWidget);
    expect(find.byKey(const ValueKey('nearby-person-2')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('nearby-clear-query')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('nearby-person-2')), findsOneWidget);
  });
}
