import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

// ignore: depend_on_referenced_packages
import 'package:cross_file/cross_file.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/api.dart';
import 'package:soco/app.dart';
import 'package:soco/chat_mention_text.dart';
import 'package:soco/data/chatnet_repositories.dart';
import 'package:soco/demo.dart';
import 'package:soco/presentation/conversation_avatar.dart';
import 'package:soco/widgets.dart';

base class _PickedPlatformFile extends PlatformFile {
  _PickedPlatformFile(this.name, this.bytes);

  @override
  final String name;
  final Uint8List bytes;

  @override
  Uri get uri => Uri.parse('memory:///$name');

  @override
  XFile get xFile => XFile.fromData(bytes, name: name);

  @override
  int? lengthSync() => bytes.length;

  @override
  Future<int?> length() async => bytes.length;

  @override
  Future<Uint8List> readAsBytes() async => bytes;

  @override
  Stream<Uint8List> readAsByteStream() => Stream.value(bytes);
}

class _MockFilePickerPlatform extends FilePickerPlatform {
  _MockFilePickerPlatform(this.files);

  final List<PlatformFile> files;

  @override
  Future<List<PlatformFile>> pickFiles({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    Function(FilePickerStatus)? onFileLoading,
    int compressionQuality = 0,
    AndroidOptions androidOptions = const AndroidOptions(),
    DarwinOptions darwinOptions = const DarwinOptions(),
    WindowsOptions windowsOptions = const WindowsOptions(),
    LinuxOptions linuxOptions = const LinuxOptions(),
    WebOptions webOptions = const WebOptions(),
  }) async => files;
}

class _ConversationApi extends DemoApi {
  final StreamController<void> _eventController =
      StreamController<void>.broadcast();
  final List<String> conversationRequests = [];
  final List<String> groupPrefetchRequests = [];
  final List<String> conversationPinRequests = [];
  final List<String> messagePinRequests = [];
  final List<Json?> messagePinBodies = [];
  final List<String> messagePinListRequests = [];
  final List<String> messageRecallRequests = [];
  final List<Json?> messageRecallBodies = [];
  Json? lastMessageRecallResponse;
  final List<String> messageCreateRequests = [];
  final List<Json?> messageCreateBodies = [];
  bool failNextMessageCreateRequest = false;
  Completer<void>? pendingMessageCreateRequest;
  final List<Json> attachmentUploadRequests = [];
  final List<Json> uploadedAttachments = [];
  final List<Completer<Json>> pendingAttachmentUploads = [];
  int? failAttachmentUploadAt;
  final List<Json> forwardDownloadRequests = [];
  final List<Completer<Uint8List>> pendingForwardDownloads = [];
  bool failNextForwardDownload = false;
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
  bool failMessageRecallRequests = false;
  bool failReactionRequests = false;
  bool failNotificationSettingsRead = false;
  bool failNotificationSettingsWrite = false;

  @override
  Stream<void> events() => _eventController.stream;

  void emitEvent() => _eventController.add(null);

  Future<void> closeEvents() => _eventController.close();

  @override
  Future<Json> upload(
    String scope,
    String name,
    String contentType,
    Uint8List bytes,
  ) async {
    attachmentUploadRequests.add({
      'scope': scope,
      'name': name,
      'contentType': contentType,
      'bytes': bytes.toList(),
    });
    if (failAttachmentUploadAt == attachmentUploadRequests.length) {
      throw const ApiError('Synthetic attachment upload failure');
    }
    final pending = pendingAttachmentUploads;
    final attachment = pending.isNotEmpty
        ? await pending.removeAt(0).future
        : _uploadedAttachment(name, contentType, bytes.length);
    uploadedAttachments.add(attachment);
    return attachment;
  }

