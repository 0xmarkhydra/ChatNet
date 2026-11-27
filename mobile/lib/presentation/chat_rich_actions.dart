import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../state/app_providers.dart';
import '../api.dart';
import '../data/chat_local_state.dart';
import '../theme.dart';

// Group-scoped activity snapshot shared by timeline and pinned preview.
final groupActivitySnapshotProvider = FutureProvider.autoDispose
    .family<Json, int>((ref, roomId) async {
      final api = ref.watch(apiProvider);
      final epoch = api.generation;
      ref.listen(realtimeEventProvider, (previous, next) {
        final event = next.value;
        if (event != null &&
            event['_revision'] != previous?.value?['_revision'] &&
            (event['type'] == 'reconnect' ||
                (event['type'] == 'group.activity' &&
                    event['conversationId'] == roomId))) {
          ref.invalidateSelf();
        }
      });
      final data = object(
        await api.request('GET', '/api/conversations/$roomId/activities'),
      );
      if (api.generation != epoch) throw const ApiError('Phiên đã thay đổi.');
      return data;
    });
String activityLabel(String kind) => switch (kind) {
  'poll' => 'Bình chọn',
  'note' => 'Ghi chú nhóm',
  'reminder' => 'Nhắc hẹn nhóm',
  _ => 'Hoạt động nhóm',
};
String chatDateTime(DateTime value) {
  final t = value.toLocal();
  String pad(int n) => n.toString().padLeft(2, '0');
  return '${pad(t.day)}/${pad(t.month)}/${t.year} · ${pad(t.hour)}:${pad(t.minute)}';
}

bool validScheduleTime(DateTime value, DateTime now) =>
    value.isAfter(now) && !value.isAfter(now.add(const Duration(days: 365)));

Future<DateTime?> pickChatDateTime(
  BuildContext context,
  DateTime initial,
) async {
  final now = DateTime.now();
  final last = now.add(const Duration(days: 365));
  final base = initial.isBefore(now)
      ? now
      : initial.isAfter(last)
      ? last
      : initial;
  final date = await showDatePicker(
    context: context,
    initialDate: base,
    firstDate: DateUtils.dateOnly(now),
    lastDate: DateUtils.dateOnly(last),
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(
    context: context,
    initialTime: TimeOfDay.fromDateTime(base),
  );
  if (time == null) return null;
  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}

Future<void> showScheduledChat(
  BuildContext context, {
  required Api api,
  required int roomId,
  required int channelId,
  required String draft,
}) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (_) => _ScheduledChat(
    api: api,
    roomId: roomId,
    channelId: channelId,
    draft: draft,
  ),
);

class _ScheduledChat extends StatefulWidget {
  const _ScheduledChat({
    required this.api,
    required this.roomId,
    required this.channelId,
    required this.draft,
  });
  final Api api;
  final int roomId, channelId;
  final String draft;
  @override
  State<_ScheduledChat> createState() => _ScheduledChatState();
}

