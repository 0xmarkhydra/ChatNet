import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';

Future<void> openProfile(WidgetTester tester, DemoApi api) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(SocoApp(api: api));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('nav-profile')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('own profile has PWA sections and preserves account settings', (
    tester,
  ) async {
    final api = DemoApi();
    await openProfile(tester, api);
    expect(find.byKey(const ValueKey('profile-timeline')), findsOneWidget);
    for (final section in ['posts', 'media', 'about', 'friends']) {
      expect(find.byKey(ValueKey('profile-tab-$section')), findsOneWidget);
    }
    await tester.tap(find.byKey(const ValueKey('profile-tab-about')));
    await tester.pumpAndSettle();
    expect(find.text('Giới thiệu'), findsWidgets);
    expect(find.text('@minhanh'), findsWidgets);
    await tester.tap(find.byKey(const ValueKey('profile-tab-friends')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('profile-friend-2')), findsOneWidget);
    expect(find.byKey(const ValueKey('profile-open-contacts')), findsOneWidget);
  });

  testWidgets('profile timeline and media gallery load own posts', (
    tester,
  ) async {
    final api = DemoApi();
    api.posts.insert(0, {
      'id': 200,
      'author': 'minhanh',
      'content': 'Một ngày mới cùng ChatNet',
      'likes': 0,
      'liked': false,
      'comments': [],
      'attachments': [
        {
          'kind': 'image',
          'url': 'https://example.com/photo.png',
          'name': 'photo.png',
        },
      ],
      'createdAt': DateTime.now().toIso8601String(),
    });
    await openProfile(tester, api);
    expect(find.byKey(const ValueKey('profile-post-200')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('profile-tab-media')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('profile-media-grid')), findsOneWidget);
  });

  testWidgets('profile friends can navigate into unified contacts', (
    tester,
  ) async {
    final api = DemoApi();
    await openProfile(tester, api);
    await tester.tap(find.byKey(const ValueKey('profile-tab-friends')));
    await tester.pumpAndSettle();
    final open = find.byKey(const ValueKey('profile-open-contacts'));
    await tester.ensureVisible(open);
    await tester.tap(open);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('nav-contacts')), findsOneWidget);
  });
}
