import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../data/chatnet_repositories.dart';
import '../models/models.dart';

/// One Api per authenticated session. Override in the ProviderScope at the
/// application boundary; tests can inject DemoApi without network access.
final apiProvider = Provider<Api>(
  (ref) => throw StateError('apiProvider requires a session-scoped override'),
);

final chatRepositoryProvider = Provider<ChatRepository>(
  (ref) => ChatRepository(ref.watch(apiProvider)),
);
final feedRepositoryProvider = Provider<FeedRepository>(
  (ref) => FeedRepository(ref.watch(apiProvider)),
);
final contactsRepositoryProvider = Provider<ContactsRepository>(
  (ref) => ContactsRepository(ref.watch(apiProvider)),
);
final callsRepositoryProvider = Provider<CallsRepository>(
  (ref) => CallsRepository(ref.watch(apiProvider)),
);
final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(ref.watch(apiProvider)),
);

class SessionSnapshot {
  const SessionSnapshot({
    required this.isSignedIn,
    required this.isDemo,
    this.userId,
  });
  final bool isSignedIn;
  final bool isDemo;
  final int? userId;
}

final sessionSnapshotProvider = Provider<SessionSnapshot>((ref) {
  final api = ref.watch(apiProvider);
  return SessionSnapshot(
    isSignedIn: api.session != null,
    isDemo: api.isDemo,
    userId: api.user['id'] is int ? api.user['id'] as int : null,
  );
});

/// Reconcile-only SSE transport: server has no replay cursor. One subscription
/// per provider container, shared across all consumers and canceled on logout.
final realtimeEventProvider = StreamProvider.autoDispose<Json>((ref) async* {
  final api = ref.watch(apiProvider);
  var revision = 0;
  await for (final _ in api.events()) {
    yield {...api.lastRealtimeEvent, '_revision': ++revision};
  }
});

final realtimeRevisionProvider = Provider.autoDispose<AsyncValue<int>>(
  (ref) => ref
      .watch(realtimeEventProvider)
      .whenData((event) => event['_revision'] as int),
);

class ConversationsNotifier extends AsyncNotifier<List<Conversation>> {
  @override
  Future<List<Conversation>> build() {
    return ref.watch(chatRepositoryProvider).conversations();
  }

  Future<void> refresh() async {
    final repo = ref.read(chatRepositoryProvider);
    state = const AsyncLoading();
    final result = await AsyncValue.guard(repo.conversations);
    if (ref.mounted) state = result;
  }
}

final conversationsProvider =
    AsyncNotifierProvider<ConversationsNotifier, List<Conversation>>(
      ConversationsNotifier.new,
    );

class MessageQuery {
  const MessageQuery(
    this.conversationId, {
    this.channelId = 0,
    this.targetLanguage,
  });

  final int conversationId;
  final int channelId;
  final String? targetLanguage;

  @override
  bool operator ==(Object other) =>
      other is MessageQuery &&
      other.conversationId == conversationId &&
      other.channelId == channelId &&
      other.targetLanguage == targetLanguage;

  @override
  int get hashCode => Object.hash(conversationId, channelId, targetLanguage);
}

final messagesProvider = FutureProvider.autoDispose
    .family<List<ChatMessage>, MessageQuery>(
      (ref, query) => ref
          .watch(chatRepositoryProvider)
          .messages(
            query.conversationId,
            channelId: query.channelId,
            targetLanguage: query.targetLanguage,
          ),
    );

class FeedSnapshot {
  const FeedSnapshot({required this.posts, required this.stories});
  final List<FeedPost> posts;
  final List<Story> stories;
}

class FeedNotifier extends AsyncNotifier<FeedSnapshot> {
  @override
  Future<FeedSnapshot> build() async {
    final repo = ref.watch(feedRepositoryProvider);
    // An optional Story failure must not hide an otherwise available feed.
    final posts = await repo.posts();
    List<Story> stories;
    try {
      stories = await repo.stories();
    } catch (_) {
      stories = const [];
    }
    return FeedSnapshot(posts: posts, stories: stories);
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
    await future;
  }
}

final feedProvider = AsyncNotifierProvider<FeedNotifier, FeedSnapshot>(
  FeedNotifier.new,
);

class ContactsSnapshot {
  const ContactsSnapshot({required this.friends, required this.suggestions});
  final List<FriendConnection> friends;
  final List<FriendSearchResult> suggestions;
}

class ContactsNotifier extends AsyncNotifier<ContactsSnapshot> {
  @override
  Future<ContactsSnapshot> build() async {
    final repo = ref.watch(contactsRepositoryProvider);
    // Suggestions are optional: keep known friends if discovery is down.
    final friends = await repo.friends();
    List<FriendSearchResult> suggestions;
    try {
      suggestions = await repo.suggestions();
    } catch (_) {
      suggestions = const [];
    }
    return ContactsSnapshot(friends: friends, suggestions: suggestions);
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
    await future;
  }
}

