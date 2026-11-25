import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';
import 'package:soco/explore_screen.dart';

void main() {
  testWidgets('all five Flutter tabs inherit identical PWA 52px header', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();

    for (final tab in ['chat', 'contacts', 'discover', 'feed', 'profile']) {
      await tester.tap(find.byKey(ValueKey('nav-$tab')));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('web-appbar')),
        findsOneWidget,
        reason: '$tab must use the same PWA header',
      );
      expect(
        tester.getSize(find.byKey(const ValueKey('web-appbar'))).height,
        52,
      );
      expect(find.byKey(const ValueKey('bottom-navigation')), findsOneWidget);
      expect(
        tester.getSize(find.byKey(const ValueKey('bottom-navigation'))).height,
        56,
      );
      expect(
        find.byKey(const ValueKey('mobile-search-dock')),
        (tab == 'contacts' || tab == 'discover' || tab == 'feed')
            ? findsOneWidget
            : findsNothing,
      );
    }
  });

  testWidgets('Explore categories stay above an independently scrolling body', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(375, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ExploreScreen(api: DemoApi(), query: ''),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final categoryStrip = find.byKey(const ValueKey('explore-fixed-tabs'));
    final scrollArea = find.byKey(const ValueKey('explore-scroll-all'));
    expect(categoryStrip, findsOneWidget);
    expect(scrollArea, findsOneWidget);
    expect(find.byKey(const ValueKey('explore-tab-all')), findsOneWidget);

    final before = tester.getTopLeft(categoryStrip).dy;
    await tester.drag(scrollArea, const Offset(0, -450));
    await tester.pumpAndSettle();
    expect(
      tester.getTopLeft(categoryStrip).dy,
      before,
      reason: 'horizontal category navigation cannot scroll out of view',
    );

    await tester.drag(
      find.byKey(const ValueKey('explore-horizontal-tabs')),
      const Offset(-500, 0),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('explore-tab-recent')));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('explore-nearby-scanner')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('explore-fixed-tabs')), findsOneWidget);
  });
  testWidgets('PWA scroll hides chrome, keeps search dock and Explore tabs', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(375, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(SocoApp(api: DemoApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('nav-discover')));
    await tester.pumpAndSettle();

    final scroller = find.byKey(const ValueKey('explore-scroll-all'));
    expect(find.byKey(const ValueKey('mobile-search-dock')), findsOneWidget);
    expect(find.byKey(const ValueKey('explore-fixed-tabs')), findsOneWidget);

    await tester.drag(scroller, const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(
      tester.getSize(find.byKey(const ValueKey('mobile-header-slot'))).height,
      0,
    );
    expect(find.byKey(const ValueKey('mobile-search-dock')), findsOneWidget);
    expect(find.byKey(const ValueKey('explore-fixed-tabs')), findsOneWidget);
    await tester.drag(scroller, const Offset(0, 200));
    await tester.pumpAndSettle();
    expect(
      tester.getSize(find.byKey(const ValueKey('mobile-header-slot'))).height,
      52,
    );
  });
  for (final size in [const Size(320, 568), const Size(375, 667)]) {
    testWidgets('Chat inbox chrome tracks ONLY scroll on narrow $size', (
      tester,
    ) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      final api = DemoApi();
      // Make the inbox much taller than the viewport on a small phone.
      for (var index = 0; index < 20; index++) {
        api.rooms.add({
          ...api.rooms[1],
          'id': 500 + index,
          'name': 'Hội thoại bổ sung $index',
          'otherUserId': 500 + index,
        });
      }

      await tester.pumpWidget(SocoApp(api: api));
      await tester.pumpAndSettle();
      final header = find.byKey(const ValueKey('mobile-header-slot'));
      final rail = find.byKey(const ValueKey('mobile-avatar-rail'));
      final footer = find.byKey(const ValueKey('bottom-navigation'));
      expect(header, findsOneWidget);
      expect(rail, findsOneWidget);
      expect(footer, findsOneWidget);
      expect(tester.getSize(header).height, 52);
      final visibleFooterTop = tester.getTopLeft(footer).dy;
      final list = tester.widget<ListView>(rail);
      expect((list.padding as EdgeInsets).bottom, greaterThanOrEqualTo(88));

      // Scrolling the conversation list must not physically pull the
      // header/footer with the content: the chrome hides independently.
      await tester.drag(rail, const Offset(0, -320));
      await tester.pumpAndSettle();
      expect(tester.getSize(header).height, 0);
      expect(tester.getTopLeft(footer).dy, greaterThan(visibleFooterTop + 60));

      // Reaching the bottom of the inbox must NOT resurrect either bar.
      await tester.drag(rail, const Offset(0, -1200));
      await tester.pumpAndSettle();
      expect(tester.getSize(header).height, 0);

      // An actual reverse finger drag is the only way to reveal chrome.
      await tester.drag(rail, const Offset(0, 120));
      await tester.pumpAndSettle();
      expect(tester.getSize(header).height, 52);
      expect(
        (tester.getTopLeft(footer).dy - visibleFooterTop).abs(),
        lessThan(2),
      );

      // At the beginning of the list, downward overscroll alone cannot
      // make the navigation vanish due to an unrelated nested scroll.
      await tester.drag(rail, const Offset(0, 1200));
      await tester.pumpAndSettle();
      expect(tester.getSize(header).height, 52);
    });
  }
  for (final size in [const Size(320, 568), const Size(375, 667)]) {
    testWidgets(
      'Chat footer reappears on reverse trackpad and edge drag $size',
      (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        final api = DemoApi();
        for (var index = 0; index < 18; index++) {
          api.rooms.add({
            ...api.rooms[1],
            'id': 700 + index,
            'name': 'Cuộn Chat $index',
            'otherUserId': 700 + index,
          });
        }
        await tester.pumpWidget(SocoApp(api: api));
        await tester.pumpAndSettle();
        final rail = find.byKey(const ValueKey('mobile-avatar-rail'));
        final header = find.byKey(const ValueKey('mobile-header-slot'));
        final footer = find.byKey(const ValueKey('bottom-navigation'));
        final originalFooterTop = tester.getTopLeft(footer).dy;
        await tester.drag(rail, const Offset(0, -300));
        await tester.pumpAndSettle();
        expect(tester.getSize(header).height, 0);
        expect(
          tester.getTopLeft(footer).dy,
          greaterThan(originalFooterTop + 60),
        );

        // Simulate scrolling UP with a laptop trackpad in Flutter Web.
        // The Flutter ScrollUpdateNotification has no dragDetails for a wheel,
        // so the old implementation left the navigation permanently hidden.
        await tester.sendEventToBinding(
          PointerScrollEvent(
            position: tester.getCenter(rail),
            scrollDelta: const Offset(0, -40),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.getSize(header).height, 52);
        expect(
          (tester.getTopLeft(footer).dy - originalFooterTop).abs(),
          lessThan(2),
        );

        // Hide once more, move the list to its clamped bottom, and swipe
        // upward through content. The reverse finger movement must reveal
        // footer even if no scroll delta is delivered at the boundary.
        await tester.drag(rail, const Offset(0, -300));
        await tester.pumpAndSettle();
        expect(tester.getSize(header).height, 0);
        // Use a real downward swipe to hit the clamped bottom; jumping the
        // controller programmatically changes extents during header resize.
        await tester.drag(rail, const Offset(0, -3000));
        await tester.pumpAndSettle();
        expect(tester.getSize(header).height, 0);

        final gesture = await tester.startGesture(tester.getCenter(rail));
        await gesture.moveBy(const Offset(0, 34));
        await gesture.up();
        await tester.pumpAndSettle();
        expect(tester.getSize(header).height, 52);
        expect(
          (tester.getTopLeft(footer).dy - originalFooterTop).abs(),
          lessThan(2),
        );
      },
    );
  }
}
