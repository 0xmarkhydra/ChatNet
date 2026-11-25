import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/api.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';
import 'package:soco/presentation/conversation_avatar.dart';
import 'package:soco/widgets.dart';

class _ConversationApi extends DemoApi {
  final StreamController<void> _eventController =
      StreamController<void>.broadcast();
  final List<String> conversationRequests = [];
  final List<String> groupPrefetchRequests = [];
  final List<String> conversationPinRequests = [];
  final List<String> messagePinRequests = [];
  final List<Json?> messagePinBodies = [];
  final List<String> messagePinListRequests = [];
  final List<String> reactionRequests = [];
  final List<Json> reactionBodies = [];
  final Map<int, Json> reactionMessages = {};
  final List<String> notificationRequests = [];
  final List<Json> notificationBodies = [];
  final List<Completer<List<Json>>> pendingConversationResponses = [];
  Completer<Json>? pendingNotificationSettingsRead;
  Completer<Json>? pendingNotificationSettingsWrite;
  final List<dynamic> pageResponses = [];
  Completer<void>? pendingConversationPinRequest;
  Completer<void>? pendingMessagePinRequest;
  Completer<Json>? pendingReactionResponse;
  bool failConversationReads = false;
  bool failPageReads = false;
  bool failConversationPinRequests = false;
  bool failMessagePinRequests = false;
  bool failReactionRequests = false;
  bool failNotificationSettingsRead = false;
  bool failNotificationSettingsWrite = false;

  @override
  Stream<void> events() => _eventController.stream;

  void emitEvent() => _eventController.add(null);

  Future<void> closeEvents() => _eventController.close();

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    if (method == 'POST' &&
        path.startsWith('/api/messages/') &&
        path.endsWith('/reactions')) {
      reactionRequests.add('$method $path');
      if (body != null) reactionBodies.add(Map<String, dynamic>.from(body));
      if (failReactionRequests) {
        throw const ApiError('Synthetic reaction failure');
      }
      final pending = pendingReactionResponse;
      if (pending != null) return pending.future;
      final messageId = int.parse(path.split('/')[3]);
      final message =
          reactionMessages[messageId] ??
          messages.values
              .expand((items) => items)
              .firstWhere((item) => item['id'] == messageId);
      final updated = Map<String, dynamic>.from(message);
      final reactions = objects(updated['reactions']);
      final old = reactions
          .where((reaction) => reaction['emoji'] == body?['emoji'])
          .firstOrNull;
      if (old != null) {
        reactions.remove(old);
      } else {
        reactions.add({'emoji': body?['emoji'], 'count': 1, 'mine': true});
      }
      updated['reactions'] = reactions;
      reactionMessages[messageId] = updated;
      return Map<String, dynamic>.from(updated);
    }
    if (path.startsWith('/api/messages/') && path.endsWith('/pin')) {
      messagePinRequests.add('$method $path');
      messagePinBodies.add(body);
      final pending = pendingMessagePinRequest;
      if (pending != null) await pending.future;
      if (failMessagePinRequests) {
        throw const ApiError('Synthetic message pin failure');
      }
      final messageId = int.parse(path.split('/')[3]);
      final message = messages.values
          .expand((items) => items)
          .firstWhere((item) => item['id'] == messageId);
      if (method == 'PUT') pinnedMessageIds.add(messageId);
      if (method == 'DELETE') pinnedMessageIds.remove(messageId);
      return Map<String, dynamic>.from(message);
    }
    if (path.startsWith('/api/conversations/') && path.endsWith('/pins')) {
      messagePinListRequests.add('$method $path');
      final roomId = int.parse(path.split('/')[3]);
      return [
        for (final message in messages[roomId] ?? <Json>[])
          if (pinnedMessageIds.contains(message['id']))
            {'message': message, 'pinnedAt': '2026-11-25T10:02:00Z'},
      ];
    }
    if (path.startsWith('/api/conversations/') && path.endsWith('/pin')) {
      conversationPinRequests.add('$method $path');
      final pending = pendingConversationPinRequest;
      if (pending != null) await pending.future;
      if (failConversationPinRequests) {
        throw const ApiError('Synthetic pin failure');
      }
      final conversationId = int.parse(path.split('/')[3]);
      final room = rooms.firstWhere((item) => item['id'] == conversationId);
      if (method == 'PUT') {
        room['pinnedAt'] = '2026-11-25T10:01:00Z';
      } else if (method == 'DELETE') {
        room.remove('pinnedAt');
      }
      return Map<String, dynamic>.from(room);
    }
    if (path.endsWith('/notification-settings')) {
      notificationRequests.add('$method $path');
      if (method == 'GET') {
        if (failNotificationSettingsRead) {
          throw const ApiError('Synthetic notification settings read failure');
        }
        if (pendingNotificationSettingsRead != null) {
          return pendingNotificationSettingsRead!.future;
        }
        return <String, dynamic>{
          'messageNotifications': true,
          'mentionNotifications': true,
        };
      }
      if (method == 'PUT') {
        if (body != null) {
          notificationBodies.add(Map<String, dynamic>.from(body));
        }
        if (failNotificationSettingsWrite) {
          throw const ApiError('Synthetic notification settings write failure');
        }
        if (pendingNotificationSettingsWrite != null) {
          return pendingNotificationSettingsWrite!.future;
        }
        return <String, dynamic>{
          'messageNotifications': body?['messageNotifications'],
          'mentionNotifications': body?['mentionNotifications'],
        };
      }
    }
    if (method == 'GET' &&
        path.startsWith('/api/conversations?type=group&limit=100&offset=')) {
      groupPrefetchRequests.add(path);
    }
    if (method == 'GET' && path.startsWith('/api/conversations?limit=25')) {
      conversationRequests.add(path);
      if (path != '/api/conversations?limit=25') {
        if (failPageReads) {
          throw const ApiError('Synthetic page failure');
        }
        if (pageResponses.isNotEmpty) return pageResponses.removeAt(0);
        return <Json>[];
      }
      if (failConversationReads) {
        throw const ApiError('Synthetic conversation failure');
      }
      if (pendingConversationResponses.isNotEmpty) {
        return pendingConversationResponses.removeAt(0).future;
      }
      return rooms.map((room) => Map<String, dynamic>.from(room)).toList();
    }
    return super.request(method, path, body);
  }
}

