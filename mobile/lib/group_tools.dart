import 'package:flutter/material.dart';

import 'api.dart';
import 'media_viewer.dart';
import 'theme.dart';
import 'widgets.dart';

Future<Json?> showCreateGroupDialog(BuildContext context, Api api) {
  return showDialog<Json>(
    context: context,
    builder: (context) => _CreateGroupDialog(api: api),
  );
}

class _CreateGroupDialog extends StatefulWidget {
  const _CreateGroupDialog({required this.api});

  final Api api;

  @override
  State<_CreateGroupDialog> createState() => _CreateGroupDialogState();
}

class _CreateGroupDialogState extends State<_CreateGroupDialog> {
  final nameController = TextEditingController();
  List<Json> friends = [];
  final selected = <String>{};
  bool loading = true;
  bool saving = false;
  String error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = objects(await widget.api.request('GET', '/api/friends'));
      if (mounted) {
        setState(() {
          friends = data;
          loading = false;
        });
      }
    } catch (value) {
      if (mounted) {
        setState(() {
          error = value.toString();
          loading = false;
        });
      }
    }
  }

  Future<void> _create() async {
    final name = nameController.text.trim();
    if (name.isEmpty || selected.isEmpty) return;
    setState(() {
      saving = true;
      error = '';
    });
    try {
      final room = object(
        await widget.api.request('POST', '/api/conversations/groups', {
          'name': name,
          'usernames': selected.toList(),
        }),
      );
      if (mounted) Navigator.pop(context, room);
    } catch (value) {
      if (mounted) setState(() => error = value.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  void dispose() {
    nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Tạo nhóm mới'),
      content: SizedBox(
        width: 460,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              maxLength: 120,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Tên nhóm',
                counterText: '',
                prefixIcon: Icon(Icons.groups_rounded),
              ),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Chọn bạn bè · ${selected.length} đã chọn',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 300),
              child: loading
                  ? const Center(child: CircularProgressIndicator())
                  : friends.isEmpty
                  ? const EmptyState(
                      icon: Icons.people_outline,
                      title: 'Chưa có bạn bè',
                      description: 'Kết bạn trước khi tạo nhóm.',
                    )
                  : ListView(
                      shrinkWrap: true,
                      children: [
                        for (final friend in friends)
                          CheckboxListTile(
                            value: selected.contains(friend['username']),
                            onChanged: saving
                                ? null
                                : (checked) {
                                    setState(() {
                                      if (checked == true) {
                                        selected.add(friend['username']);
                                      } else {
                                        selected.remove(friend['username']);
                                      }
                                    });
                                  },
                            secondary: UserAvatar(
                              name:
                                  friend['displayName']?.toString() ??
                                  friend['username']?.toString() ??
                                  '',
                              username: friend['username']?.toString(),
                              size: 42,
                              online: friend['online'] == true,
                              fetchProfileImage: !widget.api.isDemo,
                            ),
                            title: Text(
                              friend['displayName']?.toString() ??
                                  friend['username']?.toString() ??
                                  '',
                            ),
                            subtitle: Text('@${friend['username']}'),
                          ),
                      ],
                    ),
            ),
            if (error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  error,
                  style: const TextStyle(color: Color(0xFFBE123C)),
                ),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: saving ? null : () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed:
              saving || nameController.text.trim().isEmpty || selected.isEmpty
              ? null
              : _create,
          child: Text(saving ? 'Đang tạo...' : 'Tạo nhóm'),
        ),
      ],
    );
  }
}

Future<bool> showGroupSettings(
  BuildContext context,
  Api api,
  Json conversation,
) async {
  return await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        builder: (context) =>
            _GroupSettingsSheet(api: api, conversation: conversation),
      ) ??
      false;
}

class _GroupSettingsSheet extends StatefulWidget {
  const _GroupSettingsSheet({required this.api, required this.conversation});

  final Api api;
  final Json conversation;

  @override
  State<_GroupSettingsSheet> createState() => _GroupSettingsSheetState();
}

class _GroupSettingsSheetState extends State<_GroupSettingsSheet> {
  late final nameController = TextEditingController(
    text: widget.conversation['name']?.toString(),
  );
  final inviteController = TextEditingController();
  List<Json> members = [];
  bool loading = true;
  bool busy = false;
  String error = '';

  int get roomId => (widget.conversation['id'] as num).toInt();
  Json? get currentMember {
    final found = members.where(
      (member) => member['id'] == widget.api.user['id'],
    );
    return found.isEmpty ? null : found.first;
  }