  @override
  Future<Uint8List> downloadForForward(Json attachment) async {
    forwardDownloadRequests.add(Map<String, dynamic>.from(attachment));
    if (failNextForwardDownload) {
      failNextForwardDownload = false;
      throw const ApiError('Synthetic forward download failure');
    }
    final pending = pendingForwardDownloads;
    return pending.isNotEmpty
        ? await pending.removeAt(0).future
        : Uint8List.fromList([1, 2, 3]);
  }

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    if (method == 'POST' &&
        path.startsWith('/api/conversations/') &&
        path.endsWith('/messages')) {
      messageCreateRequests.add('$method $path');
      messageCreateBodies.add(
        body == null ? null : Map<String, dynamic>.from(body),
      );
      final pending = pendingMessageCreateRequest;
      if (pending != null) await pending.future;
      if (failNextMessageCreateRequest) {
        failNextMessageCreateRequest = false;
        throw const ApiError('Synthetic message create failure');
      }
    }
    if (method == 'DELETE' &&
        path.startsWith('/api/messages/') &&
        path.split('/').length == 4) {
      messageRecallRequests.add('$method $path');
      messageRecallBodies.add(body);
      if (failMessageRecallRequests) {
        throw const ApiError('Synthetic message recall failure');
      }
      final messageId = int.parse(path.split('/')[3]);
      final message = messages.values
          .expand((items) => items)
          .firstWhere((item) => item['id'] == messageId);
      lastMessageRecallResponse = {
        ...message,
        'deleted': true,
        'text': '',
        'editedAt': null,
        'attachments': [],
        'reactions': [],
      };
      pinnedMessageIds.remove(messageId);
      return Map<String, dynamic>.from(lastMessageRecallResponse!);
    }
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

Json _uploadedAttachment(String name, String contentType, int sizeBytes) => {
  'kind': contentType.split('/').first,
  'name': name,
  'contentType': contentType,
  'sizeBytes': sizeBytes,
  'url': 'https://files.test/$name',
};

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

void _pickFiles(List<PlatformFile> files) {
  final previous = FilePickerPlatform.instance;
  FilePickerPlatform.instance = _MockFilePickerPlatform(files);
  addTearDown(() => FilePickerPlatform.instance = previous);
}

Finder _sendButton() => find.byWidgetPredicate(
  (widget) => widget is IconButton && widget.tooltip == 'G\u1eedi',
);

IconButton _iconButton(WidgetTester tester, Finder finder) =>
    tester.widget<IconButton>(finder);

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

Future<void> _openForwardSheet(
  WidgetTester tester, {
  required int messageId,
}) async {
  final message = find.byKey(ValueKey('chat-message-$messageId'));
  await tester.ensureVisible(message);
  await tester.pumpAndSettle();
  await tester.longPress(message);
  await tester.pumpAndSettle();
  await tester.tap(find.text('Chuy\u1ec3n ti\u1ebfp'));
  await tester.pumpAndSettle();
}

Finder _forwardDestination() => find.widgetWithText(ListTile, 'Alex Chen').last;

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

Future<void> _replyToMessage(
  WidgetTester tester, {
  required int messageId,
}) async {
  await tester.longPress(find.byKey(ValueKey('chat-message-$messageId')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Tr\u1ea3 l\u1eddi'));
  await tester.pumpAndSettle();
}

Future<void> _recallMessage(
  WidgetTester tester, {
  required int messageId,
}) async {
  await tester.longPress(find.byKey(ValueKey('chat-message-$messageId')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Thu h\u1ed3i'));
  await tester.pumpAndSettle();
}

String _renderedMessageText(WidgetTester tester, int messageId) => tester
    .widget<ChatMentionText>(
      find.descendant(
        of: find.byKey(ValueKey('chat-message-$messageId')),
        matching: find.byType(ChatMentionText),
      ),
    )
    .text;

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

  test(
    'ChatRepository PATCH message edit sends body and parses response',
    () async {
      RequestOptions? requestOptions;
      final dio = Dio()
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              requestOptions = options;
              handler.resolve(
                Response<String>(
                  requestOptions: options,
                  statusCode: 200,
                  data: jsonEncode({
                    'id': 12,
                    'text': 'Canonical edit response',
                    'editedAt': '2026-11-25T10:03:00Z',
                  }),
                ),
              );
            },
          ),
        );
      final api = Api(dio: dio);

      final response = await ChatRepository(
        api,
      ).editMessage(12, text: 'Submitted edit text');

      expect(requestOptions?.method, 'PATCH');
      expect(requestOptions?.uri.path, '/api/messages/12');
      expect(jsonDecode(requestOptions?.data as String), {
        'text': 'Submitted edit text',
      });
      expect(response, {
        'id': 12,
        'text': 'Canonical edit response',
        'editedAt': '2026-11-25T10:03:00Z',
      });
      dio.close(force: true);
    },
  );

  test('ChatRepository PATCH message edit failure returns ApiError', () async {
    final dio = Dio()
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.resolve(
              Response<String>(
                requestOptions: options,
                statusCode: 500,
                data: jsonEncode({'error': 'Synthetic edit failure'}),
              ),
            );
          },
        ),
      );
    final api = Api(dio: dio);

