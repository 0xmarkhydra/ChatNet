import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
import 'widgets.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({
    super.key,
    required this.api,
    required this.query,
    required this.onOpenConversation,
    required this.onAddFriend,
    required this.onCreateGroup,
  });

  final Api api;
  final String query;
  final ValueChanged<Json> onOpenConversation;
  final VoidCallback onAddFriend;
  final VoidCallback onCreateGroup;

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  List<Json> friends = [];
  List<Json> requests = [];
  List<Json> suggestions = [];
  List<Json> results = [];
  bool loading = true;
  int? busyId;
  String error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ContactsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.query != widget.query) _search();
  }

  Future<void> _load() async {
    try {
      final values = await Future.wait([
        widget.api.request('GET', '/api/friends'),
        widget.api.request('GET', '/api/friends/requests'),
        widget.api.request('GET', '/api/users/suggestions'),
      ]);
      if (!mounted) return;
      setState(() {
        friends = objects(values[0]);
        requests = objects(values[1]);
        suggestions = objects(values[2]);
        results = [];
        loading = false;
        error = '';
      });
    } catch (value) {
      if (mounted) {
        setState(() {
          loading = false;
          error = value.toString();
        });
      }
    }
  }

  Future<void> _search() async {
    final query = widget.query.trim();
    if (query.isEmpty) {
      if (mounted) setState(() => results = []);
      return;
    }
    try {
      final data = objects(
        await widget.api.request(
          'GET',
          '/api/users/search?q=${Uri.encodeQueryComponent(query.replaceFirst('@', ''))}',
        ),
      );
      if (mounted && widget.query.trim() == query) {
        setState(() => results = data);
      }
    } catch (value) {
      _show(value.toString());
    }
  }

  String _relationship(int id) {
    if (friends.any((item) => item['id'] == id)) return 'accepted';
    final request = requests.where((item) => item['id'] == id);
    if (request.isEmpty) return 'none';
    return request.first['direction'] == 'incoming' ? 'incoming' : 'outgoing';
  }

  Future<void> _act(Json person, {bool decline = false}) async {
    final id = (person['id'] as num).toInt();
    final relationship = _relationship(id);
    setState(() => busyId = id);
    try {
      if (decline || relationship == 'outgoing') {
        await widget.api.request('DELETE', '/api/friends/$id');
      } else if (relationship == 'incoming') {
        await widget.api.request('POST', '/api/friends/$id/accept');
      } else if (relationship == 'none') {
        await widget.api.request('POST', '/api/friends/$id');
      }
      await _load();
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => busyId = null);
    }
  }

  Future<void> _message(Json person) async {
    try {
      final room = object(
        await widget.api.request('POST', '/api/conversations/direct', {
          'username': person['username'],
        }),
      );
      widget.onOpenConversation(room);
    } catch (value) {
      _show(value.toString());
    }
  }

  void _show(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    final incoming = requests.where((item) => item['direction'] == 'incoming');
    final outgoing = requests.where((item) => item['direction'] == 'outgoing');
    final list = widget.query.trim().isEmpty ? suggestions : results;
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error.isNotEmpty && friends.isEmpty) {
      return EmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Chưa tải được danh bạ',
        description: error,
        action: FilledButton(onPressed: _load, child: const Text('Thử lại')),
      );
    }
    return ColoredBox(
      color: socoCanvas,
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 30),
          children: [
            SectionHeading(
              eyebrow: 'KẾT NỐI',
              title: 'Danh bạ',
              description: '${friends.length} bạn bè · Đồng bộ từ SocCo',
              action: OutlinedButton(
                onPressed: widget.onAddFriend,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 40),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  foregroundColor: socoBlue,
                  backgroundColor: socoSoftBlue,
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Thêm bạn',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(width: 5),
                    Icon(Icons.north_east_rounded, size: 16),
                  ],
                ),
              ),
            ),
            _shortcuts(),
            if (incoming.isNotEmpty)
              _section(
                'Lời mời kết bạn (${incoming.length})',
                incoming
                    .map(
                      (person) => _PersonRow(
                        person: person,
                        fetchProfileImage: !widget.api.isDemo,
                        busy: busyId == person['id'],
                        label: 'Chấp nhận',
                        onTap: () => _act(person),
                        secondaryLabel: 'Từ chối',
                        onSecondary: () => _act(person, decline: true),
                      ),
                    )
                    .toList(),
              ),
            _section(
              'Bạn bè (${friends.length})',
              friends.isEmpty
                  ? [
                      const EmptyState(
                        icon: Icons.people_outline_rounded,
                        title: 'Chưa có bạn bè',
                        description: 'Tìm người mới để bắt đầu kết nối.',
                      ),
                    ]
                  : friends
                        .map(
                          (person) => _PersonRow(
                            person: person,
                            fetchProfileImage: !widget.api.isDemo,
                            label: 'Nhắn tin',
                            onTap: () => _message(person),
                          ),
                        )
                        .toList(),
            ),
            if (outgoing.isNotEmpty)
              _section(
                'Lời mời đã gửi',
                outgoing
                    .map(
                      (person) => _PersonRow(
                        person: person,
                        fetchProfileImage: !widget.api.isDemo,
                        busy: busyId == person['id'],
                        label: 'Hủy lời mời',
                        onTap: () => _act(person),
                      ),
                    )
                    .toList(),
              ),
            _section(
              widget.query.trim().isEmpty
                  ? 'Người bạn có thể biết'
                  : 'Kết quả tìm kiếm',
              [
                if (list
                    .where(
                      (person) =>
                          person['id'] != widget.api.user['id'] &&
                          (widget.query.trim().isNotEmpty ||
                              _relationship((person['id'] as num).toInt()) ==
                                  'none'),
                    )
                    .isEmpty)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 18, 16, 24),
                    child: Center(
                      child: Text(
                        'Chưa có gợi ý mới phù hợp.',
                        style: TextStyle(color: socoMuted, fontSize: 12),
                      ),
                    ),
                  ),
                ...list
                    .where(
                      (person) =>
                          person['id'] != widget.api.user['id'] &&
                          (widget.query.trim().isNotEmpty ||
                              _relationship((person['id'] as num).toInt()) ==
                                  'none'),
                    )
                    .map((person) {
                      final relation = _relationship(
                        (person['id'] as num).toInt(),
                      );
                      return _PersonRow(
                        person: person,
                        fetchProfileImage: !widget.api.isDemo,
                        busy: busyId == person['id'],
                        label: switch (relation) {
                          'accepted' => 'Nhắn tin',
                          'incoming' => 'Chấp nhận',
                          'outgoing' => 'Đã gửi',
                          _ => 'Kết bạn',
                        },
                        onTap: () => relation == 'accepted'
                            ? _message(person)
                            : _act(person),
                      );
                    }),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _shortcuts() {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 980),
        child: Container(
          margin: const EdgeInsets.fromLTRB(11, 0, 11, 12),
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: socoLine),
            borderRadius: BorderRadius.circular(19),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D243572),
                blurRadius: 24,
                offset: Offset(0, 7),
              ),
            ],
          ),
          child: Column(
            children: [
              _ShortcutRow(
                icon: Icons.add_rounded,
                title: 'Lời mời kết bạn',
                subtitle: 'Tìm và kết nối người mới',
                onTap: widget.onAddFriend,
              ),
              const Divider(height: 1),
              _ShortcutRow(
                icon: Icons.group_outlined,
                title: 'Nhóm và cộng đồng',
                subtitle: 'Tạo cuộc trò chuyện nhóm',
                onTap: widget.onCreateGroup,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 980),
        child: Container(
          margin: const EdgeInsets.fromLTRB(11, 0, 11, 14),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: socoLine),
            borderRadius: BorderRadius.circular(19),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D243572),
                blurRadius: 24,
                offset: Offset(0, 7),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(17, 15, 17, 11),
                child: Text(
                  title,
                  style: const TextStyle(
                    color: Color(0xFF1A2948),
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}

class _ShortcutRow extends StatelessWidget {
  const _ShortcutRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: SizedBox(
        height: 74,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFEDF2FF),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(icon, color: socoBlue, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: socoNavy,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(color: socoMuted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFFA0A8B7),
                size: 25,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PersonRow extends StatelessWidget {
  const _PersonRow({
    required this.person,
    required this.fetchProfileImage,
    required this.label,
    required this.onTap,
    this.busy = false,
    this.secondaryLabel,
    this.onSecondary,
  });

  final Json person;
  final bool fetchProfileImage;
  final bool busy;
  final String label;
  final VoidCallback onTap;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: busy ? null : onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 66),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFEDF0F2))),
        ),
        child: Row(
          children: [
            UserAvatar(
              name:
                  person['displayName']?.toString() ??
                  person['username']?.toString() ??
                  '',
              username: person['username']?.toString(),
              size: 46,
              online: person['online'] == true,
              fetchProfileImage: fetchProfileImage,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '@${person['username']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: socoNavy,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    person['online'] == true ? 'Đang hoạt động' : 'Ngoại tuyến',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            if (secondaryLabel != null)
              TextButton(
                onPressed: busy ? null : onSecondary,
                child: Text(secondaryLabel!),
              ),
            TextButton(
              onPressed: busy ? null : onTap,
              child: busy
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(label, style: const TextStyle(fontSize: 12)),
                        if (label == 'Nhắn tin') ...[
                          const SizedBox(width: 3),
                          const Icon(Icons.chevron_right_rounded, size: 19),
                        ],
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
