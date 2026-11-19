import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:soco/models/models.dart';

void main() {
  const stamp = '2026-11-18T01:02:03+07:00';

  test(
    'conversation keeps API camelCase, pin order data and nullable values',
    () {
      final json = <String, dynamic>{
        'id': 7,
        'type': 'group',
        'name': 'Design',
        'memberCount': 4,
        'unreadCount': 2,
        'lastMessage': 'Xin chào',
        'online': true,
        'createdAt': stamp,
        'pinnedAt': stamp,
        'categoryId': 3,
        'lastMessageAt': stamp,
      };
      final room = Conversation.fromJson(json);
      expect(room.type, ConversationType.group);
      expect(room.toJson(), json);
      expect(
        Conversation.fromJson(jsonDecode(jsonEncode(room.toJson()))).id,
        7,
      );
      final unpinned = room.copyWith(pinnedAt: null, categoryId: null);
      expect(unpinned.pinnedAt, isNull);
      expect(unpinned.toJson(), isNot(contains('pinnedAt')));
      expect(unpinned.toJson(), isNot(contains('categoryId')));
      expect(room.pinnedAt, stamp);
    },
  );

  test('message, reaction, media, pin and realtime event round-trip', () {
    final json = <String, dynamic>{
      'id': 12,
      'conversationId': 7,
      'channelId': 0,
      'senderId': 2,
      'sender': 'linh',
      'text': 'Chào bạn',
      'createdAt': stamp,
      'readByUserIds': <int>[1, 2],
      'forwarded': true,
      'reactions': [
        {'emoji': '❤️', 'count': 2, 'mine': false},
      ],
      'attachments': [
        {
          'id': 8,
          'storageRef': 'media-8',
          'name': 'hello.png',
          'contentType': 'image/png',
          'sizeBytes': 9,
          'kind': 'image',
          'url': 'https://example.com/private',
        },
      ],
      'translatedText': 'Hello',
    };
    final message = ChatMessage.fromJson(json);
    expect(message.channelId, 0);
    expect(message.reactions!.single.mine, false);
    expect(message.attachments!.single.kind, MediaKind.image);
    expect(message.toJson(), json);
    expect(message.copyWith(translatedText: null).translatedText, null);
    expect(message.translatedText, 'Hello');
    final pinned = PinnedMessage(message: message, pinnedAt: stamp);
    expect(PinnedMessage.fromJson(pinned.toJson()).message.id, 12);
    final event = RealtimeEvent(
      type: RealtimeEventType.message,
      conversationId: 7,
      message: message,
    );
    expect(RealtimeEvent.fromJson(event.toJson()).message!.sender, 'linh');
    expect(
      MessageDraft.fromJson(MessageDraft(text: 'test').toJson()).text,
      'test',
    );
  });

  test('strict upload projection omits signed URL and server-only id', () {
    final image = MediaAttachment.fromJson({
      'id': 10,
      'url': 'https://example.com/signed',
      'storageRef': 'uploads/1',
      'name': 'img.png',
      'sizeBytes': 33,
      'kind': 'image',
      'contentType': 'image/png',
    });
    expect(image.toUploadRequestJson(), {
      'storageRef': 'uploads/1',
      'name': 'img.png',
      'sizeBytes': 33,
      'contentType': 'image/png',
      'kind': 'image',
    });
    final preview = MediaAttachment.fromJson({
      'name': 'Sample',
      'url': 'https://example.com/public',
      'kind': 'image',
    });
    expect(preview.storageRef, isNull);
    expect(() => preview.toUploadRequestJson(), throwsFormatException);
    expect(() => Conversation.fromJson({'id': 'wrong'}), throwsFormatException);
    expect(
      () => MessageReaction.fromJson({
        'emoji': '❤️',
        'count': '3',
        'mine': false,
      }),
      throwsFormatException,
    );
    expect(
      () => MediaAttachment.fromJson({'name': 'bad', 'kind': 'exe'}),
      throwsFormatException,
    );
  });

  test('feed post/comment/story serialize nested DTOs and nullable fields', () {
    final post = FeedPost(
      id: 5,
      author: 'linh',
      content: 'Bài viết',
      likes: 3,
      liked: true,
      createdAt: stamp,
      comments: [
        const FeedComment(
          id: 1,
          author: 'alex',
          content: 'Hay!',
          createdAt: stamp,
          parentId: null,
        ),
      ],
      reactions: const [FeedReaction(emoji: '❤️', count: 3)],
      visibility: PostVisibility.friends,
      attachments: const [
        MediaAttachment(
          name: 'story.png',
          kind: MediaKind.image,
          url: 'https://example.com/public',
        ),
      ],
    );
    expect(FeedPost.fromJson(post.toJson()).comments.single.content, 'Hay!');
    expect(post.copyWith(visibility: null).visibility, isNull);
    final story = Story(
      id: 1,
      author: 'linh',
      attachment: post.attachments!.single,
      createdAt: stamp,
      expiresAt: stamp,
    );
    expect(Story.fromJson(story.toJson()).attachment.kind, MediaKind.image);
  });

  test('friend, group channel and identity preserve types', () {
    final friend = FriendConnection.fromJson({
      'id': 3,
      'username': 'test',
      'displayName': 'Test',
      'online': false,
      'status': 'pending',
      'direction': 'incoming',
      'distanceKm': 2,
      'blockedByMe': false,
    });
    expect(friend.distanceKm, 2.0);
    expect(friend.copyWith(direction: null).direction, null);
    expect(
      FriendConnection.fromJson(friend.toJson()).status,
      FriendStatus.pending,
    );
    const member = GroupMember(
      id: 1,
      username: 'owner',
      displayName: 'Owner',
      role: GroupRole.owner,
      online: true,
    );
    expect(GroupMember.fromJson(member.toJson()).role, GroupRole.owner);
    const channel = GroupChannel(id: 0, name: 'Thảo luận chung');
    expect(GroupChannel.fromJson(channel.toJson()).id, 0);
    const user = AccountUser(
      id: 1,
      username: 'owner',
      displayName: 'Owner',
      email: 'owner@example.invalid',
    );
    final session = AuthSession(
      token: 'test-token',
      sessionId: 'session-id',
      user: user,
      refreshToken: 'refresh-token',
    );
    expect(AuthSession.fromJson(session.toJson()).user.id, 1);
    expect(session.copyWith(refreshToken: null).refreshToken, null);
    const managed = ManagedAccountSession(
      id: 's1',
      userAgent: 'Mobile',
      createdAt: stamp,
      lastSeenAt: stamp,
      expiresAt: stamp,
      current: true,
    );
    expect(ManagedAccountSession.fromJson(managed.toJson()).current, true);
  });

  test('navigation DTOs map React Tab and calls independently', () {
    const item = MobileNavigationItem(
      id: MobileDestination.calls,
      label: 'Cuộc gọi',
      active: true,
      badge: '99+',
    );
    expect(
      MobileNavigationItem.fromJson(item.toJson()).id,
      MobileDestination.calls,
    );
    expect(item.copyWith(badge: null).toJson(), isNot(contains('badge')));
    const state = MobileNavigationState(
      tab: AppTab.chat,
      callsActive: true,
      unreadTotal: 101,
      pushEnabled: false,
    );
    expect(MobileNavigationState.fromJson(state.toJson()).callsActive, true);
    expect(state.copyWith(unreadTotal: 0).unreadTotal, 0);
  });

  test('call history data preserves nullable timing and joins', () {
    final call = CallHistoryRecord.fromJson({
      'id': 'call-201',
      'conversationId': 1,
      'createdBy': 2,
      'mediaType': 'audio',
      'createdAt': stamp,
      'joined': false,
      'participantCount': 0,
    });
    expect(call.startedAt, isNull);
    expect(call.joined, isFalse);
    expect(call.copyWith(joined: null).toJson(), isNot(contains('joined')));
    expect(
      CallHistoryRecord.fromJson(call.toJson()).mediaType,
      CallMediaType.audio,
    );
  });

  test('participants, privacy and profile handle native response formats', () {
    final page = ReactionParticipantsPage.fromJson({
      'items': [
        {'userId': 4, 'username': 'linh', 'emoji': '👍', 'displayName': 'Linh'},
      ],
      'hasMore': false,
    });
    expect(
      ReactionParticipantsPage.fromJson(page.toJson()).items.first.emoji,
      '👍',
    );
    expect(page.copyWith(hasMore: true).hasMore, isTrue);

    final profile = ProfileMediaState.fromJson({
      'username': 'linh',
      'displayName': 'Linh',
      'avatarSet': false,
      'coverSet': true,
    });
    expect(profile.updatedAt, isNull);
    expect(profile.copyWith(city: 'Hà Nội').city, 'Hà Nội');
    final updated = ProfileUpdateResponse(
      username: 'linh',
      displayName: 'Linh',
      avatarSet: true,
      coverSet: false,
      token: 'new-token',
    );
    expect(ProfileUpdateResponse.fromJson(updated.toJson()).token, 'new-token');
    final privacy = UserPrivacy.fromJson({
      'searchableByUsername': true,
      'searchableByName': true,
      'searchableByEmail': false,
      'allowFriendRequests': true,
      'showOnlineStatus': false,
    });
    expect(UserPrivacy.fromJson(privacy.toJson()).searchableByEmail, false);
    const preferences = UserPreferences(
      targetLanguage: 'vi',
      autoTranslate: true,
      appLocale: 'vi',
    );
    expect(UserPreferences.fromJson(preferences.toJson()).targetLanguage, 'vi');
  });
}
