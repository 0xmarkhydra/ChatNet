import '../models/json_readers.dart';
import '../models/navigation_models.dart';

/// Lightweight, immutable projection of conversation wire data for the
/// presentation layer. The original record stays available for mutations
/// (channel settings, room actions) that need server fields beyond this view.
class ConversationPreview {
  const ConversationPreview({
    required this.name,
    required this.isGroup,
    required this.unreadCount,
    required this.pinned,
    required this.lastMessageAt,
  });

  final String name;
  final bool isGroup;
  final int unreadCount;
  final bool pinned;
  final String lastMessageAt;

  factory ConversationPreview.fromJson(JsonMap json) => ConversationPreview(
    name: json['name'] is String ? json['name'] as String : '',
    isGroup: json['type'] == 'group',
    unreadCount: json['unreadCount'] is num
        ? (json['unreadCount'] as num).toInt()
        : 0,
    pinned: json['pinnedAt']?.toString().isNotEmpty == true,
    lastMessageAt: json['lastMessageAt']?.toString() ?? '',
  );
}

/// The same name-only search is applied on web and mobile. Sender and
/// message-content search belong to the active conversation, not this list.
List<JsonMap> filterConversations(
  Iterable<JsonMap> conversations, {
  String query = '',
  ChatListFilter filter = ChatListFilter.all,
}) {
  final needle = query.trim().toLowerCase();
  return [
    for (final room in conversations)
      if (_matches(ConversationPreview.fromJson(room), needle, filter)) room,
  ];
}

bool _matches(ConversationPreview item, String needle, ChatListFilter filter) {
  if (needle.isNotEmpty && !item.name.toLowerCase().contains(needle)) {
    return false;
  }
  return switch (filter) {
    ChatListFilter.all => true,
    ChatListFilter.unread => item.unreadCount > 0,
    ChatListFilter.groups => item.isGroup,
  };
}

/// Pins always lead. For equal pin state, most recently active rooms lead.
int compareConversationRows(JsonMap left, JsonMap right) {
  final a = ConversationPreview.fromJson(left);
  final b = ConversationPreview.fromJson(right);
  if (a.pinned != b.pinned) return b.pinned ? 1 : -1;
  return b.lastMessageAt.compareTo(a.lastMessageAt);
}
