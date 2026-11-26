import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/public_post_location.dart';

void main() {
  testWidgets('named check-in has the same tag for restricted audiences', (
    tester,
  ) async {
    for (final visibility in ['friends', 'private']) {
      final post = <String, dynamic>{
        'visibility': visibility,
        'content': '📍 Hồ Hoàn Kiếm\nCaption',
      };
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: PublicPostLocationLink(post: post)),
        ),
      );
      expect(find.text('Hồ Hoàn Kiếm'), findsOneWidget);
      expect(postContentWithoutLocation(post), 'Caption');
    }
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PublicPostLocationLink(
            post: {'visibility': 'private', 'content': 'Caption'},
          ),
        ),
      ),
    );
    expect(find.byKey(const ValueKey('post-location-name-link')), findsNothing);
  });
  testWidgets('public tag uses GPS name without approximation suffix', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PublicPostLocationLink(
            post: {
              'visibility': 'public',
              'content': 'Caption',
              'publishLocation': {
                'latitude': 21,
                'longitude': 105,
                'accuracy': 1200,
                'placeName': 'Hà Nội',
              },
            },
          ),
        ),
      ),
    );
    expect(find.text('Hà Nội'), findsOneWidget);
    expect(find.textContaining('gần đúng'), findsNothing);
  });
  testWidgets(
    'pin icon is outside the link and long labels fit a narrow header',
    (tester) async {
      final name = List.filled(12, 'Đường Nguyễn Văn Huyên').join(', ');
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Align(
              alignment: Alignment.topLeft,
              child: SizedBox(
                width: 130,
                child: PublicPostLocationLink(
                  post: {
                    'visibility': 'friends',
                    'content': '📍 $name [map:21.03,105.85]',
                  },
                ),
              ),
            ),
          ),
        ),
      );
      final link = find.byKey(const ValueKey('post-location-name-link'));
      expect(link, findsOneWidget);
      expect(
        find.descendant(
          of: link,
          matching: find.byIcon(Icons.location_on_outlined),
        ),
        findsNothing,
      );
      expect(find.byIcon(Icons.location_on_outlined), findsOneWidget);
      expect(find.text(name), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
