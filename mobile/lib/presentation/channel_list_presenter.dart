import '../models/json_readers.dart';

/// Immutable channel row data mirroring the mobile PWA channel sidebar.
class ChannelPreview {
  const ChannelPreview({
    required this.id,
    required this.name,
    required this.description,
    required this.lastMessage,
    required this.lastMessageAt,
    required this.unreadCount,
    required this.muted,
    this.avatarUrl,
  });

  final int id;
  final String name;
  final String description;
  final String lastMessage;
  final String lastMessageAt;
  final int unreadCount;
  final bool muted;
  final String? avatarUrl;

  factory ChannelPreview.fromJson(JsonMap data) => ChannelPreview(
    id: (data['id'] as num?)?.toInt() ?? 0,
    name: data['name']?.toString() ?? 'Kênh hội thoại',
    description: data['description']?.toString() ?? '',
    lastMessage: data['lastMessage']?.toString() ?? '',
    lastMessageAt: data['lastMessageAt']?.toString() ?? '',
    unreadCount: (data['unreadCount'] as num?)?.toInt() ?? 0,
    muted: data['muted'] == true,
    avatarUrl: data['avatarUrl']?.toString(),
  );

  /// Same fallback algorithm used by GroupChannelSidebar on the React PWA.
  String get initials {
    final source = description.trim().isEmpty
        ? name.trim()
        : description.trim();
    final words = source
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList();
    if (words.isEmpty) return '#';
    String initial(String word) => String.fromCharCode(word.runes.first);
    if (words.length > 1) {
      return '${initial(words.first)}${initial(words.last)}'.toUpperCase();
    }
    return String.fromCharCodes(words.first.runes.take(2)).toUpperCase();
  }

  int get tone {
    final source = description.trim().isEmpty
        ? name.trim()
        : description.trim();
    var hash = 0;
    for (final point in source.runes) {
      hash = ((hash * 31) + point) & 0xFFFFFFFF;
    }
    return hash % 6;
  }
}

/// The discussion channel belongs to every group and appears exactly once.
/// Do not invent its lastMessage/unread count from the group totals: those
/// totals may reflect traffic in an unrelated subchannel.
List<ChannelPreview> channelPreviews(
  Iterable<JsonMap> channels, {
  JsonMap? generalChannel,
  String query = '',
}) {
  final items = channels.toList();
  // PWA uses the server's actual main-channel preview when supplied.
  // Fall back to a local row only if the endpoint omits channel 0.
  final fromServer =
      generalChannel ??
      items.where((item) => (item['id'] as num?)?.toInt() == 0).firstOrNull;
  final mainData = <String, dynamic>{
    'name': 'Thảo luận chung',
    'description': 'Kênh chính của nhóm',
    ...?fromServer,
  };
  mainData['id'] = 0;
  final main = ChannelPreview.fromJson(mainData);
  final seen = <int>{0};
  final entries = <ChannelPreview>[main];
  for (final data in items) {
    final channel = ChannelPreview.fromJson(data);
    if (seen.add(channel.id)) entries.add(channel);
  }

  final needle = query.trim().toLowerCase();
  if (needle.isEmpty) return entries;
  return entries
      .where(
        (channel) =>
            '${channel.name} ${channel.description} ${channel.lastMessage}'
                .toLowerCase()
                .contains(needle),
      )
      .toList();
}

String channelPreviewTime(String? value, {DateTime? now}) {
  if (value == null || value.isEmpty) return '';
  final parsed = DateTime.tryParse(value)?.toLocal();
  if (parsed == null) return '';
  final current = (now ?? DateTime.now()).toLocal();
  String two(int value) => value.toString().padLeft(2, '0');
  if (parsed.year == current.year &&
      parsed.month == current.month &&
      parsed.day == current.day) {
    return '${two(parsed.hour)}:${two(parsed.minute)}';
  }
  return '${two(parsed.day)}/${two(parsed.month)}';
}
