import 'json_readers.dart';
import 'media_attachment.dart';

enum PostVisibility { public, friends, private }

class FeedReaction {
  const FeedReaction({required this.emoji, required this.count});
  final String emoji;
  final int count;

  factory FeedReaction.fromJson(JsonMap json) => FeedReaction(
    emoji: requiredField<String>(json, 'emoji'),
    count: requiredField<int>(json, 'count'),
  );
  FeedReaction copyWith({String? emoji, int? count}) =>
      FeedReaction(emoji: emoji ?? this.emoji, count: count ?? this.count);
  JsonMap toJson() => {'emoji': emoji, 'count': count};
}

class FeedComment {
  const FeedComment({
    required this.id,
    required this.author,
    required this.content,
    required this.createdAt,
    this.parentId,
    this.authorDisplayName,
    this.updatedAt,
  });

  final int id;
  final String author;
  final String content;
  final String createdAt;
  final int? parentId;
  final String? authorDisplayName;
  final String? updatedAt;

  factory FeedComment.fromJson(JsonMap json) => FeedComment(
    id: requiredField<int>(json, 'id'),
    author: requiredField<String>(json, 'author'),
    content: requiredField<String>(json, 'content'),
    createdAt: requiredField<String>(json, 'createdAt'),
    parentId: optionalField<int>(json, 'parentId'),
    authorDisplayName: optionalField<String>(json, 'authorDisplayName'),
    updatedAt: optionalField<String>(json, 'updatedAt'),
  );

  FeedComment copyWith({
    int? id,
    String? author,
    String? content,
    String? createdAt,
    Object? parentId = absent,
    Object? authorDisplayName = absent,
    Object? updatedAt = absent,
  }) => FeedComment(
    id: id ?? this.id,
    author: author ?? this.author,
    content: content ?? this.content,
    createdAt: createdAt ?? this.createdAt,
    parentId: identical(parentId, absent) ? this.parentId : parentId as int?,
    authorDisplayName: identical(authorDisplayName, absent)
        ? this.authorDisplayName
        : authorDisplayName as String?,
    updatedAt: identical(updatedAt, absent)
        ? this.updatedAt
        : updatedAt as String?,
  );

  JsonMap toJson() => {
    'id': id,
    'author': author,
    'content': content,
    'createdAt': createdAt,
    if (parentId != null) 'parentId': parentId,
    if (authorDisplayName != null) 'authorDisplayName': authorDisplayName,
    if (updatedAt != null) 'updatedAt': updatedAt,
  };
}

class FeedPost {
  const FeedPost({
    required this.id,
    required this.author,
    required this.content,
    required this.likes,
    required this.liked,
    required this.comments,
    required this.createdAt,
    this.authorDisplayName,
    this.myReaction,
    this.reactions,
    this.attachments,
    this.visibility,
    this.background,
    this.updatedAt,
    this.saved,
  });

  final int id;
  final String author;
  final String content;
  final int likes;
  final bool liked;
  final List<FeedComment> comments;
  final String createdAt;
  final String? authorDisplayName;
  final String? myReaction;
  final List<FeedReaction>? reactions;
  final List<MediaAttachment>? attachments;
  final PostVisibility? visibility;
  final String? background;
  final String? updatedAt;
  final bool? saved;

  factory FeedPost.fromJson(JsonMap json) => FeedPost(
    id: requiredField<int>(json, 'id'),
    author: requiredField<String>(json, 'author'),
    content: requiredField<String>(json, 'content'),
    likes: requiredField<int>(json, 'likes'),
    liked: requiredField<bool>(json, 'liked'),
    comments: requiredObjects(json, 'comments', FeedComment.fromJson),
    createdAt: requiredField<String>(json, 'createdAt'),
    authorDisplayName: optionalField<String>(json, 'authorDisplayName'),
    myReaction: optionalField<String>(json, 'myReaction'),
    reactions: optionalObjects(json, 'reactions', FeedReaction.fromJson),
    attachments: optionalObjects(json, 'attachments', MediaAttachment.fromJson),
    visibility: optionalEnumField(
      json,
      'visibility',
      PostVisibility.values,
      (value) => value.name,
    ),
    background: optionalField<String>(json, 'background'),
    updatedAt: optionalField<String>(json, 'updatedAt'),
    saved: optionalField<bool>(json, 'saved'),
  );

