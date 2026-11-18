import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soco/api.dart';
import 'package:soco/models/models.dart';
import 'package:soco/state/app_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class StubApi extends Api {
  StubApi({this.userId = 1}) {
    session = {
      'user': {
        'id': userId,
        'username': 'user$userId',
        'displayName': 'User $userId',
        'email': 'user$userId@example.invalid',
      },
    };
  }

  final int userId;
  final List<String> requests = [];
  int searches = 0;
  int refreshes = 0;
  String? lastAuthentication;

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    requests.add('$method $path');
    if (path == '/api/conversations?limit=25&offset=0') {
      return [
        {
          'id': userId,
          'type': 'group',
          'name': 'Group $userId',
          'memberCount': 3,
          'unreadCount': 1,
          'lastMessage': 'hi',
          'online': true,
          'createdAt': '2026-11-18T10:00:00+07:00',
        },
      ];
    }
    if (path.startsWith('/api/conversations/') && path.contains('/messages')) {
      return [
        {
          'id': userId * 10,
          'conversationId': userId,
          'senderId': userId,
          'sender': 'User $userId',
          'text': 'hello',
          'createdAt': '2026-11-18T10:00:00+07:00',
        },
      ];
    }
    if (path == '/api/posts?limit=20') {
      return [
        {
          'id': 10,
          'author': 'user$userId',
          'content': 'hello',
          'likes': 1,
          'liked': false,
          'comments': [],
          'createdAt': '2026-11-18T10:00:00+07:00',
        },
      ];
    }
    if (path == '/api/stories') return [];
    if (path == '/api/friends') {
      return [
        {
          'id': 2,
          'username': 'friend',
          'displayName': 'Friend',
          'online': true,
          'status': 'accepted',
        },
      ];
    }
    if (path == '/api/users/suggestions') return [];
    if (path.startsWith('/api/users/search')) {
      searches++;
      return [
        {
          'id': 3,
          'username': 'friend',
          'displayName': 'Friend',
          'online': true,
        },
      ];
    }
    if (path == '/api/calls/history') {
      refreshes++;
      return [
        {
          'id': 'call-$userId',
          'conversationId': userId,
          'createdBy': userId,
          'mediaType': 'audio',
          'createdAt': '2026-11-18T10:00:00+07:00',
        },
      ];
    }
    if (path == '/api/auth/email/start' || path == '/api/auth/email/resend') {
      return {
        'verificationToken': path.endsWith('start') ? 'otp-one' : 'otp-two',
        'emailMasked': 'u***@mail.com',
        'expiresInSeconds': 240,
      };
    }
    if (path == '/api/auth/email/verify') {
      return {
        'token': 'access-token',
        'refreshToken': 'refresh-token',
        'sessionId': 'real-session',
        'user': {
          'id': userId,
          'username': 'user$userId',
          'displayName': 'User',
          'email': 'user$userId@example.invalid',
        },
      };
    }
    throw ApiError('Unexpected $method $path');
  }

  @override
  Future<void> authenticate(Json payload) async {
    lastAuthentication = payload['token']?.toString();
    session = payload;
  }
}

class PresignedMediaApi extends Api {
  PresignedMediaApi(Dio dio) : super(dio: dio);

  @override
  Future<dynamic> request(String method, String path, [Json? body]) async {
    if (method == 'POST' && path == '/api/media/presign') {
      return {
        'uploadUrl': 'https://signed.example/upload',
        'storageRef': 'ref-image',
        'kind': 'image',
        'downloadUrl': 'https://signed.example/media',
      };
    }
    throw ApiError('Unexpected request: $method $path');
  }
}

