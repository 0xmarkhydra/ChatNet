import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:mime/mime.dart';

import 'api.dart';
import 'media_viewer.dart';
import 'theme.dart';
import 'widgets.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key, required this.api, required this.query});

  final Api api;
  final String query;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final postController = TextEditingController();
  final postFocusNode = FocusNode();
  List<Json> posts = [];
  List<Json> stories = [];
  List<Json> attachments = [];
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

  Future<void> _load() async {
    try {
      final values = await Future.wait([
        widget.api.request('GET', '/api/posts'),
        widget.api.request('GET', '/api/stories'),
      ]);
      if (!mounted) return;
      setState(() {
        posts = objects(values[0]);
        stories = objects(values[1]).where((item) {
          final expiry = DateTime.tryParse(item['expiresAt']?.toString() ?? '');
          return expiry == null || expiry.isAfter(DateTime.now());
        }).toList();
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

  Future<void> _createPost() async {
    final text = postController.text.trim();
    if (posting || (text.isEmpty && attachments.isEmpty)) return;
    setState(() => posting = true);
    try {
      final post = object(
        await widget.api.request('POST', '/api/posts', {
          'content': text,
          'attachments': attachments,
        }),
      );
      if (!mounted) return;
      setState(() {
        posts = [post, ...posts];
        postController.clear();
        attachments = [];
      });
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => posting = false);
    }
  }

  Future<void> _createStory() async {
    final media = await _pickAndUpload('story');
    if (media == null) return;
    try {
      final story = object(
        await widget.api.request('POST', '/api/stories', {'attachment': media}),
      );
      if (mounted) setState(() => stories = [story, ...stories]);
    } catch (value) {
      _show(value.toString());
    }
  }

  Future<void> _like(Json post) async {
    final id = (post['id'] as num).toInt();
    setState(() => busyPost = id);
    try {
      final updated = object(
        await widget.api.request('POST', '/api/posts/$id/like'),
      );
      if (!mounted) return;
      setState(() {
        posts = [
          for (final item in posts)
            if (item['id'] == id) updated else item,
        ];
      });
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => busyPost = null);
    }
  }

  Future<void> _comments(Json post) async {
    final controller = TextEditingController();
    Json? replyingTo;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final comments = objects(post['comments']);
          return Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              0,
              16,
              MediaQuery.viewInsetsOf(context).bottom + 16,
            ),
            child: SizedBox(
              height: MediaQuery.sizeOf(context).height * .68,
              child: Column(
                children: [
                  Text(
                    'Bình luận',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: comments.isEmpty
                        ? const EmptyState(
                            icon: Icons.chat_bubble_outline_rounded,
                            title: 'Chưa có bình luận',
                            description: 'Hãy mở đầu cuộc trò chuyện.',
                          )
                        : ListView(
                            children: [
                              for (final comment in comments.where(
                                (item) => item['parentId'] == null,
                              )) ...[
                                ListTile(
                                  leading: UserAvatar(
                                    name: comment['author']?.toString() ?? '',
                                    username: comment['author']?.toString(),
                                    size: 38,
                                    fetchProfileImage: !widget.api.isDemo,
                                  ),
                                  title: Text(
                                    comment['author']?.toString() ?? '',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  subtitle: Text(
                                    comment['content']?.toString() ?? '',
                                  ),
                                  trailing: TextButton(
                                    onPressed: () => setSheetState(
                                      () => replyingTo = comment,
                                    ),
                                    child: const Text('Trả lời'),
                                  ),
                                ),
                                for (final reply in comments.where(
                                  (item) => item['parentId'] == comment['id'],
                                ))
                                  Padding(
                                    padding: const EdgeInsets.only(left: 42),
                                    child: ListTile(
                                      leading: UserAvatar(
                                        name: reply['author']?.toString() ?? '',
                                        username: reply['author']?.toString(),
                                        size: 32,
                                        fetchProfileImage: !widget.api.isDemo,
                                      ),
                                      title: Text(
                                        reply['author']?.toString() ?? '',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      subtitle: Text(
                                        reply['content']?.toString() ?? '',
                                      ),
                                    ),
                                  ),
                              ],
                            ],
                          ),
                  ),
                  if (replyingTo != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.fromLTRB(12, 5, 4, 5),
                      decoration: BoxDecoration(
                        color: socoSoftBlue,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Trả lời @${replyingTo!['author']}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          IconButton(
                            onPressed: () =>
                                setSheetState(() => replyingTo = null),
                            icon: const Icon(Icons.close_rounded, size: 18),
                          ),
                        ],
                      ),
                    ),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: controller,
                          decoration: const InputDecoration(
                            hintText: 'Viết bình luận...',
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: () async {
                          final text = controller.text.trim();
                          if (text.isEmpty) return;
                          try {
                            final result = await widget.api.request(
                              'POST',
                              '/api/posts/${post['id']}/comments',
                              {
                                'content': text,
                                if (replyingTo != null)
                                  'parentId': replyingTo!['id'],
                              },
                            );
                            final updated = object(result);
                            if (!mounted) return;
                            setState(() {
                              posts = [
                                for (final item in posts)
                                  if (item['id'] == post['id'])
                                    updated
                                  else
                                    item,
                              ];
                            });
                            post
                              ..clear()
                              ..addAll(updated);
                            controller.clear();
                            setSheetState(() => replyingTo = null);
                          } catch (value) {
                            _show(value.toString());
                          }
                        },
                        icon: const Icon(Icons.send_rounded),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
    controller.dispose();
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
                    child: AttachmentView(
                      key: ValueKey(current['id']),
                      attachment: object(current['attachment']),
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
                          child: Text(
                            '@${current['author']}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
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

  void _show(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
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
    final query = widget.query.trim().toLowerCase();
    final visible = posts.where((post) {
      return query.isEmpty ||
          '${post['author']} ${post['content']}'.toLowerCase().contains(query);
    }).toList();
    return ColoredBox(
      color: socoCanvas,
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 30),
          children: [
            const SectionHeading(
              eyebrow: 'CỘNG ĐỒNG',
              title: 'Bảng tin',
              description: 'Chia sẻ khoảnh khắc và câu chuyện của bạn.',
            ),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
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
                      height: 154,
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
                              attachment: object(story['attachment']),
                            ),
                        ],
                      ),
                    ),
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
                                onTap: postFocusNode.requestFocus,
                              ),
                            ],
                          ),
                          if (postController.text.trim().isNotEmpty ||
                              attachments.isNotEmpty) ...[
                            const SizedBox(height: 9),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: posting ? null : _createPost,
                                child: Text(posting ? 'Đang đăng...' : 'Đăng'),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(15, 8, 15, 12),
                      child: Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Bài viết mới',
                              style: TextStyle(
                                color: Color(0xFF1B2944),
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          Text(
                            '${visible.length} bài viết',
                            style: const TextStyle(
                              color: Color(0xFF8590AA),
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (visible.isEmpty)
                      const EmptyState(
                        icon: Icons.dynamic_feed_outlined,
                        title: 'Chưa có bài viết',
                        description:
                            'Hãy chia sẻ khoảnh khắc đầu tiên của bạn.',
                      )
                    else
                      for (final post in visible) _post(post),
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
    final comments = objects(post['comments']);
    final liked = post['liked'] == true;
    return Container(
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
          Row(
            children: [
              UserAvatar(
                name: post['author']?.toString() ?? '',
                username: post['author']?.toString(),
                size: 46,
                fetchProfileImage: !widget.api.isDemo,
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      post['author']?.toString() ?? '',
                      style: const TextStyle(
                        color: socoNavy,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      displayDateTime(post['createdAt']),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.more_horiz_rounded, color: socoMuted),
            ],
          ),
          if (post['content']?.toString().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Text(post['content'].toString()),
          ],
          if (media.isNotEmpty) ...[
            const SizedBox(height: 12),
            _mediaGrid(media),
          ],
          const SizedBox(height: 10),
          const Divider(),
          Row(
            children: [
              Expanded(
                child: TextButton.icon(
                  onPressed: busyPost == post['id'] ? null : () => _like(post),
                  icon: Icon(
                    liked
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    color: liked ? const Color(0xFFE11D48) : socoMuted,
                  ),
                  label: Text(
                    'Thích${(post['likes'] as num?)?.toInt() != 0 ? ' ${(post['likes'] as num?)?.toInt() ?? 0}' : ''}',
                  ),
                ),
              ),
              Expanded(
                child: TextButton.icon(
                  onPressed: () => _comments(post),
                  icon: const Icon(Icons.chat_bubble_outline_rounded),
                  label: Text(
                    comments.isEmpty
                        ? 'Bình luận'
                        : '${comments.length} bình luận',
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
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
  });

  final String label;
  final VoidCallback onTap;
  final Widget? child;
  final Json? attachment;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(
          width: 88,
          child: Column(
            children: [
              Container(
                width: 88,
                height: 116,
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
              if (attachment != null) ...[
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
