import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
import 'widgets.dart';

/// Shared participant list for chat message reactions and Newsfeed reactions.
/// The API enforces the viewer's permission to access the parent resource.
Future<void> showReactionParticipants(
  BuildContext context, {
  required Api api,
  required int id,
  required bool isPost,
  String initialEmoji = '',
  List<Json> reactions = const [],
}) {
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (ctx) => ReactionParticipantsSheet(
      api: api,
      id: id,
      isPost: isPost,
      initialEmoji: initialEmoji,
      reactions: reactions,
    ),
  );
}

class ReactionParticipantsSheet extends StatefulWidget {
  const ReactionParticipantsSheet({
    super.key,
    required this.api,
    required this.id,
    required this.isPost,
    this.initialEmoji = '',
    this.reactions = const [],
  });

  final Api api;
  final int id;
  final bool isPost;
  final String initialEmoji;
  final List<Json> reactions;

  @override
  State<ReactionParticipantsSheet> createState() =>
      _ReactionParticipantsSheetState();
}

class _ReactionParticipantsSheetState extends State<ReactionParticipantsSheet> {
  late String selectedEmoji = widget.initialEmoji;
  List<Json> users = [];
  bool hasMore = false;
  bool loading = false;
  String error = '';
  int revision = 0;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    if (loading && !reset) return;
    final requestId = ++revision;
    final offset = reset ? 0 : users.length;
    setState(() {
      loading = true;
      error = '';
      if (reset) {
        users = [];
        hasMore = false;
      }
    });
    final path = widget.isPost ? 'posts' : 'messages';
    final query =
        'offset=$offset'
        '${selectedEmoji.isNotEmpty ? '&emoji=${Uri.encodeQueryComponent(selectedEmoji)}' : ''}';
    try {
      final response = object(
        await widget.api.request(
          'GET',
          '/api/$path/${widget.id}/reactions?$query',
        ),
      );
      final items = objects(response['items']);
      if (!mounted || requestId != revision) return;
      setState(() {
        users = reset ? items : [...users, ...items];
        hasMore = response['hasMore'] == true;
      });
    } catch (cause) {
      if (!mounted || requestId != revision) return;
      setState(() => error = cause.toString());
    } finally {
      if (mounted && requestId == revision) {
        setState(() => loading = false);
      }
    }
  }

  void _setEmoji(String emoji) {
    if (emoji == selectedEmoji) return;
    selectedEmoji = emoji;
    _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.reactions.fold<int>(
      0,
      (sum, reaction) => sum + ((reaction['count'] as num?)?.toInt() ?? 0),
    );
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * .72,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 2, 8, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.isPost ? 'Cảm xúc bài viết' : 'Cảm xúc tin nhắn',
                    style: const TextStyle(
                      color: socoNavy,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Đóng',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          if (widget.reactions.isNotEmpty)
            SizedBox(
              height: 48,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text('Tất cả $total'),
                      selected: selectedEmoji.isEmpty,
                      onSelected: (_) => _setEmoji(''),
                    ),
                  ),
                  for (final reaction in widget.reactions)
                    if (((reaction['count'] as num?)?.toInt() ?? 0) > 0)
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(
                            '${reaction['emoji']} ${reaction['count']}',
                          ),
                          selected: reaction['emoji'] == selectedEmoji,
                          onSelected: (_) =>
                              _setEmoji(reaction['emoji'].toString()),
                        ),
                      ),
                ],
              ),
            ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
              children: [
                for (final user in users)
                  ListTile(
                    leading: UserAvatar(
                      name: user['displayName']?.toString().isNotEmpty == true
                          ? user['displayName'].toString()
                          : user['username']?.toString() ?? 'Người dùng',
                      username: user['username']?.toString(),
                      size: 42,
                      fetchProfileImage: !widget.api.isDemo,
                    ),
                    title: Text(
                      user['displayName']?.toString().isNotEmpty == true
                          ? user['displayName'].toString()
                          : user['username']?.toString() ?? 'Người dùng',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text('@${user['username'] ?? ''}'),
                    trailing: Text(
                      user['emoji']?.toString() ?? '',
                      style: const TextStyle(fontSize: 24),
                    ),
                  ),
                if (!loading && users.isEmpty && error.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(20),
                    child: Center(child: Text('Chưa có ai bày tỏ cảm xúc.')),
                  ),
                if (error.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      error,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                  ),
                if (loading)
                  const Padding(
                    padding: EdgeInsets.all(14),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (!loading && (hasMore || error.isNotEmpty))
                  Center(
                    child: TextButton(
                      onPressed: () => _load(reset: error.isNotEmpty),
                      child: Text(error.isNotEmpty ? 'Thử lại' : 'Xem thêm'),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
