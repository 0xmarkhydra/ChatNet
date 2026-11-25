import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/api.dart';
import 'package:soco/app.dart';
import 'package:soco/demo.dart';

class _MessageReadApi extends DemoApi {
  final requests = <String>[];
  final readRequests = <String>[];
  final readBodies = <Json?>[];
  final messageRequests = <String>[];
  final pendingMessages = <int, Completer<List<Json>>>{};
  final pendingReads = <int, Completer<void>>{};

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    requests.add('$method $path');
    final uri = Uri.parse(path);
    final parts = uri.pathSegments;
    if (method == 'GET' &&
        parts.length == 4 &&
        parts[0] == 'api' &&
        parts[1] == 'conversations' &&
        parts[3] == 'pins') {
      return <Json>[];
    }
    if (method == 'GET' &&
        parts.length == 4 &&
        parts[0] == 'api' &&
        parts[1] == 'conversations' &&
        parts[3] == 'messages') {
      final roomId = int.parse(parts[2]);
      messageRequests.add(path);
      final pending = pendingMessages[roomId];
      if (pending != null) return pending.future;
    }
    if (method == 'POST' &&
        parts.length == 4 &&
        parts[0] == 'api' &&
        parts[1] == 'conversations' &&
        parts[3] == 'read') {
      final roomId = int.parse(parts[2]);
      readRequests.add('$method $path');
      readBodies.add(body == null ? null : Map<String, dynamic>.from(body));
      final pending = pendingReads[roomId];
      if (pending != null) await pending.future;
      return <String, dynamic>{};
    }
    return super.request(method, path, body);
  }
}

Future<void> _pumpReadApp(WidgetTester tester, _MessageReadApi api) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(SocoApp(api: api));
  await tester.pump();
  await tester.pumpAndSettle();
}

Future<void> _openRoom(WidgetTester tester, int roomId) async {
  await tester.tap(find.byKey(ValueKey('rail-room-$roomId')));
  await tester.pump();
}

Future<void> _switchRoom(WidgetTester tester, int roomId) async {
  await tester.tap(find.byTooltip('Quay lại'));
  await tester.pumpAndSettle();
  await _openRoom(tester, roomId);
}

Future<void> _pumpUntil(
  WidgetTester tester,
  bool Function() condition,
  List<String> requests,
) async {
  for (var i = 0; i < 20 && !condition(); i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
  expect(condition(), isTrue, reason: requests.join('\n'));
}

List<Json> _roomMessages(_MessageReadApi api, int roomId) => [
  for (final message in api.messages[roomId] ?? <Json>[])
    Map<String, dynamic>.from(message),
];

void main() {
  testWidgets(
    'baseline: delayed old room fetch posts stale read after switch',
    (tester) async {
      final api = _MessageReadApi()..preferences['autoTranslate'] = false;
      api.pendingMessages[2] = Completer<List<Json>>();

      await _pumpReadApp(tester, api);
      await _openRoom(tester, 2);
      await _pumpUntil(
        tester,
        () => api.messageRequests.any(
          (path) => path.startsWith('/api/conversations/2/messages'),
        ),
        api.requests,
      );
      expect(api.readRequests, isEmpty);

      await _switchRoom(tester, 3);
      await _pumpUntil(
        tester,
        () => api.readRequests.contains('POST /api/conversations/3/read'),
        api.requests,
      );
      expect(api.readRequests, ['POST /api/conversations/3/read']);

      api.pendingMessages[2]!.complete(_roomMessages(api, 2));
      await _pumpUntil(
        tester,
        () => api.readRequests.length == 2,
        api.requests,
      );
      await tester.pumpAndSettle();

      expect(api.readRequests, [
        'POST /api/conversations/3/read',
        'POST /api/conversations/2/read',
      ]);
      expect(api.readBodies, [
        {'channelId': 0},
        {'channelId': 0},
      ]);
      expect(find.byKey(const ValueKey('chat-message-30')), findsOneWidget);
      expect(find.byKey(const ValueKey('chat-message-20')), findsNothing);
    },
  );

  testWidgets(
    'baseline: delayed old read response keeps current room visible',
    (tester) async {
      final api = _MessageReadApi()..preferences['autoTranslate'] = false;
      api.pendingReads[2] = Completer<void>();

      await _pumpReadApp(tester, api);
      await _openRoom(tester, 2);
      await _pumpUntil(
        tester,
        () => api.readRequests.contains('POST /api/conversations/2/read'),
        api.requests,
      );
      expect(api.readRequests, ['POST /api/conversations/2/read']);

      await _switchRoom(tester, 3);
      await _pumpUntil(
        tester,
        () => api.readRequests.contains('POST /api/conversations/3/read'),
        api.requests,
      );
      expect(api.readRequests, [
        'POST /api/conversations/2/read',
        'POST /api/conversations/3/read',
      ]);

      api.pendingReads[2]!.complete();
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('chat-message-30')), findsOneWidget);
      expect(find.byKey(const ValueKey('chat-message-20')), findsNothing);
    },
  );
}
