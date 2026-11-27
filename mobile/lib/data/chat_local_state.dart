import 'dart:async';
import 'dart:convert';
import 'dart:math';
import '../api.dart';

/// Session-scoped drafts and durable, idempotent outgoing messages.
class ChatLocalState {
  ChatLocalState(this.api)
    : generation = api.generation,
      key = api.chatStateStorageKey;
  final Api api;
  final int generation;
  final String? key;
  final drafts = <String, Json>{};
  final outbox = <Json>[];
  Future<void> _writes = Future.value();
  bool get current => api.generation == generation && api.session != null;
  static String scope(dynamic room, int channel) => '$room:$channel';
  static String clientId() {
    final random = Random.secure();
    return List.generate(
      16,
      (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
    ).join();
  }

  Future<void> restore() async {
    if (key == null) return;
    final raw = await api.storage.read(key: key!);
    if (!current || raw == null) return;
    final data = object(jsonDecode(raw));
    for (final entry in object(data['drafts']).entries) {
      if (RegExp(r'^[1-9][0-9]*:[0-9]+$').hasMatch(entry.key)) {
        drafts[entry.key] = object(entry.value);
      }
    }
    final ids = <String>{};
    for (final row in objects(data['outbox'])) {
      final id = row['clientId'];
      final body = object(row['body']);
      if (id is! String ||
          !RegExp(r'^[a-f0-9]{32}$').hasMatch(id) ||
          !ids.add(id) ||
          body['clientId'] != id ||
          row['roomId'] is! num ||
          row['channelId'] is! num ||
          (row['roomId'] as num) <= 0 ||
          ((body['channelId'] as num?) ?? 0) != row['channelId']) {
        continue;
      }
      outbox.add({
        ...row,
        'status': row['status'] == 'failed' ? 'failed' : 'queued',
      });
      if (outbox.length >= 100) break;
    }
  }

  Future<void> persist() {
    if (!current) return Future.error(const ApiError('Phiên đã thay đổi.'));
    if (key == null) {
      return api.isDemo
          ? Future.value()
          : Future.error(
              const ApiError('Không xác định được phiên để lưu bản nháp.'),
            );
    }
    final encoded = jsonEncode({'drafts': drafts, 'outbox': outbox});
    final next = _writes.catchError((Object _) {}).then((_) async {
      if (!current) throw const ApiError('Phiên đã thay đổi.');
      await api.storage.write(key: key!, value: encoded);
    });
    _writes = next;
    return next;
  }
}
