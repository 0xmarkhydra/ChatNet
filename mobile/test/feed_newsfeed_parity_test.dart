import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';
import 'package:soco/feed_post_links.dart';
import 'package:soco/models/feed_models.dart';
import 'package:soco/presentation/feed_list_presenter.dart';

Future<void> openFeed(WidgetTester tester, DemoApi api) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(SocoApp(api: api));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('nav-feed')));
  await tester.pumpAndSettle();
}

Future<void> scrollToPostActions(WidgetTester tester) async {
  await tester.drag(find.text('Bài viết mới'), const Offset(0, -540));
  await tester.pumpAndSettle();
}

void main() {
  test('feed transport retains PWA repost metadata and comment likes', () {
    final item = FeedPost.fromJson({
      'id': 12,
      'author': 'linh',
      'content': '',
      'likes': 0,
      'liked': false,
      'comments': [
        {
          'id': 5,
          'author': 'alex',
          'content': 'Tuyệt!',
          'createdAt': '2026-11-18T10:00:00Z',
          'liked': true,
        },
      ],
      'createdAt': '2026-11-18T10:00:00Z',
      'repostKind': 'quick',
      'originalPost': {'id': 3, 'author': 'alex', 'content': 'Bài gốc'},
      'repostCount': 2,
      'myRepostId': 17,
    });
    expect(item.repostKind, 'quick');
    expect(item.originalPost?['id'], 3);
    expect(item.myRepostId, 17);
    expect(item.repostCount, 2);
    expect(item.comments.single.liked, true);
    final copy = FeedPost.fromJson(item.toJson());
    expect(copy.originalPost?['content'], 'Bài gốc');
    expect(copy.comments.single.liked, true);
    final collapsed = collapseQuickReposts([
      item.toJson(),
      {...item.toJson(), 'id': 3, 'repostKind': null, 'originalPost': null},
      {...item.toJson(), 'id': 99, 'repostKind': 'quote'},
    ]);
    expect(collapsed.length, 2);
  });

  test('story transport supports image and text story variants', () {
    const stamp = '2026-11-19T00:00:00Z';
    final text = Story.fromJson({
      'id': 2,
      'author': 'minhanh',
      'text': 'Xin chào',
      'background': 'teal',
      'createdAt': stamp,
      'expiresAt': stamp,
    });
    expect(text.attachment, isNull);
    expect(Story.fromJson(text.toJson()).text, 'Xin chào');
    expect(Story.fromJson(text.toJson()).background, 'teal');
  });

  testWidgets('story editor chooses text, publishes and opens text viewer', (
    tester,
  ) async {
    final api = DemoApi();
    await openFeed(tester, api);
    await tester.tap(find.text('Tạo mới'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('story-text-choice')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('story-text-choice')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('story-text-input')),
      'Tin mới từ Flutter',
    );
    await tester.tap(find.byKey(const ValueKey('story-color-teal')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('story-text-preview')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('story-text-publish')));
    await tester.pumpAndSettle();

    expect(api.stories.first['text'], 'Tin mới từ Flutter');
    expect(api.stories.first['background'], 'teal');
    await tester.tap(find.text('Tin mới từ Flutter').first);
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('feed-text-story-viewer')),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('feed-story-viewer-close')));
    await tester.pumpAndSettle();
  });

  testWidgets('post share can publish a quick repost with original preview', (
    tester,
  ) async {
    final api = DemoApi();
    await openFeed(tester, api);
    await scrollToPostActions(tester);
    final share = find.byKey(const ValueKey('feed-post-share-1'));
    await tester.ensureVisible(share);
    await tester.tap(share);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('feed-repost-quick')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('feed-repost-quick')));
    await tester.pumpAndSettle();
    expect(api.posts.first['repostKind'], 'quick');
    expect((api.posts.first['originalPost'] as Map)['id'], 1);
    expect(find.text('Đã đăng lại'), findsWidgets);
    expect(
      find.byKey(ValueKey('feed-original-post-${api.posts.first['id']}')),
      findsOneWidget,
    );
  });

  testWidgets('quoted repost keeps the original post visible as a preview', (
    tester,
  ) async {
    final api = DemoApi();
    await openFeed(tester, api);
    await scrollToPostActions(tester);
    await tester.ensureVisible(find.byKey(const ValueKey('feed-post-share-1')));
    await tester.tap(find.byKey(const ValueKey('feed-post-share-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('feed-repost-quote')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('feed-repost-quote-input')),
      'Bài viết rất hữu ích!',
    );
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<FilledButton>(
            find.byKey(const ValueKey('feed-repost-quote-send')),
          )
          .onPressed,
      isNotNull,
    );
    await tester.tap(find.byKey(const ValueKey('feed-repost-quote-send')));
    await tester.pumpAndSettle();
    expect(
      api.posts.first['repostKind'],
      'quote',
      reason:
          'Saved posts: ${api.posts.map((p) => '${p['id']}:${p['repostKind']}').join(',')}; error: ${find.textContaining('Không thể').evaluate().length}',
    );
    expect(api.posts.first['content'], 'Bài viết rất hữu ích!');
    expect((api.posts.first['originalPost'] as Map)['id'], 1);
    expect(
      find.byKey(ValueKey('feed-original-post-${api.posts.first['id']}')),
      findsOneWidget,
    );
  });

  testWidgets('post detail allows liking and unliking a comment', (
    tester,
  ) async {
    final api = DemoApi();
    await openFeed(tester, api);
    await scrollToPostActions(tester);
    final post = find.byKey(const ValueKey('feed-post-1'));
    await tester.ensureVisible(post);
    await tester.tap(
      find.descendant(of: post, matching: find.text('Bình luận')).first,
    );
    await tester.pumpAndSettle();
    final like = find.byKey(const ValueKey('post-comment-like-1'));
    expect(like, findsOneWidget);
    await tester.tap(like);
    await tester.pumpAndSettle();
    expect((api.posts.first['comments'] as List).first['liked'], true);
    await tester.tap(like);
    await tester.pumpAndSettle();
    expect((api.posts.first['comments'] as List).first['liked'], false);
    await tester.tap(find.byKey(const ValueKey('close-post-detail')));
    await tester.pumpAndSettle();
  });

  testWidgets('community header toggles native list and restores newsfeed', (
    tester,
  ) async {
    await openFeed(tester, DemoApi());
    await tester.tap(find.byKey(const ValueKey('feed-communities-toggle')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('feed-community-1')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('feed-communities-search')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('feed-composer-open')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('feed-communities-back')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('feed-community-1')), findsNothing);
    expect(find.byKey(const ValueKey('feed-composer-open')), findsOneWidget);
  });

  testWidgets('community list navigates to group messages', (tester) async {
    await openFeed(tester, DemoApi());
    await tester.tap(find.byKey(const ValueKey('feed-communities-toggle')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('feed-community-1')));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('feed-community-1')), findsNothing);
    expect(find.text('SocCO Design Team'), findsWidgets);
  });

  testWidgets('quick repost can be undone without deleting original', (
    tester,
  ) async {
    final api = DemoApi();
    await openFeed(tester, api);
    await scrollToPostActions(tester);
    final sourceShare = find.byKey(const ValueKey('feed-post-share-1'));
    await tester.ensureVisible(sourceShare);
    await tester.tap(sourceShare);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('feed-repost-quick')));
    await tester.pumpAndSettle();
    expect(api.posts.first['repostKind'], 'quick');
    final quickId = api.posts.first['id'];
    final options = find.byKey(ValueKey('feed-post-options-$quickId'));
    await tester.ensureVisible(options);
    // The system app bar overlays the first few pixels of a scrolled post.
    // Give the new repost enough room below the header before tapping.
    await tester.drag(find.byType(ListView).first, const Offset(0, 210));
    await tester.pumpAndSettle();
    await tester.tap(options);
    await tester.pumpAndSettle();
    expect(find.text('Bỏ đăng lại'), findsOneWidget);
    await tester.tap(find.text('Bỏ đăng lại'));
    await tester.pumpAndSettle();
    expect(find.text('Bài viết gốc sẽ không bị xóa.'), findsOneWidget);
    await tester.tap(find.text('Bỏ đăng lại'));
    await tester.pumpAndSettle();
    expect(api.posts.where((post) => post['repostKind'] == 'quick'), isEmpty);
    expect(api.posts.any((post) => post['id'] == 1), true);
    // Repost removal refreshes FeedNotifier + optional Story data.
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
  });

  testWidgets('share-to-chat sends the canonical post link to selected room', (
    tester,
  ) async {
    final api = DemoApi();
    await openFeed(tester, api);
    await scrollToPostActions(tester);
    await tester.ensureVisible(find.byKey(const ValueKey('feed-post-share-1')));
    await tester.tap(find.byKey(const ValueKey('feed-post-share-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('feed-share-to-chat')));
    await tester.pumpAndSettle();
    final room = find.byKey(const ValueKey('feed-share-chat-2'));
    await tester.ensureVisible(room);
    await tester.tap(room);
    await tester.pumpAndSettle();
    expect(api.messages[2]!.last['text'], postShareUri(1).toString());
  });
}