class _ScheduledChatState extends State<_ScheduledChat> {
  late final epoch = widget.api.generation;
  late final text = TextEditingController(text: widget.draft);
  DateTime sendAt = DateTime.now().add(const Duration(minutes: 10));
  List<Json> rows = [];
  bool busy = false, loading = true;
  String error = '';
  String? pendingSignature, pendingId;
  String get path => '/api/conversations/${widget.roomId}/scheduled-messages';
  bool get current => mounted && epoch == widget.api.generation;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final result = await widget.api.request('GET', path);
      if (current) {
        setState(() {
          rows = objects(result)
              .where(
                (row) =>
                    ((row['channelId'] as num?)?.toInt() ?? 0) ==
                    widget.channelId,
              )
              .toList();
          loading = false;
          error = '';
        });
      }
    } catch (e) {
      if (current) {
        setState(() {
          loading = false;
          error = e.toString();
        });
      }
    }
  }

  Future<void> _perform(Future<void> Function() action) async {
    if (!current || busy) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await action();
      if (current) await _load();
    } catch (e) {
      if (current) setState(() => error = e.toString());
    } finally {
      if (current) setState(() => busy = false);
    }
  }

  Future<void> _create() async {
    final body = text.text.trim();
    if (body.isEmpty ||
        body.length > 4000 ||
        !validScheduleTime(sendAt, DateTime.now())) {
      setState(
        () => error =
            'Nhập nội dung và chọn thời gian gửi hợp lệ trong 365 ngày tới.',
      );
      return;
    }
    final instant = sendAt.toUtc().toIso8601String();
    final signature = '$instant:$body';
    if (pendingSignature != signature) {
      pendingSignature = signature;
      pendingId = ChatLocalState.clientId();
    }
    await _perform(() async {
      await widget.api.request('POST', path, {
        'text': body,
        'sendAt': instant,
        'channelId': widget.channelId,
        'clientId': pendingId,
      });
      if (current) {
        text.clear();
        pendingSignature = null;
        pendingId = null;
      }
    });
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: FractionallySizedBox(
          heightFactor: .86,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Hẹn giờ gửi',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Đóng',
                    onPressed: busy ? null : () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const Text(
                'Chỉ hẹn giờ nội dung văn bản; bản nháp ở ô soạn tin được giữ nguyên.',
                style: TextStyle(fontSize: 12, color: socoMuted),
              ),
              TextField(
                controller: text,
                enabled: !busy,
                maxLength: 4000,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Nội dung hẹn giờ',
                ),
              ),
              OutlinedButton.icon(
                onPressed: busy
                    ? null
                    : () async {
                        final value = await pickChatDateTime(context, sendAt);
                        if (current && value != null) {
                          setState(() => sendAt = value);
                        }
                      },
                icon: const Icon(Icons.schedule),
                label: Text(chatDateTime(sendAt)),
              ),
              FilledButton(
                onPressed: busy || loading ? null : _create,
                child: const Text('Tạo lịch gửi'),
              ),
              const SizedBox(height: 12),
              const Text(
                'Lịch gửi đang chờ',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              if (error.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(error, style: const TextStyle(color: Colors.red)),
                ),
              if (loading || busy) const LinearProgressIndicator(),
              if (!loading && rows.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('Chưa có lịch gửi'),
                ),
              for (final row in rows)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    row['text']?.toString() ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    DateTime.tryParse(row['sendAt']?.toString() ?? '') == null
                        ? ''
                        : chatDateTime(
                            DateTime.parse(row['sendAt'].toString()),
                          ),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        tooltip: 'Đổi thời gian gửi',
                        onPressed: busy
                            ? null
                            : () async {
                                final value = await pickChatDateTime(
                                  context,
                                  DateTime.tryParse(
                                        row['sendAt'].toString(),
                                      )?.toLocal() ??
                                      sendAt,
                                );
                                if (!current || value == null) return;
                                if (!validScheduleTime(value, DateTime.now())) {
                                  setState(
                                    () => error = 'Thời gian không hợp lệ.',
                                  );
                                  return;
                                }
                                await _perform(() async {
                                  await widget.api.request(
                                    'PATCH',
                                    '$path/${row['id']}',
                                    {'sendAt': value.toUtc().toIso8601String()},
                                  );
                                });
                              },
                        icon: const Icon(Icons.edit_calendar_outlined),
                      ),
                      IconButton(
                        tooltip: 'Hủy lịch gửi',
                        onPressed: busy
                            ? null
                            : () async {
                                final yes = await showDialog<bool>(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Text('Hủy lịch gửi?'),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(ctx, false),
                                        child: const Text('Không'),
                                      ),
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(ctx, true),
                                        child: const Text('Hủy lịch'),
                                      ),
                                    ],
                                  ),
                                );
                                if (yes == true && current) {
                                  await _perform(() async {
                                    await widget.api.request(
                                      'DELETE',
                                      '$path/${row['id']}',
                                    );
                                  });
                                }
                              },
                        icon: const Icon(Icons.delete_outline),
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
}

Future<void> showGroupActivities(
  BuildContext context, {
  required Api api,
  required int roomId,
  String? createKind,
  int? focusId,
}) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (_) => _Activities(
    api: api,
    roomId: roomId,
    createKind: createKind,
    focusId: focusId,
  ),
);

class _Activities extends ConsumerStatefulWidget {
  const _Activities({
    required this.api,
    required this.roomId,
    this.createKind,
    this.focusId,
  });
  final Api api;
  final int roomId;
  final String? createKind;
  final int? focusId;
  @override
  ConsumerState<_Activities> createState() => _ActivitiesState();
}

