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
  final List<Completer<List<Json>>> pendingConversationResponses = [];
  final List<dynamic> pageResponses = [];
  bool failConversationReads = false;
  bool failPageReads = false;

  @override
  Stream<void> events() => _eventController.stream;

  void emitEvent() => _eventController.add(null);

  Future<void> closeEvents() => _eventController.close();

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
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

void _setViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Future<void> _pumpApp(
  WidgetTester tester,
  _ConversationApi api, {
  Key? key,
}) async {
  _setViewport(tester);
  await tester.pumpWidget(SocoApp(key: key, api: api));
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

      await _pumpApp(tester, api);
      await tester.pumpAndSettle();

      final rail = find.byKey(const ValueKey('mobile-avatar-rail'));
      await tester.drag(rail, const Offset(0, -10000));
      await tester.pumpAndSettle();
      expect(
        api.conversationRequests,
        contains('/api/conversations?limit=25&offset=25'),
      );

      await tester.drag(rail, const Offset(0, -10000));
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
}
