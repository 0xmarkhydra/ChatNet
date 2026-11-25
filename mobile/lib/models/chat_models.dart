import 'json_readers.dart';
import 'media_attachment.dart';

enum ConversationType { direct, group }

enum GroupRole { owner, admin, member }

class Conversation {
  const Conversation({
    required this.id,
    required this.type,
    required this.name,
    required this.memberCount,
    required this.unreadCount,
    required this.lastMessage,
    required this.online,
    required this.createdAt,
    this.categoryId,
    this.pinnedAt,
    this.blockedByMe,
    this.blockedByOther,
    this.otherUserId,
    this.otherUsername,
    this.lastMessageAt,
  });

  final int id;
  final ConversationType type;
  final String name;
  final int memberCount;
  final int unreadCount;
  final String lastMessage;
  final bool online;

  /// ISO-8601 timestamp; retained as String to preserve the server wire value.
  final String createdAt;
  final int? categoryId;
  final String? pinnedAt;
  final bool? blockedByMe;
  final bool? blockedByOther;
  final int? otherUserId;
  final String? otherUsername;
  final String? lastMessageAt;

  factory Conversation.fromJson(JsonMap json) => Conversation(
    id: requiredField<int>(json, 'id'),
    type: enumField(
      json,
      'type',
      ConversationType.values,
      (value) => value.name,
    ),
    name: requiredField<String>(json, 'name'),
    memberCount: requiredField<int>(json, 'memberCount'),
    unreadCount: requiredField<int>(json, 'unreadCount'),
    lastMessage: requiredField<String>(json, 'lastMessage'),
    online: requiredField<bool>(json, 'online'),
    createdAt: requiredField<String>(json, 'createdAt'),
    categoryId: optionalField<int>(json, 'categoryId'),
    pinnedAt: optionalField<String>(json, 'pinnedAt'),
    blockedByMe: optionalField<bool>(json, 'blockedByMe'),
    blockedByOther: optionalField<bool>(json, 'blockedByOther'),
    otherUserId: optionalField<int>(json, 'otherUserId'),
    otherUsername: optionalField<String>(json, 'otherUsername'),
    lastMessageAt: optionalField<String>(json, 'lastMessageAt'),
  );

  Conversation copyWith({
    int? id,
    ConversationType? type,
    String? name,
    int? memberCount,
    int? unreadCount,
    String? lastMessage,
    bool? online,
    String? createdAt,
    Object? categoryId = absent,
    Object? pinnedAt = absent,
    Object? blockedByMe = absent,
    Object? blockedByOther = absent,
    Object? otherUserId = absent,
    Object? otherUsername = absent,
    Object? lastMessageAt = absent,
  }) => Conversation(
    id: id ?? this.id,
    type: type ?? this.type,
    name: name ?? this.name,
    memberCount: memberCount ?? this.memberCount,
    unreadCount: unreadCount ?? this.unreadCount,
    lastMessage: lastMessage ?? this.lastMessage,
    online: online ?? this.online,
    createdAt: createdAt ?? this.createdAt,
    categoryId: identical(categoryId, absent)
        ? this.categoryId
        : categoryId as int?,
    pinnedAt: identical(pinnedAt, absent) ? this.pinnedAt : pinnedAt as String?,
    blockedByMe: identical(blockedByMe, absent)
        ? this.blockedByMe
        : blockedByMe as bool?,
    blockedByOther: identical(blockedByOther, absent)
        ? this.blockedByOther
        : blockedByOther as bool?,
    otherUserId: identical(otherUserId, absent)
        ? this.otherUserId
        : otherUserId as int?,
    otherUsername: identical(otherUsername, absent)
        ? this.otherUsername
        : otherUsername as String?,
    lastMessageAt: identical(lastMessageAt, absent)
        ? this.lastMessageAt
        : lastMessageAt as String?,
  );

  JsonMap toJson() => {
    'id': id,
    'type': type.name,
    'name': name,
    'memberCount': memberCount,
    'unreadCount': unreadCount,
    'lastMessage': lastMessage,
    'online': online,
    'createdAt': createdAt,
    if (categoryId != null) 'categoryId': categoryId,
    if (pinnedAt != null) 'pinnedAt': pinnedAt,
    if (blockedByMe != null) 'blockedByMe': blockedByMe,
    if (blockedByOther != null) 'blockedByOther': blockedByOther,
    if (otherUserId != null) 'otherUserId': otherUserId,
    if (otherUsername != null) 'otherUsername': otherUsername,
    if (lastMessageAt != null) 'lastMessageAt': lastMessageAt,
  };
}

class MessageReaction {
  const MessageReaction({
    required this.emoji,
    required this.count,
    required this.mine,
  });

