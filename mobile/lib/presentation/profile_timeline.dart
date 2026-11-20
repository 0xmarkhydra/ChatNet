import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

/// Native Dart counterpart of the PWA ProfilePage tabs. The profile editor
/// remains outside this widget, so tab switching never discards edits.
class ProfileTimeline extends StatefulWidget {
  const ProfileTimeline({
    super.key,
    required this.api,
    this.refreshRequest = 0,
    required this.username,
    required this.displayName,
    required this.bio,
    required this.city,
    required this.email,
    this.onCreatePost,
    this.onOpenPost,
    this.onOpenContacts,
    this.onViewFriend,
  });

  final Api api;
  final int refreshRequest;
  final String username;
  final String displayName;
  final String bio;
  final String city;
  final String email;
  final VoidCallback? onCreatePost;
  final ValueChanged<int>? onOpenPost;
  final VoidCallback? onOpenContacts;
  final ValueChanged<String>? onViewFriend;

  @override
  State<ProfileTimeline> createState() => _ProfileTimelineState();
}

class _ProfileTimelineState extends State<ProfileTimeline> {
  String tab = 'posts';
  List<Json> posts = [];
  List<Json> friends = [];
  bool loading = true;
  bool loadingMore = false;
  bool hasMore = false;
  String error = '';
  static const pageSize = 15;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ProfileTimeline oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshRequest != widget.refreshRequest ||
        oldWidget.username != widget.username) {
      _load();
    }
  }

  Future<void> _load({bool append = false}) async {
    if (loadingMore) return;
    setState(() {
      if (append) {
        loadingMore = true;
      } else {
        loading = true;
      }
      error = '';
    });
    try {
      final before = append && posts.isNotEmpty
          ? '&before=${posts.map((post) => (post['id'] as num).toInt()).reduce((a, b) => a < b ? a : b)}'
          : '';
      final response = await widget.api.request(
        'GET',
        '/api/posts?scope=mine&limit=$pageSize$before',
      );
      final result = objects(response);
      List<Json> loadedFriends = friends;
      if (!append) {
        try {
          loadedFriends = objects(
            await widget.api.request('GET', '/api/friends'),
          ).where((user) => user['status'] == 'accepted').toList();
        } catch (_) {
          // Timeline availability must not depend on optional friends fetch.
        }
      }
      if (!mounted) return;
      setState(() {
        posts = append
            ? [
                ...posts,
                ...result.where(
                  (post) => !posts.any((old) => old['id'] == post['id']),
                ),
              ]
            : result;
        friends = loadedFriends;
        hasMore = result.length == pageSize;
      });
    } catch (cause) {
      if (mounted) setState(() => error = 'Không tải được bài viết: $cause');
    } finally {
      if (mounted) {
        setState(() {
          loading = false;
          loadingMore = false;
        });
      }
    }
  }

  List<(int, Json)> get media => [
    for (final post in posts)
      for (final item in objects(post['attachments']))
        if (item['kind'] == 'image' || item['kind'] == 'video')
          ((post['id'] as num).toInt(), item),
  ];

  @override
  Widget build(BuildContext context) {
    const items = [
      ('posts', 'Bài viết'),
      ('media', 'Ảnh & video'),
      ('about', 'Giới thiệu'),
      ('friends', 'Bạn bè'),
    ];
    return Container(
      key: const ValueKey('profile-timeline'),
      margin: const EdgeInsets.fromLTRB(9, 0, 9, 12),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: socoLine),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              for (final item in items)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: InkWell(
                      key: ValueKey('profile-tab-${item.$1}'),
                      onTap: () => setState(() => tab = item.$1),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          vertical: 11,
                          horizontal: 2,
                        ),
                        decoration: BoxDecoration(
                          color: tab == item.$1
                              ? socoSoftBlue
                              : const Color(0xFFF8F9FC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: tab == item.$1 ? socoBlue : socoLine,
                          ),
                        ),
                        child: Text(
                          item.$2,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: tab == item.$1 ? socoBlue : socoMuted,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (tab == 'posts') ...[
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Bài viết của bạn',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
                IconButton(
                  key: const ValueKey('profile-reload-posts'),
                  tooltip: 'Làm mới bài viết',
                  onPressed: loading ? null : _load,
                  icon: const Icon(Icons.refresh_rounded),
                ),
                IconButton(
                  key: const ValueKey('profile-new-post'),
                  tooltip: 'Đăng bài mới',
                  onPressed: widget.onCreatePost,
                  icon: const Icon(Icons.add_rounded),
                ),
              ],
            ),
            if (loading) const Center(child: CircularProgressIndicator()),
            if (error.isNotEmpty)
              Text(error, style: const TextStyle(color: Colors.red)),
            if (!loading && posts.isEmpty && error.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 18),
                child: Text('Bạn chưa có bài viết nào.'),
              ),
            for (final post in posts)
              Card(
                key: ValueKey('profile-post-${post['id']}'),
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 10),
                color: Colors.white,
                shape: RoundedRectangleBorder(
                  side: const BorderSide(color: socoLine),
                  borderRadius: BorderRadius.circular(14),
                ),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: widget.onOpenPost == null
                      ? null
                      : () => widget.onOpenPost!((post['id'] as num).toInt()),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            UserAvatar(
                              name: widget.displayName,
                              username: widget.username,
                              size: 38,
                              fetchProfileImage: !widget.api.isDemo,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(widget.displayName,
                                    style: const TextStyle(fontWeight: FontWeight.w800)),
                                  Text(displayDateTime(post['createdAt']),
                                    style: const TextStyle(fontSize: 11, color: socoMuted)),
                                ],
                              ),
                            ),
                            const Icon(Icons.more_horiz_rounded, color: socoMuted),
                          ],
                        ),
                        if ((post['content']?.toString() ?? '').isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(post['content'].toString()),
                        ],
                        if (objects(post['attachments']).isNotEmpty) ...[
                          const SizedBox(height: 10),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: SizedBox(
                              width: double.infinity,
                              height: 180,
                              child: Builder(builder: (context) {
                                final attachment = objects(post['attachments']).first;
                                final url = attachment['url']?.toString() ?? '';
                                return attachment['kind'] == 'image' && url.isNotEmpty
                                    ? Image.network(url, fit: BoxFit.cover,
                                        errorBuilder: (_, _, _) =>
                                            const Center(child: Icon(Icons.broken_image_outlined)))
                                    : const ColoredBox(
                                        color: socoSoftBlue,
                                        child: Center(child: Icon(Icons.play_circle_outline_rounded, size: 40)),
                                      );
                              }),
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        const Divider(height: 1),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: const [
                            Icon(Icons.favorite_border_rounded, color: socoMuted),
                            Icon(Icons.mode_comment_outlined, color: socoMuted),
                            Icon(Icons.share_outlined, color: socoMuted),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ] else if (tab == 'media') ...[
            const Text(
              'Ảnh & video trong các bài viết đã tải',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            if (media.isEmpty)
              const Text('Chưa có ảnh hoặc video trong các bài viết đã tải.')
            else
              GridView.builder(
                key: const ValueKey('profile-media-grid'),
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: media.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 6,
                  crossAxisSpacing: 6,
                ),
                itemBuilder: (ctx, index) {
                  final item = media[index];
                  return InkWell(
                    onTap: widget.onOpenPost == null
                        ? null
                        : () => widget.onOpenPost!(item.$1),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: item.$2['kind'] == 'image'
                          ? Image.network(
                              item.$2['url']?.toString() ?? '',
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) =>
                                  const Icon(Icons.broken_image_outlined),
                            )
                          : const ColoredBox(
                              color: socoSoftBlue,
                              child: Center(
                                child: Icon(Icons.play_arrow_rounded),
                              ),
                            ),
                    ),
                  );
                },
              ),
          ] else if (tab == 'about') ...[
            const Text(
              'Giới thiệu',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            ListTile(
              title: const Text('Tên hiển thị'),
              subtitle: Text(widget.displayName),
            ),
            ListTile(
              title: const Text('Username'),
              subtitle: Text('@${widget.username}'),
            ),
            if (widget.bio.isNotEmpty)
              ListTile(
                title: const Text('Tiểu sử'),
                subtitle: Text(widget.bio),
              ),
            if (widget.city.isNotEmpty)
              ListTile(
                title: const Text('Thành phố'),
                subtitle: Text(widget.city),
              ),
            if (widget.email.isNotEmpty)
              ListTile(
                title: const Text('Email (chỉ bạn xem)'),
                subtitle: Text(widget.email),
              ),
          ] else ...[
            Text(
              '${friends.length} bạn bè',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            for (final friend in friends)
              Material(
                type: MaterialType.transparency,
                child: ListTile(
                  key: ValueKey('profile-friend-${friend['id']}'),
                  leading: UserAvatar(
                    name:
                        friend['displayName']?.toString() ??
                        friend['username']?.toString() ??
                        '',
                    username: friend['username']?.toString(),
                    size: 38,
                    fetchProfileImage: !widget.api.isDemo,
                  ),
                  title: Text(
                    friend['displayName']?.toString() ??
                        friend['username']?.toString() ??
                        '',
                  ),
                  onTap: widget.onViewFriend == null
                      ? null
                      : () => widget.onViewFriend!(
                          friend['username']?.toString() ?? '',
                        ),
                ),
              ),
            if (friends.isEmpty) const Text('Chưa có bạn bè trong danh bạ.'),
            TextButton.icon(
              key: const ValueKey('profile-open-contacts'),
              onPressed: widget.onOpenContacts,
              icon: const Icon(Icons.people_outline_rounded),
              label: const Text('Mở danh bạ'),
            ),
          ],
          if ((tab == 'posts' || tab == 'media') && hasMore)
            TextButton(
              key: const ValueKey('profile-more-posts'),
              onPressed: loadingMore ? null : () => _load(append: true),
              child: Text(loadingMore ? 'Đang tải...' : 'Tải thêm bài viết'),
            ),
        ],
      ),
    );
  }
}