    await expectLater(
      ChatRepository(api).editMessage(12, text: 'Rejected edit'),
      throwsA(
        isA<ApiError>().having(
          (error) => error.message,
          'message',
          'Synthetic edit failure',
        ),
      ),
    );
    dio.close(force: true);
  });

  testWidgets(
    'editedAt appears in message UI and edit opens with current text',
    (tester) async {
      final api = _ConversationApi();
      final message = api.messages[1]!.firstWhere((item) => item['id'] == 12);
      message
        ..['text'] = 'Existing edited text'
        ..['editedAt'] = '2026-11-25T10:03:00Z';
      addTearDown(api.closeEvents);

      await _openDefaultGroupChat(tester, api);
      expect(find.text('Existing edited text'), findsOneWidget);
      expect(find.textContaining('· đã sửa'), findsOneWidget);

      await tester.longPress(find.byKey(const ValueKey('chat-message-12')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sửa'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<EditableText>(find.byType(EditableText).last)
            .controller
            .text,
        'Existing edited text',
      );
    },
  );

  testWidgets(
    'saving an edit closes dialog without controller lifecycle error',
    (tester) async {
      final api = _ConversationApi();
      addTearDown(api.closeEvents);

      await _openDefaultGroupChat(tester, api);
      await tester.longPress(find.byKey(const ValueKey('chat-message-12')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('S\u1eeda'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(EditableText).last, 'Saved edit text');
      await tester.tap(find.text('L\u01b0u'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(_renderedMessageText(tester, 12), 'Saved edit text');
    },
  );

  testWidgets('message recall sends bodyless DELETE and replaces message', (
    tester,
  ) async {
    final api = _ConversationApi();
    final original = api.messages[1]!.firstWhere((item) => item['id'] == 12);
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    await _recallMessage(tester, messageId: 12);

    expect(api.messageRecallRequests, ['DELETE /api/messages/12']);
    expect(api.messageRecallBodies, [null]);
    expect(api.lastMessageRecallResponse?['deleted'], isTrue);
    expect(api.lastMessageRecallResponse, isNot(same(original)));
    expect(original['deleted'], isNot(true));
    expect(original['text'], isNotEmpty);
    expect(
      _renderedMessageText(tester, 12),
      'Tin nh\u1eafn \u0111\u00e3 \u0111\u01b0\u1ee3c thu h\u1ed3i',
    );
  });

  testWidgets('pins.updated SSE removes recalled message from pin panel', (
    tester,
  ) async {
    final api = _ConversationApi()..pinnedMessageIds.add(12);
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    expect(find.byTooltip('B\u1ecf ghim'), findsOneWidget);
    await _recallMessage(tester, messageId: 12);
    expect(find.byTooltip('B\u1ecf ghim'), findsOneWidget);

    final serverMessages = api.messages[1]!;
    final messageIndex = serverMessages.indexWhere((item) => item['id'] == 12);
    serverMessages[messageIndex] = Map<String, dynamic>.from(
      api.lastMessageRecallResponse!,
    );
    api.emitEvent(); // Server publishes pins.updated after recall.
    await tester.pumpAndSettle();

    expect(api.messageRecallRequests, ['DELETE /api/messages/12']);
    expect(api.messagePinListRequests.length, greaterThan(1));
    expect(find.byTooltip('B\u1ecf ghim'), findsNothing);
  });

  testWidgets('failed message recall keeps message and pin state', (
    tester,
  ) async {
    final api = _ConversationApi()
      ..failMessageRecallRequests = true
      ..pinnedMessageIds.add(12);
    final originalText = api.messages[1]!.firstWhere(
      (item) => item['id'] == 12,
    )['text'];
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    await _recallMessage(tester, messageId: 12);

    expect(api.messageRecallRequests, ['DELETE /api/messages/12']);
    expect(api.messageRecallBodies, [null]);
    expect(_renderedMessageText(tester, 12), originalText);
    expect(find.byTooltip('B\u1ecf ghim'), findsOneWidget);
  });

  testWidgets('empty recalled preview keeps conversation timestamp', (
    tester,
  ) async {
    const lastMessageAt = '2026-11-25T10:00:00Z';
    final api = _ConversationApi();
    api.rooms
      ..clear()
      ..add(
        _room(90, 'Recalled preview', lastMessageAt: lastMessageAt)
          ..['lastMessage'] = '',
      );
    addTearDown(api.closeEvents);

    await _pumpApp(tester, api);
    await tester.pumpAndSettle();

    final room = find.byKey(const ValueKey('rail-room-90'));
    expect(
      find.descendant(
        of: room,
        matching: find.text('Nh\u00f3m h\u1ed9i tho\u1ea1i'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: room,
        matching: find.text(displayTime(lastMessageAt)),
      ),
      findsOneWidget,
    );
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

  testWidgets('text send posts trimmed text and group channel id', (
    tester,
  ) async {
    final api = _ConversationApi();
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    final composer = find.byWidgetPredicate(
      (widget) => widget is EditableText && widget.maxLines == 5,
    );
    expect(composer, findsOneWidget);
    await tester.enterText(composer, '  New message  ');
    expect(
      tester.widget<EditableText>(composer).controller.text,
      '  New message  ',
    );
    await tester.pump();
    await tester.tap(find.byTooltip('Gửi'));
    await tester.pumpAndSettle();

    expect(api.messageCreateRequests, ['POST /api/conversations/1/messages']);
    final response = api.messages[1]!.last;
    expect(_renderedMessageText(tester, response['id'] as int), 'New message');
    final body = api.messageCreateBodies.single!;
    expect(body['text'], 'New message');
    expect(body['channelId'], 0);
    expect(body['clientId'], isA<String>());
    expect(body['clientId'], isNotEmpty);
    expect(body.containsKey('replyToMessageId'), isFalse);
    expect(body.containsKey('attachments'), isFalse);
  });

  testWidgets(
    'failed text send keeps draft and manual resend gets new client id (baseline)',
    (tester) async {
      final api = _ConversationApi()..failNextMessageCreateRequest = true;
      addTearDown(api.closeEvents);

      await _openDefaultGroupChat(tester, api);
      final composer = find.byWidgetPredicate(
        (widget) => widget is EditableText && widget.maxLines == 5,
      );
      expect(composer, findsOneWidget);
      await tester.enterText(composer, 'Retry this message');
      await tester.pump();
      await tester.tap(find.byTooltip('Gửi'));
      await tester.pumpAndSettle();

      expect(api.messageCreateRequests, ['POST /api/conversations/1/messages']);
      expect(
        find.textContaining('Synthetic message create failure'),
        findsOneWidget,
      );
      expect(
        tester.widget<EditableText>(composer).controller.text,
        'Retry this message',
      );

      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Gửi'));
      await tester.pumpAndSettle();

      expect(api.messageCreateRequests, [
        'POST /api/conversations/1/messages',
        'POST /api/conversations/1/messages',
      ]);
      expect(api.messageCreateBodies, hasLength(2));
      expect(
        api.messageCreateBodies[0]?['clientId'],
        isNot(api.messageCreateBodies[1]?['clientId']),
      );
      expect(api.messageCreateBodies[1]?['text'], 'Retry this message');
    },
  );

  testWidgets('reply send posts reply id, renders response, and clears reply', (
    tester,
  ) async {
    final api = _ConversationApi();
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    await _replyToMessage(tester, messageId: 10);
    expect(find.textContaining('Tr\u1ea3 l\u1eddi @'), findsOneWidget);

    final composer = find.byWidgetPredicate(
      (widget) => widget is EditableText && widget.maxLines == 5,
    );
    await tester.enterText(composer, 'Reply message');
    await tester.pump();
    await tester.tap(find.byTooltip('G\u1eedi'));
    await tester.pumpAndSettle();

    expect(api.messageCreateRequests, ['POST /api/conversations/1/messages']);
    expect(api.messageCreateBodies.single?['replyToMessageId'], 10);
    final response = api.messages[1]!.last;
    expect(response['replyToMessageId'], 10);
    expect(
      _renderedMessageText(tester, response['id'] as int),
      'Reply message',
    );
    expect(find.textContaining('Tr\u1ea3 l\u1eddi @'), findsNothing);
  });

  testWidgets('failed reply send keeps reply state', (tester) async {
    final api = _ConversationApi()..failNextMessageCreateRequest = true;
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    await _replyToMessage(tester, messageId: 10);
    final composer = find.byWidgetPredicate(
      (widget) => widget is EditableText && widget.maxLines == 5,
    );
    await tester.enterText(composer, 'Reply message');
    await tester.pump();
    await tester.tap(find.byTooltip('G\u1eedi'));
    await tester.pumpAndSettle();

    expect(api.messageCreateRequests, ['POST /api/conversations/1/messages']);
    expect(api.messageCreateBodies.single?['replyToMessageId'], 10);
    expect(find.textContaining('Tr\u1ea3 l\u1eddi @'), findsOneWidget);
    expect(
      find.textContaining('Synthetic message create failure'),
      findsOneWidget,
    );
  });

  testWidgets('attachment uploads run sequentially before send posts them', (
    tester,
  ) async {
    final firstUpload = Completer<Json>();
    final secondUpload = Completer<Json>();
    final api = _ConversationApi()
      ..pendingAttachmentUploads.addAll([firstUpload, secondUpload]);
    _pickFiles([
      _PickedPlatformFile('first.png', Uint8List.fromList([1, 2, 3])),
      _PickedPlatformFile('second.png', Uint8List.fromList([4, 5, 6])),
    ]);
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    final composer = find.byWidgetPredicate(
      (widget) => widget is EditableText && widget.maxLines == 5,
    );
    await tester.enterText(composer, 'Image caption');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('composer-quick-media')));
    await tester.pump();
    await tester.pump();

    expect(api.attachmentUploadRequests, hasLength(1));
    expect(api.messageCreateRequests, isEmpty);
    expect(
      _iconButton(
        tester,
        find.byKey(const ValueKey('composer-quick-media')),
      ).onPressed,
      isNull,
    );
    expect(
      _iconButton(
        tester,
        find.byWidgetPredicate(
          (widget) =>
              widget is IconButton &&
              widget.tooltip == 'Th\u00eam \u1ea3nh, file, emoji',
        ),
      ).onPressed,
      isNull,
    );
    expect(_iconButton(tester, _sendButton()).onPressed, isNull);

    final first = _uploadedAttachment('first.png', 'image/png', 3);
    firstUpload.complete(first);
    await tester.pump();
    await tester.pump();
    expect(api.attachmentUploadRequests, hasLength(2));
    expect(api.messageCreateRequests, isEmpty);

    final second = _uploadedAttachment('second.png', 'image/png', 3);
    secondUpload.complete(second);
    await tester.pumpAndSettle();
    expect(api.attachmentUploadRequests.map((request) => request['name']), [
      'first.png',
      'second.png',
    ]);
    expect(api.messageCreateRequests, isEmpty);
    expect(
      find.byKey(const ValueKey('composer-pending-attachments')),
      findsOneWidget,
    );

    api.pendingMessageCreateRequest = Completer<void>();
    final send = _sendButton();
    await tester.tap(send);
    await tester.pump();
    expect(api.messageCreateRequests, ['POST /api/conversations/1/messages']);
    expect(api.messageCreateBodies.single?['attachments'], [first, second]);
    expect(_iconButton(tester, send).onPressed, isNull);
    expect(
      find.byKey(const ValueKey('composer-pending-attachments')),
      findsOneWidget,
    );

    api.pendingMessageCreateRequest!.complete();
    await tester.pumpAndSettle();
    final response = api.messages[1]!.last;
    expect(
      _renderedMessageText(tester, response['id'] as int),
      'Image caption',
    );
    expect(
      find.byKey(const ValueKey('composer-pending-attachments')),
      findsNothing,
    );
  });

  testWidgets(
    'mid-batch attachment upload failure skips POST and stages none',
    (tester) async {
      final api = _ConversationApi()..failAttachmentUploadAt = 2;
      _pickFiles([
        _PickedPlatformFile('uploaded.png', Uint8List.fromList([1, 2, 3])),
        _PickedPlatformFile('failed.png', Uint8List.fromList([4, 5, 6])),
      ]);
      addTearDown(api.closeEvents);

      await _openDefaultGroupChat(tester, api);
      final composer = find.byWidgetPredicate(
        (widget) => widget is EditableText && widget.maxLines == 5,
      );
      await tester.enterText(composer, 'Keep draft');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('composer-quick-media')));
      await tester.pumpAndSettle();

      expect(api.attachmentUploadRequests, hasLength(2));
      expect(api.uploadedAttachments, [
        _uploadedAttachment('uploaded.png', 'image/png', 3),
      ]);
      expect(api.messageCreateRequests, isEmpty);
      expect(
        find.byKey(const ValueKey('composer-pending-attachments')),
        findsNothing,
      );
      expect(
        find.textContaining('Synthetic attachment upload failure'),
        findsOneWidget,
      );
      expect(_iconButton(tester, _sendButton()).onPressed, isNotNull);
    },
  );

  testWidgets(
    'POST failure keeps uploaded attachment staged without reupload',
    (tester) async {
      final api = _ConversationApi()..failNextMessageCreateRequest = true;
      _pickFiles([
        _PickedPlatformFile('kept.png', Uint8List.fromList([1, 2, 3])),
      ]);
      addTearDown(api.closeEvents);

      await _openDefaultGroupChat(tester, api);
      final composer = find.byWidgetPredicate(
        (widget) => widget is EditableText && widget.maxLines == 5,
      );
      await tester.enterText(composer, 'Keep attachment');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('composer-quick-media')));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('composer-pending-attachments')),
        findsOneWidget,
      );

      await tester.tap(find.byTooltip('G\u1eedi'));
      await tester.pumpAndSettle();

      expect(api.messageCreateRequests, ['POST /api/conversations/1/messages']);
      expect(api.messageCreateBodies.single?['attachments'], [
        _uploadedAttachment('kept.png', 'image/png', 3),
      ]);
      expect(api.attachmentUploadRequests, hasLength(1));
      expect(api.uploadedAttachments, hasLength(1));
      expect(
        find.byKey(const ValueKey('composer-pending-attachments')),
        findsOneWidget,
      );
      expect(
        tester.widget<EditableText>(composer).controller.text,
        'Keep attachment',
      );
      expect(_iconButton(tester, _sendButton()).onPressed, isNotNull);
      expect(
        find.textContaining('Synthetic message create failure'),
        findsOneWidget,
      );
    },
  );

  testWidgets('text forward posts forwarded message to selected room', (
    tester,
  ) async {
    final api = _ConversationApi();
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    final source = api.messages[1]!.firstWhere(
      (message) => message['id'] == 12,
    );
    await _openForwardSheet(tester, messageId: 12);
    await tester.tap(_forwardDestination());
    await tester.pumpAndSettle();

    expect(api.messageCreateRequests, ['POST /api/conversations/3/messages']);
    final body = api.messageCreateBodies.single!;
    expect(body.keys.toSet(), {'clientId', 'text', 'forwarded', 'attachments'});
    expect(body['clientId'], isA<String>());
    expect(body['clientId'], isNotEmpty);
    expect(body['text'], source['text']);
    expect(body['forwarded'], isTrue);
    expect(body['attachments'], isEmpty);
    expect(api.messages[3]!.last['forwarded'], isTrue);
    expect(find.text('Chuy\u1ec3n ti\u1ebfp tin nh\u1eafn'), findsNothing);
  });

  testWidgets(
    'file forward downloads and uploads each attachment before POST',
    (tester) async {
      final firstDownload = Completer<Uint8List>();
      final secondDownload = Completer<Uint8List>();
      final firstUpload = Completer<Json>();
      final secondUpload = Completer<Json>();
      final api = _ConversationApi()
        ..pendingForwardDownloads.addAll([firstDownload, secondDownload])
        ..pendingAttachmentUploads.addAll([firstUpload, secondUpload])
        ..pendingMessageCreateRequest = Completer<void>();
      final source = api.messages[1]!.firstWhere(
        (message) => message['id'] == 12,
      );
      final originalAttachments = [
        {
          'kind': 'file',
          'name': 'first.pdf',
          'contentType': 'application/pdf',
          'url': 'https://files.test/first.pdf',
        },
        {
          'kind': 'file',
          'name': 'second.txt',
          'contentType': 'text/plain',
          'url': 'https://files.test/second.txt',
        },
      ];
      source['attachments'] = originalAttachments;
      addTearDown(api.closeEvents);

      await _openDefaultGroupChat(tester, api);
      await _openForwardSheet(tester, messageId: 12);
      await tester.tap(_forwardDestination());
      await tester.pump();

      final destination = _forwardDestination();
      expect(api.forwardDownloadRequests, [originalAttachments.first]);
      expect(api.attachmentUploadRequests, isEmpty);
      expect(api.messageCreateRequests, isEmpty);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      expect(tester.widget<ListTile>(destination).enabled, isFalse);

      firstDownload.complete(Uint8List.fromList([1, 2, 3]));
      await tester.pump();
      await tester.pump();
      expect(api.attachmentUploadRequests, hasLength(1));
      expect(api.attachmentUploadRequests.single['name'], 'first.pdf');
      expect(api.forwardDownloadRequests, [originalAttachments.first]);
      expect(api.messageCreateRequests, isEmpty);

      firstUpload.complete(
        _uploadedAttachment('first.pdf', 'application/pdf', 3),
      );
      await tester.pump();
      await tester.pump();
      expect(api.attachmentUploadRequests, hasLength(1));
      expect(api.forwardDownloadRequests, originalAttachments);
      expect(api.messageCreateRequests, isEmpty);

      secondDownload.complete(Uint8List.fromList([4, 5, 6]));
      await tester.pump();
      await tester.pump();
      expect(api.attachmentUploadRequests, hasLength(2));
      expect(api.attachmentUploadRequests.last['name'], 'second.txt');
      expect(api.messageCreateRequests, isEmpty);

      secondUpload.complete(_uploadedAttachment('second.txt', 'text/plain', 3));
      await tester.pump();
      await tester.pump();
      expect(api.messageCreateRequests, ['POST /api/conversations/3/messages']);
      final body = api.messageCreateBodies.single!;
      expect(body['forwarded'], isTrue);
      expect(body['text'], source['text']);
      expect(body['clientId'], isA<String>());
      expect(body['attachments'], [
        _uploadedAttachment('first.pdf', 'application/pdf', 3),
        _uploadedAttachment('second.txt', 'text/plain', 3),
      ]);
      expect(api.attachmentUploadRequests[0]['bytes'], [1, 2, 3]);
      expect(api.attachmentUploadRequests[1]['bytes'], [4, 5, 6]);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      expect(tester.widget<ListTile>(destination).enabled, isFalse);

      api.pendingMessageCreateRequest!.complete();
      await tester.pumpAndSettle();
      expect(find.text('Chuy\u1ec3n ti\u1ebfp tin nh\u1eafn'), findsNothing);
    },
  );

  testWidgets('forward download failure skips upload and POST, resets busy', (
    tester,
  ) async {
    final api = _ConversationApi()..failNextForwardDownload = true;
    api.messages[1]!.firstWhere(
      (message) => message['id'] == 10,
    )['attachments'] = [
      {
        'kind': 'file',
        'name': 'source.pdf',
        'contentType': 'application/pdf',
        'url': 'https://files.test/source.pdf',
      },
    ];
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    await _openForwardSheet(tester, messageId: 10);
    await tester.tap(_forwardDestination());
    await tester.pumpAndSettle();

    expect(api.forwardDownloadRequests, hasLength(1));
    expect(api.attachmentUploadRequests, isEmpty);
    expect(api.messageCreateRequests, isEmpty);
    expect(
      find.textContaining('Synthetic forward download failure'),
      findsOneWidget,
    );
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(tester.widget<ListTile>(_forwardDestination()).enabled, isTrue);
  });

  testWidgets('forward upload failure skips POST and resets busy', (
    tester,
  ) async {
    final api = _ConversationApi()..failAttachmentUploadAt = 1;
    api.messages[1]!.firstWhere(
      (message) => message['id'] == 10,
    )['attachments'] = [
      {
        'kind': 'file',
        'name': 'source.pdf',
        'contentType': 'application/pdf',
        'url': 'https://files.test/source.pdf',
      },
    ];
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    await _openForwardSheet(tester, messageId: 10);
    await tester.tap(_forwardDestination());
    await tester.pumpAndSettle();

    expect(api.forwardDownloadRequests, hasLength(1));
    expect(api.attachmentUploadRequests, hasLength(1));
    expect(api.messageCreateRequests, isEmpty);
    expect(
      find.textContaining('Synthetic attachment upload failure'),
      findsOneWidget,
    );
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(tester.widget<ListTile>(_forwardDestination()).enabled, isTrue);
  });

  testWidgets('forward POST failure keeps sheet and does not retry upload', (
    tester,
  ) async {
    final api = _ConversationApi()..failNextMessageCreateRequest = true;
    api.messages[1]!.firstWhere(
      (message) => message['id'] == 10,
    )['attachments'] = [
      {
        'kind': 'file',
        'name': 'source.pdf',
        'contentType': 'application/pdf',
        'url': 'https://files.test/source.pdf',
      },
    ];
    addTearDown(api.closeEvents);

    await _openDefaultGroupChat(tester, api);
    await _openForwardSheet(tester, messageId: 10);
    await tester.tap(_forwardDestination());
    await tester.pumpAndSettle();

    expect(api.messageCreateRequests, ['POST /api/conversations/3/messages']);
    expect(api.messageCreateBodies.single?['forwarded'], isTrue);
    expect(api.messageCreateBodies.single?['attachments'], [
      _uploadedAttachment('source.pdf', 'application/pdf', 3),
    ]);
    expect(api.forwardDownloadRequests, hasLength(1));
    expect(api.attachmentUploadRequests, hasLength(1));
    expect(find.text('Chuy\u1ec3n ti\u1ebfp tin nh\u1eafn'), findsOneWidget);
    expect(
      find.textContaining('Synthetic message create failure'),
      findsOneWidget,
    );
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(tester.widget<ListTile>(_forwardDestination()).enabled, isTrue);
  });

  testWidgets('stale reaction response preserves newer SSE message', (
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
    message['reactions'] = staleResponse['reactions'];
    api.emitEvent();
    await tester.pumpAndSettle();
    expect(api.conversationRequests.length, greaterThan(1));
    expect(find.text('Updated from SSE'), findsOneWidget);

    pending.complete(staleResponse);
    await tester.pumpAndSettle();
    expect(find.text('Updated from SSE'), findsOneWidget);
    expect(find.text(staleResponse['text'] as String), findsNothing);
    expect(find.text('👍 1'), findsOneWidget);
  });

  testWidgets('unrelated SSE does not discard reaction response', (
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
    api.emitEvent();
    await tester.pumpAndSettle();
    expect(api.conversationRequests.length, greaterThan(1));
    expect(find.text(message['text'] as String), findsOneWidget);

    pending.complete(staleResponse);
    await tester.pumpAndSettle();
    expect(find.text(message['text'] as String), findsOneWidget);
    expect(find.text('👍 1'), findsOneWidget);
  });
}