  final String emoji;
  final int count;
  final bool mine;

  factory MessageReaction.fromJson(JsonMap json) => MessageReaction(
    emoji: requiredField<String>(json, 'emoji'),
    count: requiredField<int>(json, 'count'),
    mine: requiredField<bool>(json, 'mine'),
  );

  MessageReaction copyWith({String? emoji, int? count, bool? mine}) =>
      MessageReaction(
        emoji: emoji ?? this.emoji,
        count: count ?? this.count,
        mine: mine ?? this.mine,
      );

  JsonMap toJson() => {'emoji': emoji, 'count': count, 'mine': mine};
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.sender,
    required this.text,
    required this.createdAt,
    this.clientId,
    this.channelId,
    this.senderDisplayName,
    this.replyToMessageId,
    this.replyToSender,
    this.replyToDisplayName,
    this.replyToText,
    this.editedAt,
    this.deleted,
    this.reactions,
    this.readByUserIds,
    this.translatedText,
    this.translationLanguage,
    this.attachments,
    this.forwarded,
  });

  final int id;
  final int conversationId;
  final int senderId;
  final String sender;
  final String text;
  final String createdAt;
  final String? clientId;
  final int? channelId;
  final String? senderDisplayName;
  final int? replyToMessageId;
  final String? replyToSender;
  final String? replyToDisplayName;
  final String? replyToText;
  final String? editedAt;
  final bool? deleted;
  final List<MessageReaction>? reactions;
  final List<int>? readByUserIds;
  final String? translatedText;
  final String? translationLanguage;
  final List<MediaAttachment>? attachments;

  /// Present in Flutter forwarded-message responses (React type may omit it).
  final bool? forwarded;

  factory ChatMessage.fromJson(JsonMap json) => ChatMessage(
    id: requiredField<int>(json, 'id'),
    conversationId: requiredField<int>(json, 'conversationId'),
    senderId: requiredField<int>(json, 'senderId'),
    sender: requiredField<String>(json, 'sender'),
    text: requiredField<String>(json, 'text'),
    createdAt: requiredField<String>(json, 'createdAt'),
    clientId: optionalField<String>(json, 'clientId'),
    channelId: optionalField<int>(json, 'channelId'),
    senderDisplayName: optionalField<String>(json, 'senderDisplayName'),
    replyToMessageId: optionalField<int>(json, 'replyToMessageId'),
    replyToSender: optionalField<String>(json, 'replyToSender'),
    replyToDisplayName: optionalField<String>(json, 'replyToDisplayName'),
    replyToText: optionalField<String>(json, 'replyToText'),
    editedAt: optionalField<String>(json, 'editedAt'),
    deleted: optionalField<bool>(json, 'deleted'),
    reactions: optionalObjects(json, 'reactions', MessageReaction.fromJson),
    readByUserIds: optionalInts(json, 'readByUserIds'),
    translatedText: optionalField<String>(json, 'translatedText'),
    translationLanguage: optionalField<String>(json, 'translationLanguage'),
    attachments: optionalObjects(json, 'attachments', MediaAttachment.fromJson),
    forwarded: optionalField<bool>(json, 'forwarded'),
  );

  ChatMessage copyWith({
    int? id,
    int? conversationId,
    int? senderId,
    String? sender,
    String? text,
    String? createdAt,
    Object? clientId = absent,
    Object? channelId = absent,
    Object? senderDisplayName = absent,
    Object? replyToMessageId = absent,
    Object? replyToSender = absent,
    Object? replyToDisplayName = absent,
    Object? replyToText = absent,
    Object? editedAt = absent,
    Object? deleted = absent,
    Object? reactions = absent,
    Object? readByUserIds = absent,
    Object? translatedText = absent,
    Object? translationLanguage = absent,
    Object? attachments = absent,
    Object? forwarded = absent,
  }) => ChatMessage(
    id: id ?? this.id,
    conversationId: conversationId ?? this.conversationId,
    senderId: senderId ?? this.senderId,
    sender: sender ?? this.sender,
    text: text ?? this.text,
    createdAt: createdAt ?? this.createdAt,
    clientId: identical(clientId, absent) ? this.clientId : clientId as String?,
    channelId: identical(channelId, absent)
        ? this.channelId
        : channelId as int?,
    senderDisplayName: identical(senderDisplayName, absent)
        ? this.senderDisplayName
        : senderDisplayName as String?,
    replyToMessageId: identical(replyToMessageId, absent)
        ? this.replyToMessageId
        : replyToMessageId as int?,
    replyToSender: identical(replyToSender, absent)
        ? this.replyToSender
        : replyToSender as String?,
    replyToDisplayName: identical(replyToDisplayName, absent)
        ? this.replyToDisplayName
        : replyToDisplayName as String?,
    replyToText: identical(replyToText, absent)
        ? this.replyToText
        : replyToText as String?,
    editedAt: identical(editedAt, absent) ? this.editedAt : editedAt as String?,
    deleted: identical(deleted, absent) ? this.deleted : deleted as bool?,
    reactions: identical(reactions, absent)
        ? this.reactions
        : reactions as List<MessageReaction>?,
    readByUserIds: identical(readByUserIds, absent)
        ? this.readByUserIds
        : readByUserIds as List<int>?,
    translatedText: identical(translatedText, absent)
        ? this.translatedText
        : translatedText as String?,
    translationLanguage: identical(translationLanguage, absent)
        ? this.translationLanguage
        : translationLanguage as String?,
    attachments: identical(attachments, absent)
        ? this.attachments
        : attachments as List<MediaAttachment>?,
    forwarded: identical(forwarded, absent)
        ? this.forwarded
        : forwarded as bool?,
  );

  JsonMap toJson() => {
    'id': id,
    'conversationId': conversationId,
    'senderId': senderId,
    'sender': sender,
    'text': text,
    'createdAt': createdAt,
    if (clientId != null) 'clientId': clientId,
    if (channelId != null) 'channelId': channelId,
    if (senderDisplayName != null) 'senderDisplayName': senderDisplayName,
    if (replyToMessageId != null) 'replyToMessageId': replyToMessageId,
    if (replyToSender != null) 'replyToSender': replyToSender,
    if (replyToDisplayName != null) 'replyToDisplayName': replyToDisplayName,
    if (replyToText != null) 'replyToText': replyToText,
    if (editedAt != null) 'editedAt': editedAt,
    if (deleted != null) 'deleted': deleted,
    if (reactions != null)
      'reactions': reactions!.map((item) => item.toJson()).toList(),
    if (readByUserIds != null) 'readByUserIds': readByUserIds,
    if (translatedText != null) 'translatedText': translatedText,
    if (translationLanguage != null) 'translationLanguage': translationLanguage,
    if (attachments != null)
      'attachments': attachments!.map((item) => item.toJson()).toList(),
    if (forwarded != null) 'forwarded': forwarded,
  };
}

