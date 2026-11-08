import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mime/mime.dart';

import 'api.dart';
import 'call_surface.dart';
import 'group_tools.dart';
import 'language_picker.dart';
import 'media_viewer.dart';
import 'theme.dart';
import 'widgets.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.api,
    required this.query,
    required this.onConversationChanged,
    this.onUnreadChanged,
    this.requestedConversation,
    this.createRequest = 0,
    this.foreground = true,
  });

  final Api api;
  final String query;
  final ValueChanged<bool> onConversationChanged;
  final ValueChanged<int>? onUnreadChanged;
  final Json? requestedConversation;
  final int createRequest;
  final bool foreground;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final messageController = TextEditingController();
  final scrollController = ScrollController();
  List<Json> conversations = [];
  List<Json> messages = [];
  String conversationFilter = 'all';
  Json? active;
  Json? replyingTo;
  bool loading = true;
  bool sending = false;
  bool uploading = false;
  String targetLanguage = 'vi';
  bool autoTranslate = true;
  String appLocale = 'auto';
  Json? friendConnection;
  bool friendLoading = false;
  bool friendActionBusy = false;
  String friendError = '';
  String error = '';
  StreamSubscription<void>? events;
  Timer? reconcileTimer;
  bool reconciling = false;
  bool reconcileAgain = false;

  @override
  void initState() {
    super.initState();
    _refresh();
    if (widget.foreground) _listenForEvents();
  }

  void _listenForEvents() {
    if (events != null) return;
    events = widget.api.events().listen((_) => _scheduleReconcile());
  }

  void _scheduleReconcile() {
    if (!mounted || !widget.foreground) return;
    reconcileTimer?.cancel();
    reconcileTimer = Timer(const Duration(milliseconds: 300), _reconcile);
  }

  void _stopEvents() {
    reconcileTimer?.cancel();
    reconcileTimer = null;
    reconcileAgain = false;
    final subscription = events;
    events = null;
    if (subscription != null) unawaited(subscription.cancel());
  }

  @override
  void didUpdateWidget(covariant ChatScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.foreground != widget.foreground) {
      if (widget.foreground) {
        _listenForEvents();
        _scheduleReconcile();
      } else {
        _stopEvents();
      }
    }
    final requested = widget.requestedConversation;
    if (requested != null &&
        !identical(requested, oldWidget.requestedConversation) &&
        requested['id'] != active?['id']) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && widget.requestedConversation == requested) {
          _loadMessages(requested);
        }
      });
    }
    if (widget.createRequest != oldWidget.createRequest) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _newChat();
      });
    }
  }

  Future<void> _refresh() async {
    try {
      final data = objects(
        await widget.api.request('GET', '/api/conversations'),
      );
      if (!mounted) return;
      setState(() {
        conversations = data;
        loading = false;
        error = '';
      });
      final unread = data.fold<int>(
        0,
        (sum, room) => sum + ((room['unreadCount'] as num?)?.toInt() ?? 0),
      );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onUnreadChanged?.call(unread);
      });
      if (active != null) {
        final replacement = data.where((item) => item['id'] == active!['id']);
        if (replacement.isNotEmpty) active = replacement.first;
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

  Future<void> _reconcile() async {
    if (!mounted || !widget.foreground) return;
    if (reconciling) {
      reconcileAgain = true;
      return;
    }
    reconciling = true;
    try {
      await _refresh();
      final roomId = active?['id'];
      if (roomId == null || !mounted || !widget.foreground) return;
      // Realtime refresh must not re-open the room, reset the composer,
      // re-fetch preferences or retranslate the entire history.
      final updated = objects(
        await widget.api.request(
          'GET',
          '/api/conversations/$roomId/messages'
              '?target=${Uri.encodeQueryComponent(targetLanguage)}',
        ),
      );
      if (!mounted || !widget.foreground || active?['id'] != roomId) return;

      final previous = {for (final message in messages) message['id']: message};
      final incoming = <Json>[];
      var hasIncoming = false;
      for (final message in updated) {
        final old = previous[message['id']];
        if (old != null) {
          if (old['translationLanguage'] == targetLanguage &&
              (message['translatedText']?.toString().isEmpty ?? true)) {
            message['translatedText'] = old['translatedText'];
            message['translationLanguage'] = old['translationLanguage'];
          }
          if (old['_showOriginal'] == true) {
            message['_showOriginal'] = true;
          }
        } else if (message['senderId'] != widget.api.user['id']) {
          hasIncoming = true;
          incoming.add(message);
        }
      }
      final followBottom =
          !scrollController.hasClients ||
          scrollController.position.extentAfter < 100;
      setState(() => messages = updated);
      if (hasIncoming) {
        unawaited(() async {
          try {
            await widget.api.request('POST', '/api/conversations/$roomId/read');
          } catch (_) {
            // Reconcile will retry server read state on the next user action.
          }
        }());
        if (autoTranslate) {
          for (final message in incoming) {
            if ((message['text']?.toString().trim().isNotEmpty ?? false) &&
                (message['translatedText']?.toString().isEmpty ?? true)) {
              unawaited(
                _translate(message, target: targetLanguage, silent: true),
              );
            }
          }
        }
      }
      if (followBottom) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && active?['id'] == roomId) _scrollToBottom();
        });
      }
    } catch (_) {
      // Keep the visible messages if a background refresh fails.
    } finally {
      reconciling = false;
      if (reconcileAgain && mounted && widget.foreground) {
        reconcileAgain = false;
        _scheduleReconcile();
      }
    }
  }

  Future<void> _loadMessages(Json conversation) async {
    final changedConversation = active?['id'] != conversation['id'];
    setState(() {
      active = conversation;
      loading = true;
      replyingTo = null;
      if (changedConversation) {
        friendConnection = null;
        friendLoading = conversation['type'] == 'direct';
        friendError = '';
      }
    });
    widget.onConversationChanged(true);
    if (conversation['type'] == 'direct') {
      unawaited(_refreshFriendConnection(conversation));
    }
    try {
      var target = targetLanguage;
      var shouldAutoTranslate = autoTranslate;
      var locale = appLocale;
      try {
        final preferences = object(
          await widget.api.request('GET', '/api/preferences'),
        );
        target =
            preferences['targetLanguage']?.toString().trim().toLowerCase() ??
            target;
        shouldAutoTranslate = preferences['autoTranslate'] != false;
        locale = preferences['appLocale']?.toString() ?? locale;
      } catch (_) {
        // Keep last known preferences when only the preference request fails.
      }
      final data = objects(
        await widget.api.request(
          'GET',
          '/api/conversations/${conversation['id']}/messages'
              '?target=${Uri.encodeQueryComponent(target)}',
        ),
      );
      for (final message in data) {
        if (message['translationLanguage'] != target) {
          message.remove('translatedText');
        }
      }
      await widget.api.request(
        'POST',
        '/api/conversations/${conversation['id']}/read',
      );
      if (!mounted || active?['id'] != conversation['id']) return;
      setState(() {
        messages = data;
        targetLanguage = target;
        autoTranslate = shouldAutoTranslate;
        appLocale = locale;
        loading = false;
        error = '';
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
      if (shouldAutoTranslate) {
        await _translateMissing(data, target);
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

  Future<void> _refreshFriendConnection(Json conversation) async {
    final otherId = (conversation['otherUserId'] as num?)?.toInt();
    if (conversation['type'] != 'direct' || otherId == null) return;
    try {
      final values = await Future.wait([
        widget.api.request('GET', '/api/friends'),
        widget.api.request('GET', '/api/friends/requests'),
      ]);
      final accepted = objects(
        values[0],
      ).where((item) => item['id'] == otherId).firstOrNull;
      final pending = objects(
        values[1],
      ).where((item) => item['id'] == otherId).firstOrNull;
      if (!mounted || active?['id'] != conversation['id']) return;
      setState(() {
        friendConnection = accepted ?? pending;
        friendLoading = false;
        friendError = '';
      });
    } catch (_) {
      if (!mounted || active?['id'] != conversation['id']) return;
      setState(() {
        friendLoading = false;
        friendError = 'Chưa tải được trạng thái kết bạn.';
      });
    }
  }

  String get _friendRelationship {
    if (friendConnection?['status'] == 'accepted') return 'accepted';
    if (friendConnection?['direction'] == 'incoming') return 'incoming';
    if (friendConnection?['direction'] == 'outgoing') return 'outgoing';
    return 'none';
  }

  Future<void> _friendAction({bool decline = false}) async {
    final room = active;
    final otherId = (room?['otherUserId'] as num?)?.toInt();
    if (room == null || otherId == null || friendActionBusy) return;
    final relationship = _friendRelationship;
    setState(() => friendActionBusy = true);
    try {
      if (decline || relationship == 'outgoing') {
        await widget.api.request(
          'DELETE',
          '/api/friends/$otherId?direction=$relationship',
        );
      } else if (relationship == 'incoming') {
        await widget.api.request('POST', '/api/friends/$otherId/accept');
      } else {
        await widget.api.request('POST', '/api/friends/$otherId');
      }
      await _refreshFriendConnection(room);
    } catch (value) {
      _show(value.toString());
      await _refreshFriendConnection(room);
    } finally {
      if (mounted) setState(() => friendActionBusy = false);
    }
  }

  void _closeConversation() {
    setState(() {
      active = null;
      messages = [];
      replyingTo = null;
    });
    widget.onConversationChanged(false);
  }

  Future<void> _send({List<Json> attachments = const []}) async {
    final text = messageController.text.trim();
    if (active == null || sending || (text.isEmpty && attachments.isEmpty)) {
      return;
    }
    final body = <String, dynamic>{
      'text': text,
      'clientId': DateTime.now().microsecondsSinceEpoch.toString(),
      if (replyingTo != null) 'replyToMessageId': replyingTo!['id'],
      if (attachments.isNotEmpty) 'attachments': attachments,
    };
    setState(() => sending = true);
    try {
      final result = object(
        await widget.api.request(
          'POST',
          '/api/conversations/${active!['id']}/messages',
          body,
        ),
      );
      if (!mounted) return;
      setState(() {
        messages = [...messages, result];
        messageController.clear();
        replyingTo = null;
      });
      _scrollToBottom();
      await _refresh();
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _pickAttachment() async {
    final files = await FilePicker.pickFiles();
    if (files.isEmpty) return;
    setState(() => uploading = true);
    try {
      final attachments = <Json>[];
      for (final file in files.take(10)) {
        final bytes = await file.readAsBytes();
        attachments.add(
          await widget.api.upload(
            'chat',
            file.name,
            lookupMimeType(file.name, headerBytes: bytes) ??
                'application/octet-stream',
            bytes,
          ),
        );
      }
      await _send(attachments: attachments);
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> _translate(
    Json message, {
    String? target,
    bool silent = false,
  }) async {
    final language = target ?? targetLanguage;
    try {
      final result = object(
        await widget.api.request('POST', '/api/translate', {
          'text': message['text'],
          'target': language,
          'messageId': message['id'],
        }),
      );
      if (!mounted) return;
      setState(() {
        message['translatedText'] = result['translatedText'];
        message['translationLanguage'] = language;
        message['_showOriginal'] = false;
      });
    } catch (value) {
      if (!silent) _show(value.toString());
    }
  }

  Future<void> _translateMissing(List<Json> source, String target) async {
    final pending = source
        .where(
          (message) =>
              message['senderId'] != widget.api.user['id'] &&
              (message['text']?.toString().trim().isNotEmpty ?? false) &&
              (message['translatedText']?.toString().isEmpty ?? true),
        )
        .toList();
    // Bound translation concurrency: large histories must not flood the API
    // or repaint dozens of bubbles in one burst on emulator devices.
    for (var start = 0; start < pending.length; start += 3) {
      await Future.wait([
        for (final message in pending.skip(start).take(3))
          _translate(message, target: target, silent: true),
      ]);
      if (!mounted) return;
    }
  }

  Future<void> _saveTranslationSettings({String? target, bool? enabled}) async {
    final nextTarget = target ?? targetLanguage;
    final nextEnabled = enabled ?? autoTranslate;
    try {
      final updated = object(
        await widget.api.request('PUT', '/api/preferences', {
          'targetLanguage': nextTarget,
          'autoTranslate': nextEnabled,
          'appLocale': appLocale,
        }),
      );
      if (!mounted) return;
      setState(() {
        targetLanguage = updated['targetLanguage']?.toString() ?? nextTarget;
        autoTranslate = updated['autoTranslate'] != false;
        appLocale = updated['appLocale']?.toString() ?? appLocale;
        for (final message in messages) {
          if (message['translationLanguage'] != targetLanguage) {
            message.remove('translatedText');
          }
        }
      });
      if (autoTranslate) {
        await _translateMissing(messages, targetLanguage);
      }
    } catch (value) {
      _show(value.toString());
    }
  }

  Future<void> _showTranslationSettings() async {
    var selected = targetLanguage;
    var enabled = autoTranslate;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 6, 18, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.auto_awesome_rounded),
                  title: const Text(
                    'Dịch AI',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text('Dịch tự động tin nhắn nhận được'),
                  trailing: Switch(
                    key: const ValueKey('chat-auto-translate'),
                    value: enabled,
                    onChanged: (value) {
                      setSheetState(() => enabled = value);
                      _saveTranslationSettings(enabled: value);
                    },
                  ),
                ),
                const Divider(),
                ListTile(
                  key: const ValueKey('chat-translation-language'),
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.translate_rounded),
                  title: const Text('Ngôn ngữ dịch'),
                  subtitle: Text(languageName(selected)),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () async {
                    final target = await showLanguagePicker(
                      sheetContext,
                      selected: selected,
                      title: 'Ngôn ngữ dịch',
                    );
                    if (target == null) return;
                    setSheetState(() => selected = target);
                    await _saveTranslationSettings(target: target);
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _edit(Json message) async {
    final controller = TextEditingController(text: message['text']?.toString());
    final text = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sửa tin nhắn'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 4000,
          minLines: 1,
          maxLines: 5,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (text == null || text.isEmpty || text == message['text']) return;
    try {
      final updated = object(
        await widget.api.request('PATCH', '/api/messages/${message['id']}', {
          'text': text,
        }),
      );
      _replaceMessage(updated);
    } catch (value) {
      _show(value.toString());
    }
  }

  Future<void> _recall(Json message) async {
    try {
      final updated = object(
        await widget.api.request('DELETE', '/api/messages/${message['id']}'),
      );
      _replaceMessage(updated);
    } catch (value) {
      _show(value.toString());
    }
  }

  Future<void> _react(Json message, String emoji) async {
    try {
      final updated = object(
        await widget.api.request(
          'POST',
          '/api/messages/${message['id']}/reactions',
          {'emoji': emoji},
        ),
      );
      _replaceMessage(updated);
    } catch (value) {
      _show(value.toString());
    }
  }

  void _replaceMessage(Json updated) {
    if (!mounted) return;
    setState(() {
      messages = [
        for (final item in messages)
          if (item['id'] == updated['id']) updated else item,
      ];
    });
  }

  Future<void> _messageActions(Json message) async {
    final mine = message['senderId'] == widget.api.user['id'];
    await showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  for (final emoji in const [
                    '❤️',
                    '👍',
                    '😂',
                    '😮',
                    '😢',
                    '🙏',
                  ])
                    InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () {
                        Navigator.pop(context);
                        _react(message, emoji);
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Text(
                          emoji,
                          style: const TextStyle(fontSize: 25),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.reply_rounded),
              title: const Text('Trả lời'),
              onTap: () {
                Navigator.pop(context);
                setState(() => replyingTo = message);
              },
            ),
            if (message['text']?.toString().isNotEmpty ?? false)
              ListTile(
                leading: const Icon(Icons.copy_rounded),
                title: const Text('Sao chép'),
                onTap: () async {
                  Navigator.pop(context);
                  await Clipboard.setData(
                    ClipboardData(text: message['text'].toString()),
                  );
                  _show('Đã sao chép tin nhắn.');
                },
              ),
            if (!mine && (message['text']?.toString().isNotEmpty ?? false))
              ListTile(
                leading: const Icon(Icons.translate_rounded),
                title: const Text('Dịch'),
                onTap: () {
                  Navigator.pop(context);
                  _translate(message);
                },
              ),
            if (mine && (message['text']?.toString().isNotEmpty ?? false))
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Sửa'),
                onTap: () {
                  Navigator.pop(context);
                  _edit(message);
                },
              ),
            if (mine)
              ListTile(
                leading: const Icon(
                  Icons.delete_outline_rounded,
                  color: Colors.red,
                ),
                title: const Text(
                  'Thu hồi',
                  style: TextStyle(color: Colors.red),
                ),
                onTap: () {
                  Navigator.pop(context);
                  _recall(message);
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _newDirect() async {
    final controller = TextEditingController();
    final username = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Tạo chat riêng'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Username',
            prefixText: '@',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Tạo'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (username == null || username.isEmpty) return;
    try {
      final room = object(
        await widget.api.request('POST', '/api/conversations/direct', {
          'username': username.replaceFirst('@', ''),
        }),
      );
      await _refresh();
      await _loadMessages(room);
    } catch (value) {
      _show(value.toString());
    }
  }

  Future<void> _newChat() async {
    final type = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.person_outline_rounded),
              title: const Text('Chat riêng'),
              subtitle: const Text('Nhắn tin trực tiếp bằng username'),
              onTap: () => Navigator.pop(context, 'direct'),
            ),
            ListTile(
              leading: const Icon(Icons.group_add_outlined),
              title: const Text('Tạo nhóm'),
              subtitle: const Text('Chọn bạn bè và bắt đầu trò chuyện nhóm'),
              onTap: () => Navigator.pop(context, 'group'),
            ),
          ],
        ),
      ),
    );
    if (!mounted || type == null) return;
    if (type == 'direct') {
      await _newDirect();
      return;
    }
    final room = await showCreateGroupDialog(context, widget.api);
    if (!mounted || room == null) return;
    await _refresh();
    await _loadMessages(room);
  }

  void _scrollToBottom() {
    if (!scrollController.hasClients) return;
    scrollController.animateTo(
      scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  void _show(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _openGroupSettings(Json room) async {
    final left = await showGroupSettings(context, widget.api, room);
    if (left) _closeConversation();
    await _refresh();
  }

  @override
  void dispose() {
    _stopEvents();
    messageController.dispose();
    scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = conversations.where((item) {
      final query = widget.query.trim().toLowerCase();
      if (query.isNotEmpty &&
          !'${item['name']} ${item['lastMessage']}'.toLowerCase().contains(
            query,
          )) {
        return false;
      }
      return switch (conversationFilter) {
        'unread' => ((item['unreadCount'] as num?)?.toInt() ?? 0) > 0,
        'group' => item['type'] == 'group',
        'direct' => item['type'] == 'direct',
        _ => true,
      };
    }).toList();
    return LayoutBuilder(
      builder: (context, constraints) {
        final split = constraints.maxWidth >= 760;
        if (!split && active != null) return _conversationPane();
        return Row(
          children: [
            SizedBox(
              width: split ? 320 : constraints.maxWidth,
              child: _conversationList(filtered),
            ),
            if (split) ...[
              const VerticalDivider(width: 1),
              Expanded(
                child: active == null
                    ? const EmptyState(
                        icon: Icons.forum_outlined,
                        title: 'Kết nối không biên giới',
                        description:
                            'Chọn một cuộc trò chuyện để bắt đầu nhắn tin và dịch AI tự động.',
                      )
                    : _conversationPane(),
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _conversationList(List<Json> filtered) {
    return ColoredBox(
      color: Colors.white,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(15, 12, 15, 9),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Trò chuyện',
                        style: TextStyle(
                          fontSize: 19,
                          color: socoNavy,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        '${conversations.length} cuộc trò chuyện',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                TextButton.icon(
                  key: const ValueKey('connect-action'),
                  onPressed: _newChat,
                  style: TextButton.styleFrom(
                    foregroundColor: socoBlue,
                    backgroundColor: socoSoftBlue,
                    minimumSize: const Size(0, 38),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.add_comment_outlined, size: 18),
                  label: const Text(
                    'Kết nối',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 9),
            child: Row(
              children: [
                for (final entry in const [
                  ('all', 'Tất cả'),
                  ('unread', 'Chưa đọc'),
                  ('group', 'Nhóm'),
                  ('direct', 'Cá nhân'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      key: ValueKey('chat-filter-${entry.$1}'),
                      label: Text(entry.$2),
                      selected: conversationFilter == entry.$1,
                      onSelected: (_) =>
                          setState(() => conversationFilter = entry.$1),
                      showCheckmark: false,
                      backgroundColor: const Color(0xFFF6F8FC),
                      selectedColor: socoSoftBlue,
                      side: BorderSide(
                        color: conversationFilter == entry.$1
                            ? const Color(0xFFBED0FB)
                            : const Color(0xFFE8ECF7),
                      ),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: conversationFilter == entry.$1
                            ? socoBlue
                            : socoMuted,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (loading && conversations.isEmpty)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (error.isNotEmpty && conversations.isEmpty)
            Expanded(
              child: EmptyState(
                icon: Icons.cloud_off_outlined,
                title: 'Chưa kết nối được',
                description: error,
                action: FilledButton(
                  onPressed: _refresh,
                  child: const Text('Thử lại'),
                ),
              ),
            )
          else if (filtered.isEmpty)
            const Expanded(
              child: EmptyState(
                icon: Icons.search_off_rounded,
                title: 'Không tìm thấy cuộc trò chuyện',
                description: 'Thử tìm bằng tên hoặc nội dung khác.',
              ),
            )
          else
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refresh,
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final room = filtered[index];
                    final selected = active?['id'] == room['id'];
                    final unread = (room['unreadCount'] as num?)?.toInt() ?? 0;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 1),
                      child: Material(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                        child: Ink(
                          decoration: BoxDecoration(
                            gradient: selected
                                ? const LinearGradient(
                                    colors: [
                                      Color(0xFFEDF3FF),
                                      Color(0xFFF7F5FF),
                                    ],
                                  )
                                : null,
                            border: selected
                                ? const Border(
                                    left: BorderSide(color: socoBlue, width: 3),
                                  )
                                : null,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: InkWell(
                            onTap: () => _loadMessages(room),
                            borderRadius: BorderRadius.circular(16),
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(minHeight: 72),
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
                                child: Row(
                                  children: [
                                    UserAvatar(
                                      name: room['name']?.toString() ?? '',
                                      username: room['type'] == 'direct'
                                          ? (room['otherUsername'] ??
                                                    room['name'])
                                                ?.toString()
                                          : null,
                                      size: 52,
                                      group: room['type'] == 'group',
                                      fetchProfileImage: !widget.api.isDemo,
                                      online:
                                          room['type'] == 'direct' &&
                                          room['online'] == true,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Container(
                                        decoration: const BoxDecoration(
                                          border: Border(
                                            bottom: BorderSide(
                                              color: Color(0xFFEEF1F8),
                                            ),
                                          ),
                                        ),
                                        child: Column(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    room['name']?.toString() ??
                                                        '',
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: const TextStyle(
                                                      color: socoNavy,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                                Text(
                                                  displayTime(
                                                    room['lastMessageAt'],
                                                  ),
                                                  style: Theme.of(
                                                    context,
                                                  ).textTheme.bodySmall,
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 5),
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    room['lastMessage']
                                                                ?.toString()
                                                                .isNotEmpty ==
                                                            true
                                                        ? room['lastMessage']
                                                              .toString()
                                                        : room['type'] ==
                                                              'group'
                                                        ? '${room['memberCount']} thành viên'
                                                        : 'Bắt đầu trò chuyện',
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: Theme.of(
                                                      context,
                                                    ).textTheme.bodySmall,
                                                  ),
                                                ),
                                                if (unread > 0)
                                                  Container(
                                                    constraints:
                                                        const BoxConstraints(
                                                          minWidth: 20,
                                                          minHeight: 20,
                                                        ),
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          horizontal: 6,
                                                        ),
                                                    decoration:
                                                        const BoxDecoration(
                                                          gradient:
                                                              socoGradient,
                                                          shape:
                                                              BoxShape.circle,
                                                        ),
                                                    alignment: Alignment.center,
                                                    child: Text(
                                                      unread > 99
                                                          ? '99+'
                                                          : '$unread',
                                                      style: const TextStyle(
                                                        color: Colors.white,
                                                        fontSize: 10,
                                                        fontWeight:
                                                            FontWeight.w800,
                                                      ),
                                                    ),
                                                  ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _conversationPane() {
    final room = active!;
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 760;
        final veryNarrow = constraints.maxWidth < 370;
        return ColoredBox(
          color: const Color(0xFFF0F2F5),
          child: Column(
            children: [
              Container(
                height: compact ? 58 : 74,
                padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 14),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(bottom: BorderSide(color: socoLine)),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x0A2A3A76),
                      blurRadius: 14,
                      offset: Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    if (compact)
                      IconButton(
                        tooltip: 'Quay lại',
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          minimumSize: const Size.square(35),
                          padding: EdgeInsets.zero,
                        ),
                        onPressed: _closeConversation,
                        icon: const Icon(
                          Icons.arrow_back_ios_new_rounded,
                          size: 20,
                        ),
                      ),
                    if (!veryNarrow)
                      UserAvatar(
                        name: room['name']?.toString() ?? '',
                        username: room['type'] == 'direct'
                            ? (room['otherUsername'] ?? room['name'])
                                  ?.toString()
                            : null,
                        size: compact ? 36 : 42,
                        group: room['type'] == 'group',
                        fetchProfileImage: !widget.api.isDemo,
                        online: room['online'] == true,
                      ),
                    SizedBox(width: compact ? 7 : 11),
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            room['name']?.toString() ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: socoNavy,
                              fontSize: compact ? 14 : 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            room['type'] == 'group'
                                ? '${room['memberCount']} thành viên'
                                : room['online'] == true
                                ? 'Đang online'
                                : 'Chat riêng',
                            maxLines: 1,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    _chatAction(
                      tooltip: 'Gọi thoại',
                      compact: compact,
                      onPressed: () => showCallSurface(
                        context,
                        api: widget.api,
                        conversation: room,
                        video: false,
                      ),
                      icon: Icons.call_outlined,
                    ),
                    SizedBox(width: compact ? 3 : 6),
                    _chatAction(
                      tooltip: 'Gọi video',
                      compact: compact,
                      onPressed: () => showCallSurface(
                        context,
                        api: widget.api,
                        conversation: room,
                        video: true,
                      ),
                      icon: Icons.videocam_outlined,
                    ),
                    if (veryNarrow || (compact && room['type'] == 'group')) ...[
                      SizedBox(width: compact ? 2 : 6),
                      PopupMenuButton<String>(
                        key: const ValueKey('chat-more-actions'),
                        tooltip: 'Thêm tùy chọn',
                        onSelected: (value) {
                          if (value == 'translate') {
                            _showTranslationSettings();
                          } else if (value == 'shared') {
                            showSharedContent(context, widget.api, room);
                          } else if (value == 'group') {
                            _openGroupSettings(room);
                          }
                        },
                        itemBuilder: (context) => [
                          const PopupMenuItem(
                            value: 'translate',
                            child: ListTile(
                              leading: Icon(Icons.translate_rounded),
                              title: Text('Cài đặt dịch AI'),
                            ),
                          ),
                          const PopupMenuItem(
                            value: 'shared',
                            child: ListTile(
                              leading: Icon(Icons.collections_outlined),
                              title: Text('Nội dung đã chia sẻ'),
                            ),
                          ),
                          if (room['type'] == 'group')
                            const PopupMenuItem(
                              value: 'group',
                              child: ListTile(
                                leading: Icon(Icons.group_outlined),
                                title: Text('Quản lý nhóm'),
                              ),
                            ),
                        ],
                        icon: const Icon(Icons.more_vert_rounded, size: 20),
                      ),
                    ] else ...[
                      SizedBox(width: compact ? 3 : 6),
                      _sharedContentAction(room, compact),
                      SizedBox(width: compact ? 3 : 6),
                      _translationAction(compact),
                      if (room['type'] == 'group') ...[
                        const SizedBox(width: 6),
                        PopupMenuButton<String>(
                          key: const ValueKey('chat-more-actions'),
                          tooltip: 'Quản lý nhóm',
                          onSelected: (_) => _openGroupSettings(room),
                          itemBuilder: (context) => const [
                            PopupMenuItem(
                              value: 'group',
                              child: ListTile(
                                leading: Icon(Icons.group_outlined),
                                title: Text('Quản lý nhóm'),
                              ),
                            ),
                          ],
                          icon: const Icon(Icons.more_vert_rounded, size: 20),
                        ),
                      ],
                    ],
                  ],
                ),
              ),
              if (room['type'] == 'direct') _friendBar(),
              Expanded(
                child: loading
                    ? const Center(child: CircularProgressIndicator())
                    : messages.isEmpty
                    ? const EmptyState(
                        icon: Icons.waving_hand_outlined,
                        title: 'Bắt đầu trò chuyện',
                        description: 'Gửi tin nhắn đầu tiên ngay bây giờ.',
                      )
                    : ListView.builder(
                        controller: scrollController,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 16,
                        ),
                        itemCount: messages.length + 1,
                        itemBuilder: (context, index) => index == 0
                            ? _dayDivider()
                            : _messageBubble(messages[index - 1]),
                      ),
              ),
              _composer(),
            ],
          ),
        );
      },
    );
  }

  Widget _chatAction({
    required String tooltip,
    required bool compact,
    required VoidCallback onPressed,
    required IconData icon,
  }) {
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      style: IconButton.styleFrom(
        foregroundColor: const Color(0xFF3164E8),
        backgroundColor: socoSoftBlue,
        minimumSize: Size.square(compact ? 35 : 40),
        maximumSize: Size.square(compact ? 35 : 40),
        padding: EdgeInsets.zero,
        side: const BorderSide(color: Color(0xFFE7ECFF)),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(compact ? 11 : 13),
        ),
      ),
      icon: Icon(icon, size: compact ? 20 : 22),
    );
  }

  Widget _sharedContentAction(Json room, bool compact) {
    if (compact) {
      return _chatAction(
        tooltip: 'Nội dung đã chia sẻ',
        compact: true,
        onPressed: () => showSharedContent(context, widget.api, room),
        icon: Icons.collections_outlined,
      );
    }
    return OutlinedButton.icon(
      onPressed: () => showSharedContent(context, widget.api, room),
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF3164E8),
        backgroundColor: socoSoftBlue,
        minimumSize: const Size(0, 40),
        padding: const EdgeInsets.symmetric(horizontal: 13),
        side: const BorderSide(color: Color(0xFFE7ECFF)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
      ),
      icon: const Icon(Icons.collections_outlined, size: 20),
      label: const Text(
        'Nội dung',
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _translationAction(bool compact) {
    return OutlinedButton(
      key: const ValueKey('chat-translation-action'),
      onPressed: _showTranslationSettings,
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF455171),
        backgroundColor: const Color(0xFFF5F2FF),
        minimumSize: Size(0, compact ? 35 : 40),
        padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 12),
        side: const BorderSide(color: Color(0xFFD7CCFF)),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(compact ? 11 : 13),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            compact
                ? 'AI · ${targetLanguage.toUpperCase()}'
                : 'AI · ${targetLanguage.toUpperCase()}',
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
          ),
          const SizedBox(width: 3),
          const Icon(Icons.keyboard_arrow_down_rounded, size: 15),
        ],
      ),
    );
  }

  Widget _dayDivider() {
    return Center(
      child: Container(
        key: const ValueKey('conversation-day-divider'),
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xE6FFFFFF),
          border: Border.all(color: const Color(0xFFE5EAF2)),
          borderRadius: BorderRadius.circular(999),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A3C5064),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: const Text(
          'Cuộc trò chuyện',
          style: TextStyle(color: Color(0xFF7D8998), fontSize: 11),
        ),
      ),
    );
  }

  Widget _friendBar() {
    final relationship = _friendRelationship;
    final status = friendError.isNotEmpty
        ? friendError
        : friendLoading
        ? 'Đang tải trạng thái kết bạn...'
        : switch (relationship) {
            'accepted' => 'Hai bạn đã là bạn bè',
            'incoming' => 'Bạn nhận được lời mời kết bạn',
            'outgoing' => 'Đã gửi lời mời kết bạn',
            _ => 'Hai bạn chưa kết bạn',
          };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: socoLine)),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 6,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Icon(
            relationship == 'accepted'
                ? Icons.how_to_reg_rounded
                : Icons.person_add_alt_1_rounded,
            size: 17,
            color: socoBlue,
          ),
          Text(
            status,
            style: const TextStyle(
              color: Color(0xFF536483),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (friendError.isNotEmpty)
            TextButton(
              onPressed: friendActionBusy || active == null
                  ? null
                  : () => _refreshFriendConnection(active!),
              child: const Text('Thử lại'),
            )
          else if (!friendLoading && relationship != 'accepted')
            FilledButton.icon(
              onPressed: friendActionBusy ? null : _friendAction,
              icon: Icon(
                relationship == 'outgoing'
                    ? Icons.close_rounded
                    : relationship == 'incoming'
                    ? Icons.check_rounded
                    : Icons.person_add_alt_1_rounded,
                size: 17,
              ),
              label: Text(
                relationship == 'outgoing'
                    ? 'Hủy lời mời'
                    : relationship == 'incoming'
                    ? 'Chấp nhận'
                    : 'Kết bạn',
              ),
            ),
          if (!friendLoading && relationship == 'incoming')
            TextButton(
              onPressed: friendActionBusy
                  ? null
                  : () => _friendAction(decline: true),
              child: const Text('Từ chối'),
            ),
        ],
      ),
    );
  }

  Widget _messageBubble(Json message) {
    final mine = message['senderId'] == widget.api.user['id'];
    final deleted = message['deleted'] == true;
    final translated = message['translatedText']?.toString() ?? '';
    final showOriginal = message['_showOriginal'] == true;
    final reactions = objects(message['reactions']);
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: deleted ? null : () => _messageActions(message),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 520),
          margin: EdgeInsets.only(
            bottom: 12,
            left: mine ? 48 : 0,
            right: mine ? 0 : 48,
          ),
          child: Column(
            crossAxisAlignment: mine
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              if (!mine)
                Padding(
                  padding: const EdgeInsets.only(left: 7, bottom: 4),
                  child: Text(
                    message['sender']?.toString() ?? '',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              if (message['replyToMessageId'] != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                    color: mine
                        ? const Color(0xFFE7EEFF)
                        : const Color(0xFFF0F2F8),
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(12),
                    ),
                  ),
                  child: Text(
                    '@${message['replyToSender'] ?? 'user'} · ${message['replyToText'] ?? 'Tin nhắn đã thu hồi'}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: socoMuted),
                  ),
                ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 13,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  gradient: mine && !deleted ? socoGradient : null,
                  color: mine && !deleted ? null : Colors.white,
                  border: mine
                      ? null
                      : Border.all(color: const Color(0xFFE3E9F5)),
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(18),
                    topRight: const Radius.circular(18),
                    bottomLeft: Radius.circular(mine ? 18 : 6),
                    bottomRight: Radius.circular(mine ? 6 : 18),
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x0D25376C),
                      blurRadius: 14,
                      offset: Offset(0, 5),
                    ),
                  ],
                ),
                child: Text(
                  deleted
                      ? 'Tin nhắn đã được thu hồi'
                      : translated.isNotEmpty && !showOriginal
                      ? translated
                      : message['text']?.toString() ?? '',
                  style: TextStyle(
                    color: mine && !deleted ? Colors.white : socoText,
                    fontStyle: deleted ? FontStyle.italic : FontStyle.normal,
                    fontSize: 14,
                    height: 1.46,
                  ),
                ),
              ),
              if (!deleted && translated.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: ActionChip(
                    visualDensity: VisualDensity.compact,
                    avatar: const Icon(Icons.auto_awesome_rounded, size: 14),
                    label: Text(
                      showOriginal
                          ? 'Hiện ${targetLanguage.toUpperCase()} · AI'
                          : 'Hiện bản gốc',
                    ),
                    onPressed: () => setState(
                      () => message['_showOriginal'] = !showOriginal,
                    ),
                  ),
                ),
              if (objects(message['attachments']).isNotEmpty)
                _attachments(objects(message['attachments'])),
              if (reactions.isNotEmpty)
                Wrap(
                  spacing: 4,
                  children: [
                    for (final reaction in reactions)
                      ActionChip(
                        visualDensity: VisualDensity.compact,
                        label: Text(
                          '${reaction['emoji']} ${reaction['count']}',
                        ),
                        onPressed: () =>
                            _react(message, reaction['emoji'].toString()),
                      ),
                  ],
                ),
              Padding(
                padding: const EdgeInsets.only(top: 3, left: 5, right: 5),
                child: Text(
                  '${displayTime(message['createdAt'])}${message['editedAt'] != null ? ' · đã sửa' : ''}${mine && ((message['readByUserIds'] as List?)?.isNotEmpty ?? false) ? ' · Đã xem' : ''}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _attachments(List<Json> items) {
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (final item in items)
            if (item['kind'] == 'image' && item['url'] is String)
              InkWell(
                onTap: () => openAttachment(context, item),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.network(
                    item['url'],
                    width: 210,
                    height: 150,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              )
            else
              ActionChip(
                onPressed: () => openAttachment(context, item),
                avatar: Icon(
                  item['kind'] == 'video'
                      ? Icons.videocam_outlined
                      : item['kind'] == 'audio'
                      ? Icons.graphic_eq_rounded
                      : Icons.description_outlined,
                  size: 18,
                ),
                label: Text(item['name']?.toString() ?? 'Tệp'),
              ),
        ],
      ),
    );
  }

  Widget _composer() {
    return Container(
      padding: EdgeInsets.fromLTRB(
        11,
        replyingTo == null ? 9 : 6,
        11,
        MediaQuery.paddingOf(context).bottom + 9,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: socoLine)),
      ),
      child: Column(
        children: [
          if (replyingTo != null)
            Container(
              padding: const EdgeInsets.fromLTRB(10, 5, 4, 5),
              margin: const EdgeInsets.only(bottom: 6),
              decoration: BoxDecoration(
                color: socoSoftBlue,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Trả lời @${replyingTo!['sender']}: ${replyingTo!['text']}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: socoMuted, fontSize: 12),
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(() => replyingTo = null),
                    icon: const Icon(Icons.close_rounded, size: 17),
                  ),
                ],
              ),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              IconButton(
                tooltip: 'Đính kèm',
                style: IconButton.styleFrom(
                  foregroundColor: socoBlue,
                  backgroundColor: socoSoftBlue,
                  minimumSize: const Size.square(44),
                  maximumSize: const Size.square(44),
                  shape: const CircleBorder(),
                ),
                onPressed: uploading || sending ? null : _pickAttachment,
                icon: uploading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const SocoIcon(SocoIconType.attach, size: 22),
              ),
              const SizedBox(width: 7),
              Expanded(
                child: TextField(
                  controller: messageController,
                  enabled: !sending,
                  minLines: 1,
                  maxLines: 5,
                  maxLength: 4000,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Nhắn ${active?['name'] ?? ''}...',
                    counterText: '',
                    filled: true,
                    fillColor: const Color(0xFFF5F6F8),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 15,
                      vertical: 11,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(999),
                      borderSide: const BorderSide(color: Color(0xFFE2E6EB)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(999),
                      borderSide: const BorderSide(color: Color(0xFFE2E6EB)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(999),
                      borderSide: const BorderSide(color: Color(0xFFE2E6EB)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 7),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: socoGradient,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: IconButton(
                  tooltip: 'Gửi',
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    minimumSize: const Size.square(44),
                    maximumSize: const Size.square(44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed:
                      sending ||
                          (messageController.text.trim().isEmpty && !uploading)
                      ? null
                      : _send,
                  icon: sending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const SocoIcon(SocoIconType.send, size: 20),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
