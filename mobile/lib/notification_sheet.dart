import 'package:flutter/material.dart';

import 'api.dart';
import 'presentation/notification_presenter.dart';
import 'theme.dart';
import 'widgets.dart';

Future<void> showNotificationSheet(
  BuildContext context,
  Api api, {
  ValueChanged<Json>? onOpenConversation,
  ValueChanged<int>? onOpenPost,
  VoidCallback? onOpenInvitations,
}) {
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _NotificationSheet(
      api: api,
      onOpenConversation: onOpenConversation,
      onOpenPost: onOpenPost,
      onOpenInvitations: onOpenInvitations,
    ),
  );
}

class _NotificationSheet extends StatefulWidget {
  const _NotificationSheet({
    required this.api,
    this.onOpenConversation,
    this.onOpenPost,
    this.onOpenInvitations,
  });

  final Api api;
  final ValueChanged<Json>? onOpenConversation;
  final ValueChanged<int>? onOpenPost;
  final VoidCallback? onOpenInvitations;

  @override
  State<_NotificationSheet> createState() => _NotificationSheetState();
}

class _NotificationSheetState extends State<_NotificationSheet> {
  final searchController = TextEditingController();
  final readKeys = <String>{};
  List<MobileNotification> notifications = [];
  bool loading = true;
  int? busyFriendId;
  int? busyMentionId;
  String filter = 'all';
  String error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = '';
    });
    final failures = <String>[];
    Future<List<Json>> source(String path, String label) async {
      try {
        return objects(await widget.api.request('GET', path));
      } catch (_) {
        failures.add(label);
        return [];
      }
    }

    final results = await Future.wait([
      source('/api/friends/requests', 'lời mời kết bạn'),
      source('/api/conversations?limit=100', 'tin nhắn'),
      source('/api/feed/mentions', 'gắn thẻ'),
    ]);
    if (!mounted) return;
    setState(() {
      notifications = buildMobileNotifications(
        requests: results[0],
        conversations: results[1],
        mentions: results[2],
      );
      loading = false;
      error = failures.isEmpty
          ? ''
          : 'Chưa tải được: ${failures.join(', ')}. Kéo xuống để thử lại.';
    });
  }

  Future<void> _friendAction(
    MobileNotification item, {
    bool decline = false,
  }) async {
    final id = (item.data['id'] as num).toInt();
    if (busyFriendId != null) return;
    setState(() => busyFriendId = id);
    try {
      await widget.api.request(
        decline ? 'DELETE' : 'POST',
        decline
            ? '/api/friends/$id?direction=incoming'
            : '/api/friends/$id/accept',
      );
      if (mounted) {
        setState(() {
          notifications.removeWhere((candidate) => candidate.key == item.key);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              decline ? 'Đã từ chối lời mời.' : 'Đã chấp nhận lời mời.',
            ),
          ),
        );
      }
    } catch (cause) {
      if (mounted) setState(() => error = 'Chưa xử lý được lời mời: $cause');
    } finally {
      if (mounted) setState(() => busyFriendId = null);
    }
  }

  Future<void> _open(MobileNotification item) async {
    if (item.kind == 'mention') {
      if (busyMentionId != null) return;
      final id = (item.data['id'] as num).toInt();
      final postId = (item.data['postId'] as num).toInt();
      setState(() => busyMentionId = id);
      try {
        if (!item.serverRead) {
          await widget.api.request('POST', '/api/feed/mentions/$id/read');
        }
        if (!mounted) return;
        setState(() => readKeys.add(item.key));
        _navigate(() => widget.onOpenPost?.call(postId));
      } catch (cause) {
        if (mounted) {
          setState(() => error = 'Không đánh dấu được thông báo: $cause');
        }
      } finally {
        if (mounted) setState(() => busyMentionId = null);
      }
      return;
    }
    if (item.kind == 'friend') {
      _navigate(widget.onOpenInvitations);
      return;
    }
    readKeys.add(item.key);
    _navigate(() => widget.onOpenConversation?.call(item.data));
  }

  void _navigate(VoidCallback? next) {
    Navigator.of(context).pop();
    WidgetsBinding.instance.addPostFrameCallback((_) => next?.call());
  }

  @override
  Widget build(BuildContext context) {
    final visible = filterMobileNotifications(
      notifications,
      filter: filter,
      query: searchController.text,
      locallyRead: readKeys,
    );
    final unread = filterMobileNotifications(
      notifications,
      filter: 'unread',
      locallyRead: readKeys,
    ).length;
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * .84,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Thông báo',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      Text(
                        '$unread thông báo chưa đọc',
                        style: const TextStyle(fontSize: 12, color: socoMuted),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Làm mới thông báo',
                  key: const ValueKey('notification-refresh'),
                  onPressed: loading ? null : _load,
                  icon: const Icon(Icons.refresh_rounded),
                ),
                IconButton(
                  tooltip: 'Đóng',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 9),
            child: TextField(
              controller: searchController,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Tìm thông báo...',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: searchController.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Xóa tìm kiếm',
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => setState(searchController.clear),
                      ),
                isDense: true,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                for (final entry in [
                  ('all', 'Tất cả'),
                  ('unread', 'Chưa đọc'),
                  ('mentions', 'Nhắc đến'),
                ])
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: ChoiceChip(
                        key: ValueKey('notification-filter-${entry.$1}'),
                        label: Center(child: Text(entry.$2)),
                        selected: filter == entry.$1,
                        onSelected: (_) => setState(() => filter = entry.$1),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (error.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 17),
              child: Text(error, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(14, 5, 14, 16),
                      children: [
                        if (visible.isEmpty)
                          const Padding(
                            padding: EdgeInsets.only(top: 52),
                            child: EmptyState(
                              icon: Icons.notifications_none_rounded,
                              title: 'Chưa có thông báo phù hợp',
                              description:
                                  'Lời mời, tin nhắn chưa đọc và bài viết gắn thẻ sẽ xuất hiện ở đây.',
                            ),
                          ),
                        for (final item in visible)
                          Card(
                            key: ValueKey('notification-${item.key}'),
                            elevation: 0,
                            margin: const EdgeInsets.only(bottom: 8),
                            child: Column(
                              children: [
                                ListTile(
                                  onTap: () => _open(item),
                                  leading: CircleAvatar(
                                    backgroundColor: socoSoftBlue,
                                    foregroundColor: socoBlue,
                                    child: Icon(switch (item.kind) {
                                      'friend' => Icons.person_add_alt_rounded,
                                      'mention' =>
                                        Icons.alternate_email_rounded,
                                      _ => Icons.chat_bubble_outline_rounded,
                                    }),
                                  ),
                                  title: Text(
                                    item.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  subtitle: Text(item.subtitle),
                                  trailing:
                                      item.serverRead ||
                                          readKeys.contains(item.key)
                                      ? null
                                      : const Icon(
                                          Icons.circle,
                                          size: 8,
                                          color: socoBlue,
                                        ),
                                ),
                                if (item.kind == 'friend')
                                  Padding(
                                    padding: const EdgeInsets.only(
                                      left: 65,
                                      right: 8,
                                      bottom: 8,
                                    ),
                                    child: Wrap(
                                      spacing: 4,
                                      runSpacing: 4,
                                      children: [
                                        TextButton(
                                          key: ValueKey(
                                            'notification-decline-${item.data['id']}',
                                          ),
                                          onPressed: busyFriendId == null
                                              ? () => _friendAction(
                                                  item,
                                                  decline: true,
                                                )
                                              : null,
                                          child: const Text('Từ chối'),
                                        ),
                                        FilledButton(
                                          key: ValueKey(
                                            'notification-accept-${item.data['id']}',
                                          ),
                                          onPressed: busyFriendId == null
                                              ? () => _friendAction(item)
                                              : null,
                                          child: const Text('Chấp nhận'),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
