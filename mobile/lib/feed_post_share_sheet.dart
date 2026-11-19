import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import 'api.dart';
import 'feed_post_links.dart';

/// Native counterpart to the PWA share/repost dialog. Only server-confirmed
/// writes update the feed; failed writes preserve the quote draft.
class FeedPostShareSheet extends StatefulWidget {
  const FeedPostShareSheet({
    super.key,
    required this.api,
    required this.post,
    required this.onRepostChanged,
  });

  final Api api;
  final Json post;
  final Future<void> Function(Json updated) onRepostChanged;

  @override
  State<FeedPostShareSheet> createState() => _FeedPostShareSheetState();
}

class _FeedPostShareSheetState extends State<FeedPostShareSheet> {
  final quoteController = TextEditingController();
  final searchController = TextEditingController();
  String view = 'options';
  String error = '';
  bool busy = false;
  List<Json> conversations = [];

  int get id => (widget.post['id'] as num).toInt();
  bool get repostable =>
      widget.post['originalPost'] == null &&
      widget.post['visibility'] != 'private';
  int? get myRepostId {
    final value = (widget.post['myRepostId'] as num?)?.toInt();
    return value == null || value <= 0 ? null : value;
  }

  Uri get link {
    final original = widget.post['originalPost'];
    final target = widget.post['repostKind'] == 'quick' && original is Map
        ? (original['id'] as num).toInt()
        : id;
    return postShareUri(target);
  }

  @override
  void dispose() {
    quoteController.dispose();
    searchController.dispose();
    super.dispose();
  }

