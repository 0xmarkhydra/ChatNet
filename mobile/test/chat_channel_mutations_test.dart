import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/api.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';

class _ChannelMutationApi extends DemoApi {
  final requests = <String>[];
  final bodies = <Json?>[];
  final channelListRequests = <String>[];
  final _eventController = StreamController<void>.broadcast();
  final failures = <String, ApiError>{};
  int historyCutoff = 20;

  @override
  Stream<void> events() => _eventController.stream;

  void emitEvent() => _eventController.add(null);

  Future<void> closeEvents() => _eventController.close();

  void _record(String method, String path, Json? body) {
    requests.add('$method $path');
    bodies.add(body == null ? null : Map<String, dynamic>.from(body));
  }

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    final parts = Uri.parse(path).pathSegments;
    final data = body ?? <String, dynamic>{};

    if (parts.length == 4 &&
        parts[0] == 'api' &&
        parts[1] == 'conversations' &&
        parts[3] == 'channels') {
      final roomId = int.parse(parts[2]);
      if (method == 'GET') {
        channelListRequests.add(path);
        return (channels[roomId] ?? [])
            .where((channel) => channel['deletedAt'] == null)
            .map((channel) => Map<String, dynamic>.from(channel))
            .toList();
      }
      if (method == 'POST') {
        _record(method, path, body);
        if (failures[path] case final error?) throw error;
        final channel = {'id': 6, ...data};
        channels.putIfAbsent(roomId, () => []).add(channel);
        return Map<String, dynamic>.from(channel);
      }
    }

    if (parts.length == 5 &&
        parts[0] == 'api' &&
        parts[1] == 'conversations' &&
        parts[3] == 'channels') {
      final roomId = int.parse(parts[2]);
      final channelId = int.parse(parts[4]);
      final items = channels[roomId] ?? [];
      final channel = items.firstWhere((item) => item['id'] == channelId);
      _record(method, path, body);
      if (failures[path] case final error?) throw error;
      if (method == 'PATCH') {
        channel.addAll(data);
        return Map<String, dynamic>.from(channel);
      }
      if (method == 'DELETE') {
        channel['deletedAt'] = '2026-11-25T10:00:00Z';
        return Map<String, dynamic>.from(channel);
      }
    }

    if (parts.length == 6 &&
        parts[0] == 'api' &&
        parts[1] == 'conversations' &&
        parts[3] == 'channels' &&
        parts[5] == 'notifications') {
      final roomId = int.parse(parts[2]);
      final channelId = int.parse(parts[4]);
      final channel = channels[roomId]!.firstWhere(
        (item) => item['id'] == channelId,
      );
      if (method == 'GET') {
        _record(method, path, body);
        return {'muted': channel['muted'] == true};
      }
      if (method == 'PUT') {
        _record(method, path, body);
        if (failures[path] case final error?) throw error;
        channel['muted'] = data['muted'];
        return {'muted': channel['muted']};
      }
    }

    if (method == 'DELETE' && parts.length == 4 && parts.last == 'history') {
      _record(method, path, body);
      if (failures[path] case final error?) throw error;
      return {'clearedThroughMessageId': historyCutoff};
    }

    return super.request(method, path, body);
  }
}

Future<void> _openMobile(WidgetTester tester, DemoApi api) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  if (api is _ChannelMutationApi) {
    addTearDown(api.closeEvents);
  }
  await tester.pumpWidget(SocoApp(api: api));
  await tester.pumpAndSettle();
}

