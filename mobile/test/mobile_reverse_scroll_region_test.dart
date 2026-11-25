import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/presentation/mobile_reverse_scroll_region.dart';

void main() {
  for (final screen in [const Size(320, 568), const Size(375, 667)]) {
    testWidgets('reverse finger drag reveals at a clamped edge ($screen)', (
      tester,
    ) async {
      tester.view.physicalSize = screen;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      var revealed = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MobileReverseScrollRegion(
              onReverseScroll: () => revealed++,
              child: const SizedBox.expand(
                child: ColoredBox(color: Colors.white),
              ),
            ),
          ),
        ),
      );
      final gesture = await tester.startGesture(const Offset(130, 230));
      await gesture.moveBy(const Offset(0, 18));
      await gesture.moveBy(const Offset(0, 35));
      await gesture.up();
      await tester.pump();
      expect(revealed, 1, reason: 'a swipe must reveal only once');

      final sideways = await tester.startGesture(const Offset(120, 250));
      await sideways.moveBy(const Offset(55, 4));
      await sideways.up();
      await tester.pump();
      expect(revealed, 1, reason: 'horizontal channel swipes must not reveal');
    });

    testWidgets('upward web wheel/trackpad scroll reveals ($screen)', (
      tester,
    ) async {
      tester.view.physicalSize = screen;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      var revealed = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MobileReverseScrollRegion(
              onReverseScroll: () => revealed++,
              child: const SizedBox.expand(
                child: ColoredBox(color: Colors.white),
              ),
            ),
          ),
        ),
      );
      await tester.sendEventToBinding(
        const PointerScrollEvent(
          position: Offset(130, 230),
          scrollDelta: Offset(0, 30),
        ),
      );
      await tester.pump();
      expect(revealed, 0, reason: 'downward wheel should not reveal');
      await tester.sendEventToBinding(
        const PointerScrollEvent(
          position: Offset(130, 230),
          scrollDelta: Offset(0, -30),
        ),
      );
      await tester.pump();
      expect(revealed, 1, reason: 'upward trackpad wheel should reveal');
    });
  }
}
