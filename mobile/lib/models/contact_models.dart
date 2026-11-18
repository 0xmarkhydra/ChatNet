import 'json_readers.dart';

enum FriendStatus { accepted, pending }

enum FriendRequestDirection { incoming, outgoing }

class FriendSearchResult {
  const FriendSearchResult({
    required this.id,
    required this.username,
    required this.displayName,
    required this.online,
    this.distanceKm,
    this.nearbyActive,
    this.locationUpdatedAt,
    this.mutualGroups,
    this.reason,
  });
  final int id;
  final String username;
  final String displayName;
  final bool online;
  final double? distanceKm;
  final bool? nearbyActive;
  final String? locationUpdatedAt;
  final int? mutualGroups;
  final String? reason;

  factory FriendSearchResult.fromJson(JsonMap json) => FriendSearchResult(
    id: requiredField<int>(json, 'id'),
    username: requiredField<String>(json, 'username'),
    displayName: requiredField<String>(json, 'displayName'),
    online: requiredField<bool>(json, 'online'),
    distanceKm: optionalField<num>(json, 'distanceKm')?.toDouble(),
    nearbyActive: optionalField<bool>(json, 'nearbyActive'),
    locationUpdatedAt: optionalField<String>(json, 'locationUpdatedAt'),
    mutualGroups: optionalField<int>(json, 'mutualGroups'),
    reason: optionalField<String>(json, 'reason'),
  );

  FriendSearchResult copyWith({
    int? id,
    String? username,
    String? displayName,
    bool? online,
    Object? distanceKm = absent,
    Object? nearbyActive = absent,
    Object? locationUpdatedAt = absent,
    Object? mutualGroups = absent,
    Object? reason = absent,
  }) => FriendSearchResult(
    id: id ?? this.id,
    username: username ?? this.username,
    displayName: displayName ?? this.displayName,
    online: online ?? this.online,
    distanceKm: identical(distanceKm, absent)
        ? this.distanceKm
        : (distanceKm as num?)?.toDouble(),
    nearbyActive: identical(nearbyActive, absent)
        ? this.nearbyActive
        : nearbyActive as bool?,
    locationUpdatedAt: identical(locationUpdatedAt, absent)
        ? this.locationUpdatedAt
        : locationUpdatedAt as String?,
    mutualGroups: identical(mutualGroups, absent)
        ? this.mutualGroups
        : mutualGroups as int?,
    reason: identical(reason, absent) ? this.reason : reason as String?,
  );

  JsonMap toJson() => {
    'id': id,
    'username': username,
    'displayName': displayName,
    'online': online,
    if (distanceKm != null) 'distanceKm': distanceKm,
    if (nearbyActive != null) 'nearbyActive': nearbyActive,
    if (locationUpdatedAt != null) 'locationUpdatedAt': locationUpdatedAt,
    if (mutualGroups != null) 'mutualGroups': mutualGroups,
    if (reason != null) 'reason': reason,
  };
}

/// Relationship extends the discovery fields, matching the React interface.
class FriendConnection extends FriendSearchResult {
  const FriendConnection({
    required super.id,
    required super.username,
    required super.displayName,
    required super.online,
    super.distanceKm,
    super.nearbyActive,
    super.locationUpdatedAt,
    super.mutualGroups,
    super.reason,
    required this.status,
    this.favorite,
    this.isFavorite,
    this.direction,
    this.blockedByMe,
    this.blockedByOther,
    this.updatedAt,
  });

  final FriendStatus status;
  final bool? favorite;
  final bool? isFavorite;
  final FriendRequestDirection? direction;
  final bool? blockedByMe;
  final bool? blockedByOther;

  /// Legacy Flutter demo entries may omit updatedAt.
  final String? updatedAt;

  factory FriendConnection.fromJson(JsonMap json) {
    final friend = FriendSearchResult.fromJson(json);
    return FriendConnection(
      id: friend.id,
      username: friend.username,
      displayName: friend.displayName,
      online: friend.online,
      distanceKm: friend.distanceKm,
      nearbyActive: friend.nearbyActive,
      locationUpdatedAt: friend.locationUpdatedAt,
      mutualGroups: friend.mutualGroups,
      reason: friend.reason,
      status: enumField(
        json,
        'status',
        FriendStatus.values,
        (value) => value.name,
      ),
      favorite: optionalField<bool>(json, 'favorite'),
      isFavorite: optionalField<bool>(json, 'isFavorite'),
      direction: optionalEnumField(
        json,
        'direction',
        FriendRequestDirection.values,
        (value) => value.name,
      ),
      blockedByMe: optionalField<bool>(json, 'blockedByMe'),
      blockedByOther: optionalField<bool>(json, 'blockedByOther'),
      updatedAt: optionalField<String>(json, 'updatedAt'),
    );
  }

  @override
  FriendConnection copyWith({
    int? id,
    String? username,
    String? displayName,
    bool? online,
    Object? distanceKm = absent,
    Object? nearbyActive = absent,
    Object? locationUpdatedAt = absent,
    Object? mutualGroups = absent,
    Object? reason = absent,
    FriendStatus? status,
    Object? favorite = absent,
    Object? isFavorite = absent,
    Object? direction = absent,
    Object? blockedByMe = absent,
    Object? blockedByOther = absent,
    Object? updatedAt = absent,
  }) => FriendConnection(
    id: id ?? this.id,
    username: username ?? this.username,
    displayName: displayName ?? this.displayName,
    online: online ?? this.online,
    distanceKm: identical(distanceKm, absent)
        ? this.distanceKm
        : (distanceKm as num?)?.toDouble(),
    nearbyActive: identical(nearbyActive, absent)
        ? this.nearbyActive
        : nearbyActive as bool?,
    locationUpdatedAt: identical(locationUpdatedAt, absent)
        ? this.locationUpdatedAt
        : locationUpdatedAt as String?,
    mutualGroups: identical(mutualGroups, absent)
        ? this.mutualGroups
        : mutualGroups as int?,
    reason: identical(reason, absent) ? this.reason : reason as String?,
    status: status ?? this.status,
    favorite: identical(favorite, absent) ? this.favorite : favorite as bool?,
    isFavorite: identical(isFavorite, absent)
        ? this.isFavorite
        : isFavorite as bool?,
    direction: identical(direction, absent)
        ? this.direction
        : direction as FriendRequestDirection?,
    blockedByMe: identical(blockedByMe, absent)
        ? this.blockedByMe
        : blockedByMe as bool?,
    blockedByOther: identical(blockedByOther, absent)
        ? this.blockedByOther
        : blockedByOther as bool?,
    updatedAt: identical(updatedAt, absent)
        ? this.updatedAt
        : updatedAt as String?,
  );

  @override
  JsonMap toJson() => {
    ...super.toJson(),
    'status': status.name,
    if (favorite != null) 'favorite': favorite,
    if (isFavorite != null) 'isFavorite': isFavorite,
    if (direction != null) 'direction': direction!.name,
    if (blockedByMe != null) 'blockedByMe': blockedByMe,
    if (blockedByOther != null) 'blockedByOther': blockedByOther,
    if (updatedAt != null) 'updatedAt': updatedAt,
  };
}
