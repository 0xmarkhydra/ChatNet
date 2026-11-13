import 'dart:async';
import 'package:flutter/material.dart';

import 'api.dart';
import 'group_tools.dart';
import 'theme.dart';
import 'widgets.dart';

/// Mobile counterpart of the Web group/community workspace.
class GroupsScreen extends StatefulWidget {
  const GroupsScreen({
    super.key,
    required this.api,
    required this.onOpenConversation,
  });

  final Api api;
  final ValueChanged<Json> onOpenConversation;

  @override
  State<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends State<GroupsScreen> {
  List<Json> groups = [];
  List<Json> publicGroups = [];
  List<Json> channels = [];
  List<Json> messages = [];
  List<Json> members = [];
  Json? selected;
  Json? community;
  Json? notificationPreferences;
  int channelId = 0;
  int? joiningId;
  bool loading = true;
  bool busy = false;
  bool publicLoading = false;
  String error = '';
  String channelError = '';
  String search = '';
  final searchController = TextEditingController();
  final messageController = TextEditingController();
  final channelNameController = TextEditingController();
  String? pendingClientId;

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
      final value = objects(
        await widget.api.request('GET', '/api/conversations'),
      );
      if (!mounted) return;
      setState(() {
        groups = value.where((room) => room['type'] == 'group').toList();
        loading = false;
      });
    } catch (value) {
      if (mounted) {
        setState(() {
          error = value.toString();
          loading = false;
        });
      }
    }
    await _loadPublic();
  }

  Future<void> _loadPublic() async {
    if (!mounted) return;
    setState(() => publicLoading = true);
    try {
      final data = objects(
        await widget.api.request(
          'GET',
          '/api/groups/public?limit=30&q=${Uri.encodeQueryComponent(search)}',
        ),
      );
      if (!mounted) return;
      setState(() => publicGroups = data);
    } catch (value) {
      if (!mounted) return;
      // Do not hide existing personal groups when the discovery API is unavailable.
      setState(() {
        publicGroups = [];
        if (error.isEmpty && groups.isEmpty) error = value.toString();
      });
    } finally {
      if (mounted) setState(() => publicLoading = false);
    }
  }

  void _show(String text) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    }
  }

  Future<void> _create() async {
    final room = await showCreateGroupDialog(context, widget.api);
    if (!mounted || room == null) return;
    await _load();
    if (mounted) _open(room);
  }

  Future<void> _join(Json group) async {
    final id = (group['id'] as num?)?.toInt();
    if (id == null || joiningId != null) return;
    setState(() => joiningId = id);
    try {
      final result = object(
        await widget.api.request('POST', '/api/groups/$id/join'),
      );
      if (!mounted) return;
      if (result['status'] == 'member') {
        _show('Đã tham gia cộng đồng.');
        await _load();
      } else {
        _show('Đã gửi yêu cầu tham gia. Chờ quản trị viên duyệt.');
      }
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => joiningId = null);
    }
  }

  Future<void> _open(Json room) async {
    setState(() {
      selected = room;
      channels = [];
      messages = [];
      channelId = 0;
      community = null;
      notificationPreferences = null;
      members = [];
      channelError = '';
    });
    await _loadSelected();
  }

  Future<void> _loadSelected() async {
    final id = (selected?['id'] as num?)?.toInt();
    if (id == null) return;
    final values = await Future.wait([
      _safeGet('/api/conversations/$id/community'),
      _safeGet('/api/conversations/$id/channels'),
      _safeGet('/api/conversations/$id/members'),
      _safeGet('/api/conversations/$id/notification-settings'),
    ]);
    if (!mounted || selected?['id'] != id) return;
    setState(() {
      community = values[0] is Map<String, dynamic> ? object(values[0]) : null;
      channels = values[1] is List ? objects(values[1]) : [];
      members = values[2] is List ? objects(values[2]) : [];
      notificationPreferences = values[3] is Map<String, dynamic>
          ? object(values[3])
          : null;
    });
  }

  Future<dynamic> _safeGet(String path) async {
    try {
      return await widget.api.request('GET', path);
    } catch (_) {
      return null;
    }
  }

  bool get _canEdit {
    final mine = members
        .where((m) => m['id'] == widget.api.user['id'])
        .firstOrNull;
    return mine?['role'] == 'admin' || mine?['role'] == 'owner';
  }

  Future<void> _settings() async {
    if (selected == null) return;
    final left = await showGroupSettings(context, widget.api, selected!);
    if (!mounted) return;
    if (left) {
      setState(() => selected = null);
    }
    await _load();
    if (selected != null) await _loadSelected();
  }

  Future<void> _editMetadata() async {
    final id = (selected?['id'] as num?)?.toInt();
    if (id == null || !_canEdit) return;
    final description = TextEditingController(
      text: community?['description']?.toString() ?? '',
    );
    final topic = TextEditingController(
      text: community?['topic']?.toString() ?? '',
    );
    final rules = TextEditingController(
      text: community?['rules']?.toString() ?? '',
    );
    String visibility = community?['visibility'] == 'public'
        ? 'public'
        : 'private';
    final updated = await showDialog<Json>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: const Text('Thông tin cộng đồng'),
            content: SizedBox(
              width: 460,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: description,
                      maxLength: 500,
                      maxLines: 3,
                      decoration: const InputDecoration(labelText: 'Mô tả'),
                    ),
                    TextField(
                      controller: topic,
                      maxLength: 100,
                      decoration: const InputDecoration(labelText: 'Chủ đề'),
                    ),
                    TextField(
                      controller: rules,
                      maxLength: 5000,
                      maxLines: 5,
                      decoration: const InputDecoration(labelText: 'Nội quy'),
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: visibility,
                      decoration: const InputDecoration(
                        labelText: 'Quyền truy cập',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'private',
                          child: Text('Riêng tư'),
                        ),
                        DropdownMenuItem(
                          value: 'public',
                          child: Text('Công khai'),
                        ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setDialogState(() => visibility = value);
                        }
                      },
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Hủy'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, {
                  'description': description.text.trim(),
                  'topic': topic.text.trim(),
                  'rules': rules.text.trim(),
                  'visibility': visibility,
                }),
                child: const Text('Lưu'),
              ),
            ],
          );
        },
      ),
    );
    description.dispose();
    topic.dispose();
    rules.dispose();
    if (updated == null || !mounted) return;
    await _run(() async {
      final result = object(
        await widget.api.request(
          'PATCH',
          '/api/conversations/$id/community',
          updated,
        ),
      );
      if (mounted) setState(() => community = result);
    }, 'Đã cập nhật cộng đồng.');
  }

  Future<void> _notificationSettings() async {
    final id = (selected?['id'] as num?)?.toInt();
    if (id == null) return;
    var messagesEnabled =
        notificationPreferences?['messageNotifications'] != false;
    var mentionsEnabled =
        notificationPreferences?['mentionNotifications'] != false;
    final updated = await showDialog<Json>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => AlertDialog(
          title: const Text('Thông báo nhóm'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SwitchListTile(
                title: const Text('Thông báo tin nhắn'),
                value: messagesEnabled,
                onChanged: (value) => update(() => messagesEnabled = value),
              ),
              SwitchListTile(
                title: const Text('Khi được nhắc đến'),
                value: mentionsEnabled,
                onChanged: (value) => update(() => mentionsEnabled = value),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, {
                'messageNotifications': messagesEnabled,
                'mentionNotifications': mentionsEnabled,
              }),
              child: const Text('Lưu'),
            ),
          ],
        ),
      ),
    );
    if (updated == null || !mounted) return;
    await _run(() async {
      final prefs = object(
        await widget.api.request(
          'PUT',
          '/api/conversations/$id/notification-settings',
          updated,
        ),
      );
      if (mounted) setState(() => notificationPreferences = prefs);
    }, 'Đã lưu thông báo.');
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await action();
      _show(success);
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _openChannel(int channel) async {
    final id = (selected?['id'] as num?)?.toInt();
    if (id == null) return;
    if (channel == 0) {
      widget.onOpenConversation(selected!);
      return;
    }
    setState(() {
      channelId = channel;
      messages = [];
      channelError = '';
    });
    try {
      final data = objects(
        await widget.api.request(
          'GET',
          '/api/conversations/$id/messages?channelId=$channel&limit=100',
        ),
      );
      if (mounted && selected?['id'] == id && channelId == channel) {
        setState(() => messages = data);
      }
    } catch (value) {
      if (mounted) setState(() => channelError = value.toString());
    }
  }

  Future<void> _sendChannel() async {
    final id = (selected?['id'] as num?)?.toInt();
    final message = messageController.text.trim();
    if (id == null || channelId == 0 || message.isEmpty || busy) return;
    // Preserve the clientId and draft on ambiguous network writes.
    pendingClientId ??= DateTime.now().microsecondsSinceEpoch.toString();
    setState(() {
      busy = true;
      channelError = '';
    });
    try {
      final sent = object(
        await widget.api.request('POST', '/api/conversations/$id/messages', {
          'text': message,
          'clientId': pendingClientId,
          'channelId': channelId,
          'attachments': <Json>[],
        }),
      );
      if (!mounted) return;
      setState(() {
        messages = [...messages.where((m) => m['id'] != sent['id']), sent]
          ..sort((a, b) => (a['id'] as num).compareTo(b['id'] as num));
        messageController.clear();
        pendingClientId = null;
      });
    } catch (value) {
      if (mounted) setState(() => channelError = value.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _createChannel() async {
    final id = (selected?['id'] as num?)?.toInt();
    if (id == null || !_canEdit) return;
    channelNameController.clear();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Tạo kênh thảo luận'),
        content: TextField(
          controller: channelNameController,
          maxLength: 80,
          decoration: const InputDecoration(labelText: 'Tên kênh'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(context, channelNameController.text.trim()),
            child: const Text('Tạo'),
          ),
        ],
      ),
    );
    if (name == null || name.isEmpty || !mounted) return;
    await _run(() async {
      final value = object(
        await widget.api.request('POST', '/api/conversations/$id/channels', {
          'name': name,
          'description': '',
        }),
      );
      await _loadSelected();
      if (value['id'] is num) await _openChannel((value['id'] as num).toInt());
    }, 'Đã tạo kênh.');
  }

  @override
  void dispose() {
    searchController.dispose();
    messageController.dispose();
    channelNameController.dispose();
    super.dispose();
  }

  Widget _groupTile(Json room) {
    final unread = (room['unreadCount'] as num?)?.toInt() ?? 0;
    return Card(
      elevation: 0,
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        side: const BorderSide(color: socoLine),
        borderRadius: BorderRadius.circular(17),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.fromLTRB(12, 5, 4, 5),
        leading: UserAvatar(
          name: room['name']?.toString() ?? '',
          group: true,
          size: 48,
        ),
        title: Text(
          room['name']?.toString() ?? 'Nhóm',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          '${room['memberCount'] ?? 0} thành viên · $unread tin chưa đọc',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: IconButton(
          tooltip: 'Quản lý nhóm',
          onPressed: () => _open(room),
          icon: const Icon(Icons.settings_outlined),
        ),
        onTap: () => widget.onOpenConversation(room),
      ),
    );
  }

  Widget _publicTile(Json room) {
    final joined = groups.any((item) => item['id'] == room['id']);
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        side: const BorderSide(color: socoLine),
        borderRadius: BorderRadius.circular(17),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const CircleAvatar(
              backgroundColor: socoSoftBlue,
              child: Icon(Icons.public_rounded, color: socoBlue),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    room['name']?.toString() ?? 'Cộng đồng',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  Text(
                    '${room['topic'] ?? 'Cộng đồng'} · ${room['memberCount'] ?? 0} thành viên',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if ((room['description']?.toString() ?? '').isNotEmpty)
                    Text(
                      room['description'].toString(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            const SizedBox(width: 5),
            OutlinedButton(
              onPressed: joined || joiningId != null ? null : () => _join(room),
              child: Text(joined ? 'Đã tham gia' : 'Tham gia'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _groupList() {
    final filtered = groups
        .where(
          (room) => (room['name']?.toString() ?? '').toLowerCase().contains(
            search.toLowerCase(),
          ),
        )
        .toList();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 30),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Nhóm & cộng đồng',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    Text(
                      'Trò chuyện, khám phá và quản lý các nhóm.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                onPressed: _create,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Tạo nhóm'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: searchController,
            onChanged: (value) => setState(() => search = value),
            onSubmitted: (_) => _loadPublic(),
            decoration: InputDecoration(
              hintText: 'Tìm nhóm, cộng đồng',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: search.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Xóa tìm kiếm',
                      onPressed: () {
                        searchController.clear();
                        setState(() => search = '');
                        _loadPublic();
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
            ),
          ),
          const SizedBox(height: 22),
          Text(
            'Nhóm của bạn · ${filtered.length}',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          if (loading)
            const Center(child: CircularProgressIndicator())
          else if (filtered.isEmpty)
            const Padding(
              padding: EdgeInsets.all(22),
              child: Text(
                'Chưa có nhóm phù hợp. Tạo nhóm hoặc tham gia cộng đồng.',
              ),
            )
          else
            for (final room in filtered) _groupTile(room),
          if (error.isNotEmpty)
            TextButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded),
              label: Text(error),
            ),
          const SizedBox(height: 18),
          Text(
            'Khám phá cộng đồng công khai',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          if (publicLoading)
            const Center(child: CircularProgressIndicator())
          else if (publicGroups.isEmpty)
            const Padding(
              padding: EdgeInsets.all(18),
              child: Text('Không có cộng đồng công khai phù hợp.'),
            )
          else
            for (final room in publicGroups) _publicTile(room),
        ],
      ),
    );
  }

  Widget _selectedView() {
    final room = selected!;
    final title = room['name']?.toString() ?? 'Cộng đồng';
    if (channelId != 0) return _channelView();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            IconButton(
              tooltip: 'Trở về danh sách nhóm',
              onPressed: () => setState(() => selected = null),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            IconButton(
              tooltip: 'Làm mới nhóm',
              onPressed: _loadSelected,
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        Card(
          elevation: 0,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.groups_2_outlined, size: 36, color: socoBlue),
                const SizedBox(height: 8),
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                Text(
                  '${room['memberCount'] ?? members.length} thành viên · ${community?['visibility'] == 'public' ? 'Công khai' : 'Riêng tư'}',
                ),
                if ((community?['description']?.toString() ?? '').isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(community!['description'].toString()),
                  ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton.icon(
                      onPressed: () => widget.onOpenConversation(room),
                      icon: const Icon(Icons.chat_bubble_outline_rounded),
                      label: const Text('Trò chuyện chung'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _settings,
                      icon: const Icon(Icons.group_outlined),
                      label: const Text('Thành viên'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _notificationSettings,
                      icon: const Icon(Icons.notifications_outlined),
                      label: const Text('Thông báo'),
                    ),
                    if (_canEdit)
                      OutlinedButton.icon(
                        onPressed: _editMetadata,
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Chỉnh sửa'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                'Kênh thảo luận',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            if (_canEdit)
              IconButton(
                tooltip: 'Tạo kênh',
                onPressed: _createChannel,
                icon: const Icon(Icons.add_circle_outline_rounded),
              ),
          ],
        ),
        Card(
          elevation: 0,
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.forum_outlined, color: socoBlue),
                title: const Text('Thảo luận chung'),
                subtitle: const Text('Tin nhắn nhóm'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => _openChannel(0),
              ),
              for (final channel in channels)
                if (channel['id'] != 0)
                  ListTile(
                    leading: const Icon(Icons.tag_rounded, color: socoBlue),
                    title: Text(channel['name']?.toString() ?? 'Kênh'),
                    subtitle: Text(channel['description']?.toString() ?? ''),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => _openChannel((channel['id'] as num).toInt()),
                  ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Text('Nội quy', style: Theme.of(context).textTheme.titleMedium),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text(
            community?['rules']?.toString().isNotEmpty == true
                ? community!['rules'].toString()
                : 'Chưa có nội quy.',
          ),
        ),
      ],
    );
  }

  Widget _channelView() {
    final channel = channels
        .where((item) => item['id'] == channelId)
        .firstOrNull;
    return Column(
      children: [
        ListTile(
          leading: IconButton(
            tooltip: 'Về cộng đồng',
            onPressed: () => setState(() {
              channelId = 0;
              channelError = '';
            }),
            icon: const Icon(Icons.arrow_back_rounded),
          ),
          title: Text(channel?['name']?.toString() ?? 'Kênh thảo luận'),
          subtitle: Text(selected?['name']?.toString() ?? ''),
        ),
        const Divider(height: 1),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => _openChannel(channelId),
            child: ListView(
              padding: const EdgeInsets.all(14),
              children: [
                if (messages.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(20),
                    child: Text('Chưa có tin nhắn trong kênh.'),
                  ),
                for (final message in messages)
                  Align(
                    alignment: message['senderId'] == widget.api.user['id']
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Container(
                      constraints: const BoxConstraints(maxWidth: 420),
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: message['senderId'] == widget.api.user['id']
                            ? socoSoftBlue
                            : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            message['senderDisplayName']?.toString() ??
                                message['sender']?.toString() ??
                                '',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          Text(
                            message['deleted'] == true
                                ? 'Tin nhắn đã thu hồi'
                                : message['text']?.toString() ?? 'Tệp đính kèm',
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (channelError.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Text(
              channelError,
              style: const TextStyle(color: Color(0xFFBE123C)),
            ),
          ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: messageController,
                    onChanged: (_) {
                      if (pendingClientId != null) pendingClientId = null;
                    },
                    minLines: 1,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      hintText: 'Nhắn tin trong kênh...',
                    ),
                  ),
                ),
                const SizedBox(width: 7),
                IconButton.filled(
                  tooltip: 'Gửi tin nhắn',
                  onPressed: busy ? null : _sendChannel,
                  icon: const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1000),
            child: selected == null ? _groupList() : _selectedView(),
          ),
        );
      },
    );
  }
}