class PinnedMessage {
  const PinnedMessage({required this.message, required this.pinnedAt});
  final ChatMessage message;
  final String pinnedAt;

  factory PinnedMessage.fromJson(JsonMap json) => PinnedMessage(
    message: ChatMessage.fromJson(jsonMap(json['message'])),
    pinnedAt: requiredField<String>(json, 'pinnedAt'),
  );

  PinnedMessage copyWith({ChatMessage? message, String? pinnedAt}) =>
      PinnedMessage(
        message: message ?? this.message,
        pinnedAt: pinnedAt ?? this.pinnedAt,
      );
  JsonMap toJson() => {'message': message.toJson(), 'pinnedAt': pinnedAt};
}

class MessageDraft {
  const MessageDraft({this.text = '', this.attachments = const []});
  final String text;
  final List<MediaAttachment> attachments;

  factory MessageDraft.fromJson(JsonMap json) => MessageDraft(
    text: requiredField<String>(json, 'text'),
    attachments: requiredObjects(json, 'attachments', MediaAttachment.fromJson),
  );
  MessageDraft copyWith({String? text, List<MediaAttachment>? attachments}) =>
      MessageDraft(
        text: text ?? this.text,
        attachments: attachments ?? this.attachments,
      );
  JsonMap toJson() => {
    'text': text,
    'attachments': attachments.map((item) => item.toJson()).toList(),
  };
}

enum RealtimeEventType {
  categoryUpdated('category.updated'),
  privacyUpdated('privacy.updated'),
  message('message'),
  messageUpdated('message.updated'),
  pinsUpdated('pins.updated'),
  conversationCreated('conversation.created'),
  conversationUpdated('conversation.updated'),
  conversationRemoved('conversation.removed'),
  conversationRead('conversation.read'),
  friendUpdated('friend.updated'),
  groupActivity('group.activity');

  const RealtimeEventType(this.wireName);
  final String wireName;
}

class RealtimeEvent {
  const RealtimeEvent({
    required this.type,
    required this.conversationId,
    this.categoryId,
    this.message,
    this.conversation,
    this.readerId,
    this.lastReadMessageId,
  });
  final RealtimeEventType type;
  final int conversationId;
  final int? categoryId;
  final ChatMessage? message;
  final Conversation? conversation;
  final int? readerId;
  final int? lastReadMessageId;

