import '../api.dart';

/// A presentation-only projection of the same three sources used by the PWA:
/// incoming invitations, conversations with unread messages, and feed mentions.
class MobileNotification {
  const MobileNotification({
    required this.key,
    required this.kind,
    required this.title,
    required this.subtitle,
    required this.date,
    required this.data,
  });

  final String key;
  final String kind;
  final String title;
  final String subtitle;
  final String date;
  final Json data;

  bool get serverRead => kind == 'mention' && data['readAt'] != null;
}

List<MobileNotification> buildMobileNotifications({
  required Iterable<Json> requests,
  required Iterable<Json> conversations,
  required Iterable<Json> mentions,
}) {
  final notifications = <MobileNotification>[
    for (final friend in requests)
      if (friend['direction'] == 'incoming' && friend['id'] is num)
        MobileNotification(
          key: 'friend:${friend['id']}',
          kind: 'friend',
          title:
              friend['displayName']?.toString() ??
              friend['username']?.toString() ??
              '',
          subtitle: 'đã gửi cho bạn lời mời kết bạn',
          date: friend['updatedAt']?.toString() ?? '',
          data: friend,
        ),
    for (final room in conversations)
      if ((room['unreadCount'] as num?)?.toInt() case final int count
          when count > 0)
        MobileNotification(
          key: 'chat:${room['id']}',
          kind: 'message',
          title: room['name']?.toString() ?? 'Cuộc trò chuyện',
          subtitle: 'có $count tin nhắn chưa đọc',
          date:
              room['lastMessageAt']?.toString() ??
              room['createdAt']?.toString() ??
              '',
          data: room,
        ),
    for (final mention in mentions)
      if (mention['postId'] is num && mention['id'] is num)
        MobileNotification(
          key: 'mention:${mention['id']}',
          kind: 'mention',
          title:
              mention['authorDisplayName']?.toString() ??
              mention['author']?.toString() ??
              '',
          subtitle: switch (mention['kind']?.toString()) {
            'repost' => 'đã đăng lại bài viết của bạn',
            'quote' => 'đã trích dẫn bài viết của bạn',
            _ => 'đã gắn thẻ bạn trong một bài viết',
          },
          date: mention['createdAt']?.toString() ?? '',
          data: mention,
        ),
  ];
  notifications.sort((a, b) => b.date.compareTo(a.date));
  return notifications;
}

List<MobileNotification> filterMobileNotifications(
  Iterable<MobileNotification> items, {
  String filter = 'all',
  String query = '',
  Set<String> locallyRead = const {},
}) {
  final term = query.trim().toLowerCase();
  return [
    for (final item in items)
      if ((filter != 'mentions' || item.kind == 'mention') &&
          (filter != 'unread' ||
              !(item.serverRead || locallyRead.contains(item.key))) &&
          (term.isEmpty ||
              '${item.title} ${item.subtitle}'.toLowerCase().contains(term)))
        item,
  ];
}