  bool get canManage =>
      currentMember?['role'] == 'owner' || currentMember?['role'] == 'admin';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = objects(
        await widget.api.request('GET', '/api/conversations/$roomId/members'),
      );
      if (mounted) {
        setState(() {
          members = data;
          loading = false;
          error = '';
        });
      }
    } catch (value) {
      if (mounted) {
        setState(() {
          error = value.toString();
          loading = false;
        });
      }
    }
  }

  Future<void> _rename() async {
    final name = nameController.text.trim();
    if (name.isEmpty || name == widget.conversation['name']) return;
    await _run(() async {
      final updated = object(
        await widget.api.request('PATCH', '/api/conversations/$roomId', {
          'name': name,
        }),
      );
      widget.conversation
        ..clear()
        ..addAll(updated);
    });
  }

  Future<void> _invite() async {
    final usernames = inviteController.text
        .split(RegExp(r'[\s,]+'))
        .map((item) => item.trim().replaceFirst('@', ''))
        .where((item) => item.isNotEmpty)
        .toSet()
        .toList();
    if (usernames.isEmpty) return;
    await _run(() async {
      await widget.api.request('POST', '/api/conversations/$roomId/members', {
        'usernames': usernames,
      });
      inviteController.clear();
      await _load();
    });
  }

  Future<void> _role(Json member, String role) async {
    await _run(() async {
      await widget.api.request(
        'PATCH',
        '/api/conversations/$roomId/members/${member['id']}',
        {'role': role},
      );
      await _load();
    });
  }

  Future<void> _remove(Json member) async {
    await _run(() async {
      await widget.api.request(
        'DELETE',
        '/api/conversations/$roomId/members/${member['id']}',
      );
      if (member['id'] == widget.api.user['id'] && mounted) {
        Navigator.pop(context, true);
      } else {
        await _load();
      }
    });
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await action();
    } catch (value) {
      if (mounted) setState(() => error = value.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    nameController.dispose();
    inviteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          0,
          16,
          MediaQuery.viewInsetsOf(context).bottom + 16,
        ),
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * .82,
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Quản lý nhóm',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        Text(
                          currentMember?['role'] == 'owner'
                              ? 'Bạn là chủ nhóm'
                              : currentMember?['role'] == 'admin'
                              ? 'Bạn là quản trị viên'
                              : 'Bạn là thành viên',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              if (canManage) ...[
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: nameController,
                        enabled: !busy,
                        maxLength: 120,
                        decoration: const InputDecoration(
                          labelText: 'Tên nhóm',
                          counterText: '',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: busy ? null : _rename,
                      child: const Text('Đổi tên'),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: inviteController,
                        enabled: !busy,
                        decoration: const InputDecoration(
                          labelText: 'Mời bằng @username',
                          hintText: 'linh, alex',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      tooltip: 'Thêm thành viên',
                      onPressed: busy ? null : _invite,
                      icon: const Icon(Icons.person_add_alt_1_rounded),
                    ),
                  ],
                ),
              ],
              if (error.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    error,
                    style: const TextStyle(color: Color(0xFFBE123C)),
                  ),
                ),
              const SizedBox(height: 12),
              Expanded(
                child: loading
                    ? const Center(child: CircularProgressIndicator())
                    : ListView.separated(
                        itemCount: members.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final member = members[index];
                          final self = member['id'] == widget.api.user['id'];
                          final owner = currentMember?['role'] == 'owner';
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: UserAvatar(
                              name:
                                  member['displayName']?.toString() ??
                                  member['username']?.toString() ??
                                  '',
                              username: member['username']?.toString(),
                              size: 44,
                              online: member['online'] == true,
                              fetchProfileImage: !widget.api.isDemo,
                            ),
                            title: Text(
                              '${member['displayName'] ?? member['username']}${self ? ' · Bạn' : ''}',
                            ),
                            subtitle: Text(
                              '${member['role'] == 'owner'
                                  ? 'Chủ nhóm'
                                  : member['role'] == 'admin'
                                  ? 'Quản trị viên'
                                  : 'Thành viên'}${member['online'] == true ? ' · online' : ''}',
                            ),
                            trailing: self && member['role'] != 'owner'
                                ? TextButton(
                                    onPressed: busy
                                        ? null
                                        : () => _remove(member),
                                    child: const Text(
                                      'Rời nhóm',
                                      style: TextStyle(color: Colors.red),
                                    ),
                                  )
                                : owner && member['role'] != 'owner'
                                ? PopupMenuButton<String>(
                                    enabled: !busy,
                                    onSelected: (value) {
                                      if (value == 'remove') {
                                        _remove(member);
                                      } else {
                                        _role(member, value);
                                      }
                                    },
                                    itemBuilder: (context) => [
                                      PopupMenuItem(
                                        value: member['role'] == 'admin'
                                            ? 'member'
                                            : 'admin',
                                        child: Text(
                                          member['role'] == 'admin'
                                              ? 'Gỡ admin'
                                              : 'Đặt admin',
                                        ),
                                      ),
                                      const PopupMenuItem(
                                        value: 'owner',
                                        child: Text('Chuyển chủ nhóm'),
                                      ),
                                      const PopupMenuItem(
                                        value: 'remove',
                                        child: Text(
                                          'Xóa khỏi nhóm',
                                          style: TextStyle(color: Colors.red),
                                        ),
                                      ),
                                    ],
                                  )
                                : null,
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> showSharedContent(
  BuildContext context,
  Api api,
  Json conversation,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) =>
        _SharedContentSheet(api: api, conversation: conversation),
  );
}

