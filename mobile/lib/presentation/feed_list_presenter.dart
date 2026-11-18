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