Future<void> _openGroupChannelInfo(
  WidgetTester tester, {
  bool subchannel = false,
}) async {
  await tester.tap(find.text('SocCO Design Team').first);
  await tester.pumpAndSettle();
  await tester.tap(
    find.text(subchannel ? 'Thiết kế UI' : 'Thảo luận chung').first,
  );
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('chat-more-actions')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('group owner can open channel creation form', (tester) async {
    final api = _ChannelMutationApi();
    await _openMobile(tester, api);
    await _openGroupChannelInfo(tester);
    await tester.tap(find.text('Tạo kênh').last);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('channel-create-name')), findsOneWidget);
    expect(find.byKey(const ValueKey('channel-create-topic')), findsOneWidget);
  });

  testWidgets('channel rename form starts with current name', (tester) async {
    final api = _ChannelMutationApi();
    await _openMobile(tester, api);
    await _openGroupChannelInfo(tester, subchannel: true);
    await tester.tap(find.text('Đổi tên kênh').last);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<EditableText>(find.byType(EditableText).last)
          .controller
          .text,
      'Thiết kế UI',
    );
  });

  testWidgets('channel topic form starts with current description', (
    tester,
  ) async {
    final api = _ChannelMutationApi();
    await _openMobile(tester, api);
    await _openGroupChannelInfo(tester, subchannel: true);
    await tester.tap(find.text('Sửa chủ đề kênh').last);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<EditableText>(find.byType(EditableText).last)
          .controller
          .text,
      'Cập nhật giao diện',
    );
  });

  testWidgets('baseline: general channel has no mute action', (tester) async {
    final api = _ChannelMutationApi();
    await _openMobile(tester, api);
    await _openGroupChannelInfo(tester);

    expect(find.text('Tắt thông báo kênh'), findsNothing);
    expect(find.text('Bật thông báo kênh'), findsNothing);
    expect(
      api.requests.where((request) => request.contains('/notifications')),
      isEmpty,
    );
  });

  testWidgets('subchannel mute reads then updates setting', (tester) async {
    final api = _ChannelMutationApi();
    await _openMobile(tester, api);
    await _openGroupChannelInfo(tester, subchannel: true);
    await tester.tap(find.text('Tắt thông báo kênh').last);
    await tester.pumpAndSettle();

    expect(api.requests, [
      'GET /api/conversations/1/channels/5/notifications',
      'PUT /api/conversations/1/channels/5/notifications',
    ]);
    expect(api.bodies.last, {'muted': true});
    expect(api.channels[1]!.last['muted'], true);
  });

  testWidgets('subchannel mute failure preserves current setting', (
    tester,
  ) async {
    final api = _ChannelMutationApi()
      ..failures['/api/conversations/1/channels/5/notifications'] =
          const ApiError('403 Forbidden', 403);
    await _openMobile(tester, api);
    await _openGroupChannelInfo(tester, subchannel: true);
    await tester.tap(find.text('Tắt thông báo kênh').last);
    await tester.pumpAndSettle();

    expect(find.textContaining('403 Forbidden'), findsOneWidget);
    expect(api.channels[1]!.last['muted'], isNot(true));
  });

  testWidgets('channel delete requires confirmation and removes channel', (
    tester,
  ) async {
    final api = _ChannelMutationApi();
    await _openMobile(tester, api);
    await _openGroupChannelInfo(tester, subchannel: true);
    final messagesBefore = [
      for (final message in api.messages[1]!)
        Map<String, dynamic>.from(message),
    ];
    await tester.tap(find.text('Xóa kênh').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xóa kênh').last);
    await tester.pumpAndSettle();

    expect(api.requests, contains('DELETE /api/conversations/1/channels/5'));
    expect(api.bodies.last, isNull);
    expect(
      api.channels[1]!.firstWhere((channel) => channel['id'] == 5)['deletedAt'],
      isNotNull,
    );
    expect(api.messages[1], messagesBefore);
    expect(
      api.messages[1]!.firstWhere(
        (message) => message['id'] == 13,
      )['attachments'],
      isNotEmpty,
    );
    expect(
      api.requests.where((request) => request.contains('/messages/')),
      isEmpty,
    );
  });

  testWidgets('channel delete failure preserves channel and message state', (
    tester,
  ) async {
    final api = _ChannelMutationApi()
      ..failures['/api/conversations/1/channels/5'] = const ApiError(
        '403 Forbidden',
        403,
      );
    await _openMobile(tester, api);
    await _openGroupChannelInfo(tester, subchannel: true);
    await tester.tap(find.text('Xóa kênh').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xóa kênh').last);
    await tester.pumpAndSettle();

    expect(find.textContaining('403 Forbidden'), findsOneWidget);
    expect(api.channels[1]!.any((channel) => channel['id'] == 5), isTrue);
    expect(
      api.channels[1]!.firstWhere((channel) => channel['id'] == 5)['deletedAt'],
      isNull,
    );
    expect(
      api.messages[1]!.firstWhere(
        (message) => message['id'] == 13,
      )['attachments'],
      isNotEmpty,
    );
  });

  testWidgets('baseline: history delete ignores response cutoff', (
    tester,
  ) async {
    final api = _ChannelMutationApi();
    api.messages[2]!.add(
      api.message(21, 2, 2, 'Linh Nguyễn', 'Message after cutoff'),
    );
    api.historyCutoff = 20;
    await _openMobile(tester, api);
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('chat-more-actions')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xóa lịch sử trò chuyện').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xóa lịch sử').last);
    await tester.pumpAndSettle();

    expect(api.requests, contains('DELETE /api/conversations/2/history'));
    expect(api.bodies.last, isNull);
    expect(api.historyCutoff, 20);
    expect(api.messages[2]!.map((message) => message['id']), contains(21));
    expect(find.text('Message after cutoff'), findsNothing);
    expect(find.text('Bắt đầu trò chuyện'), findsOneWidget);
  });

  testWidgets('history failure keeps current messages visible', (tester) async {
    final api = _ChannelMutationApi()
      ..failures['/api/conversations/2/history'] = const ApiError(
        '503 Service Unavailable',
        503,
      );
    await _openMobile(tester, api);
    await tester.tap(find.text('Linh Nguyễn').first);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('chat-more-actions')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xóa lịch sử trò chuyện').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xóa lịch sử').last);
    await tester.pumpAndSettle();

    expect(find.textContaining('503 Service Unavailable'), findsOneWidget);
    expect(find.textContaining('vừa cập nhật bảng màu mới.'), findsOneWidget);
  });

  testWidgets('baseline: channel SSE does not reload channel list', (
    tester,
  ) async {
    final api = _ChannelMutationApi();
    await _openMobile(tester, api);
    await _openGroupChannelInfo(tester, subchannel: true);
    await tester.tap(find.byKey(const ValueKey('chat-info-close')));
    await tester.pumpAndSettle();

    api.channels[1]!.last['muted'] = true;
    final readsBeforeEvent = api.channelListRequests.length;
    api.emitEvent();
    await tester.pumpAndSettle();

    expect(api.channelListRequests.length, readsBeforeEvent);
    await tester.tap(find.byKey(const ValueKey('chat-more-actions')));
    await tester.pumpAndSettle();
    expect(find.text('Tắt thông báo kênh'), findsOneWidget);
  });
}
