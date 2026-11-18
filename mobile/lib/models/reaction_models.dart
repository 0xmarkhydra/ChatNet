import 'json_readers.dart';

class ReactionParticipant {
  const ReactionParticipant({
    required this.userId,
    required this.username,
    required this.emoji,
    this.displayName,
  });
  final int userId;
  final String username;
  final String emoji;
  final String? displayName;

  factory ReactionParticipant.fromJson(JsonMap json) => ReactionParticipant(
    userId: requiredField<int>(json, 'userId'),
    username: requiredField<String>(json, 'username'),
    emoji: requiredField<String>(json, 'emoji'),
    displayName: optionalField<String>(json, 'displayName'),
  );

  ReactionParticipant copyWith({
    int? userId,
    String? username,
    String? emoji,
    Object? displayName = absent,
  }) => ReactionParticipant(
    userId: userId ?? this.userId,
    username: username ?? this.username,
    emoji: emoji ?? this.emoji,
    displayName: identical(displayName, absent)
        ? this.displayName
        : displayName as String?,
  );
  JsonMap toJson() => {
    'userId': userId,
    'username': username,
    'emoji': emoji,
    if (displayName != null) 'displayName': displayName,
  };
}

class ReactionParticipantsPage {
  const ReactionParticipantsPage({required this.items, required this.hasMore});
  final List<ReactionParticipant> items;
  final bool hasMore;

  factory ReactionParticipantsPage.fromJson(JsonMap json) =>
      ReactionParticipantsPage(
        items: requiredObjects(json, 'items', ReactionParticipant.fromJson),
        hasMore: requiredField<bool>(json, 'hasMore'),
      );
  ReactionParticipantsPage copyWith({
    List<ReactionParticipant>? items,
    bool? hasMore,
  }) => ReactionParticipantsPage(
    items: items ?? this.items,
    hasMore: hasMore ?? this.hasMore,
  );
  JsonMap toJson() => {
    'items': items.map((value) => value.toJson()).toList(),
    'hasMore': hasMore,
  };
}