final contactsProvider =
    AsyncNotifierProvider<ContactsNotifier, ContactsSnapshot>(
      ContactsNotifier.new,
    );

class CallHistoryNotifier extends AsyncNotifier<List<CallHistoryRecord>> {
  @override
  Future<List<CallHistoryRecord>> build() {
    return ref.watch(callsRepositoryProvider).history();
  }

  Future<void> refresh() async {
    final repo = ref.read(callsRepositoryProvider);
    state = const AsyncLoading();
    final result = await AsyncValue.guard(repo.history);
    if (ref.mounted) state = result;
  }
}

final callHistoryProvider =
    AsyncNotifierProvider<CallHistoryNotifier, List<CallHistoryRecord>>(
      CallHistoryNotifier.new,
    );

final profileProvider = FutureProvider<ProfileMediaState>(
  (ref) => ref.watch(profileRepositoryProvider).load(),
);
final privacyProvider = FutureProvider<UserPrivacy>(
  (ref) => ref.watch(profileRepositoryProvider).privacy(),
);
final preferencesProvider = FutureProvider<UserPreferences>(
  (ref) => ref.watch(profileRepositoryProvider).preferences(),
);

/// The notifier lives with the user session, so a logout discards request
/// results and caches belonging to the previous user.
class SearchContactsNotifier extends AsyncNotifier<List<FriendSearchResult>> {
  Timer? _debounce;
  int _generation = 0;

  @override
  List<FriendSearchResult> build() {
    ref.onDispose(() {
      _generation++;
      _debounce?.cancel();
    });
    return const [];
  }

  void search(String text) {
    _debounce?.cancel();
    final generation = ++_generation;
    final query = text.trim();
    if (query.isEmpty) {
      state = const AsyncData([]);
      return;
    }
    state = const AsyncLoading();
    _debounce = Timer(const Duration(milliseconds: 320), () async {
      final result = await AsyncValue.guard(
        () => ref.read(contactsRepositoryProvider).search(query),
      );
      if (ref.mounted && generation == _generation) state = result;
    });
  }
}

final contactSearchProvider =
    AsyncNotifierProvider<SearchContactsNotifier, List<FriendSearchResult>>(
      SearchContactsNotifier.new,
    );

/// OTP transport state belongs to the authenticated session boundary; the
/// widget retains only the countdown/field controllers for presentation.
class EmailAuthNotifier extends AsyncNotifier<EmailChallenge?> {
  @override
  EmailChallenge? build() => null;

  Future<EmailChallenge> start(String email) async {
    final address = email.trim();
    if (!address.contains('@')) {
      throw const FormatException('Nhập email hợp lệ.');
    }
    return _challenge('POST', '/api/auth/email/start', {
      'email': address,
    }, fallbackEmail: address);
  }

  Future<EmailChallenge> resend() async {
    final challenge = state.asData?.value;
    if (challenge == null) throw StateError('Không có mã xác minh.');
    return _challenge('POST', '/api/auth/email/resend', {
      'token': challenge.verificationToken,
    }, fallbackEmail: challenge.emailMasked);
  }

  Future<void> verify(String code) async {
    final challenge = state.asData?.value;
    if (challenge == null || code.trim().length != 6) {
      throw const FormatException('Mã xác minh không hợp lệ.');
    }
    final api = ref.read(apiProvider);
    final payload = object(
      await api.request('POST', '/api/auth/email/verify', {
        'token': challenge.verificationToken,
        'code': code.trim(),
      }),
    );
    if (!ref.mounted) throw const ApiError('Phiên đã thay đổi.');
    await api.authenticate(payload);
    if (ref.mounted) ref.invalidate(sessionSnapshotProvider);
  }

  void reset() => state = const AsyncData(null);

  Future<EmailChallenge> _challenge(
    String method,
    String path,
    Json request, {
    required String fallbackEmail,
  }) async {
    final previous = state;
    state = const AsyncLoading();
    final result = await AsyncValue.guard(() async {
      final payload = object(
        await ref.read(apiProvider).request(method, path, request),
      );
      return EmailChallenge.fromJson(payload, requestedEmail: fallbackEmail);
    });
    if (!ref.mounted) throw const ApiError('Phiên đã thay đổi.');
    if (result.hasError) {
      state = previous;
      Error.throwWithStackTrace(result.error!, result.stackTrace!);
    }
    final challenge = result.requireValue;
    state = AsyncData(challenge);
    return challenge;
  }
}

final emailAuthProvider =
    AsyncNotifierProvider<EmailAuthNotifier, EmailChallenge?>(
      EmailAuthNotifier.new,
    );
