import 'json_readers.dart';

class AccountUser {
  const AccountUser({
    required this.id,
    required this.username,
    required this.displayName,
    required this.email,
  });
  final int id;
  final String username;
  final String displayName;
  final String email;

  factory AccountUser.fromJson(JsonMap json) => AccountUser(
    id: requiredField<int>(json, 'id'),
    username: requiredField<String>(json, 'username'),
    displayName: requiredField<String>(json, 'displayName'),
    email: requiredField<String>(json, 'email'),
  );
  AccountUser copyWith({
    int? id,
    String? username,
    String? displayName,
    String? email,
  }) => AccountUser(
    id: id ?? this.id,
    username: username ?? this.username,
    displayName: displayName ?? this.displayName,
    email: email ?? this.email,
  );
  JsonMap toJson() => {
    'id': id,
    'username': username,
    'displayName': displayName,
    'email': email,
  };
}

/// Data only. Auth and secure storage must validate credentials separately.
class AuthSession {
  const AuthSession({
    required this.token,
    required this.sessionId,
    required this.user,
    this.refreshToken,
  });
  final String token;
  final String sessionId;
  final String? refreshToken;
  final AccountUser user;

  factory AuthSession.fromJson(JsonMap json) => AuthSession(
    token: requiredField<String>(json, 'token'),
    sessionId: requiredField<String>(json, 'sessionId'),
    user: AccountUser.fromJson(jsonMap(json['user'])),
    refreshToken: optionalField<String>(json, 'refreshToken'),
  );
  AuthSession copyWith({
    String? token,
    String? sessionId,
    AccountUser? user,
    Object? refreshToken = absent,
  }) => AuthSession(
    token: token ?? this.token,
    sessionId: sessionId ?? this.sessionId,
    user: user ?? this.user,
    refreshToken: identical(refreshToken, absent)
        ? this.refreshToken
        : refreshToken as String?,
  );
  JsonMap toJson() => {
    'token': token,
    'sessionId': sessionId,
    'user': user.toJson(),
    if (refreshToken != null) 'refreshToken': refreshToken,
  };
}

class ManagedAccountSession {
  const ManagedAccountSession({
    required this.id,
    required this.userAgent,
    required this.createdAt,
    required this.lastSeenAt,
    required this.expiresAt,
    required this.current,
  });
  final String id;
  final String userAgent;
  final String createdAt;
  final String lastSeenAt;
  final String expiresAt;
  final bool current;

  factory ManagedAccountSession.fromJson(JsonMap json) => ManagedAccountSession(
    id: requiredField<String>(json, 'id'),
    userAgent: requiredField<String>(json, 'userAgent'),
    createdAt: requiredField<String>(json, 'createdAt'),
    lastSeenAt: requiredField<String>(json, 'lastSeenAt'),
    expiresAt: requiredField<String>(json, 'expiresAt'),
    current: requiredField<bool>(json, 'current'),
  );
  ManagedAccountSession copyWith({
    String? id,
    String? userAgent,
    String? createdAt,
    String? lastSeenAt,
    String? expiresAt,
    bool? current,
  }) => ManagedAccountSession(
    id: id ?? this.id,
    userAgent: userAgent ?? this.userAgent,
    createdAt: createdAt ?? this.createdAt,
    lastSeenAt: lastSeenAt ?? this.lastSeenAt,
    expiresAt: expiresAt ?? this.expiresAt,
    current: current ?? this.current,
  );
  JsonMap toJson() => {
    'id': id,
    'userAgent': userAgent,
    'createdAt': createdAt,
    'lastSeenAt': lastSeenAt,
    'expiresAt': expiresAt,
    'current': current,
  };
}
