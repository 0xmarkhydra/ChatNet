import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'state/app_providers.dart';

import 'api.dart';
import 'call_surface.dart';
import 'theme.dart';
import 'widgets.dart';

/// Call history lives in Contacts, as it does in the mobile PWA.
class CallHistoryScreen extends ConsumerStatefulWidget {
  const CallHistoryScreen({
    super.key,
    required this.api,
    required this.onOpenConversation,
    this.query = '',
  });

  final Api api;
  final ValueChanged<Json> onOpenConversation;
  final String query;

  @override
  ConsumerState<CallHistoryScreen> createState() => _CallHistoryScreenState();
}

class _CallHistoryScreenState extends ConsumerState<CallHistoryScreen> {
  final callSearchController = TextEditingController();
  List<Json> calls = [];
  List<Json> conversations = [];
  String filter = 'all';
  String error = '';
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  void dispose() {
    callSearchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      // A room-list failure must not hide an otherwise available call history.
      ref.invalidate(callHistoryProvider);
      final history = await ref.read(callHistoryProvider.future);
      List<Json> rooms = conversations;
      try {
        rooms = objects(
          await widget.api.request('GET', '/api/conversations?limit=100'),
        );
      } catch (_) {
        // Entries remain available, even without matching room metadata.
      }
      if (!mounted) return;
      setState(() {
        calls = history.map((call) => call.toJson()).toList();
        conversations = rooms;
        loading = false;
        error = '';
      });
    } catch (cause) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = cause.toString();
      });
    }
  }

  Json? _room(Json call) {
    final id = call['conversationId'];
    for (final room in conversations) {
      if (room['id'] == id) return room;
    }
    return null;
  }

  bool _missed(Json call) =>
      call['createdBy'] != widget.api.user['id'] &&
      call['joined'] != true &&
      call['declined'] != true;

  bool _outgoing(Json call) => call['createdBy'] == widget.api.user['id'];

  String _status(Json call) {
    if (_missed(call)) return 'Gọi nhỡ';
    if (call['declined'] == true) return 'Đã từ chối';
    if (call['joined'] == true && call['startedAt'] != null) {
      return _outgoing(call) ? 'Đã gọi' : 'Đã nhận';
    }
    return 'Không kết nối';
  }

  String _duration(Json call) {
    if (call['joined'] != true || call['status'] != 'ended') return '00:00';
    final start = DateTime.tryParse(call['startedAt']?.toString() ?? '');
    final end = DateTime.tryParse(call['endedAt']?.toString() ?? '');
    if (start == null || end == null || end.isBefore(start)) return '00:00';
    final elapsed = end.difference(start);
    final minutes = elapsed.inMinutes.toString().padLeft(2, '0');
    final seconds = (elapsed.inSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  String _callName(Json call) {
    final room = _room(call);
    if (room != null) return room['name']?.toString() ?? 'Cuộc gọi';
    return call['isGroup'] == true ? 'Cuộc gọi nhóm' : 'Cuộc gọi';
  }

  String _formatDate(Object? date) {
    final value = DateTime.tryParse(date?.toString() ?? '')?.toLocal();
    if (value == null) return date?.toString() ?? '';
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(value.day)}/${two(value.month)} '
        '${two(value.hour)}:${two(value.minute)}';
  }

  Future<void> _openDetails(Json call) async {
    final room = _room(call);
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              UserAvatar(
                name: _callName(call),
                username: room?['otherUsername']?.toString(),
                group: call['isGroup'] == true,
                size: 66,
                fetchProfileImage: !widget.api.isDemo,
              ),
              const SizedBox(height: 10),
              Text(
                _callName(call),
                style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: socoNavy,
                ),
              ),
              const SizedBox(height: 6),
              Text(_status(call), style: const TextStyle(color: socoMuted)),
              const SizedBox(height: 18),
              ListTile(
                leading: Icon(
                  call['mediaType'] == 'video'
                      ? Icons.videocam_outlined
                      : Icons.call_outlined,
                ),
                title: const Text('Loại cuộc gọi'),
                trailing: Text(
                  call['mediaType'] == 'video' ? 'Video' : 'Thoại',
                ),
              ),
              ListTile(
                leading: const Icon(Icons.timer_outlined),
                title: const Text('Thời lượng'),
                trailing: Text(_duration(call)),
              ),
              ListTile(
                leading: const Icon(Icons.event_outlined),
                title: const Text('Thời điểm'),
                subtitle: Text(_formatDate(call['createdAt'])),
              ),
              ListTile(
                leading: const Icon(Icons.people_outline_rounded),
                title: const Text('Người tham gia'),
                trailing: Text(
                  '${call['participantCount'] ?? 0} người đã kết nối',
                ),
              ),
              if (room != null)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(sheetContext);
                          widget.onOpenConversation(room);
                        },
                        icon: const Icon(Icons.chat_bubble_outline_rounded),
                        label: const Text('Nhắn tin'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () {
                          Navigator.pop(sheetContext);
                          showCallSurface(
                            context,
                            api: widget.api,
                            conversation: room,
                            video: call['mediaType'] == 'video',
                          );
                        },
                        icon: const Icon(Icons.call_outlined),
                        label: const Text('Gọi lại'),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statCard({
    required int count,
    required String label,
    required IconData icon,
    bool danger = false,
  }) => Container(
    height: 77,
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: socoLine),
      borderRadius: BorderRadius.circular(13),
    ),
    child: Row(
      children: [
        Icon(
          icon,
          color: danger ? const Color(0xFFE0525D) : socoBlue,
          size: 23,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: danger ? const Color(0xFFE0525D) : socoNavy,
                ),
              ),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: socoMuted),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error.isNotEmpty && calls.isEmpty) {
      return EmptyState(
        icon: Icons.phone_disabled_outlined,
        title: 'Không tải được lịch sử cuộc gọi',
        description: error,
        action: FilledButton(onPressed: _refresh, child: const Text('Thử lại')),
      );
    }
    final query =
        (callSearchController.text.trim().isNotEmpty
                ? callSearchController.text
                : widget.query)
            .toLowerCase()
            .trim();
    final visible = calls.where((call) {
      final matches =
          query.isEmpty || _callName(call).toLowerCase().contains(query);
      if (!matches) return false;
      return switch (filter) {
        'missed' => _missed(call),
        'outgoing' => _outgoing(call),
        'group' => call['isGroup'] == true,
        _ => true,
      };
    }).toList();
    visible.sort(
      (a, b) => (b['createdAt']?.toString() ?? '').compareTo(
        a['createdAt']?.toString() ?? '',
      ),
    );
    final now = DateTime.now();
    final monthCount = calls.where((call) {
      final created = DateTime.tryParse(
        call['createdAt']?.toString() ?? '',
      )?.toLocal();
      return created != null &&
          created.year == now.year &&
          created.month == now.month;
    }).length;
    final missedCount = calls.where(_missed).length;

    return ColoredBox(
      color: socoCanvas,
      child: Column(
        children: [
          Padding(
            key: const ValueKey('calls-statistics'),
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: _statCard(
                    count: monthCount,
                    label: 'Cuộc gọi tháng này',
                    icon: Icons.calendar_month_outlined,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _statCard(
                    count: missedCount,
                    label: 'Cuộc gọi nhỡ',
                    icon: Icons.phone_missed_outlined,
                    danger: true,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: SizedBox(
              height: 42,
              child: TextField(
                key: const ValueKey('calls-local-search'),
                controller: callSearchController,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Tìm cuộc gọi...',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: callSearchController.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Xóa tìm kiếm cuộc gọi',
                          onPressed: () => setState(callSearchController.clear),
                          icon: const Icon(Icons.close_rounded),
                        ),
                  isDense: true,
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderSide: const BorderSide(color: socoLine),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ),
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(12, 9, 12, 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final item in const [
                    ('all', 'Tất cả'),
                    ('missed', 'Gọi nhỡ'),
                    ('outgoing', 'Gọi đi'),
                    ('group', 'Nhóm'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 7),
                      child: ChoiceChip(
                        label: Text(item.$2),
                        selected: filter == item.$1,
                        onSelected: (_) => setState(() => filter = item.$1),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: visible.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 90),
                        EmptyState(
                          icon: Icons.call_outlined,
                          title: 'Chưa có cuộc gọi',
                          description: 'Lịch sử cuộc gọi sẽ xuất hiện tại đây.',
                        ),
                      ],
                    )
                  : ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 12,
                      ),
                      itemCount: visible.length + 1,
                      separatorBuilder: (_, _) => const SizedBox(height: 4),
                      itemBuilder: (context, index) {
                        if (index == 0) {
                          return const Padding(
                            padding: EdgeInsets.fromLTRB(6, 4, 6, 10),
                            child: Text(
                              'Cuộc gọi gần đây',
                              style: TextStyle(
                                fontSize: 16,
                                color: socoNavy,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          );
                        }
                        final call = visible[index - 1];
                        final missed = _missed(call);
                        return Card(
                          margin: EdgeInsets.zero,
                          elevation: 0,
                          color: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: ListTile(
                            onTap: () => _openDetails(call),
                            leading: UserAvatar(
                              name: _callName(call),
                              username: _room(
                                call,
                              )?['otherUsername']?.toString(),
                              group: call['isGroup'] == true,
                              size: 43,
                              fetchProfileImage: !widget.api.isDemo,
                            ),
                            title: Text(
                              _callName(call),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: missed
                                    ? const Color(0xFFE0525D)
                                    : socoNavy,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: Row(
                              children: [
                                Icon(
                                  _outgoing(call)
                                      ? Icons.call_made_rounded
                                      : missed
                                      ? Icons.call_missed_rounded
                                      : Icons.call_received_rounded,
                                  size: 15,
                                  color: missed
                                      ? const Color(0xFFE0525D)
                                      : socoMuted,
                                ),
                                const SizedBox(width: 5),
                                Expanded(
                                  child: Text(
                                    '${_status(call)} · ${_duration(call)}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  call['mediaType'] == 'video'
                                      ? Icons.videocam_outlined
                                      : Icons.call_outlined,
                                  color: socoBlue,
                                  size: 21,
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  displayTime(call['createdAt']),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: socoMuted,
                                  ),
                                ),
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
    );
  }
}
