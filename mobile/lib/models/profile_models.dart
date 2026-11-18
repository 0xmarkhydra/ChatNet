import 'json_readers.dart';

class ProfileMediaState {
  const ProfileMediaState({
    required this.username,
    required this.displayName,
    required this.avatarSet,
    required this.coverSet,
    this.updatedAt,
    this.bio,
    this.city,
  });
  final String username;
  final String displayName;
  final bool avatarSet;
  final bool coverSet;

  /// Optional for compatibility with older Flutter profile previews.
  final String? updatedAt;
  final String? bio;
  final String? city;

  factory ProfileMediaState.fromJson(JsonMap json) => ProfileMediaState(
    username: requiredField<String>(json, 'username'),
    displayName: requiredField<String>(json, 'displayName'),
    avatarSet: requiredField<bool>(json, 'avatarSet'),
    coverSet: requiredField<bool>(json, 'coverSet'),
    updatedAt: optionalField<String>(json, 'updatedAt'),
    bio: optionalField<String>(json, 'bio'),
    city: optionalField<String>(json, 'city'),
  );

  ProfileMediaState copyWith({
    String? username,
    String? displayName,
    bool? avatarSet,
    bool? coverSet,
    Object? updatedAt = absent,
    Object? bio = absent,
    Object? city = absent,
  }) => ProfileMediaState(
    username: username ?? this.username,
    displayName: displayName ?? this.displayName,
    avatarSet: avatarSet ?? this.avatarSet,
    coverSet: coverSet ?? this.coverSet,
    updatedAt: identical(updatedAt, absent)
        ? this.updatedAt
        : updatedAt as String?,
    bio: identical(bio, absent) ? this.bio : bio as String?,
    city: identical(city, absent) ? this.city : city as String?,
  );

  JsonMap toJson() => {
    'username': username,
    'displayName': displayName,
    'avatarSet': avatarSet,
    'coverSet': coverSet,
    if (updatedAt != null) 'updatedAt': updatedAt,
    if (bio != null) 'bio': bio,
    if (city != null) 'city': city,
  };
}

class ProfileUpdateResponse extends ProfileMediaState {
  const ProfileUpdateResponse({
    required super.username,
    required super.displayName,
    required super.avatarSet,
    required super.coverSet,
    super.updatedAt,
    super.bio,
    super.city,
    required this.token,
  });
  final String token;

  factory ProfileUpdateResponse.fromJson(JsonMap json) {
    final state = ProfileMediaState.fromJson(json);
    return ProfileUpdateResponse(
      username: state.username,
      displayName: state.displayName,
      avatarSet: state.avatarSet,
      coverSet: state.coverSet,
      updatedAt: state.updatedAt,
      bio: state.bio,
      city: state.city,
      token: requiredField<String>(json, 'token'),
    );
  }

  @override
  ProfileUpdateResponse copyWith({
    String? username,
    String? displayName,
    bool? avatarSet,
    bool? coverSet,
    Object? updatedAt = absent,
    Object? bio = absent,
    Object? city = absent,
    String? token,
  }) => ProfileUpdateResponse(
    username: username ?? this.username,
    displayName: displayName ?? this.displayName,
    avatarSet: avatarSet ?? this.avatarSet,
    coverSet: coverSet ?? this.coverSet,
    updatedAt: identical(updatedAt, absent)
        ? this.updatedAt
        : updatedAt as String?,
    bio: identical(bio, absent) ? this.bio : bio as String?,
    city: identical(city, absent) ? this.city : city as String?,
    token: token ?? this.token,
  );

  @override
  JsonMap toJson() => {...super.toJson(), 'token': token};
}

class UserPrivacy {
  const UserPrivacy({
    required this.searchableByUsername,
    required this.searchableByName,
    required this.searchableByEmail,
    required this.allowFriendRequests,
    required this.showOnlineStatus,
  });
  final bool searchableByUsername;
  final bool searchableByName;
  final bool searchableByEmail;
  final bool allowFriendRequests;
  final bool showOnlineStatus;

  factory UserPrivacy.fromJson(JsonMap json) => UserPrivacy(
    searchableByUsername: requiredField<bool>(json, 'searchableByUsername'),
    searchableByName: requiredField<bool>(json, 'searchableByName'),
    searchableByEmail: requiredField<bool>(json, 'searchableByEmail'),
    allowFriendRequests: requiredField<bool>(json, 'allowFriendRequests'),
    showOnlineStatus: requiredField<bool>(json, 'showOnlineStatus'),
  );

  UserPrivacy copyWith({
    bool? searchableByUsername,
    bool? searchableByName,
    bool? searchableByEmail,
    bool? allowFriendRequests,
    bool? showOnlineStatus,
  }) => UserPrivacy(
    searchableByUsername: searchableByUsername ?? this.searchableByUsername,
    searchableByName: searchableByName ?? this.searchableByName,
    searchableByEmail: searchableByEmail ?? this.searchableByEmail,
    allowFriendRequests: allowFriendRequests ?? this.allowFriendRequests,
    showOnlineStatus: showOnlineStatus ?? this.showOnlineStatus,
  );
  JsonMap toJson() => {
    'searchableByUsername': searchableByUsername,
    'searchableByName': searchableByName,
    'searchableByEmail': searchableByEmail,
    'allowFriendRequests': allowFriendRequests,
    'showOnlineStatus': showOnlineStatus,
  };
}

class UserPreferences {
  const UserPreferences({
    required this.targetLanguage,
    required this.autoTranslate,
    required this.appLocale,
  });
  final String targetLanguage;
  final bool autoTranslate;
  final String appLocale;

  factory UserPreferences.fromJson(JsonMap json) => UserPreferences(
    targetLanguage: requiredField<String>(json, 'targetLanguage'),
    autoTranslate: requiredField<bool>(json, 'autoTranslate'),
    appLocale: requiredField<String>(json, 'appLocale'),
  );
  UserPreferences copyWith({
    String? targetLanguage,
    bool? autoTranslate,
    String? appLocale,
  }) => UserPreferences(
    targetLanguage: targetLanguage ?? this.targetLanguage,
    autoTranslate: autoTranslate ?? this.autoTranslate,
    appLocale: appLocale ?? this.appLocale,
  );
  JsonMap toJson() => {
    'targetLanguage': targetLanguage,
    'autoTranslate': autoTranslate,
    'appLocale': appLocale,
  };
}
