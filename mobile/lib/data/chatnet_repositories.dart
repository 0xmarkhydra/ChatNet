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