class _ActivitiesState extends ConsumerState<_Activities> {
  late final epoch = widget.api.generation;
  final body = TextEditingController();
  final options = [TextEditingController(), TextEditingController()];
  late String? kind = widget.createKind;
  late int? focusId = widget.focusId;
  String filter = 'all', error = '';
  bool pinned = false, busy = false, loading = true;
  DateTime remindAt = DateTime.now().add(const Duration(hours: 1));
  List<Json> items = [];
  String get path => '/api/conversations/${widget.roomId}/activities';
  bool get current => mounted && epoch == widget.api.generation;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    body.dispose();
    for (final c in options) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = object(await widget.api.request('GET', path));
      if (current) {
        setState(() {
          items = objects(data['activities']);
          loading = false;
          error = '';
        });
      }
    } catch (e) {
      if (current) {
        setState(() {
          loading = false;
          error = e.toString();
        });
      }
    }
  }

  Future<void> _perform(Future<void> Function() action) async {
    if (!current || busy) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await action();
      if (current) {
        ref.invalidate(groupActivitySnapshotProvider(widget.roomId));
        await _load();
      }
    } catch (e) {
      if (current) setState(() => error = e.toString());
    } finally {
      if (current) setState(() => busy = false);
    }
  }

  Future<void> _create() async {
    final selected = kind;
    if (selected == null) return;
    final cleaned = options.map((c) => c.text.trim()).toList();
    if ((selected == 'poll' &&
            (cleaned.any((v) => v.isEmpty) ||
                cleaned.toSet().length != cleaned.length)) ||
        (selected == 'note' && body.text.trim().isEmpty) ||
        (selected == 'reminder' &&
            !validScheduleTime(remindAt, DateTime.now()))) {
      setState(
        () => error = 'Vui lòng kiểm tra nội dung, lựa chọn hoặc thời gian.',
      );
      return;
    }
    await _perform(() async {
      await widget.api.request('POST', path, {
        'kind': selected,
        'title': activityLabel(selected),
        'body': body.text.trim(),
        'options': selected == 'poll' ? cleaned : <String>[],
        'pin': pinned,
        if (selected == 'reminder')
          'scheduledAt': remindAt.toUtc().toIso8601String(),
      });
      if (current) {
        setState(() {
          kind = null;
          body.clear();
          pinned = false;
          for (final c in options) {
            c.clear();
          }
        });
      }
    });
  }

  Widget _activity(Json item) {
    final kind = item['kind']?.toString() ?? '';
    final choices = (item['options'] as List?) ?? [];
    final counts = (item['counts'] as List?) ?? [];
    final total = counts.whereType<num>().fold<num>(0, (a, b) => a + b);
    final isPinned =
        item['pinnedAt'] != null && item['pinnedAt'].toString().isNotEmpty;
    final date = DateTime.tryParse(item['scheduledAt']?.toString() ?? '');
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    activityLabel(kind),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  tooltip: isPinned ? 'Bỏ ghim hoạt động' : 'Ghim hoạt động',
                  onPressed: busy
                      ? null
                      : () => _perform(() async {
                          await widget.api.request(
                            isPinned ? 'DELETE' : 'PUT',
                            '$path/${item['id']}/pin',
                          );
                        }),
                  icon: Icon(
                    isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                    color: socoBlue,
                  ),
                ),
              ],
            ),
            if (item['body']?.toString().isNotEmpty == true)
              Text(item['body'].toString()),
            if (date != null) Text(chatDateTime(date)),
            if (kind == 'poll') ...[
              Text('$total lượt bình chọn'),
              for (var i = 0; i < choices.length; i++)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: OutlinedButton(
                    onPressed: busy || item['myVote'] == i
                        ? null
                        : () => _perform(() async {
                            await widget.api.request(
                              'POST',
                              '$path/${item['id']}/vote',
                              {'optionIndex': i},
                            );
                          }),
                    child: Row(
                      children: [
                        Icon(
                          item['myVote'] == i
                              ? Icons.radio_button_checked
                              : Icons.radio_button_unchecked,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: Text(choices[i].toString())),
                        Text('${i < counts.length ? counts[i] : 0} phiếu'),
                      ],
                    ),
                  ),
                ),
            ],
            if (item['creatorName'] != null)
              Text(
                'Tạo bởi ${item['creatorName']}',
                style: const TextStyle(color: socoMuted, fontSize: 11),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<Json>>(realtimeEventProvider, (previous, next) {
      final event = next.value;
      if (event != null &&
          event['_revision'] != previous?.value?['_revision'] &&
          (event['type'] == 'reconnect' ||
              (event['type'] == 'group.activity' &&
                  event['conversationId'] == widget.roomId)) &&
          !busy) {
        _load();
      }
    });
    return PopScope(
      canPop: !busy,
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: FractionallySizedBox(
            heightFactor: .86,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        kind == null
                            ? 'Bảng tin nhóm'
                            : 'Tạo ${activityLabel(kind!)}',
                        style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Đóng',
                      onPressed: busy ? null : () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                if (error.isNotEmpty)
                  Text(error, style: const TextStyle(color: Colors.red)),
                if (busy || loading) const LinearProgressIndicator(),
                if (kind != null) ...[
                  TextField(
                    controller: body,
                    enabled: !busy,
                    maxLength: 5000,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(labelText: 'Nội dung'),
                  ),
                  if (kind == 'poll') ...[
                    for (var i = 0; i < options.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: TextField(
                          key: ValueKey('poll-option-$i'),
                          controller: options[i],
                          enabled: !busy,
                          maxLength: 120,
                          decoration: InputDecoration(
                            labelText: 'Lựa chọn ${i + 1}',
                          ),
                        ),
                      ),
                    if (options.length < 10)
                      TextButton(
                        onPressed: busy
                            ? null
                            : () => setState(
                                () => options.add(TextEditingController()),
                              ),
                        child: const Text('+ Thêm lựa chọn'),
                      ),
                  ],
                  if (kind == 'reminder')
                    OutlinedButton(
                      onPressed: busy
                          ? null
                          : () async {
                              final value = await pickChatDateTime(
                                context,
                                remindAt,
                              );
                              if (current && value != null) {
                                setState(() => remindAt = value);
                              }
                            },
                      child: Text(chatDateTime(remindAt)),
                    ),
                  CheckboxListTile(
                    value: pinned,
                    onChanged: busy
                        ? null
                        : (value) => setState(() => pinned = value ?? false),
                    title: const Text('Ghim lên đầu cuộc trò chuyện nhóm'),
                  ),
                  const Text(
                    'Sau khi tạo, nội dung không thể sửa hoặc xóa. Tất cả thành viên nhóm đều xem và tương tác được.',
                  ),
                  FilledButton(
                    onPressed: busy || loading ? null : _create,
                    child: const Text('Tạo mới'),
                  ),
                  TextButton(
                    onPressed: busy ? null : () => setState(() => kind = null),
                    child: const Text('Quay lại bảng tin'),
                  ),
                ] else ...[
                  if (focusId != null)
                    TextButton(
                      onPressed: () => setState(() => focusId = null),
                      child: const Text('Xem tất cả hoạt động'),
                    ),
                  Wrap(
                    spacing: 6,
                    children: [
                      for (final type in ['poll', 'note', 'reminder'])
                        ActionChip(
                          label: Text('+ ${activityLabel(type)}'),
                          onPressed: busy
                              ? null
                              : () => setState(() => kind = type),
                        ),
                    ],
                  ),
                  Wrap(
                    spacing: 6,
                    children: [
                      for (final type in ['all', 'poll', 'note', 'reminder'])
                        ChoiceChip(
                          label: Text(
                            type == 'all' ? 'Tất cả' : activityLabel(type),
                          ),
                          selected: filter == type,
                          onSelected: (_) => setState(() {
                            filter = type;
                            focusId = null;
                          }),
                        ),
                    ],
                  ),
                  if (!loading &&
                      items
                          .where(
                            (item) =>
                                (focusId == null || item['id'] == focusId) &&
                                (filter == 'all' || item['kind'] == filter),
                          )
                          .isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('Chưa có hoạt động'),
                    ),
                  for (final item in items.where(
                    (item) =>
                        (focusId == null || item['id'] == focusId) &&
                        (filter == 'all' || item['kind'] == filter),
                  ))
                    _activity(item),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
