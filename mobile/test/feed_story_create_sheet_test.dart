import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/feed_story_create_sheet.dart';

void main() {
  group('Story media validation', () {
    test('accepts supported photo and video', () {
      expect(validateStoryMedia('photo.PNG', 1024), isNull);
      expect(validateStoryMedia('video.mp4', 150 * 1024 * 1024), isNull);
    });

    test('rejects unsupported and oversized media', () {
      expect(validateStoryMedia('bad.svg', 123), isNotNull);
      expect(validateStoryMedia('zero.jpg', 0), isNotNull);
      expect(validateStoryMedia('big.jpg', 20 * 1024 * 1024 + 1), contains('20 MB'));
      expect(validateStoryMedia('big.mov', 150 * 1024 * 1024 + 1), contains('150 MB'));
    });
  });

  testWidgets('going back from text story never publishes it', (tester) async {
    var publishes = 0;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: FeedStoryCreateSheet(
      onCreateMedia: (_) async => false,
      onCreateText: (_, _) async {
        publishes++;
        return false;
      },
    ))));

    await tester.tap(find.byKey(const ValueKey('story-text-choice')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('story-text-input')), findsOneWidget);

    await tester.enterText(find.byKey(const ValueKey('story-text-input')), 'Bản nháp');
    await tester.tap(find.byKey(const ValueKey('story-back-to-choice')));
    await tester.pumpAndSettle();

    expect(publishes, 0);
    expect(find.byKey(const ValueKey('story-media-choice')), findsOneWidget);
  });
}
