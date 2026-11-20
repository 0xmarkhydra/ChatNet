import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'state/app_providers.dart';
import 'presentation/friend_list_presenter.dart';
import 'presentation/contact_friend_profile_sheet.dart';
import 'call_translation_settings_screen.dart';
import 'feed_visitor_profile.dart';

import 'api.dart';
import 'call_history_screen.dart';
import 'theme.dart';
import 'widgets.dart';

class ContactsScreen extends ConsumerStatefulWidget {
  const ContactsScreen({
    super.key,
    required this.api,
    required this.query,
    required this.onOpenConversation,
    required this.onAddFriend,
    required this.onCreateGroup,
    required this.onScanQr,
    this.onShowQr,
    this.newFriendRequest = 0,
  });

  final Api api;
  final String query;
  final ValueChanged<Json> onOpenConversation;
  final VoidCallback onAddFriend;
  final VoidCallback onCreateGroup;
  final VoidCallback onScanQr;
  final VoidCallback? onShowQr;
  final int newFriendRequest;

  @override
  ConsumerState<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends ConsumerState<ContactsScreen> {
  final friendSearchController = TextEditingController();
  List<Json> friends = [];
  Map<int, Json> contactMetadata = {};
  List<Json> groups = [];
  List<Json> otherContacts = [];
  String groupError = '';
  bool groupLoading = false;
  final groupSearchController = TextEditingController();
  FriendListFilter friendFilter = FriendListFilter.all;
  List<Json> requests = [];
  List<Json> suggestions = [];
  bool loading = true;
  int contactTab = 0;
  String invitationTab = 'incoming';
  int? busyId;
  String error = '';

  @override
  void initState() {
    super.initState();
    _load();
    if (widget.query.trim().isNotEmpty) {
      _scheduleSearch(widget.query);
    }
  }

  @override
  void didUpdateWidget(covariant ContactsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.newFriendRequest != widget.newFriendRequest) {
      // Match the PWA: the header's add-friend action opens invitations.
      setState(() {
        contactTab = 2;
        invitationTab = 'incoming';
      });
    }
    if (oldWidget.query != widget.query) {
      _scheduleSearch(widget.query);
      if (widget.query.trim().isNotEmpty) {
        setState(() => contactTab = 0);
      }
    }
  }

