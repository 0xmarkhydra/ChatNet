import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
import 'widgets.dart';

/// Notifications are derived from the same friend/conversation data as Web.
/// "Viewed" is local UI state; opening a chat is what clears server unread.
Future<void> showNotificationSheet(
  BuildContext context,
  Api api, {
  ValueChanged<Json>? onOpenConversation,
  VoidCallback? onOpenInvitations,
}) {
  return Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) => NotificationsPage(
        api: api,
        onOpenConversation: onOpenConversation,
        onOpenInvitations: onOpenInvitations,
      ),
    ),
  );
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({
    super.key,
    required this.api,
    this.onOpenConversation,
    this.onOpenInvitations,
  });

  final Api api;
  final ValueChanged<Json>? onOpenConversation;
  final VoidCallback? onOpenInvitations;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<Json> requests = [];
  List<Json> conversations = [];
  final viewed = <String>{};
  String filter = 'all';
  String query = '';
  String? selectedKey;
  bool loading = true;
  int? busyFriend;
  String error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = '';
    });
    try {
      final result = await Future.wait([
        widget.api.request('GET', '/api/friends/requests'),
        widget.api.request('GET', '/api/conversations'),
      ]);
      if (!mounted) return;
      setState(() {
        requests = objects(result[0]);
        conversations = objects(result[1]);
        loading = false;
      });
    } catch (value) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = value.toString();
      });
    }
  }

  List<_Notice> get _notices {
    final items = <_Notice>[
      for (final friend in requests)
        if (friend['direction'] == 'incoming' && friend['status'] != 'accepted')
          _Notice(
            key: 'friend:${friend['id']}',
            title: (friend['displayName'] ?? friend['username'] ?? 'Người dùng')
                .toString(),
            description: 'đã gửi lời mời kết bạn',
            time: (friend['updatedAt'] ?? '').toString(),
            friend: friend,
          ),
      for (final room in conversations)
        if ((room['unreadCount'] as num?) != null &&
            (room['unreadCount'] as num) > 0)
          _Notice(
            key: 'chat:${room['id']}',
            title: (room['name'] ?? 'Cuộc trò chuyện').toString(),
            description: 'có ${room['unreadCount']} tin nhắn chưa đọc',
            time: (room['lastMessageAt'] ?? room['createdAt'] ?? '').toString(),
            conversation: room,
          ),
    ];
    items.sort((a, b) => b.time.compareTo(a.time));
    return items;
  }

  List<_Notice> get _filtered => _notices.where((item) {
    if (filter == 'mentions') return false; // Mention API is not available.
    if (filter == 'unread' && viewed.contains(item.key)) return false;
    final search = query.toLowerCase().trim();
    return search.isEmpty ||
        '${item.title} ${item.description}'.toLowerCase().contains(search);
  }).toList();

  void _openRoom(Json room) {
    Navigator.pop(context);
    widget.onOpenConversation?.call(room);
  }

  Future<void> _friendAction(Json friend, {required bool accept}) async {
    final id = (friend['id'] as num?)?.toInt();
    if (id == null || busyFriend != null) return;
    setState(() => busyFriend = id);
    try {
      if (accept) {
        await widget.api.request('POST', '/api/friends/$id/accept');
      } else {
        await widget.api.request('DELETE', '/api/friends/$id');
      }
      if (!mounted) return;
      setState(() {
        requests.removeWhere((item) => item['id'] == id);
        busyFriend = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            accept ? 'Đã chấp nhận lời mời.' : 'Đã từ chối lời mời.',
          ),
        ),
      );
    } catch (value) {
      if (!mounted) return;
      setState(() => busyFriend = null);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(value.toString())));
    }
  }

  Widget _details(_Notice item) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(item.title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(item.description),
          const SizedBox(height: 16),
          if (item.friend != null) ...[
            FilledButton.icon(
              onPressed: busyFriend == null
                  ? () => _friendAction(item.friend!, accept: true)
                  : null,
              icon: const Icon(Icons.check_rounded),
              label: const Text('Chấp nhận lời mời'),
            ),
            TextButton.icon(
              onPressed: busyFriend == null
                  ? () => _friendAction(item.friend!, accept: false)
                  : null,
              icon: const Icon(Icons.close_rounded),
              label: const Text('Từ chối'),
            ),
          ] else if (item.conversation != null)
            FilledButton.icon(
              onPressed: widget.onOpenConversation == null
                  ? null
                  : () => _openRoom(item.conversation!),
              icon: const Icon(Icons.chat_bubble_outline_rounded),
              label: const Text('Mở cuộc trò chuyện'),
            ),
          TextButton.icon(
            onPressed: () => setState(() => viewed.add(item.key)),
            icon: const Icon(Icons.done_all_rounded),
            label: const Text('Đánh dấu đã xem trên thiết bị'),
          ),
        ],
      ),
    );
  }

  Widget _list(bool wide) {
    final items = _filtered;
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error.isNotEmpty) {
      return EmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Không tải được thông báo',
        description: error,
        action: FilledButton(onPressed: _load, child: const Text('Thử lại')),
      );
    }
    if (items.isEmpty) {
      return EmptyState(
        icon: Icons.notifications_none_rounded,
        title: filter == 'mentions'
            ? 'Chưa có thông báo nhắc đến'
            : 'Không có thông báo phù hợp',
        description: filter == 'mentions'
            ? 'Thông báo nhắc đến sẽ có khi máy chủ hỗ trợ.'
            : 'Lời mời kết bạn và hội thoại chưa đọc sẽ xuất hiện ở đây.',
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 20),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          final selected = selectedKey == item.key;
          return Card(
            elevation: 0,
            color: selected ? socoSoftBlue : Colors.white,
            shape: RoundedRectangleBorder(
              side: const BorderSide(color: socoLine),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                ListTile(
                  selected: selected,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  leading: CircleAvatar(
                    backgroundColor: socoSoftBlue,
                    child: Icon(
                      item.friend == null
                          ? Icons.chat_bubble_outline_rounded
                          : Icons.person_add_alt_1_rounded,
                      color: socoBlue,
                    ),
                  ),
                  title: Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(item.description),
                  trailing: viewed.contains(item.key)
                      ? const Icon(
                          Icons.done_all_rounded,
                          color: socoMuted,
                          size: 18,
                        )
                      : const Icon(Icons.circle, size: 9, color: socoBlue),
                  onTap: () => setState(() {
                    selectedKey = selected ? null : item.key;
                    viewed.add(item.key);
                  }),
                ),
                if (!wide && selected) _details(item),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final all = _notices;
    final newCount = all.where((notice) => !viewed.contains(notice.key)).length;
    return Scaffold(
      backgroundColor: socoCanvas,
      appBar: AppBar(
        title: const Text('Thông báo'),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
          if (widget.onOpenInvitations != null)
            IconButton(
              tooltip: 'Lời mời kết bạn',
              onPressed: () {
                Navigator.pop(context);
                widget.onOpenInvitations?.call();
              },
              icon: const Icon(Icons.person_add_alt_1_rounded),
            ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 760;
          final items = _filtered;
          final selected = items.where((i) => i.key == selectedKey).firstOrNull;
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1100),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
                    child: Text(
                      'Thông báo mới · $newCount',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: TextField(
                      onChanged: (value) => setState(() => query = value),
                      decoration: const InputDecoration(
                        hintText: 'Tìm thông báo',
                        prefixIcon: Icon(Icons.search_rounded),
                        isDense: true,
                      ),
                    ),
                  ),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    child: Row(
                      children: [
                        for (final entry in const [
                          ('all', 'Tất cả'),
                          ('unread', 'Chưa đọc'),
                          ('mentions', 'Nhắc đến'),
                        ])
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text(entry.$2),
                              selected: filter == entry.$1,
                              onSelected: (_) =>
                                  setState(() => filter = entry.$1),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: wide
                        ? Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(child: _list(true)),
                              const VerticalDivider(width: 1),
                              Expanded(
                                child: SingleChildScrollView(
                                  child: selected == null
                                      ? const EmptyState(
                                          icon: Icons
                                              .notifications_active_outlined,
                                          title: 'Chọn một thông báo',
                                          description:
                                              'Chi tiết và các thao tác sẽ hiện tại đây.',
                                        )
                                      : _details(selected),
                                ),
                              ),
                            ],
                          )
                        : _list(false),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Notice {
  const _Notice({
    required this.key,
    required this.title,
    required this.description,
    required this.time,
    this.friend,
    this.conversation,
  });

  final String key;
  final String title;
  final String description;
  final String time;
  final Json? friend;
  final Json? conversation;
}
