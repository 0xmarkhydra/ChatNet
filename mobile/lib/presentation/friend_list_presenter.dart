import '../models/json_readers.dart';

enum FriendListFilter { all, online, favorites }

class FriendPreview {
  const FriendPreview({
    required this.name,
    required this.username,
    required this.online,
    required this.favorite,
  });

  final String name;
  final String username;
  final bool online;
  final bool favorite;

  factory FriendPreview.fromJson(JsonMap person) => FriendPreview(
    name:
        (person['nickname']?.toString().isNotEmpty == true
                ? person['nickname']
                : person['displayName'] ?? person['username'] ?? '')
            .toString(),
    username: person['username']?.toString() ?? '',
    online: person['online'] == true,
    favorite: person['favorite'] == true || person['isFavorite'] == true,
  );
}

/// A-Z search and badges are presentation-only; the original JsonMap is
/// retained for the existing native friend action sheet.
List<JsonMap> filterFriends(
  Iterable<JsonMap> friends, {
  String query = '',
  FriendListFilter filter = FriendListFilter.all,
}) {
  final needle = query.trim().toLowerCase();
  final result = [
    for (final friend in friends)
      if (_matches(FriendPreview.fromJson(friend), needle, filter)) friend,
  ];
  result.sort(
    (a, b) => FriendPreview.fromJson(a).name.toLowerCase().compareTo(
      FriendPreview.fromJson(b).name.toLowerCase(),
    ),
  );
  return result;
}

bool _matches(FriendPreview friend, String needle, FriendListFilter filter) {
  if (needle.isNotEmpty &&
      !'${friend.name} ${friend.username}'.toLowerCase().contains(needle)) {
    return false;
  }
  return switch (filter) {
    FriendListFilter.all => true,
    FriendListFilter.online => friend.online,
    FriendListFilter.favorites => friend.favorite,
  };
}