  void _scheduleSearch(String query) {
    // Provider state cannot be modified synchronously in didUpdateWidget.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted &&
          (widget.query == query || friendSearchController.text == query)) {
        ref.read(contactSearchProvider.notifier).search(query);
      }
    });
  }

  Future<void> _load() async {
    try {
      ref.invalidate(contactsProvider);
      final snapshot = await ref.read(contactsProvider.future);
      final invitations = objects(
        await widget.api.request('GET', '/api/friends/requests'),
      );
      List<Json> personalContacts = [];
      try {
        personalContacts = objects(
          await widget.api.request('GET', '/api/contacts'),
        );
      } catch (_) {
        // The directory remains usable if contact metadata is unavailable.
      }
      if (!mounted) return;
      setState(() {
        contactMetadata = {
          for (final record in personalContacts)
            if (record['id'] is num) (record['id'] as num).toInt(): record,
        };
        friends = snapshot.friends.map((friend) {
          final item = friend.toJson();
          final id = (item['id'] as num?)?.toInt();
          final meta = id == null ? null : contactMetadata[id];
          return <String, dynamic>{
            ...item,
            if (meta != null) ...{
              'nickname': meta['nickname'] ?? '',
              'favorite': meta['favorite'] == true,
            },
          };
        }).toList();
        requests = invitations;
        suggestions = snapshot.suggestions
            .map((person) => person.toJson())
            .toList();
        loading = false;
        error = '';
      });
      await _loadGroups();
    } catch (value) {
      if (mounted) {
        setState(() {
          loading = false;
          error = value.toString();
        });
      }
    }
  }

  Future<void> _loadGroups() async {
    if (groupLoading) return;
    if (mounted) {
      setState(() {
        groupLoading = true;
        groupError = '';
      });
    }
    try {
      final data = await Future.wait([
        widget.api.request('GET', '/api/conversations?type=group&limit=100'),
        widget.api.request('GET', '/api/conversations?limit=100'),
      ]);
      if (!mounted) return;
      final currentGroups = objects(data[0]);
      final conversations = objects(data[1]);
      final friendsById = friends.map((friend) => friend['id']).toSet();
      final friendsByUsername = friends
          .map((friend) => (friend['username']?.toString() ?? '').toLowerCase())
          .toSet();
      setState(() {
        groups = currentGroups
            .where((room) => room['type'] == 'group')
            .toList();
        otherContacts = conversations
            .where(
              (room) =>
                  room['type'] == 'direct' &&
                  !friendsById.contains(room['otherUserId']) &&
                  !friendsByUsername.contains(
                    (room['otherUsername']?.toString() ?? '').toLowerCase(),
                  ),
            )
            .toList();
        groupLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        groupLoading = false;
        groupError = 'Không tải được danh sách nhóm: $error';
      });
    }
  }

  String _relationship(int id) {
    if (friends.any((item) => item['id'] == id)) return 'accepted';
    final request = requests.where((item) => item['id'] == id);
    if (request.isEmpty) return 'none';
    return request.first['direction'] == 'incoming' ? 'incoming' : 'outgoing';
  }

  Future<void> _act(Json person, {bool decline = false}) async {
    final id = (person['id'] as num).toInt();
    final relationship = _relationship(id);
    setState(() => busyId = id);
    try {
      if (decline || relationship == 'outgoing') {
        await widget.api.request(
          'DELETE',
          '/api/friends/$id?direction=$relationship',
        );
      } else if (relationship == 'incoming') {
        await widget.api.request('POST', '/api/friends/$id/accept');
      } else if (relationship == 'none') {
        await widget.api.request('POST', '/api/friends/$id');
      }
      await _load();
    } catch (value) {
      _show(value.toString());
    } finally {
      if (mounted) setState(() => busyId = null);
    }
  }

  Json _metadataFor(Json person) {
    final id = (person['id'] as num?)?.toInt();
    return id == null ? <String, dynamic>{} : (contactMetadata[id] ?? {});
  }

  Future<void> _editMetadata(Json person, String field) async {
    final id = (person['id'] as num?)?.toInt();
    if (id == null) return;
    final previous = _metadataFor(person);
    final next = <String, dynamic>{
      'nickname': previous['nickname']?.toString() ?? '',
      'note': previous['note']?.toString() ?? '',
      'favorite': previous['favorite'] == true,
    };
    if (field == 'favorite') {
      next['favorite'] = !(next['favorite'] == true);
    } else {
      var draft = next[field]?.toString() ?? '';
      final value = await showDialog<String>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(field == 'nickname' ? 'Đặt biệt danh' : 'Ghi chú riêng'),
          content: TextFormField(
            key: ValueKey('contact-edit-$field'),
            initialValue: draft,
            onChanged: (value) => draft = value,
            maxLength: field == 'nickname' ? 60 : 1500,
            decoration: InputDecoration(
              labelText: field == 'nickname' ? 'Biệt danh' : 'Ghi chú',
            ),
            minLines: 1,
            maxLines: field == 'nickname' ? 1 : 5,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, draft.trim()),
              child: const Text('Lưu'),
            ),
          ],
        ),
      );
      if (value == null) return;
      next[field] = value;
    }
    try {
      final updated = object(
        await widget.api.request('PUT', '/api/contacts/$id', next),
      );
      if (!mounted) return;
      setState(() {
        contactMetadata[id] = {...next, ...updated, 'id': id};
        for (final friend in friends) {
          if (friend['id'] == id) {
            friend['nickname'] = contactMetadata[id]?['nickname'];
            friend['favorite'] = contactMetadata[id]?['favorite'] == true;
          }
        }
      });
      _show('Đã cập nhật thông tin liên hệ.');
    } catch (error) {
      _show('Không cập nhật được thông tin liên hệ: $error');
    }
  }

  Future<bool> _confirmAction({
    required String title,
    required String message,
    required String action,
  }) async {
    if (!mounted) return false;
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text(title),
            content: Text(message),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Hủy'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: Text(action, style: const TextStyle(color: Colors.red)),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _removeFriend(Json person) async {
    final id = (person['id'] as num?)?.toInt();
    if (id == null) return;
    if (!await _confirmAction(
      title: 'Hủy kết bạn?',
      message: 'Hủy kết bạn với @${person['username'] ?? ''}?',
      action: 'Hủy kết bạn',
    )) {
      return;
    }
    try {
      await widget.api.request('DELETE', '/api/friends/$id?direction=accepted');
      await _load();
      _show('Đã hủy kết bạn.');
    } catch (error) {
      _show('Không thể hủy kết bạn: $error');
    }
  }

  Future<void> _toggleBlock(Json person) async {
    final id = (person['id'] as num?)?.toInt();
    if (id == null) return;
    final wasBlocked = person['blockedByMe'] == true;
    if (!await _confirmAction(
      title: wasBlocked ? 'Bỏ chặn?' : 'Chặn người dùng?',
      message: wasBlocked
          ? 'Bỏ chặn @${person['username'] ?? ''}?'
          : 'Hai bạn sẽ không thể nhắn tin, gọi điện hoặc kết bạn khi bị chặn.',
      action: wasBlocked ? 'Bỏ chặn' : 'Chặn',
    )) {
      return;
    }
    try {
      await widget.api.request(
        wasBlocked ? 'DELETE' : 'POST',
        '/api/users/$id/block',
      );
      if (!mounted) return;
      setState(() {
        for (final friend in friends) {
          if (friend['id'] == id) {
            friend['blockedByMe'] = !wasBlocked;
            if (!wasBlocked) friend['online'] = false;
          }
        }
      });
      _show(wasBlocked ? 'Đã bỏ chặn.' : 'Đã chặn người dùng.');
    } catch (error) {
      _show('Không thay đổi được trạng thái chặn: $error');
    }
  }

  Future<void> _reportFriend(Json person) async {
    final id = (person['id'] as num?)?.toInt();
    if (id == null) return;
    var reason = 'spam';
    var details = '';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, refresh) => AlertDialog(
          title: const Text('Báo cáo tài khoản'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: reason,
                decoration: const InputDecoration(labelText: 'Lý do'),
                items: const [
                  DropdownMenuItem(value: 'spam', child: Text('Spam')),
                  DropdownMenuItem(
                    value: 'harassment',
                    child: Text('Quấy rối'),
                  ),
                  DropdownMenuItem(
                    value: 'impersonation',
                    child: Text('Giả mạo'),
                  ),
                  DropdownMenuItem(value: 'other', child: Text('Khác')),
                ],
                onChanged: (value) => refresh(() => reason = value ?? 'spam'),
              ),
              TextField(
                onChanged: (value) => details = value,
                maxLength: 1000,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Chi tiết (tùy chọn)',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Gửi báo cáo'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    details = details.trim();
    try {
      await widget.api.request('POST', '/api/users/$id/report', {
        'reason': reason,
        'details': details,
      });
      _show('Đã gửi báo cáo.');
    } catch (error) {
      _show('Không gửi được báo cáo: $error');
    }
  }

  Future<void> _showFriendProfile(Json person) async {
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => ContactFriendProfileSheet(
        person: person,
        metadata: _metadataFor(person),
        api: widget.api,
        onMessage: () {
          Navigator.pop(sheetContext);
          _message(person);
        },
        onUpdateMetadata: (field) async {
          Navigator.pop(sheetContext);
          await _editMetadata(person, field);
        },
        onUnfriend: () async {
          Navigator.pop(sheetContext);
          await _removeFriend(person);
        },
        onBlock: () async {
          Navigator.pop(sheetContext);
          await _toggleBlock(person);
        },
        onReport: () async {
          Navigator.pop(sheetContext);
          await _reportFriend(person);
        },
      ),
    );
  }

  Future<void> _message(Json person) async {
    try {
      final room = object(
        await widget.api.request('POST', '/api/conversations/direct', {
          'username': person['username'],
        }),
      );
      widget.onOpenConversation(room);
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
    friendSearchController.dispose();
    groupSearchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tabs = const [
      ('Danh sách bạn bè', Icons.perm_contact_calendar_outlined),
      ('Danh sách nhóm', Icons.groups_outlined),
      ('Lời mời kết bạn', Icons.person_add_alt_1_outlined),
      ('Lịch sử cuộc gọi', Icons.call_outlined),
      ('Khám phá bạn bè', Icons.travel_explore_outlined),
      ('Dịch AI cuộc gọi', Icons.translate_rounded),
    ];
    return Material(
      color: socoCanvas,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(10, 7, 10, 7),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: socoLine)),
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (var index = 0; index < tabs.length; index++)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: ChoiceChip(
                        key: ValueKey('contacts-tab-$index'),
                        selected: contactTab == index,
                        showCheckmark: false,
                        avatar: Icon(
                          tabs[index].$2,
                          size: 18,
                          color: contactTab == index ? socoBlue : socoMuted,
                        ),
                        label: Text(tabs[index].$1),
                        labelStyle: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: contactTab == index ? socoBlue : socoText,
                        ),
                        selectedColor: const Color(0xFFE7EEFF),
                        side: const BorderSide(color: socoLine),
                        onSelected: (_) => setState(() => contactTab = index),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: switch (contactTab) {
              3 => CallHistoryScreen(
                api: widget.api,
                query: widget.query,
                onOpenConversation: widget.onOpenConversation,
              ),
              5 => CallTranslationSettingsScreen(
                api: widget.api,
                onBack: () => setState(() => contactTab = 3),
              ),
              2 => _buildInvites(),
              1 => _buildGroups(),
              4 => _buildDiscover(),
              _ => _buildFriends(context),
            },
          ),
        ],
      ),
    );
  }

  Widget _buildInvites() {
    final incoming = requests
        .where((item) => item['direction'] == 'incoming')
        .toList();
    final outgoing = requests
        .where((item) => item['direction'] == 'outgoing')
        .toList();
    if (loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        key: const ValueKey('friend-invitation-screen'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(10, 12, 10, 32),
        children: [
          Row(
            children: [
              IconButton(
                tooltip: 'Quay lại Danh bạ',
                onPressed: () => setState(() => contactTab = 0),
                icon: const Icon(Icons.arrow_back_rounded),
              ),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F4FB),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      for (final entry in const [
                        ('incoming', 'Lời mời đến'),
                        ('sent', 'Đã gửi'),
                        ('qr', 'Quét QR'),
                      ])
                        Expanded(
                          child: InkWell(
                            key: ValueKey('invitation-${entry.$1}'),
                            onTap: () =>
                                setState(() => invitationTab = entry.$1),
                            borderRadius: BorderRadius.circular(10),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              curve: Curves.easeOutCubic,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 2,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: invitationTab == entry.$1
                                    ? Colors.white
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                                boxShadow: invitationTab == entry.$1
                                    ? const [
                                        BoxShadow(
                                          color: Color(0x160F3370),
                                          blurRadius: 5,
                                          offset: Offset(0, 2),
                                        ),
                                      ]
                                    : null,
                              ),
                              child: Text(
                                entry.$2,
                                maxLines: 1,
                                textAlign: TextAlign.center,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: invitationTab == entry.$1
                                      ? FontWeight.w800
                                      : FontWeight.w600,
                                  color: invitationTab == entry.$1
                                      ? socoBlue
                                      : socoMuted,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (invitationTab == 'qr')
            _section('Kết nối bằng mã QR', [
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                child: Column(
                  children: [
                    Icon(
                      Icons.qr_code_scanner_rounded,
                      size: 65,
                      color: socoBlue,
                    ),
                    SizedBox(height: 10),
                    Text(
                      'Quét mã kết bạn hoặc chia sẻ mã QR của bạn.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: socoMuted),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
                child: FilledButton.icon(
                  key: const ValueKey('invitations-scan-qr'),
                  onPressed: widget.onScanQr,
                  icon: const Icon(Icons.qr_code_scanner_rounded),
                  label: const Text('Mở trình quét QR'),
                ),
              ),
            ]),
          if (invitationTab == 'qr')
            _section('Kết bạn bằng QR', [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 4, 16, 10),
                child: Text(
                  'Chia sẻ mã QR cá nhân hoặc mở camera để quét.',
                  style: TextStyle(color: socoMuted, fontSize: 12),
                ),
              ),
              Center(
                child: QrImageView(
                  key: const ValueKey('contacts-own-qr'),
                  data:
                      '${Api.siteUrl}/?connect=${widget.api.user['username'] ?? ''}',
                  size: 165,
                  eyeStyle: const QrEyeStyle(
                    eyeShape: QrEyeShape.square,
                    color: socoBlue,
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: socoNavy,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const ValueKey('contacts-copy-qr-link'),
                        onPressed: () async {
                          final value =
                              '${Api.siteUrl}/?connect=${widget.api.user['username'] ?? ''}';
                          await Clipboard.setData(ClipboardData(text: value));
                          _show('Đã sao chép liên kết kết bạn.');
                        },
                        icon: const Icon(Icons.copy_outlined),
                        label: const Text('Sao chép link'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: widget.onShowQr ?? widget.onScanQr,
                        icon: const Icon(Icons.qr_code_2_rounded),
                        label: const Text('QR của tôi'),
                      ),
                    ),
                  ],
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Row(
                  children: [
                    Icon(Icons.shield_outlined, color: socoBlue),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'An toàn khi kết nối: bạn quyết định ai có thể gửi yêu cầu.',
                        style: TextStyle(fontSize: 12, color: socoMuted),
                      ),
                    ),
                  ],
                ),
              ),
            ])
          else if (invitationTab == 'incoming') ...[
            _section('Lời mời đến', [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: Text(
                  'Lời mời sẽ không tự động được chấp nhận',
                  style: TextStyle(color: socoMuted, fontSize: 12),
                ),
              ),
              if (incoming.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: Text('Chưa có lời mời kết bạn đến.'),
                ),
              for (final person in incoming)
                _PersonRow(
                  person: person,
                  fetchProfileImage: !widget.api.isDemo,
                  busy: busyId == person['id'],
                  label: 'Chấp nhận',
                  onTap: () => _act(person),
                  secondaryLabel: 'Từ chối',
                  onSecondary: () => _act(person, decline: true),
                ),
              ListTile(
                title: Text(
                  'Đã gửi ${outgoing.length} lời mời',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: const Text('Có thể hủy khi chưa được chấp nhận'),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16),
                onTap: () => setState(() => invitationTab = 'sent'),
              ),
            ]),
          ] else
            _section('Đã gửi', [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: Text(
                  'Những lời mời đang chờ người nhận phản hồi',
                  style: TextStyle(color: socoMuted, fontSize: 12),
                ),
              ),
              if (outgoing.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: Text('Bạn chưa có lời mời đang chờ.'),
                ),
              for (final person in outgoing)
                _PersonRow(
                  person: person,
                  fetchProfileImage: !widget.api.isDemo,
                  busy: busyId == person['id'],
                  label: 'Hủy lời mời',
                  onTap: () => _act(person),
                ),
              ListTile(
                title: const Text('Tìm bạn bè mới'),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16),
                onTap: () => setState(() => contactTab = 4),
              ),
            ]),
        ],
      ),
    );
  }

  Widget _contactStat({
    required String count,
    required String label,
    required IconData icon,
    required VoidCallback onTap,
  }) => Expanded(
    child: Card(
      color: Colors.white,
      margin: const EdgeInsets.symmetric(horizontal: 3),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 5),
          child: Column(
            children: [
              Icon(icon, color: socoBlue, size: 22),
              const SizedBox(height: 5),
              Text(
                count,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: socoNavy,
                ),
              ),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                style: const TextStyle(fontSize: 10, color: socoMuted),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  Widget _buildDiscover() {
    if (loading) return const Center(child: CircularProgressIndicator());
    final searching = widget.query.trim().isNotEmpty;
    final asyncSearch = ref.watch(contactSearchProvider);
    if (searching && asyncSearch.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (searching && asyncSearch.hasError) {
      return EmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Không tìm được bạn bè',
        description: asyncSearch.error.toString(),
        action: FilledButton(
          onPressed: () =>
              ref.read(contactSearchProvider.notifier).search(widget.query),
          child: const Text('Thử lại'),
        ),
      );
    }
    final list = searching
        ? (asyncSearch.value ?? const [])
              .map((person) => person.toJson())
              .toList()
        : suggestions;
    final filtered = list.where((person) {
      final id = (person['id'] as num?)?.toInt();
      if (id == null || id == widget.api.user['id']) return false;
      return widget.query.trim().isNotEmpty || _relationship(id) == 'none';
    }).toList();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 12, bottom: 32),
        children: [
          Padding(
            key: const ValueKey('contacts-discovery-stats'),
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 14),
            child: Row(
              children: [
                _contactStat(
                  count: '${friends.length}',
                  label: 'Bạn bè',
                  icon: Icons.people_outline_rounded,
                  onTap: () => setState(() => contactTab = 0),
                ),
                _contactStat(
                  count:
                      '${requests.where((r) => r['direction'] == 'incoming').length}',
                  label: 'Lời mời đến',
                  icon: Icons.person_add_alt_1_outlined,
                  onTap: () => setState(() {
                    contactTab = 2;
                    invitationTab = 'incoming';
                  }),
                ),
                _contactStat(
                  count: '${filtered.length}',
                  label: 'Gợi ý kết nối hiện có',
                  icon: Icons.auto_awesome_outlined,
                  onTap: () => setState(() {}),
                ),
              ],
            ),
          ),
          _section('Lời mời kết bạn', [
            if (requests.where((r) => r['direction'] == 'incoming').isEmpty)
              const Padding(
                padding: EdgeInsets.all(18),
                child: Text(
                  'Bạn chưa có lời mời mới.',
                  style: TextStyle(color: socoMuted),
                ),
              ),
            for (final person
                in requests.where((r) => r['direction'] == 'incoming').take(3))
              _PersonRow(
                person: person,
                fetchProfileImage: !widget.api.isDemo,
                label: 'Chấp nhận',
                busy: busyId == person['id'],
                onTap: () => _act(person),
                secondaryLabel: 'Từ chối',
                onSecondary: () => _act(person, decline: true),
              ),
            ListTile(
              key: const ValueKey('discover-open-invitations'),
              title: const Text('Xem tất cả lời mời'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => setState(() {
                contactTab = 2;
                invitationTab = 'incoming';
              }),
            ),
          ]),
          _section(
            widget.query.trim().isEmpty
                ? 'Khám phá bạn bè'
                : 'Kết quả tìm kiếm',
            filtered.isEmpty
                ? [
                    const Padding(
                      padding: EdgeInsets.all(20),
                      child: Text(
                        'Chưa có gợi ý mới phù hợp.',
                        style: TextStyle(color: socoMuted),
                      ),
                    ),
                  ]
                : filtered.map((person) {
                    final relation = _relationship(
                      (person['id'] as num).toInt(),
                    );
                    return _PersonRow(
                      person: person,
                      fetchProfileImage: !widget.api.isDemo,
                      busy: busyId == person['id'],
                      label: switch (relation) {
                        'accepted' => 'Nhắn tin',
                        'incoming' => 'Chấp nhận',
                        'outgoing' => 'Đã gửi',
                        _ => 'Kết bạn',
                      },
                      onTap: () => relation == 'accepted'
                          ? _message(person)
                          : _act(person),
                    );
                  }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _friendSearchResults() {
    final result = ref.watch(contactSearchProvider);
    if (result.isLoading) {
      return const Padding(
        padding: EdgeInsets.all(25),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (result.hasError) {
      return Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: [
            Text('Không tìm được người dùng: ${result.error}'),
            TextButton(
              onPressed: () => _scheduleSearch(
                friendSearchController.text.trim().isNotEmpty
                    ? friendSearchController.text
                    : widget.query,
              ),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      );
    }
    final entries = (result.value ?? const [])
        .map((person) => person.toJson())
        .where((person) => person['id'] != widget.api.user['id'])
        .toList();
    if (entries.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(22),
        child: Text(
          'Không tìm thấy người dùng phù hợp.',
          style: TextStyle(color: socoMuted),
        ),
      );
    }

    return Material(
      color: Colors.white,
      child: Column(
        children: [
          for (final person in entries)
            ListTile(
              key: ValueKey('contact-search-${person['id']}'),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 5,
              ),
              onTap: () {
                final match = friends
                    .where((friend) => friend['id'] == person['id'])
                    .firstOrNull;
                if (match != null) {
                  _showFriendProfile(match);
                } else {
                  Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) => FeedVisitorProfile(
                        api: widget.api,
                        username: person['username']?.toString() ?? '',
                        onOpenConversation: widget.onOpenConversation,
                      ),
                    ),
                  );
                }
              },
              leading: UserAvatar(
                name:
                    person['displayName']?.toString() ??
                    person['username']?.toString() ??
                    '',
                username: person['username']?.toString(),
                size: 43,
                online: person['online'] == true,
                fetchProfileImage: !widget.api.isDemo,
              ),
              title: Text(
                person['displayName']?.toString() ??
                    person['username']?.toString() ??
                    '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(
                '@${person['username'] ?? ''}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: TextButton(
                onPressed: busyId == person['id']
                    ? null
                    : () {
                        final relation = _relationship(
                          (person['id'] as num).toInt(),
                        );
                        if (relation == 'accepted') {
                          _message(person);
                        } else {
                          _act(person);
                        }
                      },
                child: Text(switch (_relationship(
                  (person['id'] as num).toInt(),
                )) {
                  'accepted' => 'Nhắn tin',
                  'incoming' => 'Chấp nhận',
                  'outgoing' => 'Hủy lời mời',
                  _ => 'Kết bạn',
                }, style: const TextStyle(fontSize: 12)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFriends(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error.isNotEmpty && friends.isEmpty) {
      return EmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Chưa tải được danh bạ',
        description: error,
        action: FilledButton(onPressed: _load, child: const Text('Thử lại')),
      );
    }
    final searchQuery = friendSearchController.text.trim().isNotEmpty
        ? friendSearchController.text.trim()
        : widget.query.trim();
    final searching = searchQuery.isNotEmpty;
    final filtered = filterFriends(friends, filter: friendFilter);

    return ColoredBox(
      color: socoCanvas,
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(9, 14, 9, 32),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(3, 1, 3, 15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Danh sách bạn bè',
                    style: TextStyle(
                      color: socoNavy,
                      fontWeight: FontWeight.w800,
                      fontSize: 21,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Kết nối, trò chuyện và gọi cho mọi người',
                    style: TextStyle(color: socoMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(9, 7, 8, 7),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: socoLine),
                borderRadius: BorderRadius.circular(19),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x09223C68),
                    blurRadius: 14,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const Icon(Icons.search_rounded, color: socoBlue, size: 26),
                  const SizedBox(width: 4),
                  Expanded(
                    child: TextField(
                      key: const ValueKey('friends-local-search'),
                      controller: friendSearchController,
                      onChanged: (value) {
                        setState(() {});
                        _scheduleSearch(value);
                      },
                      decoration: InputDecoration(
                        hintText: 'Tìm theo tên, số điện thoại hoặc ID SocCO',
                        hintStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF8393B0),
                        ),
                        suffixIcon: friendSearchController.text.isEmpty
                            ? null
                            : IconButton(
                                key: const ValueKey('friends-clear-search'),
                                tooltip: 'Xóa tìm kiếm bạn bè',
                                icon: const Icon(Icons.close_rounded, size: 18),
                                onPressed: () {
                                  friendSearchController.clear();
                                  setState(() {});
                                  _scheduleSearch('');
                                },
                              ),
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(vertical: 9),
                      ),
                    ),
                  ),
                  const SizedBox(width: 5),
                  FilledButton.icon(
                    onPressed: () => setState(() {
                      contactTab = 2;
                      invitationTab = 'incoming';
                    }),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      padding: const EdgeInsets.symmetric(horizontal: 11),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(11),
                      ),
                    ),
                    icon: const Icon(Icons.add_rounded, size: 17),
                    label: const Text(
                      'Kết bạn mới',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: socoLine),
                borderRadius: BorderRadius.circular(19),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 17, 10, 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            searching ? 'Kết quả tìm kiếm' : 'Tất cả bạn bè',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: socoNavy,
                            ),
                          ),
                        ),
                        Text(
                          '${friends.length} người',
                          style: const TextStyle(
                            color: socoMuted,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(width: 4),
                        IconButton(
                          tooltip: 'Làm mới danh bạ',
                          onPressed: _load,
                          style: IconButton.styleFrom(
                            backgroundColor: const Color(0xFFEDF2FF),
                          ),
                          icon: const Icon(
                            Icons.refresh_rounded,
                            color: socoBlue,
                            size: 21,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (searching) _friendSearchResults(),
                  if (!searching)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(13, 0, 12, 10),
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            for (final entry in [
                              (FriendListFilter.all, 'A – Z'),
                              (FriendListFilter.online, 'Đang online'),
                              (FriendListFilter.favorites, 'Yêu thích'),
                            ]) ...[
                              TextButton(
                                onPressed: () =>
                                    setState(() => friendFilter = entry.$1),
                                style: TextButton.styleFrom(
                                  foregroundColor: friendFilter == entry.$1
                                      ? socoBlue
                                      : socoMuted,
                                  backgroundColor: friendFilter == entry.$1
                                      ? const Color(0xFFEAF0FF)
                                      : Colors.transparent,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 10,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(11),
                                  ),
                                ),
                                child: Text(
                                  entry.$2,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: friendFilter == entry.$1
                                        ? FontWeight.w800
                                        : FontWeight.w500,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 2),
                            ],
                          ],
                        ),
                      ),
                    ),
                  if (!searching && filtered.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(
                        child: Text(
                          'Không có bạn bè phù hợp.',
                          style: TextStyle(color: socoMuted),
                        ),
                      ),
                    )
                  else if (!searching)
                    for (final person in filtered)
                      InkWell(
                        key: ValueKey('friend-row-${person['id']}'),
                        onTap: () => _showFriendProfile(person),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 18,
                            vertical: 14,
                          ),
                          child: Row(
                            children: [
                              UserAvatar(
                                name:
                                    person['displayName']?.toString() ??
                                    person['username']?.toString() ??
                                    '',
                                username: person['username']?.toString(),
                                size: 46,
                                online: person['online'] == true,
                                fetchProfileImage: !widget.api.isDemo,
                              ),
                              const SizedBox(width: 13),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      (person['nickname']
                                                      ?.toString()
                                                      .isNotEmpty ==
                                                  true
                                              ? person['nickname'].toString()
                                              : person['displayName']
                                                    ?.toString()) ??
                                          person['username']?.toString() ??
                                          '',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        color: socoText,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      person['online'] == true
                                          ? 'Đang online'
                                          : 'Ngoại tuyến',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: socoMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGroups() {
    final query =
        (groupSearchController.text.isNotEmpty
                ? groupSearchController.text
                : widget.query)
            .trim()
            .toLowerCase();
    bool matches(Json room) =>
        query.isEmpty ||
        (room['name']?.toString() ?? '').toLowerCase().contains(query);
    final matchingGroups = groups.where(matches).toList();
    final matchingContacts = otherContacts.where(matches).toList();

    Widget row(Json room, {required bool group}) => ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 13, vertical: 5),
      leading: UserAvatar(
        name: room['name']?.toString() ?? '',
        username: group ? null : room['otherUsername']?.toString(),
        size: 45,
        group: group,
        fetchProfileImage: !widget.api.isDemo,
      ),
      title: Text(
        room['name']?.toString() ?? (group ? 'Nhóm' : 'Liên hệ'),
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: Text(
        group
            ? '${room['memberCount'] ?? 0} thành viên'
            : '@${room['otherUsername'] ?? ''}',
        style: const TextStyle(color: socoMuted),
      ),
      trailing: const Icon(Icons.chevron_right_rounded, color: socoMuted),
      onTap: () => widget.onOpenConversation(room),
    );

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        key: const ValueKey('contacts-groups-screen'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(10, 15, 10, 28),
        children: [
          const Text(
            'Danh sách nhóm',
            style: TextStyle(
              color: socoNavy,
              fontSize: 21,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            key: const ValueKey('contacts-group-search'),
            controller: groupSearchController,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search_rounded),
              hintText: 'Tìm nhóm hoặc liên hệ...',
              suffixIcon: groupSearchController.text.isNotEmpty
                  ? IconButton(
                      tooltip: 'Xóa tìm kiếm nhóm',
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => setState(groupSearchController.clear),
                    )
                  : null,
            ),
          ),
          if (groupLoading)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (groupError.isNotEmpty) ...[
            Text(groupError, style: const TextStyle(color: Color(0xFFBE123C))),
            TextButton.icon(
              onPressed: _loadGroups,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Thử lại'),
            ),
          ],
          const SizedBox(height: 12),
          _section(
            'Nhóm của bạn',
            matchingGroups.isEmpty
                ? [
                    const Padding(
                      padding: EdgeInsets.all(18),
                      child: Text(
                        'Chưa có nhóm phù hợp.',
                        style: TextStyle(color: socoMuted),
                      ),
                    ),
                  ]
                : [for (final room in matchingGroups) row(room, group: true)],
          ),
          _section(
            'Liên hệ khác',
            matchingContacts.isEmpty
                ? [
                    const Padding(
                      padding: EdgeInsets.all(18),
                      child: Text(
                        'Chưa có liên hệ khác.',
                        style: TextStyle(color: socoMuted),
                      ),
                    ),
                  ]
                : [
                    for (final room in matchingContacts)
                      row(room, group: false),
                  ],
          ),
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 980),
        child: Container(
          margin: const EdgeInsets.fromLTRB(11, 0, 11, 14),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: socoLine),
            borderRadius: BorderRadius.circular(19),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D243572),
                blurRadius: 24,
                offset: Offset(0, 7),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(17, 15, 17, 11),
                child: Text(
                  title,
                  style: const TextStyle(
                    color: Color(0xFF1A2948),
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              ...children.map(
                (child) =>
                    Material(type: MaterialType.transparency, child: child),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PersonRow extends StatelessWidget {
  const _PersonRow({
    required this.person,
    required this.fetchProfileImage,
    required this.label,
    required this.onTap,
    this.busy = false,
    this.secondaryLabel,
    this.onSecondary,
  });

  final Json person;
  final bool fetchProfileImage;
  final bool busy;
  final String label;
  final VoidCallback onTap;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: busy ? null : onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 66),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFEDF0F2))),
        ),
        child: Row(
          children: [
            UserAvatar(
              name:
                  person['displayName']?.toString() ??
                  person['username']?.toString() ??
                  '',
              username: person['username']?.toString(),
              size: 46,
              online: person['online'] == true,
              fetchProfileImage: fetchProfileImage,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '@${person['username']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: socoNavy,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    person['online'] == true ? 'Đang hoạt động' : 'Ngoại tuyến',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            if (secondaryLabel != null)
              TextButton(
                onPressed: busy ? null : onSecondary,
                child: Text(secondaryLabel!),
              ),
            TextButton(
              onPressed: busy ? null : onTap,
              child: busy
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(label, style: const TextStyle(fontSize: 12)),
                        if (label == 'Nhắn tin') ...[
                          const SizedBox(width: 3),
                          const Icon(Icons.chevron_right_rounded, size: 19),
                        ],
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
