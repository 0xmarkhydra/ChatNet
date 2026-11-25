import '../api.dart';
import '../models/models.dart';

/// Transport adapters use the existing authenticated API instance. Keeping the
/// same Api preserves refresh-token rotation, the secure session and DemoApi.
class ChatRepository {
  const ChatRepository(this.api);
  final Api api;

  Future<List<Conversation>> conversations({
    int limit = 25,
    int offset = 0,
  }) async {
    final query = offset == 0 ? 'limit=$limit' : 'limit=$limit&offset=$offset';
    final items = objects(
      await api.request('GET', '/api/conversations?$query'),
    );
    return List.unmodifiable(items.map(Conversation.fromJson));
  }

  Future<void> setConversationPinned(
    int conversationId, {
    required bool pinned,
  }) async {
    await api.request(
      pinned ? 'PUT' : 'DELETE',
      '/api/conversations/$conversationId/pin',
    );
  }

  Future<void> setMessagePinned(int messageId, {required bool pinned}) async {
    await api.request(
      pinned ? 'PUT' : 'DELETE',
      '/api/messages/$messageId/pin',
    );
  }

  Future<Json> editMessage(int messageId, {required String text}) async =>
      object(
        await api.request('PATCH', '/api/messages/$messageId', {'text': text}),
      );

  Future<Json> recallMessage(int messageId) async =>
      object(await api.request('DELETE', '/api/messages/$messageId'));

  Future<Json> sendMessage(int conversationId, {required Json body}) async =>
      object(
        await api.request(
          'POST',
          '/api/conversations/$conversationId/messages',
          body,
        ),
      );

  Future<List<ChatMessage>> messages(
    int conversationId, {
    int channelId = 0,
    String? targetLanguage,
  }) async {
    final query = [
      if (targetLanguage != null)
        'target=${Uri.encodeQueryComponent(targetLanguage)}',
      'channelId=$channelId',
    ].join('&');
    final result = objects(
      await api.request(
        'GET',
        '/api/conversations/$conversationId/messages?$query',
      ),
    );
    return List.unmodifiable(result.map(ChatMessage.fromJson));
  }

  Future<void> markRead(int conversationId, {int channelId = 0}) async {
    await api.request('POST', '/api/conversations/$conversationId/read', {
      'channelId': channelId,
    });
  }

  Future<Json> toggleMessageReaction(
    int messageId, {
    required String emoji,
  }) async => object(
    await api.request('POST', '/api/messages/$messageId/reactions', {
      'emoji': emoji,
    }),
  );

  Future<Json> setConversationMuted(
    int conversationId, {
    required bool muted,
    required bool isGroup,
  }) async {
    var mentionNotifications = !muted;
    if (isGroup) {
      final current = object(
        await api.request(
          'GET',
          '/api/conversations/$conversationId/notification-settings',
        ),
      );
      if (current['mentionNotifications'] is! bool) {
        throw const ApiError('Không đọc được cấu hình @Tag của nhóm.');
      }
      // Muting normal messages does NOT mute explicit @mentions.
      mentionNotifications = current['mentionNotifications'] == true;
    }
    final settings = object(
      await api.request(
        'PUT',
        '/api/conversations/$conversationId/notification-settings',
        {
          'messageNotifications': !muted,
          'mentionNotifications': mentionNotifications,
        },
      ),
    );
    if (settings['messageNotifications'] is! bool) {
      throw const ApiError('Backend chưa hỗ trợ cấu hình thông báo.');
    }
    return settings;
  }

  Future<List<GroupMember>> members(int conversationId) async {
    final result = objects(
      await api.request('GET', '/api/conversations/$conversationId/members'),
    );
    return List.unmodifiable(result.map(GroupMember.fromJson));
  }
}

class FeedRepository {
  const FeedRepository(this.api);
  final Api api;

  Future<List<FeedPost>> posts({
    int limit = 15,
    int? before,
    bool saved = false,
  }) async {
    final scope = saved ? '&scope=saved' : '';
    final cursor = before == null ? '' : '&before=$before';
    final data = objects(
      await api.request('GET', '/api/posts?limit=$limit$scope$cursor'),
    );
    return List.unmodifiable(data.map(FeedPost.fromJson));
  }

  Future<List<Story>> stories() async {
    final data = objects(
      await api.request('GET', '/api/stories?includeText=true'),
    );
    return List.unmodifiable(data.map(Story.fromJson));
  }
}

class ContactsRepository {
  const ContactsRepository(this.api);
  final Api api;

  Future<List<FriendConnection>> friends() async {
    final data = objects(await api.request('GET', '/api/friends'));
    return List.unmodifiable(data.map(FriendConnection.fromJson));
  }

  Future<List<FriendSearchResult>> suggestions() async {
    final data = objects(await api.request('GET', '/api/users/suggestions'));
    return List.unmodifiable(data.map(FriendSearchResult.fromJson));
  }

  Future<List<FriendSearchResult>> search(String keyword) async {
    final text = keyword.trim().replaceFirst('@', '');
    if (text.isEmpty) return const [];
    final result = objects(
      await api.request(
        'GET',
        '/api/users/search?q=${Uri.encodeQueryComponent(text)}',
      ),
    );
    return List.unmodifiable(result.map(FriendSearchResult.fromJson));
  }
}

class CallsRepository {
  const CallsRepository(this.api);
  final Api api;

  Future<List<CallHistoryRecord>> history() async {
    final data = objects(await api.request('GET', '/api/calls/history'));
    return List.unmodifiable(data.map(CallHistoryRecord.fromJson));
  }
}

class ProfileRepository {
  const ProfileRepository(this.api);
  final Api api;

  Future<ProfileMediaState> load() async {
    return ProfileMediaState.fromJson(
      object(await api.request('GET', '/api/profile')),
    );
  }

  Future<UserPrivacy> privacy() async {
    return UserPrivacy.fromJson(
      object(await api.request('GET', '/api/privacy')),
    );
  }

  Future<UserPreferences> preferences() async {
    return UserPreferences.fromJson(
      object(await api.request('GET', '/api/preferences')),
    );
  }
}

/// UI may call existing endpoint-specific mutations through Api until its
/// controllers are ported; these typed repositories own all server reads.
