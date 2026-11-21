import '../models/json_readers.dart';

/// Feed search is a local presentation filter. Server pagination and the
/// saved-post scope remain owned by FeedNotifier/the existing API controller.
List<JsonMap> filterFeedPosts(Iterable<JsonMap> posts, {String query = ''}) {
  final needle = query.trim().toLowerCase();
  if (needle.isEmpty) return List<JsonMap>.of(posts);
  return [
    for (final post in posts)
      if ([
        post['author'],
        post['authorDisplayName'],
        post['content'],
      ].where((part) => part != null).join(' ').toLowerCase().contains(needle))
        post,
  ];
}

/// A quick repost occupies the same feed slot as its original, as in the PWA.
/// Quotes remain separate posts.
List<JsonMap> collapseQuickReposts(Iterable<JsonMap> items) {
  final seen = <int>{};
  return [
    for (final post in items)
      if (seen.add(
        post['repostKind'] == 'quick' && post['originalPost'] is Map
            ? ((post['originalPost'] as Map)['id'] as num).toInt()
            : (post['id'] as num).toInt(),
      ))
        post,
  ];
}