  factory RealtimeEvent.fromJson(JsonMap json) => RealtimeEvent(
    type: enumField(
      json,
      'type',
      RealtimeEventType.values,
      (value) => value.wireName,
    ),
    conversationId: requiredField<int>(json, 'conversationId'),
    categoryId: optionalField<int>(json, 'categoryId'),
    message: json['message'] == null
        ? null
        : ChatMessage.fromJson(jsonMap(json['message'])),
    conversation: json['conversation'] == null
        ? null
        : Conversation.fromJson(jsonMap(json['conversation'])),
    readerId: optionalField<int>(json, 'readerId'),
    lastReadMessageId: optionalField<int>(json, 'lastReadMessageId'),
  );

  RealtimeEvent copyWith({
    RealtimeEventType? type,
    int? conversationId,
    Object? categoryId = absent,
    Object? message = absent,
    Object? conversation = absent,
    Object? readerId = absent,
    Object? lastReadMessageId = absent,
  }) => RealtimeEvent(
    type: type ?? this.type,
    conversationId: conversationId ?? this.conversationId,
    categoryId: identical(categoryId, absent)
        ? this.categoryId
        : categoryId as int?,
    message: identical(message, absent)
        ? this.message
        : message as ChatMessage?,
    conversation: identical(conversation, absent)
        ? this.conversation
        : conversation as Conversation?,
    readerId: identical(readerId, absent) ? this.readerId : readerId as int?,
    lastReadMessageId: identical(lastReadMessageId, absent)
        ? this.lastReadMessageId
        : lastReadMessageId as int?,
  );

  JsonMap toJson() => {
    'type': type.wireName,
    'conversationId': conversationId,
    if (categoryId != null) 'categoryId': categoryId,
    if (message != null) 'message': message!.toJson(),
    if (conversation != null) 'conversation': conversation!.toJson(),
    if (readerId != null) 'readerId': readerId,
    if (lastReadMessageId != null) 'lastReadMessageId': lastReadMessageId,
  };
}

class GroupMember {
  const GroupMember({
    required this.id,
    required this.username,
    required this.displayName,
    required this.role,
    required this.online,
  });
  final int id;
  final String username;
  final String displayName;
  final GroupRole role;
  final bool online;

  factory GroupMember.fromJson(JsonMap json) => GroupMember(
    id: requiredField<int>(json, 'id'),
    username: requiredField<String>(json, 'username'),
    displayName: requiredField<String>(json, 'displayName'),
    role: enumField(json, 'role', GroupRole.values, (value) => value.name),
    online: requiredField<bool>(json, 'online'),
  );

  GroupMember copyWith({
    int? id,
    String? username,
    String? displayName,
    GroupRole? role,
    bool? online,
  }) => GroupMember(
    id: id ?? this.id,
    username: username ?? this.username,
    displayName: displayName ?? this.displayName,
    role: role ?? this.role,
    online: online ?? this.online,
  );
  JsonMap toJson() => {
    'id': id,
    'username': username,
    'displayName': displayName,
    'role': role.name,
    'online': online,
  };
}

class GroupChannel {
  const GroupChannel({
    required this.id,
    required this.name,
    this.description,
    this.topic,
    this.unreadCount,
    this.avatarUrl,
  });

  final int id;
  final String name;
  final String? description;
  final String? topic;
  final int? unreadCount;
  final String? avatarUrl;

  factory GroupChannel.fromJson(JsonMap json) => GroupChannel(
    id: requiredField<int>(json, 'id'),
    name: requiredField<String>(json, 'name'),
    description: optionalField<String>(json, 'description'),
    topic: optionalField<String>(json, 'topic'),
    unreadCount: optionalField<int>(json, 'unreadCount'),
    avatarUrl: optionalField<String>(json, 'avatarUrl'),
  );

  GroupChannel copyWith({
    int? id,
    String? name,
    Object? description = absent,
    Object? topic = absent,
    Object? unreadCount = absent,
    Object? avatarUrl = absent,
  }) => GroupChannel(
    id: id ?? this.id,
    name: name ?? this.name,
    description: identical(description, absent)
        ? this.description
        : description as String?,
    topic: identical(topic, absent) ? this.topic : topic as String?,
    unreadCount: identical(unreadCount, absent)
        ? this.unreadCount
        : unreadCount as int?,
    avatarUrl: identical(avatarUrl, absent)
        ? this.avatarUrl
        : avatarUrl as String?,
  );
  JsonMap toJson() => {
    'id': id,
    'name': name,
    if (description != null) 'description': description,
    if (topic != null) 'topic': topic,
    if (unreadCount != null) 'unreadCount': unreadCount,
    if (avatarUrl != null) 'avatarUrl': avatarUrl,
  };
}

enum NewChatMode { none, friends, direct, group }
