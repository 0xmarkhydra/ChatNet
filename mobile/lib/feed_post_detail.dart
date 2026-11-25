import 'package:flutter/material.dart';

import 'api.dart';
import 'public_post_location.dart';
import 'media_viewer.dart';
import 'reaction_participants_sheet.dart';
import 'theme.dart';
import 'widgets.dart';

/// Native Dart equivalent of the PWA PostCommentsPage.
/// A single post and its discussion live together, with the composer anchored
/// while the post body and comments can scroll.
class FeedPostDetail extends StatefulWidget {
  const FeedPostDetail({
    super.key,
    required this.api,
    required this.initialPost,
    required this.onUpdate,
    required this.onShare,
    required this.onPostAction,
    required this.onCommentAction,
  });

  final Api api;
  final Json initialPost;
  final ValueChanged<Json> onUpdate;
  final Future<void> Function(Json post) onShare;
  final Future<void> Function(Json post, String action) onPostAction;
  final Future<Json?> Function(Json post, Json comment, String action)
  onCommentAction;

  @override
  State<FeedPostDetail> createState() => _FeedPostDetailState();
}

class _FeedPostDetailState extends State<FeedPostDetail> {
  final commentController = TextEditingController();
  final commentFocus = FocusNode();
  late Json post;
  bool submitting = false;
  bool liking = false;
  bool likingComment = false;
  bool newestFirst = true;
  Json? replyingTo;

  @override
  void initState() {
    super.initState();
    post = {...widget.initialPost};
  }

  @override
  void dispose() {
    commentController.dispose();
    commentFocus.dispose();
    super.dispose();
  }

  int get postId => (post['id'] as num).toInt();

  void _update(Json updated) {
    if (!mounted) return;
    setState(() => post = {...updated});
    widget.onUpdate(updated);
  }

