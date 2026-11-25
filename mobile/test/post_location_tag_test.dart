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
      expect(find.text('Đang ở Hồ Hoàn Kiếm'), findsOneWidget);
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
    expect(find.byType(ActionChip), findsNothing);
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
    expect(find.text('Đang ở Hà Nội'), findsOneWidget);
    expect(find.textContaining('gần đúng'), findsNothing);
  });
}