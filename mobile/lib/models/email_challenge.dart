import '../api.dart';

/// Server's email OTP challenge; the token is never logged or stored locally.
class EmailChallenge {
  const EmailChallenge({
    required this.verificationToken,
    required this.emailMasked,
    required this.expiresInSeconds,
  });

  final String verificationToken;
  final String emailMasked;
  final int expiresInSeconds;

  factory EmailChallenge.fromJson(Json json, {required String requestedEmail}) {
    final rawToken = json['verificationToken'];
    if (rawToken is! String || rawToken.isEmpty) {
      throw const FormatException('Missing verificationToken');
    }
    final rawExpiry = json['expiresInSeconds'];
    if (rawExpiry != null && rawExpiry is! num) {
      throw const FormatException('Invalid expiresInSeconds');
    }
    return EmailChallenge(
      verificationToken: rawToken,
      emailMasked: json['emailMasked'] is String
          ? json['emailMasked'] as String
          : requestedEmail,
      expiresInSeconds: (rawExpiry as num?)?.toInt() ?? 600,
    );
  }

  EmailChallenge copyWith({
    String? verificationToken,
    String? emailMasked,
    int? expiresInSeconds,
  }) => EmailChallenge(
    verificationToken: verificationToken ?? this.verificationToken,
    emailMasked: emailMasked ?? this.emailMasked,
    expiresInSeconds: expiresInSeconds ?? this.expiresInSeconds,
  );

  Json toJson() => {
    'verificationToken': verificationToken,
    'emailMasked': emailMasked,
    'expiresInSeconds': expiresInSeconds,
  };
}