  void _notice(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _repost(String kind) async {
    if (busy || !repostable) return;
    final text = quoteController.text.trim();
    if (kind == 'quote' && (text.isEmpty || text.runes.length > 5000)) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final updated = kind == 'undo'
          ? () async {
              await widget.api.request('DELETE', '/api/posts/$id/repost');
              return <String, dynamic>{
                ...widget.post,
                'myRepostId': null,
                'repostCount':
                    (((widget.post['repostCount'] as num?)?.toInt() ?? 1) - 1)
                        .clamp(0, 999999),
              };
            }()
          : widget.api.request('POST', '/api/posts/$id/repost', {
              'kind': kind,
              'content': kind == 'quote' ? text : '',
            });
      final result = object(await updated);
      await widget.onRepostChanged(result);
      if (!mounted) return;
      _notice(
        kind == 'undo'
            ? 'Đã bỏ đăng lại.'
            : kind == 'quote'
            ? 'Đã đăng bài trích dẫn.'
            : 'Đã đăng lại bài viết.',
      );
      Navigator.of(context).pop();
    } catch (cause) {
      if (mounted) {
        setState(() => error = 'Không thể cập nhật đăng lại: $cause');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _copyLink() async {
    await Clipboard.setData(ClipboardData(text: link.toString()));
    if (!mounted) return;
    _notice('Đã sao chép liên kết bài viết.');
    Navigator.of(context).pop();
  }

  Future<void> _nativeShare() async {
    try {
      final box = context.findRenderObject() as RenderBox?;
      await SharePlus.instance.share(
        ShareParams(
          text: link.toString(),
          sharePositionOrigin: box == null
              ? const Rect.fromLTWH(0, 0, 1, 1)
              : box.localToGlobal(Offset.zero) & box.size,
        ),
      );
    } catch (cause) {
      if (mounted) setState(() => error = 'Không thể mở chia sẻ: $cause');
    }
  }

  Future<void> _openChatPicker() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final items = objects(
        await widget.api.request('GET', '/api/conversations?limit=100'),
      );
      if (!mounted) return;
      setState(() {
        conversations = items;
        view = 'chat';
      });
    } catch (cause) {
      if (mounted) setState(() => error = 'Không tải được hội thoại: $cause');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _sendChat(Json room) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await widget.api
          .request('POST', '/api/conversations/${room['id']}/messages', {
            'clientId': DateTime.now().microsecondsSinceEpoch.toString(),
            'text': link.toString(),
            if (room['type'] == 'group') 'channelId': 0,
          });
      if (!mounted) return;
      _notice('Đã gửi liên kết bài viết vào hội thoại.');
      Navigator.of(context).pop();
    } catch (cause) {
      if (mounted) setState(() => error = 'Chưa gửi được liên kết: $cause');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = quoteController.text.trim();
    final count = text.runes.length;
    final matches = searchController.text.trim().toLowerCase();
    final filtered = conversations
        .where(
          (room) =>
              (room['name']?.toString() ?? '').toLowerCase().contains(matches),
        )
        .toList();
    Widget choice(
      String key,
      IconData icon,
      String title,
      VoidCallback onTap,
    ) => ListTile(
      key: ValueKey(key),
      enabled: !busy,
      leading: Icon(icon),
      title: Text(title),
      onTap: busy ? null : onTap,
    );
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          0,
          16,
          MediaQuery.viewInsetsOf(context).bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (view != 'options')
                  IconButton(
                    tooltip: 'Quay lại',
                    onPressed: busy
                        ? null
                        : () => setState(() => view = 'options'),
                    icon: const Icon(Icons.arrow_back_rounded),
                  ),
                Expanded(
                  child: Text(
                    switch (view) {
                      'quote' => 'Đăng lại kèm lời',
                      'chat' => 'Gửi qua chat',
                      _ => 'Chia sẻ bài viết',
                    },
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Đóng',
                  onPressed: busy ? null : () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            if (view == 'options') ...[
              if (repostable) ...[
                choice(
                  'feed-repost-quick',
                  Icons.repeat_rounded,
                  myRepostId == null ? 'Đăng lại ngay' : 'Bỏ đăng lại',
                  () => _repost(myRepostId == null ? 'quick' : 'undo'),
                ),
                choice(
                  'feed-repost-quote',
                  Icons.format_quote_rounded,
                  'Đăng lại kèm lời',
                  () => setState(() => view = 'quote'),
                ),
              ],
              if (widget.post['visibility'] != 'private')
                choice(
                  'feed-share-to-chat',
                  Icons.chat_bubble_outline_rounded,
                  'Gửi qua chat',
                  _openChatPicker,
                ),
              choice(
                'feed-share-copy-link',
                Icons.link_rounded,
                'Sao chép liên kết',
                _copyLink,
              ),
              choice(
                'feed-share-native',
                Icons.ios_share_rounded,
                'Chia sẻ qua ứng dụng khác',
                _nativeShare,
              ),
            ] else if (view == 'quote') ...[
              TextField(
                key: const ValueKey('feed-repost-quote-input'),
                controller: quoteController,
                onChanged: (_) => setState(() {}),
                maxLines: 4,
                minLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Ý kiến của bạn',
                  hintText: 'Viết vài lời trước khi đăng lại...',
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  '$count / 5.000 ký tự',
                  style: TextStyle(color: count > 5000 ? Colors.red : null),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                key: const ValueKey('feed-repost-quote-send'),
                onPressed: busy || count == 0 || count > 5000
                    ? null
                    : () => _repost('quote'),
                child: const Text('Đăng bài trích dẫn'),
              ),
            ] else ...[
              TextField(
                key: const ValueKey('feed-share-chat-search'),
                controller: searchController,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  hintText: 'Tìm hội thoại hoặc nhóm',
                  prefixIcon: Icon(Icons.search_rounded),
                ),
              ),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 330),
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    if (filtered.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('Không có hội thoại phù hợp.'),
                      ),
                    for (final room in filtered)
                      ListTile(
                        key: ValueKey('feed-share-chat-${room['id']}'),
                        leading: Icon(
                          room['type'] == 'group'
                              ? Icons.groups_rounded
                              : Icons.person_rounded,
                        ),
                        title: Text(room['name']?.toString() ?? 'Hội thoại'),
                        onTap: busy ? null : () => _sendChat(room),
                      ),
                  ],
                ),
              ),
            ],
            if (busy)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(8),
                  child: CircularProgressIndicator(),
                ),
              ),
            if (error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(error, style: const TextStyle(color: Colors.red)),
              ),
          ],
        ),
      ),
    );
  }
}
