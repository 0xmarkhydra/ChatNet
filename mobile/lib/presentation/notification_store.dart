import 'package:flutter/foundation.dart';
import '../api.dart';
import 'notification_presenter.dart';

/// Single session-scoped snapshot shared by the bell and notification sheet.
class NotificationStore extends ChangeNotifier {
  NotificationStore(this.api);
  final Api api;
  List<Json> _friends = [], _chats = [], _mentions = [];
  bool loading = false;
  String error = '';
  bool _disposed = false, _queued = false;
  int _revision = 0;

  List<MobileNotification> get items => buildMobileNotifications(
    requests: _friends,
    conversations: _chats,
    mentions: _mentions,
  );
  int get unread => items.where((item) => !item.serverRead).length;

  Future<void> refresh() async {
    if (_disposed) return;
    if (loading) {
      _queued = true;
      return;
    }
    loading = true;
    notifyListeners();
    final generation = api.generation;
    final revision = _revision;
    final failures = <String>[];
    Future<List<Json>?> source(String path, String label) async {
      try {
        final result = await api.request('GET', path);
        if (result is! List) throw const ApiError('Phản hồi không hợp lệ.');
        return objects(result);
      } catch (_) {
        failures.add(label);
        return null;
      }
    }

    final results = await Future.wait([
      source('/api/friends/requests', 'lời mời kết bạn'),
      source('/api/conversations?unread=true', 'tin nhắn'),
      source('/api/feed/mentions', 'gắn thẻ'),
    ]);
    if (_disposed) return;
    loading = false;
    if (generation != api.generation) return;
    if (revision == _revision) {
      _friends = results[0] ?? _friends;
      _chats = results[1] ?? _chats;
      _mentions = results[2] ?? _mentions;
      error = failures.isEmpty
          ? ''
          : 'Chưa tải được: ${failures.join(', ')}. Kéo xuống để thử lại.';
    }
    notifyListeners();
    if (_queued) {
      _queued = false;
      await refresh();
    }
  }

  void removeFriend(int id) {
    _revision++;
    _friends = _friends.where((item) => item['id'] != id).toList();
    notifyListeners();
  }

  void readMention(int id) {
    _revision++;
    _mentions = _mentions
        .map(
          (item) => item['id'] == id
              ? {...item, 'readAt': DateTime.now().toUtc().toIso8601String()}
              : item,
        )
        .toList();
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