void main() {
  test(
    'Riverpod repositories and query family parse typed API responses',
    () async {
      final api = StubApi();
      final container = ProviderContainer(
        overrides: [apiProvider.overrideWithValue(api)],
      );
      addTearDown(() {
        container.dispose();
        api.dispose();
      });

      final conversations = await container.read(conversationsProvider.future);
      expect(conversations.single.id, 1);
      final messages = await container.read(
        messagesProvider(const MessageQuery(1, channelId: 5)).future,
      );
      expect(messages.single.text, 'hello');
      expect(api.requests.any((path) => path.contains('channelId=5')), isTrue);

      final feed = await container.read(feedProvider.future);
      expect(feed.posts.single.content, 'hello');
      final friends = await container.read(contactsProvider.future);
      expect(friends.friends.single.status, FriendStatus.accepted);
    },
  );

  test(
    'call history AsyncNotifier supports forced refresh and session isolation',
    () async {
      final a = StubApi(userId: 1);
      final b = StubApi(userId: 2);
      final first = ProviderContainer(
        overrides: [apiProvider.overrideWithValue(a)],
      );
      final second = ProviderContainer(
        overrides: [apiProvider.overrideWithValue(b)],
      );
      addTearDown(() {
        first.dispose();
        second.dispose();
        a.dispose();
        b.dispose();
      });
      expect(
        (await first.read(callHistoryProvider.future)).single.id,
        'call-1',
      );
      expect(
        (await second.read(callHistoryProvider.future)).single.id,
        'call-2',
      );
      await first.read(callHistoryProvider.notifier).refresh();
      expect(a.refreshes, 2);
      expect(b.refreshes, 1);
    },
  );

  test(
    'debounced search discards stale input and clear does not fetch',
    () async {
      final api = StubApi();
      final container = ProviderContainer(
        overrides: [apiProvider.overrideWithValue(api)],
      );
      addTearDown(() {
        container.dispose();
        api.dispose();
      });
      final controller = container.read(contactSearchProvider.notifier);
      controller.search('first');
      controller.search('friend');
      await Future<void>.delayed(const Duration(milliseconds: 370));
      final snapshot = container.read(contactSearchProvider);
      expect(snapshot.value!.single.username, 'friend');
      expect(api.searches, 1);
      controller.search('');
      expect(container.read(contactSearchProvider).value, isEmpty);
      expect(api.searches, 1);
    },
  );

  test(
    'email OTP notifier retains challenge across resend, then authenticates',
    () async {
      final api = StubApi();
      api.session = null;
      final container = ProviderContainer(
        overrides: [apiProvider.overrideWithValue(api)],
      );
      addTearDown(() {
        container.dispose();
        api.dispose();
      });
      final controller = container.read(emailAuthProvider.notifier);
      expect(
        (await controller.start('user@example.com')).verificationToken,
        'otp-one',
      );
      expect((await controller.resend()).verificationToken, 'otp-two');
      await controller.verify('123456');
      expect(api.lastAuthentication, 'access-token');
      expect(container.read(sessionSnapshotProvider).isSignedIn, isTrue);
      controller.reset();
      expect(container.read(emailAuthProvider).value, isNull);
    },
  );

  test(
    'Dio transport retains status and avoids unsafe network retry',
    () async {
      final dio = Dio();
      var requests = 0;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests++;
            if (options.path.contains('timeout')) {
              return handler.reject(
                DioException(
                  requestOptions: options,
                  type: DioExceptionType.connectionTimeout,
                ),
              );
            }
            if (options.path.contains('forbidden')) {
              return handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 403,
                  data: jsonEncode({'error': 'Forbidden'}),
                ),
              );
            }
            return handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: jsonEncode({'ok': true}),
              ),
            );
          },
        ),
      );
      final api = Api(dio: dio);
      addTearDown(api.dispose);
      expect(await api.request('GET', '/api/safe'), {'ok': true});
      expect(
        () => api.request('GET', '/api/forbidden'),
        throwsA(isA<ApiError>().having((e) => e.status, 'status', 403)),
      );
      await expectLater(
        api.request('POST', '/api/timeout', {'x': 1}),
        throwsA(isA<ApiError>()),
      );
      expect(requests, 3, reason: 'Do not replay network writes on timeout');
    },
  );

  test(
    'presigned media requests never forward Authorization to external hosts',
    () async {
      final dio = Dio();
      final seen = <String>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            seen.add(options.uri.toString());
            expect(options.headers.containsKey('Authorization'), isFalse);
            if (options.uri.path == '/upload') {
              return handler.resolve(
                Response(requestOptions: options, statusCode: 200, data: ''),
              );
            }
            if (options.uri.path == '/media') {
              return handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 200,
                  data: ResponseBody(
                    Stream.value(utf8.encode('hello')),
                    200,
                    headers: {
                      'content-length': ['5'],
                    },
                  ),
                ),
              );
            }
            throw StateError('Unexpected network request: ${options.uri}');
          },
        ),
      );
      final api = PresignedMediaApi(dio)
        ..session = {
          'token': 'super-secret',
          'user': {'id': 1},
        };
      addTearDown(api.dispose);
      final uploaded = await api.upload(
        'chat',
        'photo.png',
        'image/png',
        Uint8List.fromList([1, 2, 3]),
      );
      expect(uploaded['storageRef'], 'ref-image');
      final data = await api.downloadForForward({
        'contentType': 'image/png',
        'url': 'https://signed.example/media',
      });
      expect(utf8.decode(data), 'hello');
      expect(seen, [
        'https://signed.example/upload',
        'https://signed.example/media',
      ]);
    },
  );
}