Map<String, dynamic> _room(
  int id,
  String name, {
  int unreadCount = 0,
  List<String> avatarMembers = const [],
  String? lastMessageAt,
}) => {
  'id': id,
  'type': 'group',
  'name': name,
  'memberCount': 4,
  'unreadCount': unreadCount,
  'online': false,
  'lastMessage': 'Synthetic last message',
  'createdAt': '2026-11-25T10:00:00Z',
  'lastMessageAt': lastMessageAt ?? '2026-11-25T10:00:00Z',
  'avatarMembers': avatarMembers,
};

List<Json> _conversationPage(int firstId, int count) => [
  for (var offset = 0; offset < count; offset++)
    _room(
      firstId + offset,
      'Room ${firstId + offset}',
      lastMessageAt: DateTime.utc(
        2026,
        11,
        25,
      ).subtract(Duration(minutes: firstId + offset)).toIso8601String(),
    ),
];

void _setViewport(WidgetTester tester, {Size size = const Size(390, 844)}) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Future<void> _pumpApp(
  WidgetTester tester,
  _ConversationApi api, {
  Key? key,
  Size size = const Size(390, 844),
}) async {
  _setViewport(tester, size: size);
  await tester.pumpWidget(SocoApp(key: key, api: api));
}

Future<void> _tapMuteAction(WidgetTester tester, int conversationId) async {
  await tester.longPress(find.byKey(ValueKey('rail-room-$conversationId')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Tắt thông báo hội thoại'));
  await tester.pump();
}

Future<void> _openDefaultGroupChat(
  WidgetTester tester,
  _ConversationApi api,
) async {
  api.preferences['autoTranslate'] = false;
  await _pumpApp(tester, api);
  await tester.pump();
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('rail-room-1')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Thảo luận chung'));
  await tester.pumpAndSettle();
}

Future<void> _reactToMessage(
  WidgetTester tester, {
  required int messageId,
  required String emoji,
}) async {
  await tester.longPress(find.byKey(ValueKey('chat-message-$messageId')));
  await tester.pumpAndSettle();
  await tester.tap(find.text(emoji));
  await tester.pumpAndSettle();
}

Future<void> _toggleMessagePin(
  WidgetTester tester, {
  required int messageId,
  bool settle = true,
}) async {
  await tester.longPress(find.byKey(ValueKey('chat-message-$messageId')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Ghim / Bỏ ghim tin nhắn'));
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}

void main() {
  testWidgets('initial conversation read shows loading then data', (
    tester,
  ) async {
    final response = Completer<List<Json>>();
    final api = _ConversationApi()..pendingConversationResponses.add(response);
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pump();

    expect(find.text('Synthetic room'), findsNothing);
    expect(api.conversationRequests, ['/api/conversations?limit=25']);

    response.complete([
      _room(
        41,
        'Synthetic room',
        avatarMembers: const ['member-a', 'member-b'],
      ),
    ]);
    await tester.pumpAndSettle();

    final row = find.byKey(const ValueKey('rail-room-41'));
    expect(row, findsOneWidget);
    final avatar = find.descendant(
      of: row,
      matching: find.byType(ConversationAvatarView),
    );
    expect(avatar, findsOneWidget);
    expect(
      find.descendant(of: avatar, matching: find.byType(UserAvatar)),
      findsNWidgets(2),
    );
  });

  testWidgets('empty conversation response shows empty state', (tester) async {
    final api = _ConversationApi();
    api.rooms.clear();
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();

    expect(find.byType(EmptyState), findsOneWidget);
    expect(find.byKey(const ValueKey('rail-room-41')), findsNothing);
  });

  testWidgets('SSE revision refreshes an in-flight initial read', (
    tester,
  ) async {
    final initialResponse = Completer<List<Json>>();
    final refreshResponse = Completer<List<Json>>();
    final api = _ConversationApi()
      ..pendingConversationResponses.addAll([initialResponse, refreshResponse]);
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pump();
    expect(api.conversationRequests, ['/api/conversations?limit=25']);

    api.emitEvent();
    await tester.pump();
    expect(api.conversationRequests, [
      '/api/conversations?limit=25',
      '/api/conversations?limit=25',
    ]);

    refreshResponse.complete([_room(47, 'SSE room')]);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('rail-room-47')), findsOneWidget);
    expect(find.byKey(const ValueKey('rail-room-48')), findsNothing);

    initialResponse.complete([_room(48, 'Initial room')]);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('rail-room-47')), findsOneWidget);
    expect(find.byKey(const ValueKey('rail-room-48')), findsOneWidget);
  });

  testWidgets('initial conversation failure can retry successfully', (
    tester,
  ) async {
    final api = _ConversationApi()..failConversationReads = true;
    api.rooms
      ..clear()
      ..add(_room(42, 'Recovered room'));
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    expect(find.byType(EmptyState), findsOneWidget);

    api.failConversationReads = false;
    await tester.tap(
      find.descendant(
        of: find.byType(EmptyState),
        matching: find.text('Thử lại'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('rail-room-42')), findsOneWidget);
    expect(api.conversationRequests, hasLength(2));
  });

  testWidgets('SSE refresh merges rows and failure retains last known rows', (
    tester,
  ) async {
    final api = _ConversationApi();
    api.rooms
      ..clear()
      ..addAll([_room(43, 'Updated room'), _room(44, 'Retained room')]);
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('rail-room-44')), findsOneWidget);

    api.rooms
      ..clear()
      ..add(_room(43, 'Updated room after SSE', unreadCount: 3));
    api.emitEvent();
    await tester.pumpAndSettle();

    expect(find.text('Updated room after SSE'), findsOneWidget);
    expect(find.byKey(const ValueKey('rail-room-44')), findsOneWidget);

    api.failConversationReads = true;
    api.emitEvent();
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('rail-room-43')), findsOneWidget);
    expect(find.byKey(const ValueKey('rail-room-44')), findsOneWidget);
    expect(api.conversationRequests, hasLength(3));
  });

  testWidgets('session replacement does not retain previous account rows', (
    tester,
  ) async {
    final firstApi = _ConversationApi();
    firstApi.rooms
      ..clear()
      ..add(_room(45, 'First session room'));
    final secondApi = _ConversationApi();
    secondApi.rooms
      ..clear()
      ..add(_room(46, 'Second session room'));
    addTearDown(firstApi.closeEvents);
    addTearDown(secondApi.closeEvents);

    await _pumpApp(tester, firstApi, key: const ValueKey('session-first'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('rail-room-45')), findsOneWidget);

    await _pumpApp(tester, secondApi, key: const ValueKey('session-second'));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('rail-room-45')), findsNothing);
    expect(find.byKey(const ValueKey('rail-room-46')), findsOneWidget);
  });

  testWidgets(
    'conversation pages use offsets, keep activity order and stop on short page',
    (tester) async {
      final api = _ConversationApi();
      api.rooms
        ..clear()
        ..addAll(_conversationPage(1, 25));
      api.pageResponses
        ..add(_conversationPage(26, 25))
        ..add(_conversationPage(51, 1));
      addTearDown(api.closeEvents);

      await _pumpApp(tester, api, size: const Size(390, 6000));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Tải thêm hội thoại'));
      await tester.pumpAndSettle();
      expect(
        api.conversationRequests,
        contains('/api/conversations?limit=25&offset=25'),
      );

      await tester.tap(find.text('Tải thêm hội thoại'));
      await tester.pumpAndSettle();
      expect(
        api.conversationRequests,
        contains('/api/conversations?limit=25&offset=50'),
      );
      expect(find.text('Tải thêm hội thoại'), findsNothing);

      final lastExisting = tester.getTopLeft(
        find.byKey(const ValueKey('rail-room-50')),
      );
      final lastPage = tester.getTopLeft(
        find.byKey(const ValueKey('rail-room-51')),
      );
      expect(lastExisting.dy, lessThan(lastPage.dy));

      final lastFirstPageRoom = tester.getTopLeft(
        find.byKey(const ValueKey('rail-room-25')),
      );
      final firstSecondPageRoom = tester.getTopLeft(
        find.byKey(const ValueKey('rail-room-26')),
      );
      expect(lastFirstPageRoom.dy, lessThan(firstSecondPageRoom.dy));
    },
  );

  testWidgets('conversation page failure retains loaded rows', (tester) async {
    final api = _ConversationApi()..failPageReads = true;
    api.rooms
      ..clear()
      ..addAll(_conversationPage(1, 25));
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    await tester.drag(
      find.byKey(const ValueKey('mobile-avatar-rail')),
      const Offset(0, -10000),
    );
    await tester.pumpAndSettle();

    expect(
      api.conversationRequests,
      contains('/api/conversations?limit=25&offset=25'),
    );
    expect(find.byKey(const ValueKey('rail-room-25')), findsOneWidget);
  });

  testWidgets('SSE refresh wins over stale duplicate in in-flight page', (
    tester,
  ) async {
    final pageResponse = Completer<List<Json>>();
    final refreshResponse = Completer<List<Json>>();
    final api = _ConversationApi();
    api.rooms
      ..clear()
      ..addAll(_conversationPage(1, 25));
    api.pageResponses.add(pageResponse.future);
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    await tester.drag(
      find.byKey(const ValueKey('mobile-avatar-rail')),
      const Offset(0, -10000),
    );
    await tester.pump();
    expect(
      api.conversationRequests,
      contains('/api/conversations?limit=25&offset=25'),
    );

    api.pendingConversationResponses.add(refreshResponse);
    api.emitEvent();
    await tester.pump();
    expect(api.conversationRequests, hasLength(3));
    refreshResponse.complete([_room(1, 'Fresh SSE room')]);
    await tester.pumpAndSettle();
    await tester.drag(
      find.byKey(const ValueKey('mobile-avatar-rail')),
      const Offset(0, 10000),
    );
    await tester.pumpAndSettle();
    expect(find.text('Fresh SSE room'), findsOneWidget);

    pageResponse.complete([
      _room(1, 'Stale page duplicate'),
      _room(26, 'Page room', lastMessageAt: '2026-11-24T00:00:00Z'),
    ]);
    await tester.pumpAndSettle();

    expect(find.text('Fresh SSE room'), findsOneWidget);
    expect(find.text('Stale page duplicate'), findsNothing);
    expect(find.byKey(const ValueKey('rail-room-1')), findsOneWidget);
    await tester.drag(
      find.byKey(const ValueKey('mobile-avatar-rail')),
      const Offset(0, -10000),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('rail-room-26')), findsOneWidget);
    expect(
      api.conversationRequests,
      contains('/api/conversations?limit=25&offset=25'),
    );
  });

  testWidgets('concurrent scrolls issue one conversation page request', (
    tester,
  ) async {
    final pageResponse = Completer<List<Json>>();
    final api = _ConversationApi();
    api.rooms
      ..clear()
      ..addAll(_conversationPage(1, 25));
    api.pageResponses.add(pageResponse.future);
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    final rail = find.byKey(const ValueKey('mobile-avatar-rail'));
    await tester.drag(rail, const Offset(0, -10000));
    await tester.pump();
    await tester.drag(rail, const Offset(0, 500));
    await tester.pump();
    await tester.drag(rail, const Offset(0, -10000));
    await tester.pump();

    expect(
      api.conversationRequests.where(
        (path) => path == '/api/conversations?limit=25&offset=25',
      ),
      hasLength(1),
    );

    pageResponse.complete(_conversationPage(26, 1));
    await tester.pumpAndSettle();
  });

  testWidgets('desktop conversation list scroll also loads next page', (
    tester,
  ) async {
    final api = _ConversationApi();
    api.rooms
      ..clear()
      ..addAll(_conversationPage(1, 25));
    api.pageResponses.add(_conversationPage(26, 1));
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api, size: const Size(1440, 900));
    await tester.pumpAndSettle();
    final room = find.text('Room 1');
    final list = find
        .ancestor(of: room, matching: find.byType(Scrollable))
        .first;
    await tester.drag(list, const Offset(0, -10000));
    await tester.pumpAndSettle();

    expect(
      api.conversationRequests,
      contains('/api/conversations?limit=25&offset=25'),
    );
  });

  testWidgets('SSE refresh respects older group prefetch cooldown', (
    tester,
  ) async {
    final api = _ConversationApi();
    api.rooms
      ..clear()
      ..addAll(_conversationPage(1, 25));
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    final initialPrefetchCount = api.groupPrefetchRequests.length;
    expect(initialPrefetchCount, greaterThan(0));

    api.emitEvent();
    await tester.pumpAndSettle();

    expect(api.groupPrefetchRequests, hasLength(initialPrefetchCount));
  });

  testWidgets('conversation pin and unpin use PUT and DELETE', (tester) async {
    final api = _ConversationApi();
    api.rooms
      ..clear()
      ..add(_room(61, 'Pin room'));
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();

    await tester.longPress(find.byKey(const ValueKey('rail-room-61')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ghim hội thoại'));
    await tester.pumpAndSettle();

    expect(api.conversationPinRequests, ['PUT /api/conversations/61/pin']);
    expect(api.conversationRequests, hasLength(2));

    await tester.longPress(find.byKey(const ValueKey('rail-room-61')));
    await tester.pumpAndSettle();
    expect(find.text('Bỏ ghim hội thoại'), findsOneWidget);
    await tester.tap(find.text('Bỏ ghim hội thoại'));
    await tester.pumpAndSettle();

    expect(api.conversationPinRequests, [
      'PUT /api/conversations/61/pin',
      'DELETE /api/conversations/61/pin',
    ]);
    expect(api.conversationRequests, hasLength(3));
    await tester.longPress(find.byKey(const ValueKey('rail-room-61')));
    await tester.pumpAndSettle();
    expect(find.text('Ghim hội thoại'), findsOneWidget);
  });

  testWidgets('failed conversation pin keeps state and skips refresh', (
    tester,
  ) async {
    final api = _ConversationApi()..failConversationPinRequests = true;
    api.rooms
      ..clear()
      ..add(_room(62, 'Pin failure room'));
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();

    await tester.longPress(find.byKey(const ValueKey('rail-room-62')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ghim hội thoại'));
    await tester.pumpAndSettle();

    expect(api.conversationPinRequests, ['PUT /api/conversations/62/pin']);
    expect(api.conversationRequests, hasLength(1));
    expect(find.textContaining('Synthetic pin failure'), findsOneWidget);
    await tester.longPress(find.byKey(const ValueKey('rail-room-62')));
    await tester.pumpAndSettle();
    expect(find.text('Ghim hội thoại'), findsOneWidget);
  });

  testWidgets('SSE update stays visible while conversation pin is in flight', (
    tester,
  ) async {
    final pinResponse = Completer<void>();
    final refreshResponse = Completer<List<Json>>();
    final api = _ConversationApi()..pendingConversationPinRequest = pinResponse;
    api.rooms
      ..clear()
      ..add(_room(63, 'Before SSE'));
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();

    await tester.longPress(find.byKey(const ValueKey('rail-room-63')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ghim hội thoại'));
    await tester.pumpAndSettle();
    expect(api.conversationPinRequests, ['PUT /api/conversations/63/pin']);

    api.rooms.single
      ..['name'] = 'SSE update'
      ..['pinnedAt'] = '2026-11-25T10:02:00Z';
    api.pendingConversationResponses.add(refreshResponse);
    api.emitEvent();
    await tester.pump();
    expect(api.conversationRequests, hasLength(2));

    refreshResponse.complete([Map<String, dynamic>.from(api.rooms.single)]);
    await tester.pumpAndSettle();
    expect(find.text('SSE update'), findsOneWidget);

    pinResponse.complete();
    await tester.pumpAndSettle();
    expect(api.conversationRequests, hasLength(3));
    expect(find.text('SSE update'), findsOneWidget);
    await tester.longPress(find.byKey(const ValueKey('rail-room-63')));
    await tester.pumpAndSettle();
    expect(find.text('Bỏ ghim hội thoại'), findsOneWidget);
  });

  testWidgets('message pin and unpin use PUT and DELETE', (tester) async {
    final api = _ConversationApi();
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    final initialPinReads = api.messagePinListRequests.length;

    await _toggleMessagePin(tester, messageId: 10);

    expect(api.messagePinRequests, ['PUT /api/messages/10/pin']);
    expect(api.messagePinBodies, [null]);
    expect(api.messagePinListRequests, hasLength(initialPinReads + 1));
    expect(find.byTooltip('Bỏ ghim'), findsOneWidget);

    await _toggleMessagePin(tester, messageId: 10);

    expect(api.messagePinRequests, [
      'PUT /api/messages/10/pin',
      'DELETE /api/messages/10/pin',
    ]);
    expect(api.messagePinBodies, [null, null]);
    expect(api.messagePinListRequests, hasLength(initialPinReads + 2));
    expect(find.byTooltip('Bỏ ghim'), findsNothing);
  });

  testWidgets('failed message pin keeps current pins and skips refresh', (
    tester,
  ) async {
    final api = _ConversationApi()..failMessagePinRequests = true;
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    final initialPinReads = api.messagePinListRequests.length;
    await _toggleMessagePin(tester, messageId: 10);

    expect(api.messagePinRequests, ['PUT /api/messages/10/pin']);
    expect(api.messagePinListRequests, hasLength(initialPinReads));
    expect(find.byTooltip('Bỏ ghim'), findsNothing);
    expect(
      find.textContaining('Synthetic message pin failure'),
      findsOneWidget,
    );
  });

  testWidgets('SSE pin refresh stays visible while message pin is in flight', (
    tester,
  ) async {
    final pending = Completer<void>();
    final api = _ConversationApi()..pendingMessagePinRequest = pending;
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    await _toggleMessagePin(tester, messageId: 10, settle: false);
    expect(api.messagePinRequests, ['PUT /api/messages/10/pin']);

    api.pinnedMessageIds.add(10);
    api.emitEvent();
    await tester.pumpAndSettle();
    expect(find.byTooltip('Bỏ ghim'), findsOneWidget);

    pending.complete();
    await tester.pumpAndSettle();
    expect(find.byTooltip('Bỏ ghim'), findsOneWidget);
  });

  testWidgets('conversation mute reads settings before writing them', (
    tester,
  ) async {
    final readResponse = Completer<Json>();
    final api = _ConversationApi()
      ..pendingNotificationSettingsRead = readResponse;
    api.rooms
      ..clear()
      ..add(_room(70, 'Mute room')..['muted'] = false);
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    await _tapMuteAction(tester, 70);

    expect(api.notificationRequests, [
      'GET /api/conversations/70/notification-settings',
    ]);

    readResponse.complete({
      'messageNotifications': true,
      'mentionNotifications': true,
    });
    await tester.pump();
    expect(api.notificationRequests, [
      'GET /api/conversations/70/notification-settings',
      'PUT /api/conversations/70/notification-settings',
    ]);

    await tester.pumpAndSettle();
    expect(api.notificationBodies.single, {
      'messageNotifications': false,
      'mentionNotifications': true,
    });
    await tester.longPress(find.byKey(const ValueKey('rail-room-70')));
    await tester.pumpAndSettle();
    expect(find.text('Bật thông báo hội thoại'), findsOneWidget);
  });

  testWidgets('notification settings read failure skips write', (tester) async {
    final api = _ConversationApi()..failNotificationSettingsRead = true;
    api.rooms
      ..clear()
      ..add(_room(71, 'Read failure room')..['muted'] = false);
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    await _tapMuteAction(tester, 71);
    await tester.pumpAndSettle();

    expect(api.notificationRequests, [
      'GET /api/conversations/71/notification-settings',
    ]);
    await tester.longPress(find.byKey(const ValueKey('rail-room-71')));
    await tester.pumpAndSettle();
    expect(find.text('Tắt thông báo hội thoại'), findsOneWidget);
  });

  testWidgets('notification settings write failure keeps current mute state', (
    tester,
  ) async {
    final api = _ConversationApi()..failNotificationSettingsWrite = true;
    api.rooms
      ..clear()
      ..add(_room(72, 'Write failure room')..['muted'] = false);
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    await _tapMuteAction(tester, 72);
    await tester.pumpAndSettle();

    expect(api.notificationRequests, [
      'GET /api/conversations/72/notification-settings',
      'PUT /api/conversations/72/notification-settings',
    ]);
    await tester.longPress(find.byKey(const ValueKey('rail-room-72')));
    await tester.pumpAndSettle();
    expect(find.text('Tắt thông báo hội thoại'), findsOneWidget);
  });

  testWidgets('SSE conversation refresh survives mute request in flight', (
    tester,
  ) async {
    final writeResponse = Completer<Json>();
    final api = _ConversationApi()
      ..pendingNotificationSettingsWrite = writeResponse;
    api.rooms
      ..clear()
      ..add(_room(73, 'Before mute SSE')..['muted'] = false);
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    await _tapMuteAction(tester, 73);
    expect(api.notificationRequests, [
      'GET /api/conversations/73/notification-settings',
      'PUT /api/conversations/73/notification-settings',
    ]);

    api.rooms.single['name'] = 'Fresh mute SSE room';
    api.emitEvent();
    await tester.pumpAndSettle();
    expect(find.text('Fresh mute SSE room'), findsOneWidget);

    writeResponse.complete({
      'messageNotifications': false,
      'mentionNotifications': true,
    });
    await tester.pumpAndSettle();
    expect(find.text('Fresh mute SSE room'), findsOneWidget);
    await tester.longPress(find.byKey(const ValueKey('rail-room-73')));
    await tester.pumpAndSettle();
    expect(find.text('Bật thông báo hội thoại'), findsOneWidget);
  });

  testWidgets('direct mute and unmute write once without reading settings', (
    tester,
  ) async {
    final api = _ConversationApi();
    api.rooms
      ..clear()
      ..add(
        _room(74, 'Direct room')
          ..['type'] = 'direct'
          ..['muted'] = false,
      );
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();
    await _tapMuteAction(tester, 74);
    await tester.pumpAndSettle();

    expect(api.notificationRequests, [
      'PUT /api/conversations/74/notification-settings',
    ]);
    expect(api.notificationBodies, [
      {'messageNotifications': false, 'mentionNotifications': false},
    ]);

    await tester.longPress(find.byKey(const ValueKey('rail-room-74')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bật thông báo hội thoại'));
    await tester.pumpAndSettle();

    expect(api.notificationRequests, [
      'PUT /api/conversations/74/notification-settings',
      'PUT /api/conversations/74/notification-settings',
    ]);
    expect(api.notificationBodies, [
      {'messageNotifications': false, 'mentionNotifications': false},
      {'messageNotifications': true, 'mentionNotifications': true},
    ]);
    await tester.longPress(find.byKey(const ValueKey('rail-room-74')));
    await tester.pumpAndSettle();
    expect(find.text('Tắt thông báo hội thoại'), findsOneWidget);
  });

  testWidgets('message reaction posts emoji and replaces message', (
    tester,
  ) async {
    final api = _ConversationApi();
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    expect(find.text('👍 1'), findsNothing);

    await _reactToMessage(tester, messageId: 10, emoji: '👍');

    expect(api.reactionRequests, ['POST /api/messages/10/reactions']);
    expect(api.reactionBodies, [
      {'emoji': '👍'},
    ]);
    expect(find.text('👍 1'), findsOneWidget);
  });

  testWidgets('repeating message reaction removes same emoji', (tester) async {
    final api = _ConversationApi();
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    await _reactToMessage(tester, messageId: 10, emoji: '👍');
    expect(find.text('👍 1'), findsOneWidget);

    await _reactToMessage(tester, messageId: 10, emoji: '👍');

    expect(api.reactionRequests, [
      'POST /api/messages/10/reactions',
      'POST /api/messages/10/reactions',
    ]);
    expect(api.reactionBodies, [
      {'emoji': '👍'},
      {'emoji': '👍'},
    ]);
    expect(find.text('👍 1'), findsNothing);
  });

  testWidgets('reaction failure keeps existing message state', (tester) async {
    final api = _ConversationApi()..failReactionRequests = true;
    api.messages[1]!.firstWhere(
      (message) => message['id'] == 10,
    )['reactions'] = [
      {'emoji': '❤️', 'count': 2, 'mine': true},
    ];
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    expect(find.text('❤️ 2'), findsOneWidget);

    await _reactToMessage(tester, messageId: 10, emoji: '👍');

    expect(api.reactionRequests, ['POST /api/messages/10/reactions']);
    expect(find.text('❤️ 2'), findsOneWidget);
    expect(find.text('👍 1'), findsNothing);
    expect(find.textContaining('Synthetic reaction failure'), findsOneWidget);
  });

  testWidgets('stale reaction response overwrites newer SSE update (baseline)', (
    tester,
  ) async {
    final pending = Completer<Json>();
    final api = _ConversationApi()..pendingReactionResponse = pending;
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    await _reactToMessage(tester, messageId: 10, emoji: '👍');
    expect(api.reactionRequests, ['POST /api/messages/10/reactions']);

    final message = api.messages[1]!.firstWhere(
      (message) => message['id'] == 10,
    );
    final staleResponse = {
      ...message,
      'reactions': [
        {'emoji': '👍', 'count': 1, 'mine': true},
      ],
    };
    message['text'] = 'Updated from SSE';
    api.emitEvent();
    await tester.pumpAndSettle();
    expect(api.conversationRequests.length, greaterThan(1));
    expect(find.text('Updated from SSE'), findsOneWidget);

    // Baseline: _replaceMessage applies stale POST response over newer SSE data.
    pending.complete(staleResponse);
    await tester.pumpAndSettle();
    expect(find.text('Updated from SSE'), findsNothing);
    expect(find.text(staleResponse['text'] as String), findsOneWidget);
    expect(find.text('👍 1'), findsOneWidget);
  });
}