  void _show(String value) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(value)));
  }

  void _visit(String username) {
    if (username.trim().isEmpty) return;
    // The caller opens the visitor route only AFTER this modal is disposed.
    Navigator.of(context).pop(username.trim());
  }

  Future<void> _like() async {
    if (liking) return;
    setState(() => liking = true);
    try {
      final updated = object(
        await widget.api.request('POST', '/api/posts/$postId/like'),
      );
      _update(updated);
    } catch (error) {
      _show('Không cập nhật được cảm xúc: $error');
    } finally {
      if (mounted) setState(() => liking = false);
    }
  }

  Future<void> _toggleCommentLike(Json comment) async {
    if (likingComment) return;
    final id = (comment['id'] as num?)?.toInt();
    if (id == null) return;
    final desired = comment['liked'] != true;
    setState(() => likingComment = true);
    try {
      final updated = object(
        await widget.api.request(
          desired ? 'PUT' : 'DELETE',
          '/api/posts/$postId/comments/$id/like',
        ),
      );
      final fresh = objects(
        updated['comments'],
      ).where((item) => item['id'] == id);
      if (fresh.isEmpty || fresh.first['liked'] != desired) {
        throw const ApiError('Chưa xác nhận cập nhật lượt thích.');
      }
      _update(updated);
    } catch (error) {
      _show('Không cập nhật được lượt thích bình luận: $error');
    } finally {
      if (mounted) setState(() => likingComment = false);
    }
  }

  Future<void> _submit() async {
    final text = commentController.text.trim();
    if (submitting || text.isEmpty) return;
    setState(() => submitting = true);
    try {
      final updated = object(
        await widget.api.request('POST', '/api/posts/$postId/comments', {
          'content': text,
          if (replyingTo != null) 'parentId': replyingTo!['id'],
        }),
      );
      if (!mounted) return;
      commentController.clear();
      setState(() => replyingTo = null);
      _update(updated);
      FocusScope.of(context).unfocus();
    } catch (error) {
      _show('Không thể gửi bình luận: $error');
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  Future<void> _commentAction(Json comment, String action) async {
    final updated = await widget.onCommentAction(post, comment, action);
    if (!mounted || updated == null) return;
    _update(updated);
  }

  List<Json> get _roots {
    final roots = objects(
      post['comments'],
    ).where((item) => item['parentId'] == null).toList();
    roots.sort((left, right) {
      final a = left['createdAt']?.toString() ?? left['id']?.toString() ?? '';
      final b = right['createdAt']?.toString() ?? right['id']?.toString() ?? '';
      return newestFirst ? b.compareTo(a) : a.compareTo(b);
    });
    return roots;
  }

  Widget _commentTile(Json comment, {bool reply = false}) {
    final username = comment['author']?.toString() ?? '';
    final displayName =
        comment['authorDisplayName']?.toString().isNotEmpty == true
        ? comment['authorDisplayName'].toString()
        : username;
    final mine = username == widget.api.user['username'];
    return Padding(
      padding: EdgeInsets.fromLTRB(reply ? 46 : 12, 7, 10, 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UserAvatar(
            name: displayName,
            username: username,
            size: reply ? 30 : 36,
            fetchProfileImage: !widget.api.isDemo,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F4F9),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  padding: const EdgeInsets.fromLTRB(11, 7, 11, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      InkWell(
                        onTap: username.isEmpty ? null : () => _visit(username),
                        child: Text(
                          displayName,
                          style: const TextStyle(
                            color: socoNavy,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      if (comment['content']?.toString().isNotEmpty == true)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            comment['content'].toString(),
                            style: const TextStyle(fontSize: 13, height: 1.4),
                          ),
                        ),
                    ],
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextButton.icon(
                      key: ValueKey('post-comment-like-${comment['id']}'),
                      onPressed: likingComment
                          ? null
                          : () => _toggleCommentLike(comment),
                      icon: Icon(
                        comment['liked'] == true
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded,
                        color: comment['liked'] == true
                            ? const Color(0xFFE11D48)
                            : socoMuted,
                        size: 15,
                      ),
                      label: Text(
                        comment['liked'] == true ? 'Đã thích' : 'Thích',
                        style: const TextStyle(fontSize: 11),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        setState(() => replyingTo = comment);
                        commentFocus.requestFocus();
                      },
                      child: const Text(
                        'Trả lời',
                        style: TextStyle(fontSize: 11),
                      ),
                    ),
                    PopupMenuButton<String>(
                      key: ValueKey('post-comment-menu-${comment['id']}'),
                      tooltip: 'Tùy chọn bình luận',
                      icon: const Icon(Icons.more_horiz_rounded, size: 18),
                      onSelected: (value) => _commentAction(comment, value),
                      itemBuilder: (_) => [
                        if (mine) ...[
                          const PopupMenuItem(
                            value: 'edit',
                            child: Text('Sửa bình luận'),
                          ),
                          const PopupMenuItem(
                            value: 'delete',
                            child: Text('Xóa bình luận'),
                          ),
                        ] else
                          const PopupMenuItem(
                            value: 'report',
                            child: Text('Báo cáo bình luận'),
                          ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _media(Json attachment) {
    final url = attachment['url']?.toString() ?? '';
    final kind = attachment['kind']?.toString();
    return InkWell(
      onTap: () => openAttachment(context, attachment),
      child: Container(
        height: 220,
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 7),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(13),
          color: const Color(0xFFE8EDF7),
        ),
        child: kind == 'image' && url.isNotEmpty
            ? Image.network(
                url,
                fit: BoxFit.cover,
                errorBuilder: (ctx, error, stack) => const Icon(
                  Icons.broken_image_outlined,
                  size: 48,
                  color: socoMuted,
                ),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    kind == 'video'
                        ? Icons.play_circle_outline_rounded
                        : Icons.attach_file_rounded,
                    size: 48,
                    color: socoBlue,
                  ),
                  Text(
                    attachment['name']?.toString() ?? 'Mở tệp',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
      ),
    );
  }

  Widget _postArticle() {
    final author = post['author']?.toString() ?? '';
    final display = post['authorDisplayName']?.toString().isNotEmpty == true
        ? post['authorDisplayName'].toString()
        : author;
    final visibility = switch (post['visibility']?.toString()) {
      'private' => 'Chỉ mình tôi',
      'friends' => 'Bạn bè',
      _ => 'Công khai',
    };
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(14, 15, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (post['repostKind'] == 'quick')
            const Padding(
              padding: EdgeInsets.only(bottom: 9),
              child: Row(
                children: [
                  Icon(Icons.repeat_rounded, size: 16, color: socoMuted),
                  SizedBox(width: 5),
                  Text(
                    'Đã đăng lại',
                    style: TextStyle(
                      color: socoMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          Row(
            children: [
              UserAvatar(
                name: display,
                username: author,
                size: 43,
                fetchProfileImage: !widget.api.isDemo,
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InkWell(
                      key: const ValueKey('post-detail-author'),
                      onTap: () => _visit(author),
                      child: Text(
                        display,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: socoNavy,
                        ),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${displayDateTime(post['createdAt'])} · $visibility',
                      style: const TextStyle(color: socoMuted, fontSize: 12),
                    ),
                    PublicPostLocationLink(post: post),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Tùy chọn bài viết',
                onPressed: () => widget.onPostAction(post, 'options'),
                icon: const Icon(Icons.more_horiz_rounded),
              ),
            ],
          ),
          if (post['content']?.toString().trim().isNotEmpty == true) ...[
            const SizedBox(height: 13),
            Text(
              post['content'].toString(),
              style: const TextStyle(
                fontSize: 15,
                height: 1.5,
                color: socoText,
              ),
            ),
          ],
          if (objects(post['attachments']).isNotEmpty) ...[
            const SizedBox(height: 12),
            for (final attachment in objects(post['attachments']))
              _media(attachment),
          ],
          if (post['originalPost'] is Map) ...[
            const SizedBox(height: 12),
            Container(
              key: const ValueKey('post-detail-original-preview'),
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F7FB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: socoLine),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (post['originalPost'] as Map)['authorDisplayName']
                            ?.toString() ??
                        (post['originalPost'] as Map)['author']?.toString() ??
                        '',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    (post['originalPost'] as Map)['content']?.toString() ?? '',
                    maxLines: 8,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _actions() {
    final likes = (post['likes'] as num?)?.toInt() ?? 0;
    final comments = objects(post['comments']).length;
    final shares = (post['shares'] as num?)?.toInt();
    final liked = post['liked'] == true;

    Widget compact(
      String key,
      IconData icon,
      String label,
      VoidCallback? onTap, {
      Color? iconColor,
    }) {
      return Expanded(
        child: TextButton(
          key: ValueKey(key),
          onPressed: onTap,
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            minimumSize: const Size(0, 40),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 17, color: iconColor),
                const SizedBox(width: 5),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(11, 2, 11, 7),
      child: Column(
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            children: [
              TextButton.icon(
                key: const ValueKey('post-detail-reactions'),
                onPressed: likes > 0
                    ? () => showReactionParticipants(
                        context,
                        api: widget.api,
                        id: postId,
                        isPost: true,
                        reactions: [
                          {'emoji': '👍', 'count': likes},
                        ],
                      )
                    : null,
                icon: const Icon(Icons.favorite_rounded, size: 17),
                label: Text(
                  '$likes lượt thích',
                  style: const TextStyle(fontSize: 12),
                ),
              ),
              Text(
                '$comments bình luận',
                style: const TextStyle(color: socoMuted, fontSize: 12),
              ),
              if (shares != null)
                Text(
                  '$shares chia sẻ',
                  style: const TextStyle(color: socoMuted, fontSize: 12),
                ),
            ],
          ),
          const Divider(height: 1),
          Row(
            children: [
              compact(
                'post-detail-like',
                liked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                'Thích',
                liking ? null : _like,
                iconColor: liked ? const Color(0xFFE11D48) : socoMuted,
              ),
              compact(
                'post-detail-focus-comment',
                Icons.chat_bubble_outline_rounded,
                'Bình luận',
                commentFocus.requestFocus,
              ),
              compact(
                'post-detail-share',
                Icons.ios_share_rounded,
                'Chia sẻ',
                () => widget.onShare(post),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _thread() {
    final replies = objects(post['comments']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 5),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Bình luận (${replies.length})',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: socoNavy,
                    fontSize: 18,
                  ),
                ),
              ),
              DropdownButton<bool>(
                key: const ValueKey('post-comment-sort'),
                value: newestFirst,
                underline: const SizedBox.shrink(),
                items: const [
                  DropdownMenuItem(value: true, child: Text('Mới nhất')),
                  DropdownMenuItem(value: false, child: Text('Cũ nhất')),
                ],
                onChanged: (value) {
                  if (value != null) setState(() => newestFirst = value);
                },
              ),
            ],
          ),
        ),
        if (replies.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(
              child: Text(
                'Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.',
                style: TextStyle(color: socoMuted),
              ),
            ),
          ),
        for (final root in _roots) ...[
          _commentTile(root),
          for (final reply in replies.where(
            (item) => item['parentId'] == root['id'],
          ))
            _commentTile(reply, reply: true),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final author = post['authorDisplayName']?.toString().isNotEmpty == true
        ? post['authorDisplayName'].toString()
        : post['author']?.toString() ?? '';
    return Dialog.fullscreen(
      backgroundColor: socoCanvas,
      child: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(14, 7, 9, 7),
              color: Colors.white,
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Bài viết của $author',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: socoNavy,
                      ),
                    ),
                  ),
                  IconButton(
                    key: const ValueKey('close-post-detail'),
                    tooltip: 'Đóng chi tiết bài viết',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                key: const ValueKey('post-detail-content'),
                children: [
                  _postArticle(),
                  _actions(),
                  _thread(),
                  const SizedBox(height: 18),
                ],
              ),
            ),
            Container(
              color: Colors.white,
              padding: EdgeInsets.fromLTRB(
                12,
                8,
                12,
                MediaQuery.viewInsetsOf(context).bottom > 0 ? 7 : 13,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (replyingTo != null)
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Trả lời @${replyingTo!['author']}',
                            style: const TextStyle(
                              color: socoBlue,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: () => setState(() => replyingTo = null),
                          icon: const Icon(Icons.close_rounded, size: 18),
                        ),
                      ],
                    ),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          key: const ValueKey('post-detail-comment-input'),
                          controller: commentController,
                          focusNode: commentFocus,
                          enabled: !submitting,
                          minLines: 1,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            hintText: 'Viết bình luận...',
                            isDense: true,
                          ),
                        ),
                      ),
                      IconButton(
                        key: const ValueKey('post-detail-send-comment'),
                        tooltip: 'Gửi bình luận',
                        onPressed: submitting ? null : _submit,
                        icon: const Icon(Icons.send_rounded, color: socoBlue),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
