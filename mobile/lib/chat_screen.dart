import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'state/app_providers.dart';
import 'presentation/mobile_avatar_channel_split.dart';
import 'presentation/mobile_channel_picker.dart';
import 'presentation/mobile_reverse_scroll_region.dart';
import 'presentation/conversation_avatar.dart';
import 'presentation/chat_information_sheet.dart';
import 'presentation/contact_metadata_editor.dart';
import 'presentation/conversation_list_presenter.dart';
import 'models/navigation_models.dart';
import 'package:flutter/services.dart';
import 'package:mime/mime.dart';

import 'api.dart';
import 'chat_mentions.dart';
import 'chat_mention_text.dart';
import 'call_surface.dart';
import 'group_tools.dart';
import 'language_picker.dart';
import 'media_viewer.dart';
import 'reaction_participants_sheet.dart';
import 'theme.dart';
import 'widgets.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({
    super.key,
    required this.api,
    required this.query,
    required this.onConversationChanged,
    this.requestedConversation,
    this.openConversationRequest = 0,
    this.createRequest = 0,
    this.resetRequest = 0,
    this.onUnreadChanged,
    this.onMobileScroll,
    this.onMobileReverseScroll,
  });

  final Api api;
  final String query;
  final ValueChanged<bool> onConversationChanged;
  final Json? requestedConversation;
  final int openConversationRequest;
  final int createRequest;
  final int resetRequest;
  final ValueChanged<int>? onUnreadChanged;

  /// Forward only the visible inbox/channel scrollers to the shared chrome.
  final void Function(ScrollNotification, String)? onMobileScroll;

  /// Direct upward content scroll gesture; also fires at the list boundary.
  final VoidCallback? onMobileReverseScroll;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen>
    with SingleTickerProviderStateMixin {
  final messageController = TextEditingController();
  final messageFocus = FocusNode();
  List<MentionCandidate> mentionMembers = [];
  int? mentionRoomId;
  int mentionLoadSequence = 0;
  final chatSearchController = TextEditingController();
  final chatSearchFocus = FocusNode();
  final channelSearchController = TextEditingController();
  final messageSearchController = TextEditingController();
  final scrollController = ScrollController(keepScrollOffset: false);
  final showLatest = ValueNotifier<bool>(false);
  int messageLoadGeneration = 0;
  bool initialTimelinePending = true;
  int? unreadMessageId;
  int? messageGapBefore;
  bool gapLoading = false;
  bool get centeredTimeline =>
      !searchingMessages &&
      unreadMessageId != null &&
      messages.any((m) => m['id'] == unreadMessageId);
  static const unreadCenterKey = ValueKey('unread-timeline-center');
  final avatarScrollController = ScrollController();
  final conversationListScrollController = ScrollController();
  List<Json> conversations = [];
  int conversationOffset = 0;
  bool hasMoreConversations = false;
  bool conversationLoadingMore = false;
  DateTime? lastGroupPrefetch;
  bool groupPrefetchBusy = false;
  List<Json> messages = [];
  List<Json> pendingAttachments = [];
  List<Json> channels = [];
  Json? generalChannel;
  List<Json> pinnedMessages = [];
  bool pinBusy = false;
  bool notificationBusy = false;
  bool pinnedExpanded = false;
  bool searchingMessages = false;
  String? searchSenderId;
  DateTimeRange? searchDates;
  List<Json>? serverSearchResults;
  bool searchLoading = false;
  bool searchHasMore = false;
  String searchError = '';
  int searchGeneration = 0;
  Timer? searchDebounce;
  Json? active;
  Json? pickerGroup;
  // Shared moving boundary: 1 = full avatar list; 0 = compact avatar dock.
  late final AnimationController railSplitController;
  bool get railIsExpanded => railSplitController.value > .5;
  int railNavigationGeneration = 0;
  int selectedChannelId = 0;
  bool channelsLoading = false;
  ChatListFilter roomFilter = ChatListFilter.all;
  Json? replyingTo;
  bool loading = true;
  bool sending = false;
  bool uploading = false;
  bool get conversationBlocked =>
      active?['blockedByMe'] == true || active?['blockedByOther'] == true;
  String targetLanguage = 'vi';
  bool autoTranslate = true;
  String appLocale = 'auto';
  Json? friendConnection;
  bool friendLoading = false;
  bool friendActionBusy = false;
  String friendError = '';
  String error = '';

  @override
  void initState() {
    super.initState();
    railSplitController = AnimationController(
      vsync: this,
      value: 1,
      duration: const Duration(milliseconds: 380),
      reverseDuration: const Duration(milliseconds: 380),
    );
    _refresh();
    scrollController.addListener(_syncMessageScroll);
    avatarScrollController.addListener(_checkConversationScroll);
    conversationListScrollController.addListener(_checkConversationScroll);
  }

  @override
  void didUpdateWidget(covariant ChatScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    final requested = widget.requestedConversation;
    if (requested != null &&
        (widget.openConversationRequest != oldWidget.openConversationRequest ||
            !identical(requested, oldWidget.requestedConversation)) &&
        requested['id'] != active?['id']) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && widget.requestedConversation == requested) {
          if (requested['type'] == 'group') {
            _openRoom(requested);
          } else {
            _loadMessages(requested);
          }
        }
      });
    }
    if (widget.resetRequest != oldWidget.resetRequest) {
      railNavigationGeneration++;
      railExpandedTarget = true;
      railSplitController.value = 1;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _closeConversation();
        setState(() {
          pickerGroup = null;
          channels = [];
          channelSearchController.clear();
        });
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
        await widget.api.request('GET', '/api/conversations?limit=25'),
      );
      if (!mounted) return;
      setState(() {
        data.sort(compareConversationRows);
        final freshIds = data.map((item) => item['id']).toSet();
        final merged = [
          ...data,
          for (final item in conversations)
            if (!freshIds.contains(item['id'])) item,
        ];
        merged.sort(compareConversationRows);
        conversations = merged;
        if (conversationOffset <= data.length) {
          hasMoreConversations = data.length == 25;
        }
        if (conversationOffset < data.length) {
          conversationOffset = data.length;
        }
        loading = false;
        error = '';
      });
      widget.onUnreadChanged?.call(
        conversations.fold<int>(
          0,
          (total, room) =>
              total + ((room['unreadCount'] as num?)?.toInt() ?? 0),
        ),
      );
      unawaited(_prefetchOlderGroups());
      if (active != null) {
        final replacement = conversations.where(
          (item) => item['id'] == active!['id'],
        );
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

  /// React prefetches older groups independently of the recent direct list.
  /// Preserve those groups on subsequent refreshes and never clear them just
  /// because a later page fetch fails.
  Future<void> _prefetchOlderGroups() async {
    final lastFetch = lastGroupPrefetch;
    if (groupPrefetchBusy ||
        (lastFetch != null &&
            DateTime.now().difference(lastFetch) <
                const Duration(minutes: 2))) {
      return;
    }
    groupPrefetchBusy = true;
    lastGroupPrefetch = DateTime.now();
    try {
      for (var offset = 0; offset < 2000; offset += 100) {
        final page = objects(
          await widget.api.request(
            'GET',
            '/api/conversations?type=group&limit=100&offset=$offset',
          ),
        );
        if (!mounted) return;
        final groups = page.where((item) => item['type'] == 'group').toList();
        if (groups.isNotEmpty) {
          setState(() {
            final newest = {for (final item in groups) item['id']: item};
            final ids = conversations.map((item) => item['id']).toSet();
            conversations = [
              for (final existing in conversations)
                newest[existing['id']] ?? existing,
              for (final group in groups)
                if (!ids.contains(group['id'])) group,
            ]..sort(compareConversationRows);
          });
        }
        if (page.length < 100) break;
      }
    } catch (_) {
      // A stale offline page must not erase the group's last known entry.
    } finally {
      groupPrefetchBusy = false;
    }
  }

  Future<void> _loadMoreConversations() async {
    if (conversationLoadingMore || !hasMoreConversations) return;
    conversationLoadingMore = true;
    if (mounted) setState(() {});
    try {
      final page = objects(
        await widget.api.request(
          'GET',
          '/api/conversations?limit=25&offset=$conversationOffset',
        ),
      );
      if (!mounted) return;
      setState(() {
        conversationOffset += page.length;
        hasMoreConversations = page.length == 25;
        final ids = conversations.map((item) => item['id']).toSet();
        conversations = [
          ...conversations,
          for (final item in page)
            if (!ids.contains(item['id'])) item,
        ]..sort(compareConversationRows);
      });
    } catch (error) {
      _show('Không tải thêm được hội thoại: $error');
    } finally {
      conversationLoadingMore = false;
      if (mounted) setState(() {});
    }
  }

  void _checkConversationScroll() {
    if (!hasMoreConversations || conversationLoadingMore) return;
    final avatarNearEnd =
        avatarScrollController.hasClients &&
        avatarScrollController.position.extentAfter < 120;
    final listNearEnd =
        conversationListScrollController.hasClients &&
        conversationListScrollController.position.extentAfter < 120;
    if (avatarNearEnd || listNearEnd) {
      unawaited(_loadMoreConversations());
    }
  }

  Future<void> _reconcile() async {
    await _refresh();
    if (active != null) {
      final room = active!;
      await _loadMessages(room, channelId: selectedChannelId);
      await _refreshPins(room);
    }
  }

  Future<void> _loadMessages(Json conversation, {int channelId = 0}) async {
    final changedConversation =
        active?['id'] != conversation['id'] || selectedChannelId != channelId;
    final generation = ++messageLoadGeneration;
    final wasAtLatest = !showLatest.value;
    bool current() =>
        mounted &&
        generation == messageLoadGeneration &&
        active?['id'] == conversation['id'] &&
        selectedChannelId == channelId;
    if (changedConversation) showLatest.value = false;
    setState(() {
      active = conversation;
      selectedChannelId = channelId;
      if (conversation['type'] == 'group') pickerGroup = conversation;
      if (changedConversation) {
        messages = [];
        unreadMessageId = null;
        initialTimelinePending = true;
        messageGapBefore = null;
        gapLoading = false;
        if (mentionRoomId != (conversation['id'] as num?)?.toInt()) {
          mentionMembers = [];
          mentionRoomId = null;
        }
        pinnedMessages = [];
        pendingAttachments = [];
        pinnedExpanded = false;
        searchingMessages = false;
        searchSenderId = null;
        searchDates = null;
        messageSearchController.clear();
        searchDebounce?.cancel();
        searchGeneration++;
        serverSearchResults = null;
        searchHasMore = false;
        searchLoading = false;
      }
      gapLoading = false;
      loading = changedConversation || messages.isEmpty;
      if (changedConversation) replyingTo = null;
      if (changedConversation) {
        friendConnection = null;
        friendLoading = conversation['type'] == 'direct';
        friendError = '';
      }
    });
    widget.onConversationChanged(true);
    if (conversation['type'] == 'group' &&
        mentionRoomId != (conversation['id'] as num?)?.toInt()) {
      unawaited(_loadMentionMembers(conversation));
    }
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
      final path =
          '/api/conversations/${conversation['id']}/messages'
          '?target=${Uri.encodeQueryComponent(target)}&channelId=$channelId';
      final recent = objects(
        await widget.api.request('GET', '$path&limit=200'),
      );
      if (!current()) return;
      final opening = initialTimelinePending;
      final snapshot = opening
          ? (recent.firstOrNull?['firstUnreadMessageId'] as num?)?.toInt()
          : unreadMessageId;
      final anchor = snapshot != null && snapshot > 0 ? snapshot : null;
      var data = recent;
      int? gap;
      if (anchor != null && !recent.any((m) => m['id'] == anchor)) {
        final windows = await Future.wait([
          widget.api.request('GET', '$path&limit=20&before=$anchor'),
          widget.api.request('GET', '$path&limit=80&after=${anchor - 1}'),
        ]);
        if (!current()) return;
        final around = [...objects(windows[0]), ...objects(windows[1])];
        if (around.isNotEmpty &&
            recent.length == 200 &&
            (around.last['id'] as num) < (recent.first['id'] as num)) {
          gap = (recent.first['id'] as num).toInt();
        }
        final byId = {
          for (final m in [...around, ...recent]) m['id']: m,
        };
        data = byId.values.toList()
          ..sort((a, b) => (a['id'] as num).compareTo(b['id'] as num));
      }
      for (final message in data) {
        if (message['translationLanguage'] != target) {
          message.remove('translatedText');
        }
      }
      if (!current()) return;
      setState(() {
        messages = data;
        unreadMessageId = anchor;
        initialTimelinePending = false;
        messageGapBefore = gap;
        targetLanguage = target;
        autoTranslate = shouldAutoTranslate;
        appLocale = locale;
        loading = false;
        error = '';
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!current()) return;
        if (!opening && wasAtLatest && !searchingMessages) {
          unawaited(_scrollToBottom(animate: false));
        }
        _syncMessageScroll();
      });
      try {
        final group = conversation['type'] == 'group';
        await widget.api.request(
          'POST',
          '/api/conversations/${conversation['id']}/${group ? 'channel-read' : 'read'}',
          group ? {'channelId': channelId} : <String, dynamic>{},
        );
      } catch (_) {
        // History remains visible even when a read receipt could not be sent.
      }
      if (!current()) return;
      if (changedConversation) {
        unawaited(_refreshPins(conversation));
      }
      if (shouldAutoTranslate) {
        final userId = widget.api.user['id'];
        await Future.wait([
          for (final message in data)
            if (message['senderId'] != userId &&
                (message['text']?.toString().trim().isNotEmpty ?? false) &&
                (message['translatedText']?.toString().isEmpty ?? true))
              _translate(message, target: target, silent: true),
        ]);
      }
    } catch (value) {
      if (current()) {
        setState(() {
          error = value.toString();
          loading = false;
        });
      }
    }
  }

  Future<void> _loadMentionMembers(Json conversation) async {
    final roomId = (conversation['id'] as num?)?.toInt();
    if (roomId == null || conversation['type'] != 'group') return;
    final sequence = ++mentionLoadSequence;
    mentionRoomId = roomId;
    try {
      final response = objects(
        await widget.api.request('GET', '/api/conversations/$roomId/members'),
      );
      if (!mounted ||
          sequence != mentionLoadSequence ||
          active?['id'] != roomId) {
        return;
      }
      setState(() {
        mentionMembers = [
          for (final item in response)
            if (item['id'] != widget.api.user['id'] &&
                item['username']?.toString().isNotEmpty == true)
              MentionCandidate.fromJson(item),
        ];
      });
    } catch (_) {
      if (mounted &&
          sequence == mentionLoadSequence &&
          active?['id'] == roomId) {
        mentionRoomId = null; // Permit retry when membership loads again.
      }
    }
  }

  MentionQuery? get _mentionQuery {
    if (active?['type'] != 'group' || mentionMembers.isEmpty || sending) {
      return null;
    }
    final cursor = messageController.selection;
    if (!cursor.isValid || !cursor.isCollapsed) return null;
    return findMentionQuery(messageController.text, cursor.baseOffset);
  }

  List<MentionCandidate> get _mentionCandidates {
    final query = _mentionQuery;
    if (query == null) return [];
    return matchMentionMembers(mentionMembers, messageController.text, query);
  }

  void _selectMention(MentionCandidate candidate) {
    final query = _mentionQuery;
    if (query == null) return;
    final result = insertMention(
      messageController.text,
      query,
      candidate.username,
    );
    if (result.text.length > 4000) return;
    messageController.value = TextEditingValue(
      text: result.text,
      selection: TextSelection.collapsed(offset: result.cursor),
    );
    messageFocus.requestFocus();
    setState(() {});
  }

  Widget _mentionSuggestions(List<MentionCandidate> matches) {
    if (matches.isEmpty) return const SizedBox.shrink();
    return Container(
      constraints: const BoxConstraints(maxHeight: 236),
      margin: const EdgeInsets.only(bottom: 7),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: socoLine),
        borderRadius: BorderRadius.circular(15),
        boxShadow: const [
          BoxShadow(
            color: Color(0x173C5064),
            blurRadius: 14,
            offset: Offset(0, -3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(15),
        child: Material(
          color: Colors.white,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: matches.length,
            itemBuilder: (context, index) {
              final member = matches[index];
              return ListTile(
                dense: true,
                visualDensity: VisualDensity.compact,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 0,
                ),
                leading: member.all
                    ? const CircleAvatar(
                        radius: 18,
                        backgroundColor: socoSoftBlue,
                        child: Text(
                          '@',
                          style: TextStyle(
                            color: socoBlue,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      )
                    : UserAvatar(
                        name: member.displayName,
                        username: member.username,
                        size: 36,
                        online: member.online,
                        fetchProfileImage: !widget.api.isDemo,
                      ),
                title: Text(
                  member.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  '@${member.username}',
                  style: const TextStyle(color: socoMuted, fontSize: 11),
                ),
                onTap: () => _selectMention(member),
              );
            },
          ),
        ),
      ),
    );
  }

  void _showMentionProfile(MentionCandidate member) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 5, 16, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              UserAvatar(
                name: member.displayName,
                username: member.username,
                size: 64,
                online: member.online,
                fetchProfileImage: !widget.api.isDemo,
              ),
              const SizedBox(height: 12),
              Text(
                member.displayName,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                '@${member.username}',
                style: const TextStyle(color: socoMuted),
              ),
              const SizedBox(height: 14),
              ListTile(
                leading: const Icon(Icons.chat_bubble_outline_rounded),
                title: const Text('Nhắn tin'),
                onTap: () async {
                  Navigator.pop(sheet);
                  try {
                    final room = object(
                      await widget.api.request(
                        'POST',
                        '/api/conversations/direct',
                        {'username': member.username},
                      ),
                    );
                    if (!mounted) return;
                    await _refresh();
                    await _openRoom(room);
                  } catch (error) {
                    _show(error.toString());
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
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

  bool railExpandedTarget = true;

  void _toggleAvatarSplit() {
    if (pickerGroup == null || active != null) return;
    railExpandedTarget = !railExpandedTarget;
    if (railExpandedTarget) {
      railSplitController.forward();
    } else {
      railSplitController.reverse();
    }
  }

  /// The picker shares one animated seam with the avatar dock, matching PWA.
  /// Keep both rails mounted and retain their scroll state while it moves.
  Future<void> _openRoom(Json room) async {
    final navigation = ++railNavigationGeneration;
    if (room['type'] != 'group') {
      if (pickerGroup != null && active == null && !railExpandedTarget) {
        railExpandedTarget = true;
        await railSplitController.forward();
        if (!mounted || navigation != railNavigationGeneration) return;
      }
      setState(() {
        pickerGroup = null;
        channels = [];
        generalChannel = null;
        channelSearchController.clear();
      });
      railExpandedTarget = true;
      railSplitController.value = 1;
      await _loadMessages(room);
      return;
    }

    if (pickerGroup?['id'] == room['id'] && active == null) {
      _toggleAvatarSplit();
      return;
    }

    if (pickerGroup != null && active == null && !railExpandedTarget) {
      railExpandedTarget = true;
      await railSplitController.forward();
      if (!mounted || navigation != railNavigationGeneration) return;
    }
    railExpandedTarget = false;
    setState(() {
      active = null;
      pickerGroup = room;
      channels = [];
      generalChannel = null;
      channelSearchController.clear();
      channelsLoading = true;
    });
    widget.onConversationChanged(false);
    // The fixed-width channel pane is already mounted when the seam starts.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && pickerGroup?['id'] == room['id'] && !railExpandedTarget) {
        railSplitController.reverse();
      }
    });
    try {
      final data = objects(
        await widget.api.request(
          'GET',
          '/api/conversations/${room['id']}/channels',
        ),
      );
      if (!mounted ||
          navigation != railNavigationGeneration ||
          pickerGroup?['id'] != room['id']) {
        return;
      }
      setState(() {
        generalChannel = data
            .where((item) => (item['id'] as num?)?.toInt() == 0)
            .firstOrNull;
        channels = data
            .where((item) => (item['id'] as num?)?.toInt() != 0)
            .toList();
        channelsLoading = false;
      });
    } catch (error) {
      if (!mounted ||
          navigation != railNavigationGeneration ||
          pickerGroup?['id'] != room['id']) {
        return;
      }
      setState(() => channelsLoading = false);
      _show('Không tải được danh sách kênh: $error');
    }
  }

  Future<void> _openChannel(int id) async {
    final group = pickerGroup;
    if (group == null) return;
    await _loadMessages(group, channelId: id);
  }

  Future<void> _refreshPins(Json room) async {
    try {
      final items = objects(
        await widget.api.request(
          'GET',
          '/api/conversations/${room['id']}/pins',
        ),
      );
      if (!mounted || active?['id'] != room['id']) return;
      setState(() => pinnedMessages = items);
    } catch (_) {
      // Preserve the last confirmed pins on transient network errors.
    }
  }

  Future<void> _toggleMessagePin(Json message) async {
    final room = active;
    final id = message['id'];
    if (room == null || id is! num || pinBusy) return;
    final pinned = pinnedMessages.any(
      (item) => (item['message'] is Map) && object(item['message'])['id'] == id,
    );
    setState(() => pinBusy = true);
    try {
      await widget.api.request(
        pinned ? 'DELETE' : 'PUT',
        '/api/messages/${id.toInt()}/pin',
      );
      if (!mounted || active?['id'] != room['id']) return;
      await _refreshPins(room);
      _show(pinned ? 'Đã bỏ ghim tin nhắn.' : 'Đã ghim tin nhắn.');
    } catch (error) {
      _show('Không cập nhật được ghim tin nhắn: $error');
    } finally {
      if (mounted) setState(() => pinBusy = false);
    }
  }

  Future<void> _toggleConversationPin(Json room) async {
    final id = room['id'];
    if (id is! num || pinBusy) return;
    final pinned = room['pinnedAt']?.toString().isNotEmpty == true;
    setState(() => pinBusy = true);
    try {
      await widget.api.request(
        pinned ? 'DELETE' : 'PUT',
        '/api/conversations/${id.toInt()}/pin',
      );
      await _refresh();
      if (mounted) {
        _show(
          pinned ? 'Đã bỏ ghim cuộc trò chuyện.' : 'Đã ghim cuộc trò chuyện.',
        );
      }
    } catch (error) {
      _show('Không cập nhật được ghim cuộc trò chuyện: $error');
    } finally {
      if (mounted) setState(() => pinBusy = false);
    }
  }

  Future<void> _toggleConversationNotifications(
    Json room, {
    int? muteMinutes,
  }) async {
    if (notificationBusy) return;
    final id = (room['id'] as num?)?.toInt();
    if (id == null) return;
    setState(() => notificationBusy = true);
    final nextMuted = muteMinutes != null || room['muted'] != true;
    try {
      var mentionNotifications = muteMinutes != null || !nextMuted;
      final group = room['type'] == 'group';
      if (group) {
        final current = object(
          await widget.api.request(
            'GET',
            '/api/conversations/$id/notification-settings',
          ),
        );
        if (current['mentionNotifications'] is! bool) {
          throw const ApiError('Không đọc được cấu hình @Tag của nhóm.');
        }
        // Muting normal messages does NOT mute explicit @mentions.
        mentionNotifications = current['mentionNotifications'] == true;
      }
      final result = object(
        await widget.api
            .request('PUT', '/api/conversations/$id/notification-settings', {
              'messageNotifications': muteMinutes != null || !nextMuted,
              'mentionNotifications': mentionNotifications,
              'muteMinutes': ?muteMinutes,
            }),
      );
      if (result['messageNotifications'] is! bool) {
        throw const ApiError('Backend chưa hỗ trợ cấu hình thông báo.');
      }
      if (muteMinutes != null && result['messageNotifications'] == true) {
        throw const ApiError(
          'Backend chưa hỗ trợ tắt thông báo theo thời hạn.',
        );
      }
      final muted = (group || muteMinutes != null)
          ? result['messageNotifications'] != true
          : result['messageNotifications'] != true &&
                result['mentionNotifications'] != true;
      if (!mounted) return;
      setState(() {
        for (final conversation in conversations) {
          if (conversation['id'] == id) {
            conversation['muted'] = muted;
          }
        }
        if (active?['id'] == id) active!['muted'] = muted;
      });
      _show(
        muted ? 'Đã tắt thông báo hội thoại.' : 'Đã bật thông báo hội thoại.',
      );
    } catch (error) {
      _show('Không cập nhật được thông báo: $error');
    } finally {
      if (mounted) setState(() => notificationBusy = false);
    }
  }

  Future<void> _classifyConversation(Json room) async {
    try {
      final categories = objects(
        await widget.api.request('GET', '/api/conversation-categories'),
      );
      if (!mounted) return;
      final selected = await showChatChoiceSheet<int>(
        context,
        title: 'Phân loại hội thoại',
        options: [
          for (final category in [
            <String, dynamic>{'id': 0, 'name': 'Chưa phân loại'},
            ...categories,
          ])
            ChatSheetChoice(
              value: (category['id'] as num).toInt(),
              label: category['name']?.toString() ?? '',
              leading: const Icon(Icons.sell_outlined, color: socoBlue),
            ),
        ],
        selected: ((room['categoryId'] ?? 0) as num).toInt(),
      );
      if (selected == null || !mounted) return;
      await widget.api.request(
        'PUT',
        '/api/conversations/${room['id']}/category',
        {'categoryId': selected == 0 ? null : selected},
      );
      if (!mounted) return;
      setState(() {
        for (final item in conversations) {
          if (item['id'] == room['id']) {
            item['categoryId'] = selected == 0 ? null : selected;
          }
        }
        if (active?['id'] == room['id']) {
          active!['categoryId'] = selected == 0 ? null : selected;
        }
      });
      _show('Đã cập nhật phân loại hội thoại.');
    } catch (error) {
      if (mounted) _show('Không cập nhật được phân loại: $error');
    }
  }

  Future<void> _setReadState(Json room, bool unread) async {
    try {
      await widget.api.request(
        'PUT',
        '/api/conversations/${room['id']}/read-state',
        {'unread': unread},
      );
      if (!mounted) return;
      setState(() {
        for (final item in conversations) {
          if (item['id'] == room['id']) {
            item['manualUnread'] = unread;
            if (!unread) item['unreadCount'] = 0;
          }
        }
      });
      await _refresh();
    } catch (error) {
      if (mounted) _show('Không cập nhật được trạng thái đọc: $error');
    }
  }

  Future<void> _chooseMuteDuration(Json room) async {
    final minutes = await showChatChoiceSheet<int>(
      context,
      title: 'Tắt thông báo theo thời hạn',
      options: [
        for (final duration in {
          60: '1 giờ',
          240: '4 giờ',
          1440: '24 giờ',
          10080: '7 ngày',
        }.entries)
          ChatSheetChoice(
            value: duration.key,
            label: duration.value,
            leading: const Icon(Icons.timer_outlined, color: socoBlue),
          ),
      ],
    );
    if (mounted && minutes != null) {
      await _toggleConversationNotifications(room, muteMinutes: minutes);
    }
  }

  Future<void> _roomActions(Json room) async {
    final pinned = room['pinnedAt']?.toString().isNotEmpty == true;
    final hasUnread =
        room['manualUnread'] == true ||
        ((room['unreadCount'] as num?) ?? 0) > 0;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: ConversationAvatarView(
                room: room,
                size: 42,
                fetchProfileImage: !widget.api.isDemo,
              ),
              title: Text(room['name']?.toString() ?? 'Cuộc trò chuyện'),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.chat_bubble_outline_rounded),
              title: const Text('Mở cuộc trò chuyện'),
              onTap: () {
                Navigator.pop(sheetContext);
                _openRoom(room);
              },
            ),
            ListTile(
              enabled: !notificationBusy,
              leading: Icon(
                room['muted'] == true
                    ? Icons.notifications_active_outlined
                    : Icons.notifications_off_outlined,
              ),
              title: Text(
                room['muted'] == true
                    ? 'Bật thông báo hội thoại'
                    : 'Tắt thông báo hội thoại',
              ),
              onTap: () {
                Navigator.pop(sheetContext);
                _toggleConversationNotifications(room);
              },
            ),
            if (room['muted'] != true)
              ListTile(
                leading: const Icon(Icons.timer_outlined),
                title: const Text('Tắt theo thời hạn'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _chooseMuteDuration(room);
                },
              ),
            ListTile(
              leading: Icon(
                hasUnread
                    ? Icons.mark_email_read_outlined
                    : Icons.mark_email_unread_outlined,
              ),
              title: Text(hasUnread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'),
              onTap: () {
                Navigator.pop(sheetContext);
                _setReadState(room, !hasUnread);
              },
            ),
            ListTile(
              enabled: !pinBusy,
              leading: Icon(
                pinned ? Icons.push_pin_outlined : Icons.push_pin_rounded,
              ),
              title: Text(pinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'),
              onTap: () {
                Navigator.pop(sheetContext);
                _toggleConversationPin(room);
              },
            ),
            ListTile(
              leading: const Icon(Icons.sell_outlined),
              title: const Text('Phân loại hội thoại'),
              onTap: () {
                Navigator.pop(sheetContext);
                _classifyConversation(room);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _pinnedPanel() {
    final pins = pinnedMessages.where((item) {
      final raw = item['message'];
      if (raw is! Map<String, dynamic>) return false;
      return (raw['channelId'] as num?)?.toInt() == selectedChannelId ||
          (selectedChannelId == 0 && raw['channelId'] == null);
    }).toList();
    if (pins.isEmpty) return const SizedBox.shrink();
    final visible = pinnedExpanded ? pins : pins.take(1).toList();
    return Material(
      color: const Color(0xFFF8FAFF),
      child: Column(
        children: [
          for (final pin in visible)
            ListTile(
              dense: true,
              leading: const Icon(
                Icons.push_pin_rounded,
                color: socoBlue,
                size: 19,
              ),
              title: Text(
                object(pin['message'])['text']?.toString().isNotEmpty == true
                    ? object(pin['message'])['text'].toString()
                    : 'Tin nhắn có tệp đính kèm',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: IconButton(
                tooltip: 'Bỏ ghim',
                onPressed: pinBusy
                    ? null
                    : () => _toggleMessagePin(object(pin['message'])),
                icon: const Icon(Icons.close_rounded, size: 19),
              ),
            ),
          if (pins.length > 1)
            TextButton(
              onPressed: () => setState(() => pinnedExpanded = !pinnedExpanded),
              child: Text(
                pinnedExpanded
                    ? 'Thu gọn'
                    : 'Xem tất cả ${pins.length} tin đã ghim',
              ),
            ),
        ],
      ),
    );
  }

  void _closeConversation() {
    setState(() {
      active = null;
      messageLoadGeneration++;
      unreadMessageId = null;
      messageGapBefore = null;
      messages = [];
      pinnedMessages = [];
      pendingAttachments = [];
      replyingTo = null;
    });
    widget.onConversationChanged(false);
  }

  Future<void> _send({List<Json> attachments = const []}) async {
    final text = messageController.text.trim();
    final outgoingAttachments = [...pendingAttachments, ...attachments];
    if (active == null ||
        conversationBlocked ||
        sending ||
        uploading ||
        (text.isEmpty && outgoingAttachments.isEmpty)) {
      return;
    }
    final body = <String, dynamic>{
      'text': text,
      'clientId': DateTime.now().microsecondsSinceEpoch.toString(),
      if (active?['type'] == 'group') 'channelId': selectedChannelId,
      if (replyingTo != null) 'replyToMessageId': replyingTo!['id'],
      if (outgoingAttachments.isNotEmpty) 'attachments': outgoingAttachments,
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
        pendingAttachments = [];
        replyingTo = null;
      });
      // Scroll after the new bubble has been laid out, not against the old
      // maxScrollExtent. Otherwise freshly sent mentions can sit under the composer.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _scrollToBottom();
      });
      await _refresh();
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _pickAttachment({bool mediaOnly = false}) async {
    final roomId = active?['id'];
    final channelId = selectedChannelId;
    if (roomId == null || uploading || sending) return;
    final remaining = 10 - pendingAttachments.length;
    if (remaining <= 0) {
      _show('Một tin nhắn có tối đa 10 tệp đính kèm.');
      return;
    }
    final files = await FilePicker.pickFiles(
      type: mediaOnly ? FileType.media : FileType.any,
    );
    if (files.isEmpty ||
        !mounted ||
        active?['id'] != roomId ||
        selectedChannelId != channelId) {
      return;
    }
    setState(() => uploading = true);
    try {
      final staged = <Json>[];
      for (final file in files.take(remaining)) {
        final bytes = await file.readAsBytes();
        staged.add(
          await widget.api.upload(
            'chat',
            file.name,
            lookupMimeType(file.name, headerBytes: bytes) ??
                'application/octet-stream',
            bytes,
          ),
        );
      }
      if (mounted &&
          active?['id'] == roomId &&
          selectedChannelId == channelId) {
        setState(() => pendingAttachments.addAll(staged));
      }
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
        await Future.wait([
          for (final message in messages)
            if (message['senderId'] != widget.api.user['id'] &&
                (message['text']?.toString().trim().isNotEmpty ?? false) &&
                (message['translatedText']?.toString().isEmpty ?? true))
              _translate(message, target: targetLanguage, silent: true),
        ]);
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

  Future<void> _forwardMessage(Json message) async {
    var searchQuery = '';
    var busy = false;
    var failure = '';
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, refreshSheet) {
          final needle = searchQuery.trim().toLowerCase();
          final destinations = conversations
              .where(
                (room) =>
                    room['blockedByMe'] != true &&
                    room['blockedByOther'] != true &&
                    (room['name']?.toString() ?? '').toLowerCase().contains(
                      needle,
                    ),
              )
              .toList();

          Future<void> send(Json destination) async {
            if (busy || message['deleted'] == true) return;
            refreshSheet(() {
              busy = true;
              failure = '';
            });
            try {
              final attachments = <Json>[];
              for (final item in objects(message['attachments'])) {
                final bytes = await widget.api.downloadForForward(item);
                final name = item['name']?.toString() ?? 'attachment';
                final type =
                    item['contentType']?.toString() ??
                    lookupMimeType(name, headerBytes: bytes) ??
                    'application/octet-stream';
                attachments.add(
                  await widget.api.upload('chat', name, type, bytes),
                );
              }
              await widget.api.request(
                'POST',
                '/api/conversations/${destination['id']}/messages',
                {
                  'clientId': DateTime.now().microsecondsSinceEpoch.toString(),
                  'text': message['text']?.toString() ?? '',
                  'forwarded': true,
                  'attachments': attachments,
                },
              );
              if (!sheetContext.mounted) return;
              Navigator.pop(sheetContext);
              _show('Đã chuyển tiếp đến ${destination['name']}.');
              unawaited(_refresh());
            } catch (error) {
              if (sheetContext.mounted) {
                refreshSheet(() => failure = error.toString());
              }
            } finally {
              if (sheetContext.mounted) refreshSheet(() => busy = false);
            }
          }

          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(sheetContext).bottom
                  .clamp(0.0, MediaQuery.sizeOf(sheetContext).height * .32)
                  .toDouble(),
            ),
            child: SizedBox(
              height:
                  (MediaQuery.sizeOf(sheetContext).height -
                      MediaQuery.viewInsetsOf(sheetContext).bottom
                          .clamp(
                            0.0,
                            MediaQuery.sizeOf(sheetContext).height * .32,
                          )
                          .toDouble()) *
                  .7,
              child: Column(
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 18, vertical: 7),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Chuyển tiếp tin nhắn',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: socoNavy,
                          fontSize: 18,
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 3, 18, 12),
                    child: Text(
                      message['text']?.toString().isNotEmpty == true
                          ? message['text'].toString()
                          : 'Tin nhắn có tệp đính kèm',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: socoMuted),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: TextField(
                      autofocus: true,
                      onChanged: (value) =>
                          refreshSheet(() => searchQuery = value),
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search_rounded),
                        hintText: 'Tìm cá nhân hoặc nhóm',
                      ),
                    ),
                  ),
                  if (failure.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(
                        failure,
                        style: const TextStyle(color: Colors.redAccent),
                      ),
                    ),
                  if (busy) const LinearProgressIndicator(minHeight: 2),
                  Expanded(
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 7),
                      itemCount: destinations.length,
                      itemBuilder: (_, index) {
                        final room = destinations[index];
                        return ListTile(
                          enabled: !busy,
                          leading: UserAvatar(
                            name: room['name']?.toString() ?? '',
                            username: room['otherUsername']?.toString(),
                            group: room['type'] == 'group',
                            size: 43,
                            fetchProfileImage: !widget.api.isDemo,
                          ),
                          title: Text(
                            room['name']?.toString() ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            room['type'] == 'group' ? 'Nhóm' : 'Cá nhân',
                          ),
                          trailing: const Icon(
                            Icons.arrow_forward_rounded,
                            color: socoBlue,
                          ),
                          onTap: () => send(room),
                        );
                      },
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
              leading: const Icon(Icons.push_pin_outlined),
              title: const Text('Ghim / Bỏ ghim tin nhắn'),
              onTap: () {
                Navigator.pop(context);
                _toggleMessagePin(message);
              },
            ),
            ListTile(
              leading: const Icon(Icons.forward_rounded),
              title: const Text('Chuyển tiếp'),
              onTap: () {
                Navigator.pop(context);
                _forwardMessage(message);
              },
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
    await _openRoom(room);
  }

  void _syncMessageScroll() {
    if (!mounted || !scrollController.hasClients) return;
    final position = scrollController.position;
    if (!position.hasContentDimensions) return;
    showLatest.value =
        (centeredTimeline ? position.extentAfter : position.extentBefore) >= 96;
  }

  Future<void> _scrollToBottom({bool animate = true}) async {
    if (!scrollController.hasClients) return;
    final generation = messageLoadGeneration;
    for (var pass = 0; pass < 3; pass++) {
      if (!mounted ||
          generation != messageLoadGeneration ||
          !scrollController.hasClients) {
        return;
      }
      final position = scrollController.position;
      final bottom = centeredTimeline
          ? position.maxScrollExtent
          : position.minScrollExtent;
      if ((position.pixels - bottom).abs() < 1) break;
      if (animate && pass == 0) {
        await scrollController.animateTo(
          bottom,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      } else {
        scrollController.jumpTo(bottom);
      }
      await WidgetsBinding.instance.endOfFrame;
    }
    _syncMessageScroll();
  }

  Future<void> _loadMessageGap() async {
    final before = messageGapBefore;
    final room = active;
    if (before == null || room == null || gapLoading) return;
    final generation = messageLoadGeneration;
    final channel = selectedChannelId;
    setState(() => gapLoading = true);
    try {
      final data = objects(
        await widget.api.request(
          'GET',
          '/api/conversations/${room['id']}/messages?target=${Uri.encodeQueryComponent(targetLanguage)}&channelId=$channel&limit=80&before=$before',
        ),
      );
      if (!mounted || generation != messageLoadGeneration) return;
      final lower = messages.where((m) => (m['id'] as num) < before).lastOrNull;
      final next = data.firstOrNull?['id'] as num?;
      final byId = {
        for (final m in [...data, ...messages]) m['id']: m,
      };
      setState(() {
        messages = byId.values.toList()
          ..sort((a, b) => (a['id'] as num).compareTo(b['id'] as num));
        messageGapBefore =
            data.length == 80 &&
                next != null &&
                lower != null &&
                next > (lower['id'] as num)
            ? next.toInt()
            : null;
      });
    } catch (_) {
      if (mounted && generation == messageLoadGeneration) {
        _show('Không tải được tin nhắn ở giữa');
      }
    } finally {
      if (mounted && generation == messageLoadGeneration) {
        setState(() => gapLoading = false);
      }
    }
  }

  void _show(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _focusConversationSearch() async {
    // Keep the group picker mounted while the shared avatar boundary expands.
    if (pickerGroup != null && active == null && !railExpandedTarget) {
      railExpandedTarget = true;
      await railSplitController.forward();
    }
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) chatSearchFocus.requestFocus();
    });
  }

  Widget _mobileRailMenu() => PopupMenuButton<String>(
    key: const ValueKey('mobile-chat-menu'),
    tooltip: 'Menu hội thoại',
    icon: const Icon(Icons.menu_rounded, size: 26, color: socoBlue),
    onSelected: (choice) {
      switch (choice) {
        case 'search':
          unawaited(_focusConversationSearch());
        case 'create':
          unawaited(_newChat());
        case 'toggle':
          _toggleAvatarSplit();
        case 'all':
        case 'unread':
        case 'groups':
          setState(() {
            roomFilter = switch (choice) {
              'unread' => ChatListFilter.unread,
              'groups' => ChatListFilter.groups,
              _ => ChatListFilter.all,
            };
          });
      }
    },
    itemBuilder: (context) => [
      const PopupMenuItem(
        enabled: false,
        child: Text(
          'Tùy chọn hội thoại',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      const PopupMenuItem(
        value: 'search',
        child: ListTile(
          dense: true,
          leading: Icon(Icons.search_rounded),
          title: Text('Tìm hội thoại'),
        ),
      ),
      const PopupMenuDivider(),
      const PopupMenuItem(
        enabled: false,
        child: Text('Phân loại', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      for (final filter in [
        (value: 'all', label: 'Tất cả'),
        (value: 'unread', label: 'Chưa đọc'),
        (value: 'groups', label: 'Nhóm'),
      ])
        PopupMenuItem(
          value: filter.value,
          child: Row(
            children: [
              Icon(
                roomFilter.name == filter.value
                    ? Icons.check_circle_rounded
                    : Icons.circle_outlined,
                size: 18,
                color: socoBlue,
              ),
              const SizedBox(width: 12),
              Text(filter.label),
            ],
          ),
        ),
      const PopupMenuDivider(),
      const PopupMenuItem(
        value: 'create',
        child: ListTile(
          dense: true,
          leading: Icon(Icons.add_comment_outlined),
          title: Text('Tạo cuộc trò chuyện'),
        ),
      ),
      if (pickerGroup != null && active == null)
        PopupMenuItem(
          value: 'toggle',
          child: ListTile(
            dense: true,
            leading: const Icon(Icons.view_sidebar_outlined),
            title: Text(
              railExpandedTarget ? 'Thu gọn cột avatar' : 'Mở rộng cột avatar',
            ),
          ),
        ),
    ],
  );

  Future<void> _reloadGroupChannels(int roomId) async {
    final data = objects(
      await widget.api.request('GET', '/api/conversations/$roomId/channels'),
    );
    if (!mounted || pickerGroup?['id'] != roomId) return;
    setState(() {
      generalChannel = data
          .where((item) => (item['id'] as num?)?.toInt() == 0)
          .firstOrNull;
      channels = data
          .where((item) => (item['id'] as num?)?.toInt() != 0)
          .toList();
    });
  }

  Future<void> _editChannelField(Json room, Json channel, String field) async {
    final channelId = (channel['id'] as num?)?.toInt();
    final roomId = (room['id'] as num?)?.toInt();
    if (roomId == null || channelId == null || channelId == 0) return;
    final name = field == 'name';
    final controller = TextEditingController(
      text: channel[field]?.toString() ?? '',
    );
    final value = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(name ? 'Đổi tên kênh' : 'Sửa chủ đề kênh'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: name ? 80 : 500,
          decoration: InputDecoration(
            labelText: name ? 'Tên kênh' : 'Chủ đề kênh',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(dialogContext, controller.text.trim()),
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value == null ||
        (name && value.isEmpty) ||
        value == channel[field]?.toString()) {
      return;
    }
    try {
      await widget.api
          .request('PATCH', '/api/conversations/$roomId/channels/$channelId', {
            'name': name ? value : channel['name'],
            'description': name ? channel['description'] ?? '' : value,
          });
      await _reloadGroupChannels(roomId);
      _show(name ? 'Đã đổi tên kênh.' : 'Đã sửa chủ đề kênh.');
    } catch (error) {
      _show('Không cập nhật được kênh: $error');
    }
  }

  Future<void> _toggleChannelNotifications(Json room, Json channel) async {
    final roomId = (room['id'] as num?)?.toInt();
    final channelId = (channel['id'] as num?)?.toInt();
    if (roomId == null || channelId == null) return;
    try {
      final current = object(
        await widget.api.request(
          'GET',
          '/api/conversations/$roomId/channels/$channelId/notifications',
        ),
      );
      if (current['muted'] is! bool) {
        throw const ApiError('Không đọc được trạng thái thông báo kênh.');
      }
      final muted = current['muted'] != true;
      await widget.api.request(
        'PUT',
        '/api/conversations/$roomId/channels/$channelId/notifications',
        {'muted': muted},
      );
      await _reloadGroupChannels(roomId);
      _show(muted ? 'Đã tắt thông báo kênh.' : 'Đã bật thông báo kênh.');
    } catch (error) {
      _show('Không cập nhật được thông báo kênh: $error');
    }
  }

  Future<void> _deleteChannel(Json room, Json channel) async {
    final roomId = (room['id'] as num?)?.toInt();
    final channelId = (channel['id'] as num?)?.toInt();
    if (roomId == null || channelId == null || channelId == 0) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xóa kênh?'),
        content: Text(
          'Xóa kênh "${channel['name']}"? Thành viên sẽ không còn thấy kênh này.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Xóa kênh', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await widget.api.request(
        'DELETE',
        '/api/conversations/$roomId/channels/$channelId',
      );
      if (!mounted) return;
      _closeConversation();
      setState(() => selectedChannelId = 0);
      await _reloadGroupChannels(roomId);
      _show('Đã xóa kênh.');
    } catch (error) {
      _show('Không xóa được kênh: $error');
    }
  }

  Future<void> _createGroupChannel(Json room) async {
    final roomId = (room['id'] as num?)?.toInt();
    if (roomId == null) return;
    final name = TextEditingController();
    final topic = TextEditingController();
    final details = await showDialog<Map<String, String>>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Tạo kênh hội thoại'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              key: const ValueKey('channel-create-name'),
              controller: name,
              autofocus: true,
              maxLength: 80,
              decoration: const InputDecoration(labelText: 'Tên kênh'),
            ),
            TextField(
              key: const ValueKey('channel-create-topic'),
              controller: topic,
              maxLength: 500,
              decoration: const InputDecoration(labelText: 'Chủ đề kênh'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () {
              if (name.text.trim().isEmpty) return;
              Navigator.pop(dialogContext, {
                'name': name.text.trim(),
                'description': topic.text.trim(),
              });
            },
            child: const Text('Tạo kênh'),
          ),
        ],
      ),
    );
    name.dispose();
    topic.dispose();
    if (details == null || !mounted || active?['id'] != roomId) return;
    try {
      final created = object(
        await widget.api.request(
          'POST',
          '/api/conversations/$roomId/channels',
          details,
        ),
      );
      final id = (created['id'] as num?)?.toInt();
      await _reloadGroupChannels(roomId);
      if (!mounted || active?['id'] != roomId) return;
      if (id != null) {
        await _loadMessages(room, channelId: id);
      }
      _show('Đã tạo kênh hội thoại.');
    } catch (error) {
      _show('Không tạo được kênh: $error');
    }
  }

  Future<void> _clearConversationHistory(Json room) async {
    final roomId = (room['id'] as num?)?.toInt();
    if (roomId == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xóa lịch sử trò chuyện?'),
        content: const Text(
          'Toàn bộ tin nhắn trong lịch sử của bạn sẽ bị xóa. '
          'Thao tác này không thể hoàn tác.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text(
              'Xóa lịch sử',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await widget.api.request('DELETE', '/api/conversations/$roomId/history');
      if (!mounted) return;
      if (active?['id'] == roomId) {
        setState(() {
          messages = [];
          pinnedMessages = [];
          replyingTo = null;
        });
      }
      await _refresh();
      _show('Đã xóa lịch sử trò chuyện.');
    } catch (error) {
      _show('Không xóa được lịch sử trò chuyện: $error');
    }
  }

  Future<void> _editChatNickname(Json room) async {
    final id = room['otherUserId'];
    if (id == null) return;
    try {
      final contacts = objects(
        await widget.api.request('GET', '/api/contacts'),
      );
      final matches = contacts.where((item) => item['id'] == id);
      if (!mounted) return;
      if (matches.isEmpty) {
        _show('Chỉ có thể đặt tên gợi nhớ cho bạn bè.');
        return;
      }
      final contact = matches.first;
      final result = await showContactMetadataEditor(
        context,
        field: 'nickname',
        initialValue: contact['nickname']?.toString() ?? '',
      );
      if (!mounted || result == null) return;
      await widget.api.request('PUT', '/api/contacts/$id', {
        'nickname': result,
        'note': contact['note'] ?? '',
        'favorite': contact['favorite'] == true,
      });
      if (!mounted) return;
      final displayName = result.isEmpty
          ? contact['displayName']?.toString() ?? room['otherUsername']
          : result;
      setState(() {
        for (final item in conversations) {
          if (item['id'] == room['id']) {
            item['name'] = displayName;
          }
        }
        if (active?['id'] == room['id']) {
          active!['name'] = displayName;
        }
      });
      _show('Đã cập nhật tên gợi nhớ.');
    } catch (error) {
      if (mounted) _show('Không lưu được tên gợi nhớ: $error');
    }
  }

  Future<void> _showConversationExtras(Json room, {required bool board}) async {
    try {
      final data = await widget.api.request(
        'GET',
        board
            ? '/api/conversations/${room['id']}/activities'
            : '/api/contacts/${room['otherUserId']}/common-groups',
      );
      final items = objects(board ? object(data)['activities'] : data);
      if (!mounted) return;
      String filter = 'all';
      await showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (ctx) => StatefulBuilder(
          builder: (ctx, update) => SafeArea(
            child: FractionallySizedBox(
              heightFactor: .72,
              child: Column(
                children: [
                  ChatSheetHeader(
                    title: board ? 'Bảng tin nhóm' : 'Nhóm chung',
                    onClose: () => Navigator.pop(ctx),
                  ),
                  if (board)
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Row(
                        children: [
                          for (final item in {
                            'all': 'Tất cả',
                            'poll': 'Bình chọn',
                            'note': 'Ghi chú',
                            'reminder': 'Nhắc hẹn',
                          }.entries)
                            Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: ChoiceChip(
                                label: Text(item.value),
                                selected: filter == item.key,
                                onSelected: (_) =>
                                    update(() => filter = item.key),
                              ),
                            ),
                        ],
                      ),
                    ),
                  Expanded(
                    child:
                        items
                            .where(
                              (item) =>
                                  filter == 'all' || item['kind'] == filter,
                            )
                            .isEmpty
                        ? EmptyState(
                            icon: board
                                ? Icons.assignment_outlined
                                : Icons.groups_outlined,
                            title: board
                                ? 'Chưa có hoạt động'
                                : 'Không có nhóm chung',
                            description: board
                                ? 'Các bình chọn, ghi chú và nhắc hẹn sẽ hiển thị tại đây.'
                                : 'Những nhóm cả hai cùng tham gia sẽ hiển thị tại đây.',
                          )
                        : ListView(
                            children: [
                              for (final item in items.where(
                                (item) =>
                                    filter == 'all' || item['kind'] == filter,
                              ))
                                ListTile(
                                  leading: board
                                      ? Icon(switch (item['kind']) {
                                          'poll' => Icons.poll_outlined,
                                          'reminder' => Icons.event_outlined,
                                          _ => Icons.description_outlined,
                                        }, color: socoBlue)
                                      : ConversationAvatarView(
                                          room: {...item, 'type': 'group'},
                                          size: 42,
                                          fetchProfileImage: !widget.api.isDemo,
                                        ),
                                  title: Text(
                                    (board ? item['title'] : item['name'])
                                            ?.toString() ??
                                        '',
                                  ),
                                  subtitle: Text(
                                    board
                                        ? (item['body']?.toString() ?? '')
                                        : '${item['memberCount']} thành viên',
                                  ),
                                  trailing: board && item['pinnedAt'] != null
                                      ? const Icon(Icons.push_pin_outlined)
                                      : null,
                                ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    } catch (error) {
      if (mounted) _show('Không tải được dữ liệu: $error');
    }
  }

  static const _wallpapers = <String, Color?>{
    'default': null,
    'blue': Color(0xFFDCECFF),
    'green': Color(0xFFDCEEE2),
    'rose': Color(0xFFF9E3EB),
    'sand': Color(0xFFF7ECDA),
  };
  Future<void> _chooseChatWallpaper(Json room) async {
    final choice = await showChatChoiceSheet<String>(
      context,
      title: 'Đổi hình nền hội thoại',
      selected: room['wallpaper']?.toString() ?? 'default',
      options: [
        for (final item in {
          'default': 'Mặc định',
          'blue': 'Xanh dương',
          'green': 'Xanh lá',
          'rose': 'Hồng',
          'sand': 'Kem',
        }.entries)
          ChatSheetChoice(
            value: item.key,
            label: item.value,
            leading: CircleAvatar(
              backgroundColor: _wallpapers[item.key] ?? Colors.grey.shade100,
            ),
          ),
      ],
    );
    if (!mounted || choice == null) return;
    try {
      await widget.api.request(
        'PUT',
        '/api/conversations/${room['id']}/wallpaper',
        {'wallpaper': choice},
      );
      if (!mounted) return;
      setState(() {
        for (final item in conversations) {
          if (item['id'] == room['id']) {
            item['wallpaper'] = choice;
          }
        }
        if (active?['id'] == room['id']) {
          active!['wallpaper'] = choice;
        }
      });
      _show('Đã đổi hình nền riêng của bạn.');
    } catch (error) {
      if (mounted) _show('Không đổi được hình nền: $error');
    }
  }

  Future<void> _showConversationInformation(Json room) async {
    final roomId = (room['id'] as num?)?.toInt();
    final isGroup = room['type'] == 'group';
    final channelId = isGroup ? selectedChannelId : 0;
    final channel = channelId == 0
        ? generalChannel
        : channels
              .where((item) => (item['id'] as num?)?.toInt() == channelId)
              .firstOrNull;
    var canManageChannel = false;
    var canCreateChannel = false;
    if (isGroup && roomId != null) {
      try {
        final members = objects(
          await widget.api.request('GET', '/api/conversations/$roomId/members'),
        );
        final own = members
            .where((member) => member['id'] == widget.api.user['id'])
            .firstOrNull;
        canManageChannel = own?['role'] == 'owner' || own?['role'] == 'admin';
        canCreateChannel = own?['role'] == 'owner';
      } catch (_) {
        // Non-mutating actions must remain usable offline or when
        // membership information is temporarily unavailable.
      }
    }
    if (!mounted || active?['id'] != room['id']) return;
    final action = await showChatInformationSheet(
      context,
      conversation: room,
      channelId: channelId,
      selectedChannel: channel,
      isDemo: widget.api.isDemo,
      canManageChannel: canManageChannel,
      canCreateChannel: canCreateChannel,
    );
    if (!mounted || active?['id'] != room['id'] || action == null) return;
    switch (action) {
      case ChatInfoAction.shared:
        await showSharedContent(
          context,
          widget.api,
          room,
          channelId: channelId,
        );
      case ChatInfoAction.notifications:
        await _toggleConversationNotifications(room);
      case ChatInfoAction.wallpaper:
        await _chooseChatWallpaper(room);
      case ChatInfoAction.nickname:
        await _editChatNickname(room);
      case ChatInfoAction.commonGroups:
        await _showConversationExtras(room, board: false);
      case ChatInfoAction.groupBoard:
        await _showConversationExtras(room, board: true);
      case ChatInfoAction.manageGroup:
        await _openGroupSettings(room);
      case ChatInfoAction.createChannel:
        if (canCreateChannel) await _createGroupChannel(room);
      case ChatInfoAction.clearHistory:
        if (!isGroup) await _clearConversationHistory(room);
      case ChatInfoAction.renameChannel:
      case ChatInfoAction.editChannelTopic:
        if (channel != null && canManageChannel) {
          await _editChannelField(
            room,
            channel,
            action == ChatInfoAction.renameChannel ? 'name' : 'description',
          );
        }
      case ChatInfoAction.channelNotifications:
        if (channel != null) await _toggleChannelNotifications(room, channel);
      case ChatInfoAction.deleteChannel:
        if (channel != null && canManageChannel) {
          await _deleteChannel(room, channel);
        }
    }
  }

  Future<void> _openGroupSettings(Json room) async {
    final left = await showGroupSettings(context, widget.api, room);
    if (left) {
      railNavigationGeneration++;
      railExpandedTarget = true;
      railSplitController.value = 1;
      _closeConversation();
      setState(() {
        pickerGroup = null;
        channels = [];
      });
    }
    await _refresh();
  }

  @override
  void dispose() {
    searchDebounce?.cancel();
    messageController.dispose();
    messageFocus.dispose();
    chatSearchController.dispose();
    chatSearchFocus.dispose();
    channelSearchController.dispose();
    messageSearchController.dispose();
    scrollController.removeListener(_syncMessageScroll);
    scrollController.dispose();
    showLatest.dispose();
    avatarScrollController.dispose();
    conversationListScrollController.dispose();
    railSplitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<int>>(realtimeRevisionProvider, (previous, next) {
      if (next.hasValue && next.value != previous?.value) {
        unawaited(_reconcile());
      }
    });
    final filtered = filterConversations(
      conversations,
      query: chatSearchController.text.isNotEmpty
          ? chatSearchController.text
          : widget.query,
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        final split = constraints.maxWidth >= 760;
        if (!split && active != null) return _conversationPane();
        if (!split) {
          final width = constraints.maxWidth;
          final compactRailWidth = width <= 350 ? 52.0 : 56.0;
          return MobileAvatarChannelSplit(
            animation: railSplitController,
            width: width,
            compactRailWidth: compactRailWidth,
            showChannels: pickerGroup != null,
            avatarRail: _mobileConversationRail(filtered),
            channelPicker: pickerGroup != null ? _mobileChannelList() : null,
          );
        }
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

  /// One-column mobile inbox: the same entry view shown by the PWA.
  /// Groups open the existing channel picker; direct contacts open their chat.
  Widget _mobileConversationRail(List<Json> filtered) {
    final visible = filterConversations(filtered, filter: roomFilter);

    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.depth == 0) {
          widget.onMobileScroll?.call(notification, 'chat-inbox');
        }
        return false;
      },
      child: MobileReverseScrollRegion(
        onReverseScroll: widget.onMobileReverseScroll,
        child: Material(
          color: Colors.white,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(10, 9, 11, 8),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(bottom: BorderSide(color: socoLine)),
                ),
                child: Row(
                  children: [
                    _mobileRailMenu(),
                    const SizedBox(width: 8),
                    Expanded(
                      child: SizedBox(
                        height: 32,
                        child: TextField(
                          key: const ValueKey('mobile-chat-search'),
                          controller: chatSearchController,
                          focusNode: chatSearchFocus,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            hintText: 'Tìm hội thoại...',
                            hintStyle: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF8C96AC),
                            ),
                            prefixIcon: const Icon(
                              Icons.search_rounded,
                              color: Color(0xFF8293B1),
                              size: 18,
                            ),
                            suffixIcon: chatSearchController.text.isNotEmpty
                                ? IconButton(
                                    tooltip: 'Xóa tìm kiếm',
                                    icon: const Icon(
                                      Icons.close_rounded,
                                      size: 18,
                                    ),
                                    onPressed: () =>
                                        setState(chatSearchController.clear),
                                  )
                                : null,
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              vertical: 5,
                            ),
                            filled: true,
                            fillColor: const Color(0xFFF4F6FD),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(
                                color: Color(0xFFDCE4F4),
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(
                                color: Color(0xFFDCE4F4),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: loading && conversations.isEmpty
                    ? const Center(child: CircularProgressIndicator())
                    : error.isNotEmpty && conversations.isEmpty
                    ? EmptyState(
                        icon: Icons.cloud_off_outlined,
                        title: 'Không tải được hội thoại',
                        description: error,
                        action: FilledButton(
                          onPressed: _refresh,
                          child: const Text('Thử lại'),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _refresh,
                        child: ListView.builder(
                          key: const ValueKey('mobile-avatar-rail'),
                          controller: avatarScrollController,
                          // Clamp overscroll on both platforms: only the inbox
                          // viewport moves, never its search header or bottom tabs.
                          physics: const ClampingScrollPhysics(
                            parent: AlwaysScrollableScrollPhysics(),
                          ),
                          // The floating footer overlays the list by 72px.
                          // Reserve its clearance INSIDE the scroller, not as an
                          // additional blank app-shell/footer strip.
                          padding: const EdgeInsets.fromLTRB(5, 6, 5, 104),
                          itemCount: visible.isEmpty
                              ? 1
                              : visible.length + (hasMoreConversations ? 1 : 0),
                          itemBuilder: (context, index) {
                            if (visible.isEmpty) {
                              return const Padding(
                                padding: EdgeInsets.only(top: 100),
                                child: EmptyState(
                                  icon: Icons.forum_outlined,
                                  title: 'Không có hội thoại',
                                  description: 'Thử tìm kiếm theo tên.',
                                ),
                              );
                            }
                            if (index >= visible.length) {
                              return Center(
                                child: TextButton(
                                  onPressed: conversationLoadingMore
                                      ? null
                                      : _loadMoreConversations,
                                  child: Text(
                                    conversationLoadingMore
                                        ? 'Đang tải thêm…'
                                        : 'Tải thêm hội thoại',
                                  ),
                                ),
                              );
                            }
                            final room = visible[index];
                            final unread =
                                (room['unreadCount'] as num?)?.toInt() ?? 0;
                            final pinned =
                                room['pinnedAt']?.toString().isNotEmpty == true;
                            final muted = room['muted'] == true;
                            final selected =
                                pickerGroup?['id'] == room['id'] ||
                                active?['id'] == room['id'];
                            return InkWell(
                              key: ValueKey('rail-room-${room['id']}'),
                              onTap: () => _openRoom(room),
                              onLongPress: () => _roomActions(room),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: selected
                                      ? const Color(0xFFEDF3FF)
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                  vertical: 4,
                                ),
                                child: Row(
                                  children: [
                                    Stack(
                                      clipBehavior: Clip.none,
                                      children: [
                                        ConversationAvatarView(
                                          room: room,
                                          size: 38,
                                          fetchProfileImage: !widget.api.isDemo,
                                        ),
                                        if (unread > 0 ||
                                            room['manualUnread'] == true)
                                          Positioned(
                                            right: -6,
                                            top: -3,
                                            child: CircleAvatar(
                                              radius: 10,
                                              backgroundColor: socoBlue,
                                              child: Text(
                                                unread > 99
                                                    ? '99+'
                                                    : unread == 0
                                                    ? '•'
                                                    : '$unread',
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 8,
                                                  fontWeight: FontWeight.w800,
                                                ),
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(width: 11),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Row(
                                            children: [
                                              if (pinned) ...[
                                                const Icon(
                                                  Icons.push_pin_rounded,
                                                  size: 13,
                                                  color: socoBlue,
                                                ),
                                                const SizedBox(width: 3),
                                              ],
                                              Expanded(
                                                child: Text(
                                                  room['name']?.toString() ??
                                                      '',
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w800,
                                                    color: Color(0xFF253650),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            room['lastMessage']
                                                        ?.toString()
                                                        .isNotEmpty ==
                                                    true
                                                ? room['lastMessage'].toString()
                                                : room['type'] == 'group'
                                                ? 'Nhóm hội thoại'
                                                : 'Bắt đầu trò chuyện',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: unread > 0
                                                  ? socoText
                                                  : const Color(0xFF8494B0),
                                              fontWeight: unread > 0
                                                  ? FontWeight.w600
                                                  : FontWeight.w400,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          displayTime(room['lastMessageAt']),
                                          style: const TextStyle(
                                            color: Color(0xFF8A9AB5),
                                            fontSize: 10,
                                          ),
                                        ),
                                        if (room['categoryId'] != null ||
                                            muted) ...[
                                          const SizedBox(height: 6),
                                          Icon(
                                            muted
                                                ? Icons
                                                      .notifications_off_outlined
                                                : Icons.sell_rounded,
                                            size: 16,
                                            color: muted
                                                ? socoMuted
                                                : const Color(0xFF9F3D21),
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(width: 5),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _mobileChannelList() => NotificationListener<ScrollNotification>(
    onNotification: (notification) {
      if (notification.depth == 0) {
        widget.onMobileScroll?.call(notification, 'chat-channels');
      }
      return false;
    },
    child: MobileReverseScrollRegion(
      onReverseScroll: widget.onMobileReverseScroll,
      child: MobileChannelPicker(
        group: pickerGroup!,
        channels: channels,
        generalChannel: generalChannel,
        searchController: channelSearchController,
        loading: channelsLoading,
        selectedId: selectedChannelId,
        onSearchChanged: () => setState(() {}),
        onSelect: _openChannel,
      ),
    ),
  );

  Widget _conversationList(List<Json> filtered) {
    return ColoredBox(
      color: Colors.white,
      child: Column(
        children: [
          SectionHeading(
            eyebrow: 'TIN NHẮN',
            title: 'Trò chuyện',
            description:
                '${conversations.length} cuộc trò chuyện · Kết nối không biên giới',
            action: TextButton.icon(
              key: const ValueKey('connect-action'),
              onPressed: _newChat,
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF2A58C9),
                backgroundColor: const Color(0xFFEDF3FF),
                minimumSize: const Size(0, 39),
                padding: const EdgeInsets.symmetric(horizontal: 11),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFDCE6FF)),
                ),
              ),
              iconAlignment: IconAlignment.end,
              icon: const Icon(Icons.arrow_outward_rounded, size: 15),
              label: const Text(
                'Kết nối',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              ),
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
                  controller: conversationListScrollController,
                  padding: const EdgeInsets.fromLTRB(9, 0, 9, 12),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final room = filtered[index];
                    final selected = active?['id'] == room['id'];
                    final unread = (room['unreadCount'] as num?)?.toInt() ?? 0;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
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
                                    ConversationAvatarView(
                                      room: room,
                                      size: 52,
                                      fetchProfileImage: !widget.api.isDemo,
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
                                                if (unread > 0 ||
                                                    room['manualUnread'] ==
                                                        true)
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

  bool get _hasMessageSearchFilters =>
      messageSearchController.text.trim().isNotEmpty ||
      searchSenderId != null ||
      searchDates != null;

  String? _searchSenderUsername() {
    final senderId = searchSenderId;
    if (senderId == null) return null;
    if (widget.api.user['id']?.toString() == senderId) {
      return widget.api.user['username']?.toString();
    }
    for (final member in mentionMembers) {
      if (member.userId?.toString() == senderId) {
        return member.username;
      }
    }
    if (active?['otherUserId']?.toString() == senderId) {
      return active?['otherUsername']?.toString();
    }
    for (final message in messages) {
      if (message['senderId']?.toString() == senderId) {
        return message['sender']?.toString();
      }
    }
    return null;
  }

  String _messageSearchQuery({int? before}) {
    String day(DateTime value) =>
        '${value.year.toString().padLeft(4, '0')}-'
        '${value.month.toString().padLeft(2, '0')}-'
        '${value.day.toString().padLeft(2, '0')}';
    final params = <String, String>{
      'limit': '40',
      'channelId': '$selectedChannelId',
      'tzOffset': '${-DateTime.now().timeZoneOffset.inMinutes}',
      if (messageSearchController.text.trim().isNotEmpty)
        'search': messageSearchController.text.trim(),
      if (_searchSenderUsername() case final sender? when sender.isNotEmpty)
        'sender': sender.replaceFirst(RegExp(r'^@'), ''),
      if (searchDates != null) 'from': day(searchDates!.start),
      if (searchDates != null) 'to': day(searchDates!.end),
      if (before != null) 'before': '$before',
    };
    return Uri(queryParameters: params).query;
  }

  void _scheduleMessageSearch() {
    searchDebounce?.cancel();
    final generation = ++searchGeneration;
    if (!searchingMessages || !_hasMessageSearchFilters) {
      setState(() {
        searchLoading = false;
        serverSearchResults = null;
        searchHasMore = false;
        searchError = '';
      });
      return;
    }
    setState(() {
      searchLoading = true;
      searchError = '';
      serverSearchResults = null;
      searchHasMore = false;
    });
    searchDebounce = Timer(const Duration(milliseconds: 300), () async {
      final conversationId = active?['id'];
      if (conversationId == null) return;
      try {
        final data = objects(
          await widget.api.request(
            'GET',
            '/api/conversations/$conversationId/messages?'
                '${_messageSearchQuery()}',
          ),
        );
        if (!mounted ||
            generation != searchGeneration ||
            active?['id'] != conversationId ||
            !searchingMessages) {
          return;
        }
        setState(() {
          serverSearchResults = data;
          searchHasMore = data.length >= 40;
          searchLoading = false;
        });
      } catch (error) {
        if (!mounted || generation != searchGeneration) return;
        setState(() {
          searchLoading = false;
          searchError = 'Không thể tìm tin nhắn: $error';
        });
      }
    });
  }

  Future<void> _loadMoreMessageSearch() async {
    final current = serverSearchResults;
    if (searchLoading ||
        !searchHasMore ||
        current == null ||
        current.isEmpty ||
        active == null) {
      return;
    }
    final before = (current.last['id'] as num?)?.toInt();
    if (before == null) return;
    final conversationId = active!['id'];
    final generation = searchGeneration;
    setState(() => searchLoading = true);
    try {
      final older = objects(
        await widget.api.request(
          'GET',
          '/api/conversations/$conversationId/messages?'
              '${_messageSearchQuery(before: before)}',
        ),
      );
      if (!mounted ||
          generation != searchGeneration ||
          active?['id'] != conversationId) {
        return;
      }
      final ids = current.map((message) => message['id']).toSet();
      setState(() {
        serverSearchResults = [
          ...current,
          for (final message in older)
            if (!ids.contains(message['id'])) message,
        ];
        searchHasMore = older.length >= 40;
      });
    } catch (error) {
      if (mounted && generation == searchGeneration) {
        setState(() => searchError = 'Không tải được kết quả tiếp: $error');
      }
    } finally {
      if (mounted && generation == searchGeneration) {
        setState(() => searchLoading = false);
      }
    }
  }

  List<Json> _filteredMessages() {
    if (!searchingMessages) return messages;
    if (serverSearchResults != null && _hasMessageSearchFilters) {
      return serverSearchResults!;
    }
    final query = messageSearchController.text.trim().toLowerCase();
    return messages.where((message) {
      if (query.isNotEmpty &&
          !(message['text']?.toString() ?? '').toLowerCase().contains(query)) {
        return false;
      }
      if (searchSenderId != null &&
          message['senderId']?.toString() != searchSenderId) {
        return false;
      }
      final dates = searchDates;
      if (dates != null) {
        final created = DateTime.tryParse(
          message['createdAt']?.toString() ?? '',
        );
        if (created == null) return false;
        final date = DateTime(created.year, created.month, created.day);
        if (date.isBefore(dates.start) || date.isAfter(dates.end)) {
          return false;
        }
      }
      return true;
    }).toList();
  }

  Widget _messageSearchPanel() {
    final participants = <String, String>{};
    for (final message in messages) {
      final id = message['senderId']?.toString() ?? '';
      if (id.isNotEmpty) {
        participants.putIfAbsent(
          id,
          () => message['sender']?.toString() ?? 'Người dùng $id',
        );
      }
    }
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: socoLine)),
      ),
      child: Column(
        children: [
          SizedBox(
            height: 40,
            child: TextField(
              key: const ValueKey('conversation-message-search'),
              controller: messageSearchController,
              autofocus: true,
              onChanged: (_) {
                setState(() {});
                _scheduleMessageSearch();
              },
              decoration: InputDecoration(
                hintText: 'Tìm trong hội thoại',
                prefixIcon: const Icon(Icons.search_rounded, size: 19),
                suffixIcon: messageSearchController.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Xóa từ khóa',
                        onPressed: () {
                          setState(messageSearchController.clear);
                          _scheduleMessageSearch();
                        },
                        icon: const Icon(Icons.close_rounded, size: 18),
                      ),
                contentPadding: const EdgeInsets.symmetric(vertical: 7),
              ),
            ),
          ),
          const SizedBox(height: 7),
          Row(
            children: [
              const Icon(
                Icons.person_outline_rounded,
                color: socoMuted,
                size: 19,
              ),
              const SizedBox(width: 4),
              Expanded(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String?>(
                    key: const ValueKey('conversation-search-sender'),
                    isExpanded: true,
                    value: searchSenderId,
                    style: const TextStyle(color: socoText, fontSize: 12),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('Tất cả người gửi'),
                      ),
                      for (final entry in participants.entries)
                        DropdownMenuItem<String?>(
                          value: entry.key,
                          child: Text(
                            entry.value,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: (value) {
                      setState(() => searchSenderId = value);
                      _scheduleMessageSearch();
                    },
                  ),
                ),
              ),
              const SizedBox(width: 5),
              TextButton.icon(
                onPressed: () async {
                  final selection = await showDateRangePicker(
                    context: context,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                    initialDateRange: searchDates,
                    helpText: 'Lọc tin nhắn theo ngày',
                  );
                  if (selection != null && mounted) {
                    setState(() => searchDates = selection);
                    _scheduleMessageSearch();
                  }
                },
                icon: const Icon(Icons.calendar_month_outlined, size: 17),
                label: Text(
                  searchDates == null
                      ? 'Thời gian'
                      : '${searchDates!.start.day}/${searchDates!.start.month}'
                            ' – ${searchDates!.end.day}/${searchDates!.end.month}',
                  style: const TextStyle(fontSize: 11),
                ),
              ),
              if (searchDates != null)
                IconButton(
                  tooltip: 'Xóa bộ lọc thời gian',
                  onPressed: () {
                    setState(() => searchDates = null);
                    _scheduleMessageSearch();
                  },
                  icon: const Icon(Icons.close_rounded, size: 16),
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              '${_filteredMessages().length} tin nhắn phù hợp',
              style: const TextStyle(color: socoMuted, fontSize: 11),
            ),
          ),
          if (searchLoading) const LinearProgressIndicator(minHeight: 2),
          if (searchError.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                searchError,
                style: const TextStyle(color: Colors.redAccent, fontSize: 11),
              ),
            ),
          if (searchHasMore)
            TextButton.icon(
              onPressed: searchLoading ? null : _loadMoreMessageSearch,
              icon: const Icon(Icons.expand_more_rounded, size: 17),
              label: const Text('Tải thêm kết quả'),
            ),
        ],
      ),
    );
  }

  Widget _conversationPane() {
    final room = active!;
    final visibleMessages = _filteredMessages();
    final selectedChannel = selectedChannelId == 0
        ? null
        : channels.where((item) => item['id'] == selectedChannelId).firstOrNull;
    final activeChannel = selectedChannelId == 0
        ? 'Thảo luận chung'
        : selectedChannel?['name']?.toString() ?? 'Kênh';
    final channelTopic =
        selectedChannel?['description']?.toString().trim() ?? '';
    final groupSubtitle = selectedChannelId == 0
        ? '${room['memberCount'] ?? 0} thành viên'
        : channelTopic.isNotEmpty
        ? channelTopic
        : 'Thuộc nhóm ${room['name'] ?? ''}';
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
                      room['type'] == 'group' && selectedChannelId != 0
                          ? UserAvatar(
                              name: activeChannel,
                              imageUrl: selectedChannel?['avatarUrl']
                                  ?.toString(),
                              size: compact ? 36 : 42,
                              group: true,
                              fetchProfileImage: false,
                            )
                          : ConversationAvatarView(
                              room: room,
                              size: compact ? 36 : 42,
                              fetchProfileImage: !widget.api.isDemo,
                            ),
                    SizedBox(width: compact ? 7 : 11),
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            room['type'] == 'group'
                                ? activeChannel
                                : room['name']?.toString() ?? '',
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
                                ? groupSubtitle
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
                    SizedBox(width: compact ? 3 : 6),
                    _chatAction(
                      tooltip: searchingMessages
                          ? 'Đóng tìm kiếm'
                          : 'Tìm tin nhắn',
                      compact: compact,
                      onPressed: () {
                        setState(() {
                          searchingMessages = !searchingMessages;
                          if (!searchingMessages) {
                            messageSearchController.clear();
                            searchSenderId = null;
                            searchDates = null;
                          }
                        });
                        _scheduleMessageSearch();
                      },
                      icon: searchingMessages
                          ? Icons.close_rounded
                          : Icons.search_rounded,
                    ),
                    SizedBox(width: compact ? 3 : 6),
                    _chatAction(
                      key: const ValueKey('chat-translation-action'),
                      tooltip: 'Cài đặt dịch AI',
                      compact: compact,
                      onPressed: _showTranslationSettings,
                      icon: Icons.translate_rounded,
                    ),
                    SizedBox(width: compact ? 3 : 6),
                    _chatAction(
                      key: const ValueKey('chat-more-actions'),
                      tooltip: room['type'] == 'group'
                          ? selectedChannelId == 0
                                ? 'Thông tin nhóm'
                                : 'Thông tin kênh'
                          : 'Thông tin hội thoại',
                      compact: compact,
                      onPressed: () => _showConversationInformation(room),
                      icon: Icons.more_horiz_rounded,
                    ),
                  ],
                ),
              ),
              if (room['type'] == 'direct') _friendBar(),
              if (searchingMessages) _messageSearchPanel(),
              _pinnedPanel(),
              Expanded(
                child: ColoredBox(
                  color: _wallpapers[room['wallpaper']] ?? Colors.transparent,
                  child: loading
                      ? const Center(child: CircularProgressIndicator())
                      : visibleMessages.isEmpty
                      ? EmptyState(
                          icon: searchingMessages
                              ? Icons.search_off_rounded
                              : Icons.waving_hand_outlined,
                          title: searchingMessages
                              ? 'Không tìm thấy tin nhắn'
                              : 'Bắt đầu trò chuyện',
                          description: searchingMessages
                              ? 'Thử thay đổi từ khóa hoặc bộ lọc.'
                              : 'Gửi tin nhắn đầu tiên ngay bây giờ.',
                        )
                      : _messageTimeline(visibleMessages),
                ),
              ),
              _composer(),
            ],
          ),
        );
      },
    );
  }

  Widget _messageTimeline(List<Json> rows) {
    final anchor = centeredTimeline
        ? rows.indexWhere((m) => m['id'] == unreadMessageId)
        : -1;
    final centered = anchor >= 0;
    Widget row(Json message, {bool marker = false}) => Column(
      key: ValueKey(message['id']),
      children: [
        if (message['id'] == messageGapBefore && !searchingMessages)
          TextButton(
            onPressed: gapLoading ? null : _loadMessageGap,
            child: Text(gapLoading ? 'Đang tải…' : 'Tải tin nhắn ở giữa'),
          ),
        if (marker)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Row(
              children: [
                Expanded(child: Divider()),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 10),
                  child: Text(
                    'Tin nhắn chưa đọc',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
                Expanded(child: Divider()),
              ],
            ),
          ),
        _messageBubble(message),
      ],
    );
    return Stack(
      children: [
        Positioned.fill(
          child: centered
              ? CustomScrollView(
                  key: ValueKey(
                    'timeline-${active?['id']}-$selectedChannelId-$unreadMessageId',
                  ),
                  controller: scrollController,
                  center: unreadCenterKey,
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      sliver: SliverList.builder(
                        itemCount: anchor + 1,
                        itemBuilder: (_, i) => i == anchor
                            ? _dayDivider()
                            : row(rows[anchor - 1 - i]),
                      ),
                    ),
                    SliverPadding(
                      key: unreadCenterKey,
                      padding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
                      sliver: SliverList.builder(
                        itemCount: rows.length - anchor,
                        itemBuilder: (_, i) =>
                            row(rows[anchor + i], marker: i == 0),
                      ),
                    ),
                  ],
                )
              : ListView.builder(
                  key: ValueKey(
                    'timeline-${active?['id']}-$selectedChannelId-latest',
                  ),
                  controller: scrollController,
                  reverse: true,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 16,
                  ),
                  itemCount: rows.length + 1,
                  itemBuilder: (_, i) => i == rows.length
                      ? _dayDivider()
                      : row(rows[rows.length - 1 - i]),
                  findChildIndexCallback: (key) {
                    if (key is! ValueKey) return null;
                    final index = rows.indexWhere((m) => m['id'] == key.value);
                    return index < 0 ? null : rows.length - 1 - index;
                  },
                ),
        ),
        Positioned(
          bottom: 12,
          left: 0,
          right: 0,
          child: ValueListenableBuilder<bool>(
            valueListenable: showLatest,
            builder: (_, visible, _) => visible
                ? Center(
                    child: Material(
                      color: Colors.white,
                      shape: const CircleBorder(),
                      elevation: 3,
                      child: IconButton(
                        tooltip: 'Đến tin nhắn mới nhất',
                        color: socoBlue,
                        onPressed: () => unawaited(_scrollToBottom()),
                        icon: const Icon(Icons.arrow_downward_rounded),
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ),
      ],
    );
  }

  Widget _chatAction({
    required String tooltip,
    required bool compact,
    required VoidCallback onPressed,
    required IconData icon,
    Key? key,
  }) {
    return IconButton(
      key: key,
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
        key: ValueKey('chat-message-${message['id']}'),
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
              if (message['forwarded'] == true)
                const Padding(
                  padding: EdgeInsets.only(bottom: 5, left: 5),
                  child: Text(
                    'Đã chuyển tiếp 1 tin nhắn',
                    style: TextStyle(color: socoMuted, fontSize: 11),
                  ),
                ),
              if (!mine && active?['type'] == 'group')
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 5),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      UserAvatar(
                        name:
                            message['senderDisplayName']?.toString() ??
                            message['sender']?.toString() ??
                            '',
                        username: message['sender']?.toString(),
                        size: 29,
                        circular: true,
                        fetchProfileImage: !widget.api.isDemo,
                      ),
                      const SizedBox(width: 7),
                      Flexible(
                        child: Text(
                          message['senderDisplayName']?.toString() ??
                              message['sender']?.toString() ??
                              '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ],
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
                child: ChatMentionText(
                  text: deleted
                      ? 'Tin nhắn đã được thu hồi'
                      : translated.isNotEmpty && !showOriginal
                      ? translated
                      : message['text']?.toString() ?? '',
                  members: mentionMembers,
                  onMemberTap: _showMentionProfile,
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
                        onPressed: () => showReactionParticipants(
                          context,
                          api: widget.api,
                          id: (message['id'] as num).toInt(),
                          isPost: false,
                          initialEmoji: reaction['emoji'].toString(),
                          reactions: reactions,
                        ),
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

  void _insertEmoji(String emoji) {
    final selection = messageController.selection;
    final text = messageController.text;
    final start = selection.isValid ? selection.start : text.length;
    final end = selection.isValid ? selection.end : start;
    final updated = text.replaceRange(start, end, emoji);
    messageController.value = TextEditingValue(
      text: updated,
      selection: TextSelection.collapsed(offset: start + emoji.length),
    );
    setState(() {});
  }

  Future<void> _showQuickReplies({String? query}) async {
    final roomId = active?['id'];
    final channelId = selectedChannelId;
    try {
      var items = objects(
        await widget.api.request('GET', '/api/chat/quick-replies'),
      );
      if (!mounted ||
          roomId != active?['id'] ||
          channelId != selectedChannelId) {
        return;
      }
      final chosen = await showModalBottomSheet<String>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (sheetContext) => StatefulBuilder(
          builder: (ctx, update) {
            Future<void> edit(Json? existing) async {
              var shortcut = existing?['key']?.toString() ?? '';
              var body = existing?['text']?.toString() ?? '';
              final formKey = GlobalKey<FormState>();
              final result = await showDialog<Json>(
                context: ctx,
                builder: (dialogContext) => AlertDialog(
                  title: const Text('Tin nhắn nhanh'),
                  content: Form(
                    key: formKey,
                    child: SingleChildScrollView(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          TextFormField(
                            initialValue: shortcut,
                            maxLength: 32,
                            enabled: existing == null,
                            decoration: const InputDecoration(
                              labelText: 'Từ khóa (vd: camon)',
                            ),
                            validator: (value) =>
                                RegExp(
                                  r'^[a-z0-9_-]{1,32}$',
                                ).hasMatch(value ?? '')
                                ? null
                                : 'Chỉ dùng a-z, 0-9, _ và -',
                            onChanged: (value) => shortcut = value.trim(),
                          ),
                          TextFormField(
                            initialValue: body,
                            maxLength: 4000,
                            maxLines: 3,
                            decoration: const InputDecoration(
                              labelText: 'Nội dung',
                            ),
                            validator: (value) => (value ?? '').trim().isEmpty
                                ? 'Nhập nội dung'
                                : null,
                            onChanged: (value) => body = value,
                          ),
                        ],
                      ),
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      child: const Text('Hủy'),
                    ),
                    FilledButton(
                      onPressed: () {
                        if (formKey.currentState?.validate() == true) {
                          Navigator.pop(dialogContext, {
                            'key': shortcut,
                            'text': body.trim(),
                          });
                        }
                      },
                      child: const Text('Lưu'),
                    ),
                  ],
                ),
              );
              if (!mounted || result == null || !ctx.mounted) return;
              try {
                await widget.api.request(
                  'PUT',
                  '/api/chat/quick-replies/${result['key']}',
                  {'text': result['text']},
                );
                final fresh = objects(
                  await widget.api.request('GET', '/api/chat/quick-replies'),
                );
                if (ctx.mounted) update(() => items = fresh);
              } catch (error) {
                if (mounted) _show('Không lưu được tin nhắn nhanh: $error');
              }
            }

            Future<void> remove(Json item) async {
              try {
                await widget.api.request(
                  'DELETE',
                  '/api/chat/quick-replies/${item['key']}',
                );
                if (ctx.mounted) {
                  update(
                    () => items = items
                        .where((row) => row['key'] != item['key'])
                        .toList(),
                  );
                }
              } catch (error) {
                if (mounted) _show('Không xóa được tin nhắn nhanh: $error');
              }
            }

            final visible = items
                .where(
                  (item) =>
                      query == null ||
                      (item['key']?.toString() ?? '').startsWith(
                        query.toLowerCase(),
                      ),
                )
                .toList();
            return SafeArea(
              child: FractionallySizedBox(
                heightFactor: .65,
                child: Column(
                  children: [
                    ChatSheetHeader(
                      title: 'Tin nhắn nhanh',
                      onClose: () => Navigator.pop(sheetContext),
                      action: IconButton(
                        icon: const Icon(Icons.add),
                        tooltip: 'Tạo mẫu',
                        onPressed: () => edit(null),
                      ),
                    ),
                    Expanded(
                      child: visible.isEmpty
                          ? const EmptyState(
                              icon: Icons.flash_on_outlined,
                              title: 'Chưa có mẫu phù hợp',
                              description:
                                  'Tạo mẫu để chèn nội dung nhanh bằng /từ khóa.',
                            )
                          : ListView(
                              children: [
                                for (final item in visible)
                                  ListTile(
                                    title: Text('/${item['key']}'),
                                    subtitle: Text(
                                      item['text']?.toString() ?? '',
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    onTap: () => Navigator.pop(
                                      sheetContext,
                                      item['text']?.toString(),
                                    ),
                                    trailing: query != null
                                        ? null
                                        : Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                icon: const Icon(
                                                  Icons.edit_outlined,
                                                ),
                                                tooltip: 'Sửa mẫu',
                                                onPressed: () => edit(item),
                                              ),
                                              IconButton(
                                                icon: const Icon(
                                                  Icons.delete_outline,
                                                ),
                                                tooltip: 'Xóa mẫu',
                                                onPressed: () => remove(item),
                                              ),
                                            ],
                                          ),
                                  ),
                              ],
                            ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      );
      if (!mounted ||
          chosen == null ||
          roomId != active?['id'] ||
          channelId != selectedChannelId) {
        return;
      }
      if (RegExp(
        r'^/[a-z0-9_-]*$',
        caseSensitive: false,
      ).hasMatch(messageController.text)) {
        setState(
          () => messageController.value = TextEditingValue(
            text: chosen,
            selection: TextSelection.collapsed(offset: chosen.length),
          ),
        );
      } else {
        if (messageController.text.length + chosen.length <= 4000) {
          _insertEmoji(chosen);
        }
      }
    } catch (error) {
      if (mounted) _show('Không tải được tin nhắn nhanh: $error');
    }
  }

  Future<void> _showComposerMenu() async {
    const emoji = [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '😂',
      '🤣',
      '😊',
      '😍',
      '🥰',
      '😘',
      '😎',
      '🤩',
      '🥳',
      '🤔',
      '😮',
      '😢',
      '😭',
      '🥺',
      '😡',
      '👍',
      '👎',
      '👏',
      '🙌',
      '🙏',
      '💪',
      '👋',
      '🤝',
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '💯',
      '🎉',
      '🔥',
      '✨',
      '🌹',
      '🌞',
      '🌈',
      '🎂',
      '🎁',
      '🐱',
      '🐶',
      '🍀',
    ];
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.attach_file_rounded, color: socoBlue),
                title: const Text('Tệp tin'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _pickAttachment();
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.collections_outlined,
                  color: socoBlue,
                ),
                title: const Text('Ảnh / Video'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _pickAttachment(mediaOnly: true);
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.flash_on_outlined, color: socoBlue),
                title: const Text('Tin nhắn nhanh'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _showQuickReplies();
                },
              ),
              const Divider(height: 1),
              const Padding(
                padding: EdgeInsets.only(top: 14, bottom: 9),
                child: Text(
                  'Emoji',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: socoNavy,
                  ),
                ),
              ),
              SizedBox(
                height: 220,
                child: GridView.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 8,
                    mainAxisSpacing: 4,
                    crossAxisSpacing: 4,
                  ),
                  itemCount: emoji.length,
                  itemBuilder: (_, index) => InkWell(
                    borderRadius: BorderRadius.circular(9),
                    onTap: () {
                      _insertEmoji(emoji[index]);
                      Navigator.pop(sheetContext);
                    },
                    child: Center(
                      child: Text(
                        emoji[index],
                        style: const TextStyle(fontSize: 26),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
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
          if (pendingAttachments.isNotEmpty)
            SizedBox(
              height: 58,
              child: ListView.separated(
                key: const ValueKey('composer-pending-attachments'),
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(bottom: 5),
                itemCount: pendingAttachments.length,
                separatorBuilder: (_, _) => const SizedBox(width: 6),
                itemBuilder: (context, index) {
                  final attachment = pendingAttachments[index];
                  return InputChip(
                    avatar: const Icon(
                      Icons.insert_drive_file_outlined,
                      size: 18,
                    ),
                    label: Text(
                      attachment['name']?.toString() ??
                          attachment['fileName']?.toString() ??
                          'Tệp đính kèm',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onDeleted: sending || uploading
                        ? null
                        : () => setState(
                            () => pendingAttachments.removeAt(index),
                          ),
                  );
                },
              ),
            ),
          if (RegExp(
            r'^/[a-z0-9_-]*$',
            caseSensitive: false,
          ).hasMatch(messageController.text))
            TextButton.icon(
              onPressed: () =>
                  _showQuickReplies(query: messageController.text.substring(1)),
              icon: const Icon(Icons.flash_on_outlined),
              label: const Text('Chọn tin nhắn nhanh'),
            ),
          if (_mentionCandidates.isNotEmpty)
            _mentionSuggestions(_mentionCandidates),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              IconButton(
                tooltip: 'Thêm ảnh, file, emoji',
                style: IconButton.styleFrom(
                  foregroundColor: socoBlue,
                  backgroundColor: socoSoftBlue,
                  minimumSize: const Size.square(44),
                  maximumSize: const Size.square(44),
                  shape: const CircleBorder(),
                ),
                onPressed: uploading || sending ? null : _showComposerMenu,
                icon: uploading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.add_rounded, size: 25),
              ),
              const SizedBox(width: 5),
              IconButton(
                key: const ValueKey('composer-quick-media'),
                tooltip: 'Đính kèm ảnh hoặc video',
                onPressed: uploading || sending
                    ? null
                    : () => _pickAttachment(mediaOnly: true),
                style: IconButton.styleFrom(
                  foregroundColor: socoBlue,
                  minimumSize: const Size.square(38),
                  maximumSize: const Size.square(38),
                  padding: EdgeInsets.zero,
                ),
                icon: const Icon(Icons.image_outlined, size: 21),
              ),
              const SizedBox(width: 5),
              Expanded(
                child: TextField(
                  controller: messageController,
                  focusNode: messageFocus,
                  enabled: !sending,
                  minLines: 1,
                  maxLines: 5,
                  maxLength: 4000,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText:
                        active?['type'] == 'group' && selectedChannelId != 0
                        ? 'Nhắn vào # ${channels.where((item) => item['id'] == selectedChannelId).firstOrNull?['name'] ?? 'kênh hội thoại'}...'
                        : active?['type'] == 'group'
                        ? 'Nhắn vào ${active?['name'] ?? ''}...'
                        : 'Nhắn ${active?['name'] ?? ''}...',
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
                          uploading ||
                          (messageController.text.trim().isEmpty &&
                              pendingAttachments.isEmpty)
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