  FeedPost copyWith({
    int? id,
    String? author,
    String? content,
    int? likes,
    bool? liked,
    List<FeedComment>? comments,
    String? createdAt,
    Object? authorDisplayName = absent,
    Object? myReaction = absent,
    Object? reactions = absent,
    Object? attachments = absent,
    Object? visibility = absent,
    Object? background = absent,
    Object? updatedAt = absent,
    Object? saved = absent,
  }) => FeedPost(
    id: id ?? this.id,
    author: author ?? this.author,
    content: content ?? this.content,
    likes: likes ?? this.likes,
    liked: liked ?? this.liked,
    comments: comments ?? this.comments,
    createdAt: createdAt ?? this.createdAt,
    authorDisplayName: identical(authorDisplayName, absent)
        ? this.authorDisplayName
        : authorDisplayName as String?,
    myReaction: identical(myReaction, absent)
        ? this.myReaction
        : myReaction as String?,
    reactions: identical(reactions, absent)
        ? this.reactions
        : reactions as List<FeedReaction>?,
    attachments: identical(attachments, absent)
        ? this.attachments
        : attachments as List<MediaAttachment>?,
    visibility: identical(visibility, absent)
        ? this.visibility
        : visibility as PostVisibility?,
    background: identical(background, absent)
        ? this.background
        : background as String?,
    updatedAt: identical(updatedAt, absent)
        ? this.updatedAt
        : updatedAt as String?,
    saved: identical(saved, absent) ? this.saved : saved as bool?,
  );

  JsonMap toJson() => {
    'id': id,
    'author': author,
    'content': content,
    'likes': likes,
    'liked': liked,
    'comments': comments.map((item) => item.toJson()).toList(),
    'createdAt': createdAt,
    if (authorDisplayName != null) 'authorDisplayName': authorDisplayName,
    if (myReaction != null) 'myReaction': myReaction,
    if (reactions != null)
      'reactions': reactions!.map((item) => item.toJson()).toList(),
    if (attachments != null)
      'attachments': attachments!.map((item) => item.toJson()).toList(),
    if (visibility != null) 'visibility': visibility!.name,
    if (background != null) 'background': background,
    if (updatedAt != null) 'updatedAt': updatedAt,
    if (saved != null) 'saved': saved,
  };
}

class Story {
  const Story({
    required this.id,
    required this.author,
    required this.attachment,
    required this.createdAt,
    required this.expiresAt,
    this.authorDisplayName,
  });

  final int id;
  final String author;
  final MediaAttachment attachment;
  final String createdAt;
  final String expiresAt;
  final String? authorDisplayName;

  factory Story.fromJson(JsonMap json) => Story(
    id: requiredField<int>(json, 'id'),
    author: requiredField<String>(json, 'author'),
    attachment: MediaAttachment.fromJson(jsonMap(json['attachment'])),
    createdAt: requiredField<String>(json, 'createdAt'),
    expiresAt: requiredField<String>(json, 'expiresAt'),
    authorDisplayName: optionalField<String>(json, 'authorDisplayName'),
  );

  Story copyWith({
    int? id,
    String? author,
    MediaAttachment? attachment,
    String? createdAt,
    String? expiresAt,
    Object? authorDisplayName = absent,
  }) => Story(
    id: id ?? this.id,
    author: author ?? this.author,
    attachment: attachment ?? this.attachment,
    createdAt: createdAt ?? this.createdAt,
    expiresAt: expiresAt ?? this.expiresAt,
    authorDisplayName: identical(authorDisplayName, absent)
        ? this.authorDisplayName
        : authorDisplayName as String?,
  );

  JsonMap toJson() => {
    'id': id,
    'author': author,
    'attachment': attachment.toJson(),
    'createdAt': createdAt,
    'expiresAt': expiresAt,
    if (authorDisplayName != null) 'authorDisplayName': authorDisplayName,
  };
}
