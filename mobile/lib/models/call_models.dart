import 'json_readers.dart';

enum CallMediaType { audio, video }

/// Matches /api/calls/history. Missing call timing/participation is unknown,
/// not an assumed completed call.
class CallHistoryRecord {
  const CallHistoryRecord({
    required this.id,
    required this.conversationId,
    required this.createdBy,
    required this.mediaType,
    required this.createdAt,
    this.status,
    this.startedAt,
    this.endedAt,
    this.joined,
    this.declined,
    this.isGroup,
    this.participantCount,
  });

  final String id;
  final int conversationId;
  final int createdBy;
  final CallMediaType mediaType;
  final String createdAt;
  final String? status;
  final String? startedAt;
  final String? endedAt;
  final bool? joined;
  final bool? declined;
  final bool? isGroup;
  final int? participantCount;

  factory CallHistoryRecord.fromJson(JsonMap json) => CallHistoryRecord(
    id: requiredField<String>(json, 'id'),
    conversationId: requiredField<int>(json, 'conversationId'),
    createdBy: requiredField<int>(json, 'createdBy'),
    mediaType: enumField(
      json,
      'mediaType',
      CallMediaType.values,
      (value) => value.name,
    ),
    createdAt: requiredField<String>(json, 'createdAt'),
    status: optionalField<String>(json, 'status'),
    startedAt: optionalField<String>(json, 'startedAt'),
    endedAt: optionalField<String>(json, 'endedAt'),
    joined: optionalField<bool>(json, 'joined'),
    declined: optionalField<bool>(json, 'declined'),
    isGroup: optionalField<bool>(json, 'isGroup'),
    participantCount: optionalField<int>(json, 'participantCount'),
  );

  CallHistoryRecord copyWith({
    String? id,
    int? conversationId,
    int? createdBy,
    CallMediaType? mediaType,
    String? createdAt,
    Object? status = absent,
    Object? startedAt = absent,
    Object? endedAt = absent,
    Object? joined = absent,
    Object? declined = absent,
    Object? isGroup = absent,
    Object? participantCount = absent,
  }) => CallHistoryRecord(
    id: id ?? this.id,
    conversationId: conversationId ?? this.conversationId,
    createdBy: createdBy ?? this.createdBy,
    mediaType: mediaType ?? this.mediaType,
    createdAt: createdAt ?? this.createdAt,
    status: identical(status, absent) ? this.status : status as String?,
    startedAt: identical(startedAt, absent)
        ? this.startedAt
        : startedAt as String?,
    endedAt: identical(endedAt, absent) ? this.endedAt : endedAt as String?,
    joined: identical(joined, absent) ? this.joined : joined as bool?,
    declined: identical(declined, absent) ? this.declined : declined as bool?,
    isGroup: identical(isGroup, absent) ? this.isGroup : isGroup as bool?,
    participantCount: identical(participantCount, absent)
        ? this.participantCount
        : participantCount as int?,
  );

  JsonMap toJson() => {
    'id': id,
    'conversationId': conversationId,
    'createdBy': createdBy,
    'mediaType': mediaType.name,
    'createdAt': createdAt,
    if (status != null) 'status': status,
    if (startedAt != null) 'startedAt': startedAt,
    if (endedAt != null) 'endedAt': endedAt,
    if (joined != null) 'joined': joined,
    if (declined != null) 'declined': declined,
    if (isGroup != null) 'isGroup': isGroup,
    if (participantCount != null) 'participantCount': participantCount,
  };
}
