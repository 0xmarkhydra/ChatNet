import 'package:flutter/material.dart';

import 'api.dart';
import 'discover_screen.dart';
import 'widgets.dart';

/// Mirrors the PWA Explore shell. The category strip is a sibling of the
/// vertically scrollable content, never a sticky child that can be covered by
/// a collapsing header or floating footer.
enum ExploreCategory { all, people, posts, communities, recent }

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({
    super.key,
    required this.api,
    required this.query,
    this.onOpenConversation,
    this.onViewPosts,
  });

  final Api api;
  final String query;
  final ValueChanged<Json>? onOpenConversation;
  final VoidCallback? onViewPosts;

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  ExploreCategory category = ExploreCategory.all;
  List<Json> communities = [];
  List<Json> nearbyUsers = [];
  List<Json> friends = [];
  List<Json> friendRequests = [];
  int? friendBusyId;
  bool loading = true;
  String error = '';
  String notice = '';
  String? topic;
  int? joiningId;

  static const titles = <String>[
    'Tất cả',
    'Mọi người',
    'Bài viết',
    'Cộng đồng',
    'Gần đây',
  ];
  static const purple = Color(0xFF4F46E5);
  static const canvas = Color(0xFFF6F6FB);
  static const muted = Color(0xFF5B5B7B);

  @override
  void initState() {
    super.initState();
    _loadCommunities();
    _loadRelationships();
  }

  Future<void> _loadRelationships() async {
    try {
      final responses = await Future.wait([
        widget.api.request('GET', '/api/friends'),
        widget.api.request('GET', '/api/friends/requests'),
      ]);
      if (!mounted) return;
      setState(() {
        friends = objects(responses[0]);
        friendRequests = objects(responses[1]);
      });
    } catch (_) {
      // Suggestions still work when relationship data cannot be refreshed.
    }
  }

  String _relationship(Json user) {
    final id = user['id'];
    if (friends.any((friend) => friend['id'] == id)) return 'accepted';
    for (final request in friendRequests) {
      if (request['id'] == id) {
        return request['direction'] == 'incoming' ? 'incoming' : 'outgoing';
      }
    }
    return 'none';
  }

  String _friendLabel(Json user) => switch (_relationship(user)) {
    'accepted' => 'Nhắn tin',
    'incoming' => 'Chấp nhận',
    'outgoing' => 'Hủy lời mời',
    _ => 'Kết bạn',
  };

  Future<void> _friend(Json user) async {
    final id = (user['id'] as num?)?.toInt();
    if (id == null || friendBusyId != null) return;
    final relation = _relationship(user);
    setState(() => friendBusyId = id);
    try {
      if (relation == 'accepted') {
        final result = object(
          await widget.api.request('POST', '/api/conversations/direct', {
            'username': user['username'],
          }),
        );
        widget.onOpenConversation?.call(result);
      } else {
        if (relation == 'incoming') {
          await widget.api.request('POST', '/api/friends/$id/accept');
        } else if (relation == 'outgoing') {
          await widget.api.request(
            'DELETE',
            '/api/friends/$id?direction=outgoing',
          );
        } else {
          await widget.api.request('POST', '/api/friends/$id');
        }
        await _loadRelationships();
      }
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể cập nhật kết bạn: $cause')),
        );
      }
    } finally {
      if (mounted) setState(() => friendBusyId = null);
    }
  }

  Future<void> _loadCommunities() async {
    if (mounted) {
      setState(() {
        loading = true;
        error = '';
      });
    }
    try {
      final response = objects(
        await widget.api.request('GET', '/api/groups/public?limit=30&q='),
      );
      if (!mounted) return;
      setState(() {
        communities = response
            .where(
              (e) =>
                  e['id'] is num &&
                  e['name'] is String &&
                  e['visibility'] == 'public',
            )
            .toList();
        loading = false;
      });
    } catch (cause) {
      if (mounted) {
        setState(() {
          error = 'Không tải được cộng đồng công khai: $cause';
          loading = false;
        });
      }
    }
  }

  Future<void> _join(Json group) async {
    final id = (group['id'] as num?)?.toInt();
    if (id == null || joiningId != null) return;
    setState(() {
      joiningId = id;
      notice = '';
    });
    try {
      final result = object(
        await widget.api.request('POST', '/api/groups/$id/join'),
      );
      if (!mounted) return;
      setState(() {
        communities.removeWhere((entry) => entry['id'] == id);
        notice = result['status'] == 'member'
            ? 'Đã tham gia cộng đồng.'
            : 'Đã gửi yêu cầu, đang chờ quản trị viên duyệt.';
      });
    } catch (cause) {
      if (mounted) {
        setState(() => notice = 'Không tham gia được cộng đồng: $cause');
      }
    } finally {
      if (mounted) setState(() => joiningId = null);
    }
  }

  void _select(ExploreCategory next) {
    if (category == next) return;
    setState(() => category = next);
  }

  Widget _tabs() {
    return Container(
      key: const ValueKey('explore-fixed-tabs'),
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 8, 0, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE3E3F0))),
        boxShadow: [
          BoxShadow(
            color: Color(0x0A18274B),
            blurRadius: 8,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: SizedBox(
        height: 44,
        child: ListView.separated(
          key: const ValueKey('explore-horizontal-tabs'),
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(right: 16),
          itemCount: titles.length,
          separatorBuilder: (_, _) => const SizedBox(width: 10),
          itemBuilder: (context, index) {
            final selected = category.index == index;
            return Semantics(
              button: true,
              selected: selected,
              child: InkWell(
                key: ValueKey(
                  'explore-tab-${ExploreCategory.values[index].name}',
                ),
                onTap: () => _select(ExploreCategory.values[index]),
                borderRadius: BorderRadius.circular(24),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  decoration: BoxDecoration(
                    color: selected ? purple : Colors.white,
                    border: Border.all(
                      color: selected ? purple : const Color(0xFFE3E3F0),
                    ),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Text(
                    titles[index],
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: selected ? Colors.white : const Color(0xFF19233C),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _scroll(String view, List<Widget> sections) => ListView(
    key: ValueKey('explore-scroll-$view'),
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
    children: [
      for (var i = 0; i < sections.length; i++) ...[
        if (i > 0) const SizedBox(height: 20),
        sections[i],
      ],
    ],
  );

  Widget _section({required String heading, required Widget child}) =>
      Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              heading,
              style: const TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w700,
                color: Color(0xFF19233C),
              ),
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      );

  Widget _link(String label, VoidCallback onTap, {bool primary = false}) =>
      SizedBox(
        width: double.infinity,
        child: OutlinedButton(
          onPressed: onTap,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 44),
            foregroundColor: primary ? Colors.white : purple,
            backgroundColor: primary ? purple : Colors.white,
            side: BorderSide(color: primary ? purple : const Color(0xFFE3E3F0)),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: Text(label, textAlign: TextAlign.center),
        ),
      );

  Widget _hero() => Container(
    key: const ValueKey('explore-feature'),
    decoration: BoxDecoration(
      color: const Color(0xFF3730A3),
      borderRadius: BorderRadius.circular(20),
    ),
    padding: const EdgeInsets.all(24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Hôm nay bạn muốn khám phá gì?',
          style: TextStyle(
            color: Colors.white,
            fontSize: 24,
            height: 1.2,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'Tìm người mới, kết nối cộng đồng và khám phá các bài viết công khai trên ChatNet.',
          style: TextStyle(color: Color(0xFFEAE9FF), fontSize: 14),
        ),
        const SizedBox(height: 20),
        _link(
          'Tìm người gần đây',
          () => _select(ExploreCategory.recent),
          primary: true,
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _link(
                'Tham gia cộng đồng',
                () => _select(ExploreCategory.communities),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _link(
                'Xem bài viết mới',
                () => widget.onViewPosts?.call(),
              ),
            ),
          ],
        ),
      ],
    ),
  );

  Widget _people() {
    if (nearbyUsers.isEmpty) {
      return _section(
        heading: 'Người nên kết nối',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Chưa có gợi ý kết nối',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            const Text(
              'Hãy quét ở mục Gần đây để tìm thêm bạn bè.',
              style: TextStyle(color: muted),
            ),
            const SizedBox(height: 12),
            _link('Khám phá gần đây', () => _select(ExploreCategory.recent)),
          ],
        ),
      );
    }
    final query = widget.query.trim().toLowerCase();
    final users = nearbyUsers
        .where(
          (user) =>
              query.isEmpty ||
              '${user['displayName']} ${user['username']}'
                  .toLowerCase()
                  .contains(query),
        )
        .toList();
    return _section(
      heading: 'Người nên kết nối',
      child: Column(
        children: [
          for (final user in users)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: UserAvatar(
                name:
                    user['displayName']?.toString() ??
                    user['username']?.toString() ??
                    '',
                username: user['username']?.toString(),
                fetchProfileImage: !widget.api.isDemo,
              ),
              title: Text(
                user['displayName']?.toString() ??
                    user['username']?.toString() ??
                    '',
              ),
              subtitle: Text('@${user['username']}'),
              trailing: TextButton(
                onPressed: friendBusyId != null ? null : () => _friend(user),
                child: friendBusyId == user['id']
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(_friendLabel(user)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _communityList() {
    if (loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(20),
          child: CircularProgressIndicator(),
        ),
      );
    }
    if (error.isNotEmpty) {
      return Column(
        children: [
          Text(error, style: const TextStyle(color: muted)),
          const SizedBox(height: 10),
          _link('Thử lại', _loadCommunities),
        ],
      );
    }
    if (communities.isEmpty) {
      return const Text(
        'Chưa có cộng đồng gợi ý. Hiện chưa có cộng đồng công khai phù hợp.',
        style: TextStyle(color: muted),
      );
    }
    final topics = communities
        .map((g) => (g['topic']?.toString() ?? '').trim())
        .where((s) => s.isNotEmpty)
        .toSet()
        .toList();
    final groups = communities
        .where((g) => topic == null || g['topic'] == topic)
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (notice.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(notice, style: const TextStyle(color: purple)),
          ),
        if (topics.isNotEmpty) ...[
          SizedBox(
            height: 42,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                ChoiceChip(
                  label: const Text('Tất cả'),
                  selected: topic == null,
                  onSelected: (_) => setState(() => topic = null),
                ),
                const SizedBox(width: 8),
                for (final option in topics) ...[
                  ChoiceChip(
                    label: Text(option),
                    selected: topic == option,
                    onSelected: (_) =>
                        setState(() => topic = topic == option ? null : option),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        for (final group in groups)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFE3E3F0)),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: const Color(0xFFEDEBFF),
                        child: Text(
                          (group['name'] as String)
                              .substring(0, 1)
                              .toUpperCase(),
                          style: const TextStyle(
                            color: purple,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          group['name'].toString(),
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if ((group['description']?.toString() ?? '').isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      group['description'].toString(),
                      style: const TextStyle(color: muted),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Text(
                    '${group['memberCount'] ?? 0} thành viên',
                    style: const TextStyle(color: muted, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  _link(
                    joiningId == group['id'] ? 'Đang xử lý…' : 'Tham gia',
                    () => _join(group),
                    primary: true,
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _nearYou() => _section(
    heading: 'Gần bạn',
    child: Column(
      children: [
        const Text(
          'Bật quét để thấy người đang ở trong bán kính bạn chọn.',
          style: TextStyle(color: muted),
        ),
        const SizedBox(height: 12),
        const Icon(Icons.radar_rounded, color: purple, size: 68),
        const SizedBox(height: 12),
        _link('Quét người gần đây', () => _select(ExploreCategory.recent)),
      ],
    ),
  );

  Widget _bodyFor(ExploreCategory view) => switch (view) {
    ExploreCategory.all => _scroll('all', [
      _hero(),
      if (!loading && communities.isEmpty && nearbyUsers.isEmpty)
        _section(
          heading: 'Bắt đầu khám phá ChatNet',
          child: Column(
            children: [
              _link(
                'Quét người gần đây',
                () => _select(ExploreCategory.recent),
              ),
              const SizedBox(height: 8),
              _link(
                'Xem cộng đồng',
                () => _select(ExploreCategory.communities),
              ),
            ],
          ),
        ),
      if (communities.isNotEmpty || loading || error.isNotEmpty)
        _section(heading: 'Cộng đồng đang hoạt động', child: _communityList()),
      if (nearbyUsers.isNotEmpty) _people(),
      _nearYou(),
    ]),
    ExploreCategory.people => _scroll('people', [_people()]),
    ExploreCategory.posts => _scroll('posts', [
      _section(
        heading: 'Khám phá bài viết',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Chưa có danh sách bài viết nổi bật riêng cho Khám phá. Hãy tìm các bài viết công khai trên ChatNet.',
              style: TextStyle(color: muted),
            ),
            const SizedBox(height: 14),
            _link('Đến trang tìm kiếm', () => widget.onViewPosts?.call()),
          ],
        ),
      ),
    ]),
    ExploreCategory.communities => _scroll('communities', [
      _section(heading: 'Cộng đồng đang hoạt động', child: _communityList()),
    ]),
    ExploreCategory.recent => DiscoverScreen(
      key: const ValueKey('explore-nearby-scanner'),
      api: widget.api,
      query: widget.query,
      onOpenConversation: widget.onOpenConversation,
      onPeopleScanned: (users) {
        if (mounted) setState(() => nearbyUsers = users);
        _loadRelationships();
      },
    ),
  };

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: canvas,
      child: Column(
        children: [
          _tabs(),
          // Keep the Nearby scanner mounted when switching categories so an
          // active geolocation scan and its results are not discarded.
          Expanded(
            child: IndexedStack(
              index: category.index,
              children: [
                for (final view in ExploreCategory.values) _bodyFor(view),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