class _SharedContentSheet extends StatefulWidget {
  const _SharedContentSheet({required this.api, required this.conversation});

  final Api api;
  final Json conversation;

  @override
  State<_SharedContentSheet> createState() => _SharedContentSheetState();
}

class _SharedContentSheetState extends State<_SharedContentSheet>
    with SingleTickerProviderStateMixin {
  late final controller = TabController(length: 3, vsync: this);
  final values = <String, List<Json>>{};
  bool loading = false;
  String error = '';

  @override
  void initState() {
    super.initState();
    _load('media');
    controller.addListener(() {
      if (!controller.indexIsChanging) {
        _load(const ['media', 'files', 'links'][controller.index]);
      }
    });
  }

  Future<void> _load(String kind) async {
    if (values.containsKey(kind) || loading) return;
    setState(() {
      loading = true;
      error = '';
    });
    try {
      final result = object(
        await widget.api.request(
          'GET',
          '/api/conversations/${widget.conversation['id']}/shared?kind=$kind&limit=48',
        ),
      );
      if (mounted) setState(() => values[kind] = objects(result['items']));
    } catch (value) {
      if (mounted) setState(() => error = value.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .8,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Nội dung đã chia sẻ',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            TabBar(
              controller: controller,
              tabs: const [
                Tab(text: 'Ảnh & video'),
                Tab(text: 'Tệp'),
                Tab(text: 'Liên kết'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: controller,
                children: [_items('media'), _items('files'), _items('links')],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _items(String kind) {
    final items = values[kind];
    if (loading && items == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (error.isNotEmpty && items == null) {
      return EmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Chưa tải được nội dung',
        description: error,
      );
    }
    if (items == null || items.isEmpty) {
      return const EmptyState(
        icon: Icons.collections_outlined,
        title: 'Chưa có nội dung',
        description:
            'Nội dung được chia sẻ trong cuộc trò chuyện sẽ hiện ở đây.',
      );
    }
    if (kind == 'links') {
      final links = items
          .expand(
            (message) => RegExp(r'https?://[^\s<>"]+', caseSensitive: false)
                .allMatches(message['text']?.toString() ?? '')
                .map(
                  (match) => {
                    'url': match
                        .group(0)!
                        .replaceFirst(RegExp(r'[),.!?;:]+$'), ''),
                    'sender': message['sender'],
                  },
                ),
          )
          .toList();
      return ListView(
        padding: const EdgeInsets.all(14),
        children: [
          for (final item in links)
            ListTile(
              leading: const Icon(Icons.link_rounded),
              title: Text(
                item['url']?.toString() ?? '',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text('@${item['sender']}'),
              trailing: const Icon(Icons.open_in_new_rounded),
              onTap: () =>
                  openAttachment(context, {'kind': 'file', 'url': item['url']}),
            ),
        ],
      );
    }
    final attachments = items
        .expand((message) => objects(message['attachments']))
        .where((attachment) {
          final attachmentKind = attachment['kind'];
          return kind == 'media'
              ? attachmentKind == 'image' || attachmentKind == 'video'
              : attachmentKind == 'file' || attachmentKind == 'audio';
        })
        .toList();
    if (kind == 'media') {
      return GridView.builder(
        padding: const EdgeInsets.all(14),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 180,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
        ),
        itemCount: attachments.length,
        itemBuilder: (context, index) {
          final item = attachments[index];
          return InkWell(
            onTap: () => openAttachment(context, item),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: item['kind'] == 'image'
                  ? Image.network(
                      item['url']?.toString() ?? '',
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) =>
                          const ColoredBox(color: socoSoftBlue),
                    )
                  : const ColoredBox(
                      color: socoNavy,
                      child: Icon(
                        Icons.play_circle_outline,
                        color: Colors.white,
                      ),
                    ),
            ),
          );
        },
      );
    }
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        for (final item in attachments)
          ListTile(
            leading: Icon(
              kind == 'links' ? Icons.link_rounded : Icons.description_outlined,
            ),
            title: Text(item['name']?.toString() ?? 'Nội dung'),
            subtitle: Text(item['url']?.toString() ?? ''),
            trailing: const Icon(Icons.open_in_new_rounded),
            onTap: () => openAttachment(context, item),
          ),
      ],
    );
  }
}
