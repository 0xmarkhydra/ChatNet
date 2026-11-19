import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'state/app_providers.dart';
import 'presentation/feed_list_presenter.dart';
import 'package:mime/mime.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import 'api.dart';
import 'feed_post_detail.dart';
import 'feed_story_create_sheet.dart';
import 'feed_post_links.dart';
import 'feed_post_share_sheet.dart';
import 'feed_visitor_profile.dart';
import 'media_viewer.dart';
import 'reaction_participants_sheet.dart';
import 'theme.dart';
import 'widgets.dart';

class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({
    super.key,
    required this.api,
    required this.query,
    this.createRequest = 0,
    this.openPostRequest = 0,
    this.openPostId,
    this.showCommunities = false,
    this.onToggleCommunities,
    this.onOpenConversation,
    this.onOpenOwnProfile,
  });

  final Api api;
  final String query;
  final int createRequest;
  final int openPostRequest;
  final int? openPostId;
  final bool showCommunities;
  final VoidCallback? onToggleCommunities;
  final ValueChanged<Json>? onOpenConversation;
  final VoidCallback? onOpenOwnProfile;

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  final postController = TextEditingController();
  final postFocusNode = FocusNode();
  List<Json> posts = [];
  List<Json> stories = [];
  List<Json> attachments = [];
  List<Json> savedPosts = [];
  bool showingSaved = false;
  bool loadingCommunities = false;
  bool moreCommunities = false;
  List<Json> communities = [];
  String communitySearch = '';
  String communityError = '';
  bool morePosts = false;
  bool moreSaved = false;
  bool loadingMore = false;
  String postVisibility = 'public';
  String postBackground = '';
  String checkInLocation = '';
  String feelingLine = '';
  List<String> taggedUsernames = [];
  bool loading = true;
  bool posting = false;
  bool uploading = false;
  int? busyPost;
  String error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant FeedScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.createRequest != oldWidget.createRequest) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openComposer();
      });
    }
    if (widget.showCommunities && !oldWidget.showCommunities) {
      _loadCommunities();
    }
    if (widget.openPostRequest != oldWidget.openPostRequest &&
        widget.openPostId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openOriginalPost({'id': widget.openPostId});
      });
    }
  }

  Future<void> _load() async {
    try {
      // FeedNotifier isolates optional Story failures from the post list.
      ref.invalidate(feedProvider);
      final snapshot = await ref.read(feedProvider.future);
      if (!mounted) return;
      setState(() {
        posts = snapshot.posts.map((post) => post.toJson()).toList();
        morePosts = posts.length == 15;
        stories = snapshot.stories
            .where(
              (story) =>
                  DateTime.tryParse(story.expiresAt)?.isAfter(DateTime.now()) ??
                  true,
            )
            .map((story) => story.toJson())
            .toList();
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

  Future<void> _loadCommunities({bool append = false}) async {
    if (loadingCommunities) return;
    setState(() {
      loadingCommunities = true;
      communityError = '';
    });
    try {
      final offset = append ? communities.length : 0;
      final result = objects(
        await widget.api.request(
          'GET',
          '/api/conversations?type=group&limit=100&offset=$offset',
        ),
      );
      if (!mounted) return;
      setState(() {
        communities = append
            ? [
                ...communities,
                ...result.where(
                  (room) => !communities.any((old) => old['id'] == room['id']),
                ),
              ]
            : result;
        moreCommunities = result.length == 100;
      });
    } catch (cause) {
      if (mounted) setState(() => communityError = cause.toString());
    } finally {
      if (mounted) setState(() => loadingCommunities = false);
    }
  }

  void _openCommunities() {
    widget.onToggleCommunities?.call();
  }

  Widget _communitiesPanel() {
    final query = communitySearch.trim().toLowerCase();
    final visible =
        communities
            .where(
              (room) => (room['name']?.toString() ?? '').toLowerCase().contains(
                query,
              ),
            )
            .toList()
          ..sort(
            (a, b) => (a['name']?.toString() ?? '').compareTo(
              b['name']?.toString() ?? '',
            ),
          );
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: socoLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              IconButton(
                key: const ValueKey('feed-communities-back'),
                tooltip: 'Quay lại bảng tin',
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: _openCommunities,
              ),
              const Expanded(
                child: Text(
                  'Cộng đồng',
                  style: TextStyle(
                    color: socoNavy,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
              ),
              Text(
                '${visible.length} cộng đồng',
                style: const TextStyle(color: socoMuted),
              ),
            ],
          ),
          const Text(
            'Chọn một cộng đồng để mở cuộc trò chuyện trong Tin nhắn.',
            style: TextStyle(fontSize: 13, color: socoMuted),
          ),
          const SizedBox(height: 10),
          TextField(
            key: const ValueKey('feed-communities-search'),
            onChanged: (text) => setState(() => communitySearch = text),
            decoration: const InputDecoration(
              hintText: 'Tìm cộng đồng...',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
          if (loadingCommunities) const LinearProgressIndicator(),
          if (communityError.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                communityError,
                style: const TextStyle(color: Colors.red),
              ),
            ),
          if (!loadingCommunities && communityError.isEmpty && visible.isEmpty)
            Padding(
              padding: const EdgeInsets.all(14),
              child: Text(
                query.isEmpty
                    ? 'Bạn chưa tham gia cộng đồng nào.'
                    : 'Không tìm thấy cộng đồng phù hợp.',
              ),
            ),
          for (final room in visible)
            Material(
              type: MaterialType.transparency,
              child: ListTile(
                key: ValueKey('feed-community-${room['id']}'),
                leading: UserAvatar(
                  name: room['name']?.toString() ?? 'Cộng đồng',
                  group: true,
                  size: 43,
                  imageUrl: room['avatarUrl']?.toString(),
                  fetchProfileImage: false,
                ),
                title: Text(
                  room['name']?.toString() ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${room['memberCount'] ?? 0} thành viên'
                      '${((room['unreadCount'] as num?)?.toInt() ?? 0) > 0 ? ' · ${room['unreadCount']} tin chưa đọc' : ''}',
                    ),
                    Text(
                      room['lastMessage']?.toString().isNotEmpty == true
                          ? room['lastMessage'].toString()
                          : 'Xem cuộc trò chuyện và các kênh của nhóm',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => widget.onOpenConversation?.call(room),
              ),
            ),
          if (moreCommunities)
            TextButton(
              key: const ValueKey('feed-communities-load-more'),
              onPressed: loadingCommunities
                  ? null
                  : () => _loadCommunities(append: true),
              child: const Text('Tải thêm cộng đồng'),
            ),
          if (communityError.isNotEmpty)
            TextButton(
              onPressed: loadingCommunities ? null : () => _loadCommunities(),
              child: const Text('Thử lại'),
            ),
        ],
      ),
    );
  }

  Future<void> _loadSaved({bool append = false}) async {
    if (loadingMore) return;
    setState(() => loadingMore = true);
    try {
      final before = append && savedPosts.isNotEmpty
          ? '&before=${savedPosts.map((p) => (p['id'] as num).toInt()).reduce((a, b) => a < b ? a : b)}'
          : '';
      final response = await widget.api.request(
        'GET',
        '/api/posts?scope=saved&limit=15$before',
      );
      final result = objects(response);
      if (!mounted) return;
      setState(() {
        savedPosts = append
            ? [
                ...savedPosts,
                ...result.where(
                  (p) => !savedPosts.any((old) => old['id'] == p['id']),
                ),
              ]
            : result;
        moreSaved = result.length == 15;
      });
    } catch (err) {
      _show(err.toString());
    } finally {
      if (mounted) setState(() => loadingMore = false);
    }
  }

  Future<void> _loadMore() async {
    if (loadingMore) return;
    if (showingSaved) {
      await _loadSaved(append: true);
      return;
    }
    if (posts.isEmpty || !morePosts) return;
    setState(() => loadingMore = true);
    try {
      final before = posts
          .map((p) => (p['id'] as num).toInt())
          .reduce((a, b) => a < b ? a : b);
      final items = objects(
        await widget.api.request('GET', '/api/posts?limit=15&before=$before'),
      );
      if (!mounted) return;
      setState(() {
        posts = [
          ...posts,
          ...items.where((p) => !posts.any((old) => old['id'] == p['id'])),
        ];
        morePosts = items.length == 15;
      });
    } catch (err) {
      _show(err.toString());
    } finally {
      if (mounted) setState(() => loadingMore = false);
    }
  }

  void _applyUpdatedPost(Json updated) {
    if (!mounted) return;
    final id = updated['id'];
    setState(() {
      posts = [
        for (final p in posts)
          if (p['id'] == id) updated else p,
      ];
      if (updated['saved'] == true) {
        savedPosts = savedPosts.any((p) => p['id'] == id)
            ? [
                for (final p in savedPosts)
                  if (p['id'] == id) updated else p,
              ]
            : [updated, ...savedPosts];
      } else {
        savedPosts.removeWhere((p) => p['id'] == id);
      }
    });
  }

  Future<Json?> _pickAndUpload(String scope, {bool multiple = false}) async {
    final picked = multiple
        ? await FilePicker.pickFiles(type: FileType.media)
        : <PlatformFile>[];
    if (!multiple) {
      final file = await FilePicker.pickFile(type: FileType.media);
      if (file != null) picked.add(file);
    }
    if (picked.isEmpty) return null;
    setState(() => uploading = true);
    try {
      Json? first;
      for (final file in picked.take(scope == 'feed' ? 12 : 1)) {
        final bytes = await file.readAsBytes();
        final uploaded = await widget.api.upload(
          scope,
          file.name,
          lookupMimeType(file.name, headerBytes: bytes) ??
              'application/octet-stream',
          bytes,
        );
        first ??= uploaded;
        if (scope == 'feed') attachments.add(uploaded);
      }
      if (mounted) setState(() {});
      return first;
    } catch (value) {
      _show(value.toString());
      return null;
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<bool> _createPost() async {
    final text = postController.text.trim();
    final content = [
      if (checkInLocation.trim().isNotEmpty) '📍 ${checkInLocation.trim()}',
      if (taggedUsernames.isNotEmpty)
        '👥 Cùng với ${taggedUsernames.map((name) => '@$name').join(', ')}',
      if (feelingLine.isNotEmpty) feelingLine,
      if (text.isNotEmpty) text,
    ].join('\n');
    if (posting || (content.isEmpty && attachments.isEmpty)) return false;
    if (content.runes.length > 5000) {
      _show('Nội dung bài viết vượt quá 5.000 ký tự.');
      return false;
    }
    setState(() => posting = true);
    try {
      final post = object(
        await widget.api.request('POST', '/api/posts', {
          'content': content,
          'attachments': attachments,
          'visibility': postVisibility,
          'background': postBackground,
        }),
      );
      if (!mounted) return false;
      setState(() {
        posts = [post, ...posts];
        postController.clear();
        attachments = [];
        postBackground = '';
        checkInLocation = '';
        feelingLine = '';
        taggedUsernames = [];
      });
      return true;
    } catch (value) {
      _show(value.toString());
      return false;
    } finally {
      if (mounted) setState(() => posting = false);
    }
  }

  Future<bool> _publishMediaStory() async {
    final media = await _pickAndUpload('story');
    if (media == null) return false;
    try {
      final story = object(
        await widget.api.request('POST', '/api/stories', {'attachment': media}),
      );
      if (mounted) setState(() => stories = [story, ...stories]);
      return true;
    } catch (error) {
      _show('Không đăng được Story: $error');
      return false;
    }
  }

  Future<bool> _publishTextStory(String text, String background) async {
    try {
      final story = object(
        await widget.api.request('POST', '/api/stories', {
          'text': text.trim(),
          'background': background,
        }),
      );
      if (mounted) setState(() => stories = [story, ...stories]);
      return true;
    } catch (error) {
      _show('Không đăng được Story dạng văn bản: $error');
      return false;
    }
  }

  Future<void> _createStory() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => FeedStoryCreateSheet(
        onCreateMedia: _publishMediaStory,
        onCreateText: _publishTextStory,
      ),
    );
  }

  Future<void> _like(Json post) async {
    final id = (post['id'] as num).toInt();
    setState(() => busyPost = id);
    try {
      final updated = object(
        await widget.api.request('POST', '/api/posts/$id/like'),
      );
      if (!mounted) return;
      _applyUpdatedPost(updated);
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => busyPost = null);
    }
  }

  Future<void> _openVisitor(String username) async {
    final safe = username.trim();
    if (safe.isEmpty || !mounted) return;
    if (safe == widget.api.user['username']) {
      widget.onOpenOwnProfile?.call();
      return;
    }
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => FeedVisitorProfile(
          api: widget.api,
          username: safe,
          onOpenConversation: (room) => widget.onOpenConversation?.call(room),
          onOpenPost: _openPostDetail,
        ),
      ),
    );
  }

  Future<void> _sharePost(Json post) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => FeedPostShareSheet(
        api: widget.api,
        post: post,
        onRepostChanged: (updated) async {
          _applyUpdatedPost(updated);
          await _load();
        },
      ),
    );
  }

  Future<void> _openOriginalPost(Json original) async {
    final id = (original['id'] as num?)?.toInt();
    if (id == null) return;
    try {
      final post = object(await widget.api.request('GET', '/api/posts/$id'));
      if (mounted) await _openPostDetail(post);
    } catch (error) {
      _show('Bài viết gốc không còn khả dụng: $error');
    }
  }

  Future<void> _openPostDetail(Json post) async {
    if (!mounted) return;
    final profileName = await showDialog<String>(
      context: context,
      barrierDismissible: true,
      builder: (_) => FeedPostDetail(
        key: ValueKey('post-detail-${post['id']}'),
        api: widget.api,
        initialPost: post,
        onUpdate: _applyUpdatedPost,
        onShare: _sharePost,
        onPostAction: (detail, action) => action == 'options'
            ? _showPostOptions(detail)
            : _postAction(detail, action),
        onCommentAction: _manageComment,
      ),
    );
    if (!mounted || profileName == null || profileName.isEmpty) return;
    // The PWA fixes #192 close details before opening visitor profiles.
    // Awaiting showDialog guarantees the post dialog is gone first.
    await _openVisitor(profileName);
  }

  void _showStory(Json story) {
    var index = stories.indexWhere((item) => item['id'] == story['id']);
    if (index < 0) return;
    showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: .88),
      builder: (context) => StatefulBuilder(
        builder: (context, setViewerState) {
          final current = stories[index];
          final own =
              current['author']?.toString() ==
              widget.api.user['username']?.toString();
          return Dialog.fullscreen(
            backgroundColor: Colors.black,
            child: SafeArea(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: current['attachment'] is Map
                        ? AttachmentView(
                            key: ValueKey(current['id']),
                            attachment: object(current['attachment']),
                          )
                        : Container(
                            key: const ValueKey('feed-text-story-viewer'),
                            alignment: Alignment.center,
                            padding: const EdgeInsets.all(30),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors:
                                    storyBackgrounds[current['background']
                                            ?.toString() ??
                                        'berry'] ??
                                    storyBackgrounds['berry']!,
                              ),
                            ),
                            child: Text(
                              current['text']?.toString() ?? '',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                  ),
                  Positioned(
                    top: 10,
                    left: 16,
                    right: 16,
                    child: Row(
                      children: [
                        UserAvatar(
                          name: current['author']?.toString() ?? '',
                          username: current['author']?.toString(),
                          size: 42,
                          fetchProfileImage: !widget.api.isDemo,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: InkWell(
                            key: const ValueKey('story-author-profile'),
                            onTap: () {
                              final author =
                                  current['author']?.toString() ?? '';
                              Navigator.pop(context);
                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                if (mounted) _openVisitor(author);
                              });
                            },
                            child: Text(
                              '@${current['author']}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        if (own)
                          IconButton(
                            tooltip: 'Xóa story',
                            onPressed: () async {
                              Navigator.pop(context);
                              await _deleteStory(current);
                            },
                            icon: const Icon(Icons.delete_outline_rounded),
                            color: Colors.white,
                          ),
                        IconButton(
                          key: const ValueKey('feed-story-viewer-close'),
                          tooltip: 'Đóng',
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close_rounded),
                          style: IconButton.styleFrom(
                            foregroundColor: Colors.white,
                            backgroundColor: Colors.black38,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (index > 0)
                    Positioned(
                      left: 8,
                      top: 0,
                      bottom: 0,
                      child: IconButton(
                        tooltip: 'Story trước',
                        onPressed: () => setViewerState(() => index--),
                        icon: const Icon(Icons.chevron_left_rounded, size: 36),
                        color: Colors.white,
                      ),
                    ),
                  if (index < stories.length - 1)
                    Positioned(
                      right: 8,
                      top: 0,
                      bottom: 0,
                      child: IconButton(
                        tooltip: 'Story tiếp theo',
                        onPressed: () => setViewerState(() => index++),
                        icon: const Icon(Icons.chevron_right_rounded, size: 36),
                        color: Colors.white,
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _deleteStory(Json story) async {
    final confirmed =
        await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Xóa story?'),
            content: const Text('Story sẽ bị xóa ngay khỏi bảng tin.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Hủy'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Xóa'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed) return;
    try {
      await widget.api.request('DELETE', '/api/stories/${story['id']}');
      if (mounted) {
        setState(
          () => stories.removeWhere((item) => item['id'] == story['id']),
        );
      }
    } catch (value) {
      _show(value.toString());
    }
  }

  Future<Json?> _manageComment(Json post, Json comment, String action) async {
    final postId = (post['id'] as num).toInt();
    final commentId = (comment['id'] as num).toInt();
    if (action == 'report') {
      final reason = await showDialog<String>(
        context: context,
        builder: (ctx) => SimpleDialog(
          title: const Text('Báo cáo bình luận'),
          children: [
            for (final reason in [
              'Nội dung spam',
              'Quấy rối hoặc xúc phạm',
              'Lừa đảo hoặc giả mạo',
              'Nội dung không phù hợp',
            ])
              SimpleDialogOption(
                onPressed: () => Navigator.pop(ctx, reason),
                child: Text(reason),
              ),
          ],
        ),
      );
      if (reason == null) return null;
      try {
        await widget.api.request('POST', '/api/feed/reports', {
          'targetType': 'comment',
          'targetId': commentId,
          'reason': reason,
        });
        _show('Đã gửi báo cáo.');
      } catch (err) {
        _show(err.toString());
      }
      return null;
    }
    if (action == 'delete') {
      final confirmed =
          await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Xóa bình luận?'),
              content: const Text(
                'Các phản hồi bên dưới bình luận cũng sẽ bị xóa.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Hủy'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Xóa'),
                ),
              ],
            ),
          ) ??
          false;
      if (!confirmed) return null;
      try {
        return object(
          await widget.api.request(
            'DELETE',
            '/api/posts/$postId/comments/$commentId',
          ),
        );
      } catch (err) {
        _show(err.toString());
        return null;
      }
    }
    if (action == 'edit') {
      final editor = TextEditingController(
        text: comment['content']?.toString() ?? '',
      );
      final content = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Chỉnh sửa bình luận'),
          content: TextField(
            controller: editor,
            minLines: 2,
            maxLines: 5,
            maxLength: 1000,
            decoration: const InputDecoration(hintText: 'Nội dung bình luận'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, editor.text.trim()),
              child: const Text('Lưu'),
            ),
          ],
        ),
      );
      editor.dispose();
      if (content == null || content.isEmpty) return null;
      try {
        return object(
          await widget.api.request(
            'PATCH',
            '/api/posts/$postId/comments/$commentId',
            {'content': content},
          ),
        );
      } catch (err) {
        _show(err.toString());
        return null;
      }
    }
    return null;
  }

  Future<void> _showPostOptions(Json post) async {
    final mine = post['author'] == widget.api.user['username'];
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
      ),
      builder: (sheetContext) {
        Widget option(
          String key,
          IconData icon,
          String label, {
          bool danger = false,
        }) {
          return ListTile(
            leading: Icon(
              icon,
              size: 22,
              color: danger ? const Color(0xFFD23D55) : socoNavy,
            ),
            title: Text(
              label,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: danger ? const Color(0xFFD23D55) : socoNavy,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 20),
            minTileHeight: 52,
            onTap: () {
              Navigator.pop(sheetContext);
              _postAction(post, key);
            },
          );
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 15),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 2, 20, 13),
                child: Text(
                  'Tùy chọn bài viết',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: socoNavy,
                  ),
                ),
              ),
              option(
                'save',
                Icons.bookmark_border_rounded,
                post['saved'] == true ? 'Bỏ lưu bài viết' : 'Lưu bài viết',
              ),
              option('share', Icons.ios_share_rounded, 'Chia sẻ bài viết'),
              option('copy', Icons.link_rounded, 'Sao chép liên kết'),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 18, vertical: 7),
                child: Divider(height: 1),
              ),
              if (mine) ...[
                if (post['repostKind'] != 'quick')
                  option('edit', Icons.edit_outlined, 'Chỉnh sửa bài viết'),
                option(
                  'delete',
                  Icons.delete_outline_rounded,
                  post['repostKind'] == 'quick'
                      ? 'Bỏ đăng lại'
                      : 'Xóa bài viết',
                  danger: true,
                ),
              ] else
                option('report', Icons.flag_outlined, 'Báo cáo bài viết'),
            ],
          ),
        );
      },
    );
  }

  Future<void> _postAction(Json post, String action) async {
    final id = (post['id'] as num).toInt();
    switch (action) {
      case 'share':
        try {
          final box = context.findRenderObject() as RenderBox?;
          await SharePlus.instance.share(
            ShareParams(
              text: postShareUri(id).toString(),
              sharePositionOrigin: box == null
                  ? const Rect.fromLTWH(0, 0, 1, 1)
                  : box.localToGlobal(Offset.zero) & box.size,
            ),
          );
        } catch (err) {
          _show('Không thể chia sẻ bài viết: $err');
        }
        return;
      case 'copy':
        final link = postShareUri(id).toString();
        await Clipboard.setData(ClipboardData(text: link));
        _show('Đã sao chép liên kết bài viết.');
        return;
      case 'save':
        try {
          final updated = object(
            await widget.api.request('POST', '/api/posts/$id/save'),
          );
          _applyUpdatedPost(updated);
          _show(updated['saved'] == true ? 'Đã lưu bài viết.' : 'Đã bỏ lưu.');
        } catch (err) {
          _show(err.toString());
        }
        return;
      case 'delete':
        final yes =
            await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: Text(
                  post['repostKind'] == 'quick'
                      ? 'Bỏ đăng lại bài viết?'
                      : 'Xóa bài viết?',
                ),
                content: Text(
                  post['repostKind'] == 'quick'
                      ? 'Bài viết gốc sẽ không bị xóa.'
                      : 'Bài viết cùng các bình luận sẽ bị xóa.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Hủy'),
                  ),
                  FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: Text(
                      post['repostKind'] == 'quick' ? 'Bỏ đăng lại' : 'Xóa',
                    ),
                  ),
                ],
              ),
            ) ??
            false;
        if (!yes) return;
        try {
          await widget.api.request('DELETE', '/api/posts/$id');
          if (mounted) {
            setState(() {
              posts.removeWhere((item) => item['id'] == id);
              savedPosts.removeWhere((item) => item['id'] == id);
            });
          }
          _show(
            post['repostKind'] == 'quick'
                ? 'Đã bỏ đăng lại.'
                : 'Đã xóa bài viết.',
          );
          if (post['repostKind'] == 'quick') await _load();
        } catch (err) {
          _show(err.toString());
        }
        return;
      case 'report':
        final reason = await showDialog<String>(
          context: context,
          builder: (ctx) => SimpleDialog(
            title: const Text('Báo cáo bài viết'),
            children: [
              for (final reason in [
                'Nội dung spam',
                'Quấy rối hoặc xúc phạm',
                'Lừa đảo hoặc giả mạo',
                'Nội dung không phù hợp',
              ])
                SimpleDialogOption(
                  onPressed: () => Navigator.pop(ctx, reason),
                  child: Text(reason),
                ),
            ],
          ),
        );
        if (reason == null) return;
        try {
          await widget.api.request('POST', '/api/feed/reports', {
            'targetType': 'post',
            'targetId': id,
            'reason': reason,
          });
          _show('Đã gửi báo cáo.');
        } catch (err) {
          _show(err.toString());
        }
        return;
      case 'edit':
        final editor = TextEditingController(
          text: post['content']?.toString() ?? '',
        );
        var visibility = post['visibility']?.toString() ?? 'public';
        var background = post['background']?.toString() ?? '';
        var busy = false;
        await showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          builder: (ctx) => StatefulBuilder(
            builder: (ctx, setSheetState) => Padding(
              padding: EdgeInsets.fromLTRB(
                18,
                18,
                18,
                MediaQuery.viewInsetsOf(ctx).bottom + 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Chỉnh sửa bài viết',
                      style: Theme.of(ctx).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: editor,
                      maxLines: 5,
                      minLines: 2,
                      maxLength: 5000,
                      decoration: const InputDecoration(
                        labelText: 'Nội dung bài viết',
                      ),
                    ),
                    const SizedBox(height: 10),
                    DropdownButton<String>(
                      value: visibility,
                      isExpanded: true,
                      items: const [
                        DropdownMenuItem(
                          value: 'public',
                          child: Text('🌐 Công khai'),
                        ),
                        DropdownMenuItem(
                          value: 'friends',
                          child: Text('👥 Bạn bè'),
                        ),
                        DropdownMenuItem(
                          value: 'private',
                          child: Text('🔒 Chỉ mình tôi'),
                        ),
                      ],
                      onChanged: busy
                          ? null
                          : (value) {
                              if (value != null) {
                                setSheetState(() => visibility = value);
                              }
                            },
                    ),
                    Wrap(
                      spacing: 7,
                      children: [
                        for (final item in [
                          '',
                          'violet',
                          'blue',
                          'sunset',
                          'mint',
                          'night',
                        ])
                          ChoiceChip(
                            label: Text(item.isEmpty ? 'Không nền' : item),
                            selected: background == item,
                            onSelected: busy
                                ? null
                                : (_) => setSheetState(() => background = item),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: busy
                          ? null
                          : () async {
                              setSheetState(() => busy = true);
                              try {
                                final updated = object(
                                  await widget.api
                                      .request('PATCH', '/api/posts/$id', {
                                        'content': editor.text.trim(),
                                        'visibility': visibility,
                                        'background': background,
                                      }),
                                );
                                _applyUpdatedPost(updated);
                                if (ctx.mounted) Navigator.pop(ctx);
                                _show('Đã cập nhật bài viết.');
                              } catch (err) {
                                _show(err.toString());
                                if (ctx.mounted) {
                                  setSheetState(() => busy = false);
                                }
                              }
                            },
                      child: Text(busy ? 'Đang lưu...' : 'Lưu thay đổi'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
        editor.dispose();
        return;
    }
  }

  void _show(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _chooseTags(StateSetter refreshSheet) async {
    try {
      final friends = objects(await widget.api.request('GET', '/api/friends'));
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (ctx) => StatefulBuilder(
          builder: (ctx, refreshTags) => SafeArea(
            child: SizedBox(
              height: MediaQuery.sizeOf(ctx).height * .58,
              child: Column(
                children: [
                  const Padding(
                    padding: EdgeInsets.all(14),
                    child: Text(
                      'Gắn thẻ bạn bè',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Expanded(
                    child: ListView.builder(
                      itemCount: friends.length,
                      itemBuilder: (context, index) {
                        final person = friends[index];
                        final username = person['username']?.toString() ?? '';
                        return CheckboxListTile(
                          title: Text(
                            person['displayName']?.toString() ?? username,
                          ),
                          subtitle: Text('@$username'),
                          value: taggedUsernames.contains(username),
                          onChanged: username.isEmpty
                              ? null
                              : (checked) {
                                  setState(() {
                                    if (checked == true) {
                                      if (!taggedUsernames.contains(username)) {
                                        taggedUsernames.add(username);
                                      }
                                    } else {
                                      taggedUsernames.remove(username);
                                    }
                                  });
                                  refreshTags(() {});
                                  refreshSheet(() {});
                                },
                        );
                      },
                    ),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Xong'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    } catch (error) {
      _show('Không tải được danh sách bạn bè: $error');
    }
  }

  Future<void> _chooseFeeling(StateSetter refreshSheet) async {
    const feelings = [
      ('😊', 'vui vẻ'),
      ('🥰', 'hạnh phúc'),
      ('🤩', 'hào hứng'),
      ('😌', 'bình yên'),
      ('🙏', 'biết ơn'),
      ('😍', 'yêu đời'),
      ('😔', 'buồn'),
      ('😟', 'lo lắng'),
      ('😴', 'mệt mỏi'),
    ];
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            for (final item in feelings)
              ListTile(
                leading: Text(item.$1, style: const TextStyle(fontSize: 24)),
                title: Text(item.$2),
                onTap: () =>
                    Navigator.pop(ctx, '${item.$1} Đang cảm thấy ${item.$2}'),
              ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, ''),
              child: const Text('Bỏ cảm xúc'),
            ),
          ],
        ),
      ),
    );
    if (choice != null && mounted) {
      setState(() => feelingLine = choice);
      refreshSheet(() {});
    }
  }

  Future<void> _chooseCheckIn(StateSetter refreshSheet) async {
    final controller = TextEditingController(text: checkInLocation);
    final location = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Check-in địa điểm'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Nhập địa điểm'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, ''),
            child: const Text('Xóa'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (location != null && mounted) {
      setState(() => checkInLocation = location);
      refreshSheet(() {});
    }
  }

  Future<void> _openComposer() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, refreshSheet) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
          ),
          child: SizedBox(
            height: MediaQuery.sizeOf(sheetContext).height * .79,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 10, 8),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Tạo bài viết',
                          style: TextStyle(
                            color: socoNavy,
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Đóng',
                        onPressed: () => Navigator.pop(sheetContext),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            UserAvatar(
                              name:
                                  widget.api.user['displayName']?.toString() ??
                                  widget.api.user['username']?.toString() ??
                                  '',
                              username: widget.api.user['username']?.toString(),
                              size: 44,
                              fetchProfileImage: !widget.api.isDemo,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                widget.api.user['displayName']?.toString() ??
                                    widget.api.user['username']?.toString() ??
                                    '',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            DropdownButton<String>(
                              value: postVisibility,
                              underline: const SizedBox.shrink(),
                              items: const [
                                DropdownMenuItem(
                                  value: 'public',
                                  child: Text('Công khai'),
                                ),
                                DropdownMenuItem(
                                  value: 'friends',
                                  child: Text('Bạn bè'),
                                ),
                                DropdownMenuItem(
                                  value: 'private',
                                  child: Text('Riêng tư'),
                                ),
                              ],
                              onChanged: (value) {
                                if (value == null) return;
                                setState(() => postVisibility = value);
                                refreshSheet(() {});
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: postController,
                          focusNode: postFocusNode,
                          autofocus: true,
                          maxLines: null,
                          minLines: 5,
                          maxLength: 5000,
                          onChanged: (_) => refreshSheet(() {}),
                          decoration: const InputDecoration(
                            hintText: 'Hôm nay bạn thế nào?',
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            fillColor: Colors.white,
                          ),
                        ),
                        if (attachments.isNotEmpty)
                          Wrap(
                            spacing: 5,
                            runSpacing: 5,
                            children: [
                              for (var i = 0; i < attachments.length; i++)
                                InputChip(
                                  label: Text(
                                    attachments[i]['name']?.toString() ??
                                        'Media',
                                  ),
                                  avatar: const Icon(
                                    Icons.image_outlined,
                                    size: 17,
                                  ),
                                  onDeleted: () {
                                    setState(() => attachments.removeAt(i));
                                    refreshSheet(() {});
                                  },
                                ),
                            ],
                          ),
                        if (checkInLocation.isNotEmpty)
                          Chip(
                            avatar: const Icon(Icons.place_outlined, size: 17),
                            label: Text(checkInLocation),
                            onDeleted: () {
                              setState(() => checkInLocation = '');
                              refreshSheet(() {});
                            },
                          ),
                        if (taggedUsernames.isNotEmpty)
                          Text(
                            'Cùng với ${taggedUsernames.map((name) => '@$name').join(', ')}',
                            style: const TextStyle(color: socoMuted),
                          ),
                        if (feelingLine.isNotEmpty)
                          Text(
                            feelingLine,
                            style: const TextStyle(color: socoMuted),
                          ),
                        const SizedBox(height: 10),
                        const Divider(),
                        Wrap(
                          spacing: 4,
                          runSpacing: 2,
                          children: [
                            ActionChip(
                              avatar: const Icon(
                                Icons.image_outlined,
                                color: Color(0xFF3CAD70),
                              ),
                              label: const Text('Ảnh/Video'),
                              onPressed: uploading
                                  ? null
                                  : () async {
                                      await _pickAndUpload(
                                        'feed',
                                        multiple: true,
                                      );
                                      refreshSheet(() {});
                                    },
                            ),
                            ActionChip(
                              avatar: const Icon(
                                Icons.person_add_alt_rounded,
                                color: socoBlue,
                              ),
                              label: const Text('Gắn thẻ'),
                              onPressed: () => _chooseTags(refreshSheet),
                            ),
                            ActionChip(
                              avatar: const Icon(
                                Icons.place_outlined,
                                color: Color(0xFFDB7436),
                              ),
                              label: const Text('Check-in'),
                              onPressed: () => _chooseCheckIn(refreshSheet),
                            ),
                            ActionChip(
                              avatar: const Icon(
                                Icons.emoji_emotions_outlined,
                                color: Color(0xFFF5AE2A),
                              ),
                              label: const Text('Cảm xúc'),
                              onPressed: () => _chooseFeeling(refreshSheet),
                            ),
                            ActionChip(
                              avatar: const Icon(
                                Icons.palette_outlined,
                                color: socoViolet,
                              ),
                              label: const Text('Nền chữ'),
                              onPressed: () {
                                setState(
                                  () => postBackground = postBackground.isEmpty
                                      ? 'violet'
                                      : '',
                                );
                                refreshSheet(() {});
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: posting
                          ? null
                          : () async {
                              final published = await _createPost();
                              if (!sheetContext.mounted) return;
                              if (published) {
                                Navigator.pop(sheetContext);
                              } else {
                                refreshSheet(() {});
                              }
                            },
                      child: Text(posting ? 'Đang đăng...' : 'Đăng bài viết'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _compactComposer() {
    Widget action(
      IconData icon,
      Color color,
      Color background,
      String tooltip,
      VoidCallback onTap,
    ) {
      return Padding(
        padding: const EdgeInsets.only(left: 5),
        child: IconButton(
          tooltip: tooltip,
          onPressed: onTap,
          style: IconButton.styleFrom(
            backgroundColor: background,
            foregroundColor: color,
            minimumSize: const Size.square(37),
            maximumSize: const Size.square(37),
            padding: EdgeInsets.zero,
            side: BorderSide(color: color.withValues(alpha: .12)),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(11),
            ),
          ),
          icon: Icon(icon, size: 20),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(9, 0, 9, 19),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: socoLine),
        borderRadius: BorderRadius.circular(17),
      ),
      child: Row(
        children: [
          UserAvatar(
            name: widget.api.user['displayName']?.toString() ?? '',
            username: widget.api.user['username']?.toString(),
            size: 37,
            fetchProfileImage: !widget.api.isDemo,
          ),
          const SizedBox(width: 7),
          Expanded(
            child: Material(
              color: const Color(0xFFF4F5F8),
              borderRadius: BorderRadius.circular(30),
              child: InkWell(
                key: const ValueKey('feed-composer-open'),
                onTap: _openComposer,
                borderRadius: BorderRadius.circular(30),
                child: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12, horizontal: 10),
                  child: Text(
                    'Bạn đang nghĩ gì?',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: socoMuted, fontSize: 12),
                  ),
                ),
              ),
            ),
          ),
          action(
            Icons.collections_outlined,
            const Color(0xFF189960),
            const Color(0xFFEAF7EE),
            'Ảnh/Video',
            _openComposer,
          ),
          action(
            Icons.auto_stories_outlined,
            const Color(0xFF8852CC),
            const Color(0xFFF4EFFE),
            'Story',
            _createStory,
          ),
          action(
            Icons.location_on_outlined,
            const Color(0xFFDC7918),
            const Color(0xFFFFF3E7),
            'Check-in',
            _openComposer,
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    postController.dispose();
    postFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error.isNotEmpty && posts.isEmpty) {
      return EmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Chưa tải được bảng tin',
        description: error,
        action: FilledButton(onPressed: _load, child: const Text('Thử lại')),
      );
    }
    final visible = collapseQuickReposts(
      filterFeedPosts(showingSaved ? savedPosts : posts, query: widget.query),
    );
    return ColoredBox(
      color: socoCanvas,
      child: RefreshIndicator(
        onRefresh: () => showingSaved ? _loadSaved() : _load(),
        child: ListView(
          padding: const EdgeInsets.only(bottom: 30),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (widget.showCommunities)
                      _communitiesPanel()
                    else ...[
                      const Padding(
                        padding: EdgeInsets.fromLTRB(15, 4, 15, 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Khoảnh khắc',
                                style: TextStyle(
                                  color: Color(0xFF1B2944),
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            Text(
                              'Story trong 24 giờ',
                              style: TextStyle(
                                color: Color(0xFF8590AA),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(
                        height: 126,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                          children: [
                            _StoryCard(
                              label: 'Tạo mới',
                              onTap: _createStory,
                              child: uploading
                                  ? const CircularProgressIndicator(
                                      strokeWidth: 2,
                                    )
                                  : Container(
                                      width: 38,
                                      height: 38,
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(
                                          alpha: .14,
                                        ),
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: Colors.white,
                                          width: 2,
                                        ),
                                      ),
                                      child: const Icon(
                                        Icons.add_rounded,
                                        color: Colors.white,
                                        size: 27,
                                      ),
                                    ),
                            ),
                            for (final story in stories)
                              _StoryCard(
                                label: story['author']?.toString() ?? '',
                                onTap: () => _showStory(story),
                                attachment: story['attachment'] is Map
                                    ? object(story['attachment'])
                                    : null,
                                text: story['text']?.toString(),
                                background: story['background']?.toString(),
                              ),
                          ],
                        ),
                      ),
                      if (MediaQuery.sizeOf(context).width < 760)
                        _compactComposer()
                      else
                        Container(
                          margin: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                          padding: const EdgeInsets.all(11),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            border: Border.all(color: socoLine),
                            borderRadius: BorderRadius.circular(21),
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
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  UserAvatar(
                                    name:
                                        widget.api.user['displayName']
                                            ?.toString() ??
                                        '',
                                    username: widget.api.user['username']
                                        ?.toString(),
                                    size: 44,
                                    fetchProfileImage: !widget.api.isDemo,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: TextField(
                                      controller: postController,
                                      focusNode: postFocusNode,
                                      minLines: 1,
                                      maxLines: 5,
                                      maxLength: 5000,
                                      onChanged: (_) => setState(() {}),
                                      decoration: const InputDecoration(
                                        hintText: 'Hôm nay bạn thế nào?',
                                        counterText: '',
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (attachments.isNotEmpty)
                                SizedBox(
                                  height: 72,
                                  child: ListView(
                                    scrollDirection: Axis.horizontal,
                                    children: [
                                      for (
                                        var index = 0;
                                        index < attachments.length;
                                        index++
                                      )
                                        InputChip(
                                          avatar: const Icon(
                                            Icons.image_outlined,
                                            size: 18,
                                          ),
                                          label: Text(
                                            attachments[index]['name']
                                                    ?.toString() ??
                                                'Media',
                                          ),
                                          onDeleted: () => setState(
                                            () => attachments.removeAt(index),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              const SizedBox(height: 9),
                              Align(
                                alignment: Alignment.centerLeft,
                                child: DropdownButton<String>(
                                  value: postVisibility,
                                  underline: const SizedBox.shrink(),
                                  items: const [
                                    DropdownMenuItem(
                                      value: 'public',
                                      child: Text('🌐 Công khai'),
                                    ),
                                    DropdownMenuItem(
                                      value: 'friends',
                                      child: Text('👥 Bạn bè'),
                                    ),
                                    DropdownMenuItem(
                                      value: 'private',
                                      child: Text('🔒 Chỉ mình tôi'),
                                    ),
                                  ],
                                  onChanged: (value) {
                                    if (value != null) {
                                      setState(() => postVisibility = value);
                                    }
                                  },
                                ),
                              ),
                              GridView.count(
                                crossAxisCount: 2,
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                childAspectRatio: 3.8,
                                crossAxisSpacing: 7,
                                mainAxisSpacing: 7,
                                children: [
                                  _ComposerAction(
                                    icon: SocoIconType.photo,
                                    color: const Color(0xFF3CAD70),
                                    label: 'Ảnh',
                                    onTap: uploading
                                        ? null
                                        : () => _pickAndUpload(
                                            'feed',
                                            multiple: true,
                                          ),
                                  ),
                                  _ComposerAction(
                                    icon: SocoIconType.video,
                                    color: const Color(0xFFDC34BD),
                                    label: 'Video',
                                    onTap: uploading
                                        ? null
                                        : () => _pickAndUpload(
                                            'feed',
                                            multiple: true,
                                          ),
                                  ),
                                  _ComposerAction(
                                    icon: SocoIconType.album,
                                    color: socoBlue,
                                    label: 'Album',
                                    onTap: uploading
                                        ? null
                                        : () => _pickAndUpload(
                                            'feed',
                                            multiple: true,
                                          ),
                                  ),
                                  _ComposerAction(
                                    icon: SocoIconType.text,
                                    color: socoBlue,
                                    label: 'Nền chữ',
                                    onTap: () => setState(() {
                                      postBackground = postBackground.isEmpty
                                          ? 'violet'
                                          : '';
                                      postFocusNode.requestFocus();
                                    }),
                                  ),
                                ],
                              ),
                              if (postBackground.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Wrap(
                                    spacing: 5,
                                    runSpacing: 4,
                                    children: [
                                      for (final color in [
                                        'violet',
                                        'blue',
                                        'sunset',
                                        'mint',
                                        'night',
                                      ])
                                        ChoiceChip(
                                          label: Text(color),
                                          selected: postBackground == color,
                                          onSelected: (_) => setState(
                                            () => postBackground = color,
                                          ),
                                        ),
                                      ActionChip(
                                        label: const Text('Bỏ nền'),
                                        onPressed: () =>
                                            setState(() => postBackground = ''),
                                      ),
                                    ],
                                  ),
                                ),
                              if (postController.text.trim().isNotEmpty ||
                                  attachments.isNotEmpty) ...[
                                const SizedBox(height: 9),
                                SizedBox(
                                  width: double.infinity,
                                  child: FilledButton(
                                    onPressed: posting ? null : _createPost,
                                    child: Text(
                                      posting ? 'Đang đăng...' : 'Đăng',
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(14, 0, 14, 4),
                        child: Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            key: const ValueKey('feed-open-communities'),
                            onPressed: _openCommunities,
                            icon: const Icon(Icons.groups_outlined),
                            label: const Text('Cộng đồng'),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(13, 12, 10, 13),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                showingSaved ? 'Bài đã lưu' : 'Bài viết mới',
                                style: const TextStyle(
                                  color: socoText,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.all(3),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: const Color(0xFFDCE4F6),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  for (final choice in [
                                    (false, 'Mới nhất'),
                                    (true, 'Đã lưu'),
                                  ])
                                    TextButton(
                                      onPressed: () {
                                        setState(
                                          () => showingSaved = choice.$1,
                                        );
                                        if (choice.$1) _loadSaved();
                                      },
                                      style: TextButton.styleFrom(
                                        foregroundColor:
                                            showingSaved == choice.$1
                                            ? socoBlue
                                            : socoMuted,
                                        backgroundColor:
                                            showingSaved == choice.$1
                                            ? Colors.white
                                            : Colors.transparent,
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 9,
                                          vertical: 6,
                                        ),
                                        minimumSize: const Size(0, 29),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            9,
                                          ),
                                        ),
                                      ),
                                      child: Text(
                                        choice.$2,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (visible.isEmpty)
                        const EmptyState(
                          icon: Icons.dynamic_feed_outlined,
                          title: 'Chưa có bài viết',
                          description:
                              'Hãy chia sẻ khoảnh khắc đầu tiên của bạn.',
                        )
                      else
                        for (final post in visible) _post(post),
                      if (showingSaved ? moreSaved : morePosts)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(24, 6, 24, 18),
                          child: OutlinedButton(
                            onPressed: loadingMore ? null : _loadMore,
                            child: Text(
                              loadingMore ? 'Đang tải...' : 'Tải thêm bài viết',
                            ),
                          ),
                        ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _post(Json post) {
    final media = objects(post['attachments']);
    final original = post['originalPost'] is Map
        ? object(post['originalPost'])
        : null;
    final comments = objects(post['comments']);
    final liked = post['liked'] == true;
    final likes = (post['likes'] as num?)?.toInt() ?? 0;
    final engagementStyle = TextButton.styleFrom(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      minimumSize: const Size(0, 42),
      textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
    );
    return Container(
      key: ValueKey('feed-post-${post['id']}'),
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: socoLine),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (post['repostKind'] == 'quick')
            const Padding(
              padding: EdgeInsets.only(bottom: 9),
              child: Row(
                children: [
                  Icon(Icons.repeat_rounded, size: 16, color: socoMuted),
                  SizedBox(width: 6),
                  Text(
                    'Đã đăng lại',
                    style: TextStyle(
                      fontSize: 12,
                      color: socoMuted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          Row(
            children: [
              InkWell(
                key: ValueKey('feed-post-author-${post['id']}'),
                onTap: () => _openVisitor(post['author']?.toString() ?? ''),
                borderRadius: BorderRadius.circular(50),
                child: UserAvatar(
                  name: post['authorDisplayName']?.toString().isNotEmpty == true
                      ? post['authorDisplayName'].toString()
                      : post['author']?.toString() ?? '',
                  username: post['author']?.toString(),
                  size: 46,
                  fetchProfileImage: !widget.api.isDemo,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InkWell(
                      onTap: () =>
                          _openVisitor(post['author']?.toString() ?? ''),
                      child: Text(
                        post['authorDisplayName']?.toString().isNotEmpty == true
                            ? post['authorDisplayName'].toString()
                            : post['author']?.toString() ?? '',
                        style: const TextStyle(
                          color: socoNavy,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      '${displayDateTime(post['createdAt'])} · ${switch (post['visibility']?.toString()) {
                        'private' => 'Chỉ mình tôi',
                        'friends' => 'Bạn bè',
                        _ => 'Công khai',
                      }}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              IconButton(
                key: ValueKey('feed-post-options-${post['id']}'),
                tooltip: 'Tùy chọn bài viết',
                icon: const Icon(Icons.more_horiz_rounded, color: socoMuted),
                onPressed: () => _showPostOptions(post),
              ),
            ],
          ),
          if (post['content']?.toString().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(
                (post['background']?.toString().isNotEmpty ?? false) ? 20 : 0,
              ),
              decoration: _backgroundDecoration(
                post['background']?.toString() ?? '',
              ),
              child: Text(
                post['content'].toString(),
                textAlign: (post['background']?.toString().isNotEmpty ?? false)
                    ? TextAlign.center
                    : TextAlign.start,
                style: TextStyle(
                  color: (post['background']?.toString().isNotEmpty ?? false)
                      ? Colors.white
                      : null,
                  fontWeight:
                      (post['background']?.toString().isNotEmpty ?? false)
                      ? FontWeight.w700
                      : FontWeight.normal,
                ),
              ),
            ),
          ],
          if (media.isNotEmpty) ...[
            const SizedBox(height: 12),
            _mediaGrid(media),
          ],
          if (original != null) ...[
            const SizedBox(height: 10),
            InkWell(
              key: ValueKey('feed-original-post-${post['id']}'),
              onTap: () => _openOriginalPost(original),
              borderRadius: BorderRadius.circular(13),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: socoLine),
                  borderRadius: BorderRadius.circular(13),
                  color: const Color(0xFFF8FAFE),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      original['authorDisplayName']?.toString().isNotEmpty ==
                              true
                          ? original['authorDisplayName'].toString()
                          : original['author']?.toString() ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      original['content']?.toString() ?? '',
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (objects(original['attachments']).isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 7),
                        child: Text(
                          'Bài viết có tệp phương tiện',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          if (likes > 0 || comments.isNotEmpty)
            Align(
              alignment: Alignment.centerRight,
              child: Wrap(
                alignment: WrapAlignment.end,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  if (likes > 0)
                    TextButton(
                      onPressed: () => showReactionParticipants(
                        context,
                        api: widget.api,
                        id: (post['id'] as num).toInt(),
                        isPost: true,
                        reactions: [
                          {'emoji': '👍', 'count': likes},
                        ],
                      ),
                      child: Text('$likes lượt thích'),
                    ),
                  if (likes > 0 && comments.isNotEmpty) const Text(' · '),
                  if (comments.isNotEmpty)
                    TextButton(
                      onPressed: () => _openPostDetail(post),
                      child: Text(
                        '${comments.length} bình luận',
                        style: const TextStyle(fontSize: 12, color: socoMuted),
                      ),
                    ),
                  if ((post['repostCount'] as num?)?.toInt()
                      case final int count when count > 0)
                    Text(
                      '$count lượt đăng lại',
                      style: const TextStyle(fontSize: 11, color: socoMuted),
                    ),
                ],
              ),
            ),
          const Divider(),
          Row(
            children: [
              Expanded(
                child: TextButton.icon(
                  onPressed: busyPost == post['id'] ? null : () => _like(post),
                  style: engagementStyle,
                  icon: Icon(
                    liked
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    color: liked ? const Color(0xFFE11D48) : socoMuted,
                    size: 19,
                  ),
                  label: const Text('Thích'),
                ),
              ),
              Expanded(
                child: TextButton.icon(
                  onPressed: () => _openPostDetail(post),
                  style: engagementStyle,
                  icon: const Icon(Icons.chat_bubble_outline_rounded, size: 19),
                  label: const Text('Bình luận'),
                ),
              ),
              Expanded(
                child: TextButton.icon(
                  key: ValueKey('feed-post-share-${post['id']}'),
                  onPressed: () => _sharePost(post),
                  style: engagementStyle,
                  icon: const Icon(Icons.ios_share_rounded, size: 19),
                  label: const Text('Chia sẻ'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  BoxDecoration? _backgroundDecoration(String name) {
    const gradients = <String, List<Color>>{
      'violet': [Color(0xFF536BE9), Color(0xFFAD52D5)],
      'blue': [Color(0xFF1D70E9), Color(0xFF19BAD1)],
      'sunset': [Color(0xFFEC668F), Color(0xFFFEAE5E)],
      'mint': [Color(0xFF0D9488), Color(0xFF5BAA99)],
      'night': [Color(0xFF121D3D), Color(0xFF49527C)],
    };
    final colors = gradients[name];
    if (colors == null) return null;
    return BoxDecoration(
      borderRadius: BorderRadius.circular(16),
      gradient: LinearGradient(colors: colors),
    );
  }

  Widget _mediaGrid(List<Json> media) {
    final visible = media.take(4).toList();
    if (visible.length == 1) {
      return InkWell(
        onTap: () => openAttachment(context, visible.first),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(height: 300, child: _mediaTile(visible.first)),
        ),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        height: 320,
        child: GridView.builder(
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 3,
            mainAxisSpacing: 3,
          ),
          itemCount: visible.length,
          itemBuilder: (context, index) {
            final item = visible[index];
            return InkWell(
              onTap: () => openAttachment(context, item),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _mediaTile(item),
                  if (index == 3 && media.length > 4)
                    ColoredBox(
                      color: Colors.black54,
                      child: Center(
                        child: Text(
                          '+${media.length - 3}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _mediaTile(Json item) {
    if (item['kind'] == 'image') {
      return Image.network(
        item['url']?.toString() ?? '',
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const ColoredBox(color: Color(0xFFE8EDFA)),
      );
    }
    return const ColoredBox(
      color: socoNavy,
      child: Icon(
        Icons.play_circle_fill_rounded,
        color: Colors.white,
        size: 56,
      ),
    );
  }
}

class _StoryCard extends StatelessWidget {
  const _StoryCard({
    required this.label,
    required this.onTap,
    this.child,
    this.attachment,
    this.text,
    this.background,
  });

  final String label;
  final VoidCallback onTap;
  final Widget? child;
  final Json? attachment;
  final String? text;
  final String? background;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(
          width: 65,
          child: Column(
            children: [
              Container(
                width: 65,
                height: 84,
                padding: EdgeInsets.all(attachment == null ? 0 : 3),
                decoration: BoxDecoration(
                  gradient: attachment == null
                      ? const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Color(0xFFDDE8D5),
                            Color(0xFF7895CC),
                            Color(0xFF183D8B),
                          ],
                        )
                      : socoGradient,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE3E9F7)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x0E25386E),
                      blurRadius: 16,
                      offset: Offset(0, 6),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(13),
                  child: ColoredBox(
                    color: attachment == null
                        ? Colors.transparent
                        : attachment?['kind'] == 'video'
                        ? socoNavy
                        : socoSoftBlue,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (text?.isNotEmpty == true)
                          Container(
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors:
                                    storyBackgrounds[background ?? 'berry'] ??
                                    storyBackgrounds['berry']!,
                              ),
                            ),
                            padding: const EdgeInsets.all(7),
                            child: Text(
                              text!,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        if (attachment?['kind'] == 'image')
                          Image.network(
                            attachment!['url']?.toString() ?? '',
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) =>
                                const ColoredBox(color: socoSoftBlue),
                          ),
                        if (child != null) ...[
                          Center(child: child),
                          Positioned(
                            left: 7,
                            bottom: 7,
                            child: Text(
                              label,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ] else if (attachment?['kind'] == 'video')
                          const Icon(
                            Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 30,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              if (attachment != null || text != null) ...[
                const SizedBox(height: 5),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ComposerAction extends StatelessWidget {
  const _ComposerAction({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });

  final SocoIconType icon;
  final Color color;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF0F4FE),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconTheme(
              data: IconThemeData(color: color),
              child: SocoIcon(icon, size: 20),
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(color: Color(0xFF3754A7), fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
