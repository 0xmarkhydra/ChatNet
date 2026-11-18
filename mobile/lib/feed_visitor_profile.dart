import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
import 'widgets.dart';

/// Visitor page shared by post, comment, and story author actions.
/// Opening it after dismissing post detail prevents stacked modal backdrops.
class FeedVisitorProfile extends StatefulWidget {
  const FeedVisitorProfile({
    super.key,
    required this.api,
    required this.username,
    required this.onOpenConversation,
    this.onOpenPost,
  });

  final Api api;
  final String username;
  final ValueChanged<Json> onOpenConversation;
  final ValueChanged<Json>? onOpenPost;

  @override
  State<FeedVisitorProfile> createState() => _FeedVisitorProfileState();
}

class _FeedVisitorProfileState extends State<FeedVisitorProfile> {
  Json? profile;
  List<Json> posts = [];
  List<Json> friends = [];
  List<Json> requests = [];
  bool loading = true;
  bool busy = false;
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
      final username = Uri.encodeComponent(widget.username);
      final response = object(
        await widget.api.request('GET', '/api/users/$username/profile'),
      );
      final author = Uri.encodeComponent(
        response['username']?.toString() ?? widget.username,
      );
      final timeline = objects(
        await widget.api.request('GET', '/api/posts?author=$author&limit=15'),
      );
      if (!mounted) return;
      setState(() {
        profile = response;
        posts = timeline;
        loading = false;
      });
      // Relationship is supplemental. If unavailable, keep the profile usable.
      try {
        final info = await Future.wait([
          widget.api.request('GET', '/api/friends'),
          widget.api.request('GET', '/api/friends/requests'),
        ]);
        if (!mounted) return;
        setState(() {
          friends = objects(info[0]);
          requests = objects(info[1]);
        });
      } catch (_) {}
    } catch (cause) {
      if (!mounted) return;
      setState(() {
        error = 'Không tải được hồ sơ: $cause';
        loading = false;
      });
    }
  }

  String get _relation {
    final id = profile?['id'];
    if (friends.any((item) => item['id'] == id)) return 'accepted';
    for (final item in requests) {
      if (item['id'] == id) {
        return item['direction'] == 'incoming' ? 'incoming' : 'outgoing';
      }
    }
    return 'none';
  }

  void _show(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _friendAction() async {
    final id = (profile?['id'] as num?)?.toInt();
    if (id == null || busy) return;
    setState(() => busy = true);
    try {
      final relation = _relation;
      if (relation == 'accepted' || relation == 'outgoing') {
        await widget.api.request('DELETE', '/api/friends/$id');
      } else if (relation == 'incoming') {
        await widget.api.request('POST', '/api/friends/$id/accept');
      } else {
        await widget.api.request('POST', '/api/friends/$id');
      }
      final data = await Future.wait([
        widget.api.request('GET', '/api/friends'),
        widget.api.request('GET', '/api/friends/requests'),
      ]);
      if (!mounted) return;
      setState(() {
        friends = objects(data[0]);
        requests = objects(data[1]);
      });
    } catch (cause) {
      _show('Không cập nhật được kết bạn: $cause');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _message() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final room = object(
        await widget.api.request('POST', '/api/conversations/direct', {
          'username': profile?['username']?.toString() ?? widget.username,
        }),
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onOpenConversation(room);
    } catch (cause) {
      _show('Không thể mở hội thoại: $cause');
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final person = profile;
    final name = person?['displayName']?.toString().isNotEmpty == true
        ? person!['displayName'].toString()
        : widget.username;
    final relation = _relation;
    final resolvedUsername = person?['username']?.toString() ?? widget.username;
    return Scaffold(
      backgroundColor: socoCanvas,
      appBar: AppBar(
        title: const Text('Trang cá nhân'),
        backgroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Làm mới hồ sơ',
            onPressed: loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: loading && person == null
          ? const Center(child: CircularProgressIndicator())
          : error.isNotEmpty && person == null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(error, textAlign: TextAlign.center),
                  TextButton(onPressed: _load, child: const Text('Thử lại')),
                ],
              ),
            )
          : ListView(
              key: const ValueKey('visitor-profile-content'),
              children: [
                Container(
                  color: Colors.white,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 104,
                        width: double.infinity,
                        alignment: Alignment.centerLeft,
                        padding: const EdgeInsets.all(17),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFF2870F5), Color(0xFF8156F0)],
                          ),
                        ),
                        child: const Text(
                          'Khoảnh khắc và những câu chuyện',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            UserAvatar(
                              name: name,
                              username: resolvedUsername,
                              size: 70,
                              fetchProfileImage: !widget.api.isDemo,
                            ),
                            const SizedBox(height: 10),
                            Text(
                              name,
                              style: const TextStyle(
                                color: socoNavy,
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              '@$resolvedUsername',
                              style: const TextStyle(color: socoMuted),
                            ),
                            if (person?['bio']?.toString().isNotEmpty == true)
                              Padding(
                                padding: const EdgeInsets.only(top: 9),
                                child: Text(person!['bio'].toString()),
                              ),
                            if (person?['city']?.toString().isNotEmpty == true)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  person!['city'].toString(),
                                  style: const TextStyle(color: socoMuted),
                                ),
                              ),
                            const SizedBox(height: 14),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                FilledButton.icon(
                                  onPressed: busy ? null : _message,
                                  icon: const Icon(
                                    Icons.chat_bubble_outline_rounded,
                                  ),
                                  label: const Text('Nhắn tin'),
                                ),
                                if (resolvedUsername !=
                                    widget.api.user['username'])
                                  OutlinedButton.icon(
                                    onPressed:
                                        busy ||
                                            (relation == 'none' &&
                                                person?['allowFriendRequests'] ==
                                                    false)
                                        ? null
                                        : _friendAction,
                                    icon: Icon(
                                      relation == 'accepted'
                                          ? Icons.person_remove_alt_1_outlined
                                          : Icons.person_add_alt_1_outlined,
                                    ),
                                    label: Text(switch (relation) {
                                      'accepted' => 'Hủy kết bạn',
                                      'incoming' => 'Chấp nhận kết bạn',
                                      'outgoing' => 'Hủy lời mời',
                                      _ => 'Kết bạn',
                                    }),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.fromLTRB(15, 20, 15, 5),
                  child: Text(
                    'Dòng thời gian',
                    style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                      color: socoNavy,
                    ),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.fromLTRB(15, 0, 15, 12),
                  child: Text(
                    'Các bài viết được chia sẻ với bạn',
                    style: TextStyle(color: socoMuted),
                  ),
                ),
                for (final post in posts)
                  InkWell(
                    key: ValueKey('visitor-post-${post['id']}'),
                    onTap: widget.onOpenPost == null
                        ? null
                        : () => widget.onOpenPost!(post),
                    child: Container(
                      padding: const EdgeInsets.all(15),
                      margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: socoLine),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              color: socoNavy,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            post['content']?.toString() ?? '',
                            maxLines: 8,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (objects(post['attachments']).isNotEmpty) ...[
                            const SizedBox(height: 9),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: SizedBox(
                                width: double.infinity,
                                height: 125,
                                child: Image.network(
                                  objects(
                                        post['attachments'],
                                      ).first['url']?.toString() ??
                                      '',
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) => const ColoredBox(
                                    color: Color(0xFFE8EDF7),
                                    child: Center(
                                      child: Icon(
                                        Icons.image_outlined,
                                        size: 36,
                                        color: socoMuted,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Text(
                                '${post['likes'] ?? 0} lượt thích',
                                style: const TextStyle(
                                  color: socoMuted,
                                  fontSize: 12,
                                ),
                              ),
                              const Spacer(),
                              const Icon(
                                Icons.open_in_new_rounded,
                                color: socoBlue,
                                size: 15,
                              ),
                              const SizedBox(width: 4),
                              const Text(
                                'Xem bài viết',
                                style: TextStyle(
                                  color: socoBlue,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                if (!loading && posts.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(
                      child: Text(
                        'Người này chưa có bài viết để hiển thị.',
                        style: TextStyle(color: socoMuted),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
