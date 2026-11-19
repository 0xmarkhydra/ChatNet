import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:dio/dio.dart';

typedef Json = Map<String, dynamic>;

String profileAssetUrl(String username, String kind, {dynamic version}) {
  final uri = Uri.parse(
    Api.baseUrl,
  ).resolve('/api/users/${Uri.encodeComponent(username)}/$kind');
  return version == null || version.toString().isEmpty
      ? uri.toString()
      : uri.replace(queryParameters: {'v': version.toString()}).toString();
}

Json object(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  throw const FormatException('Phản hồi máy chủ không hợp lệ.');
}

List<Json> objects(dynamic value) {
  if (value == null) return [];
  if (value is! List) throw const FormatException('Danh sách không hợp lệ.');
  return value.map(object).toList();
}

class ApiError implements Exception {
  final String message;
  final int? status;
  const ApiError(this.message, [this.status]);
  @override
  String toString() => message;
}

class Api {
  Api({
    http.Client? client,
    Dio? dio,
    this.storage = const FlutterSecureStorage(),
  }) : client = client ?? http.Client(),
       dio =
           dio ??
           Dio(
             BaseOptions(
               connectTimeout: const Duration(seconds: 30),
               receiveTimeout: const Duration(seconds: 30),
               sendTimeout: const Duration(seconds: 30),
             ),
           );

  static const baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://api-chat.codelocal.cloud',
  );
  static const siteUrl = String.fromEnvironment(
    'WEB_URL',
    defaultValue: 'https://chat.codelocal.cloud',
  );
  final http.Client
  client; // Only for Server-Sent Events; Dio handles REST and media.
  final Dio dio;
  final FlutterSecureStorage storage;
  Json? session;
  int generation = 0;
  Future<void>? _refreshing;
  bool get isDemo => false;
  Json get user => object(session?['user'] ?? <String, dynamic>{});

  Uri uri(String path) {
    final base = Uri.parse(baseUrl);
    if (base.scheme != 'https' &&
        !(base.scheme == 'http' &&
            ['localhost', '127.0.0.1', '10.0.2.2'].contains(base.host))) {
      throw const ApiError('API_URL phải dùng HTTPS.');
    }
    return base.resolve(path);
  }

  Future<void> restore() async {
    final raw = await storage.read(key: 'soco.session');
    if (raw == null) return;
    try {
      final saved = object(jsonDecode(raw));
      _validateSession(saved);
      session = saved;
    } on FormatException {
      await storage.delete(key: 'soco.session');
    }
  }

  void _validateSession(Json value) {
    if (value['token'] is! String ||
        (value['token'] as String).isEmpty ||
        value['refreshToken'] is! String ||
        value['user'] is! Map ||
        object(value['user'])['id'] is! int) {
      throw const FormatException('Phiên đăng nhập không hợp lệ.');
    }
  }

  Future<void> authenticate(Json value) async {
    _validateSession(value);
    await storage.write(key: 'soco.session', value: jsonEncode(value));
    generation++;
    session = value;
  }

  Future<void> updateUser(Json profile) async {
    if (session == null) return;
    final value = {
      ...session!,
      'user': {
        ...user,
        'username': profile['username'],
        'displayName': profile['displayName'],
      },
      if (profile['token'] is String) 'token': profile['token'],
    };
    await storage.write(key: 'soco.session', value: jsonEncode(value));
    session = value;
  }

  Future<void> logout() async {
    // Clear locally only after server acknowledges revocation.
    if (session != null) {
      await request('POST', '/api/auth/logout', {
        'refreshToken': session!['refreshToken'],
      });
    }
    await storage.delete(key: 'soco.session');
    generation++;
    session = null;
  }

  Future<void> refreshToken() {
    return _refreshing ??= _refresh().whenComplete(() => _refreshing = null);
  }

  Future<void> _refresh() async {
    final epoch = generation;
    final refresh = session?['refreshToken'];
    if (refresh == null) throw const ApiError('Cần đăng nhập lại.', 401);
    final result = object(
      await _send('POST', '/api/auth/refresh', {'refreshToken': refresh}),
    );
    _validateSession(result);
    if (epoch != generation) throw const ApiError('Phiên đã thay đổi.');
    await storage.write(key: 'soco.session', value: jsonEncode(result));
    if (epoch == generation) session = result;
  }

  Future<dynamic> request(String method, String path, [Json? body]) async {
    final epoch = generation;
    try {
      return await _send(method, path, body);
    } on ApiError catch (error) {
      if (error.status != 401 ||
          session == null ||
          path.startsWith('/api/auth/') ||
          epoch != generation) {
        rethrow;
      }
      await refreshToken();
      if (epoch != generation) throw const ApiError('Phiên đã thay đổi.');
      // A 401 rejects the request before mutation. Never retry network failures.
      return _send(method, path, body);
    }
  }

  Future<dynamic> _send(String method, String path, Json? body) async {
    // Parsing error payloads ourselves keeps status codes available to the
    // 401 refresh flow. Never auto-retry ambiguous network writes.
    try {
      final response = await dio.requestUri<String>(
        uri(path),
        data: body == null ? null : jsonEncode(body),
        options: Options(
          method: method,
          responseType: ResponseType.plain,
          validateStatus: (_) => true,
          headers: {
            'Accept': 'application/json',
            if (session != null) 'Authorization': 'Bearer ${session!['token']}',
            if (body != null) 'Content-Type': 'application/json',
          },
        ),
      );
      final status = response.statusCode ?? 0;
      dynamic data;
      try {
        final raw = response.data ?? '';
        data = raw.isEmpty ? null : jsonDecode(raw);
      } on FormatException {
        throw ApiError('Máy chủ trả dữ liệu không hợp lệ ($status).', status);
      }
      if (status < 200 || status >= 300) {
        throw ApiError(
          data is Map && data['error'] is String
              ? data['error'] as String
              : 'Yêu cầu thất bại ($status).',
          status,
        );
      }
      return data;
    } on DioException catch (error) {
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.sendTimeout ||
          error.type == DioExceptionType.receiveTimeout) {
        throw const ApiError(
          'Mạng quá chậm. Kiểm tra dữ liệu trước khi thử gửi lại.',
        );
      }
      throw const ApiError(
        'Không kết nối được máy chủ. Bản nháp vẫn được giữ.',
      );
    }
  }

  /// Download a forwarded attachment using the current user's permission,
  /// then re-upload it as the sender rather than copying another user's storageRef.
  Future<Uint8List> downloadForForward(Json attachment) async {
    final raw = attachment['url']?.toString() ?? '';
    final parsed = Uri.tryParse(raw);
    if (parsed == null || raw.isEmpty || parsed.userInfo.isNotEmpty) {
      throw const ApiError('Tệp không có đường dẫn tải hợp lệ.');
    }
    final target = parsed.hasScheme ? parsed : uri(raw);
    final localHttp =
        target.scheme == 'http' &&
        ['localhost', '127.0.0.1', '10.0.2.2'].contains(target.host);
    if (target.userInfo.isNotEmpty ||
        (target.scheme != 'https' && !localHttp)) {
      throw const ApiError('Địa chỉ tải tệp không an toàn.');
    }

    final kind = (attachment['contentType']?.toString() ?? '').split('/').first;
    final limitMb = switch (kind) {
      'image' => 20,
      'video' => 150,
      'audio' => 40,
      _ => 50,
    };
    final limit = limitMb * 1024 * 1024;
    final origin = Uri.parse(baseUrl);
    final sameOrigin =
        target.scheme == origin.scheme &&
        target.host == origin.host &&
        target.port == origin.port;
    // Signed external URLs must never receive the user's bearer token.
    final response = await dio.getUri<ResponseBody>(
      target,
      options: Options(
        responseType: ResponseType.stream,
        validateStatus: (_) => true,
        headers: {
          if (session != null && sameOrigin)
            'Authorization': 'Bearer ${session!['token']}',
        },
      ),
    );
    final status = response.statusCode ?? 0;
    if (status < 200 || status >= 300) {
      throw ApiError('Không thể tải tệp để chuyển tiếp ($status).', status);
    }
    final contentLength = int.tryParse(
      response.headers.value('content-length') ?? '',
    );
    if (contentLength != null && contentLength > limit) {
      throw ApiError('Tệp chuyển tiếp vượt quá $limitMb MB.');
    }
    final bytes = BytesBuilder(copy: false);
    final body = response.data;
    if (body == null) throw const ApiError('Tệp đính kèm trống.');
    await for (final part in body.stream.timeout(
      const Duration(seconds: 120),
    )) {
      if (bytes.length + part.length > limit) {
        throw ApiError('Tệp chuyển tiếp vượt quá $limitMb MB.');
      }
      bytes.add(part);
    }
    if (bytes.isEmpty) throw const ApiError('Tệp đính kèm trống.');
    return bytes.takeBytes();
  }

  Future<Json> upload(
    String scope,
    String name,
    String contentType,
    Uint8List bytes,
  ) async {
    final kind = contentType.split('/').first;
    final maxMb = switch (kind) {
      'image' => 20,
      'video' => 150,
      'audio' => 40,
      _ => 50,
    };
    if (bytes.isEmpty || bytes.length > maxMb * 1024 * 1024) {
      throw ApiError('Tệp phải có dữ liệu và không quá $maxMb MB.');
    }
    if (scope != 'chat' && kind != 'image' && kind != 'video') {
      throw const ApiError('Chỉ chọn ảnh hoặc video.');
    }
    final data = object(
      await request('POST', '/api/media/presign', {
        'scope': scope,
        'name': name,
        'sizeBytes': bytes.length,
        'contentType': contentType,
      }),
    );
    final url = Uri.tryParse(data['uploadUrl']?.toString() ?? '');
    if (url == null || url.scheme != 'https' || url.userInfo.isNotEmpty) {
      throw const ApiError('Địa chỉ tải tệp không an toàn.');
    }
    final response = await dio.putUri<void>(
      url,
      data: bytes,
      options: Options(
        contentType: contentType,
        responseType: ResponseType.plain,
        validateStatus: (_) => true,
        sendTimeout: const Duration(seconds: 120),
        receiveTimeout: const Duration(seconds: 120),
        // Presigned upload requests must not inherit the session token.
        headers: {'Content-Type': contentType},
      ),
    );
    if ((response.statusCode ?? 0) < 200 || (response.statusCode ?? 0) >= 300) {
      throw const ApiError('Tải tệp thất bại. Chưa gửi nội dung.');
    }
    return {
      'storageRef': data['storageRef'],
      'name': name,
      'sizeBytes': bytes.length,
      'contentType': contentType,
      'kind': data['kind'],
      'url': data['downloadUrl'],
    };
  }

  Stream<void> events() async* {
    while (session != null) {
      final streamClient = http.Client();
      try {
        final req = http.Request('GET', uri('/api/events'));
        req.headers['Authorization'] = 'Bearer ${session!['token']}';
        req.headers['Accept'] = 'text/event-stream';
        final response = await streamClient
            .send(req)
            .timeout(const Duration(seconds: 30));
        if (response.statusCode == 401) {
          await refreshToken();
        } else if (response.statusCode == 200) {
          yield null; // Reconcile on every connect: server has no replay cursor.
          await for (final line
              in response.stream
                  .transform(utf8.decoder)
                  .transform(const LineSplitter())
                  .timeout(const Duration(seconds: 50))) {
            if (line.startsWith('data:')) yield null;
          }
        }
      } catch (_) {
        // Foreground refresh exposes failures; reconnect with bounded backoff.
      } finally {
        streamClient.close();
      }
      await Future<void>.delayed(const Duration(seconds: 5));
    }
  }

  void dispose() {
    generation++;
    session = null;
    client.close();
    dio.close(force: true);
  }
}
